"""Team credentials and bearer tokens."""

from __future__ import annotations

import hashlib
import secrets
import sqlite3

from .db import Database, now


def hash_code(team_id: str, access_code: str) -> str:
    return hashlib.sha256(f"{team_id.upper()}:{access_code}".encode("utf-8")).hexdigest()


def upsert_team(db: Database, team_id: str, team_name: str, access_code: str) -> None:
    team_id = team_id.strip().upper()
    db.conn().execute(
        "INSERT INTO teams(team_id, team_name, code_hash) VALUES(?,?,?) "
        "ON CONFLICT(team_id) DO UPDATE SET team_name=excluded.team_name, code_hash=excluded.code_hash",
        (team_id, team_name.strip(), hash_code(team_id, access_code.strip())),
    )


def login(db: Database, team_id: str, access_code: str) -> dict | None:
    team_id = team_id.strip().upper()
    row = db.conn().execute("SELECT * FROM teams WHERE team_id=?", (team_id,)).fetchone()
    if row is None or row["disqualified"]:
        return None
    if not secrets.compare_digest(row["code_hash"], hash_code(team_id, access_code.strip())):
        return None
    tok = db.conn().execute(
        "SELECT token FROM tokens WHERE team_pk=? ORDER BY created DESC LIMIT 1", (row["pk"],)
    ).fetchone()
    token = tok["token"] if tok else secrets.token_hex(16)
    if not tok:
        db.conn().execute(
            "INSERT INTO tokens(token, team_pk, created) VALUES(?,?,?)", (token, row["pk"], now())
        )
    return {"token": token, "participantId": row["team_id"]}


def team_for_token(db: Database, token: str) -> sqlite3.Row | None:
    return db.conn().execute(
        "SELECT t.* FROM tokens k JOIN teams t ON t.pk = k.team_pk "
        "WHERE k.token=? AND t.disqualified=0",
        (token,),
    ).fetchone()
