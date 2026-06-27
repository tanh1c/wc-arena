import json
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any

from app.tools.supabase_tools import (
    find_match_by_team_ids,
    get_espn_context,
    get_leaderboard_context,
    get_match,
    get_prediction_signal,
    get_teams,
    get_user_prediction_history,
    get_user_supabase_client,
    list_global_leaderboard_context,
    list_matches_by_window,
    list_matches_for_team,
    list_team_rows,
    list_upcoming_matches,
)


logger = logging.getLogger(__name__)

MATCHUP_RE = re.compile(r"\b(.+?)\s+(?:vs|v|versus|với|voi|đấu với|dau voi|gặp|gap)\s+(.+?)\b", re.IGNORECASE)
AMBIGUOUS_MATCHUP_RE = re.compile(r"\b(.+?)\s+(?:và|va|and|&)\s+(.+?)\b", re.IGNORECASE)
TRAILING_REQUEST_RE = re.compile(
    r"\s+(?:"
    r"bạn nghĩ|ban nghi|"
    r"dự đoán|du doan|"
    r"predict|prediction|preview|analyze|"
    r"trận này|tran nay|"
    r"tỉ số|ti so|ty so|"
    r"cho tôi|cho toi|giúp tôi|giup toi|"
    r"please|pls"
    r")\b.*$",
    re.IGNORECASE,
)
FIXTURE_QUERY_RE = re.compile(r"\b(?:fixture|fixtures|schedule|match schedule|today|tomorrow|upcoming|next match|lịch|lich|lịch thi đấu|lich thi dau|hôm nay|hom nay|ngày mai|ngay mai|mai|sắp diễn ra|sap dien ra)\b", re.IGNORECASE)
REMINDER_QUERY_RE = re.compile(r"\b(?:remind|reminder|notify|notification|alert|nhắc|nhac|thông báo|thong bao|sắp diễn ra|sap dien ra)\b", re.IGNORECASE)
RULES_QUERY_RE = re.compile(r"\b(?:rule|rules|points|scoring|leaderboard|ranking|rank|deadline|lock|bảng xếp hạng|bang xep hang|xếp hạng|xep hang|leo bảng|leo bang|điểm|diem|luật|luat)\b", re.IGNORECASE)
TEAM_CONTEXT_RE = re.compile(r"\b(?:team|squad|players|lineup|form|head-to-head|h2h|đội hình|doi hinh|phong độ|phong do|đối đầu|doi dau|lịch sử đối đầu|lich su doi dau)\b", re.IGNORECASE)
TEAM_SCHEDULE_RE = re.compile(r"\b(?:next\s+match|match\s+next|schedule|fixture|fixtures|lịch|lich|trận\s+tiếp\s+theo|tran\s+tiep\s+theo|trận\s+kế\s+tiếp|tran\s+ke\s+tiep|đá\s+khi\s+nào|da\s+khi\s+nao|đá\s+trận|da\s+tran|còn\s+trận|con\s+tran)\b", re.IGNORECASE)
AMBIGUOUS_NON_TEAM_TERMS = {"doi hinh", "phong do", "lineup", "form", "team", "squad", "players", "player"}
TEAM_SCHEDULE_CLEAN_RE = re.compile(r"\b(?:when|is|the|next|match|schedule|fixture|fixtures|lịch|lich|trận|tran|tiếp|tiep|theo|kế|ke|đá|da|khi|nào|nao|còn|con|của|cua)\b", re.IGNORECASE)


def normalize_team_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower().replace("đ", "d"))
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def resolve_team_id_from_rows(query: str, teams: list[dict[str, Any]]) -> str | None:
    normalized_query = normalize_team_query(query)
    if not normalized_query:
        _log_resolution("team_query_empty", query=query)
        return None

    for team in teams:
        candidates = [team.get("id"), team.get("name"), team.get("short_name"), team.get("country_code")]
        if any(normalize_team_query(str(candidate)) == normalized_query for candidate in candidates if candidate):
            team_id = team["id"]
            _log_resolution("team_resolved_exact", query=query, normalized_query=normalized_query, team_id=team_id)
            return team_id

    team_id = resolve_team_id_with_llm(query, teams)
    _log_resolution("team_resolved_llm" if team_id else "team_unresolved_llm", query=query, normalized_query=normalized_query, team_id=team_id)
    return team_id


