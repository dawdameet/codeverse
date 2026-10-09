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
# true maximum score of each game; the server never trusts the maximum sent by the browser.
# Must match GAMES[].max in frontend/lib/games/registry.ts (frontend/tests checks this).
MAX_SCORE = {"safe": 1450, "ledger": 240, "patrol": 500, "logic": 900, "bugs": 300}
# a finished run faster than this is physically implausible for a person: flagged for the organizers
MIN_PLAUSIBLE_SECONDS = 20
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
    """team_pk -> {"played": n, "score": weighted total + organizer adjustments, "base", "adjustment"}."""
    settle(db)
    out: dict[int, dict] = {}
    for r in db.conn().execute("SELECT team_pk, COUNT(*) AS n, SUM(share) AS total FROM game_results GROUP BY team_pk"):
        out[r["team_pk"]] = {"played": r["n"], "base": r["total"] or 0, "adjustment": 0}
    for r in db.conn().execute("SELECT team_pk, SUM(points) AS total FROM adjustments WHERE phase=1 GROUP BY team_pk"):
        out.setdefault(r["team_pk"], {"played": 0, "base": 0, "adjustment": 0})["adjustment"] = r["total"] or 0
    for v in out.values():
        v["score"] = v["base"] + v["adjustment"]
    return out


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
    if st == "PAUSED":
        return False, "EVENT_PAUSED"
    # the games round is over once its timer runs out or the organizer opens phase 2 (short grace period)
    if now() > event._f(db, "phase1_end") + GRACE_SECONDS:
        return False, "GAMES_CLOSED"
    return True, ""


def record(db: Database, team_pk: int, body: dict) -> dict:
    game = str(body.get("game", "")).strip().lower()
    if game not in WEIGHTS:
        raise GameError(404, "UNKNOWN_GAME", f"no such game: {game}")
    max_score = MAX_SCORE[game]
    try:
        score = int(body.get("score"))
    except (TypeError, ValueError, OverflowError):
        raise GameError(400, "BAD_REQUEST", "score must be a number")
    if not 0 <= score <= max_score:
        raise GameError(400, "BAD_REQUEST", f"score must be between 0 and {max_score}")
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
        if duration < MIN_PLAUSIBLE_SECONDS * 1000 and score > 0:
            c.execute(
                "INSERT INTO flags(team_pk, submission_id, kind, detail, created) VALUES(?,?,?,?,?)",
                (team_pk, None, "GAME_TOO_FAST",
                 f"{game}: {score}/{max_score} reported {duration / 1000:.1f}s after the run was opened", now()),
            )
    return results(db, team_pk)[game]
