"""Parity fixtures loader (task 19.1).

Loads the JSON parity fixtures from ``tests/fixtures/parity`` (schemaVersion 1)
and exposes them as typed :class:`ParityFixture` objects grouped by engine.
Each fixture pairs a recorded/spec-derived input event stream with the
reference-indicator oracle output for that exact stream. (Req 13.8, 14.9, 15.6)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

__all__ = [
    "FIXTURES_DIR",
    "SCHEMA_VERSION",
    "ParityFixture",
    "load_fixtures",
    "load_fixtures_for",
]

# tests/fixtures/parity, resolved relative to this file (tests/parity/..).
FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "parity"
SCHEMA_VERSION = 1


@dataclass(frozen=True, slots=True)
class ParityFixture:
    """One parity fixture: an input event stream paired with an oracle output."""

    name: str
    engine: str
    source: str
    symbol: str
    contract: str
    config: dict[str, Any]
    events: list[dict[str, Any]]
    expected: dict[str, Any]
    description: str = ""

    @classmethod
    def from_json(cls, name: str, data: dict[str, Any]) -> "ParityFixture":
        version = int(data.get("schemaVersion", 0))
        if version != SCHEMA_VERSION:
            raise ValueError(
                f"fixture {name!r}: unsupported schemaVersion {version} "
                f"(expected {SCHEMA_VERSION})"
            )
        return cls(
            name=name,
            engine=data["engine"],
            source=data.get("source", "spec-derived"),
            symbol=data["symbol"],
            contract=data["contract"],
            config=dict(data.get("config", {})),
            events=list(data["events"]),
            expected=dict(data["expected"]),
            description=data.get("description", ""),
        )


def load_fixtures(directory: Path | None = None) -> list[ParityFixture]:
    """Load all parity fixtures from ``directory`` (default :data:`FIXTURES_DIR`)."""
    root = directory or FIXTURES_DIR
    fixtures: list[ParityFixture] = []
    for path in sorted(root.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        fixtures.append(ParityFixture.from_json(path.name, data))
    return fixtures


def load_fixtures_for(engine: str, directory: Path | None = None) -> list[ParityFixture]:
    """Load the parity fixtures for a single ``engine`` (e.g. ``"volume_delta"``)."""
    return [f for f in load_fixtures(directory) if f.engine == engine]