def resolve_team_id_with_llm(query: str, teams: list[dict[str, Any]]) -> str | None:
    from app.graph.nodes import _call_llm

    team_options = [
        {
            "id": team.get("id"),
            "name": team.get("name"),
            "short_name": team.get("short_name"),
            "country_code": team.get("country_code"),
        }
        for team in teams
    ]
    prompt = "\n".join(
        [
            "Map a natural-language national team name to exactly one team from the provided World Cup team list.",
            "Use multilingual football knowledge, common local names, Vietnamese names, transliterations, abbreviations, and nicknames.",
            "Never invent a team outside the provided list.",
            "Few-shot examples:",
            "- 'arg' => {\"team_id\": \"ARG\", \"matched_name\": \"Argentina\", \"confidence\": \"high\"} when Argentina is in the list.",
            "- 'á căn đình' => {\"team_id\": \"ARG\", \"matched_name\": \"Argentina\", \"confidence\": \"high\"} when Argentina is in the list.",
            "- 'bồ đào nha' or 'bo dao nha' => {\"team_id\": \"POR\", \"matched_name\": \"Portugal\", \"confidence\": \"high\"} when Portugal is in the list.",
            "- 'hàn quốc' or 'han quoc' => {\"team_id\": \"KOR\", \"matched_name\": \"Korea Republic\", \"confidence\": \"high\"} when Korea Republic is in the list.",
            "Return ONLY JSON: {\"team_id\": \"<id or null>\", \"matched_name\": \"<database name or null>\", \"confidence\": \"high|low\"}.",
            f"Query: {query}",
            f"Teams: {json.dumps(team_options, ensure_ascii=False, default=str)[:6000]}",
        ]
    )
    raw = _call_llm(prompt)
    if not raw:
        return None
    match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except (ValueError, TypeError):
        return None
    if str(data.get("confidence") or "").lower() == "low":
        return None
    return _validated_llm_team_id(data, teams)


def _validated_llm_team_id(data: dict[str, Any], teams: list[dict[str, Any]]) -> str | None:
    id_lookup = {str(team.get("id", "")).lower(): team.get("id") for team in teams if team.get("id")}
    team_id = data.get("team_id")
    if team_id is not None:
        resolved_id = id_lookup.get(str(team_id).lower())
        if resolved_id:
            return resolved_id

    matched_name = data.get("matched_name")
    if matched_name:
        normalized_name = normalize_team_query(str(matched_name))
        for team in teams:
            candidates = [team.get("name"), team.get("short_name"), team.get("country_code")]
            if any(normalize_team_query(str(candidate)) == normalized_name for candidate in candidates if candidate):
                return team.get("id")
    return None


def team_suggestions(teams: list[dict[str, Any]], limit: int = 6) -> list[str]:
    return [team.get("name") or team.get("id") for team in teams[:limit] if team.get("name") or team.get("id")]


def resolve_relative_date_window(message: str, now_utc: datetime | None = None) -> dict[str, str] | None:
    normalized_message = normalize_team_query(message)
    now = now_utc or datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if any(term in normalized_message.split() for term in ("tomorrow", "mai")) or "ngay mai" in normalized_message:
        start = today_start + timedelta(days=1)
        end = start + timedelta(days=1)
        return {"label": "tomorrow", "start_iso": start.isoformat(), "end_iso": end.isoformat()}
    if any(term in normalized_message for term in ("today", "hom nay")):
        end = today_start + timedelta(days=1)
        return {"label": "today", "start_iso": today_start.isoformat(), "end_iso": end.isoformat()}
    if any(term in normalized_message for term in ("upcoming", "next match", "sap dien ra")):
        end = now + timedelta(days=7)
        return {"label": "upcoming", "start_iso": now.isoformat(), "end_iso": end.isoformat()}
    return None


def is_fixture_list_query(message: str) -> bool:
    return bool(FIXTURE_QUERY_RE.search(message))


def is_reminder_query(message: str) -> bool:
    return bool(REMINDER_QUERY_RE.search(message))


def is_rules_or_leaderboard_query(message: str) -> bool:
    return bool(RULES_QUERY_RE.search(message))


def is_team_context_query(message: str) -> bool:
    return bool(TEAM_CONTEXT_RE.search(message))


def is_team_schedule_query(message: str) -> bool:
    return bool(TEAM_SCHEDULE_RE.search(normalize_team_query(message)))


