from supabase import create_client

from app.settings import get_settings


def sign_in_agent() -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase server credentials are not configured")
    if not settings.agent_email or not settings.agent_password:
        raise RuntimeError("Agent account credentials are not configured")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.sign_in_with_password(
        {"email": settings.agent_email, "password": settings.agent_password}
    )
    session = getattr(response, "session", None)
    token = getattr(session, "access_token", None)
    if not token:
        raise RuntimeError("Agent sign-in returned no access token")
    return token
