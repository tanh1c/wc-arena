import json
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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
    "greeting",
    "general_chat",
}

INTENT_PATTERNS: list[tuple[AgentIntent, re.Pattern[str]]] = [
    ("greeting", re.compile(r"^(?:hi|hello|hey|yo|chao|xin\s+chao|chao\s+ban|alo|bonjour|hola|hallo)(?:\s+.*)?$", re.IGNORECASE)),
    ("rules_help", re.compile(r"\b(rule|rules|point|points|score|scoring|rank|ranking|leaderboard|deadline|lock|table|luat|diem|xep\s+hang|bang|khoa|han)\b", re.IGNORECASE)),
    ("prediction_help", re.compile(r"\b(predict|prediction|pick|tip|confidence|suggest|du\s+doan|ti\s+so|ty\s+so|chon|goi\s+y)\b", re.IGNORECASE)),
    ("team_context", re.compile(r"\b(team|squad|player|players|lineup|form|h2h|head\s*to\s*head|history|doi|doi\s+hinh|phong\s+do|doi\s+dau|lich\s+su)\b", re.IGNORECASE)),
    ("match_preview", re.compile(r"\b(match|matches|fixture|fixtures|schedule|calendar|today|tomorrow|upcoming|next|remind|notify|alert|tran|lich|hom\s+nay|ngay\s+mai|mai|sap|nhac)\b", re.IGNORECASE)),
]
VIETNAMESE_DIACRITIC_RE = re.compile(r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", re.IGNORECASE)
STANDALONE_TEAM_STOPWORDS = {"chao", "xin chao", "cam on", "ok", "hello", "hi"}


async def memory_retrieve(state: AgentState) -> AgentState:
    from app.memory import search_user_memory

    message = get_message(state.get("messages", []))
    memories = await search_user_memory(state.get("user_id", ""), message)
    return {**state, "memories": memories}


async def intent_router(state: AgentState) -> AgentState:
    if state.get("intent") in VALID_INTENTS and state.get("intent") != "general_chat":
        return state

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
            "Allowed routes: match_preview, prediction_help, team_context, rules_help, greeting, general_chat.",
            "Available backend tool routes:",
            "- match_preview executes DB tools for selected match context, natural-language matchup resolution, fixture/date windows, and upcoming reminder summaries.",
            "- prediction_help executes match context, ESPN/community signals, user prediction history, and leaderboard context before suggesting scores.",
            "- team_context executes team lookup, team schedule/context, and head-to-head matchup resolution when two teams are present.",
            "- rules_help executes rules and leaderboard context tools.",
            "Use greeting for salutations. Use general_chat only when no executable football/app route applies.",
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
    if is_possible_team_matchup(message, normalized):
        return "team_context"
    if is_standalone_team_name_candidate(message, normalized):
        return "team_context"
    return "general_chat"


def is_possible_team_matchup(message: str, normalized: str) -> bool:
    if not VIETNAMESE_DIACRITIC_RE.search(message):
        return False
    return bool(re.search(r"\b(?:va|and|vs|voi|gap|dau voi)\b", normalized))


def is_standalone_team_name_candidate(message: str, normalized: str) -> bool:
    if normalized in STANDALONE_TEAM_STOPWORDS:
        return False
    words = normalized.split()
    return bool(VIETNAMESE_DIACRITIC_RE.search(message) and 1 <= len(words) <= 4)


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
        gather_prediction_fixture_list_context,
        gather_reminder_context,
        gather_rules_context,
        gather_team_context,
        gather_team_schedule_context,
        is_fixture_list_query,
        is_prediction_fixture_list_query,
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
            if intent == "prediction_help":
                tool_branch = "matchup_resolution"
                tool_results, used_tools = await resolve_matchup_context(
                    message,
                    state.get("user_id", ""),
                    state.get("access_token", ""),
                    include_user=include_user,
                )
            else:
                tool_branch = "ambiguous_matchup_context"
                tool_results, used_tools = await gather_ambiguous_matchup_context(
                    message,
                    state.get("access_token", ""),
                )
        elif intent == "prediction_help" and is_prediction_fixture_list_query(message):
            tool_branch = "prediction_fixture_list"
            tool_results, used_tools = await gather_prediction_fixture_list_context(
                message,
                state.get("access_token", ""),
                request_metadata=state.get("request_metadata", {}),
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
                request_metadata=state.get("request_metadata", {}),
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
        return {**state, "answer": off_topic_guardrail_answer(message, state.get("response_language"))}

    context = state.get("tool_results", {})
    fallback = _fallback_answer(state, message)
    if state.get("intent") == "greeting":
        return {**state, "answer": fallback}
    if should_use_deterministic_answer(context) and fallback:
        if should_polish_deterministic_answer(context):
            return {**state, "answer": _polish_deterministic_answer(state, message, fallback) or fallback}
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


def feature_suggestion_prompt(response_language: str | None = None) -> str:
    if response_language == "English":
        return "Try asking me things like:\n- What World Cup matches are today?\n- What World Cup matches are tomorrow?\n- Which matches are coming up soon?\n- When is Portugal's next match?\n- How is Spain looking before their next match?\n- What are the exact-score rules?\n- How do pick deadlines work?\n- What is my current leaderboard snapshot?"
    return "Thử hỏi mình những câu như:\n- Hôm nay World Cup có trận nào?\n- Ngày mai World Cup có trận nào?\n- Các trận sắp diễn ra là những trận nào?\n- Portugal có trận tiếp theo khi nào?\n- Tây Ban Nha đang thế nào trước trận tiếp theo?\n- Luật tính điểm dự đoán tỉ số như thế nào?\n- Pick khóa trước trận bao lâu?\n- Bảng xếp hạng hiện tại của tôi ra sao?"


def off_topic_guardrail_answer(topic: str | None = None, response_language: str | None = None) -> str:
    clean_topic = (topic or "nội dung này").strip()[:120]
    if response_language == "English":
        return f"## I can't help with that topic yet\n\nI can't help with **{clean_topic}**, but I can help with We Speak Football, World Cup match schedules, teams, scoring rules, leaderboards, and exact-score predictions.\n\n{feature_suggestion_prompt(response_language)}"
    return f"## Mình chưa hỗ trợ chủ đề này\n\nMình chưa hỗ trợ **{clean_topic}**, nhưng có thể giúp về We Speak Football, World Cup, lịch thi đấu, đội tuyển, luật điểm, leaderboard và dự đoán tỉ số.\n\n{feature_suggestion_prompt(response_language)}"


def _greeting_answer(response_language: str | None = None) -> str:
    if response_language == "English":
        return "\n\n".join(
            [
                "## Hi, I'm We Speak Football",
                "I can help you follow the World Cup and play the exact-score prediction game.",
                _detail_list(
                    [
                        ["Fixtures", "today, tomorrow, upcoming matches, knockout rounds"],
                        ["Teams", "team schedule, squad availability, form context"],
                        ["Predictions", "exact-score suggestions with ESPN and community signals"],
                        ["Rules", "scoring, pick deadlines, leaderboard context"],
                    ]
                ),
                feature_suggestion_prompt(response_language),
            ]
        )
    return "\n\n".join(
        [
            "## Chào bạn, mình là We Speak Football",
            "Mình có thể giúp bạn theo dõi World Cup và chơi dự đoán tỉ số chính xác.",
            _detail_list(
                [
                    ["Lịch thi đấu", "hôm nay, ngày mai, các trận sắp diễn ra, vòng knock-out"],
                    ["Đội tuyển", "lịch đá, đội hình nếu có dữ liệu, phong độ liên quan"],
                    ["Dự đoán", "gợi ý tỉ số với tín hiệu ESPN và cộng đồng"],
                    ["Luật chơi", "cách tính điểm, deadline pick, leaderboard"],
                ]
            ),
            feature_suggestion_prompt(response_language),
        ]
    )


def should_use_deterministic_answer(context: dict[str, Any]) -> bool:
    return any(
        context.get(key)
        for key in (
            "ambiguous_matchup",
            "unmatched_matchup",
            "unmatched_team_context",
            "fixture_window",
            "reminder_context",
            "team_context",
            "team_schedule_context",
            "rules_context",
            "match",
        )
    )


def should_polish_deterministic_answer(context: dict[str, Any]) -> bool:
    return any(context.get(key) for key in ("fixture_window", "reminder_context", "team_context", "team_schedule_context", "rules_context", "match"))


def _polish_deterministic_answer(state: AgentState, message: str, answer: str) -> str | None:
    prompt = "\n".join(
        [
            "Rewrite this We Speak Football answer to be cleaner and easier to read in the user's language.",
            "Keep every factual value exactly the same: teams, scores, dates, times, venue, status, percentages, and table rows.",
            "Do not add new facts, analysis, predictions, match history, teams, or caveats.",
            "You may only improve wording, section titles, bullet style, and natural labels.",
            "Keep markdown. Prefer short sections and compact tables.",
            f"User message: {message}",
            f"Answer to polish:\n{answer}",
        ]
    )
    try:
        polished = _call_llm(prompt)
    except RuntimeError:
        return None
    return polished.strip() if polished else None


def safety_review(state: AgentState) -> AgentState:
    return {**state, "answer": safety_review_text(state.get("answer", ""))}


async def memory_write(state: AgentState) -> AgentState:
    from app.memory import save_interaction, save_session_context

    _write_session_context(state, save_session_context)
    await _write_long_term_memory(state, save_interaction)
    return state


def _write_session_context(state: AgentState, save_session_context_fn) -> None:
    _save_session_language_context(state, save_session_context_fn)
    _save_latest_match_context(state, save_session_context_fn)
    _save_pending_action_context(state, save_session_context_fn)


async def _write_long_term_memory(state: AgentState, save_interaction_fn) -> None:
    await save_interaction_fn(
        user_id=state.get("user_id", ""),
        session_id=state.get("session_id", ""),
        user_message=get_message(state.get("messages", [])),
        assistant_message=state.get("answer", ""),
        metadata={
            "intent": state.get("intent"),
            "match_id": _match_context_id(state),
            "match_label": _match_context_label(state),
            "context_match_source": state.get("context_match_source"),
            "request": state.get("request_metadata", {}),
        },
    )


def _match_context_id(state: AgentState) -> str | None:
    tool_results = state.get("tool_results", {})
    return (
        state.get("match_id")
        or (tool_results.get("match") or {}).get("id")
        or (tool_results.get("resolved_matchup") or {}).get("match_id")
        or (tool_results.get("ambiguous_matchup") or {}).get("match_id")
    )


def _match_context_label(state: AgentState) -> str | None:
    tool_results = state.get("tool_results", {})
    ambiguous = tool_results.get("ambiguous_matchup") or {}
    if ambiguous.get("display_matchup"):
        return ambiguous.get("display_matchup")
    teams = tool_results.get("teams", {})
    home = teams.get("home", {}) if isinstance(teams, dict) else {}
    away = teams.get("away", {}) if isinstance(teams, dict) else {}
    home_name = home.get("name") or home.get("short_name")
    away_name = away.get("name") or away.get("short_name")
    if home_name and away_name:
        return f"{home_name} vs {away_name}"
    return None


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
    match_id = _match_context_id(state)
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
            "match_label": _match_context_label(state),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def _save_pending_action_context(state: AgentState, save_session_context_fn) -> None:
    match_id = _match_context_id(state)
    if state.get("intent") == "prediction_help":
        save_session_context_fn(
            state.get("user_id", ""),
            state.get("session_id", ""),
            {"pending_action": None, "pending_match_id": None, "pending_match_label": None},
        )
        return
    if not match_id or not _answer_invites_prediction(state.get("answer", "")):
        return
    save_session_context_fn(
        state.get("user_id", ""),
        state.get("session_id", ""),
        {
            "pending_action": "prediction_help",
            "pending_match_id": match_id,
            "pending_match_label": _match_context_label(state),
        },
    )


def _answer_invites_prediction(answer: str) -> bool:
    normalized = _normalize_router_text(answer)
    return bool(re.search(r"\b(?:du doan ti so|du doan ty so|goi y.*ti so|suggest.*score|preview it or suggest a score)\b", normalized))


def safety_review_text(text: str) -> str:
    reviewed = text
    for unsafe, replacement in GAMBLING_REPLACEMENTS.items():
        reviewed = re.sub(rf"\b{re.escape(unsafe)}\b", replacement, reviewed, flags=re.IGNORECASE)
    return reviewed


def _build_prompt(state: AgentState, message: str) -> str:
    current_time = datetime.now(timezone.utc).isoformat()
    client_metadata = (state.get("request_metadata") or {}).get("client") or {}
    client_timezone = client_metadata.get("timezone") if isinstance(client_metadata, dict) else None
    return "\n\n".join(
        [
            "You are We Speak Football, an assistant for a free World Cup exact-score prediction app.",
            f"Current time: {current_time}",
            f"User timezone: {client_timezone or 'UTC'}",
            "When mentioning fixture kickoff or lock times, convert UTC timestamps to the user timezone above.",
            "Only answer questions related to We Speak Football, World Cup football, teams, fixtures, predictions, scoring rules, leaderboards, and the app experience.",
            "If a request is outside that domain, politely redirect the user back to World Cup football or the prediction app instead of answering the unrelated topic.",
            "Use the supplied football data as the source of truth for match schedules, squads, form, ESPN data, head-to-head records, leaderboards, and match status.",
            "Do not invent squads, form, head-to-head history, schedules, results, scorers, injuries, or live status when data is missing.",
            "If requested data is missing, say so naturally and suggest a specific team or match the user can ask about next.",
            "For score suggestions, provide an exact-score suggestion and a short confidence rationale only from available match, team, ESPN, and community signals.",
            "Treat reminder requests as upcoming pick deadline summaries; do not claim push notifications are scheduled unless the data says so.",
            "Avoid betting, odds, wager, deposit, or gambling framing.",
            f"Respond in {state.get('response_language') or 'the user message language'}.",
            f"Intent: {state.get('intent')}",
            f"User message: {message}",
            f"Memories: {json.dumps(state.get('memories', []), default=str)[:2500]}",
            f"Football data: {json.dumps(state.get('tool_results', {}), default=str)[:6000]}",
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
    response_language = state.get("response_language")
    if ambiguous:
        display_matchup = ambiguous.get("display_matchup") or "those two teams"
        if response_language == "English":
            return f"## Did you mean {display_matchup}?\n\nI found that match. If yes, ask me to preview it or suggest a score.\n\n{feature_suggestion_prompt(response_language)}"
        return f"## Bạn muốn hỏi {display_matchup}?\n\nTôi tìm thấy trận này. Nếu đúng, hãy hỏi preview hoặc dự đoán tỉ số trận đó.\n\n{feature_suggestion_prompt(response_language)}"
    if unmatched:
        return off_topic_guardrail_answer(None, response_language)
    if context.get("fixture_window"):
        return _fixture_window_answer(context, state.get("request_metadata"), response_language)
    if context.get("prediction_fixture_list"):
        return _prediction_fixture_list_answer(context, state.get("request_metadata"), response_language)
    if context.get("reminder_context"):
        return _reminder_answer(context, state.get("request_metadata"), response_language)
    if context.get("team_context"):
        return _team_context_answer(context, state.get("request_metadata"), response_language)
    if context.get("team_schedule_context"):
        return _team_schedule_answer(context, response_language, state.get("request_metadata"))
    if context.get("unmatched_team_context"):
        return off_topic_guardrail_answer(message, response_language)
    if context.get("rules_context"):
        return _rules_context_answer(context, response_language)
    if match and teams:
        return _match_answer(context, state.get("intent"), state.get("request_metadata"), response_language)
    if state.get("intent") == "greeting":
        return _greeting_answer(response_language)
    if state.get("intent") == "rules_help":
        return _rules_context_answer({}, response_language)
    return off_topic_guardrail_answer(message, response_language)


def _match_name(match: dict[str, Any]) -> str:
    home = match.get("home_team", {})
    away = match.get("away_team", {})
    return f"{home.get('name') or home.get('short_name') or match.get('home_team_id')} vs {away.get('name') or away.get('short_name') or match.get('away_team_id')}"


def _request_timezone(request_metadata: dict[str, Any] | None = None) -> ZoneInfo:
    timezone_name = ((request_metadata or {}).get("client") or {}).get("timezone")
    if not isinstance(timezone_name, str):
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _format_local_time(value: str | None, request_metadata: dict[str, Any] | None = None) -> str:
    if not value:
        return "-"
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    local = instant.astimezone(_request_timezone(request_metadata))
    return f"{local:%d/%m %H:%M}"


def _status_label(status: str | None, response_language: str | None = None) -> str:
    labels = {
        "scheduled": ("Chưa mở pick", "Scheduled"),
        "open": ("Đang mở dự đoán", "Open for picks"),
        "locked": ("Đã khóa pick", "Picks locked"),
        "live": ("Đang diễn ra", "Live"),
        "finished": ("Đã kết thúc", "Finished"),
        "postponed": ("Hoãn", "Postponed"),
        "cancelled": ("Đã hủy", "Cancelled"),
    }
    vietnamese, english = labels.get(status or "", (status or "-", status or "-"))
    return vietnamese if response_language == "Vietnamese" else english


def _cell(value: Any) -> str:
    return str(value if value not in (None, "") else "-").replace("|", "\\|")


def _markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    return "\n".join(
        [
            "| " + " | ".join(headers) + " |",
            "|" + "|".join("---" for _ in headers) + "|",
            *("| " + " | ".join(_cell(value) for value in row) + " |" for row in rows),
        ]
    )


def _detail_list(rows: list[list[Any]]) -> str:
    return "\n".join(f"- **{label}:** {_cell(value)}" for label, value in rows)


def _match_details(match: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None, include_status: bool = True) -> list[list[Any]]:
    rows = [
        ["Giờ" if response_language == "Vietnamese" else "Time", _format_local_time(match.get("kickoff_at"), request_metadata)],
        ["Vòng" if response_language == "Vietnamese" else "Round", _stage_label(match.get("stage"), response_language)],
        ["Địa điểm" if response_language == "Vietnamese" else "Location", match.get("stadium") or match.get("city")],
    ]
    if include_status:
        rows.append(["Trạng thái" if response_language == "Vietnamese" else "Status", _status_label(match.get("status"), response_language)])
    return rows


def _match_card(match: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None, include_status: bool = True) -> str:
    return f"### {_match_name(match)}\n\n{_detail_list(_match_details(match, request_metadata, response_language, include_status))}"


def _stage_label(stage: str | None, response_language: str | None = None) -> str:
    if response_language == "Vietnamese":
        return {
            "group": "Vòng bảng",
            "round32": "Vòng 32 đội",
            "round16": "Vòng 16 đội",
            "quarter": "Tứ kết",
            "semi": "Bán kết",
            "third_place": "Tranh hạng ba",
            "final": "Chung kết",
        }.get(stage or "", stage or "-")
    return {
        "group": "Group stage",
        "round32": "Round of 32",
        "round16": "Round of 16",
        "quarter": "Quarter-finals",
        "semi": "Semi-finals",
        "third_place": "Third-place match",
        "final": "Final",
    }.get(stage or "", stage or "-")


def _window_label(label: str, response_language: str | None = None) -> str:
    if response_language == "Vietnamese":
        return {"today": "hôm nay", "tomorrow": "ngày mai", "upcoming": "7 ngày tới"}.get(label, label)
    return {"today": "today", "tomorrow": "tomorrow", "upcoming": "the next 7 days"}.get(label, label)


def _prediction_window_label(label: str, response_language: str | None = None) -> str:
    if response_language == "Vietnamese":
        return {"today": "hôm nay", "tomorrow": "ngày mai", "upcoming": "sắp tới"}.get(label, label)
    return {"today": "today", "tomorrow": "tomorrow", "upcoming": "upcoming"}.get(label, label)


def _fixture_window_answer(context: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None) -> str:
    window = context.get("fixture_window", {})
    fixtures = context.get("fixtures") or []
    label = _window_label(window.get("label", "requested window"), response_language)
    stage_label = _stage_label(context.get("fixture_stage"), response_language) if context.get("fixture_stage") else None
    if response_language == "Vietnamese":
        scope = f"{stage_label} {label}" if stage_label else f"World Cup {label}"
        if not fixtures:
            return f"## Chưa có trận phù hợp\n\nTheo múi giờ của bạn, mình chưa thấy trận {scope} nào được lên lịch.\n\n{feature_suggestion_prompt(response_language)}"
        title = f"Trận đấu {scope}"
    else:
        scope = f"{stage_label} {label}" if stage_label else f"World Cup {label}"
        if not fixtures:
            return f"## No matching matches\n\nI don't see any {scope} matches scheduled in your timezone.\n\n{feature_suggestion_prompt(response_language)}"
        title = f"Matches for {scope}"
    cards = "\n\n".join(_match_card(match, request_metadata, response_language) for match in fixtures[:8])
    return f"## {title}\n\n{cards}"


def _prediction_fixture_list_answer(context: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None) -> str:
    matches = context.get("prediction_matches") or []
    fixture_context = context.get("prediction_fixture_list") or {}
    stage_label = _stage_label(fixture_context.get("stage"), response_language) if fixture_context.get("stage") else None
    label = _prediction_window_label(fixture_context.get("label", "upcoming"), response_language)
    scope = f"{stage_label} {label}" if stage_label else label
    if not matches:
        if response_language == "Vietnamese":
            return f"## Chưa có trận phù hợp\n\nMình chưa thấy trận nào để gợi ý tỉ số cho {scope}.\n\n{feature_suggestion_prompt(response_language)}"
        return f"## No matching matches\n\nI don't see any matches to suggest scores for {scope}.\n\n{feature_suggestion_prompt(response_language)}"

    cards = []
    for match in matches[:8]:
        home_name = (match.get("home_team") or {}).get("name") or (match.get("home_team") or {}).get("short_name") or match.get("home_team_id")
        away_name = (match.get("away_team") or {}).get("name") or (match.get("away_team") or {}).get("short_name") or match.get("away_team_id")
        score, reason = _score_pick(home_name, away_name, ((match.get("prediction_signal") or {}).get("espn") or {}), response_language)
        cards.append(
            f"### {home_name} vs {away_name}\n\n"
            f"**{score}**\n\n"
            f"{reason}\n\n"
            f"{_detail_list(_match_details(match, request_metadata, response_language))}"
        )
    title = f"Gợi ý tỉ số cho các trận {scope}" if response_language == "Vietnamese" else f"Score suggestions for {scope} matches"
    return f"## {title}\n\n" + "\n\n".join(cards)


def _reminder_answer(context: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None) -> str:
    matches = context.get("reminder_matches") or []
    if not matches:
        if response_language == "Vietnamese":
            return f"## Chưa có trận sắp khóa pick\n\nMình chưa thấy trận nào sắp khóa pick trong lịch hiện tại.\n\n{feature_suggestion_prompt(response_language)}"
        return f"## No upcoming pick locks\n\nI don't see any matches locking soon in the current schedule.\n\n{feature_suggestion_prompt(response_language)}"
    cards = "\n\n".join(
        f"### {_match_name(match)}\n\n" + _detail_list([
            ["Giờ đá" if response_language == "Vietnamese" else "Kickoff", _format_local_time(match.get("kickoff_at"), request_metadata)],
            ["Giờ khóa" if response_language == "Vietnamese" else "Lock", _format_local_time(match.get("lock_at"), request_metadata)],
            ["Trạng thái" if response_language == "Vietnamese" else "Status", _status_label(match.get("status"), response_language)],
        ])
        for match in matches[:8]
    )
    if response_language == "Vietnamese":
        return f"## Các trận sắp khóa pick\n\n{cards}\n\nMình có thể tóm tắt deadline ở đây, còn push notification thì hiện chưa được bật từ chat."
    return f"## Upcoming pick locks\n\n{cards}\n\nI can summarize deadlines here, but push notifications are not enabled from chat yet."


def _team_schedule_answer(context: dict[str, Any], response_language: str | None = None, request_metadata: dict[str, Any] | None = None) -> str:
    schedule = context.get("team_schedule_context", {})
    team = schedule.get("team", {})
    next_match = schedule.get("next_match")
    team_name = team.get("name") or team.get("id") or "that team"
    if not next_match:
        if response_language == "English":
            return f"## No upcoming match for {team_name}\n\nI don't see an upcoming match for {team_name} in the current schedule.\n\n{feature_suggestion_prompt(response_language)}"
        return f"## Chưa có trận sắp tới của {team_name}\n\nTôi chưa có trận sắp tới của {team_name} trong dữ liệu hiện tại.\n\n{feature_suggestion_prompt(response_language)}"

    title = f"Next match for {team_name}" if response_language == "English" else f"Trận tiếp theo của {team_name}"
    return f"## {title}\n\n{_match_card(next_match, request_metadata, response_language)}"


def _team_context_answer(context: dict[str, Any], request_metadata: dict[str, Any] | None = None, response_language: str | None = None) -> str:
    team_context = context.get("team_context", {})
    team = team_context.get("team", {})
    name = team.get("name") or team.get("id") or "that team"
    if response_language == "Vietnamese":
        details = _detail_list([
            ["FIFA rank", team.get("fifa_rank")],
            ["Đội hình", "Có dữ liệu" if team_context.get("squad_available") else "Chưa có dữ liệu"],
            ["Phong độ gần đây", "Có dữ liệu" if team_context.get("form_available") else "Chưa có dữ liệu"],
        ])
        related_title = "Các trận liên quan"
    else:
        details = _detail_list([
            ["FIFA rank", team.get("fifa_rank")],
            ["Squad", "Available" if team_context.get("squad_available") else "Not available yet"],
            ["Recent form", "Available" if team_context.get("form_available") else "Not available yet"],
        ])
        related_title = "Related matches"
    matches = team_context.get("matches") or []
    if not matches:
        return f"## {name}\n\n{details}"
    cards = "\n\n".join(_match_card(match, request_metadata, response_language, include_status=False) for match in matches[:5])
    return f"## {name}\n\n{details}\n\n## {related_title}\n\n{cards}"


def _as_number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _score_pick(home_name: str, away_name: str, espn: dict[str, Any], response_language: str | None = None) -> tuple[str, str]:
    home_pct = _as_number(espn.get("home_win_pct"))
    draw_pct = _as_number(espn.get("draw_pct"))
    away_pct = _as_number(espn.get("away_win_pct"))
    if home_pct is None or draw_pct is None or away_pct is None:
        score = f"{home_name} 1-1 {away_name}"
        reason = "Thiếu tín hiệu rõ, chọn tỉ số an toàn." if response_language == "Vietnamese" else "Signals are limited, so this keeps the scoreline conservative."
        return score, reason

    if draw_pct >= max(home_pct, away_pct) - 5:
        score = f"{home_name} 1-1 {away_name}"
        reason = "ESPN cho thấy trận khá cân bằng, nên hòa 1-1 là lựa chọn an toàn." if response_language == "Vietnamese" else "ESPN has this fairly balanced, so 1-1 is the safer scoreline."
        return score, reason

    favorite, underdog, favorite_pct, underdog_pct, favorite_home = (home_name, away_name, home_pct, away_pct, True) if home_pct > away_pct else (away_name, home_name, away_pct, home_pct, False)
    margin = favorite_pct - underdog_pct
    if favorite_home:
        score = f"{home_name} 2-0 {away_name}" if margin >= 45 else f"{home_name} 2-1 {away_name}"
    else:
        score = f"{home_name} 0-2 {away_name}" if margin >= 45 else f"{home_name} 1-2 {away_name}"
    reason = (f"{favorite} nhỉnh hơn theo ESPN ({favorite_pct:g}% so với {underdog_pct:g}%), nhưng vẫn nên giữ tỉ số vừa phải." if response_language == "Vietnamese" else f"{favorite} leads the ESPN signal ({favorite_pct:g}% vs {underdog_pct:g}%), but the scoreline stays moderate.")
    return score, reason


def _match_answer(context: dict[str, Any], intent: str | None = None, request_metadata: dict[str, Any] | None = None, response_language: str | None = None) -> str:
    match = context.get("match", {})
    teams = context.get("teams", {})
    home = teams.get("home", {})
    away = teams.get("away", {})
    home_name = home.get("name") or home.get("short_name") or match.get("home_team_id")
    away_name = away.get("name") or away.get("short_name") or match.get("away_team_id")
    title = f"{home_name} vs {away_name}"
    info = _detail_list(_match_details(match, request_metadata, response_language))
    if intent != "prediction_help":
        if response_language == "Vietnamese":
            return f"## {title}\n\n{info}\n\n### Gợi ý xem nhanh\n- Xem thêm phong độ hai đội trước khi chọn tỉ số.\n- Nhớ gửi pick trước giờ khóa."
        return f"## {title}\n\n{info}\n\n### Quick checks\n- Review both teams before picking a score.\n- Submit before the lock time."

    espn = (context.get("prediction_signal") or {}).get("espn") or {}
    espn_rows = [
        [home_name, espn.get("home_win_pct")],
        ["Hòa" if response_language == "Vietnamese" else "Draw", espn.get("draw_pct")],
        [away_name, espn.get("away_win_pct")],
    ]
    score, reason = _score_pick(home_name, away_name, espn, response_language)
    if response_language == "Vietnamese":
        return (
            f"## Dự đoán: {title}\n\n"
            f"### Tỉ số gợi ý\n\n**{score}**\n\n{reason}\n\n"
            "### Trận đấu\n\n"
            f"{info}\n\n"
            "### Tín hiệu ESPN\n\n"
            f"{_markdown_table(['Kết quả', 'Tỉ lệ'], espn_rows)}\n\n"
            "### Tín hiệu cộng đồng\n\n"
            "Mình chưa có đủ dữ liệu cộng đồng rõ ràng cho trận này.\n\n"
            "### Gợi ý pick\n"
            "- Dùng ESPN và cộng đồng làm tham khảo, không xem là chắc chắn.\n"
            "- Nếu tín hiệu khá cân bằng, nên chọn tỉ số an toàn hơn."
        )
    return (
        f"## Prediction: {title}\n\n"
        f"### Suggested score\n\n**{score}**\n\n{reason}\n\n"
        "### Match\n\n"
        f"{info}\n\n"
        "### ESPN signal\n\n"
        f"{_markdown_table(['Outcome', 'Percent'], espn_rows)}\n\n"
        "### Community signal\n\n"
        "I don't have a clear community trend for this match yet.\n\n"
        "### Pick guidance\n"
        "- Use ESPN and community signals as references, not guarantees.\n"
        "- If the signals are balanced, lean toward a safer scoreline."
    )


def _rules_context_answer(context: dict[str, Any], response_language: str | None = None) -> str:
    if response_language == "Vietnamese":
        rules = [
            "Gửi pick trước giờ khóa của trận.",
            "Đúng tỉ số là cách kiếm điểm mạnh nhất.",
            "Nếu lệch tỉ số nhưng đúng kết quả thắng/hòa/thua, bạn vẫn có thể có điểm.",
            "Muốn leo leaderboard thì nên kết hợp pick chắc tay, đúng kết quả đều và tận dụng chuỗi tốt.",
        ]
        leaderboard = context.get("leaderboard_context", {}).get("entries") or []
        lines = ["## Luật tính điểm", "", *(f"- {rule}" for rule in rules)]
        if leaderboard:
            current = leaderboard[0]
            lines.extend(["", "### Vị trí hiện tại của bạn", f"- Hạng: {current.get('rank', '-')}", f"- Điểm: {current.get('points', '-')}"])
        lines.extend(["", "### Ví dụ bạn có thể hỏi", "- Đúng tỉ số được bao nhiêu điểm?", "- Pick khóa trước trận bao lâu?", "- Làm sao để leo leaderboard tuần này?"])
        return "\n".join(lines)

    rules = context.get("rules_context", {}).get("scoring") or [
        "Submit picks before the match lock time.",
        "Exact-score picks are the strongest way to gain points.",
        "If the score misses but the result is right, you can still earn points.",
        "Climb the leaderboard with smart score picks, consistent outcomes, and good streaks.",
    ]
    leaderboard = context.get("leaderboard_context", {}).get("entries") or []
    lines = ["## Scoring rules", "", *(f"- {rule}" for rule in rules)]
    if leaderboard:
        current = leaderboard[0]
        lines.extend(["", "### Your leaderboard snapshot", f"- Rank: {current.get('rank', '-')}", f"- Points: {current.get('points', '-')}"])
    lines.extend(["", "### Example questions", "- How many points do I get for an exact score?", "- How early do picks lock?", "- How can I climb the leaderboard this week?"])
    return "\n".join(lines)