def extract_team_schedule_query(message: str) -> str | None:
    if not is_team_schedule_query(message):
        return None
    if extract_matchup_query(message) or extract_ambiguous_matchup_query(message):
        return None
    cleaned = TEAM_SCHEDULE_CLEAN_RE.sub(" ", message)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ?!.,;:-")
    return cleaned or None


def extract_matchup_query(message: str) -> tuple[str, str] | None:
    match = MATCHUP_RE.search(message.strip())
    if not match:
        return None
    first_team = _clean_matchup_team_query(match.group(1))
    second_team = _clean_matchup_team_query(match.group(2))
    if not first_team or not second_team:
        return None
    return first_team, second_team


def extract_ambiguous_matchup_query(message: str) -> tuple[str, str] | None:
    if extract_matchup_query(message):
        return None
    match = AMBIGUOUS_MATCHUP_RE.search(message.strip())
    if not match:
        return None
    first_team = _clean_matchup_team_query(match.group(1))
    second_team = _clean_matchup_team_query(match.group(2))
    if not first_team or not second_team:
        return None
    if normalize_team_query(first_team) in AMBIGUOUS_NON_TEAM_TERMS or normalize_team_query(second_team) in AMBIGUOUS_NON_TEAM_TERMS:
        return None
    return first_team, second_team


