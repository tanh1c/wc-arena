import unittest
from unittest.mock import patch

from app.graph.nodes import data_gather, intent_router


class IntentRouterTest(unittest.IsolatedAsyncioTestCase):
    async def test_uses_llm_classification_when_valid(self):
        state = {
            "messages": [{"role": "user", "content": "Can you explain team form and exact score confidence?"}],
            "user_id": "user-1",
            "session_id": "session-1",
            "match_id": "match-1",
        }

        with patch("app.graph.nodes._call_llm", return_value="prediction_help"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "prediction_help")

    async def test_falls_back_to_keyword_router_when_llm_returns_invalid_intent(self):
        state = {
            "messages": [{"role": "user", "content": "What are the points and deadline rules?"}],
            "user_id": "user-1",
            "session_id": "session-1",
        }

        with patch("app.graph.nodes._call_llm", return_value="unclear"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "rules_help")



class DataGatherTest(unittest.IsolatedAsyncioTestCase):
    async def test_resolves_natural_language_matchup_without_match_id(self):
        state = {
            "messages": [{"role": "user", "content": "phân tích bồ đào nha vs colombia"}],
            "intent": "match_preview",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with patch("app.tools.football_tools.resolve_matchup_context", return_value=({"resolved_matchup": {"match_id": "wc2026-10"}}, ["find_match_by_team_names"])):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["resolved_matchup"]["match_id"], "wc2026-10")
        self.assertEqual(result["used_tools"], ["find_match_by_team_names"])


if __name__ == "__main__":
    unittest.main()
