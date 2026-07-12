import json
import secrets
from datetime import datetime, timezone
from typing import Any

from app.match_lab.resolver import MatchPausedError, resolve_match
from app.match_lab.rules import FORMATIONS, validate_xi
from app.tools.supabase_tools import get_service_supabase_client, get_user_supabase_client

BOT_RECIPES = {
    "starter": {"formation": "4-3-3", "ovr_band": "50-68", "identity": "Balanced basics"},
    "pressing-academy": {"formation": "4-2-3-1", "ovr_band": "68-84", "identity": "High pressure"},
    "defensive-wall": {"formation": "3-5-2", "ovr_band": "76-91", "identity": "Compact block"},
}
COACH_INTENTS = {
    "Balanced basics": "keep shape and choose safe progression",
    "High pressure": "press high and play forward quickly",
    "Compact block": "stay compact and counter through available outlets",
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


def sanitize_bot_preview_xi(xi: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: card[key] for key in ("slot_id", "card_id", "name", "position", "rarity", "team", "league", "nation_region", "image_url") if key in card} for card in xi]


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
        xi.append({"slot_id": selection["slot_id"], "owned_card_id": owned["id"], "card_id": owned["card_id"], "position": catalog["position"], "alternate_positions": catalog.get("alternate_positions") or [], "profile": raw_stats, "stats": effective_stats or raw_stats, "effective_stats": effective_stats, "rarity": catalog["rarity"]})
    validated = validate_xi(formation, xi)
    if not validated:
        raise ValueError("Select one eligible, distinct card for every formation slot.")
    return validated


def _bot_xi(access_token: str, bot_id: str) -> list[dict[str, Any]]:
    recipe = BOT_RECIPES.get(bot_id)
    if not recipe:
        raise ValueError("Unknown Match Lab bot.")
    client = get_user_supabase_client(access_token)
    response = client.table("player_cards").select("id,name,position,alternate_positions,rarity,team,league,nation_region,image_url,player_card_gameplay_profiles(raw_stats, effective_stats)").order("id").limit(500).execute()
    cards = response.data or []
    selected: list[dict[str, Any]] = []
    used = set()
    for slot_id, position in FORMATIONS[recipe["formation"]].items():
        card = next((candidate for candidate in cards if candidate["id"] not in used and position in {item.strip() for item in [candidate["position"], *(candidate.get("alternate_positions") or "").split(",")]} and _profile(candidate, "effective_stats") and _matches_ovr_band(_profile(candidate, "effective_stats") or {}, recipe["ovr_band"])), None)
        if not card:
            raise RuntimeError("Match Lab bot roster is not configured.")
        raw_stats, effective_stats = _profile(card), _profile(card, "effective_stats")
        if not raw_stats or not effective_stats:
            raise RuntimeError("Match Lab bot roster is not configured.")
        used.add(card["id"])
        selected.append({"slot_id": slot_id, "card_id": card["id"], "name": card.get("name"), "position": card["position"], "stats": effective_stats, "effective_stats": effective_stats, "rarity": card["rarity"], "team": card.get("team"), "league": card.get("league"), "nation_region": card.get("nation_region"), "image_url": card.get("image_url")})
    return selected


def get_bot_xi_preview(access_token: str, bot_id: str) -> dict[str, Any]:
    recipe = BOT_RECIPES.get(bot_id)
    if not recipe:
        raise ValueError("Unknown Match Lab bot.")
    return {"bot": {"id": bot_id, **recipe}, "xi": sanitize_bot_preview_xi(_bot_xi(access_token, bot_id))}


def _coach_intents(bot_id: str) -> dict[str, str]:
    return {"home": COACH_INTENTS["Balanced basics"], "away": COACH_INTENTS[BOT_RECIPES[bot_id]["identity"]]}


def _report(result: dict[str, Any]) -> dict[str, Any]:
    report = {"score": result["score"], "timeline": result["timeline"], "metrics": {"hotspots": len(result["timeline"]), "action_sources": result["action_sources"]}}
    if len(json.dumps(report, separators=(",", ":")).encode()) > 25600:
        raise RuntimeError("Match Lab report exceeded its storage limit.")
    return report


def _debug(result: dict[str, Any], enabled: bool) -> dict[str, Any] | None:
    if not enabled:
        return None
    return {"hotspots": len(result["timeline"]), "action_sources": result["action_sources"], "strengths": {side: {event: round(value, 3) for event, value in events.items()} for side, events in result["strengths"].items()}, "hotspot_summaries": result.get("hotspot_summaries", [])}


def _response(row: dict[str, Any], result: dict[str, Any], debug: bool, state: dict[str, Any]) -> dict[str, Any]:
    return {"id": row["id"], "status": row["status"], "formation": row["formation"], "bot_id": row["bot_id"], "hotspot_index": row["hotspot_index"], "player_xi": sanitize_xi(state["home_xi"]), "bot_xi": sanitize_xi(state["away_xi"]), "score": result["score"], "timeline": result["timeline"], "debug": _debug(result, debug)}


