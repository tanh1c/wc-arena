import json
from typing import Any

from app.graph.nodes import _call_llm

ALLOWED_ACTIONS = {"pass", "dribble", "shoot"}


class ProviderActionError(RuntimeError):
    pass


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
        try:
            action = parse_action(_call_llm(prompt, timeout=5, max_retries=0), local_slots, actor_slot)
        except RuntimeError:
            provider_failures += 1
            continue
        if action:
            return action, "llm" if attempt == 0 else "retried"
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
