"""Shared API-key guard for data-service operations endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status

from ..config import get_settings


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    settings = get_settings()
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
