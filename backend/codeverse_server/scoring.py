"""Scores, time bonus and the leaderboard. All derived from accepted submissions."""

from __future__ import annotations

from .content import Content
from .db import Database


def solve_times(db: Database) -> dict[int, dict[str, float]]:
    """team_pk -> {challenge: receipt time of the first valid accepted submission}."""
    rows = db.conn().execute(
        "SELECT team_pk, challenge, MIN(created) AS t FROM submissions "
        "WHERE status='ACCEPTED' AND valid=1 GROUP BY team_pk, challenge"
    ).fetchall()
    out: dict[int, dict[str, float]] = {}
    for r in rows:
        out.setdefault(r["team_pk"], {})[r["challenge"]] = r["t"]
    return out


def bonus_for_solvers(times: dict[int, float], points: int, max_bonus: float) -> dict[int, float]:
    """Time bonus for one challenge.

    Solvers are ranked by solve time (rank 1 = first). With N solvers the solver at
    rank r gets ``points * max_bonus * (N - r) / (N - 1)``; a lone solver gets the
    full bonus. Dynamic: it changes as more teams solve the challenge.
    """
    ordered = sorted(times.items(), key=lambda kv: (kv[1], kv[0]))
    n = len(ordered)
    out = {}
    for rank, (team, _) in enumerate(ordered, start=1):
        factor = 1.0 if n == 1 else (n - rank) / (n - 1)
        out[team] = points * max_bonus * factor
    return out


def leaderboard(db: Database, content: Content, max_bonus: float, include_bonus: bool) -> list[dict]:
    teams = db.conn().execute(
        "SELECT pk, team_id, team_name FROM teams WHERE disqualified=0"
    ).fetchall()
    solves = solve_times(db)
    bonus: dict[int, float] = {t["pk"]: 0.0 for t in teams}
    if include_bonus:
        for cid in content.ids():
            per = {team: ts[cid] for team, ts in solves.items() if cid in ts and team in bonus}
            if per:
                for team, b in bonus_for_solvers(per, content.points(cid), max_bonus).items():
                    bonus[team] += b
    adj = {
        r["team_pk"]: r["total"]
        for r in db.conn().execute("SELECT team_pk, SUM(points) AS total FROM adjustments GROUP BY team_pk")
    }
    rows = []
    for t in teams:
        mine = {c: ts for c, ts in solves.get(t["pk"], {}).items() if c in content.ids()}
        base = sum(content.points(c) for c in mine)
        rows.append(
            {
                "pk": t["pk"],
                "teamId": t["team_id"],
                "teamName": t["team_name"],
                "base": base,
                "bonus": round(bonus[t["pk"]]),
                "adjustment": adj.get(t["pk"], 0),
                "score": base + round(bonus[t["pk"]]) + adj.get(t["pk"], 0),
                "solvedCount": len(mine),
                "lastSolve": max(mine.values()) if mine else float("inf"),
            }
        )
    rows.sort(key=lambda r: (-r["score"], -r["solvedCount"], r["lastSolve"], r["teamName"].lower()))
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows
