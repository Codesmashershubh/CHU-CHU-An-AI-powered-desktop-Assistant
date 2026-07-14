from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import require_shared_secret
from app.models.schemas import AutomationActionSchema, AutomationActionsOut
from app.services.automation_intents import list_action_specs

router = APIRouter(
    prefix="/api/automation", tags=["automation"], dependencies=[Depends(require_shared_secret)]
)


@router.get("/actions", response_model=AutomationActionsOut)
async def get_available_actions() -> AutomationActionsOut:
    """The client uses this to render 'what Chu Chu can do' UI and to sanity-check
    that its local executor implements everything the backend might request."""
    specs = list_action_specs()
    return AutomationActionsOut(
        actions=[
            AutomationActionSchema(
                action=s.name,
                description=s.description,
                params=s.params,
                requires_confirmation=s.requires_confirmation,
            )
            for s in specs
        ]
    )
