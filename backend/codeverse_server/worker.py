"""Worker threads: claim queued submissions and judge them."""

from __future__ import annotations

import logging
import threading
import time

from . import judge
from .db import now
from .service import App

log = logging.getLogger("codeverse.worker")


def claim(app: App):
    with app.db.transaction() as c:
        row = c.execute(
            "SELECT * FROM submissions WHERE status='QUEUED' AND patch_file IS NOT NULL "
            "ORDER BY id LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        c.execute("UPDATE submissions SET status='RUNNING', started=? WHERE id=?", (now(), row["id"]))
        return row


def process(app: App, row) -> None:
    sub_id, team_pk, bug = row["id"], row["team_pk"], row["challenge"]
    try:
        accepted = app.db.conn().execute(
            "SELECT patch_file FROM submissions WHERE team_pk=? AND status='ACCEPTED' AND valid=1 "
            "AND id<>? ORDER BY id",
            (team_pk, sub_id),
        ).fetchall()
        patches_text = [app.read_patch(r["patch_file"]) for r in accepted]
        solved = app.solved_by(team_pk)
        new_patch = app.read_patch(row["patch_file"])
        gate = app.gate.exclusive() if bug in app.cfg.exclusive_challenges else app.gate.shared()
        with gate:
            verdict = judge.judge(app.cfg, app.assets, sub_id, bug, new_patch, patches_text, solved)
        app.db.conn().execute(
            "UPDATE submissions SET status=?, passed=?, total=?, reason=?, finished=? WHERE id=?",
            (verdict.status, verdict.passed, verdict.total, verdict.reason, now(), sub_id),
        )
        log.info("submission %s (%s) -> %s %s/%s %s", sub_id, bug, verdict.status,
                 verdict.passed, verdict.total, verdict.reason or "")
    except Exception:  # never lose a job to a judge crash; admin can rejudge
        log.exception("judge error on submission %s", sub_id)
        app.db.conn().execute(
            "UPDATE submissions SET status='ERROR', reason='JUDGE_ERROR', finished=? WHERE id=?",
            (now(), sub_id),
        )


def run_worker(app: App, name: str) -> None:
    while not app.stop.is_set():
        row = claim(app)
        if row is None:
            time.sleep(0.4)
            continue
        process(app, row)


def start_workers(app: App) -> list[threading.Thread]:
    threads = []
    for i in range(app.cfg.workers):
        t = threading.Thread(target=run_worker, args=(app, f"w{i + 1}"), daemon=True, name=f"worker-{i + 1}")
        t.start()
        threads.append(t)
    return threads
