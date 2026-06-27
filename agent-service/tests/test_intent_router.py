import unittest
from unittest.mock import patch

from app.graph.nodes import analysis, data_gather, intent_router


class IntentRouterTest(unittest.IsolatedAsyncioTestCase):
    async def test_deterministic_router_runs_before_llm(self):
        state = {
            "messages": [{"role": "user", "content": "Can you explain team form?"}],
            "user_id": "user-1",
            "session_id": "session-1",
        }

        with patch("app.graph.nodes._call_llm") as call_llm:
            result = await intent_router(state)

        self.assertEqual(result["intent"], "team_context")
        call_llm.assert_not_called()

    async def test_falls_back_to_llm_when_no_deterministic_route_matches(self):
        state = {
            "messages": [{"role": "user", "content": "What should I focus on here?"}],
            "user_id": "user-1",
            "session_id": "session-1",
        }

        with patch("app.graph.nodes._call_llm", return_value="prediction_help"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "prediction_help")

    async def test_returns_general_chat_when_no_route_matches(self):
        state = {
            "messages": [{"role": "user", "content": "hello there"}],
            "user_id": "user-1",
            "session_id": "session-1",
        }

        with patch("app.graph.nodes._call_llm", return_value="unclear"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "general_chat")

    async def test_routes_tomorrow_fixture_question(self):
        state = {"messages": [{"role": "user", "content": "cho tôi biết trận ngày mai"}]}

        with patch("app.graph.nodes._call_llm", return_value="unclear"):
            result = await intent_router(state)

        self.assertEqual(result["intent"], "match_preview")

    async def test_routes_short_vietnamese_tomorrow_fixture_question(self):
        state = {"messages": [{"role": "user", "content": "mai có trận"}]}

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


class MemoryWriteSessionContextTest(unittest.IsolatedAsyncioTestCase):
    async def test_saves_latest_match_context(self):
        state = {
            "messages": [{"role": "user", "content": "POR vs COL"}],
            "user_id": "user-2",
            "session_id": "session-2",
            "answer": "Portugal vs Colombia preview",
            "intent": "match_preview",
            "tool_results": {
                "match": {"id": "m2", "home_team_id": "POR", "away_team_id": "COL"},
                "teams": {"home": {"name": "Portugal"}, "away": {"name": "Colombia"}},
            },
        }

        with (
            patch("app.graph.nodes.save_interaction", create=True) as unused_save_interaction,
            patch("app.memory.get_memory_client", return_value=None),
        ):
            from app.graph.nodes import memory_write
            from app.memory import get_session_context

            await memory_write(state)

        self.assertEqual(get_session_context("user-2", "session-2")["match_id"], "m2")


class AnalysisGuardrailTest(unittest.TestCase):
    def test_off_topic_general_chat_returns_tool_suggestions_without_llm(self):
        state = {
            "messages": [{"role": "user", "content": "explain stock trading"}],
            "intent": "general_chat",
            "tool_results": {},
        }

        with patch("app.graph.nodes._call_llm") as call_llm:
            result = analysis(state)

        self.assertIn("fixtures by date", result["answer"])
        self.assertIn("exact-score prediction", result["answer"])
        self.assertIn("leaderboard climbing", result["answer"])
        call_llm.assert_not_called()

    def test_ambiguous_matchup_clarification_includes_feature_suggestions(self):
        state = {
            "messages": [{"role": "user", "content": "bồ đào nha và colombia"}],
            "intent": "team_context",
            "tool_results": {"ambiguous_matchup": {"display_matchup": "Portugal vs Colombia", "match_id": "m1"}},
        }

        with patch("app.graph.nodes._call_llm") as call_llm:
            result = analysis(state)

        self.assertIn("Do you mean Portugal vs Colombia", result["answer"])
        self.assertIn("fixtures by date", result["answer"])
        self.assertIn("upcoming lock reminders", result["answer"])
        call_llm.assert_not_called()

    def test_unmatched_matchup_returns_guardrail_without_entity_commentary(self):
        state = {
            "messages": [{"role": "user", "content": "messi với ronaldo chọn ai"}],
            "intent": "prediction_help",
            "tool_results": {"unmatched_matchup": {"teams": ["messi", "ronaldo"], "resolved_team_ids": ["arg", None]}},
        }

        with patch("app.graph.nodes._call_llm") as call_llm:
            result = analysis(state)

        self.assertIn("I can help with We Speak Football only", result["answer"])
        self.assertIn("fixtures by date", result["answer"])
        self.assertNotIn("messi", result["answer"].lower())
        self.assertNotIn("ronaldo", result["answer"].lower())
        call_llm.assert_not_called()


class DataGatherTest(unittest.IsolatedAsyncioTestCase):
    async def test_gathers_team_schedule_before_generic_match_preview(self):
        state = {
            "messages": [{"role": "user", "content": "argentina đá trận tiếp theo khi nào"}],
            "intent": "match_preview",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with patch("app.tools.football_tools.gather_team_schedule_context", return_value=({"team_schedule_context": {"team": {"id": "ARG"}}}, ["list_team_rows", "resolve_team_id", "list_matches_for_team"])):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["team_schedule_context"]["team"]["id"], "ARG")
        self.assertEqual(result["used_tools"], ["list_team_rows", "resolve_team_id", "list_matches_for_team"])

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

    async def test_gathers_ambiguous_matchup_before_team_context(self):
        state = {
            "messages": [{"role": "user", "content": "bồ đào nha và colombia"}],
            "intent": "team_context",
            "user_id": "user-1",
            "access_token": "token-1",
        }

        with (
            patch("app.tools.football_tools.gather_ambiguous_matchup_context", return_value=({"ambiguous_matchup": {"display_matchup": "Portugal vs Colombia"}}, ["list_team_rows", "resolve_team_id", "find_match_by_team_ids"])),
            patch("app.tools.football_tools.gather_team_context") as gather_team_context,
        ):
            result = await data_gather(state)

        self.assertEqual(result["tool_results"]["ambiguous_matchup"]["display_matchup"], "Portugal vs Colombia")
        self.assertEqual(result["used_tools"], ["list_team_rows", "resolve_team_id", "find_match_by_team_ids"])
        gather_team_context.assert_not_called()

    async def test_gathers_short_vietnamese_tomorrow_fixture_list(self):
        state = {
            "messages": [{"role": "user", "content": "mai có trận"}],
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
