#!/usr/bin/env python3
"""Download audited, resumable GC history without invoking any trading pipeline."""
from __future__ import annotations

import argparse
import asyncio
import gzip
import json
import os
import shutil
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.backfill.rithmic_history import (
    HISTORY_SOURCE, HOUR_SECONDS, QUALITY_SCHEMA, HistoryArchive,
    history_print, import_history_hour, history_lock,
)
from app.config import Settings
from app.rithmic.client import RithmicLogin
from app.rithmic.history import RithmicHistoryClient, RithmicHistoryUnavailable
from app.storage.cache_store import CacheStore
from app.storage.tick_store import TickStore


def parse_date(value: str) -> int:
    moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    result = int(moment.timestamp())
    if result % HOUR_SECONDS:
        raise argparse.ArgumentTypeError("history bounds must align to a UTC hour")
    return result


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--days", type=int, default=90)
    p.add_argument("--from", dest="start", type=parse_date)
    p.add_argument("--to", dest="end", type=parse_date)
    p.add_argument("--symbol", default="GCZ6")
    p.add_argument("--contract", default="GC 12-26")
    p.add_argument("--exchange", default="COMEX")
    p.add_argument("--uri", default=os.getenv("NTTOTV_RITHMIC_URI", "wss://rprotocol-mobile.rithmic.com:443"))
    p.add_argument("--data-dir", type=Path, default=BACKEND_ROOT / "data")
    p.add_argument("--archive", type=Path, default=BACKEND_ROOT.parent / "RProtocolAPI.zip")
    p.add_argument("--max-hours", type=int, default=0, help="limit NEW hours for a bounded validation run")
    p.add_argument("--retry-seconds", type=int, default=300)
    p.add_argument("--max-retries", type=int, default=0, help="retry unavailable history with a bounded backoff")
    return p


async def run(args):
    if args.days < 1 or args.days > Settings().tick_retention_days:
        raise ValueError("download days must fit the configured raw retention window")
    now = datetime.now(timezone.utc)
    start = args.start if args.start is not None else int((now.replace(hour=0, minute=0, second=0, microsecond=0)
                                                        - timedelta(days=args.days - 1)).timestamp())
    end = args.end if args.end is not None else int(now.timestamp()) // HOUR_SECONDS * HOUR_SECONDS
    oldest = int((now.replace(hour=0, minute=0, second=0, microsecond=0)
                  - timedelta(days=Settings().tick_retention_days - 1)).timestamp())
    if start < oldest or start >= end or end > int(now.timestamp()):
        raise ValueError("invalid range: history must be inside retention and not in the future")
    args.data_dir.mkdir(parents=True, exist_ok=True)
    archive = HistoryArchive(args.data_dir / "rithmic-history", args.symbol)
    archive.state.update(wireSymbol=args.symbol, sourceContract=args.contract,
                         source=HISTORY_SOURCE, rangeStart=start, rangeEnd=end,
                         status="running", processId=os.getpid())
    login = RithmicLogin.from_environment()
    cache = CacheStore(args.data_dir / "app.sqlite")
    cache.writer.executescript(QUALITY_SCHEMA)
    ticks = TickStore(args.data_dir / "ticks")
    client = RithmicHistoryClient(uri=args.uri, archive_path=args.archive.resolve(), timeout_seconds=20)
    written = skipped = 0
    started = time.monotonic()
    hours = list(range(start, end, HOUR_SECONDS))
    try:
        async with client.session(login) as websocket:
            for chunk_start in hours:
                chunk_end = min(end, chunk_start + HOUR_SECONDS) - 1
                if archive.is_complete(chunk_start, chunk_end):
                    skipped += 1
                    continue
                if shutil.disk_usage(args.data_dir).free < 10 * 1024**3:
                    raise OSError("less than 10 GiB free; history download paused without deleting data")
                rows = None
                if archive.path(chunk_start, chunk_end).exists():
                    try:
                        rows = archive.read(chunk_start, chunk_end)
                    except (ValueError, EOFError, gzip.BadGzipFile):
                        # Keep a suspect file as evidence, outside the ML glob.
                        path = archive.path(chunk_start, chunk_end)
                        os.replace(path, path.with_suffix(".gz.incomplete"))
                if rows is None:
                    messages = await client.replay(websocket, symbol=args.symbol, exchange=args.exchange,
                                                   start=chunk_start, end=chunk_end)
                    rows = [history_print(m, start=chunk_start, end=chunk_end, ordinal=i)
                            for i, m in enumerate(messages)]
                    if any(a["timeUs"] > b["timeUs"] for a, b in zip(rows, rows[1:])):
                        raise ValueError("server returned non-chronological trades")
                    archive.write(chunk_start, chunk_end, rows, {
                        "wireSymbol": args.symbol, "sourceContract": args.contract,
                        "source": HISTORY_SOURCE, "exchange": args.exchange,
                    })
                stats = await asyncio.to_thread(import_history_hour, archive, cache, ticks, rows,
                                                 contract=args.contract, start=chunk_start, end=chunk_end)
                written += 1
                print(json.dumps({"hourUTC": datetime.fromtimestamp(chunk_start, timezone.utc).isoformat(),
                                  "doneHours": written + skipped, "totalHours": len(hours),
                                  "secondsElapsed": round(time.monotonic() - started), **stats}), flush=True)
                if args.max_hours and written >= args.max_hours:
                    break
                await asyncio.sleep(0.05)
        complete = all(archive.is_complete(t, min(end, t + HOUR_SECONDS) - 1) for t in hours)
        archive.state["status"] = "complete" if complete else "paused"
        # Atomic manifest write without manufacturing a completed hour.
        temp = archive.manifest.with_suffix(".tmp")
        temp.write_text(json.dumps(archive.state), encoding="utf-8")
        os.replace(temp, archive.manifest)
        print(json.dumps({"status": archive.state["status"], "writtenHours": written,
                          "skippedHours": skipped, "totalHours": len(hours)}), flush=True)
    except BaseException:
        archive.state["status"] = "interrupted"
        temp = archive.manifest.with_suffix(".tmp")
        temp.write_text(json.dumps(archive.state), encoding="utf-8")
        os.replace(temp, archive.manifest)
        raise
    finally:
        ticks.close()
        cache.close()


