import hashlib
import random
from collections.abc import Iterable
from typing import Any

EVENT_TYPES = ("possession", "pass", "dribble", "shot", "save", "goal")
RARITY_MODIFIERS = {
    "Common": 0.0,
    "Uncommon": 0.005,
    "Rare": 0.01,
    "Epic": 0.015,
    "Legendary": 0.02,
    "Heroes": 0.025,
    "Icon": 0.03,
    "GOAT": 0.035,
}
EVENT_STATS = {
    "possession": (("Short Passing", "PAS"), ("Vision", "PAS"), ("Ball Control", "DRI"), ("PHY",)),
    "pass": (("Short Passing", "PAS"), ("Long Passing", "PAS"), ("Vision", "PAS"), ("Crossing", "PAS")),
    "dribble": (("Dribbling", "DRI"), ("Agility", "DRI"), ("Balance", "DRI"), ("Ball Control", "DRI"), ("Acceleration", "PAC"), ("Sprint Speed", "PAC")),
    "shot": (("Finishing", "SHO"), ("Shot Power", "SHO"), ("Long Shot", "SHO"), ("Volleys", "SHO"), ("Penalties", "SHO")),
    "save": (("GK Reflexes", "DEF", "OVR"), ("GK Diving", "DEF", "OVR"), ("GK Handling", "DEF", "OVR"), ("Positioning", "DEF", "OVR")),
}


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and value == value and value not in (float("inf"), float("-inf")):
        return float(value)
    return None


def rarity_modifier(rarity: Any) -> float:
    return RARITY_MODIFIERS.get(rarity, 0.0)


def _stat(card: dict[str, Any], names: Iterable[str]) -> tuple[str, float]:
    stats = card.get("stats") if isinstance(card.get("stats"), dict) else {}
    for name in names:
        value = _number(stats.get(name))
        if value is not None:
            return name, max(0.0, min(100.0, value))
    return next(iter(names)), 50.0


def _percentiles(reference_profiles: list[dict[str, Any]], names: Iterable[str]) -> tuple[str, float, float]:
    names = tuple(names)
    values = []
    selected_name = names[0]
    for profile in reference_profiles:
        if not isinstance(profile, dict):
            continue
        for name in names:
            value = _number(profile.get(name))
            if value is not None:
                selected_name = name
                values.append(max(0.0, min(100.0, value)))
                break
    if not values:
        return selected_name, 0.0, 100.0
    return selected_name, min(values), max(values)


def _normalized_card_stat(card: dict[str, Any], reference_profiles: list[dict[str, Any]], names: Iterable[str]) -> float:
    names = tuple(names)
    _, value = _stat(card, names)
    _, minimum, maximum = _percentiles(reference_profiles, names)
    if maximum == minimum:
        return 0.5
    return max(0.0, min(1.0, (value - minimum) / (maximum - minimum)))


def _card_strength(card: dict[str, Any], event_type: str, reference_profiles: list[dict[str, Any]]) -> float:
    stat_groups = EVENT_STATS[event_type]
    if isinstance(card.get("effective_stats"), dict):
        effective_card = {**card, "stats": card["effective_stats"]}
        return sum(_stat(effective_card, names)[1] / 100 for names in stat_groups) / len(stat_groups)
    # ponytail: remove the legacy raw-stat fallback after every environment applies the effective-stats migration.
    value = sum(_normalized_card_stat(card, reference_profiles, names) for names in stat_groups) / len(stat_groups)
    return max(0.0, min(1.0, value + rarity_modifier(card.get("rarity"))))


def resolve_team_strengths(
    home_xi: list[dict[str, Any]],
    away_xi: list[dict[str, Any]],
    reference_profiles: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, float]]:
    reference_profiles = reference_profiles or [card.get("stats", {}) for card in home_xi + away_xi]

    def average(cards: list[dict[str, Any]], event_type: str) -> float:
        if not cards:
            return 0.5
        return sum(_card_strength(card, event_type, reference_profiles) for card in cards) / len(cards)

    return {
        "home": {event_type: average(home_xi, event_type) for event_type in EVENT_STATS},
        "away": {event_type: average(away_xi, event_type) for event_type in EVENT_STATS},
    }


def _pick_side(randomizer: random.Random, home_strength: float, away_strength: float) -> str:
    total = home_strength + away_strength
    return "home" if total <= 0 or randomizer.random() < home_strength / total else "away"


def resolve_match(
    seed: str,
    home_xi: list[dict[str, Any]],
    away_xi: list[dict[str, Any]],
    hotspots: int = 12,
    reference_profiles: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    randomizer = random.Random(int(hashlib.sha256(seed.encode()).hexdigest(), 16))
    count = max(10, min(14, hotspots))
    strengths = resolve_team_strengths(home_xi, away_xi, reference_profiles)
    home_score = 0
    away_score = 0
    timeline = []

    for index in range(count):
        event_type = EVENT_TYPES[randomizer.randrange(len(EVENT_TYPES))]
        if event_type == "goal":
            home_attack = strengths["home"]["shot"]
            away_attack = strengths["away"]["shot"]
            home_goal = max(0.0, home_attack - strengths["away"]["save"] * 0.65)
            away_goal = max(0.0, away_attack - strengths["home"]["save"] * 0.65)
            side = _pick_side(randomizer, home_goal, away_goal)
            if (home_goal if side == "home" else away_goal) >= randomizer.random():
                if side == "home":
                    home_score += 1
                else:
                    away_score += 1
            else:
                event_type = "save"
        else:
            side = _pick_side(randomizer, strengths["home"][event_type], strengths["away"][event_type])
        timeline.append({"minute": min(90, 5 + index * 8), "type": event_type, "side": side, "score": {"home": home_score, "away": away_score}})

    return {"score": {"home": home_score, "away": away_score}, "timeline": timeline, "strengths": strengths}
