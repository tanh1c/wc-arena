from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import verify_supabase_user
from app.graph.workflow import run_agent_turn
from app.models import AgentChatRequest, AgentChatResponse, AuthenticatedUser

router = APIRouter()


@router.get("/health")
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
            request_metadata={
                "client_host": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return AgentChatResponse(**result)
