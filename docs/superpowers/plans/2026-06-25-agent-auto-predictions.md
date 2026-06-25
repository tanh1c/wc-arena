# Agent Auto-Predictions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho AI agent tự động dự đoán và đặt prediction định kỳ như một đối thủ thật trên leaderboard, qua endpoint cron được UptimeRobot trigger.

**Architecture:** Thêm endpoint `POST /cron/run-agent-picks` vào agent-service (FastAPI). Mỗi lần chạy: xác thực cron secret → sign-in account agent lấy JWT → query trận sắp lock chưa pick → LLM chọn tỷ số → gọi Edge Function `submit_prediction`. Agent đi qua đúng cửa người chơi, không đặc quyền.

**Tech Stack:** Python 3.11, FastAPI, supabase-py 2.31, httpx, DeepSeek qua langchain-openai. Test: unittest + mock.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `agent-service/app/settings.py` (modify) | Thêm `agent_email`, `agent_password`, `cron_secret`, `agent_pick_window_hours`, `agent_pick_batch_limit` |
| `agent-service/app/agent_account.py` (create) | `sign_in_agent()` → JWT tươi từ email+password |
| `agent-service/app/picks/__init__.py` (create) | package marker |
| `agent-service/app/picks/picker.py` (create) | `parse_pick()` + `decide_pick()`: LLM → `{home_score, away_score, confidence}` + validate |
| `agent-service/app/tools/prediction_tools.py` (create) | `list_unpicked_matches()`, `submit_agent_prediction()` |
| `agent-service/app/picks/runner.py` (create) | `run_agent_picks()`: orchestrate toàn bộ một lần cron |
| `agent-service/app/api/routes.py` (modify) | Thêm `POST /cron/run-agent-picks` + verify secret |
| `agent-service/.env.example` (modify) | Thêm các env mới |
| `agent-service/tests/test_picker.py` (create) | parse/validate pick |
| `agent-service/tests/test_cron_auth.py` (create) | cron secret 401/200 |
| `agent-service/tests/test_prediction_tools.py` (create) | query lọc trận chưa pick |

---

## Task 1: Settings cho agent picks

**Files:**
- Modify: `agent-service/app/settings.py`

- [ ] **Step 1: Thêm fields vào Settings**

Mở `agent-service/app/settings.py`, thêm các field sau vào class `Settings` (sau dòng `agent_allowed_origin`):

```python
    agent_email: str = ""
    agent_password: str = ""
    cron_secret: str = ""
    agent_pick_window_hours: int = 48
    agent_pick_batch_limit: int = 10
```

- [ ] **Step 2: Verify compile**

Run: `cd agent-service && python -c "from app.settings import Settings; s=Settings(); print(s.agent_pick_window_hours, s.agent_pick_batch_limit)"`
Expected: `48 10`

- [ ] **Step 3: Commit**

```bash
git add agent-service/app/settings.py
git commit -m "feat: add agent pick settings"
```

---

## Task 2: Agent sign-in (lấy JWT)

**Files:**
- Create: `agent-service/app/agent_account.py`
- Test: `agent-service/tests/test_agent_account.py`

- [ ] **Step 1: Write the failing test**

Tạo `agent-service/tests/test_agent_account.py`:

```python
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
        captured = {}

        class FakeAuth:
            def sign_in_with_password(self, credentials):
                captured["creds"] = credentials
                session = types.SimpleNamespace(access_token="agent-jwt-123")
                return types.SimpleNamespace(session=session)

        class FakeClient:
            def __init__(self):
                self.auth = FakeAuth()

        def fake_create_client(url, key):
            captured["url"] = url
            captured["key"] = key
            return FakeClient()

        fake_module = types.SimpleNamespace(create_client=fake_create_client)
        env = {
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon-key",
            "AGENT_EMAIL": "ai-oracle@example.com",
            "AGENT_PASSWORD": "secret-pw",
        }

        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            sys.modules["supabase"] = fake_module
            import importlib
            from app import agent_account
            importlib.reload(agent_account)
            token = agent_account.sign_in_agent()

        self.assertEqual(token, "agent-jwt-123")
        self.assertEqual(captured["creds"], {"email": "ai-oracle@example.com", "password": "secret-pw"})
        self.assertEqual(captured["key"], "anon-key")

    def test_raises_when_credentials_missing(self):
        env = {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_ANON_KEY": "anon-key", "AGENT_EMAIL": "", "AGENT_PASSWORD": ""}
        with patch.dict(os.environ, env, clear=False):
            get_settings.cache_clear()
            import importlib
            from app import agent_account
            importlib.reload(agent_account)
            with self.assertRaises(RuntimeError):
                agent_account.sign_in_agent()


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent-service && python -m unittest tests.test_agent_account -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent_account'`