def _clean_matchup_team_query(value: str) -> str:
    cleaned = value.strip(" ?!.,;:-")
    cleaned = re.sub(r"^(?:analyze|preview|predict|pick|phân tích|phan tich|dự đoán|du doan|xem|coi|lịch sử đối đầu|lich su doi dau|đối đầu|doi dau)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = TRAILING_REQUEST_RE.sub("", cleaned)
    return cleaned.strip(" ?!.,;:-")


def _log_resolution(event: str, **fields: Any) -> None:
    logger.info("matchup_resolution %s %s", event, json.dumps(fields, ensure_ascii=False, default=str))
    for handler in logging.getLogger().handlers:
        handler.flush()


def _team_lookup(teams: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {team["id"]: team for team in teams if team.get("id")}


def _compact_team_from_lookup(team_id: str, teams_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    team = teams_by_id.get(team_id) or {}
    return {
        "id": team_id,
        "name": team.get("name") or team.get("short_name") or team_id,
        "short_name": team.get("short_name"),
        "country_code": team.get("country_code"),
        "group_code": team.get("group_code"),
        "fifa_rank": team.get("fifa_rank"),
    }


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _attach_match_teams(matches: list[dict[str, Any]], teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    teams_by_id = _team_lookup(teams)
    return [
        {
            **match,
            "home_team": _compact_team_from_lookup(match.get("home_team_id", ""), teams_by_id),
            "away_team": _compact_team_from_lookup(match.get("away_team_id", ""), teams_by_id),
        }
        for match in matches
    ]


def _extract_single_team_query(message: str) -> str:
    cleaned = re.sub(
        r"\b(?:team|squad|players|lineup|form|đội hình|doi hinh|phong độ|phong do|thế nào|the nao|của|cua|cho tôi|cho toi|về|ve|about)\b",
        " ",
        message,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", cleaned).strip(" ?!.,;:-")


async def gather_fixture_list_context(message: str, access_token: str, now_utc: datetime | None = None) -> tuple[dict[str, Any], list[str]]:
    window = resolve_relative_date_window(message, now_utc) or resolve_relative_date_window("upcoming", now_utc)
    client = get_user_supabase_client(access_token)
    matches = await list_matches_by_window(client, window["start_iso"], window["end_iso"])
    teams = await list_team_rows(client)
    fixtures = _attach_match_teams(matches, teams)
    _log_resolution("fixture_window_resolved", message=message, window=window, match_count=len(fixtures))
    return {"fixture_window": window, "fixtures": fixtures}, ["list_matches_by_window", "list_team_rows"]


async def gather_reminder_context(message: str, user_id: str, access_token: str) -> tuple[dict[str, Any], list[str]]:
    now = datetime.now(timezone.utc).isoformat()
    client = get_user_supabase_client(access_token)
    matches = await list_upcoming_matches(client, now)
    teams = await list_team_rows(client)
    reminder_matches = _attach_match_teams(matches, teams)
    _log_resolution("reminder_context_resolved", message=message, user_id=user_id, match_count=len(reminder_matches))
    return {
        "reminder_context": {
            "mode": "upcoming_matches",
            "notification_available": False,
        },
        "reminder_matches": reminder_matches,
    }, ["list_upcoming_matches", "list_team_rows"]


async def gather_ambiguous_matchup_context(message: str, access_token: str) -> tuple[dict[str, Any], list[str]]:
    matchup = extract_ambiguous_matchup_query(message)
    if not matchup:
        _log_resolution("ambiguous_matchup_not_extracted", message=message)
        return {}, []

    client = get_user_supabase_client(access_token)
    teams = await list_team_rows(client)
    first_team_id = resolve_team_id_from_rows(matchup[0], teams)
    second_team_id = resolve_team_id_from_rows(matchup[1], teams)
    if not first_team_id or not second_team_id:
        _log_resolution("ambiguous_matchup_unresolved", message=message, teams=list(matchup), resolved_team_ids=[first_team_id, second_team_id])
        return {
            "unmatched_matchup": {
                "teams": list(matchup),
                "resolved_team_ids": [first_team_id, second_team_id],
                "suggestions": team_suggestions(teams),
            }
        }, ["list_team_rows", "resolve_team_id"]

    teams_by_id = _team_lookup(teams)
    home = _compact_team_from_lookup(first_team_id, teams_by_id)
    away = _compact_team_from_lookup(second_team_id, teams_by_id)
    ambiguous_matchup = {
        "query_teams": list(matchup),
        "resolved_team_ids": [first_team_id, second_team_id],
        "display_matchup": f"{home.get('name') or first_team_id} vs {away.get('name') or second_team_id}",
    }
    resolved_match = await find_match_by_team_ids(client, first_team_id, second_team_id)
    if resolved_match:
        ambiguous_matchup["match_id"] = resolved_match["id"]
        _log_resolution("ambiguous_matchup_fixture_found", message=message, match_id=resolved_match["id"], resolved_team_ids=[first_team_id, second_team_id])
    else:
        _log_resolution("ambiguous_matchup_resolved", message=message, resolved_team_ids=[first_team_id, second_team_id])
    return {"ambiguous_matchup": ambiguous_matchup}, ["list_team_rows", "resolve_team_id", "find_match_by_team_ids"]


async def gather_team_schedule_context(message: str, access_token: str, now_utc: datetime | None = None) -> tuple[dict[str, Any], list[str]]:
    query = extract_team_schedule_query(message)
    if not query:
        _log_resolution("team_schedule_not_extracted", message=message)
        return {}, []

    client = get_user_supabase_client(access_token)
    teams = await list_team_rows(client)
    team_id = resolve_team_id_from_rows(query, teams)
    if not team_id:
        _log_resolution("team_schedule_unresolved", message=message, query=query)
        return {"unmatched_team_context": {"query": query, "suggestions": team_suggestions(teams)}}, ["list_team_rows", "resolve_team_id"]

    team = next((row for row in teams if row.get("id") == team_id), {"id": team_id})
    matches = await list_matches_for_team(client, team_id)
    attached_matches = _attach_match_teams(matches, teams)
    now = now_utc or datetime.now(timezone.utc)
    upcoming_matches = sorted(
        [match for match in attached_matches if _parse_datetime(match.get("kickoff_at")) and _parse_datetime(match.get("kickoff_at")) >= now],
        key=lambda match: _parse_datetime(match.get("kickoff_at")),
    )
    _log_resolution("team_schedule_resolved", message=message, query=query, team_id=team_id, match_count=len(attached_matches), upcoming_count=len(upcoming_matches))
    return {
        "team_schedule_context": {
            "team": team,
            "matches": attached_matches,
            "upcoming_matches": upcoming_matches,
            "next_match": upcoming_matches[0] if upcoming_matches else None,
        }
    }, ["list_team_rows", "resolve_team_id", "list_matches_for_team"]


async def gather_team_context(message: str, access_token: str) -> tuple[dict[str, Any], list[str]]:
    matchup = extract_matchup_query(message)
    if matchup:
        return {
            "head_to_head_context": {
                "teams": list(matchup),
                "requires_matchup_resolution": True,
                "note": "Use resolved matchup context when a fixture exists; otherwise ask for clearer team names.",
            }
        }, ["extract_matchup_query"]

    client = get_user_supabase_client(access_token)
    teams = await list_team_rows(client)
    query = _extract_single_team_query(message)
    team_id = resolve_team_id_from_rows(query, teams)
    if not team_id:
        _log_resolution("team_context_unresolved", message=message, query=query)
        return {"unmatched_team_context": {"query": query, "suggestions": team_suggestions(teams)}}, ["list_team_rows", "resolve_team_id"]

    team = next((row for row in teams if row.get("id") == team_id), {"id": team_id})
    matches = await list_matches_for_team(client, team_id)
    _log_resolution("team_context_resolved", message=message, query=query, team_id=team_id, match_count=len(matches))
    return {
        "team_context": {
            "team": team,
            "matches": _attach_match_teams(matches, teams),
            "squad_available": bool(team.get("squad") or team.get("players")),
            "form_available": bool(team.get("form") or team.get("recent_form")),
        }
    }, ["list_team_rows", "resolve_team_id", "list_matches_for_team"]


async def gather_rules_context(user_id: str, access_token: str) -> tuple[dict[str, Any], list[str]]:
    client = get_user_supabase_client(access_token)
    leaderboard = await get_leaderboard_context(client, user_id)
    global_leaderboard = await list_global_leaderboard_context(client)
    return {
        "rules_context": {
            "scoring": [
                "Exact-score picks are the strongest way to gain points.",
                "Outcome-only accuracy helps when exact scores miss.",
                "Submit before the match lock/deadline.",
                "Climb the leaderboard by combining exact scores, consistent outcomes, and streaks where available.",
            ],
        },
        "leaderboard_context": leaderboard,
        "global_leaderboard_context": global_leaderboard,
    }, ["get_leaderboard_context", "list_global_leaderboard_context"]


async def resolve_matchup_context(message: str, user_id: str, access_token: str, include_user: bool = False) -> tuple[dict[str, Any], list[str]]:
    matchup = extract_matchup_query(message)
    if not matchup:
        _log_resolution("matchup_not_extracted", message=message)
        return {}, []
    _log_resolution("matchup_extracted", message=message, teams=list(matchup))
    client = get_user_supabase_client(access_token)
    teams = await list_team_rows(client)
    first_team_id = resolve_team_id_from_rows(matchup[0], teams)
    second_team_id = resolve_team_id_from_rows(matchup[1], teams)
    if not first_team_id or not second_team_id:
        _log_resolution(
            "matchup_team_unresolved",
            teams=list(matchup),
            resolved_team_ids=[first_team_id, second_team_id],
        )
        return {
            "unmatched_matchup": {
                "teams": list(matchup),
                "resolved_team_ids": [first_team_id, second_team_id],
                "suggestions": team_suggestions(teams),
            }
        }, ["list_team_rows", "resolve_team_id"]

    resolved_match = await find_match_by_team_ids(client, first_team_id, second_team_id)
    if not resolved_match:
        _log_resolution(
            "matchup_fixture_unresolved",
            teams=list(matchup),
            resolved_team_ids=[first_team_id, second_team_id],
        )
        return {
            "unmatched_matchup": {
                "teams": list(matchup),
                "resolved_team_ids": [first_team_id, second_team_id],
                "suggestions": team_suggestions(teams),
            }
        }, ["list_team_rows", "resolve_team_id", "find_match_by_team_ids"]

    match_id = resolved_match["id"]
    _log_resolution("matchup_resolved", teams=list(matchup), resolved_team_ids=[first_team_id, second_team_id], match_id=match_id)
    context, tools = await gather_match_context(match_id, user_id, access_token, include_user=include_user)
    context["resolved_matchup"] = {
        "query_teams": list(matchup),
        "team_ids": [first_team_id, second_team_id],
        "match_id": match_id,
    }
    return context, ["list_team_rows", "resolve_team_id", "find_match_by_team_ids", *tools]


async def gather_match_context(match_id: str, user_id: str, access_token: str, include_user: bool = False) -> tuple[dict[str, Any], list[str]]:
    client = get_user_supabase_client(access_token)
    match = await get_match(client, match_id)
    teams = await get_teams(client, match["home_team_id"], match["away_team_id"])
    espn = await get_espn_context(client, match_id)
    signal = await get_prediction_signal(client, match_id)
    tools = ["get_match", "get_teams", "get_espn_context", "get_prediction_signal"]
    context: dict[str, Any] = {
        "match": match,
        "teams": teams,
        "espn": espn,
        "prediction_signal": signal,
    }

    if include_user:
        context["user_prediction_history"] = await get_user_prediction_history(client, user_id)
        context["leaderboard_context"] = await get_leaderboard_context(client, user_id)
        tools.extend(["get_user_prediction_history", "get_leaderboard_context"])

    return context, tools
