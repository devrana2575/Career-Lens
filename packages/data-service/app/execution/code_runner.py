"""Sandboxed coding evaluation.

This module is the *replaceable execution seam*. Student code is never run
inside the main API server; it is shipped here and executed in isolation:

- a fresh temporary directory per submission,
- the interpreter runs in isolated mode (``python -I``: ignores PYTHON* and
  user site-packages),
- per-case timeouts and captured output with a size cap,
- only the problem's target language is enabled at a time.

Production deployments should point this same seam at harder isolation
(gVisor, Firecracker, or a managed execution service) — the call contract
stays identical.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import textwrap
import time
from pathlib import Path
from typing import Any

DEFAULT_TIMEOUT_MS = 3000
MAX_OUTPUT_BYTES = 8192
MAX_RESULTS = 10


def _strip(text: str) -> str:
    return (text or "").strip().rstrip("\n").rstrip()


def _env_for_subprocess() -> dict[str, str]:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        "TMP": tempfile.gettempdir(),
    }
    return env


def _run_case(code_path: Path, input_text: str, timeout_s: int) -> dict[str, Any]:
    completed = subprocess.run(  # noqa: S603 - deliberate isolated runner, see module docstring
        [sys.executable, "-I", str(code_path)],
        input=input_text or "",
        capture_output=True,
        text=True,
        timeout=timeout_s,
        cwd=code_path.parent,
        env=_env_for_subprocess(),
        check=False,
    )
    output = completed.stdout
    stderr = completed.stderr
    truncated = len(output.encode("utf-8", "replace")) > MAX_OUTPUT_BYTES
    if not truncated:
        truncated = len(stderr.encode("utf-8", "replace")) > MAX_OUTPUT_BYTES
    return {
        "stdout": _strip(output)[:MAX_OUTPUT_BYTES],
        "stderr": _strip(stderr)[:MAX_OUTPUT_BYTES],
        "exitCode": completed.returncode,
        "truncated": truncated,
    }


def execute_code(  # noqa: PLR0913
    language: str,
    code: str,
    cases: list[dict[str, Any]],
    *,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
) -> dict[str, Any]:
    """Runs `code` against stdin/stdout cases and grades the results.

    Expected outputs are compared after normalising trailing whitespace. A
    case passes when the stripped stdout exactly matches the expected output.
    """
    started = time.time()
    if language != "python":
        return {"passed": False, "error": f"Unsupported language: {language}"}

    if not code or not code.strip():
        return {"passed": False, "error": "No code provided."}

    timeout_s = max(0.5, timeout_ms / 1000)
    results = []
    passed_cases = 0

    with tempfile.TemporaryDirectory(prefix="career-code-") as tmp:
        code_path = Path(tmp) / "solution.py"
        code_path.write_text(textwrap.dedent(code), encoding="utf-8")

        for i, case in enumerate(cases):
            try:
                outcome = _run_case(code_path, case.get("input", ""), timeout_s)
                actual = outcome["stdout"]
                expected = _strip(case.get("expectedOutput", ""))
                passed = outcome["exitCode"] == 0 and actual == expected
                if passed:
                    passed_cases += 1
                document_suffix = "…[truncated]" if outcome["truncated"] else ""
                results.append(
                    {
                        "case": i + 1,
                        "pass": passed,
                        "input": case.get("input", ""),
                        "expectedOutput": expected,
                        "actualOutput": f"{actual}{document_suffix}",
                        "error": outcome["stderr"] or None,
                    }
                )
            except subprocess.TimeoutExpired:
                results.append(
                    {
                        "case": i + 1,
                        "pass": False,
                        "input": case.get("input", ""),
                        "expectedOutput": _strip(case.get("expectedOutput", "")),
                        "actualOutput": None,
                        "error": f"Execution timed out after {timeout_s}s.",
                    }
                )
            except OSError as err:
                results.append(
                    {
                        "case": i + 1,
                        "pass": False,
                        "input": case.get("input", ""),
                        "expectedOutput": _strip(case.get("expectedOutput", "")),
                        "actualOutput": None,
                        "error": str(err),
                    }
                )

    return {
        "passed": len(cases) > 0 and passed_cases == len(cases),
        "totalCases": len(cases),
        "passedCases": passed_cases,
        "results": results[:MAX_RESULTS],
        "truncatedResults": len(results) > MAX_RESULTS,
        "durationMs": int((time.time() - started) * 1000),
    }
