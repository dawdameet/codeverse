"""Operator commands, run over SSH against the same database as the server."""

from __future__ import annotations

import argparse
import csv
import secrets
import sys
import time
from pathlib import Path

from . import auth, event
from .config import Config
from .db import now
from .service import App

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _fmt_time(ts) -> str:
    return time.strftime("%H:%M:%S", time.localtime(ts)) if ts else "-"


def cmd_init(app: App, a) -> int:
    print(f"data dir : {app.cfg.data_dir}")
    print(f"database : {app.cfg.db_path}")
    print(f"judge    : {'READY' if app.assets.ok else 'MISSING - run scripts/prepare_judge_assets.py'}")
    print(f"teams    : {app.db.conn().execute('SELECT COUNT(*) FROM teams').fetchone()[0]}")
    return 0


def cmd_make_teams(app: App, a) -> int:
    out = Path(a.out)
    with open(out, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["teamId", "teamName", "accessCode"])
        for i in range(1, a.count + 1):
            code = "".join(secrets.choice(ALPHABET) for _ in range(6))
            w.writerow([f"CV-{i:03d}", f"Team {i:02d}", code])
    print(f"wrote {a.count} teams to {out} - edit the names, then: admin import-teams {out}")
    return 0


def cmd_import_teams(app: App, a) -> int:
    n = 0
    with open(a.file, "r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            auth.upsert_team(app.db, row["teamId"], row["teamName"], row["accessCode"])
            n += 1
    print(f"imported {n} teams")
    return 0


def cmd_start(app: App, a) -> int:
    event.start(app.db, a.phase1_minutes, a.phase2_minutes, a.gap_minutes)
    print(f"event LIVE - phase 1 ends in {a.phase1_minutes:g} minutes")
    return 0


def cmd_simple(fn, message):
    def run(app: App, a) -> int:
        fn(app.db)
        print(message)
        return 0
    return run


def cmd_phase(app: App, a) -> int:
    event.set_phase(app.db, a.number)
    print(f"phase set to {a.number}")
    return 0


def cmd_status(app: App, a) -> int:
    s = app.status()
    n, age = app.queue_depth()
    print(f"event: {s['status']}  phase: {s['phase']}  server: {s['serverStatus']}")
    print(f"ends : {s['endTime']}")
    print(f"queue: {n} in flight (oldest {age:.0f}s)   finalized: {app.finalized()}")
    return 0


def cmd_queue(app: App, a) -> int:
    rows = app.db.conn().execute(
        "SELECT s.id, t.team_id, s.challenge, s.status, s.created, s.started FROM submissions s "
        "JOIN teams t ON t.pk=s.team_pk WHERE s.status IN ('QUEUED','RUNNING') ORDER BY s.id"
    ).fetchall()
    for r in rows:
        print(f"#{r['id']:<5} {r['team_id']:<8} {r['challenge']}  {r['status']:<8} queued {_fmt_time(r['created'])}")
    if not rows:
        print("queue empty")
    return 0


def cmd_submissions(app: App, a) -> int:
    q = ("SELECT s.*, t.team_id FROM submissions s JOIN teams t ON t.pk=s.team_pk "
         + ("WHERE t.team_id=? " if a.team else "") + "ORDER BY s.id DESC LIMIT ?")
    args = ([a.team.upper()] if a.team else []) + [a.limit]
    for r in app.db.conn().execute(q, args).fetchall():
        score = f"{r['passed']}/{r['total']}" if r["total"] is not None else "-"
        valid = "" if r["valid"] else "  INVALID"
        print(f"#{r['id']:<5} {r['team_id']:<8} {r['challenge']}  {r['status']:<9} {score:<8} "
              f"{_fmt_time(r['created'])}  {r['reason'] or ''}{valid}")
    return 0


def cmd_rejudge(app: App, a) -> int:
    cur = app.db.conn().execute(
        "UPDATE submissions SET status='QUEUED', passed=NULL, total=NULL, reason=NULL, "
        "started=NULL, finished=NULL WHERE id=? AND patch_file IS NOT NULL", (a.id,))
    print("requeued" if cur.rowcount else "nothing to do (submission has no stored patch?)")
    return 0 if cur.rowcount else 1


def cmd_invalidate(app: App, a) -> int:
    app.db.conn().execute("UPDATE submissions SET valid=?, reason=COALESCE(reason, ?) WHERE id=?",
                          (0 if not a.undo else 1, None if a.undo else "INVALIDATED", a.id))
    print("submission %s %s" % (a.id, "restored" if a.undo else "invalidated (no longer scores)"))
    return 0


def cmd_disqualify(app: App, a) -> int:
    cur = app.db.conn().execute("UPDATE teams SET disqualified=? WHERE team_id=?",
                                (0 if a.undo else 1, a.team.upper()))
    print("ok" if cur.rowcount else "no such team")
    return 0


def cmd_leaderboard(app: App, a) -> int:
    print(f"{'#':>3}  {'TEAM':<8} {'NAME':<24} {'SOLVED':>6} {'BASE':>5} {'BONUS':>5} {'SCORE':>6}")
    for r in app.board() if app.finalized() else _provisional(app):
        print(f"{r['rank']:>3}  {r['teamId']:<8} {r['teamName'][:24]:<24} {r['solvedCount']:>6} "
              f"{r['base']:>5} {r['bonus']:>5} {r['score']:>6}")
    if not app.finalized():
        print("(bonus shown is provisional; run `admin finalize` after the event)")
    return 0


def _provisional(app: App) -> list[dict]:
    from . import scoring
    return scoring.leaderboard(app.db, app.content, app.cfg.max_bonus, True)


def cmd_finalize(app: App, a) -> int:
    if event.status(app.db) != "ENDED" and not a.force:
        print("event has not ended; run `admin end` first (or pass --force)")
        return 1
    app.db.kv_set("finalized", 0 if a.undo else 1)
    print("final scores are now PUBLISHED (bonus included)" if not a.undo else "finalization undone")
    return 0


def cmd_export(app: App, a) -> int:
    from . import scoring
    rows = scoring.leaderboard(app.db, app.content, app.cfg.max_bonus, True)
    solves = scoring.solve_times(app.db)
    ids = app.content.ids()
    with open(a.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["rank", "teamId", "teamName", "solved", "base", "bonus", "score"] + [f"{c}_time" for c in ids])
        for r in rows:
            mine = solves.get(r["pk"], {})
            w.writerow([r["rank"], r["teamId"], r["teamName"], r["solvedCount"], r["base"], r["bonus"],
                        r["score"]] + [time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mine[c])) if c in mine else ""
                                       for c in ids])
    print(f"wrote {a.out}")
    return 0


