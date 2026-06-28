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

        result = await self._run_stubbed_turn("dự đoán trận đó", "session-1", "user-1")

        self.assertEqual(result["answer"], "match m1")
        self.assertEqual(result["used_tools"], ["get_match"])

    async def test_pending_prediction_handles_short_followups(self):
        save_session_context(
            "user-pending",
            "session-pending",
            {"pending_action": "prediction_help", "pending_match_id": "m2", "response_language": "Vietnamese"},
        )

        for message in ("có", "chan đê", "lets go", "los geht"):
            with self.subTest(message=message):
                result = await self._run_stubbed_turn(message, "session-pending", "user-pending")

            self.assertEqual(result["intent"], "prediction_help")
            self.assertEqual(result["answer"], "match m2")

    async def test_real_fixture_query_ignores_pending_match(self):
        save_session_context(
            "user-fixture",
            "session-fixture",
            {"pending_action": "prediction_help", "pending_match_id": "stale-match", "response_language": "Vietnamese"},
        )

        result = await self._run_stubbed_turn("mai có trận", "session-fixture", "user-fixture")

        self.assertEqual(result["intent"], "match_preview")
        self.assertEqual(result["answer"], "match None")

    async def _run_stubbed_turn(self, message: str, session_id: str, user_id: str):
        async def fake_memory_retrieve(state):
            return state

        async def fake_intent_router(state):
            return state if state.get("intent") else {**state, "intent": "match_preview"}

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
            return await run_agent_turn(message, session_id, None, user_id, None, "token-1", {})


if __name__ == "__main__":
    unittest.main()
