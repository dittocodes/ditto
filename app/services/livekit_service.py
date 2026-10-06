"""LiveKit Cloud room tokens."""
from __future__ import annotations

import os


def create_join_token(*, room_name: str, participant_identity: str) -> str:
    url = os.getenv("LIVEKIT_URL", "")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    if not api_key or not api_secret:
        return "livekit-not-configured"
    try:
        from livekit import api

        token = (
            api.AccessToken(api_key, api_secret)
            .with_identity(participant_identity)
            .with_name(participant_identity)
            .with_grants(api.VideoGrants(room_join=True, room=room_name))
        )
        return token.to_jwt()
    except Exception:
        return "livekit-token-error"
