import os
import sys
import types
import unittest
from unittest.mock import patch

from app.settings import get_settings


class AgentAccountTest(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()
        sys.modules.pop("supabase", None)

    def test_returns_access_token_from_session(self):
        session = types.SimpleNamespace(access_token="agent-jwt-token")
        response = types.SimpleNamespace(session=session)
        sign_in_args = []

        class FakeAuth:
            def sign_in_with_password(self, credentials):
                sign_in_args.append(credentials)
                return response

        class FakeClient:
            def __init__(self):
                self.auth = FakeAuth()

        def fake_create_client(url, key):
            return FakeClient()

        fake_module = types.SimpleNamespace(Client=FakeClient, create_client=fake_create_client)
        env = {
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon-public-key",
            "AGENT_EMAIL": "agent@example.com",
            "AGENT_PASSWORD": "secret",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            sys.modules["supabase"] = fake_module
            from app import agent_account
            import importlib

            importlib.reload(agent_account)
            token = agent_account.sign_in_agent()

        self.assertEqual(token, "agent-jwt-token")
        self.assertEqual(
            sign_in_args,
            [{"email": "agent@example.com", "password": "secret"}],
        )

    def test_raises_when_credentials_missing(self):
        env = {
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon-public-key",
            "AGENT_EMAIL": "",
            "AGENT_PASSWORD": "",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            from app import agent_account
            import importlib

            importlib.reload(agent_account)
            with self.assertRaises(RuntimeError):
                agent_account.sign_in_agent()


if __name__ == "__main__":
    unittest.main()
