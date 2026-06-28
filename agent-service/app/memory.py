import logging
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)
_SESSION_CONTEXT: dict[tuple[str, str], dict[str, Any]] = {}


@lru_cache
def get_memory_client():
    from app.settings import get_settings

    settings = get_settings()
    if not settings.mem0_api_key:
        return None
    try:
        from mem0 import MemoryClient
    except ImportError:
        logger.warning("mem0 package is not installed; agent memory is disabled")
        return None
    return MemoryClient(api_key=settings.mem0_api_key)


def get_session_context(user_id: str, session_id: str) -> dict[str, Any]:
    return dict(_SESSION_CONTEXT.get((user_id, session_id), {}))


def save_session_context(user_id: str, session_id: str, context: dict[str, Any]) -> None:
    if not user_id or not session_id or not context:
        return
    _SESSION_CONTEXT[(user_id, session_id)] = {**_SESSION_CONTEXT.get((user_id, session_id), {}), **context}


async def search_user_memory(user_id: str, query: str) -> list[dict[str, Any]]:
    client = get_memory_client()
    if client is None:
        return []
    try:
        results = client.search(query=query, filters={"user_id": user_id}, limit=5)
    except Exception:
        logger.warning("mem0 search failed for user %s", user_id, exc_info=True)
        return []
    return results if isinstance(results, list) else []


def build_long_term_memory(user_message: str, assistant_message: str, metadata: dict[str, Any]) -> str | None:
    intent = metadata.get("intent")
    match_id = metadata.get("match_id")
    match_label = metadata.get("match_label") or "that match"
    if not match_id or metadata.get("context_match_source") == "pending_action":
        return None
    if intent == "prediction_help":
        return f"User asked for prediction help for {match_label} (match_id: {match_id})."
    if intent == "match_preview":
        return f"User viewed match context for {match_label} (match_id: {match_id})."
    return None


async def save_interaction(
    user_id: str,
    session_id: str,
    user_message: str,
    assistant_message: str,
    metadata: dict[str, Any],
) -> None:
    client = get_memory_client()
    if client is None:
        return
    memory = build_long_term_memory(user_message, assistant_message, metadata)
    if memory is None:
        return
    try:
        client.add(
            [{"role": "user", "content": memory}],
            user_id=user_id,
            metadata={**metadata, "session_id": session_id},
        )
    except Exception:
        logger.warning("mem0 save failed for user %s", user_id, exc_info=True)