- [ ] **Step 3: Write minimal implementation**

Tạo `agent-service/app/agent_account.py`:

```python
from supabase import create_client

from app.settings import get_settings


def sign_in_agent() -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase server credentials are not configured")
    if not settings.agent_email or not settings.agent_password:
        raise RuntimeError("Agent account credentials are not configured")

    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.sign_in_with_password(
        {"email": settings.agent_email, "password": settings.agent_password}
    )
    session = getattr(response, "session", None)
    token = getattr(session, "access_token", None)
    if not token:
        raise RuntimeError("Agent sign-in returned no access token")
    return token
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent-service && python -m unittest tests.test_agent_account -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add agent-service/app/agent_account.py agent-service/tests/test_agent_account.py
git commit -m "feat: add agent account sign-in"
```

---

## Task 3: Picker (LLM chọn tỷ số + validate)

**Files:**
- Create: `agent-service/app/picks/__init__.py`
- Create: `agent-service/app/picks/picker.py`
- Test: `agent-service/tests/test_picker.py`

- [ ] **Step 1: Write the failing test**

Tạo `agent-service/tests/test_picker.py`:

```python
import unittest
from unittest.mock import patch

from app.picks.picker import parse_pick, decide_pick


class ParsePickTest(unittest.TestCase):
    def test_parses_valid_json(self):
        result = parse_pick('{"home_score": 2, "away_score": 1, "confidence": 70}')
        self.assertEqual(result, {"home_score": 2, "away_score": 1, "confidence": 70})

    def test_parses_json_embedded_in_text(self):
        raw = 'Sure! Here is my pick: {"home_score": 0, "away_score": 0, "confidence": 55} good luck'
        result = parse_pick(raw)
        self.assertEqual(result, {"home_score": 0, "away_score": 0, "confidence": 55})

    def test_rejects_negative_score(self):
        self.assertIsNone(parse_pick('{"home_score": -1, "away_score": 2, "confidence": 50}'))

    def test_rejects_non_integer_score(self):
        self.assertIsNone(parse_pick('{"home_score": 1.5, "away_score": 2, "confidence": 50}'))

    def test_rejects_missing_field(self):
        self.assertIsNone(parse_pick('{"home_score": 1, "away_score": 2}'))

    def test_rejects_garbage(self):
        self.assertIsNone(parse_pick('I cannot decide'))

    def test_clamps_confidence_out_of_range(self):
        result = parse_pick('{"home_score": 1, "away_score": 1, "confidence": 999}')
        self.assertEqual(result["confidence"], 100)
        result2 = parse_pick('{"home_score": 1, "away_score": 1, "confidence": -5}')
        self.assertEqual(result2["confidence"], 0)


class DecidePickTest(unittest.TestCase):
    def test_returns_parsed_pick_from_llm(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value='{"home_score": 3, "away_score": 0, "confidence": 80}'):
            result = decide_pick(context)
        self.assertEqual(result, {"home_score": 3, "away_score": 0, "confidence": 80})

    def test_returns_none_when_llm_unparseable(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value="no idea"):
            result = decide_pick(context)
        self.assertIsNone(result)

    def test_returns_none_when_llm_unavailable(self):
        context = {"match": {"id": "m1"}, "teams": {}}
        with patch("app.picks.picker._call_llm", return_value=None):
            result = decide_pick(context)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent-service && python -m unittest tests.test_picker -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.picks'`

- [ ] **Step 3: Create package marker**

Tạo `agent-service/app/picks/__init__.py` (file rỗng — chỉ cần tồn tại).

- [ ] **Step 4: Write picker implementation**

Tạo `agent-service/app/picks/picker.py`:

