"""Completed SI-style aggressive chains; no exchange stop-order flag is claimed."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, ClassVar


@dataclass(slots=True, frozen=True)
class SiStopChain:
    type: ClassVar[str] = "si_stop"

    symbol: str
    contract: str
    source_contract: str
    session_id: str
    chain_id: str
    sequence: int
    side: str
    time: int
    start_time: int
    completed_time: int
    price: float
    first_price: float
    vwap: float
    executed_volume: int
    execution_count: int
    aggressor_count: int
    end_reason: str

    def __post_init__(self) -> None:
        if not all((self.symbol, self.contract, self.source_contract, self.session_id, self.chain_id)):
            raise ValueError("SI Stops require symbol, contract, session and chain identity")
        if self.side not in {"buy", "sell"} or self.end_reason not in {"mbo", "depth"}:
            raise ValueError("invalid SI Stops direction or completion boundary")
        if not 0 <= self.start_time <= self.time <= self.completed_time:
            raise ValueError("SI Stops timestamps must be chronological")
        if self.sequence < 1 or not 1 <= self.aggressor_count <= self.execution_count <= self.executed_volume:
            raise ValueError("invalid SI Stops counts")
        if any(not math.isfinite(n) or n <= 0 for n in (self.price, self.first_price, self.vwap)):
            raise ValueError("invalid SI Stops price")

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type, "symbol": self.symbol, "contract": self.contract,
            "source": "rithmic", "method": "aggressor_chain", "status": "completed",
            "sourceContract": self.source_contract, "sessionId": self.session_id,
            "chainId": self.chain_id, "sequence": self.sequence, "side": self.side,
            "time": self.time, "startTime": self.start_time, "completedTime": self.completed_time,
            "price": self.price, "firstPrice": self.first_price, "vwap": self.vwap,
            "executedVolume": self.executed_volume, "executionCount": self.execution_count,
            "aggressorCount": self.aggressor_count, "endReason": self.end_reason,
            "throughPriceLevels": self.execution_count >= 2 and not math.isclose(
                self.first_price, self.price, rel_tol=0, abs_tol=1e-8),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SiStopChain":
        if (data.get("type") != cls.type or data.get("source") != "rithmic"
                or data.get("method") != "aggressor_chain" or data.get("status") != "completed"):
            raise ValueError("expected a completed direct Rithmic SI stop chain")
        return cls(
            symbol=str(data["symbol"]), contract=str(data["contract"]),
            source_contract=str(data["sourceContract"]), session_id=str(data["sessionId"]),
            chain_id=str(data["chainId"]), sequence=int(data["sequence"]), side=str(data["side"]),
            time=int(data["time"]), start_time=int(data["startTime"]),
            completed_time=int(data["completedTime"]), price=float(data["price"]),
            first_price=float(data["firstPrice"]), vwap=float(data["vwap"]),
            executed_volume=int(data["executedVolume"]), execution_count=int(data["executionCount"]),
            aggressor_count=int(data["aggressorCount"]), end_reason=str(data["endReason"]),
        )
