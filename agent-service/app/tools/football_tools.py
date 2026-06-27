import json
import re
import unicodedata
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
    list_team_rows,
)


MATCHUP_RE = re.compile(r"\b(.+?)\s+(?:vs|v|versus|đấu với|dau voi|gặp|gap)\s+(.+?)\b", re.IGNORECASE)


def normalize_team_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower().replace("đ", "d"))
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def resolve_team_id_from_rows(query: str, teams: list[dict[str, Any]]) -> str | None:
    normalized_query = normalize_team_query(query)
    if not normalized_query:
        return None

    for team in teams:
        candidates = [team.get("id"), team.get("name"), team.get("short_name"), team.get("country_code")]
        if any(normalize_team_query(str(candidate)) == normalized_query for candidate in candidates if candidate):
            return team["id"]

    return resolve_team_id_with_llm(query, teams)


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
            "Map a natural-language national team name to exactly one team id from the provided World Cup team list.",
            "Use multilingual football knowledge and common Vietnamese names/transliterations.",
            "Few-shot examples:",
            "- 'arg' => ARG when Argentina is in the list.",
            "- 'á căn đình' => ARG when Argentina is in the list.",
            "- 'bồ đào nha' => POR when Portugal is in the list.",
            "- 'hàn quốc' => KOR when Korea Republic is in the list.",
            "Return ONLY JSON: {\"team_id\": \"<id>\"} or {\"team_id\": null} if uncertain.",
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
    team_id = data.get("team_id")
    valid_ids = {team.get("id") for team in teams}
    return team_id if team_id in valid_ids else None


def team_suggestions(teams: list[dict[str, Any]], limit: int = 6) -> list[str]:
    return [team.get("name") or team.get("id") for team in teams[:limit] if team.get("name") or team.get("id")]


def extract_matchup_query(message: str) -> tuple[str, str] | None:
    match = MATCHUP_RE.search(message.strip())
    if not match:
        return None
    first_team = _clean_matchup_team_query(match.group(1))
    second_team = _clean_matchup_team_query(match.group(2))
    if not first_team or not second_team:
        return None
    return first_team, second_team


def _clean_matchup_team_query(value: str) -> str:
    cleaned = value.strip(" ?!.,;:-")
    return re.sub(r"^(?:analyze|preview|predict|pick|phân tích|phan tich|dự đoán|du doan|xem|coi)\s+", "", cleaned, flags=re.IGNORECASE).strip(" ?!.,;:-")


async def resolve_matchup_context(message: str, user_id: str, access_token: str, include_user: bool = False) -> tuple[dict[str, Any], list[str]]:
    matchup = extract_matchup_query(message)
    if not matchup:
        return {}, []
    client = get_user_supabase_client(access_token)
    teams = await list_team_rows(client)
    first_team_id = resolve_team_id_from_rows(matchup[0], teams)
    second_team_id = resolve_team_id_from_rows(matchup[1], teams)
    if not first_team_id or not second_team_id:
        return {
            "unmatched_matchup": {
                "teams": list(matchup),
                "resolved_team_ids": [first_team_id, second_team_id],
                "suggestions": team_suggestions(teams),
            }
        }, ["list_team_rows", "resolve_team_id"]

    resolved_match = await find_match_by_team_ids(client, first_team_id, second_team_id)
    if not resolved_match:
        return {
            "unmatched_matchup": {
                "teams": list(matchup),
                "resolved_team_ids": [first_team_id, second_team_id],
                "suggestions": team_suggestions(teams),
            }
        }, ["list_team_rows", "resolve_team_id", "find_match_by_team_ids"]

    match_id = resolved_match["id"]
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
