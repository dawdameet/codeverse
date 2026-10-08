"""SQLite access: one connection per thread, WAL mode, explicit transactions."""

from __future__ import annotations

import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (
    pk INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    disqualified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    team_pk INTEGER NOT NULL REFERENCES teams(pk),
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_pk INTEGER NOT NULL REFERENCES teams(pk),
    challenge TEXT NOT NULL,
    patch_file TEXT,
    patch_sha TEXT,
    status TEXT NOT NULL,            -- QUEUED RUNNING ACCEPTED REJECTED ERROR
    passed INTEGER,
    total INTEGER,
    reason TEXT,
    created REAL NOT NULL,
    started REAL,
    finished REAL,
    valid INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sub_team ON submissions(team_pk, challenge);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status, id);
CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_pk INTEGER,
    submission_id INTEGER,
    kind TEXT NOT NULL,
    detail TEXT,
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class Database:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._local = threading.local()

    def conn(self) -> sqlite3.Connection:
        c = getattr(self._local, "conn", None)
        if c is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            c = sqlite3.connect(str(self.path), timeout=30, isolation_level=None)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("PRAGMA synchronous=NORMAL")
            c.execute("PRAGMA foreign_keys=ON")
            self._local.conn = c
        return c

    def init(self) -> None:
        self.conn().executescript(SCHEMA)

    @contextmanager
    def transaction(self):
        """BEGIN IMMEDIATE ... COMMIT, so concurrent writers serialise cleanly."""
        c = self.conn()
        c.execute("BEGIN IMMEDIATE")
        try:
            yield c
        except BaseException:
            c.execute("ROLLBACK")
            raise
        else:
            c.execute("COMMIT")

    # --- key/value helpers -------------------------------------------------
    def kv_get(self, key: str, default: str | None = None) -> str | None:
        row = self.conn().execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

    def kv_set(self, key: str, value) -> None:
        self.conn().execute(
            "INSERT INTO kv(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value)),
        )


def now() -> float:
    return time.time()
