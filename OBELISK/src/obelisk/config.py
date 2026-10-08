"""Locations and tunables. Nothing here depends on the working directory."""

from __future__ import annotations

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_DIR.parent.parent

DEFAULT_DATA_DIR = REPO_ROOT / "data"
DEFAULT_LOG_FILE = DEFAULT_DATA_DIR / "logs" / "ops.log"

DEFAULT_CACHE_CAPACITY = 5
DEFAULT_RESULT_LIMIT = 10
DEFAULT_SUGGEST_LIMIT = 5
SNIPPET_WIDTH = 90


def state_dir() -> Path:
    """Directory for generated runtime state (never mixed with source)."""
    override = os.environ.get("OBELISK_HOME")
    return Path(override) if override else REPO_ROOT / ".obelisk-state"


def cache_capacity() -> int:
    raw = os.environ.get("OBELISK_CACHE_SIZE")
    if raw:
        try:
            value = int(raw)
            if value > 0:
                return value
        except ValueError:
            pass
    return DEFAULT_CACHE_CAPACITY