```python
import json
import re
from typing import Any

from app.graph.nodes import _call_llm


def parse_pick(raw: str | None) -> dict[str, int] | None:
    if not raw:
        return None
    match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except (ValueError, TypeError):
        return None

    home = data.get("home_score")
    away = data.get("away_score")
    confidence = data.get("confidence")
    if not _is_non_negative_int(home) or not _is_non_negative_int(away):
        return None
    if not isinstance(confidence, int) or isinstance(confidence, bool):
        return None

    return {
        "home_score": home,
        "away_score": away,
        "confidence": max(0, min(100, confidence)),
    }


def decide_pick(context: dict[str, Any]) -> dict[str, int] | None:
    prompt = _build_pick_prompt(context)
    raw = _call_llm(prompt)
    return parse_pick(raw)


def _is_non_negative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _build_pick_prompt(context: dict[str, Any]) -> str:
    return "\n".join(
        [
            "You are a World Cup match predictor. Predict the exact final score.",
            "Consider FIFA rank, recent form, and any provided signals.",
            "Respond with ONLY a JSON object, no prose:",
            '{"home_score": <int>, "away_score": <int>, "confidence": <int 0-100>}',
            f"Match context: {json.dumps(context, default=str)[:6000]}",
        ]
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent-service && python -m unittest tests.test_picker -v`
Expected: PASS (10 tests)

- [ ] **Step 6: Commit**

```bash
git add agent-service/app/picks/__init__.py agent-service/app/picks/picker.py agent-service/tests/test_picker.py
git commit -m "feat: add agent score picker with LLM and validation"
```

---

## Task 4: Prediction tools (query + submit)

**Files:**
- Create: `agent-service/app/tools/prediction_tools.py`
- Test: `agent-service/tests/test_prediction_tools.py`

- [ ] **Step 1: Write the failing test**

Tạo `agent-service/tests/test_prediction_tools.py`:

```python
import unittest
from unittest.mock import MagicMock, patch

from app.tools.prediction_tools import list_unpicked_matches, derive_outcome


class DeriveOutcomeTest(unittest.TestCase):
    def test_home_win(self):
        self.assertEqual(derive_outcome(2, 1), "home")

    def test_away_win(self):
        self.assertEqual(derive_outcome(0, 3), "away")

    def test_draw(self):
        self.assertEqual(derive_outcome(1, 1), "draw")


class ListUnpickedMatchesTest(unittest.TestCase):
    def test_filters_out_already_picked_matches(self):
        client = MagicMock()

        # matches query chain returns 3 open matches
        matches_data = [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}]
        predictions_data = [{"match_id": "m2"}]

        def table_side_effect(name):
            tbl = MagicMock()
            if name == "matches":
                tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.execute.return_value.data = matches_data
            elif name == "predictions":
                tbl.select.return_value.eq.return_value.execute.return_value.data = predictions_data
            return tbl

        client.table.side_effect = table_side_effect

        result = list_unpicked_matches(client, "agent-user-id", window_hours=48, limit=10)
        ids = [m["id"] for m in result]
        self.assertEqual(ids, ["m1", "m3"])

    def test_respects_limit(self):
        client = MagicMock()
        matches_data = [{"id": f"m{i}"} for i in range(20)]

        def table_side_effect(name):
            tbl = MagicMock()
            if name == "matches":
                tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.execute.return_value.data = matches_data
            elif name == "predictions":
                tbl.select.return_value.eq.return_value.execute.return_value.data = []
            return tbl

        client.table.side_effect = table_side_effect

        result = list_unpicked_matches(client, "agent-user-id", window_hours=48, limit=5)
        self.assertEqual(len(result), 5)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent-service && python -m unittest tests.test_prediction_tools -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.tools.prediction_tools'`

- [ ] **Step 3: Write implementation**

Tạo `agent-service/app/tools/prediction_tools.py`:

