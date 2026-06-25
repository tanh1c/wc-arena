import types
import unittest
from unittest.mock import patch

from app.picks.runner import run_agent_picks


class RunAgentPicksTest(unittest.IsolatedAsyncioTestCase):
    async def test_picks_unpicked_matches_and_counts_results(self):
        matches = [{"id": "m1", "home_team_id": "A", "away_team_id": "B"}]

        ok_response = types.SimpleNamespace(status_code=200, json=lambda: {"prediction": {"id": "p1"}})

        with patch("app.picks.runner.sign_in_agent", return_value="jwt"), \
             patch("app.picks.runner.get_agent_user_id", return_value="agent-id"), \
             patch("app.picks.runner.get_user_supabase_client", return_value=object()), \
             patch("app.picks.runner.list_unpicked_matches", return_value=matches), \
             patch("app.picks.runner.gather_match_context", new=_async_return(({"match": {"id": "m1"}}, []))), \
             patch("app.picks.runner.decide_pick", return_value={"home_score": 2, "away_score": 1, "confidence": 70}), \
             patch("app.picks.runner.submit_agent_prediction", return_value=ok_response):
            result = await run_agent_picks()

        self.assertEqual(result["picked"], 1)
        self.assertEqual(result["skipped"], 0)

    async def test_skips_when_pick_unparseable(self):
        matches = [{"id": "m1", "home_team_id": "A", "away_team_id": "B"}]
        with patch("app.picks.runner.sign_in_agent", return_value="jwt"), \
             patch("app.picks.runner.get_agent_user_id", return_value="agent-id"), \
             patch("app.picks.runner.get_user_supabase_client", return_value=object()), \
             patch("app.picks.runner.list_unpicked_matches", return_value=matches), \
             patch("app.picks.runner.gather_match_context", new=_async_return(({"match": {"id": "m1"}}, []))), \
             patch("app.picks.runner.decide_pick", return_value=None), \
             patch("app.picks.runner.submit_agent_prediction") as submit_mock:
            result = await run_agent_picks()

        submit_mock.assert_not_called()
        self.assertEqual(result["picked"], 0)
        self.assertEqual(result["skipped"], 1)

    async def test_stops_on_rate_limit(self):
        matches = [{"id": "m1", "home_team_id": "A", "away_team_id": "B"}, {"id": "m2", "home_team_id": "C", "away_team_id": "D"}]
        rate_limited = types.SimpleNamespace(status_code=429, json=lambda: {"error": "Too many requests"})
        with patch("app.picks.runner.sign_in_agent", return_value="jwt"), \
             patch("app.picks.runner.get_agent_user_id", return_value="agent-id"), \
             patch("app.picks.runner.get_user_supabase_client", return_value=object()), \
             patch("app.picks.runner.list_unpicked_matches", return_value=matches), \
             patch("app.picks.runner.gather_match_context", new=_async_return(({"match": {}}, []))), \
             patch("app.picks.runner.decide_pick", return_value={"home_score": 1, "away_score": 0, "confidence": 60}), \
             patch("app.picks.runner.submit_agent_prediction", return_value=rate_limited):
            result = await run_agent_picks()

        self.assertEqual(result["picked"], 0)


def _async_return(value):
    async def _fn(*args, **kwargs):
        return value
    return _fn


if __name__ == "__main__":
    unittest.main()
