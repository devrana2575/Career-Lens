"""Execution backend seam: local subprocess vs managed remote sandbox.

The API server never executes student code itself — it delegates here.

- **local** (default): runs SQL in-memory via SQLite and code in a temporary
  file via the isolated Python interpreter.
- **remote**: posts to an external execution service when
  ``DATA_EXECUTION_BACKEND=remote`` and ``DATA_MANAGED_SANDBOX_URL`` is set.

The call contract is identical regardless of backend; production deployments
swap in harder isolation (gVisor, Firecracker, managed service) by changing
two environment variables.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

REMOTE_TIMEOUT_SECONDS = 30


# ------------------------------------------------------------------
# Local backend (in-process sandboxed runners)
# ------------------------------------------------------------------


class _LocalBackend:
    def execute_sql(
        self,
        query: str,
        schema: dict[str, Any],
        expected: dict[str, Any] | None,
        timeout_ms: int,
    ) -> dict[str, Any]:
        from .sql_runner import execute_sql

        return execute_sql(query, schema, expected, timeout_ms=timeout_ms)

    def execute_code(
        self,
        language: str,
        code: str,
        cases: list[dict[str, Any]],
        timeout_ms: int,
    ) -> dict[str, Any]:
        from .code_runner import execute_code

        return execute_code(language, code, cases, timeout_ms=timeout_ms)


# ------------------------------------------------------------------
# Remote backend (HTTP to managed sandbox)
# ------------------------------------------------------------------


class _RemoteBackend:
    def __init__(self, url: str) -> None:
        self._url = url.rstrip("/")

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            resp = httpx.post(
                f"{self._url}{path}",
                json=payload,
                timeout=REMOTE_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise RuntimeError(f"Remote execution failed: {exc}") from exc

    def execute_sql(
        self,
        query: str,
        schema: dict[str, Any],
        expected: dict[str, Any] | None,
        timeout_ms: int,
    ) -> dict[str, Any]:
        return self._post(
            "/api/execute/sql",
            {"query": query, "schema": schema, "expected": expected, "timeoutMs": timeout_ms},
        )

    def execute_code(
        self,
        language: str,
        code: str,
        cases: list[dict[str, Any]],
        timeout_ms: int,
    ) -> dict[str, Any]:
        return self._post(
            "/api/execute/code",
            {"language": language, "code": code, "cases": cases, "timeoutMs": timeout_ms},
        )


# ------------------------------------------------------------------
# Factory
# ------------------------------------------------------------------


def get_execution_backend() -> _LocalBackend | _RemoteBackend:
    settings = get_settings()
    if settings.execution_backend == "remote":
        if not settings.managed_sandbox_url:
            raise RuntimeError(
                "EXECUTION_BACKEND is 'remote' but MANAGED_SANDBOX_URL is not set"
            )
        return _RemoteBackend(settings.managed_sandbox_url)
    return _LocalBackend()
