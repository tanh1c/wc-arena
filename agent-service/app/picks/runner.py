import logging
from typing import Any

from supabase import create_client

from app.agent_account import sign_in_agent
from app.picks.picker import decide_pick
from app.settings import get_settings
from app.tools.football_tools import gather_match_context
from app.tools.prediction_tools import list_unpicked_matches, submit_agent_prediction
from app.tools.supabase_tools import get_user_supabase_client

logger = logging.getLogger(__name__)


def get_agent_user_id(access_token: str) -> str:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.get_user(access_token)
    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise RuntimeError("Could not resolve agent user id")
    return user_id


async def run_agent_picks() -> dict[str, Any]:
    settings = get_settings()
    token = sign_in_agent()
    agent_user_id = get_agent_user_id(token)
    client = get_user_supabase_client(token)

    matches = list_unpicked_matches(
        client,
        agent_user_id,
        window_hours=settings.agent_pick_window_hours,
        limit=settings.agent_pick_batch_limit,
    )

    picked = 0
    skipped = 0
    errors: list[str] = []

    for match in matches:
        try:
            context, _ = await gather_match_context(match["id"], agent_user_id, token, include_user=False)
            pick = decide_pick(context)
            if pick is None:
                skipped += 1
                logger.warning("Agent could not decide a pick for match %s", match["id"])
                continue

            response = submit_agent_prediction(
                token,
                match["id"],
                pick["home_score"],
                pick["away_score"],
                pick["confidence"],
            )
            if response.status_code == 200:
                picked += 1
            elif response.status_code == 429:
                logger.warning("Agent hit rate limit; stopping this run")
                break
            elif response.status_code == 409:
                skipped += 1
                logger.info("Match %s already locked; skipping", match["id"])
            else:
                skipped += 1
                errors.append(f"{match['id']}: HTTP {response.status_code}")
        except Exception as exc:
            skipped += 1
            errors.append(f"{match['id']}: {exc}")
            logger.warning("Agent pick failed for match %s", match["id"], exc_info=True)

    return {"picked": picked, "skipped": skipped, "errors": errors}
