import os
import sys
import types
import unittest
from unittest.mock import patch

from app.settings import get_settings


class UserSupabaseClientTest(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()
        sys.modules.pop("supabase", None)

    def test_binds_caller_jwt_with_anon_key(self):
        created = []
        auth_tokens = []

        class FakePostgrest:
            def auth(self, token):
                auth_tokens.append(token)

        class FakeClient:
            def __init__(self):
                self.postgrest = FakePostgrest()

        def fake_create_client(url, key):
            created.append((url, key))
            return FakeClient()

        fake_module = types.SimpleNamespace(Client=FakeClient, create_client=fake_create_client)
        env = {
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon-public-key",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            sys.modules["supabase"] = fake_module
            from app.tools import supabase_tools
            import importlib

            importlib.reload(supabase_tools)
            client = supabase_tools.get_user_supabase_client("user-jwt-token")

        self.assertIsInstance(client, FakeClient)
        self.assertEqual(created, [("https://project.supabase.co", "anon-public-key")])
        self.assertEqual(auth_tokens, ["user-jwt-token"])

    def test_rejects_missing_access_token(self):
        env = {
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon-public-key",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            from app.tools import supabase_tools
            import importlib

            importlib.reload(supabase_tools)
            with self.assertRaises(RuntimeError):
                supabase_tools.get_user_supabase_client("")


if __name__ == "__main__":
    unittest.main()
