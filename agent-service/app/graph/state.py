from typing import Any, Literal, TypedDict


AgentIntent = Literal["match_preview", "prediction_help", "team_context", "rules_help", "general_chat"]


class AgentState(TypedDict, total=False):
    messages: list[dict[str, str]]
    user_id: str
    email: str | None
    session_id: str
    match_id: str | None
    intent: AgentIntent
    memories: list[dict[str, Any]]
    tool_results: dict[str, Any]
    used_tools: list[str]
    answer: str
    request_metadata: dict[str, Any]
