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

    async def test_routes_tomorrow_fixture_question(self):
        state = {"messages": [{"role": "user", "content": "cho tôi biết trận ngày mai"}]}

        with patch("app.graph.nodes._call_llm", return_value="unclear"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "match_preview")

    async def test_routes_team_squad_and_form_question(self):
        state = {"messages": [{"role": "user", "content": "đội hình và phong độ Argentina thế nào"}]}

        with patch("app.graph.nodes._call_llm", return_value="unclear"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "team_context")

    async def test_routes_leaderboard_climb_question(self):
        state = {"messages": [{"role": "user", "content": "làm sao leo bảng xếp hạng"}]}

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

        with patch("app.tools.football_tools.resolve_matchup_context", return_value=({"resolved_matchup": {"match_id": "wc2026-10"}}, ["find_match_by_team_ids"])):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["resolved_matchup"]["match_id"], "wc2026-10")
        self.assertEqual(result["used_tools"], ["find_match_by_team_ids"])

    async def test_gathers_fixture_list_without_match_id(self):
        state = {
            "messages": [{"role": "user", "content": "cho tôi biết trận ngày mai"}],
            "intent": "match_preview",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with patch("app.tools.football_tools.gather_fixture_list_context", return_value=({"fixture_window": {"label": "tomorrow"}}, ["list_matches_by_window"])):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["fixture_window"]["label"], "tomorrow")
        self.assertEqual(result["used_tools"], ["list_matches_by_window"])

    async def test_gathers_team_context_without_match_id(self):
        state = {
            "messages": [{"role": "user", "content": "đội hình và phong độ Argentina thế nào"}],
            "intent": "team_context",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with patch("app.tools.football_tools.gather_team_context", return_value=({"team_context": {"team": {"id": "ARG"}}}, ["list_team_rows"])):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["team_context"]["team"]["id"], "ARG")
        self.assertEqual(result["used_tools"], ["list_team_rows"])

    async def test_gathers_rules_context(self):
        state = {
            "messages": [{"role": "user", "content": "làm sao leo bảng xếp hạng"}],
            "intent": "rules_help",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with patch("app.tools.football_tools.gather_rules_context", return_value=({"rules_context": {"scoring": []}}, ["get_leaderboard_context"])):
            result = await data_gather(state)

        self.assertIn("rules_context", result["tool_results"])
        self.assertEqual(result["used_tools"], ["get_leaderboard_context"])


if __name__ == "__main__":
    unittest.main()
