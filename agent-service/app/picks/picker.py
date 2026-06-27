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
            "The match object in context is the only match you may predict; its id is the canonical match_id used for submission.",
            "Map every team-name matchup back to that canonical match_id before reasoning. Do not invent or change the match_id, and do not answer for a different fixture.",
            "Respond with ONLY a JSON object, no prose:",
            '{"home_score": <int>, "away_score": <int>, "confidence": <int 0-100>}',
            f"Match context: {json.dumps(context, default=str)[:6000]}",
        ]
    )
