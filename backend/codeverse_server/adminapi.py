"""Admin panel API (``/api/admin/*``) and the single-page UI (``/admin``)."""

from __future__ import annotations

import csv
import io
import json
import re
import secrets
import sqlite3
import time
from pathlib import Path

from . import auth, event, scoring
from .db import now
from .service import ApiError, App

UI_FILE = Path(__file__).resolve().parent.parent / "admin_ui" / "index.html"


# --- token ------------------------------------------------------------------


def admin_token(app: App) -> str:
    """Token from CODEVERSE_ADMIN_TOKEN, else a generated one stored in the data directory."""
    import os

    env = os.environ.get("CODEVERSE_ADMIN_TOKEN")
    if env:
        return env
    f = app.cfg.data_dir / "admin_token.txt"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(12), encoding="utf-8")
    return f.read_text(encoding="utf-8").strip()


def check(app: App, header_token: str, client_ip: str) -> None:
    import os

    if os.environ.get("CODEVERSE_ADMIN_LOCAL_ONLY") == "1" and client_ip not in ("127.0.0.1", "::1"):
        raise ApiError(403, "ADMIN_LOCAL_ONLY", "the admin panel is only available from the server itself")
    if not header_token or not secrets.compare_digest(header_token, admin_token(app)):
        raise ApiError(401, "ADMIN_UNAUTHORIZED", "invalid admin token")


# --- helpers ----------------------------------------------------------------


