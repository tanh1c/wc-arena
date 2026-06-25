from fastapi import Depends, HTTPException, Request, status
from supabase import create_client

from app.models import AuthenticatedUser
from app.settings import get_settings


def _get_bearer_token(request: Request) -> str:
    value = request.headers.get("authorization", "")
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return token


def verify_supabase_user(request: Request) -> AuthenticatedUser:
    settings = get_settings()
    token = _get_bearer_token(request)
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase server credentials are not configured")

    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        response = client.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from exc

    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")

    return AuthenticatedUser(user_id=user_id, email=getattr(user, "email", None), access_token=token)


CurrentUser = Depends(verify_supabase_user)
