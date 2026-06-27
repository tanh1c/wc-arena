import unittest
from unittest.mock import patch

from app.graph.workflow import detect_response_language, run_agent_turn
from app.memory import save_session_context


class ResponseLanguageDetectionTest(unittest.TestCase):
    def test_detects_unaccented_vietnamese_question(self):
        self.assertEqual(detect_response_language("mai ai dau"), "Vietnamese")

    def test_detects_english_question(self):
        self.assertEqual(detect_response_language("when is Argentina next match"), "English")

    def test_uses_previous_language_for_short_ambiguous_followup(self):
        self.assertEqual(detect_response_language("ok", previous_language="Vietnamese"), "Vietnamese")


class WorkflowSessionContextTest(unittest.IsolatedAsyncioTestCase):
    async def test_injects_previous_match_for_followup(self):
        save_session_context("user-1", "session-1", {"match_id": "m1", "home_team": "Portugal", "away_team": "Colombia"})

        async def fake_memory_retrieve(state):
            return state

        async def fake_intent_router(state):
            return {**state, "intent": "match_preview"}

        async def fake_data_gather(state):
            return {**state, "tool_results": {"match": {"id": state.get("match_id")}}, "used_tools": ["get_match"]}

        def fake_analysis(state):
            return {**state, "answer": f"match {state.get('match_id')}"}

        def fake_safety_review(state):
            return state

        async def fake_memory_write(state):
            return state

        with (
            patch("app.graph.workflow.build_agent_graph", return_value=None),
            patch("app.graph.workflow.memory_retrieve", side_effect=fake_memory_retrieve),
            patch("app.graph.workflow.intent_router", side_effect=fake_intent_router),
            patch("app.graph.workflow.data_gather", side_effect=fake_data_gather),
            patch("app.graph.workflow.analysis", side_effect=fake_analysis),
            patch("app.graph.workflow.safety_review", side_effect=fake_safety_review),
            patch("app.graph.workflow.memory_write", side_effect=fake_memory_write),
        ):
            result = await run_agent_turn("dự đoán trận đó", "session-1", None, "user-1", None, "token-1", {})

        self.assertEqual(result["answer"], "match m1")
        self.assertEqual(result["used_tools"], ["get_match"])


if __name__ == "__main__":
    unittest.main()
