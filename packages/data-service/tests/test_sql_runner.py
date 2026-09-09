from app.execution.sql_runner import execute_sql

EMPLOYEES = {
    "tables": [
        {
            "name": "employees",
            "columns": [
                {"name": "id", "type": "INTEGER"},
                {"name": "name", "type": "TEXT"},
                {"name": "dept", "type": "TEXT"},
                {"name": "salary", "type": "INTEGER"},
            ],
            "rows": [
                [1, "ada", "Engineering", 120000],
                [2, "grace", "Engineering", 110000],
                [3, "linus", "Operations", 90000],
                [4, "katherine", "Operations", 85000],
            ],
        }
    ]
}


def test_correct_query_passes() -> None:
    expected = {
        "columns": ["name"],
        "rows": [["ada"], ["grace"]],
    }
    res = execute_sql(
        "SELECT name FROM employees WHERE dept = 'Engineering' ORDER BY name",
        EMPLOYEES,
        expected,
    )
    assert res["passed"] is True
    assert res["rowCount"] == 2


def test_order_insensitive_comparison() -> None:
    expected = {
        "columns": ["name", "salary"],
        "rows": [["grace", 110000], ["ada", 120000]],  # reverse order on purpose
    }
    res = execute_sql(
        "SELECT name, salary FROM employees WHERE dept = 'Engineering' ORDER BY salary DESC",
        EMPLOYEES,
        expected,
    )
    assert res["passed"] is True


def test_wrong_rows_fails_with_counts() -> None:
    expected = {
        "columns": ["name"],
        "rows": [["ada"], ["grace"], ["linus"]],
    }
    res = execute_sql("SELECT name FROM employees WHERE dept = 'Engineering'", EMPLOYEES, expected)
    assert res["passed"] is False
    assert res["rowCount"] == 2
    assert res["expectedRowCount"] == 3


def test_sql_error_is_bounded() -> None:
    res = execute_sql("SELECT * FROM missing_table", EMPLOYEES, None)
    assert res["passed"] is False
    assert "error" in res


def test_non_select_rejected() -> None:
    res = execute_sql("DROP TABLE employees", EMPLOYEES, None)
    assert res["passed"] is False
    assert "Only SELECT" in res["error"]


def test_empty_query_rejected() -> None:
    res = execute_sql("   ", EMPLOYEES, None)
    assert res["passed"] is False


def test_expected_result_without_expected_columns_is_pass() -> None:
    res = execute_sql("SELECT name FROM employees WHERE dept = 'Engineering'", EMPLOYEES, None)
    assert res["passed"] is True
    assert res["columns"] == ["name"]


def test_timeout_aborts() -> None:
    # Generating ten million rows via a recursive CTE blows past a 200ms budget.
    res = execute_sql(
        "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 10000000) "
        "SELECT count(*) FROM cnt",
        EMPLOYEES,
        None,
        timeout_ms=200,
    )
    assert res["passed"] is False
    assert "timed out" in res["error"].lower()
