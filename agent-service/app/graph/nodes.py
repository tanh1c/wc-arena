import json
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, List

import httpx

from app.graph.state import AgentIntent, AgentState

logger = logging.getLogger(__name__)

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

INTENT_PATTERNS: list[tuple[AgentIntent, re.Pattern[str]]] = [
    ("rules_help", re.compile(r"\b(rule|rules|point|points|score|scoring|rank|ranking|leaderboard|deadline|lock|table|luat|diem|xep\s+hang|bang|khoa|han)\b", re.IGNORECASE)),
    ("prediction_help", re.compile(r"\b(predict|prediction|pick|tip|confidence|suggest|du\s+doan|ti\s+so|ty\s+so|chon|goi\s+y)\b", re.IGNORECASE)),
    ("team_context", re.compile(r"\b(team|squad|player|players|lineup|form|h2h|head\s*to\s*head|history|doi|doi\s+hinh|phong\s+do|doi\s+dau|lich\s+su)\b", re.IGNORECASE)),
    ("match_preview", re.compile(r"\b(match|matches|fixture|fixtures|schedule|calendar|today|tomorrow|upcoming|next|remind|notify|alert|tran|lich|hom\s+nay|ngay\s+mai|mai|sap|nhac)\b", re.IGNORECASE)),
]


async def memory_retrieve(state: AgentState) -> AgentState:
    from app.memory import search_user_memory

    message = get_message(state.get("messages", []))
    memories = await search_user_memory(state.get("user_id", ""), message)
    return {**state, "memories": memories}


async def intent_router(state: AgentState) -> AgentState:
    message = get_message(state.get("messages", []))
    matched_intent = keyword_intent_router(message, state.get("match_id"))
    if matched_intent != "general_chat":
        return {**state, "intent": matched_intent}

    llm_intent = classify_intent_with_llm(message, state.get("match_id"))
    if llm_intent:
        return {**state, "intent": llm_intent}

    return {**state, "intent": "general_chat"}


