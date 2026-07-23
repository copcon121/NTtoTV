"""Bookmap ingest endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request

from ..models.messages import BookmapSiEvent
from ..registry.registry import OutboundEvent
from .errors import bad_request

router = APIRouter(prefix="/api/bookmap", tags=["bookmap"])


@router.post("/events")
@router.post("/si/events")
async def ingest_bookmap_si_event(
    request: Request,
    payload: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    """Receive one Bookmap Stops/Icebergs On-Chart BrAPI event."""
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise bad_request("runtime is not available", field="runtime")

    data = dict(payload)
    data.setdefault("type", BookmapSiEvent.type)
    try:
        event = BookmapSiEvent.from_dict(data)
    except (KeyError, TypeError, ValueError) as exc:
        raise bad_request(f"invalid Bookmap SI event: {exc}", field="payload")

    runtime.registry.enqueue(OutboundEvent.from_message(event))
    return {
        "ok": True,
        "source": "bookmap",
        "event": event.to_dict(),
    }
