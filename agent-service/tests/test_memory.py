import unittest
from unittest.mock import MagicMock, patch

from app.memory import search_user_memory


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
