import unittest
from unittest.mock import MagicMock, patch

from app.memory import get_session_context, save_session_context, search_user_memory


class SessionContextTest(unittest.TestCase):
    def test_saves_and_reads_session_context_by_user_and_session(self):
        save_session_context("user-1", "session-1", {"match_id": "m1", "home_team": "Portugal", "away_team": "Colombia"})

        self.assertEqual(get_session_context("user-1", "session-1")["match_id"], "m1")
        self.assertEqual(get_session_context("user-1", "session-2"), {})


class SearchUserMemoryTest(unittest.IsolatedAsyncioTestCase):
    async def test_search_uses_user_filter(self):
        client = MagicMock()
        client.search.return_value = [{"memory": "likes Portugal"}]

        with patch("app.memory.get_memory_client", return_value=client):
            results = await search_user_memory("user-1", "Portugal")

        self.assertEqual(results, [{"memory": "likes Portugal"}])
        client.search.assert_called_once_with(query="Portugal", filters={"user_id": "user-1"}, limit=5)


if __name__ == "__main__":
    unittest.main()
