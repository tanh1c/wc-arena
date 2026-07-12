import hashlib
import random
from collections.abc import Iterable
from time import perf_counter
from typing import Any

from app.match_lab.actions import ProviderActionError, decide_action

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
POSITION_EVENT_WEIGHTS = {
    "possession": {"GK": 0.10, "DEF": 0.25, "MID": 0.40, "FWD": 0.25},
    "pass": {"GK": 0.10, "DEF": 0.25, "MID": 0.40, "FWD": 0.25},
    "dribble": {"GK": 0.05, "DEF": 0.20, "MID": 0.35, "FWD": 0.40},
    "shot": {"GK": 0.05, "DEF": 0.15, "MID": 0.30, "FWD": 0.50},
    "save": {"GK": 0.70, "DEF": 0.25, "MID": 0.05, "FWD": 0.0},
}


def _position_group(position: Any) -> str:
    if position == "GK":
        return "GK"
    if position in {"CB", "LB", "RB", "LWB", "RWB"}:
        return "DEF"
    if position in {"CDM", "CM", "CAM", "LM", "RM"}:
        return "MID"
    return "FWD"


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
        weights = POSITION_EVENT_WEIGHTS[event_type]
        weighted_cards = [(card, weights[_position_group(card.get("position"))]) for card in cards]
        total_weight = sum(weight for _, weight in weighted_cards)
        if not total_weight:
            return 0.5
        return sum(_card_strength(card, event_type, reference_profiles) * weight for card, weight in weighted_cards) / total_weight

    return {
        "home": {event_type: average(home_xi, event_type) for event_type in EVENT_STATS},
        "away": {event_type: average(away_xi, event_type) for event_type in EVENT_STATS},
    }


def _pick_side(randomizer: random.Random, home_strength: float, away_strength: float) -> str:
    total = home_strength + away_strength
    return "home" if total <= 0 or randomizer.random() < home_strength / total else "away"


def _success(randomizer: random.Random, attack: float, defence: float, risk: int) -> bool:
    chance = max(0.05, min(0.95, 0.35 + attack * 0.55 - defence * 0.3 - risk / 900))
    return randomizer.random() < chance


def _summary(side: str, event_type: str, actor_slot: str) -> str:
    return f"{side.title()} {event_type} by {actor_slot.upper()}"


def _slots(cards: list[dict[str, Any]], excluded: set[str] | None = None, limit: int = 2) -> list[str]:
    excluded = excluded or set()
    slots = []
    for card in cards:
        slot = card.get("slot_id")
        if isinstance(slot, str) and slot and slot not in excluded and slot not in slots:
            slots.append(slot)
        if len(slots) == limit:
            break
    return slots


def _local_actors(squad: list[dict[str, Any]], opponent_squad: list[dict[str, Any]], actor_slot: str) -> dict[str, Any]:
    return {"carrier": actor_slot, "support": _slots(squad, {actor_slot}), "opponents": _slots(opponent_squad)}


class MatchPausedError(RuntimeError):
    def __init__(self, result: dict[str, Any]):
        super().__init__("Match Lab model is unavailable.")
        self.result = result


def resolve_match(
    seed: str,
    home_xi: list[dict[str, Any]],
    away_xi: list[dict[str, Any]],
    hotspots: int = 12,
    reference_profiles: list[dict[str, Any]] | None = None,
    coach_intents: dict[str, str] | None = None,
    debug: bool = False,
    start_index: int = 0,
    initial_score: dict[str, int] | None = None,
    initial_timeline: list[dict[str, Any]] | None = None,
    initial_action_sources: dict[str, int] | None = None,
    end_index: int | None = None,
) -> dict[str, Any]:
    count = max(10, min(14, hotspots))
    strengths = resolve_team_strengths(home_xi, away_xi, reference_profiles)
    squads = {"home": home_xi, "away": away_xi}
    coach_intents = coach_intents or {}
    score = dict(initial_score or {"home": 0, "away": 0})
    timeline = list(initial_timeline or [])
    hotspot_summaries = []
    action_sources = {"llm": 0, "retried": 0, "fallback": 0, **(initial_action_sources or {})}

    for index in range(start_index, max(start_index, min(count, end_index if end_index is not None else count))):
        randomizer = random.Random(int(hashlib.sha256(f"{seed}:{index}".encode()).hexdigest(), 16))
        side = _pick_side(randomizer, strengths["home"]["possession"], strengths["away"]["possession"])
        opponents = "away" if side == "home" else "home"
        squad = squads[side]
        actor = squad[randomizer.randrange(len(squad))]
        actor_slot = actor.get("slot_id", "player")
        local_actors = _local_actors(squad, squads[opponents], actor_slot)
        snapshot = {
            "minute": min(90, 5 + index * 8),
            "side": side,
            "score": score,
            "actor": {"slot_id": actor_slot, "position": actor.get("position")},
            "coach_intent": coach_intents.get(side, "keep shape and choose safe progression"),
            "local_actors": local_actors,
            "recent_events": [event["type"] for event in timeline[-3:]],
        }
        target_slots = set(local_actors["support"])
        if target_slots:
            started = perf_counter()
            try:
                action, source = decide_action(snapshot, actor_slot, target_slots)
            except ProviderActionError as exc:
                raise MatchPausedError({"score": score, "timeline": timeline, "strengths": strengths, "action_sources": action_sources, "hotspot_index": index}) from exc
            latency_ms = round((perf_counter() - started) * 1000)
        else:
            action, source, latency_ms = {"action": "pass", "actor_slot": actor_slot, "target_slot": "", "risk": 20}, "fallback", 0
        action_sources[source] += 1
        action_type = action["action"]

        if action_type == "shoot":
            attack = strengths[side]["shot"]
            defence = strengths[opponents]["save"]
            if _success(randomizer, attack, defence, action["risk"]):
                event_type = "goal"
                score[side] += 1
            else:
                event_type = "save"
        else:
            defence = strengths[opponents]["possession"]
            if _success(randomizer, strengths[side][action_type], defence, action["risk"]):
                event_type = action_type
            else:
                event_type = "possession"
        timeline.append({"minute": snapshot["minute"], "type": event_type, "side": side, "score": dict(score), "summary": _summary(side, event_type, actor_slot)})
        if debug:
            hotspot_summaries.append({
                "minute": snapshot["minute"],
                "side": side,
                "coach_intent": snapshot["coach_intent"],
                "local_actors": local_actors,
                "action": {"type": action_type, "target_slot": action["target_slot"], "risk": action["risk"], "source": source},
                "outcome": {"type": event_type, "score": dict(score)},
                "latency_ms": latency_ms,
            })

    result = {"score": score, "timeline": timeline, "strengths": strengths, "action_sources": action_sources}
    if debug:
        result["hotspot_summaries"] = hotspot_summaries
    return result
