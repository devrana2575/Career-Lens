"""
logger.py
Central logging configuration. Every module gets its logger from here
instead of sprinkling print() statements around the codebase.
"""

import logging
import sys

from src import config

_CONFIGURED = False


def _configure_root_logger() -> None:
    """Configure the root logger exactly once per process."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(config.LOG_FORMAT))

    root = logging.getLogger()
    root.setLevel(config.LOG_LEVEL)
    root.addHandler(handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for the given module name."""
    _configure_root_logger()
    return logging.getLogger(name)
