import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.settings import get_settings


class CronAuthTest(unittest.TestCase):
    def setUp(self):
        get_settings.cache_clear()

    def tearDown(self):
        get_settings.cache_clear()

    def _client(self):
        from app.main import create_app
        return TestClient(create_app())

    def test_rejects_missing_secret(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            client = self._client()
            resp = client.post("/cron/run-agent-picks")
        self.assertEqual(resp.status_code, 401)

    def test_rejects_wrong_secret(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            client = self._client()
            resp = client.post("/cron/run-agent-picks", headers={"x-cron-secret": "wrong"})
        self.assertEqual(resp.status_code, 401)

    def test_runs_with_header_secret_via_post(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            with patch("app.api.routes.run_agent_picks", new=_async_return({"picked": 2, "skipped": 0, "errors": []})):
                client = self._client()
                resp = client.post("/cron/run-agent-picks", headers={"x-cron-secret": "topsecret"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["picked"], 2)

    def test_runs_with_query_secret_via_get(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            with patch("app.api.routes.run_agent_picks", new=_async_return({"picked": 1, "skipped": 0, "errors": []})):
                client = self._client()
                resp = client.get("/cron/run-agent-picks?secret=topsecret")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["picked"], 1)

    def test_runs_with_query_secret_via_head(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            with patch("app.api.routes.run_agent_picks", new=_async_return({"picked": 1, "skipped": 0, "errors": []})):
                client = self._client()
                resp = client.head("/cron/run-agent-picks?secret=topsecret")
        self.assertEqual(resp.status_code, 200)

    def test_head_rejects_missing_secret(self):
        with patch.dict(os.environ, {"CRON_SECRET": "topsecret", "AGENT_ALLOWED_ORIGIN": "http://localhost:3000"}, clear=False):
            get_settings.cache_clear()
            client = self._client()
            resp = client.head("/cron/run-agent-picks")
        self.assertEqual(resp.status_code, 401)

    def test_health_accepts_head(self):
        client = self._client()
        resp = client.head("/health")
        self.assertEqual(resp.status_code, 200)


def _async_return(value):
    async def _fn(*args, **kwargs):
        return value
    return _fn


if __name__ == "__main__":
    unittest.main()
