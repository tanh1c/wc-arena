import unittest
from unittest.mock import MagicMock, patch

from app.memory import build_long_term_memory, get_session_context, save_interaction, save_session_context, search_user_memory


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


class LongTermMemoryTest(unittest.IsolatedAsyncioTestCase):
    def test_builds_structured_prediction_memory(self):
        memory = build_long_term_memory(
            user_message="có",
            assistant_message="## Dự đoán: RSA vs CAN",
            metadata={"intent": "prediction_help", "match_id": "wc2026-073", "match_label": "RSA vs CAN"},
        )

        self.assertEqual(memory, "User asked for prediction help for RSA vs CAN (match_id: wc2026-073).")

    def test_skips_general_and_short_confirmation_memory(self):
        self.assertIsNone(build_long_term_memory("hello", "hi", {"intent": "general_chat"}))
        self.assertIsNone(build_long_term_memory("có", "## Dự đoán", {"intent": "prediction_help", "context_match_source": "pending_action"}))

    async def test_save_interaction_writes_structured_memory_only(self):
        client = MagicMock()

        with patch("app.memory.get_memory_client", return_value=client):
            await save_interaction(
                user_id="user-1",
                session_id="session-1",
                user_message="có",
                assistant_message="full assistant response should not be stored",
                metadata={"intent": "prediction_help", "match_id": "m1", "match_label": "Portugal vs Colombia"},
            )

        client.add.assert_called_once_with(
            [{"role": "user", "content": "User asked for prediction help for Portugal vs Colombia (match_id: m1)."}],
            user_id="user-1",
            metadata={"intent": "prediction_help", "match_id": "m1", "match_label": "Portugal vs Colombia", "session_id": "session-1"},
        )

    async def test_save_interaction_skips_non_durable_turns(self):
        client = MagicMock()

        with patch("app.memory.get_memory_client", return_value=client):
            await save_interaction("user-1", "session-1", "hello", "hi", {"intent": "general_chat"})

        client.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
