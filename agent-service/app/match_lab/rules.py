from typing import Any

FORMATIONS = {
    "4-3-3": {"gk": "GK", "lb": "LB", "cb1": "CB", "cb2": "CB", "rb": "RB", "cm1": "CM", "cm2": "CM", "cm3": "CM", "lw": "LW", "st": "ST", "rw": "RW"},
    "4-2-3-1": {"gk": "GK", "lb": "LB", "cb1": "CB", "cb2": "CB", "rb": "RB", "cdm1": "CDM", "cdm2": "CDM", "lam": "CAM", "cam": "CAM", "ram": "CAM", "st": "ST"},
    "3-5-2": {"gk": "GK", "cb1": "CB", "cb2": "CB", "cb3": "CB", "lm": "LM", "cm1": "CM", "cam": "CAM", "cm2": "CM", "rm": "RM", "st1": "ST", "st2": "ST"},
}


def card_positions(card: dict[str, Any]) -> set[str]:
    primary = card.get("position")
    alternate = card.get("alternate_positions") or []
    if isinstance(alternate, str):
        alternate = alternate.split(",")
    return {position.strip() for position in [primary, *alternate] if isinstance(position, str) and position.strip()}


def validate_xi(formation: str, xi: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    slots = FORMATIONS.get(formation)
    if not slots or len(xi) != len(slots):
        return None
    by_slot = {card.get("slot_id"): card for card in xi}
    if set(by_slot) != set(slots):
        return None
    if len({card.get("owned_card_id") for card in xi}) != len(xi) or len({card.get("card_id") for card in xi}) != len(xi):
        return None
    for slot_id, required_position in slots.items():
        card = by_slot[slot_id]
        if not card.get("profile") or required_position not in card_positions(card):
            return None
    return [by_slot[slot_id] for slot_id in slots]
