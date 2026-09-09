"""Sandboxed SQL evaluation.

Each submission runs against a fresh in-memory SQLite database built from the
problem's schema (tables, columns, rows). Only read-only statements are
accepted, a progress handler aborts runaway queries, and the student result is
compared with the expected rowset as an order-insensitive multiset.

Nothing from a submission ever touches a real database: the schema is the
problem's data and the database is destroyed when the call returns.
"""

from __future__ import annotations

import re
import sqlite3
import time
from typing import Any

MAX_RESULT_ROWS = 200
DEFAULT_TIMEOUT_MS = 5000


def _normalise_query(query: str) -> str:
    return (query or "").strip().rstrip(";").strip()


def _allows_only_read(query: str) -> bool:
    """Reject anything that is not a pure SELECT/WITH statement."""
    head = _normalise_query(query)
    if not head:
        return False
    return bool(re.match(r"^(SELECT|WITH)\b", head, flags=re.IGNORECASE))


def _abort_if_too_slow(started: float, timeout_ms: int) -> int:
    if (time.time() - started) * 1000 > timeout_ms:
        return 1  # nonzero makes SQLite abort the operation with an "interrupted" error
    return 0


def _not_none(value: Any) -> Any:
    return value


def _normalise_row(row: tuple) -> list[str]:
    return ["" if _not_none(cell) is None else str(cell) for cell in row]


def _build_database(schema: dict[str, Any]) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.text_factory = str
    for table in schema.get("tables", []):
        name = table["name"]
        columns = table.get("columns", [])
        column_defs = ", ".join(f"{c['name']} {c.get('type', 'TEXT')}" for c in columns)
        if not column_defs:
            raise ValueError(f"Table '{name}' has no columns")
        conn.execute(f'CREATE TABLE "{name}" ({column_defs})')
        rows = table.get("rows", [])
        if rows:
            placeholders = ", ".join("?" for _ in columns)
            conn.executemany(f'INSERT INTO "{name}" VALUES ({placeholders})', rows)
    conn.commit()
    return conn


def _fetch_result(  # noqa: PLR0913
    conn: sqlite3.Connection, query: str, timeout_ms: int, started: float
) -> tuple[list[str], list[list[str]]]:
    conn.set_progress_handler(
        lambda: _abort_if_too_slow(started, timeout_ms),
        10000,  # check every ~10k VM instructions
    )
    try:
        cursor = conn.execute(_normalise_query(query))
        columns = [col[0] for col in cursor.description or []]
        rows = [_normalise_row(row) for row in cursor.fetchmany(MAX_RESULT_ROWS + 1)]
        truncated = len(rows) > MAX_RESULT_ROWS
        return columns, rows[:MAX_RESULT_ROWS], truncated
    finally:
        conn.set_progress_handler(None, 0)


def execute_sql(  # noqa: PLR0913
    query: str,
    schema: dict[str, Any],
    expected: dict[str, Any] | None,
    *,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
) -> dict[str, Any]:
    """Runs `query` against the isolated schema and grades it VS `expected`.

    Returns a JSON-serialisable summary: pass/fail, matched row counts and the
    (bounded) actual result so a learner can see exactly what ran.
    """
    started = time.time()
    if not _allows_only_read(query):
        return {
            "passed": False,
            "error": "Only SELECT statements are allowed in these sandboxed problems.",
            "durationMs": 0,
        }

    conn = None
    try:
        conn = _build_database(schema)
        columns, rows, truncated = _fetch_result(conn, query, timeout_ms, started)
        duration_ms = int((time.time() - started) * 1000)

        if expected is None:
            return {
                "passed": True,
                "columns": columns,
                "rows": rows,
                "rowCount": len(rows),
                "truncated": truncated,
                "durationMs": duration_ms,
            }

        expected_columns = expected.get("columns", [])
        expected_rows = expected.get("rows", [])
        passed = (
            sorted(columns) == sorted(expected_columns)
            and len(rows) == len(expected_rows)
            and sorted(map(tuple, rows)) == sorted(tuple(_normalise_row(r)) for r in expected_rows)
        )

        return {
            "passed": passed,
            "columns": columns,
            "rows": rows,
            "rowCount": len(rows),
            "expectedRowCount": len(expected_rows),
            "truncated": truncated,
            "durationMs": duration_ms,
        }
    except sqlite3.OperationalError as err:
        if "interrupted" in str(err).lower():
            return {"passed": False, "error": "Query timed out.", "durationMs": _elapsed(started)}
        return {"passed": False, "error": f"SQL error: {err}", "durationMs": _elapsed(started)}
    except sqlite3.Error as err:
        return {"passed": False, "error": f"SQL error: {err}", "durationMs": _elapsed(started)}
    except ValueError as err:
        return {"passed": False, "error": str(err), "durationMs": _elapsed(started)}
    except Exception as err:  # noqa: BLE001 - the sandbox must never 500 on student input
        return {
            "passed": False,
            "error": f"Execution error: {err}",
            "durationMs": _elapsed(started),
        }
    finally:
        if conn is not None:
            conn.close()


def _elapsed(started: float) -> int:
    return int((time.time() - started) * 1000)
