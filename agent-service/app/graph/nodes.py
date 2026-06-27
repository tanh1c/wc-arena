import json
import re
from typing import Any, List

import httpx

from app.graph.state import AgentIntent, AgentState

GAMBLING_REPLACEMENTS = {
    "betting": "prediction",
    "wager": "pick",
    "wagers": "picks",
    "odds": "public signal",
    "deposit": "entry",
    "gambling": "prediction game",
}

VALID_INTENTS: set[AgentIntent] = {
    "match_preview",
    "prediction_help",
    "team_context",
    "rules_help",
    "general_chat",
}


async def memory_retrieve(state: AgentState) -> AgentState:
    from app.memory import search_user_memory

    message = get_message(state.get("messages", []))
    memories = await search_user_memory(state.get("user_id", ""), message)
    return {**state, "memories": memories}


async def intent_router(state: AgentState) -> AgentState:
    message = get_message(state.get("messages", []))
    llm_intent = classify_intent_with_llm(message, state.get("match_id"))
    if llm_intent:
        return {**state, "intent": llm_intent}

    return {**state, "intent": keyword_intent_router(message, state.get("match_id"))}


def classify_intent_with_llm(message: str, match_id: str | None = None) -> AgentIntent | None:
    prompt = "\n".join(
        [
            "Classify this Predict 2026 assistant message into exactly one intent.",
            "Allowed intents: match_preview, prediction_help, team_context, rules_help, general_chat.",
            "Use prediction_help for choosing a pick, exact score, confidence, or prediction reasoning.",
            "Use team_context for team form, rank, squad, group, or comparative team information.",
            "Use rules_help for scoring rules, points, deadlines, locks, and app rules.",
            "Use match_preview for previewing or analyzing a specific match.",
            "Use general_chat only when none of the above apply.",
            f"Has selected match: {'yes' if match_id else 'no'}",
            f"Message: {message}",
            "Return only the intent string.",
        ]
    )

    try:
        raw_intent = _call_llm(prompt)
    except RuntimeError:
        return None

    normalized = (raw_intent or "").strip().lower()
    normalized = re.sub(r"[^a-z_].*$", "", normalized)
    return normalized if normalized in VALID_INTENTS else None


def keyword_intent_router(message: str, match_id: str | None = None) -> AgentIntent:
    message = message.lower()

    if any(word in message for word in ("rule", "points", "scoring", "deadline", "lock")):
        return "rules_help"
    if any(word in message for word in ("predict", "pick", "score", "confidence")):
        return "prediction_help"
    if any(word in message for word in ("team", "rank", "form", "group")):
        return "team_context"
    if match_id or any(word in message for word in ("match", "preview", "analyze", "fixture")):
        return "match_preview"
    return "general_chat"


async def data_gather(state: AgentState) -> AgentState:
    from app.tools.football_tools import gather_match_context, resolve_matchup_context

    match_id = state.get("match_id")
    intent = state.get("intent", "general_chat")
    tool_results: dict[str, Any] = {}
    used_tools: list[str] = []

    if intent in ("match_preview", "prediction_help", "team_context"):
        include_user = intent == "prediction_help"
        if match_id:
            tool_results, used_tools = await gather_match_context(
                match_id,
                state.get("user_id", ""),
                state.get("access_token", ""),
                include_user=include_user,
            )
        else:
            tool_results, used_tools = await resolve_matchup_context(
                get_message(state.get("messages", [])),
                state.get("user_id", ""),
                state.get("access_token", ""),
                include_user=include_user,
            )

    return {**state, "tool_results": tool_results, "used_tools": used_tools}

def get_message(messages: List[dict[str, str]]) -> str:
    if messages is None:
        return ""
    return messages[-1].get("content", "")

def analysis(state: AgentState) -> AgentState:
    message = get_message(state.get("messages", []))
    prompt = _build_prompt(state, message)
    answer = _call_llm(prompt) or _fallback_answer(state, message)
    return {**state, "answer": answer}


def safety_review(state: AgentState) -> AgentState:
    return {**state, "answer": safety_review_text(state.get("answer", ""))}