def run_cli(args):
    if args.max_retries < 0 or args.retry_seconds < 30:
        raise SystemExit("retry count must be nonnegative and delay at least 30 seconds")
    try:
        attempt = 0
        while True:
            try:
                asyncio.run(run(args))
                break
            except RithmicHistoryUnavailable as exc:
                # 14 is an explicit 'unknown request', not empty market data.
                # Retry sparingly through maintenance; no interval is complete.
                if exc.code != "14" or attempt >= args.max_retries:
                    raise
                attempt += 1
                archive = HistoryArchive(args.data_dir / "rithmic-history", args.symbol)
                archive.state.update(status="waiting_for_source", lastErrorCode=exc.code,
                                     retryAttempt=attempt, processId=os.getpid(),
                                     nextRetryAt=int((time.time() + args.retry_seconds) * 1000))
                temp = archive.manifest.with_suffix(".tmp")
                temp.write_text(json.dumps(archive.state), encoding="utf-8")
                os.replace(temp, archive.manifest)
                print(json.dumps({"status": "waiting_for_source", "code": exc.code,
                                  "attempt": attempt, "retrySeconds": args.retry_seconds}), flush=True)
                time.sleep(args.retry_seconds)
    except Exception as exc:
        text = str(exc)
        for key in ("NTTOTV_RITHMIC_USER", "NTTOTV_RITHMIC_PASSWORD"):
            secret = os.getenv(key)
            if secret:
                text = text.replace(secret, "[redacted]")
        print(json.dumps({"status": "interrupted", "errorType": type(exc).__name__, "error": text}), flush=True)
        return 1
    return 0


def main():
    args = parser().parse_args()
    if not args.symbol.isalnum():
        raise SystemExit("invalid history symbol")
    try:
        with history_lock(args.data_dir / "rithmic-history" / args.symbol):
            return run_cli(args)
    except OSError:
        print(json.dumps({"status": "interrupted", "error": "another history downloader owns the archive, or archive lock is unavailable"}), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
