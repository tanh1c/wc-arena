from typing import Any, Literal, TypedDict


AgentIntent = Literal["match_preview", "prediction_help", "team_context", "rules_help", "greeting", "general_chat"]


class AgentState(TypedDict, total=False):
    messages: list[dict[str, str]]
    user_id: str
    email: str | None
    access_token: str
    session_id: str
    match_id: str | None
    context_match_source: str | None
    response_language: str | None
    intent: AgentIntent
    memories: list[dict[str, Any]]
    tool_results: dict[str, Any]
    used_tools: list[str]
    answer: str
    request_metadata: dict[str, Any]
