from typing import Any

from supabase import Client, create_client

from app.settings import get_settings


def get_user_supabase_client(access_token: str) -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase server credentials are not configured")
    if not access_token:
        raise RuntimeError("Missing user access token")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client


def _single_table_row(client: Client, table: str, row_id: str) -> dict[str, Any]:
    response = client.table(table).select("*").eq("id", row_id).limit(1).execute()
    rows = response.data or []
    if not rows:
        raise ValueError(f"{table} row not found: {row_id}")
    return rows[0]


async def get_match(client: Client, match_id: str) -> dict[str, Any]:
    match = _single_table_row(client, "matches", match_id)
    return {
        "id": match["id"],
        "home_team_id": match["home_team_id"],
        "away_team_id": match["away_team_id"],
        "kickoff_at": match["kickoff_at"],
        "lock_at": match["lock_at"],
        "stage": match["stage"],
        "group_code": match.get("group_code"),
        "matchday": match.get("matchday"),
        "status": match["status"],
        "stadium": match["stadium"],
        "city": match["city"],
        "home_score": match.get("home_score"),
        "away_score": match.get("away_score"),
    }


async def get_teams(client: Client, home_team_id: str, away_team_id: str) -> dict[str, Any]:
    response = client.table("teams").select("*").in_("id", [home_team_id, away_team_id]).execute()
    rows = response.data or []
    teams = {row["id"]: row for row in rows}
    return {
        "home": _compact_team(teams.get(home_team_id), home_team_id),
        "away": _compact_team(teams.get(away_team_id), away_team_id),
    }


async def get_espn_context(client: Client, match_id: str) -> dict[str, Any]:
    match = _single_table_row(client, "matches", match_id)
    summary = match.get("espn_summary") if isinstance(match.get("espn_summary"), dict) else {}
    return {
        "event_id": match.get("espn_event_id"),
        "status": match.get("espn_status"),
        "status_detail": match.get("espn_status_detail"),
        "clock": match.get("espn_display_clock"),
        "state": match.get("espn_state"),
        "attendance": match.get("espn_attendance"),
        "home_record": match.get("espn_home_record"),
        "away_record": match.get("espn_away_record"),
        "venue": summary.get("venue"),
        "broadcasts": summary.get("broadcasts", [])[:6],
        "news": summary.get("news", [])[:4],
        "key_events": summary.get("keyEvents", [])[:8],
        "updated_at": match.get("espn_summary_updated_at") or match.get("espn_updated_at"),
    }


async def get_prediction_signal(client: Client, match_id: str) -> dict[str, Any]:
    match = _single_table_row(client, "matches", match_id)
    rpc_response = client.rpc("get_match_prediction_outcome_summary", {"target_match_id": match_id}).execute()
    community = (rpc_response.data or [{}])[0] if rpc_response.data else {}
    return {
        "espn": {
            "home_win_pct": match.get("espn_home_win_pct"),
            "draw_pct": match.get("espn_draw_pct"),
            "away_win_pct": match.get("espn_away_win_pct"),
            "prediction_updated_at": match.get("espn_prediction_updated_at"),
        },
        "community": community,
    }


async def get_user_prediction_history(client: Client, user_id: str) -> dict[str, Any]:
    response = (
        client.table("predictions")
        .select("match_id,prediction_type,home_score,away_score,predicted_outcome,confidence,status,created_at,updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(12)
        .execute()
    )
    return {"recent_predictions": response.data or []}


async def get_leaderboard_context(client: Client, user_id: str) -> dict[str, Any]:
    response = (
        client.table("leaderboard_entries")
        .select("scope,rank,previous_rank,points,accuracy,exact_scores,streak,league_id,updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(8)
        .execute()
    )
    return {"entries": response.data or []}


async def list_team_rows(client: Client) -> list[dict[str, Any]]:
    response = client.table("teams").select("id,name,short_name,country_code,group_code,fifa_rank").execute()
    return response.data or []


async def find_match_by_team_ids(client: Client, first_team_id: str, second_team_id: str) -> dict[str, Any] | None:
    matches_response = (
        client.table("matches")
        .select("id,home_team_id,away_team_id,kickoff_at,lock_at,stage,group_code,matchday,status,stadium,city,home_score,away_score")
        .or_(f"and(home_team_id.eq.{first_team_id},away_team_id.eq.{second_team_id}),and(home_team_id.eq.{second_team_id},away_team_id.eq.{first_team_id})")
        .order("kickoff_at", desc=False)
        .limit(1)
        .execute()
    )
    rows = matches_response.data or []
    return rows[0] if rows else None


def _compact_team(team: dict[str, Any] | None, team_id: str) -> dict[str, Any]:
    if not team:
        return {"id": team_id, "name": team_id}
    return {
        "id": team["id"],
        "name": team["name"],
        "short_name": team["short_name"],
        "country_code": team["country_code"],
        "group_code": team.get("group_code"),
        "fifa_rank": team.get("fifa_rank"),
    }