def classify_intent_with_llm(message: str, match_id: str | None = None) -> AgentIntent | None:
    prompt = "\n".join(
        [
            "Classify this Predict 2026 assistant message into exactly one executable backend route.",
            "Allowed routes: match_preview, prediction_help, team_context, rules_help, general_chat.",
            "Available backend tool routes:",
            "- match_preview executes DB tools for selected match context, natural-language matchup resolution, fixture/date windows, and upcoming reminder summaries.",
            "- prediction_help executes match context, ESPN/community signals, user prediction history, and leaderboard context before suggesting scores.",
            "- team_context executes team lookup, team schedule/context, and head-to-head matchup resolution when two teams are present.",
            "- rules_help executes rules and leaderboard context tools.",
            "Use general_chat only when no executable football/app route applies.",
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
    if match_id:
        return "match_preview"

    normalized = _normalize_router_text(message)
    for intent, pattern in INTENT_PATTERNS:
        if pattern.search(normalized):
            return intent
    return "general_chat"


def _normalize_router_text(message: str) -> str:
    normalized = unicodedata.normalize("NFKD", message.lower().replace("đ", "d"))
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _log_agent_tool_event(event: str, **fields: Any) -> None:
    logger.info("agent_tool_call %s %s", event, json.dumps(fields, ensure_ascii=False, default=str))
    for handler in logging.getLogger().handlers:
        handler.flush()


async def data_gather(state: AgentState) -> AgentState:
    from app.tools.football_tools import (
        extract_ambiguous_matchup_query,
        extract_matchup_query,
        gather_ambiguous_matchup_context,
        gather_fixture_list_context,
        gather_match_context,
        gather_reminder_context,
        gather_rules_context,
        gather_team_context,
        gather_team_schedule_context,
        is_fixture_list_query,
        is_reminder_query,
        is_team_schedule_query,
        resolve_matchup_context,
    )

    message = get_message(state.get("messages", []))
    match_id = state.get("match_id")
    intent = state.get("intent", "general_chat")
    tool_results: dict[str, Any] = {}
    used_tools: list[str] = []
    tool_branch = "none"

    if intent in ("match_preview", "prediction_help", "team_context"):
        include_user = intent == "prediction_help"
        if match_id:
            tool_branch = "selected_match"
            tool_results, used_tools = await gather_match_context(
                match_id,
                state.get("user_id", ""),
                state.get("access_token", ""),
                include_user=include_user,
            )
        elif extract_matchup_query(message):
            tool_branch = "matchup_resolution"
            tool_results, used_tools = await resolve_matchup_context(
                message,
                state.get("user_id", ""),
                state.get("access_token", ""),
                include_user=include_user,
            )
        elif extract_ambiguous_matchup_query(message):
            tool_branch = "ambiguous_matchup_context"
            tool_results, used_tools = await gather_ambiguous_matchup_context(
                message,
                state.get("access_token", ""),
            )
        elif is_team_schedule_query(message):
            tool_branch = "team_schedule_context"
            tool_results, used_tools = await gather_team_schedule_context(
                message,
                state.get("access_token", ""),
            )
        elif is_reminder_query(message):
            tool_branch = "reminder_context"
            tool_results, used_tools = await gather_reminder_context(
                message,
                state.get("user_id", ""),
                state.get("access_token", ""),
            )
        elif is_fixture_list_query(message):
            tool_branch = "fixture_list_context"
            tool_results, used_tools = await gather_fixture_list_context(
                message,
                state.get("access_token", ""),
            )
        elif intent == "team_context":
            tool_branch = "team_context"
            tool_results, used_tools = await gather_team_context(
                message,
                state.get("access_token", ""),
            )
    elif intent == "rules_help":
        tool_branch = "rules_context"
        tool_results, used_tools = await gather_rules_context(
            state.get("user_id", ""),
            state.get("access_token", ""),
        )

    _log_agent_tool_event(
        "data_gather_complete",
        intent=intent,
        branch=tool_branch,
        used_tools=used_tools,
        tool_result_keys=list(tool_results.keys()),
        message=message,
    )
    return {**state, "tool_results": tool_results, "used_tools": used_tools}

def get_message(messages: List[dict[str, str]]) -> str:
    if messages is None:
        return ""
    return messages[-1].get("content", "")

def analysis(state: AgentState) -> AgentState:
    message = get_message(state.get("messages", []))
    if not is_supported_agent_topic(message, state):
        return {**state, "answer": off_topic_guardrail_answer()}

    fallback = _fallback_answer(state, message)
    if is_guardrail_fallback_context(state.get("tool_results", {})) and fallback:
        return {**state, "answer": fallback}

    prompt = _build_prompt(state, message)
    answer = _call_llm(prompt) or fallback
    return {**state, "answer": answer}


def is_supported_agent_topic(message: str, state: AgentState) -> bool:
    if state.get("intent") != "general_chat":
        return True
    if state.get("match_id") or state.get("tool_results"):
        return True
    normalized = _normalize_router_text(message)
    return bool(
        re.search(
            r"\b(world\s+cup|football|soccer|we\s+speak\s+football|predict\s+2026|fixture|match|team|leaderboard|score|pick|prediction|tran|doi|lich|xep\s+hang|du\s+doan|ti\s+so|ty\s+so)\b",
            normalized,
            re.IGNORECASE,
        )
    )


def feature_suggestion_prompt() -> str:
    return "Try asking about fixtures by date, a match preview, exact-score prediction reasoning, team context, scoring rules, leaderboard climbing, or upcoming lock reminders."


def off_topic_guardrail_answer() -> str:
    return f"I can help with We Speak Football only. {feature_suggestion_prompt()}"


def is_guardrail_fallback_context(context: dict[str, Any]) -> bool:
    return any(context.get(key) for key in ("ambiguous_matchup", "unmatched_matchup", "unmatched_team_context"))


def safety_review(state: AgentState) -> AgentState:
    return {**state, "answer": safety_review_text(state.get("answer", ""))}


async def memory_write(state: AgentState) -> AgentState:
    from app.memory import save_interaction, save_session_context

    _save_session_language_context(state, save_session_context)
    _save_latest_match_context(state, save_session_context)
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


def _save_session_language_context(state: AgentState, save_session_context_fn) -> None:
    response_language = state.get("response_language")
    if not response_language:
        return
    save_session_context_fn(
        state.get("user_id", ""),
        state.get("session_id", ""),
        {"response_language": response_language},
    )


def _save_latest_match_context(state: AgentState, save_session_context_fn) -> None:
    tool_results = state.get("tool_results", {})
    match = tool_results.get("match") or {}
    match_id = match.get("id") or tool_results.get("resolved_matchup", {}).get("match_id")
    if not match_id:
        return

    teams = tool_results.get("teams", {})
    home = teams.get("home", {}) if isinstance(teams, dict) else {}
    away = teams.get("away", {}) if isinstance(teams, dict) else {}
    save_session_context_fn(
        state.get("user_id", ""),
        state.get("session_id", ""),
        {
            "match_id": match_id,
            "home_team": home.get("name") or home.get("short_name") or match.get("home_team_id"),
            "away_team": away.get("name") or away.get("short_name") or match.get("away_team_id"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def safety_review_text(text: str) -> str:
    reviewed = text
    for unsafe, replacement in GAMBLING_REPLACEMENTS.items():
        reviewed = re.sub(rf"\b{re.escape(unsafe)}\b", replacement, reviewed, flags=re.IGNORECASE)
    return reviewed


def _build_prompt(state: AgentState, message: str) -> str:
    current_time = datetime.now(timezone.utc).isoformat()
    return "\n\n".join(
        [
            "You are We Speak Football, an assistant for a free World Cup exact-score prediction app.",
            f"Current time: {current_time}",
            "Only answer questions related to We Speak Football, World Cup football, teams, fixtures, predictions, scoring rules, leaderboards, and the app experience.",
            "If a request is outside that domain, politely redirect the user back to World Cup football or the prediction app instead of answering the unrelated topic.",
            "Use supplied tool context as the source of truth for fixtures, squads, form, ESPN data, head-to-head, leaderboards, and match status.",
            "Do not invent squads, form, head-to-head history, fixtures, results, scorers, injuries, or live status when tool context is missing.",
            "If requested data is unavailable, say it is unavailable and ask for a specific team or match instead of guessing.",
            "For score suggestions, provide an exact-score suggestion and a short confidence rationale only from available match, team, ESPN, and community signals.",
            "Treat reminder requests as upcoming/locking match summaries; do not claim push notifications are scheduled unless tool context says so.",
            "Avoid betting, odds, wager, deposit, or gambling framing.",
            f"Respond in {state.get('response_language') or 'the user message language'}.",
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
    ambiguous = context.get("ambiguous_matchup")
    unmatched = context.get("unmatched_matchup")
    if ambiguous:
        display_matchup = ambiguous.get("display_matchup") or "those two teams"
        if ambiguous.get("match_id"):
            return f"Do you mean {display_matchup}? I found that fixture. If yes, ask me to preview or predict that match. {feature_suggestion_prompt()}"
        return f"Do you mean {display_matchup}? If yes, ask me to preview or predict that match. {feature_suggestion_prompt()}"
    if unmatched:
        return off_topic_guardrail_answer()
    if context.get("fixture_window"):
        return _fixture_window_answer(context)
    if context.get("reminder_context"):
        return _reminder_answer(context)
    if context.get("team_context"):
        return _team_context_answer(context)
    if context.get("team_schedule_context"):
        return _team_schedule_answer(context, state.get("response_language"))
    if context.get("unmatched_team_context"):
        return off_topic_guardrail_answer()
    if context.get("rules_context"):
        return _rules_context_answer(context)
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
    return f"I can help with match previews, team context, fixtures by date, upcoming match reminders, rules, leaderboards, and exact-score prediction reasoning. Ask about a specific match/team or include a match from the selector. Your message was: {message}"


def _match_name(match: dict[str, Any]) -> str:
    home = match.get("home_team", {})
    away = match.get("away_team", {})
    return f"{home.get('short_name') or home.get('name') or match.get('home_team_id')} vs {away.get('short_name') or away.get('name') or match.get('away_team_id')}"


def _fixture_window_answer(context: dict[str, Any]) -> str:
    window = context.get("fixture_window", {})
    fixtures = context.get("fixtures") or []
    label = window.get("label", "requested window")
    if not fixtures:
        return f"I don't have any World Cup fixtures in the tool context for {label}. Try another date or ask about an upcoming match."
    lines = [f"World Cup fixtures for {label}:"]
    for match in fixtures[:8]:
        location = f" in {match.get('city')}" if match.get("city") else ""
        lines.append(f"- {_match_name(match)} at {match.get('kickoff_at')}{location}.")
    return " ".join(lines)


def _reminder_answer(context: dict[str, Any]) -> str:
    matches = context.get("reminder_matches") or []
    if not matches:
        return "I don't have upcoming matches in the tool context to remind you about right now."
    lines = ["Upcoming matches to watch before picks lock:"]
    for match in matches[:8]:
        lines.append(f"- {_match_name(match)} kicks off at {match.get('kickoff_at')} and locks at {match.get('lock_at')}.")
    lines.append("I can summarize upcoming locks, but push notifications are not scheduled from this chat yet.")
    return " ".join(lines)


def _team_schedule_answer(context: dict[str, Any], response_language: str | None = None) -> str:
    schedule = context.get("team_schedule_context", {})
    team = schedule.get("team", {})
    next_match = schedule.get("next_match")
    team_name = team.get("name") or team.get("id") or "that team"
    if not next_match:
        if response_language == "Vietnamese":
            return f"Tôi chưa có trận sắp tới của {team_name} trong dữ liệu hiện tại. {feature_suggestion_prompt()}"
        return f"I don't have an upcoming match for {team_name} in the current tool context. {feature_suggestion_prompt()}"

    matchup = _match_name(next_match)
    kickoff = next_match.get("kickoff_at")
    location = f" tại {next_match.get('city')}" if response_language == "Vietnamese" and next_match.get("city") else f" in {next_match.get('city')}" if next_match.get("city") else ""
    stage = next_match.get("stage")
    if response_language == "Vietnamese":
        stage_text = f" Vòng: {stage}." if stage else ""
        return f"Trận tiếp theo của {team_name} là {matchup}, diễn ra lúc {kickoff}{location}.{stage_text}"
    stage_text = f" Stage: {stage}." if stage else ""
    return f"{team_name}'s next match is {matchup} at {kickoff}{location}.{stage_text}"


def _team_context_answer(context: dict[str, Any]) -> str:
    team_context = context.get("team_context", {})
    team = team_context.get("team", {})
    name = team.get("name") or team.get("id") or "that team"
    lines = [f"{name} context from the current database:"]
    if team.get("fifa_rank"):
        lines.append(f"FIFA rank: {team.get('fifa_rank')}.")
    if not team_context.get("squad_available"):
        lines.append("Squad/player details are not available in the current tool context, so I won't invent a lineup.")
    if not team_context.get("form_available"):
        lines.append("Detailed recent form is not available in the current tool context.")
    matches = team_context.get("matches") or []
    if matches:
        lines.append("Available matches: " + "; ".join(f"{_match_name(match)} at {match.get('kickoff_at')}" for match in matches[:5]) + ".")
    return " ".join(lines)


def _rules_context_answer(context: dict[str, Any]) -> str:
    rules = context.get("rules_context", {}).get("scoring") or []
    leaderboard = context.get("leaderboard_context", {}).get("entries") or []
    lines = rules[:] or ["Submit picks before lock, aim for exact scores, and keep outcome accuracy high to climb the leaderboard."]
    if leaderboard:
        current = leaderboard[0]
        lines.append(f"Your latest leaderboard context shows rank {current.get('rank', '-')} with {current.get('points', '-')} points.")
    return " ".join(lines)
