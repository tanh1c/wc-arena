import hashlib
import random
from typing import Any

EVENT_TYPES = ("possession", "pass", "dribble", "shot", "save", "goal")


def resolve_match(seed: str, home_xi: list[dict[str, Any]], away_xi: list[dict[str, Any]], hotspots: int = 12) -> dict[str, Any]:
    randomizer = random.Random(int(hashlib.sha256(seed.encode()).hexdigest(), 16))
    count = max(10, min(14, hotspots))
    home_score = 0
    away_score = 0
    timeline = []
    for index in range(count):
        event_type = EVENT_TYPES[randomizer.randrange(len(EVENT_TYPES))]
        side = "home" if randomizer.randrange(2) == 0 else "away"
        if event_type == "goal":
            if side == "home":
                home_score += 1
            else:
                away_score += 1
        timeline.append({"minute": min(90, 5 + index * 8), "type": event_type, "side": side, "score": {"home": home_score, "away": away_score}})
    return {"score": {"home": home_score, "away": away_score}, "timeline": timeline}
