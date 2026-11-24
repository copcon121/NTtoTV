"""Read-only instrument catalog."""

from fastapi import APIRouter, Depends

from ..instruments import instrument_catalog
from .contract_state import ContractStateStore
from .routes import get_contract_state

router = APIRouter(prefix="/api", tags=["instruments"])


@router.get("/instruments")
async def list_instruments(state: ContractStateStore = Depends(get_contract_state)):
    return {"instruments": instrument_catalog(state.active_contract("GC"))}