def _d(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def _team(app: App, team_id: str) -> sqlite3.Row:
    row = app.db.conn().execute("SELECT * FROM teams WHERE team_id=?", (str(team_id).strip().upper(),)).fetchone()
    if row is None:
        raise ApiError(404, "NOT_FOUND", f"no such team: {team_id}")
    return row


def _sub(app: App, sub_id: int) -> sqlite3.Row:
    row = app.db.conn().execute("SELECT * FROM submissions WHERE id=?", (sub_id,)).fetchone()
    if row is None:
        raise ApiError(404, "NOT_FOUND", f"no such submission: {sub_id}")
    return row


def _challenge(app: App, cid: str) -> str:
    cid = str(cid or "").strip().upper()
    if not app.content.get(cid):
        raise ApiError(404, "UNKNOWN_CHALLENGE", f"no such challenge: {cid}")
    return cid


def _next_team_id(app: App) -> str:
    nums = [
        int(m.group(1))
        for r in app.db.conn().execute("SELECT team_id FROM teams")
        if (m := re.fullmatch(r"CV-(\d+)", r["team_id"]))
    ]
    return f"CV-{(max(nums) + 1) if nums else 1:03d}"


def _team_view(app: App, rows_by_pk: dict, t: sqlite3.Row) -> dict:
    c = app.db.conn()
    stats = c.execute(
        "SELECT COUNT(*) AS n, MAX(created) AS last FROM submissions WHERE team_pk=?", (t["pk"],)
    ).fetchone()
    flags = c.execute(
        "SELECT COUNT(*) AS n FROM flags WHERE team_pk=? AND resolved=0", (t["pk"],)
    ).fetchone()["n"]
    b = rows_by_pk.get(t["pk"], {})
    return {
        "teamId": t["team_id"],
        "teamName": t["team_name"],
        "accessCode": t["code_plain"],
        "disqualified": bool(t["disqualified"]),
        "submissions": stats["n"],
        "lastSubmission": stats["last"],
        "openFlags": flags,
        "score": b.get("score"),
        "rank": b.get("rank"),
        "solved": b.get("solvedCount"),
    }


# --- overview / event -----------------------------------------------------------


def overview(app: App) -> dict:
    c = app.db.conn()
    by_status = {r["status"]: r["n"] for r in c.execute("SELECT status, COUNT(*) AS n FROM submissions GROUP BY status")}
    depth, age = app.queue_depth()
    backups_dir = app.cfg.data_dir / "backups"
    backups = sorted(p.name for p in backups_dir.glob("*.db")) if backups_dir.exists() else []
    phs = event.phases(app.db)
    return {
        "event": {
            "status": event.status(app.db),
            "phase": event.phase(app.db),
            "phases": phs,
            "finalized": app.finalized(),
            "announcement": app.db.kv_get("announcement", "") or "",
        },
        "settings": {"maxBonus": app.max_bonus(), "cooldownSeconds": app.cooldown()},
        "queue": {"inFlight": depth, "oldestSeconds": round(age, 1), "workers": app.cfg.workers},
        "counts": {
            "teams": c.execute("SELECT COUNT(*) FROM teams").fetchone()[0],
            "disqualified": c.execute("SELECT COUNT(*) FROM teams WHERE disqualified=1").fetchone()[0],
            "submissions": c.execute("SELECT COUNT(*) FROM submissions").fetchone()[0],
            "byStatus": by_status,
            "openFlags": c.execute("SELECT COUNT(*) FROM flags WHERE resolved=0").fetchone()[0],
        },
        "judgeReady": app.assets.ok,
        "backups": backups[-5:],
        "serverTime": now(),
    }


def event_action(app: App, body: dict) -> dict:
    action = str(body.get("action", ""))
    db = app.db
    if action == "start":
        event.start(db, float(body.get("phase1Minutes", 180)), float(body.get("phase2Minutes", 90)),
                    float(body.get("gapMinutes", 15)))
    elif action == "pause":
        event.pause(db)
    elif action == "resume":
        event.resume(db)
    elif action == "end":
        event.end(db)
    elif action == "phase":
        n = int(body.get("number", 1))
        if n not in (1, 2):
            raise ApiError(400, "BAD_REQUEST", "phase must be 1 or 2")
        event.set_phase(db, n)
    elif action == "finalize":
        db.kv_set("finalized", 1)
    elif action == "unfinalize":
        db.kv_set("finalized", 0)
    elif action == "extend":
        minutes = float(body.get("minutes", 0))
        key = f"phase{event.phase(db)}_end"
        db.kv_set(key, float(db.kv_get(key, "0")) + minutes * 60)
    else:
        raise ApiError(400, "BAD_REQUEST", f"unknown action: {action}")
    app.audit(f"event:{action}", json.dumps({k: v for k, v in body.items() if k != "action"}))
    return overview(app)


def set_announcement(app: App, body: dict) -> dict:
    text = str(body.get("text", "")).strip()[:300]
    app.db.kv_set("announcement", text)
    app.audit("announcement", text or "(cleared)")
    return {"announcement": text}


def set_settings(app: App, body: dict) -> dict:
    if "maxBonus" in body:
        v = float(body["maxBonus"])
        if not 0 <= v <= 5:
            raise ApiError(400, "BAD_REQUEST", "maxBonus must be between 0 and 5")
        app.db.kv_set("max_bonus", v)
    if "cooldownSeconds" in body:
        v = float(body["cooldownSeconds"])
        if not 0 <= v <= 3600:
            raise ApiError(400, "BAD_REQUEST", "cooldownSeconds must be between 0 and 3600")
        app.db.kv_set("cooldown", v)
    app.audit("settings", json.dumps(body))
    return overview(app)["settings"]


def create_backup(app: App) -> dict:
    d = app.cfg.data_dir / "backups"
    d.mkdir(parents=True, exist_ok=True)
    target = d / f"codeverse-{time.strftime('%Y%m%d-%H%M%S')}.db"
    dest = sqlite3.connect(str(target))
    try:
        app.db.conn().backup(dest)
    finally:
        dest.close()
    app.audit("backup", target.name)
    return {"file": str(target), "name": target.name}


# --- teams -------------------------------------------------------------------------


def teams(app: App) -> list[dict]:
    board = {r["pk"]: r for r in scoring.leaderboard(app.db, app.content, app.max_bonus(), app.finalized())}
    rows = app.db.conn().execute("SELECT * FROM teams ORDER BY team_id").fetchall()
    out = []
    for t in rows:
        v = _team_view(app, board, t)
        if t["disqualified"]:
            v["score"], v["rank"] = None, None
        out.append(v)
    return out


def create_team(app: App, body: dict) -> dict:
    name = str(body.get("teamName", "")).strip()
    if not name:
        raise ApiError(400, "BAD_REQUEST", "teamName is required")
    team_id = str(body.get("teamId", "")).strip().upper() or _next_team_id(app)
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{1,30}", team_id):
        raise ApiError(400, "BAD_REQUEST", "teamId may contain letters, digits and dashes")
    if app.db.conn().execute("SELECT 1 FROM teams WHERE team_id=?", (team_id,)).fetchone():
        raise ApiError(409, "TEAM_EXISTS", f"{team_id} already exists")
    code = str(body.get("accessCode", "")).strip() or auth.new_code()
    auth.upsert_team(app.db, team_id, name, code)
    app.audit("team:create", f"{team_id} {name}")
    return {"teamId": team_id, "teamName": name, "accessCode": code}


def bulk_teams(app: App, body: dict) -> list[dict]:
    created = []
    if body.get("csv"):
        reader = csv.reader(io.StringIO(str(body["csv"])))
        for row in reader:
            row = [x.strip() for x in row]
            if not row or not any(row) or row[0].lower() in ("teamid", "team id"):
                continue
            # accepted shapes: name | teamId,name | teamId,name,code
            if len(row) == 1:
                payload = {"teamName": row[0]}
            elif len(row) == 2:
                payload = {"teamId": row[0], "teamName": row[1]}
            else:
                payload = {"teamId": row[0], "teamName": row[1], "accessCode": row[2]}
            created.append(create_team(app, payload))
    else:
        count = int(body.get("count", 0))
        if not 1 <= count <= 200:
            raise ApiError(400, "BAD_REQUEST", "count must be between 1 and 200")
        prefix = str(body.get("namePrefix", "Team")).strip() or "Team"
        for _ in range(count):
            nxt = _next_team_id(app)
            created.append(create_team(app, {"teamName": f"{prefix} {int(nxt[3:]):02d}"}))
    return created


def update_team(app: App, team_id: str, body: dict) -> dict:
    t = _team(app, team_id)
    c = app.db.conn()
    changes = []
    if "teamName" in body:
        name = str(body["teamName"]).strip()
        if not name:
            raise ApiError(400, "BAD_REQUEST", "teamName must not be empty")
        c.execute("UPDATE teams SET team_name=? WHERE pk=?", (name, t["pk"]))
        changes.append(f"name={name}")
    new_code = None
    if body.get("resetCode") or body.get("accessCode"):
        new_code = str(body.get("accessCode") or "").strip() or auth.new_code()
        auth.upsert_team(app.db, t["team_id"], body.get("teamName") or t["team_name"], new_code)
        c.execute("DELETE FROM tokens WHERE team_pk=?", (t["pk"],))  # force re-login
        changes.append("code reset")
    if "disqualified" in body:
        c.execute("UPDATE teams SET disqualified=? WHERE pk=?", (1 if body["disqualified"] else 0, t["pk"]))
        changes.append("disqualified" if body["disqualified"] else "restored")
    app.audit("team:update", f"{t['team_id']}: {', '.join(changes) or 'no change'}")
    return _team_view(app, {}, _team(app, team_id)) | ({"newAccessCode": new_code} if new_code else {})


def delete_team(app: App, team_id: str) -> dict:
    t = _team(app, team_id)
    c = app.db.conn()
    if c.execute("SELECT 1 FROM submissions WHERE team_pk=?", (t["pk"],)).fetchone():
        raise ApiError(409, "HAS_SUBMISSIONS", "this team has submissions; disqualify it instead")
    for table in ("tokens", "adjustments", "flags"):
        c.execute(f"DELETE FROM {table} WHERE team_pk=?", (t["pk"],))
    c.execute("DELETE FROM teams WHERE pk=?", (t["pk"],))
    app.audit("team:delete", t["team_id"])
    return {"deleted": t["team_id"]}


# --- submissions ----------------------------------------------------------------------


def submissions(app: App, q: dict) -> dict:
    where, args = [], []
    if q.get("team"):
        where.append("t.team_id=?"); args.append(q["team"].upper())
    if q.get("challenge"):
        where.append("s.challenge=?"); args.append(q["challenge"].upper())
    if q.get("status"):
        where.append("s.status=?"); args.append(q["status"].upper())
    if q.get("valid") in ("0", "1"):
        where.append("s.valid=?"); args.append(int(q["valid"]))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    limit = max(1, min(int(q.get("limit", 100)), 500))
    offset = max(0, int(q.get("offset", 0)))
    c = app.db.conn()
    total = c.execute(f"SELECT COUNT(*) FROM submissions s JOIN teams t ON t.pk=s.team_pk {clause}", args).fetchone()[0]
    rows = c.execute(
        f"SELECT s.*, t.team_id, t.team_name, "
        f"(SELECT COUNT(*) FROM flags f WHERE f.submission_id=s.id AND f.resolved=0) AS open_flags "
        f"FROM submissions s JOIN teams t ON t.pk=s.team_pk {clause} ORDER BY s.id DESC LIMIT ? OFFSET ?",
        args + [limit, offset],
    ).fetchall()
    return {
        "total": total,
        "items": [
            {
                "id": r["id"], "teamId": r["team_id"], "teamName": r["team_name"], "challenge": r["challenge"],
                "status": r["status"], "passed": r["passed"], "total": r["total"], "reason": r["reason"],
                "created": r["created"], "finished": r["finished"], "valid": bool(r["valid"]),
                "manual": bool(r["manual"]), "openFlags": r["open_flags"], "hasPatch": bool(r["patch_file"]),
            }
            for r in rows
        ],
    }


def submission_detail(app: App, sub_id: int) -> dict:
    r = _sub(app, sub_id)
    t = app.db.conn().execute("SELECT team_id, team_name FROM teams WHERE pk=?", (r["team_pk"],)).fetchone()
    patch = ""
    if r["patch_file"]:
        try:
            patch = app.read_patch(r["patch_file"])
        except OSError:
            patch = "(patch file missing)"
    flags = [_d(f) for f in app.db.conn().execute("SELECT * FROM flags WHERE submission_id=? ORDER BY id", (sub_id,))]
    detail = json.loads(r["detail"]) if r["detail"] else {}
    return {
        **{k: r[k] for k in ("id", "challenge", "status", "passed", "total", "reason", "created", "started",
                             "finished", "patch_sha")},
        "valid": bool(r["valid"]), "manual": bool(r["manual"]),
        "teamId": t["team_id"], "teamName": t["team_name"],
        "patch": patch, "failedTests": detail.get("failed", []), "flags": flags,
    }


def submission_action(app: App, sub_id: int, body: dict) -> dict:
    r = _sub(app, sub_id)
    action = str(body.get("action", ""))
    c = app.db.conn()
    if action == "rejudge":
        if not r["patch_file"]:
            raise ApiError(409, "NO_PATCH", "this submission has no stored patch")
        c.execute("UPDATE submissions SET status='QUEUED', passed=NULL, total=NULL, reason=NULL, detail=NULL, "
                  "manual=0, started=NULL, finished=NULL WHERE id=?", (sub_id,))
    elif action in ("invalidate", "restore"):
        c.execute("UPDATE submissions SET valid=? WHERE id=?", (0 if action == "invalidate" else 1, sub_id))
    elif action == "accept":
        c.execute("UPDATE submissions SET status='ACCEPTED', reason='MANUAL_ACCEPT', manual=1, finished=? "
                  "WHERE id=?", (now(), sub_id))
    elif action == "reject":
        c.execute("UPDATE submissions SET status='REJECTED', reason='MANUAL_REJECT', manual=0, finished=? "
                  "WHERE id=?", (now(), sub_id))
    else:
        raise ApiError(400, "BAD_REQUEST", f"unknown action: {action}")
    app.audit(f"submission:{action}", f"#{sub_id} {r['challenge']}")
    return submission_detail(app, sub_id)


def bulk_rejudge(app: App, body: dict) -> dict:
    where, args = ["patch_file IS NOT NULL", "status IN ('REJECTED','ERROR','ACCEPTED')", "manual=0"], []
    if body.get("challenge"):
        where.append("challenge=?"); args.append(_challenge(app, body["challenge"]))
    if body.get("status"):
        where.append("status=?"); args.append(str(body["status"]).upper())
    if body.get("teamId"):
        where.append("team_pk=?"); args.append(_team(app, body["teamId"])["pk"])
    cur = app.db.conn().execute(
        "UPDATE submissions SET status='QUEUED', passed=NULL, total=NULL, reason=NULL, detail=NULL, "
        "started=NULL, finished=NULL WHERE " + " AND ".join(where), args)
    app.audit("rejudge:bulk", json.dumps(body))
    return {"requeued": cur.rowcount}


def grant_solve(app: App, body: dict) -> dict:
    t = _team(app, body.get("teamId", ""))
    cid = _challenge(app, body.get("challenge"))
    if cid in app.solved_by(t["pk"]):
        raise ApiError(409, "ALREADY_SOLVED", "the team has already solved this challenge")
    ts = now()
    app.db.conn().execute(
        "INSERT INTO submissions(team_pk, challenge, status, reason, created, finished, manual) "
        "VALUES(?,?, 'ACCEPTED', 'MANUAL_GRANT', ?, ?, 1)", (t["pk"], cid, ts, ts))
    app.audit("grant", f"{t['team_id']} {cid} {body.get('note', '')}")
    return {"granted": cid, "teamId": t["team_id"]}


# --- scores ----------------------------------------------------------------------------


def leaderboard(app: App) -> dict:
    rows = scoring.leaderboard(app.db, app.content, app.max_bonus(), True)
    solves = scoring.solve_times(app.db)
    ids = app.content.ids()
    return {
        "finalized": app.finalized(),
        "challenges": ids,
        "rows": [
            {
                "rank": r["rank"], "teamId": r["teamId"], "teamName": r["teamName"], "solved": r["solvedCount"],
                "base": r["base"], "bonus": r["bonus"], "adjustment": r["adjustment"], "score": r["score"],
                "solves": {c: solves.get(r["pk"], {}).get(c) for c in ids},
            }
            for r in rows
        ],
    }


def adjustments(app: App) -> list[dict]:
    rows = app.db.conn().execute(
        "SELECT a.*, t.team_id, t.team_name FROM adjustments a JOIN teams t ON t.pk=a.team_pk ORDER BY a.id DESC"
    ).fetchall()
    return [{"id": r["id"], "teamId": r["team_id"], "teamName": r["team_name"], "points": r["points"],
             "reason": r["reason"], "created": r["created"]} for r in rows]


def add_adjustment(app: App, body: dict) -> list[dict]:
    t = _team(app, body.get("teamId", ""))
    try:
        points = int(body.get("points"))
    except (TypeError, ValueError):
        raise ApiError(400, "BAD_REQUEST", "points must be a whole number (negative to deduct)")
    if points == 0 or abs(points) > 100000:
        raise ApiError(400, "BAD_REQUEST", "points must be non-zero")
    reason = str(body.get("reason", "")).strip()[:200]
    app.db.conn().execute("INSERT INTO adjustments(team_pk, points, reason, created) VALUES(?,?,?,?)",
                          (t["pk"], points, reason, now()))
    app.audit("adjustment", f"{t['team_id']} {points:+d} {reason}")
    return adjustments(app)


def delete_adjustment(app: App, adj_id: int) -> list[dict]:
    cur = app.db.conn().execute("DELETE FROM adjustments WHERE id=?", (adj_id,))
    if not cur.rowcount:
        raise ApiError(404, "NOT_FOUND", "no such adjustment")
    app.audit("adjustment:delete", f"#{adj_id}")
    return adjustments(app)


# --- flags & audit -------------------------------------------------------------------------


def flags(app: App, q: dict) -> list[dict]:
    where, args = [], []
    if q.get("resolved") in ("0", "1"):
        where.append("f.resolved=?"); args.append(int(q["resolved"]))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = app.db.conn().execute(
        f"SELECT f.*, t.team_id, t.team_name FROM flags f LEFT JOIN teams t ON t.pk=f.team_pk {clause} "
        f"ORDER BY f.resolved, f.id DESC LIMIT 500", args).fetchall()
    return [{"id": r["id"], "teamId": r["team_id"], "teamName": r["team_name"], "submissionId": r["submission_id"],
             "kind": r["kind"], "detail": r["detail"], "created": r["created"], "resolved": bool(r["resolved"]),
             "note": r["note"]} for r in rows]


def create_flag(app: App, body: dict) -> list[dict]:
    t = _team(app, body.get("teamId", ""))
    detail = str(body.get("detail", "")).strip()
    if not detail:
        raise ApiError(400, "BAD_REQUEST", "detail is required")
    sid = body.get("submissionId")
    if sid is not None:
        _sub(app, int(sid))
    app.flag(t["pk"], int(sid) if sid is not None else None, str(body.get("kind") or "MANUAL").upper()[:30], detail)
    app.audit("flag:create", f"{t['team_id']} {detail[:80]}")
    return flags(app, {})


def update_flag(app: App, flag_id: int, body: dict) -> list[dict]:
    cur = app.db.conn().execute(
        "UPDATE flags SET resolved=?, note=COALESCE(?, note) WHERE id=?",
        (1 if body.get("resolved") else 0, body.get("note"), flag_id))
    if not cur.rowcount:
        raise ApiError(404, "NOT_FOUND", "no such flag")
    app.audit("flag:update", f"#{flag_id} resolved={bool(body.get('resolved'))}")
    return flags(app, {})


def audit_log(app: App) -> list[dict]:
    return [_d(r) for r in app.db.conn().execute("SELECT * FROM audit ORDER BY id DESC LIMIT 200")]
