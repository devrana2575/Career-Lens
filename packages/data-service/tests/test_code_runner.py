import time

from app.execution.code_runner import execute_code


def _square_cases():
    return [
        {"input": "3\n", "expectedOutput": "9\n"},
        {"input": "-2\n", "expectedOutput": "4\n"},
    ]


SQUARE_SOLUTION = """
import sys
n = int(sys.stdin.read().strip())
print(n * n)
"""


def test_passing_solution() -> None:
    res = execute_code("python", SQUARE_SOLUTION, _square_cases())
    assert res["passed"] is True
    assert res["totalCases"] == 2
    assert res["passedCases"] == 2


def test_failing_solution_reports_case_results() -> None:
    bad = "import sys\nprint('nope')"
    res = execute_code("python", bad, _square_cases())
    assert res["passed"] is False
    assert res["passedCases"] == 0
    assert res["results"][0]["pass"] is False
    assert res["results"][0]["actualOutput"] == "nope"


def test_partial_solution() -> None:
    code = "import sys\nn = int(sys.stdin.read().strip())\nprint(n * n if n > 0 else 0)"
    res = execute_code("python", code, _square_cases())
    assert res["passed"] is False
    assert res["passedCases"] == 1  # 3 -> 9 passes; -2 -> 0 fails


def test_timeout_per_case() -> None:
    code = "import time\ntime.sleep(10)\nprint('late')"
    res = execute_code("python", code, [{"input": "", "expectedOutput": "ok"}], timeout_ms=300)
    assert res["passed"] is False
    assert "timed out" in res["results"][0]["error"].lower()


def test_unsupported_language() -> None:
    res = execute_code("javascript", "console.log(1)", [{"input": "", "expectedOutput": "1"}])
    assert res["passed"] is False
    assert "Unsupported" in res["error"]


def test_empty_code() -> None:
    res = execute_code("python", "   ", [{"input": "", "expectedOutput": ""}])
    assert res["passed"] is False
    assert "No code" in res["error"]


def test_stdout_ignores_surrounding_whitespace() -> None:
    code = "import sys\nprint(int(sys.stdin.read().strip()) * 2)"
    res = execute_code("python", code, [{"input": "21\n", "expectedOutput": "  42  \n"}])
    assert res["passed"] is True


def test_duration_measured() -> None:
    start = time.perf_counter()
    res = execute_code("python", SQUARE_SOLUTION, _square_cases())
    assert res["durationMs"] >= 0
    assert time.perf_counter() - start < 5
