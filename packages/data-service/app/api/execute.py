"""API endpoints for sandboxed assessment execution (SQL + coding).

These endpoints are the replaceable execution seam referenced by the product
docs: the API server never executes student code/SQL itself, it posts here and
receives a graded, bounded result.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..execution.backend import get_execution_backend
from .security import require_api_key

router = APIRouter()

DEFAULT_CODE_TIMEOUT_MS = 3000
DEFAULT_SQL_TIMEOUT_MS = 5000
MAX_TIMEOUT_MS = 15000
MAX_CODE_CHARS = 20000


class Column(BaseModel):
    name: str
    type: str = "TEXT"


class Table(BaseModel):
    name: str
    columns: list[Column]
    rows: list[list[Any]] = []


class SqlSchema(BaseModel):
    tables: list[Table]


class SqlResult(BaseModel):
    passed: bool
    error: Optional[str] = None
    columns: list[str] = []
    rows: list[list[str]] = []
    rowCount: int = 0
    expectedRowCount: Optional[int] = None
    truncated: bool = False
    durationMs: int = 0


class SqlExecuteRequest(BaseModel):
    query: str
    dataset: SqlSchema = Field(validation_alias="schema", serialization_alias="schema")
    expected: Optional[dict[str, Any]] = None
    timeoutMs: int = Field(default=DEFAULT_SQL_TIMEOUT_MS, ge=200, le=MAX_TIMEOUT_MS)


class CodeCase(BaseModel):
    input: str = ""
    expectedOutput: str = ""


class CodeExecuteRequest(BaseModel):
    language: Literal["python"] = "python"
    code: str = Field(max_length=MAX_CODE_CHARS)
    cases: list[CodeCase]
    timeoutMs: int = Field(default=DEFAULT_CODE_TIMEOUT_MS, ge=200, le=MAX_TIMEOUT_MS)


class CodeResult(BaseModel):
    passed: bool
    error: Optional[str] = None
    totalCases: int = 0
    passedCases: int = 0
    results: list[dict[str, Any]] = []
    truncatedResults: bool = False
    durationMs: int = 0


@router.post("/execute/sql", response_model=SqlResult, dependencies=[Depends(require_api_key)])
def execute_sql_endpoint(body: SqlExecuteRequest) -> SqlResult:
    backend = get_execution_backend()
    return SqlResult(
        **backend.execute_sql(
            body.query,
            body.dataset.model_dump(by_alias=True),
            body.expected,
            timeout_ms=body.timeoutMs,
        )
    )


@router.post("/execute/code", response_model=CodeResult, dependencies=[Depends(require_api_key)])
def execute_code_endpoint(body: CodeExecuteRequest) -> CodeResult:
    backend = get_execution_backend()
    return CodeResult(
        **backend.execute_code(
            body.language,
            body.code,
            [case.model_dump() for case in body.cases],
            timeout_ms=body.timeoutMs,
        )
    )
