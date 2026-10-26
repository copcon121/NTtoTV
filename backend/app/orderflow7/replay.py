"""Offline ladder JSONL replay. Run: python -m app.orderflow7.replay --help."""

import argparse
from dataclasses import asdict
import json
from pathlib import Path
from typing import TextIO

from .config import FEATURES, OF7Config, REFERENCE_SHA256
from .engine import OF7Engine
from .models import OF7Bar, OF7Cell
from .groups import feature_groups


def replay(stream: TextIO, output: TextIO, config: OF7Config) -> int:
    engine = OF7Engine(config)
    count = 0
    for number, line in enumerate(stream, 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
            observed_at = record.pop("observed_at")
            # Require provenance and quality explicitly for imported datasets.
            for key in ("source", "source_contract", "session_id", "is_closed", "between_known"):
                if key not in record:
                    raise ValueError(f"missing {key}")
            record["cells"] = tuple(OF7Cell(**cell) for cell in record["cells"])
            snapshot = engine.update(OF7Bar(**record), observed_at=observed_at)
            payload = asdict(snapshot)
            # Disabled differs from enabled-but-inactive. Signals are observations,
            # not target labels or calibrated probabilities.
            payload["feature_counts"] = {
                feature: sum(s.feature == feature for s in snapshot.signals)
                if feature in config.enabled_features else None for feature in FEATURES
            }
            payload["analysis_feature_counts"] = {
                feature: sum(s.feature == feature for s in snapshot.analysis_signals)
                if feature in config.enabled_features else None for feature in FEATURES
            }
            payload["calculation_parameters"] = asdict(config)
            payload["reference_sha256"] = REFERENCE_SHA256
            payload["tick_size"] = config.tick_size
            payload["feature_groups"] = feature_groups()
            output.write(json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n")
            count += 1
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"invalid OF7 snapshot at line {number}: {exc}") from exc
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?", help="JSONL ladder snapshots, integer tick prices")
    parser.add_argument("output", type=Path, nargs="?", help="new JSONL output (never overwrites)")
    parser.add_argument("--preset", choices=("default", "research"), default="default")
    parser.add_argument("--config", type=Path, help="JSON parameter overrides")
    parser.add_argument("--show-config", action="store_true")
    args = parser.parse_args()
    overrides = json.loads(args.config.read_text(encoding="utf-8")) if args.config else {}
    factory = OF7Config.research if args.preset == "research" else OF7Config
    config = factory(**overrides)
    if args.show_config:
        print(json.dumps({"parameters": asdict(config), "config_hash": config.fingerprint,
                          "reference_sha256": REFERENCE_SHA256}, indent=2))
        return
    if args.input is None or args.output is None:
        parser.error("input and output are required unless --show-config is used")
    if args.input.resolve() == args.output.resolve():
        parser.error("input and output must differ")
    # x-mode protects existing user datasets. On error, partial output is retained
    # for diagnosis; callers must treat a nonzero exit as incomplete replay.
    with args.input.open(encoding="utf-8") as stream, args.output.open("x", encoding="utf-8") as output:
        count = replay(stream, output, config)
    print(f"Replayed {count} snapshots to {args.output}")


if __name__ == "__main__":
    main()
