"""Application logic shared by the HTTP API and the admin CLI."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from . import auth, event, games, patches, scoring
from .config import Config
from .content import Content
from .db import Database, now
from .judge import Assets, Gate


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str = "", **extra) -> None:
        super().__init__(message or code)
        self.status = status
        self.code = code
        self.message = message or code
        self.extra = extra


class App:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        cfg.data_dir.mkdir(parents=True, exist_ok=True)
        cfg.patches_dir.mkdir(parents=True, exist_ok=True)
        cfg.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.db = Database(cfg.db_path)
        self.db.init()
        self.content = Content(cfg.content_file)
        self.assets = Assets(cfg.assets_dir)
        self.gate = Gate()
        self.stop = threading.Event()

    # --- public read models ------------------------------------------------

    def finalized(self) -> bool:
        return self.db.kv_get("finalized", "0") == "1"

    # runtime settings live in the database so the admin panel can change them without a restart
    def max_bonus(self) -> float:
        return float(self.db.kv_get("max_bonus", str(self.cfg.max_bonus)))

    def cooldown(self) -> float:
        return float(self.db.kv_get("cooldown", str(self.cfg.cooldown_seconds)))

    def audit(self, action: str, detail: str = "") -> None:
        self.db.conn().execute(
            "INSERT INTO audit(at, action, detail) VALUES(?,?,?)", (now(), action, detail[:500])
        )

    def games_round(self) -> bool:
        """True while the leaderboard ranks teams by Phase 1 (games) points."""
        return event.phase(self.db) == 1 and event.status(self.db) != "ENDED"

    def board(self) -> list[dict]:
        rows = scoring.leaderboard(self.db, self.content, self.max_bonus(), self.finalized())
        g = games.summary(self.db)
        for r in rows:
            mine = g.get(r["pk"], {})
            r["gamesPlayed"] = mine.get("played", 0)
            r["gamesScore"] = mine.get("score", 0)
        if self.games_round():
            # Phase 1: rank by game points (more games played first on a tie, then by name)
            rows.sort(key=lambda r: (-r["gamesScore"], -r["gamesPlayed"], r["teamName"].lower()))
            for i, r in enumerate(rows, start=1):
                r["rank"] = i
        return rows

    def leaderboard(self) -> list[dict]:
        return [
            {k: r[k] for k in ("rank", "teamId", "teamName", "score", "solvedCount", "gamesScore", "gamesPlayed")}
            for r in self.board()
        ]

    def obelisk_open(self, team: sqlite3.Row) -> bool:
        """OBELISK is locked until the organizer opens phase 2 by hand. It stays visible after the event."""
        st = event.status(self.db)
        if st == "NOT_STARTED":
            return False
        return st == "ENDED" or event.phase(self.db) == 2

    def me(self, team: sqlite3.Row) -> dict:
        rows = self.board()
        mine = next(r for r in rows if r["pk"] == team["pk"])
        g = {"played": mine["gamesPlayed"], "score": mine["gamesScore"]}
        return {
            "id": mine["teamId"],
            "teamId": mine["teamId"],
            "teamName": mine["teamName"],
            "score": mine["score"],
            "rank": mine["rank"],
            "totalTeams": len(rows),
            "solvedCount": mine["solvedCount"],
            "gamesPlayed": g["played"],
            "gamesTotal": len(games.WEIGHTS),
            "gamesScore": g["score"],
            "obeliskOpen": self.obelisk_open(team),
        }

    def queue_depth(self) -> tuple[int, float]:
        row = self.db.conn().execute(
            "SELECT COUNT(*) AS n, MIN(created) AS oldest FROM submissions WHERE status IN ('QUEUED','RUNNING')"
        ).fetchone()
        age = now() - row["oldest"] if row["oldest"] else 0.0
        return row["n"], age

    def status(self) -> dict:
        n, age = self.queue_depth()
        degraded = n > 20 or age > 180
        phs = event.phases(self.db)
        cur = event.phase(self.db)
        active = phs[cur - 1]
        return {
            "phase": cur,
            "status": event.status(self.db),
            "serverStatus": "degraded" if degraded else "connected",
            "startTime": phs[0]["startTime"],
            "endTime": active["endTime"],
            "serverTime": event.iso(now()),
            "announcement": self.db.kv_get("announcement", "") or "",
        }

    def challenge_view(self, team: sqlite3.Row, base: dict) -> dict:
        row = self.db.conn().execute(
            "SELECT "
            " SUM(status='ACCEPTED' AND valid=1) AS solved,"
            " COUNT(*) AS attempts "
            "FROM submissions WHERE team_pk=? AND challenge=? AND valid=1",
            (team["pk"], base["id"]),
        ).fetchone()
        status = "SOLVED" if row["solved"] else "IN_PROGRESS" if row["attempts"] else "NOT_STARTED"
        return {**base, "status": status}

    def require_obelisk(self, team: sqlite3.Row) -> None:
        if not self.obelisk_open(team):
            raise ApiError(403, "PHASE_NOT_OPEN",
                           "OBELISK is locked until the organizers open Phase 2")

    def challenges(self, team) -> list[dict]:
        self.require_obelisk(team)
        return [self.challenge_view(team, c) for c in self.content.challenges]

    # --- games ---------------------------------------------------------------

    def game_results(self, team: sqlite3.Row) -> dict:
        return games.results(self.db, team["pk"])

    def start_game(self, team: sqlite3.Row, body: dict) -> dict:
        try:
            return games.start(self.db, team["pk"], body.get("game", ""))
        except games.GameError as exc:
            raise ApiError(exc.status, exc.code, exc.message)

    def record_game(self, team: sqlite3.Row, body: dict) -> dict:
        try:
            return games.record(self.db, team["pk"], body)
        except games.GameError as exc:
            raise ApiError(exc.status, exc.code, exc.message)

    # --- submissions -------------------------------------------------------

    def solved_by(self, team_pk: int, judged_only: bool = False) -> set[str]:
        """Challenges the team has solved. ``judged_only`` skips solves granted by an organizer
        (their patch is not in the team's tree, so their tests must not be required)."""
        rows = self.db.conn().execute(
            "SELECT DISTINCT challenge FROM submissions WHERE team_pk=? AND status='ACCEPTED' AND valid=1"
            + (" AND manual=0" if judged_only else ""),
            (team_pk,),
        ).fetchall()
        return {r["challenge"] for r in rows}

    def flag(self, team_pk, submission_id, kind: str, detail: str) -> None:
        self.db.conn().execute(
            "INSERT INTO flags(team_pk, submission_id, kind, detail, created) VALUES(?,?,?,?,?)",
            (team_pk, submission_id, kind, detail[:500], now()),
        )

    def submit(self, team: sqlite3.Row, challenge: str, patch_text: str) -> dict:
        challenge = (challenge or "").strip().upper()
        if not self.content.get(challenge):
            raise ApiError(404, "UNKNOWN_CHALLENGE", f"no such challenge: {challenge}")
        ok, why = event.accepting_submissions(self.db)
        if not ok:
            raise ApiError(403, why, "submissions are closed right now")
        if not isinstance(patch_text, str) or not patch_text.strip():
            raise ApiError(400, "MISSING_PATCH", "patch text is required")
        if not self.assets.ok:
            raise ApiError(503, "JUDGE_UNAVAILABLE", "judge assets are not installed")

        with self.db.transaction() as c:
            busy = c.execute(
                "SELECT id FROM submissions WHERE team_pk=? AND status IN ('QUEUED','RUNNING')",
                (team["pk"],),
            ).fetchone()
            if busy:
                raise ApiError(409, "ACTIVE_SUBMISSION", "a previous submission is still being judged",
                               submissionId=busy["id"])
            last = c.execute(
                "SELECT MAX(created) AS t FROM submissions WHERE team_pk=?", (team["pk"],)
            ).fetchone()["t"]
            wait = self.cooldown() - (now() - last) if last else 0
            if wait > 0:
                raise ApiError(429, "COOLDOWN", "submitting too quickly", retryAfter=round(wait, 1))
            cur = c.execute(
                "INSERT INTO submissions(team_pk, challenge, status, created) VALUES(?,?, 'QUEUED', ?)",
                (team["pk"], challenge, now()),
            )
            sub_id = cur.lastrowid

            reason = None
            sha, changed = patches.fingerprint(patch_text) if isinstance(patch_text, str) else ("", 0)
            if challenge in self.solved_by(team["pk"]):
                reason = "ALREADY_SOLVED"
            else:
                try:
                    patches.validate(patch_text, challenge, self.cfg.allowed_prefix, self.cfg.max_patch_bytes)
                except patches.PatchError as exc:
                    reason = exc.reason
                    if exc.reason == "FORBIDDEN_PATH":
                        self.flag(team["pk"], sub_id, "FORBIDDEN_PATH", exc.detail)
            if changed >= 8:  # tiny one-line fixes are legitimately identical across teams
                twin = c.execute(
                    "SELECT s.id, t.team_id FROM submissions s JOIN teams t ON t.pk=s.team_pk "
                    "WHERE s.patch_sha=? AND s.team_pk<>? ORDER BY s.id LIMIT 1", (sha, team["pk"])
                ).fetchone()
                if twin:
                    self.flag(team["pk"], sub_id, "DUPLICATE_PATCH",
                              f"identical to submission #{twin['id']} from {twin['team_id']}")
            if reason:
                c.execute(
                    "UPDATE submissions SET status='REJECTED', reason=?, patch_sha=?, finished=? WHERE id=?",
                    (reason, sha, now(), sub_id),
                )
            else:
                path = self.cfg.patches_dir / f"{sub_id}.patch"
                path.write_text(patch_text, encoding="utf-8", newline="\n")
                c.execute(
                    "UPDATE submissions SET patch_file=?, patch_sha=? WHERE id=?",
                    (str(path.name), sha, sub_id),
                )
        return self.submission_view(sub_id)

    def submission_view(self, sub_id: int) -> dict:
        r = self.db.conn().execute("SELECT * FROM submissions WHERE id=?", (sub_id,)).fetchone()
        out = {
            "id": r["id"],
            "challenge": r["challenge"],
            "status": r["status"],
            "passed": r["passed"],
            "total": r["total"],
            "reason": r["reason"],
            "submittedAt": event.iso(r["created"]),
        }
        if r["status"] == "QUEUED":
            ahead = self.db.conn().execute(
                "SELECT COUNT(*) AS n FROM submissions WHERE status='QUEUED' AND id<?", (r["id"],)
            ).fetchone()["n"]
            out["queuePosition"] = ahead + 1
        return out

    def submission_for(self, team: sqlite3.Row, sub_id: int) -> dict:
        r = self.db.conn().execute(
            "SELECT team_pk FROM submissions WHERE id=?", (sub_id,)
        ).fetchone()
        if r is None or r["team_pk"] != team["pk"]:
            raise ApiError(404, "NOT_FOUND", "no such submission")
        return self.submission_view(sub_id)

    def submissions_for(self, team: sqlite3.Row, limit: int = 50) -> list[dict]:
        ids = self.db.conn().execute(
            "SELECT id FROM submissions WHERE team_pk=? ORDER BY id DESC LIMIT ?", (team["pk"], limit)
        ).fetchall()
        return [self.submission_view(r["id"]) for r in ids]

    # --- start-up ----------------------------------------------------------

    def recover(self) -> int:
        cur = self.db.conn().execute(
            "UPDATE submissions SET status='QUEUED', started=NULL WHERE status='RUNNING'"
        )
        return cur.rowcount

    def read_patch(self, name: str) -> str:
        return (self.cfg.patches_dir / name).read_text(encoding="utf-8")
