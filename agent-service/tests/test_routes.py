import unittest

from app.api.routes import router


class AgentRoutesTest(unittest.TestCase):
    def test_only_chat_agent_endpoint_is_exposed(self):
        paths = {route.path for route in router.routes}

        self.assertIn("/agent/chat", paths)
        self.assertNotIn("/agent/analyze-match/{match_id}", paths)


if __name__ == "__main__":
    unittest.main()
