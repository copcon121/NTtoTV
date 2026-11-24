"""Data models and schemas for Scan AI (Suggestions on chart)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

SuggestionGroup = Literal["levels", "lines", "fibonacci", "patterns", "elliott"]
SuggestionState = Literal[
    "waiting", "in_play", "tested", "played_out", "invalidated", "old"
]
SuggestionStrength = Literal["weak", "moderate", "strong"]
DrawingTool = Literal[
    "horizontal_ray", "trendline", "fib_retracement", "rectangle", "path"
]

ALL_GROUPS: tuple[SuggestionGroup, ...] = (
    "levels",
    "lines",
    "fibonacci",
    "patterns",
    "elliott",
)

ALL_STATES: tuple[SuggestionState, ...] = (
    "waiting",
    "in_play",
    "tested",
    "played_out",
    "invalidated",
    "old",
)

ALL_PATTERNS: tuple[str, ...] = (
    "harmonics",
    "head_and_shoulders",
    "three_drives",
    "triangles_and_pennants",
    "flags",
    "elliott_waves",
    "double_top_bottom",
)

SCAN_DEPTHS: tuple[str, ...] = ("short", "medium", "deep")
SCAN_DENSITIES: tuple[str, ...] = ("auto", "less", "normal", "more")
SCAN_STRENGTHS: tuple[str, ...] = ("all", "moderate", "strong")


@dataclass(slots=True)
class AnchorPoint:
    time: int  # Unix timestamp in seconds for lightweight-charts
    price: float

    def to_dict(self) -> dict[str, Any]:
        return {"time": self.time, "price": round(self.price, 4)}


ScanAiAnchor = AnchorPoint


@dataclass(slots=True)
class ScanAiSuggestion:
    id: str
    group: SuggestionGroup
    type: str
    name: str
    description: str
    state: SuggestionState
    strength: SuggestionStrength
    score: float
    drawing_tool: DrawingTool
    anchors: list[AnchorPoint]
    options: dict[str, Any] = field(default_factory=dict)
    target: float | None = None
    stop: float | None = None
    invalidation_price: float | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    created_at: int = 0  # ms timestamp

    def to_dict(self) -> dict[str, Any]:
        opts = dict(self.options)
        if "color" in opts and "lineColor" not in opts:
            opts["lineColor"] = opts["color"]
        if "fill" in opts and "fillColor" not in opts:
            opts["fillColor"] = opts["fill"]
        return {
            "id": self.id,
            "group": self.group,
            "type": self.type,
            "name": self.name,
            "label": self.name,
            "description": self.description,
            "state": self.state,
            "strength": self.strength,
            "score": round(self.score, 1),
            "drawingTool": self.drawing_tool,
            "anchors": [a.to_dict() for a in self.anchors],
            "options": opts,
            "target": None if self.target is None else round(self.target, 4),
            "stop": None if self.stop is None else round(self.stop, 4),
            "invalidationPrice": (
                None
                if self.invalidation_price is None
                else round(self.invalidation_price, 4)
            ),
            "metrics": dict(self.metrics) if self.metrics else {},
            "createdAt": self.created_at,
        }


@dataclass(slots=True)
class ScanAiRequest:
    symbol: str = "GC"
    contract: str = "GC"
    timeframe: str = "1m"
    depth: Literal["short", "medium", "deep"] = "medium"  # 250, 500, 1000
    density: Literal["auto", "less", "normal", "more"] = "normal"
    strength: Literal["all", "moderate", "strong"] = "moderate"
    states: list[SuggestionState] = field(
        default_factory=lambda: ["waiting", "in_play", "tested"]
    )
    groups: list[SuggestionGroup] = field(
        default_factory=lambda: list(ALL_GROUPS)
    )
    patterns: list[str] = field(default_factory=lambda: list(ALL_PATTERNS))
    targets_and_stop: bool = False
    from_time: int | None = None  # ms
    to_time: int | None = None  # ms

    @property
    def depth_bars(self) -> int:
        if self.depth == "short":
            return 250
        if self.depth == "deep":
            return 1000
        return 500

    @property
    def group_density_cap(self) -> dict[str, int]:
        if self.density == "less":
            return {g: 1 for g in ALL_GROUPS}
        if self.density == "more":
            return {g: 3 for g in ALL_GROUPS}
        if self.density == "auto":
            return {g: 2 for g in ALL_GROUPS}
        # normal: 2 per group, levels gets 3
        return {
            "levels": 3,
            "lines": 2,
            "fibonacci": 2,
            "patterns": 2,
            "elliott": 2,
        }

    @property
    def total_density_cap(self) -> int:
        return {"less": 4, "auto": 6, "normal": 8, "more": 12}[self.density]
