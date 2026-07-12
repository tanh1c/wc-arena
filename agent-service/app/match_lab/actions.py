import json
import logging
from time import perf_counter
from typing import Any

import httpx

from app.settings import get_settings

ALLOWED_ACTIONS = {"pass", "dribble", "shoot"}
ACTION_TIMEOUT_SECONDS = 8
logger = logging.getLogger(__name__)


class ProviderActionError(RuntimeError):
    pass


class _MatchLabLLMError(RuntimeError):
    def __init__(self, safe_fields: dict[str, str]):
        super().__init__("LLM call failed")
        self.safe_fields = safe_fields


def _safe_error_fields(exc: RuntimeError) -> dict[str, str]:
    cause = exc.__cause__
    exception_class = type(cause).__name__ if cause else type(exc).__name__
    status_code = getattr(cause, "status_code", None)
    if status_code == 429:
        category = "rate_limit"
    elif isinstance(cause, TimeoutError) or "timeout" in exception_class.lower():
        category = "timeout"
    elif isinstance(status_code, int) and 400 <= status_code < 500:
        category = "client_error"
    else:
        category = "provider_error"
    return {"category": category, "exception_class": exception_class}


def _call_llm_with_deadline(
    prompt: str,
    deadline_seconds: float = ACTION_TIMEOUT_SECONDS,
) -> str | None:
    settings = get_settings()
    api_key = settings.llm_api_key or settings.openai_api_key
    if not api_key or not settings.llm_base_url:
        return None

    try:
        with httpx.Client(timeout=deadline_seconds, trust_env=False) as client:
            response = client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": settings.llm_model or "gpt-4.1-mini",
                    "temperature": 0.3,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
    except httpx.TimeoutException as exc:
        raise _MatchLabLLMError({"category": "timeout", "exception_class": type(exc).__name__}) from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        category = "rate_limit" if status_code == 429 else "client_error" if 400 <= status_code < 500 else "provider_error"
        raise _MatchLabLLMError({"category": category, "exception_class": type(exc).__name__}) from exc
    except (httpx.RequestError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise _MatchLabLLMError({"category": "provider_error", "exception_class": type(exc).__name__}) from exc
    return content if isinstance(content, str) else None


def _log_action_attempt(event: str, **fields: Any) -> None:
    logger.info("match_lab_action %s %s", event, json.dumps(fields))
    for handler in logging.getLogger().handlers:
        handler.flush()


def _provider_error_fields(exc: RuntimeError) -> dict[str, str]:
    if isinstance(exc, _MatchLabLLMError):
        return exc.safe_fields
    return _safe_error_fields(exc)


def decide_action(snapshot: dict[str, Any], actor_slot: str, local_slots: set[str]) -> tuple[dict[str, Any], str]:
    prompt = "\n".join([
        "Choose one legal football action for this Match Lab highlight.",
        "Return ONLY JSON with exactly action, actor_slot, target_slot, risk.",
        "action is pass, dribble, or shoot; risk is an integer from 0 to 90.",
        f"Required actor slot: {actor_slot}",
        f"Allowed target slots: {sorted(local_slots)}",
        f"Safe match snapshot: {json.dumps(snapshot, separators=(',', ':'))}",
    ])
    provider_failures = 0
    read_timeout_failures = 0
    for attempt in range(2):
        started = perf_counter()
        try:
            action = parse_action(
                _call_llm_with_deadline(prompt),
                local_slots,
                actor_slot,
            )
        except RuntimeError as exc:
            provider_failures += 1
            fields = _provider_error_fields(exc)
            read_timeout_failures += fields == {"category": "timeout", "exception_class": "ReadTimeout"}
            _log_action_attempt(
                "attempt_failed",
                attempt=attempt + 1,
                elapsed_ms=round((perf_counter() - started) * 1000),
                timeout_seconds=ACTION_TIMEOUT_SECONDS,
                **fields,
            )
            continue
        if action:
            return action, "llm" if attempt == 0 else "retried"
        _log_action_attempt(
            "parse_error",
            attempt=attempt + 1,
            elapsed_ms=round((perf_counter() - started) * 1000),
            timeout_seconds=ACTION_TIMEOUT_SECONDS,
        )
    if provider_failures == 2 and read_timeout_failures != 2:
        raise ProviderActionError("Match Lab model is unavailable.")
    return {"action": "pass", "actor_slot": actor_slot, "target_slot": sorted(slot for slot in local_slots if slot != actor_slot)[0], "risk": 20}, "fallback"


def parse_action(raw: str | None, local_slots: set[str], required_actor: str) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        action = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(action, dict) or set(action) != {"action", "actor_slot", "target_slot", "risk"}:
        return None
    if action["action"] not in ALLOWED_ACTIONS or action["actor_slot"] != required_actor:
        return None
    if not isinstance(action["target_slot"], str) or action["target_slot"] not in local_slots or action["target_slot"] == required_actor:
        return None
    if not isinstance(action["risk"], int) or isinstance(action["risk"], bool) or not 0 <= action["risk"] <= 90:
        return None
    return action