```python
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.settings import get_settings


def derive_outcome(home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return "home"
    if home_score < away_score:
        return "away"
    return "draw"


def list_unpicked_matches(client: Any, agent_user_id: str, window_hours: int, limit: int) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    upper = now + timedelta(hours=window_hours)

    matches_resp = (
        client.table("matches")
        .select("id, home_team_id, away_team_id, lock_at, stage")
        .eq("status", "open")
        .gte("lock_at", now.isoformat())
        .lte("lock_at", upper.isoformat())
        .order("lock_at", desc=False)
        .execute()
    )
    matches = matches_resp.data or []

    picked_resp = (
        client.table("predictions")
        .select("match_id")
        .eq("user_id", agent_user_id)
        .execute()
    )
    picked_ids = {row["match_id"] for row in (picked_resp.data or [])}

    unpicked = [m for m in matches if m["id"] not in picked_ids]
    return unpicked[:limit]


def submit_agent_prediction(access_token: str, match_id: str, home_score: int, away_score: int, confidence: int) -> httpx.Response:
    settings = get_settings()
    url = f"{settings.supabase_url}/functions/v1/submit_prediction"
    payload = {
        "matchId": match_id,
        "predictionType": "exact_score",
        "homeScore": home_score,
        "awayScore": away_score,
        "predictedOutcome": derive_outcome(home_score, away_score),
        "confidence": confidence,
        "isRiskPick": False,
    }
    with httpx.Client(timeout=30, trust_env=False) as http:
        return http.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent-service && python -m unittest tests.test_prediction_tools -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add agent-service/app/tools/prediction_tools.py agent-service/tests/test_prediction_tools.py
git commit -m "feat: add prediction query and submit tools"
```

---

## Task 5: Runner (orchestrate một lần cron)

**Files:**
- Create: `agent-service/app/picks/runner.py`
- Test: `agent-service/tests/test_runner.py`

- [ ] **Step 1: Write the failing test**

Tạo `agent-service/tests/test_runner.py`:

```python
import types
import unittest
from unittest.mock import patch

from app.picks.runner import run_agent_picks


class RunAgentPicksTest(unittest.IsolatedAsyncioTestCase):
    async def test_picks_unpicked_matches_and_counts_results(self):
        matches = [{"id": "m1", "home_team_id": "A", "away_team_id": "B"}]

        def fake_get_user(decoded):
            return types.SimpleNamespace(user=types.SimpleNamespace(id="agent-id"))

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent-service && python -m unittest tests.test_runner -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.picks.runner'`

- [ ] **Step 3: Write implementation**

Tạo `agent-service/app/picks/runner.py`:

```python
import logging
from typing import Any

from supabase import create_client

from app.agent_account import sign_in_agent
from app.picks.picker import decide_pick
from app.settings import get_settings
from app.tools.football_tools import gather_match_context
from app.tools.prediction_tools import list_unpicked_matches, submit_agent_prediction
from app.tools.supabase_tools import get_user_supabase_client

logger = logging.getLogger(__name__)


def get_agent_user_id(access_token: str) -> str:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.get_user(access_token)
    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise RuntimeError("Could not resolve agent user id")
    return user_id


async def run_agent_picks() -> dict[str, Any]:
    settings = get_settings()
    token = sign_in_agent()
    agent_user_id = get_agent_user_id(token)
    client = get_user_supabase_client(token)

    matches = list_unpicked_matches(
        client,
        agent_user_id,
        window_hours=settings.agent_pick_window_hours,
        limit=settings.agent_pick_batch_limit,
    )

    picked = 0
    skipped = 0
    errors: list[str] = []

    for match in matches:
        try:
            context, _ = await gather_match_context(match["id"], agent_user_id, token, include_user=False)
            pick = decide_pick(context)
            if pick is None:
                skipped += 1
                logger.warning("Agent could not decide a pick for match %s", match["id"])
                continue

            response = submit_agent_prediction(
                token,
                match["id"],
                pick["home_score"],
                pick["away_score"],
                pick["confidence"],
            )
            if response.status_code == 200:
                picked += 1
            elif response.status_code == 429:
                logger.warning("Agent hit rate limit; stopping this run")
                break
            elif response.status_code == 409:
                skipped += 1
                logger.info("Match %s already locked; skipping", match["id"])
            else:
                skipped += 1
                errors.append(f"{match['id']}: HTTP {response.status_code}")
        except Exception as exc:
            skipped += 1
            errors.append(f"{match['id']}: {exc}")
            logger.warning("Agent pick failed for match %s", match["id"], exc_info=True)

    return {"picked": picked, "skipped": skipped, "errors": errors}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent-service && python -m unittest tests.test_runner -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add agent-service/app/picks/runner.py agent-service/tests/test_runner.py
git commit -m "feat: add agent picks runner"
```