def cmd_flags(app: App, a) -> int:
    rows = app.db.conn().execute(
        "SELECT f.*, t.team_id FROM flags f LEFT JOIN teams t ON t.pk=f.team_pk ORDER BY f.id DESC LIMIT ?",
        (a.limit,)).fetchall()
    for r in rows:
        print(f"{_fmt_time(r['created'])} {r['team_id'] or '-':<8} {r['kind']:<14} sub#{r['submission_id']} {r['detail']}")
    if not rows:
        print("no flags")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="codeverse_server admin")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name, fn, help_):
        sp = sub.add_parser(name, help=help_)
        sp.set_defaults(fn=fn)
        return sp

    add("init", cmd_init, "check data dir, database and judge assets")
    sp = add("make-teams", cmd_make_teams, "generate a teams.csv with random access codes")
    sp.add_argument("--count", type=int, default=30)
    sp.add_argument("--out", default="teams.csv")
    sp = add("import-teams", cmd_import_teams, "import/update teams from a CSV (teamId,teamName,accessCode)")
    sp.add_argument("file")
    sp = add("start", cmd_start, "open the event (phase 1)")
    sp.add_argument("--phase1-minutes", type=float, default=180)
    sp.add_argument("--phase2-minutes", type=float, default=90)
    sp.add_argument("--gap-minutes", type=float, default=15)
    add("pause", cmd_simple(event.pause, "event PAUSED (submissions closed)"), "pause the event")
    add("resume", cmd_simple(event.resume, "event LIVE (deadlines shifted by the pause)"), "resume the event")
    add("end", cmd_simple(event.end, "event ENDED"), "end the event")
    sp = add("phase", cmd_phase, "switch the active phase")
    sp.add_argument("number", type=int, choices=[1, 2])
    add("status", cmd_status, "event and queue status")
    add("queue", cmd_queue, "show in-flight submissions")
    sp = add("submissions", cmd_submissions, "recent submissions")
    sp.add_argument("--team")
    sp.add_argument("--limit", type=int, default=30)
    sp = add("rejudge", cmd_rejudge, "re-queue a submission")
    sp.add_argument("id", type=int)
    sp = add("invalidate", cmd_invalidate, "stop a submission from scoring")
    sp.add_argument("id", type=int)
    sp.add_argument("--undo", action="store_true")
    sp = add("disqualify", cmd_disqualify, "remove a team from play and the leaderboard")
    sp.add_argument("team")
    sp.add_argument("--undo", action="store_true")
    add("leaderboard", cmd_leaderboard, "print the leaderboard")
    sp = add("finalize", cmd_finalize, "publish final scores including the time bonus")
    sp.add_argument("--force", action="store_true")
    sp.add_argument("--undo", action="store_true")
    sp = add("export", cmd_export, "write results to a CSV")
    sp.add_argument("--out", default="results.csv")
    sp = add("flags", cmd_flags, "integrity flags (e.g. patches touching forbidden paths)")
    sp.add_argument("--limit", type=int, default=50)
    return p


def main(argv: list[str], cfg: Config | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.fn(App(cfg or Config()), args)
