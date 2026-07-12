import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from app.auth import verify_supabase_user
from app.graph.workflow import run_agent_turn
from app.match_lab.models import MatchLabFeedbackRequest, MatchLabRunRequest
from app.match_lab.service import abandon_match_lab, get_bot_xi_preview, list_bots, list_match_lab_runs, resume_match_lab, run_match_lab, submit_match_lab_feedback
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


@router.get("/match-lab/bots")
async def match_lab_bots(user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    return {"bots": list_bots()}


@router.get("/match-lab/bots/{bot_id}/xi")
async def match_lab_bot_xi(bot_id: str, user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    try:
        return get_bot_xi_preview(user.access_token, bot_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/match-lab/runs")
def match_lab_run(payload: MatchLabRunRequest, user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    try:
        return run_match_lab(user.access_token, user.user_id, payload.formation, payload.bot_id, [selection.model_dump() for selection in payload.xi], payload.debug)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get("/match-lab/runs")
async def match_lab_runs(user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    return {"runs": list_match_lab_runs(user.user_id)}


@router.post("/match-lab/runs/{run_id}/resume")
def match_lab_resume(run_id: str, debug: bool = False, user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    try:
        return resume_match_lab(user.user_id, run_id, debug)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/match-lab/runs/{run_id}/abandon")
async def match_lab_abandon(run_id: str, user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    try:
        return abandon_match_lab(user.user_id, run_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/match-lab/runs/{run_id}/feedback")
async def match_lab_feedback(run_id: str, payload: MatchLabFeedbackRequest, user: AuthenticatedUser = Depends(verify_supabase_user)) -> dict:
    try:
        return submit_match_lab_feedback(user.user_id, run_id, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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
