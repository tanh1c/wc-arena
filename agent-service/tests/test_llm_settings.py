import os
import sys
import types
import unittest
from unittest.mock import patch

from app.settings import get_settings


class LlmSettingsTest(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()
        sys.modules.pop("langchain_openai", None)

    def test_call_llm_uses_openai_compatible_llm_environment(self):
        calls = []

        class FakeChatOpenAI:
            def __init__(self, **kwargs):
                calls.append(kwargs)

            def invoke(self, prompt):
                return types.SimpleNamespace(content=f"response to {prompt}")

        fake_module = types.SimpleNamespace(ChatOpenAI=FakeChatOpenAI)
        env = {
            "LLM_API_KEY": "provider-key",
            "LLM_BASE_URL": "https://provider.example/v1",
            "LLM_MODEL": "provider/model",
            "OPENAI_API_KEY": "",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            sys.modules["langchain_openai"] = fake_module
            from app.graph.nodes import _call_llm

            result = _call_llm("ping")

        self.assertEqual(result, "response to ping")
        self.assertEqual(len(calls), 1)
        http_client = calls[0].pop("http_client", None)
        self.assertIsNotNone(http_client)
        self.assertFalse(getattr(http_client, "_trust_env", True))
        self.assertEqual(calls, [{
            "api_key": "provider-key",
            "base_url": "https://provider.example/v1",
            "model": "provider/model",
            "temperature": 0.3,
        }])


if __name__ == "__main__":
    unittest.main()
