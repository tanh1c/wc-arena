import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.tools.football_tools import gather_ambiguous_matchup_context, gather_fixture_list_context, gather_reminder_context, gather_rules_context, gather_team_context, gather_team_schedule_context


class FootballContextTest(unittest.IsolatedAsyncioTestCase):
    async def test_gathers_ambiguous_matchup_context_with_fixture(self):
        teams = [
            {"id": "POR", "name": "Portugal", "short_name": "POR", "country_code": "PT"},
            {"id": "COL", "name": "Colombia", "short_name": "COL", "country_code": "CO"},
        ]
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=teams)),
            patch("app.graph.nodes._call_llm", side_effect=['{"team_id": "POR"}', '{"team_id": "COL"}']),
            patch("app.tools.football_tools.find_match_by_team_ids", new=AsyncMock(return_value={"id": "m1"})),
        ):
            context, tools = await gather_ambiguous_matchup_context("bồ đào nha và colombia", "token-1")

        self.assertEqual(context["ambiguous_matchup"]["display_matchup"], "Portugal vs Colombia")
        self.assertEqual(context["ambiguous_matchup"]["match_id"], "m1")
        self.assertIn("find_match_by_team_ids", tools)

    async def test_gathers_ambiguous_matchup_context_without_fixture(self):
        teams = [
            {"id": "POR", "name": "Portugal", "short_name": "POR", "country_code": "PT"},
            {"id": "COL", "name": "Colombia", "short_name": "COL", "country_code": "CO"},
        ]
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=teams)),
            patch("app.graph.nodes._call_llm", side_effect=['{"team_id": "POR"}', '{"team_id": "COL"}']),
            patch("app.tools.football_tools.find_match_by_team_ids", new=AsyncMock(return_value=None)),
        ):
            context, tools = await gather_ambiguous_matchup_context("bồ đào nha và colombia", "token-1")

        self.assertEqual(context["ambiguous_matchup"]["display_matchup"], "Portugal vs Colombia")
        self.assertNotIn("match_id", context["ambiguous_matchup"])
        self.assertIn("find_match_by_team_ids", tools)

    async def test_gathers_tomorrow_fixture_context(self):
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch(
                "app.tools.football_tools.list_matches_by_window",
                new=AsyncMock(
                    return_value=[
                        {
                            "id": "m1",
                            "home_team_id": "POR",
                            "away_team_id": "COD",
                            "kickoff_at": "2026-06-28T20:00:00+00:00",
                            "lock_at": "2026-06-28T19:55:00+00:00",
                            "stage": "Group",
                            "city": "Miami",
                        }
                    ]
                ),
            ),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=[{"id": "POR", "name": "Portugal"}, {"id": "COD", "name": "Congo DR"}])),
        ):
            context, tools = await gather_fixture_list_context(
                "cho tôi biết trận ngày mai",
                "token-1",
                now_utc=datetime(2026, 6, 27, 12, tzinfo=timezone.utc),
            )

        self.assertEqual(context["fixture_window"]["label"], "tomorrow")
        self.assertEqual(context["fixtures"][0]["home_team"]["name"], "Portugal")
        self.assertEqual(context["fixtures"][0]["away_team"]["name"], "Congo DR")
        self.assertIn("list_matches_by_window", tools)

    async def test_gathers_upcoming_matches_for_reminders(self):
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch(
                "app.tools.football_tools.list_upcoming_matches",
                new=AsyncMock(return_value=[{"id": "m2", "home_team_id": "ARG", "away_team_id": "KOR", "kickoff_at": "2026-06-27T18:00:00+00:00", "lock_at": "2026-06-27T17:55:00+00:00"}]),
            ),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=[{"id": "ARG", "name": "Argentina"}, {"id": "KOR", "name": "Korea Republic"}])),
        ):
            context, tools = await gather_reminder_context("nhắc tôi các trận sắp diễn ra", "user-1", "token-1")

        self.assertEqual(context["reminder_context"]["mode"], "upcoming_matches")
        self.assertEqual(context["reminder_matches"][0]["home_team"]["name"], "Argentina")
        self.assertIn("list_upcoming_matches", tools)

    async def test_gathers_team_schedule_next_match_context(self):
        teams = [
            {"id": "ARG", "name": "Argentina", "short_name": "ARG", "country_code": "AR", "fifa_rank": 1},
            {"id": "KOR", "name": "Korea Republic", "short_name": "KOR", "country_code": "KR"},
        ]
        matches = [
            {"id": "old", "home_team_id": "ARG", "away_team_id": "KOR", "kickoff_at": "2026-06-26T18:00:00+00:00"},
            {"id": "next", "home_team_id": "ARG", "away_team_id": "KOR", "kickoff_at": "2026-06-28T20:00:00+00:00", "city": "Miami", "stage": "Group"},
        ]
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=teams)),
            patch("app.tools.football_tools.list_matches_for_team", new=AsyncMock(return_value=matches)),
            patch("app.graph.nodes._call_llm", return_value='{"team_id": "ARG"}'),
        ):
            context, tools = await gather_team_schedule_context(
                "argentina đá trận tiếp theo khi nào",
                "token-1",
                now_utc=datetime(2026, 6, 27, 12, tzinfo=timezone.utc),
            )

        self.assertEqual(context["team_schedule_context"]["team"]["id"], "ARG")
        self.assertEqual(context["team_schedule_context"]["next_match"]["id"], "next")
        self.assertEqual(context["team_schedule_context"]["next_match"]["away_team"]["name"], "Korea Republic")
        self.assertIn("list_matches_for_team", tools)

    async def test_gathers_single_team_context(self):
        teams = [{"id": "ARG", "name": "Argentina", "short_name": "ARG", "country_code": "AR", "fifa_rank": 1}]
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=teams)),
            patch("app.tools.football_tools.list_matches_for_team", new=AsyncMock(return_value=[{"id": "m3", "home_team_id": "ARG", "away_team_id": "KOR"}])),
            patch("app.graph.nodes._call_llm", return_value='{"team_id": "ARG"}'),
        ):
            context, tools = await gather_team_context("đội hình và phong độ Argentina thế nào", "token-1")

        self.assertEqual(context["team_context"]["team"]["id"], "ARG")
        self.assertFalse(context["team_context"]["squad_available"])
        self.assertIn("list_matches_for_team", tools)

    async def test_team_context_asks_for_clarification_when_no_team_resolves(self):
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.list_team_rows", new=AsyncMock(return_value=[{"id": "ARG", "name": "Argentina"}])),
            patch("app.graph.nodes._call_llm", return_value='{"team_id": null}'),
        ):
            context, tools = await gather_team_context("đội hình đội đó thế nào", "token-1")

        self.assertIn("unmatched_team_context", context)
        self.assertIn("list_team_rows", tools)

    async def test_gathers_rules_context_with_leaderboard(self):
        with (
            patch("app.tools.football_tools.get_user_supabase_client", return_value=MagicMock()),
            patch("app.tools.football_tools.get_leaderboard_context", new=AsyncMock(return_value={"entries": [{"rank": 5, "points": 42}]})),
            patch("app.tools.football_tools.list_global_leaderboard_context", new=AsyncMock(return_value=[{"rank": 1, "points": 99}])),
        ):
            context, tools = await gather_rules_context("user-1", "token-1")

        self.assertIn("rules_context", context)
        self.assertEqual(context["leaderboard_context"]["entries"][0]["rank"], 5)
        self.assertIn("get_leaderboard_context", tools)


if __name__ == "__main__":
    unittest.main()
