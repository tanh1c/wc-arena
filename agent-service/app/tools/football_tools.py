from typing import Any

from app.tools.supabase_tools import (
    get_espn_context,
    get_leaderboard_context,
    get_match,
    get_prediction_signal,
    get_teams,
    get_user_prediction_history,
)


async def gather_match_context(match_id: str, user_id: str, include_user: bool = False) -> tuple[dict[str, Any], list[str]]:
    match = await get_match(match_id)
    teams = await get_teams(match["home_team_id"], match["away_team_id"])
    espn = await get_espn_context(match_id)
    signal = await get_prediction_signal(match_id)
    tools = ["get_match", "get_teams", "get_espn_context", "get_prediction_signal"]
    context: dict[str, Any] = {
        "match": match,
        "teams": teams,
        "espn": espn,
        "prediction_signal": signal,
    }

    if include_user:
        context["user_prediction_history"] = await get_user_prediction_history(user_id)
        context["leaderboard_context"] = await get_leaderboard_context(user_id)
        tools.extend(["get_user_prediction_history", "get_leaderboard_context"])

    return context, tools