async def memory_write(state: AgentState) -> AgentState:
    from app.memory import save_interaction

    await save_interaction(
        user_id=state.get("user_id", ""),
        session_id=state.get("session_id", ""),
        user_message=get_message(state.get("messages", [])),
        assistant_message=state.get("answer", ""),
        metadata={
            "intent": state.get("intent"),
            "match_id": state.get("match_id"),
            "request": state.get("request_metadata", {}),
        },
    )
    return state


def safety_review_text(text: str) -> str:
    reviewed = text
    for unsafe, replacement in GAMBLING_REPLACEMENTS.items():
        reviewed = re.sub(rf"\b{re.escape(unsafe)}\b", replacement, reviewed, flags=re.IGNORECASE)
    return reviewed


def _build_prompt(state: AgentState, message: str) -> str:
    return "\n\n".join(
        [
            "You are We Speak Football, an assistant for a free World Cup exact-score prediction app.",
            "Only answer questions related to We Speak Football, World Cup football, teams, fixtures, predictions, scoring rules, leaderboards, and the app experience.",
            "If a request is outside that domain, politely redirect the user back to World Cup football or the prediction app instead of answering the unrelated topic.",
            "Use supplied tool context. Avoid betting, odds, wager, deposit, or gambling framing.",
            f"Intent: {state.get('intent')}",
            f"User message: {message}",
            f"Memories: {json.dumps(state.get('memories', []), default=str)[:2500]}",
            f"Tool context: {json.dumps(state.get('tool_results', {}), default=str)[:6000]}",
        ]
    )


def _call_llm(prompt: str) -> str | None:
    from app.settings import get_settings

    settings = get_settings()
    api_key = settings.llm_api_key or settings.openai_api_key
    if not api_key:
        return None
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        return None

    kwargs: dict[str, Any] = {
        "api_key": api_key,
        "model": settings.llm_model or "gpt-4.1-mini",
        "temperature": 0.3,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
        kwargs["http_client"] = httpx.Client(timeout=30, trust_env=False)

    try:
        response = ChatOpenAI(**kwargs).invoke(prompt)
    except Exception as exc:
        raise RuntimeError("LLM call failed") from exc
    finally:
        http_client = kwargs.get("http_client")
        if isinstance(http_client, httpx.Client):
            http_client.close()

    content = getattr(response, "content", None)
    return content if isinstance(content, str) else None


def _fallback_answer(state: AgentState, message: str) -> str:
    context = state.get("tool_results", {})
    match = context.get("match")
    teams = context.get("teams", {})
    signal = context.get("prediction_signal", {})
    unmatched = context.get("unmatched_matchup")
    if unmatched:
        suggestions = unmatched.get("suggestions") or []
        suggestion_text = f" For example: {', '.join(suggestions[:4])}." if suggestions else ""
        return f"I couldn't confidently find that matchup in the World Cup fixtures. Could you clarify the team names?{suggestion_text}"
    if match and teams:
        home = teams.get("home", {})
        away = teams.get("away", {})
        espn = signal.get("espn", {})
        lines = [
            f"{home.get('short_name') or home.get('name')} vs {away.get('short_name') or away.get('name')} is set for {match.get('kickoff_at')} in {match.get('city')}.",
            f"Stage: {match.get('stage')}. Status: {match.get('status')}.",
        ]
        if any(value is not None for value in espn.values()):
            lines.append(
                "Public signal: "
                f"home {espn.get('home_win_pct') or '-'}%, "
                f"draw {espn.get('draw_pct') or '-'}%, "
                f"away {espn.get('away_win_pct') or '-'}%."
            )
        lines.append("For an exact-score pick, compare FIFA rank, group context, available ESPN form, and community prediction balance before choosing a conservative scoreline.")
        return " ".join(lines)
    if state.get("intent") == "rules_help":
        return "Picks lock at the match deadline. Exact scores earn the strongest result, while outcome-only picks focus on winner or draw. Check the rules page for the full scoring table."
    return f"I can help with match previews, team context, and exact-score prediction reasoning. Ask about a specific match or include a match from the selector. Your message was: {message}"
