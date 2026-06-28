import re
from uuid import uuid4

from app.graph.nodes import analysis, data_gather, intent_router, memory_retrieve, memory_write, safety_review
from app.graph.state import AgentState
from app.memory import get_session_context

FOLLOW_UP_MATCH_RE = re.compile(r"(?:trận đó|tran do|trận này|tran nay|that match|this match|match đó|match do)", re.IGNORECASE)
VIETNAMESE_DIACRITIC_RE = re.compile(r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", re.IGNORECASE)
VIETNAMESE_CUES = {
    "ai dau", "bang xep hang", "cho toi", "con tran", "da", "dau", "doi", "doi hinh", "du doan", "hom nay", "khi nao", "leo bang", "lich", "mai", "ngay mai", "nhac", "phong do", "sap dien ra", "the nao", "ti so", "toi", "tran", "ty so", "voi", "xep hang",
}
ENGLISH_CUES = {
    "fixture", "fixtures", "leaderboard", "match", "next", "pick", "predict", "prediction", "rank", "rules", "schedule", "score", "team", "tomorrow", "what", "when", "who",
}
QUERY_CUES = (VIETNAMESE_CUES | ENGLISH_CUES) - {"co", "duoc", "muon", "ok", "pick", "yes"}
AMBIGUOUS_SHORT_RE = re.compile(r"^[a-z0-9\s?!.,'-]{1,32}$", re.IGNORECASE)
CONFIRMATION_WORDS = {"co", "ok", "oke", "yes", "yep", "yeah", "sure", "duoc", "muon"}
CONFIRMATION_PHRASES = {"chan de", "chanh de", "lets go", "let s go", "los geht", "goi y di", "du doan di"}


def _normalize_language_text(message: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFKD", message.lower().replace("đ", "d"))
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", without_marks)).strip()


def _language_score(normalized: str, cues: set[str]) -> int:
    return sum(1 for cue in cues if re.search(rf"(?:^|\s){re.escape(cue)}(?:\s|$)", normalized))


def detect_response_language(message: str, previous_language: str | None = None) -> str:
    normalized = _normalize_language_text(message)
    vietnamese_score = _language_score(normalized, VIETNAMESE_CUES)
    english_score = _language_score(normalized, ENGLISH_CUES)
    if VIETNAMESE_DIACRITIC_RE.search(message):
        vietnamese_score += 3

    if vietnamese_score > english_score:
        return "Vietnamese"
    if english_score > vietnamese_score:
        return "English"
    if previous_language and AMBIGUOUS_SHORT_RE.match(message.strip()):
        return previous_language
    return "Vietnamese"


def _has_query_cue(normalized: str) -> bool:
    return _language_score(normalized, QUERY_CUES) > 0


def is_pending_action_followup(message: str) -> bool:
    normalized = _normalize_language_text(message)
    if not normalized:
        return False
    if normalized in CONFIRMATION_PHRASES:
        return True
    if _has_query_cue(normalized):
        return False
    words = normalized.split()
    return any(word in CONFIRMATION_WORDS for word in words) or (len(words) <= 3 and bool(AMBIGUOUS_SHORT_RE.match(message.strip())))


def build_agent_graph():
    try:
        from langgraph.graph import END, StateGraph
    except ImportError:
        return None

    graph = StateGraph(AgentState)
    graph.add_node("memory_retrieve", memory_retrieve)
    graph.add_node("intent_router", intent_router)
    graph.add_node("data_gather", data_gather)
    graph.add_node("analysis", analysis)
    graph.add_node("safety_review", safety_review)
    graph.add_node("memory_write", memory_write)
    graph.set_entry_point("memory_retrieve")
    graph.add_edge("memory_retrieve", "intent_router")
    graph.add_edge("intent_router", "data_gather")
    graph.add_edge("data_gather", "analysis")
    graph.add_edge("analysis", "safety_review")
    graph.add_edge("safety_review", "memory_write")
    graph.add_edge("memory_write", END)
    return graph.compile()


async def run_agent_turn(
    message: str,
    session_id: str | None,
    match_id: str | None,
    user_id: str,
    email: str | None,
    access_token: str,
    request_metadata: dict,
) -> dict:
    resolved_session_id = session_id or str(uuid4())
    session_context = get_session_context(user_id, resolved_session_id)
    context_match_source = None
    follow_up_prediction = False
    if not match_id and FOLLOW_UP_MATCH_RE.search(message):
        match_id = session_context.get("match_id")
        if match_id:
            context_match_source = "session"
    if not match_id and session_context.get("pending_action") == "prediction_help" and is_pending_action_followup(message):
        match_id = session_context.get("pending_match_id")
        if match_id:
            context_match_source = "pending_action"
            follow_up_prediction = True

    state: AgentState = {
        "messages": [{"role": "user", "content": message}],
        "user_id": user_id,
        "email": email,
        "access_token": access_token,
        "session_id": resolved_session_id,
        "match_id": match_id,
        "context_match_source": context_match_source,
        "response_language": detect_response_language(message, session_context.get("response_language")),
        "request_metadata": request_metadata,
    }
    if follow_up_prediction:
        state["intent"] = "prediction_help"

    graph = build_agent_graph()
    if graph is not None:
        final_state = await graph.ainvoke(state)
    else:
        final_state = await memory_retrieve(state)
        final_state = await intent_router(final_state)
        final_state = await data_gather(final_state)
        final_state = analysis(final_state)
        final_state = safety_review(final_state)
        final_state = await memory_write(final_state)

    return {
        "answer": final_state.get("answer", ""),
        "session_id": final_state["session_id"],
        "intent": final_state.get("intent", "general_chat"),
        "used_tools": final_state.get("used_tools", []),
    }