def _advance_run(row: dict[str, Any], debug: bool) -> dict[str, Any]:
    state = row["resolver_state"]
    try:
        result = resolve_match(row["seed"], state["home_xi"], state["away_xi"], 12, coach_intents=_coach_intents(row["bot_id"]), debug=debug, start_index=row["hotspot_index"], initial_score={"home": row["home_score"], "away": row["away_score"]}, initial_timeline=row["broadcast_timeline"], initial_action_sources=state.get("action_sources"))
        row.update({"status": "completed", "hotspot_index": len(result["timeline"]), "home_score": result["score"]["home"], "away_score": result["score"]["away"], "broadcast_timeline": result["timeline"], "final_report": _report(result), "completed_at": datetime.now(timezone.utc).isoformat(), "resolver_state": None})
    except MatchPausedError as exc:
        result = exc.result
        row.update({"status": "paused", "hotspot_index": result["hotspot_index"], "home_score": result["score"]["home"], "away_score": result["score"]["away"], "broadcast_timeline": result["timeline"], "resolver_state": {**state, "action_sources": result["action_sources"]}})
    fields = {key: row[key] for key in ("status", "hotspot_index", "home_score", "away_score", "broadcast_timeline", "final_report", "completed_at", "resolver_state") if key in row}
    get_service_supabase_client().table("match_lab_runs").update(fields).eq("id", row["id"]).eq("user_id", row["user_id"]).execute()
    return _response(row, result, debug, state)


def run_match_lab(access_token: str, user_id: str, formation: str, bot_id: str, selections: list[dict[str, str]], debug: bool) -> dict[str, Any]:
    home_xi, away_xi = _owned_xi(access_token, user_id, formation, selections), _bot_xi(access_token, bot_id)
    row = {"user_id": user_id, "status": "running", "formation": formation, "bot_id": bot_id, "player_squad": [{"slot_id": card["slot_id"], "card_id": card["card_id"]} for card in home_xi], "bot_squad": [{"slot_id": card["slot_id"], "card_id": card["card_id"]} for card in away_xi], "seed": secrets.token_urlsafe(16), "hotspot_index": 0, "home_score": 0, "away_score": 0, "broadcast_timeline": [], "resolver_state": {"home_xi": home_xi, "away_xi": away_xi, "action_sources": {"llm": 0, "retried": 0, "fallback": 0}}}
    response = get_service_supabase_client().table("match_lab_runs").insert(row).select("id").execute()
    row["id"] = response.data[0]["id"]
    return _advance_run(row, debug)


def _owned_run(user_id: str, run_id: str) -> dict[str, Any] | None:
    response = get_service_supabase_client().table("match_lab_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()
    return (response.data or [None])[0]


def resume_match_lab(user_id: str, run_id: str, debug: bool) -> dict[str, Any]:
    row = _owned_run(user_id, run_id)
    if not row:
        raise LookupError("Match Lab report was not found.")
    if row["status"] != "paused":
        raise ValueError("Only paused Match Lab runs can resume.")
    return _advance_run(row, debug)


def abandon_match_lab(user_id: str, run_id: str) -> dict[str, Any]:
    row = _owned_run(user_id, run_id)
    if not row:
        raise LookupError("Match Lab report was not found.")
    if row["status"] != "paused":
        raise ValueError("Only paused Match Lab runs can be abandoned.")
    get_service_supabase_client().table("match_lab_runs").update({"status": "abandoned"}).eq("id", run_id).eq("user_id", user_id).execute()
    return {"id": run_id, "status": "abandoned"}


def list_match_lab_runs(user_id: str) -> list[dict[str, Any]]:
    response = get_service_supabase_client().table("match_lab_runs").select("id,status,formation,bot_id,hotspot_index,home_score,away_score,broadcast_timeline,final_report,fun_rating,clarity_rating,fairness_rating,feedback_text,created_at,completed_at").eq("user_id", user_id).order("created_at", desc=True).limit(20).execute()
    return response.data or []


def submit_match_lab_feedback(user_id: str, run_id: str, feedback: dict[str, Any]) -> dict[str, Any]:
    row = _owned_run(user_id, run_id)
    if not row:
        raise LookupError("Match Lab report was not found.")
    if row["status"] != "completed":
        raise ValueError("Feedback is available after a completed Match Lab run.")
    saved_feedback = {key: feedback[key] for key in ("fun_rating", "clarity_rating", "fairness_rating", "feedback_text") if key in feedback}
    get_service_supabase_client().table("match_lab_runs").update(saved_feedback).eq("id", run_id).eq("user_id", user_id).execute()
    return {"id": run_id, **saved_feedback}
