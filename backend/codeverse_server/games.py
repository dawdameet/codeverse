"""Phase 1 game results. The games run in the browser; the official result of each is stored here
so the dashboard, other devices of the same team and the admin panel all see the same numbers."""

from __future__ import annotations

import sqlite3

from . import event
from .db import Database, now

# id -> tier weight; must match frontend/lib/games/registry.ts
WEIGHTS = {"safe": 1, "ledger": 2, "patrol": 2, "logic": 3, "bugs": 4}
# time limit of one run in minutes; must match frontend/lib/games/registry.ts
MINUTES = {"safe": 10, "ledger": 12, "patrol": 15, "logic": 15, "bugs": 20}
TOTAL_SHARE = sum(w * 100 for w in WEIGHTS.values())
# a run started just before the games round closed may still report its result this long afterwards
GRACE_SECONDS = 120


class GameError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def share(game: str, score: int, max_score: int) -> int:
    """Weighted share of one game: weight x percentage (same formula as the website)."""
    return round(WEIGHTS[game] * 100 * score / max_score) if max_score else 0


def _view(r: sqlite3.Row) -> dict:
    return {
        "game": r["game"],
        "score": r["score"],
        "max": r["max"],
        "share": r["share"],
        "detail": r["detail"] or "",
        "durationMs": r["duration_ms"],
        "finishedAt": event.iso(r["created"]),
    }


def settle(db: Database) -> None:
    """An official run that was started but never reported (page refreshed, tab closed) is
    forfeited: once its time limit has passed it is recorded as 0, so it cannot be replayed."""
    t = now()
    for r in db.conn().execute(
        "SELECT s.team_pk, s.game, s.started FROM game_starts s "
        "LEFT JOIN game_results g ON g.team_pk=s.team_pk AND g.game=s.game WHERE g.id IS NULL"
    ).fetchall():
        if t > r["started"] + MINUTES[r["game"]] * 60 + GRACE_SECONDS:
            db.conn().execute(
                "INSERT OR IGNORE INTO game_results(team_pk, game, score, max, share, detail, duration_ms, created) "
                "VALUES(?,?,0,100,0,'Run abandoned (page left or refreshed) - scored 0',?,?)",
                (r["team_pk"], r["game"], MINUTES[r["game"]] * 60_000, t),
            )


def start(db: Database, team_pk: int, game: str) -> dict:
    """Open the one official run of a game. Refreshing the page does not give a second one."""
    game = str(game).strip().lower()
    if game not in WEIGHTS:
        raise GameError(404, "UNKNOWN_GAME", f"no such game: {game}")
    settle(db)
    with db.transaction() as c:
        if c.execute("SELECT 1 FROM game_results WHERE team_pk=? AND game=?", (team_pk, game)).fetchone():
            raise GameError(409, "ALREADY_PLAYED", "this game's official run is already recorded")
        if c.execute("SELECT 1 FROM game_starts WHERE team_pk=? AND game=?", (team_pk, game)).fetchone():
            raise GameError(409, "RUN_IN_PROGRESS",
                            "an official run of this game was already started and not finished; "
                            "it is scored 0 when its time runs out")
        ok, why = accepting(db)
        if not ok:
            raise GameError(403, why, "official game runs are closed")
        c.execute("INSERT INTO game_starts(team_pk, game, started) VALUES(?,?,?)", (team_pk, game, now()))
    return {"game": game, "limitMs": MINUTES[game] * 60_000}


def results(db: Database, team_pk: int) -> dict[str, dict]:
    settle(db)
    rows = db.conn().execute("SELECT * FROM game_results WHERE team_pk=?", (team_pk,)).fetchall()
    return {r["game"]: _view(r) for r in rows}


def summary(db: Database) -> dict[int, dict]:
    """team_pk -> {"played": n, "score": weighted total}."""
    settle(db)
    rows = db.conn().execute(
        "SELECT team_pk, COUNT(*) AS n, SUM(share) AS total FROM game_results GROUP BY team_pk"
    ).fetchall()
    return {r["team_pk"]: {"played": r["n"], "score": r["total"] or 0} for r in rows}


def played(db: Database, team_pk: int) -> int:
    settle(db)
    return db.conn().execute(
        "SELECT COUNT(*) FROM game_results WHERE team_pk=?", (team_pk,)
    ).fetchone()[0]


def all_played(db: Database, team_pk: int) -> bool:
    return played(db, team_pk) >= len(WEIGHTS)


def accepting(db: Database) -> tuple[bool, str]:
    st = event.status(db)
    if st == "NOT_STARTED":
        return False, "EVENT_NOT_LIVE"
    if st == "ENDED":
        return False, "EVENT_ENDED"
    # phase 2 may already be open (timer ran out or organizer switched): allow a short grace period
    if event.phase(db) != 1 and now() > event._f(db, "phase1_end") + GRACE_SECONDS:
        return False, "GAMES_CLOSED"
    return True, ""


def record(db: Database, team_pk: int, body: dict) -> dict:
    game = str(body.get("game", "")).strip().lower()
    if game not in WEIGHTS:
        raise GameError(404, "UNKNOWN_GAME", f"no such game: {game}")
    try:
        max_score = int(body.get("max"))
        score = int(body.get("score"))
        duration = max(0, int(body.get("durationMs") or 0))
    except (TypeError, ValueError):
        raise GameError(400, "BAD_REQUEST", "score, max and durationMs must be numbers")
    if max_score <= 0 or not 0 <= score <= max_score:
        raise GameError(400, "BAD_REQUEST", "score must be between 0 and max")
    settle(db)
    with db.transaction() as c:
        existing = c.execute(
            "SELECT * FROM game_results WHERE team_pk=? AND game=?", (team_pk, game)
        ).fetchone()
        if existing:
            raise GameError(409, "ALREADY_PLAYED", "this game's official run is already recorded")
        begun = c.execute("SELECT started FROM game_starts WHERE team_pk=? AND game=?", (team_pk, game)).fetchone()
        if begun is None:
            raise GameError(409, "NOT_STARTED", "this official run was never started")
        duration = min(int((now() - begun["started"]) * 1000), MINUTES[game] * 60_000)  # server clock
        c.execute(
            "INSERT INTO game_results(team_pk, game, score, max, share, detail, duration_ms, created) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (team_pk, game, score, max_score, share(game, score, max_score),
             str(body.get("detail") or "")[:300], duration, now()),
        )
    return results(db, team_pk)[game]