---

## Task 6: Cron endpoint + secret auth

**Files:**
- Modify: `agent-service/app/api/routes.py`
- Test: `agent-service/tests/test_cron_auth.py`

Endpoint nhận **cả GET lẫn POST**, secret chấp nhận ở header `x-cron-secret` HOẶC query param `?secret=` — để dùng được với UptimeRobot free (GET + query) lẫn Render Cron / cron-job.org (POST + header).

- [ ] **Step 1: Write the failing test**

Tạo `agent-service/tests/test_cron_auth.py`:

```python
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


def _async_return(value):
    async def _fn(*args, **kwargs):
        return value
    return _fn


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent-service && python -m unittest tests.test_cron_auth -v`
Expected: FAIL — 404 (route chưa tồn tại) hoặc ImportError `run_agent_picks`

- [ ] **Step 3: Add cron route**

Sửa `agent-service/app/api/routes.py`. Thêm imports ở đầu file (sau các import hiện có):

```python
import secrets

from fastapi import Header, Query

from app.picks.runner import run_agent_picks
from app.settings import get_settings
```

Thêm route mới (sau route `/agent/chat`):

```python
async def _run_cron_picks(x_cron_secret: str | None, secret: str | None) -> dict:
    settings = get_settings()
    expected = settings.cron_secret
    provided = x_cron_secret or secret
    if not expected or not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")
    return await run_agent_picks()


@router.post("/cron/run-agent-picks")
async def cron_run_agent_picks_post(
    x_cron_secret: str | None = Header(default=None),
    secret: str | None = Query(default=None),
) -> dict:
    return await _run_cron_picks(x_cron_secret, secret)


@router.get("/cron/run-agent-picks")
async def cron_run_agent_picks_get(
    x_cron_secret: str | None = Header(default=None),
    secret: str | None = Query(default=None),
) -> dict:
    return await _run_cron_picks(x_cron_secret, secret)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent-service && python -m unittest tests.test_cron_auth -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add agent-service/app/api/routes.py agent-service/tests/test_cron_auth.py
git commit -m "feat: add cron endpoint for agent picks"
```

---

## Task 7: Cập nhật .env.example + chạy full suite

**Files:**
- Modify: `agent-service/.env.example`

- [ ] **Step 1: Thêm env mới vào .env.example**

Sửa `agent-service/.env.example`, thêm các dòng sau (sau `AGENT_ALLOWED_ORIGIN`):

```env
AGENT_EMAIL=
AGENT_PASSWORD=
CRON_SECRET=
AGENT_PICK_WINDOW_HOURS=48
AGENT_PICK_BATCH_LIMIT=10
```

- [ ] **Step 2: Chạy toàn bộ backend test**

Run: `cd agent-service && python -m unittest discover -s tests`
Expected: OK — tất cả test pass (gồm 7 cũ + các test mới)

- [ ] **Step 3: Verify compile toàn bộ app**

Run: `cd agent-service && python -m compileall -q app/ && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add agent-service/.env.example
git commit -m "docs: document agent pick env vars"
```

---

## Sau khi implement: deploy & vận hành (thủ công, ngoài code)

1. **Tạo account agent:** đăng ký 1 account qua app (email riêng vd `ai-oracle@...`, tên hiển thị mong muốn).
2. **Set env trên Render:** `AGENT_EMAIL`, `AGENT_PASSWORD`, `CRON_SECRET` (chuỗi ngẫu nhiên), tùy chọn `AGENT_PICK_WINDOW_HOURS`/`AGENT_PICK_BATCH_LIMIT`.
3. **UptimeRobot (free):** thêm monitor HTTP(s) kiểu GET tới `https://we-speak-football-agent.onrender.com/cron/run-agent-picks?secret=<CRON_SECRET>`, interval ~30 phút. (Hoặc Render Cron / cron-job.org dùng POST + header `x-cron-secret`.)
4. **Test thủ công:** `curl ".../cron/run-agent-picks?secret=<SECRET>"` → kỳ vọng JSON `{"picked":..,"skipped":..,"errors":[]}`.
