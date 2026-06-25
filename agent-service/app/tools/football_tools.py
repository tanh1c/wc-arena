from typing import Any

from app.tools.supabase_tools import (
    get_espn_context,
    get_leaderboard_context,
    get_match,
    get_prediction_signal,
    get_teams,
    get_user_prediction_history,
    get_user_supabase_client,
)


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
