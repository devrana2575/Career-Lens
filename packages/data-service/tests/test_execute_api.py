from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

KEY = "change-me"  # dev default from Settings.api_key
SCHEMA = {
    "tables": [
        {
            "name": "nums",
            "columns": [{"name": "n", "type": "INTEGER"}],
            "rows": [[1], [2], [3]],
        }
    ]
}


def test_execute_sql_requires_key() -> None:
    res = client.post(
        "/api/execute/sql",
        json={"query": "SELECT * FROM nums", "schema": SCHEMA},
    )
    assert res.status_code == 401


def test_execute_sql_grades_query() -> None:
    res = client.post(
        "/api/execute/sql",
        headers={"X-API-Key": KEY},
        json={
            "query": "SELECT n FROM nums ORDER BY n",
            "schema": SCHEMA,
            "expected": {"columns": ["n"], "rows": [[1], [2]]},
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] is False
    assert body["rowCount"] == 3
    assert body["expectedRowCount"] == 2


def test_execute_code_requires_key() -> None:
    res = client.post(
        "/api/execute/code",
        json={"code": "print(1)", "cases": [{"input": "", "expectedOutput": "1"}]},
    )
    assert res.status_code == 401


def test_execute_code_grades() -> None:
    res = client.post(
        "/api/execute/code",
        headers={"X-API-Key": KEY},
        json={"code": "print(42)", "cases": [{"input": "", "expectedOutput": "42"}]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] is True
    assert body["passedCases"] == 1


def test_execute_code_rejects_oversized() -> None:
    res = client.post(
        "/api/execute/code",
        headers={"X-API-Key": KEY},
        json={"code": "a" * 25_000, "cases": [{"input": "", "expectedOutput": ""}]},
    )
    assert res.status_code == 422
