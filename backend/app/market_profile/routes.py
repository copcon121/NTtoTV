"""Authenticated MP planning controls and public exchange-day boundaries."""

from fastapi import APIRouter, Depends, Query, Request

from ..models.auth import AuthenticatedUser
from ..models.timestamp import now_ms
from ..rest.auth import get_current_user
from ..rest.errors import bad_request, conflict
from .calendar import trading_days
from .planner import MpPlanner

router = APIRouter(prefix="/api/mp", tags=["market-profile-planner"])


def get_planner(request: Request) -> MpPlanner:
    planner = getattr(request.app.state, "mp_planner", None)
    if planner is None:
        planner = getattr(getattr(request.app.state, "runtime", None), "mp_planner", None)
    if planner is None:
        raise conflict("MP planner is not enabled on this backend")
    return planner


@router.get("/sessions")
def sessions(count: int = Query(5, ge=1, le=20)) -> dict:
    return {"sessions": trading_days(now_ms(), count)}


@router.get("/plans")
async def plans(user: AuthenticatedUser = Depends(get_current_user),
          planner: MpPlanner = Depends(get_planner),
          day_start: int | None = Query(None, alias="dayStart")) -> dict:
    return planner.response(user.id, day_start)


@router.put("/settings")
async def settings(request: Request, user: AuthenticatedUser = Depends(get_current_user),
                   planner: MpPlanner = Depends(get_planner)) -> dict:
    try:
        body = await request.json()
        if not isinstance(body, dict) or not isinstance(body.get("enabled"), bool):
            raise ValueError("enabled must be a boolean")
        return planner.subscribe(user.id, body["enabled"])
    except ValueError as exc:
        raise bad_request(str(exc))


@router.post("/plans/run")
async def run(user: AuthenticatedUser = Depends(get_current_user),
              planner: MpPlanner = Depends(get_planner)) -> dict:
    if not planner.store.enabled(user.id):
        raise conflict("Enable the MP planner for your profile first")
    planner.retry_failed_current()
    await planner.run_current()
    return planner.response(user.id)


@router.patch("/alerts/{alert_id}")
async def toggle(alert_id: str, request: Request,
                 user: AuthenticatedUser = Depends(get_current_user),
                 planner: MpPlanner = Depends(get_planner)) -> dict:
    try:
        body = await request.json()
        if not isinstance(body, dict) or not isinstance(body.get("enabled"), bool):
            raise ValueError("enabled must be a boolean")
        planner.toggle_alert(user.id, alert_id, body["enabled"])
    except ValueError as exc:
        raise bad_request(str(exc))
    return planner.response(user.id)
