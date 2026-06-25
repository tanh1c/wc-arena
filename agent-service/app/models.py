from typing import Any, Literal

from pydantic import BaseModel, Field


AgentIntent = Literal["match_preview", "prediction_help", "team_context", "rules_help", "general_chat"]


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = None
    match_id: str | None = None


class AgentChatResponse(BaseModel):
    answer: str
    session_id: str
    intent: AgentIntent
    used_tools: list[str] = Field(default_factory=list)


class AgentErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str | None = None
    access_token: str
