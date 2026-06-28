import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from app.auth import verify_supabase_user
from app.graph.workflow import run_agent_turn
from app.models import AgentChatRequest, AgentChatResponse, AuthenticatedUser
from app.picks.runner import run_agent_picks
from app.settings import get_settings

router = APIRouter()


def _client_metadata(metadata: dict) -> dict[str, str]:
    return {
        key: value
        for key in ("timezone", "locale")
        if isinstance(value := metadata.get(key), str)
    }


@router.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(
    payload: AgentChatRequest,
    request: Request,
    user: AuthenticatedUser = Depends(verify_supabase_user),
) -> AgentChatResponse:
    return await _run_agent(payload, request, user)


async def _run_agent(payload: AgentChatRequest, request: Request, user: AuthenticatedUser) -> AgentChatResponse:
    try:
        result = await run_agent_turn(
            message=payload.message,
            session_id=payload.session_id,
            match_id=payload.match_id,
            user_id=user.user_id,
            email=user.email,
            access_token=user.access_token,
            request_metadata={
                "client_host": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "client": _client_metadata(payload.metadata),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return AgentChatResponse(**result)


async def _run_cron_picks(x_cron_secret: str | None, secret: str | None) -> dict:
    settings = get_settings()
    expected = settings.cron_secret
    provided = x_cron_secret or secret
    if not expected or not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")
    return await run_agent_picks()


@router.post("/cron/run-agent-picks")
async def cron_run_agent_picks_post(
    x_cron_secret: str | None = Header(default=None),
    secret: str | None = Query(default=None),
) -> dict:
    return await _run_cron_picks(x_cron_secret, secret)


@router.api_route("/cron/run-agent-picks", methods=["GET", "HEAD"])
async def cron_run_agent_picks_get(
    x_cron_secret: str | None = Header(default=None),
    secret: str | None = Query(default=None),
) -> dict:
    return await _run_cron_picks(x_cron_secret, secret)
