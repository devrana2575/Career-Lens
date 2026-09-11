"""GitHub public API client.

Fetches user profile and repositories without authentication (60 req/hr limit).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
TIMEOUT_SECONDS = 15


def fetch_github_profile(username: str) -> dict[str, Any]:
    """Returns the public user profile or raises on failure."""
    url = f"{GITHUB_API}/users/{username}"
    with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
        resp = client.get(url, headers={"Accept": "application/vnd.github+json"})
        resp.raise_for_status()
        return resp.json()


def fetch_user_repos(username: str, per_page: int = 100) -> list[dict[str, Any]]:
    """Returns up to `per_page` most recently updated public repos."""
    url = f"{GITHUB_API}/users/{username}/repos"
    params = {"sort": "updated", "direction": "desc", "per_page": per_page}
    with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
        resp = client.get(url, headers={"Accept": "application/vnd.github+json"}, params=params)
        resp.raise_for_status()
        return resp.json()
