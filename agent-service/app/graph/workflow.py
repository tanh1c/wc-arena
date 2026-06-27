import re
from uuid import uuid4

from app.graph.nodes import analysis, data_gather, intent_router, memory_retrieve, memory_write, safety_review
from app.graph.state import AgentState
from app.memory import get_session_context

FOLLOW_UP_MATCH_RE = re.compile(r"(?:trận đó|tran do|trận này|tran nay|that match|this match|match đó|match do)", re.IGNORECASE)


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
    context_match_source = None
    if not match_id and FOLLOW_UP_MATCH_RE.search(message):
        session_context = get_session_context(user_id, resolved_session_id)
        match_id = session_context.get("match_id")
        if match_id:
            context_match_source = "session"

    state: AgentState = {
        "messages": [{"role": "user", "content": message}],
        "user_id": user_id,
        "email": email,
        "access_token": access_token,
        "session_id": resolved_session_id,
        "match_id": match_id,
        "context_match_source": context_match_source,
        "request_metadata": request_metadata,
    }

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
