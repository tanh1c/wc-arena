from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.settings import get_settings


def derive_outcome(home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return "home"
    if home_score < away_score:
        return "away"
    return "draw"


def list_unpicked_matches(client: Any, agent_user_id: str, window_hours: int, limit: int) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    upper = now + timedelta(hours=window_hours)

    matches_resp = (
        client.table("matches")
        .select("id, home_team_id, away_team_id, lock_at, stage")
        .eq("status", "open")
        .gte("lock_at", now.isoformat())
        .lte("lock_at", upper.isoformat())
        .order("lock_at", desc=False)
        .execute()
    )
    matches = matches_resp.data or []

    picked_resp = (
        client.table("predictions")
        .select("match_id")
        .eq("user_id", agent_user_id)
        .execute()
    )
    picked_ids = {row["match_id"] for row in (picked_resp.data or [])}

    unpicked = [m for m in matches if m["id"] not in picked_ids]
    return unpicked[:limit]


def submit_agent_prediction(access_token: str, match_id: str, home_score: int, away_score: int, confidence: int) -> httpx.Response:
    settings = get_settings()
    url = f"{settings.supabase_url}/functions/v1/submit_prediction"
    payload = {
        "matchId": match_id,
        "predictionType": "exact_score",
        "homeScore": home_score,
        "awayScore": away_score,
        "predictedOutcome": derive_outcome(home_score, away_score),
        "confidence": confidence,
        "isRiskPick": False,
    }
    with httpx.Client(timeout=30, trust_env=False) as http:
        return http.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
        )
