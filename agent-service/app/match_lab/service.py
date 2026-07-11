import json
import secrets
from datetime import datetime, timezone
from typing import Any

from app.match_lab.resolver import resolve_match
from app.match_lab.rules import FORMATIONS, validate_xi
from app.tools.supabase_tools import get_service_supabase_client, get_user_supabase_client

BOT_RECIPES = {
    "starter": {"formation": "4-3-3", "ovr_band": "50-68", "identity": "Balanced basics"},
    "pressing-academy": {"formation": "4-2-3-1", "ovr_band": "68-84", "identity": "High pressure"},
    "defensive-wall": {"formation": "3-5-2", "ovr_band": "76-91", "identity": "Compact block"},
}


def list_bots() -> list[dict[str, str]]:
    return [{"id": bot_id, **recipe} for bot_id, recipe in BOT_RECIPES.items()]


def _profile(catalog: dict[str, Any], key: str = "raw_stats") -> dict[str, Any] | None:
    value = catalog.get("player_card_gameplay_profiles")
    if isinstance(value, list):
        value = value[0] if value else None
    profile = value.get(key) if isinstance(value, dict) else None
    return profile if isinstance(profile, dict) else None


def _matches_ovr_band(stats: dict[str, Any], band: str) -> bool:
    try:
        minimum, maximum = (int(value) for value in band.split("-", 1))
    except (TypeError, ValueError):
        return False
    ovr = stats.get("OVR")
    return isinstance(ovr, (int, float)) and not isinstance(ovr, bool) and minimum <= ovr <= maximum


def sanitize_xi(xi: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: card[key] for key in ("slot_id", "card_id", "owned_card_id", "position", "rarity") if key in card} for card in xi]


def _owned_xi(access_token: str, user_id: str, formation: str, selections: list[dict[str, str]]) -> list[dict[str, Any]]:
    client = get_user_supabase_client(access_token)
    owned_ids = [selection["owned_card_id"] for selection in selections]
    response = client.table("user_player_cards").select("id,card_id,player_cards(id,position,alternate_positions,rarity,player_card_gameplay_profiles(raw_stats, effective_stats))").eq("user_id", user_id).in_("id", owned_ids).execute()
    cards = {row["id"]: row for row in response.data or []}
    xi = []
    for selection in selections:
        owned = cards.get(selection["owned_card_id"])
        catalog = owned and owned.get("player_cards")
        raw_stats = _profile(catalog) if catalog else None
        effective_stats = _profile(catalog, "effective_stats") if catalog else None
        if not owned or not catalog or not raw_stats:
            raise ValueError("Every selected card must be owned and have a gameplay profile.")
        xi.append({
            "slot_id": selection["slot_id"],
            "owned_card_id": owned["id"],
            "card_id": owned["card_id"],
            "position": catalog["position"],
            "alternate_positions": catalog.get("alternate_positions") or [],
            "profile": raw_stats,
            "stats": effective_stats or raw_stats,
            "effective_stats": effective_stats,
            "rarity": catalog["rarity"],
        })
    validated = validate_xi(formation, xi)
    if not validated:
        raise ValueError("Select one eligible, distinct card for every formation slot.")
    return validated


def _bot_xi(access_token: str, bot_id: str) -> list[dict[str, Any]]:
    recipe = BOT_RECIPES.get(bot_id)
    if not recipe:
        raise ValueError("Unknown Match Lab bot.")
    client = get_user_supabase_client(access_token)
    slots = FORMATIONS[recipe["formation"]]
    response = client.table("player_cards").select("id,position,alternate_positions,rarity,player_card_gameplay_profiles(raw_stats, effective_stats)").limit(500).execute()
    cards = response.data or []
    selected: list[dict[str, Any]] = []
    used = set()
    for slot_id, position in slots.items():
        card = None
        effective_stats = None
        for candidate in cards:
            effective_stats = _profile(candidate, "effective_stats")
            if candidate["id"] not in used and position in {item.strip() for item in [candidate["position"], *(candidate.get("alternate_positions") or "").split(",")]} and effective_stats and _matches_ovr_band(effective_stats, recipe["ovr_band"]):
                card = candidate
                break
        if not card or not effective_stats:
            raise RuntimeError("Match Lab bot roster is not configured.")
        raw_stats = _profile(card)
        if not raw_stats:
            raise RuntimeError("Match Lab bot roster is not configured.")
        used.add(card["id"])
        selected.append({"slot_id": slot_id, "card_id": card["id"], "position": card["position"], "stats": effective_stats, "effective_stats": effective_stats, "rarity": card["rarity"]})
    return selected


def run_match_lab(access_token: str, user_id: str, formation: str, bot_id: str, selections: list[dict[str, str]], debug: bool) -> dict[str, Any]:
    player_xi = _owned_xi(access_token, user_id, formation, selections)
    bot_xi = _bot_xi(access_token, bot_id)
    seed = secrets.token_urlsafe(16)
    result = resolve_match(seed, player_xi, bot_xi, 12)
    report = {"score": result["score"], "timeline": result["timeline"], "metrics": {"hotspots": len(result["timeline"])} }
    report_text = json.dumps(report, separators=(",", ":"))
    if len(report_text.encode()) > 25600:
        raise RuntimeError("Match Lab report exceeded its storage limit.")
    service = get_service_supabase_client()
    response = service.table("match_lab_runs").insert({
        "user_id": user_id,
        "status": "completed",
        "formation": formation,
        "bot_id": bot_id,
        "player_squad": [{"slot_id": card["slot_id"], "card_id": card["card_id"]} for card in player_xi],
        "bot_squad": [{"slot_id": card["slot_id"], "card_id": card["card_id"]} for card in bot_xi],
        "seed": seed,
        "hotspot_index": len(result["timeline"]),
        "home_score": result["score"]["home"],
        "away_score": result["score"]["away"],
        "broadcast_timeline": result["timeline"],
        "final_report": report,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).select("id").single().execute()
    debug_payload = None
    if debug:
        debug_payload = {"hotspots": len(result["timeline"]), "action_source": "deterministic", "strengths": {side: {event: round(value, 3) for event, value in events.items()} for side, events in result["strengths"].items()}}
    return {
        "id": response.data["id"],
        "status": "completed",
        "formation": formation,
        "bot_id": bot_id,
        "player_xi": sanitize_xi(player_xi),
        "bot_xi": sanitize_xi(bot_xi),
        "score": result["score"],
        "timeline": result["timeline"],
        "debug": debug_payload,
    }
