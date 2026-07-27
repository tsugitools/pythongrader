"""
unittest harness for PythonGrader.

Discovers and runs evaluation tests, returning structured JSON-safe results.
JavaScript overlays titles/points from assignment metadata.
"""

from __future__ import annotations

import importlib
import importlib.util
import sys
import time
import traceback
import unittest
from typing import Any

from result import MAX_MESSAGE_CHARS, MAX_TRACEBACK_CHARS, safe_str, truncate


def test_id(test: unittest.TestCase) -> str:
    """Class.method id matching assignment metadata keys (no module prefix)."""
    return f"{test.__class__.__name__}.{test._testMethodName}"


class StructuredTestResult(unittest.TestResult):
    """Collect per-test outcomes without relying on TextTestRunner text."""

    def __init__(self) -> None:
        super().__init__()
        self.results: list[dict[str, Any]] = []
        self._started: dict[str, float] = {}

    def startTest(self, test: unittest.TestCase) -> None:
        super().startTest(test)
        self._started[test_id(test)] = time.perf_counter()

    def _duration_ms(self, test: unittest.TestCase) -> int:
        started = self._started.pop(test_id(test), None)
        if started is None:
            return 0
        return int(round((time.perf_counter() - started) * 1000))

    def _append(
        self,
        test: unittest.TestCase,
        status: str,
        message: str = "",
        tb: str = "",
    ) -> None:
        self.results.append(
            {
                "id": test_id(test),
                "status": status,
                "message": truncate(message, MAX_MESSAGE_CHARS),
                "traceback": truncate(tb, MAX_TRACEBACK_CHARS),
                "duration_ms": self._duration_ms(test),
            }
        )

    def addSuccess(self, test: unittest.TestCase) -> None:
        super().addSuccess(test)
        self._append(test, "pass")

    def addFailure(
        self,
        test: unittest.TestCase,
        err: tuple[type, BaseException, Any],
    ) -> None:
        super().addFailure(test, err)
        exc_type, exc, tb = err
        message = safe_str(exc)
        formatted = "".join(traceback.format_exception(exc_type, exc, tb))
        self._append(test, "fail", message=message, tb=formatted)

    def addError(
        self,
        test: unittest.TestCase,
        err: tuple[type, BaseException, Any],
    ) -> None:
        super().addError(test, err)
        exc_type, exc, tb = err
        message = safe_str(exc)
        formatted = "".join(traceback.format_exception(exc_type, exc, tb))
        self._append(test, "error", message=message, tb=formatted)

    def addSkip(self, test: unittest.TestCase, reason: str) -> None:
        super().addSkip(test, reason)
        self._append(test, "skip", message=safe_str(reason))

    def addExpectedFailure(
        self,
        test: unittest.TestCase,
        err: tuple[type, BaseException, Any],
    ) -> None:
        super().addExpectedFailure(test, err)
        # Treat as pass for scoring purposes; author expected the failure.
        self._append(test, "pass", message="expected failure")

    def addUnexpectedSuccess(self, test: unittest.TestCase) -> None:
        super().addUnexpectedSuccess(test)
        self._append(test, "fail", message="unexpected success")


def _load_evaluation_module(path: str = "evaluation.py"):
    """Load evaluation.py as a fresh module each grade run."""
    mod_name = "_pythongrader_evaluation"
    if mod_name in sys.modules:
        del sys.modules[mod_name]
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load evaluation module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        # Leave a broken module out of sys.modules so the next attempt is clean.
        sys.modules.pop(mod_name, None)
        raise
    return module


def run_evaluation(evaluation_path: str = "evaluation.py") -> dict[str, Any]:
    """
    Discover and run tests from evaluation.py.

    Returns a dict with keys:
      status: "complete" | "grader_error"
      tests: list of structured results
      message / traceback on grader_error
    """
    started = time.perf_counter()
    try:
        module = _load_evaluation_module(evaluation_path)
    except SyntaxError as exc:
        return {
            "status": "grader_error",
            "tests": [],
            "message": f"Evaluation syntax error: {exc}",
            "traceback": truncate(
                "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
                MAX_TRACEBACK_CHARS,
            ),
            "duration_ms": int(round((time.perf_counter() - started) * 1000)),
        }
    except Exception as exc:
        return {
            "status": "grader_error",
            "tests": [],
            "message": f"Evaluation import error: {safe_str(exc)}",
            "traceback": truncate(
                "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
                MAX_TRACEBACK_CHARS,
            ),
            "duration_ms": int(round((time.perf_counter() - started) * 1000)),
        }

    try:
        loader = unittest.defaultTestLoader
        suite = loader.loadTestsFromModule(module)
        result = StructuredTestResult()
        suite.run(result)
        return {
            "status": "complete",
            "tests": result.results,
            "message": "",
            "traceback": "",
            "duration_ms": int(round((time.perf_counter() - started) * 1000)),
        }
    except Exception as exc:
        return {
            "status": "grader_error",
            "tests": [],
            "message": f"Harness failure: {safe_str(exc)}",
            "traceback": truncate(
                "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
                MAX_TRACEBACK_CHARS,
            ),
            "duration_ms": int(round((time.perf_counter() - started) * 1000)),
        }
