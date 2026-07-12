import json
import logging
from time import perf_counter
from typing import Any

from app.graph.nodes import _call_llm

ALLOWED_ACTIONS = {"pass", "dribble", "shoot"}
ACTION_TIMEOUT_SECONDS = 5
logger = logging.getLogger(__name__)


class ProviderActionError(RuntimeError):
    pass


def _log_action_attempt(event: str, **fields: Any) -> None:
    logger.info("match_lab_action %s %s", event, json.dumps(fields))
    for handler in logging.getLogger().handlers:
        handler.flush()


def _provider_error_fields(exc: RuntimeError) -> dict[str, str]:
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
    for attempt in range(2):
        started = perf_counter()
        try:
            action = parse_action(
                _call_llm(prompt, timeout=ACTION_TIMEOUT_SECONDS, max_retries=0),
                local_slots,
                actor_slot,
            )
        except RuntimeError as exc:
            provider_failures += 1
            _log_action_attempt(
                "attempt_failed",
                attempt=attempt + 1,
                elapsed_ms=round((perf_counter() - started) * 1000),
                timeout_seconds=ACTION_TIMEOUT_SECONDS,
                **_provider_error_fields(exc),
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
    if provider_failures == 2:
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
