"""Event clock and phase state machine, stored in the kv table.

Statuses: NOT_STARTED -> LIVE <-> PAUSED -> ENDED.  Pausing shifts the
deadlines by the length of the pause so nobody loses time.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .db import Database, now

REOPEN_MINUTES = 10
PHASE_NAMES = {1: "THE INFILTRATION", 2: "THE ROYAL MINT"}
PHASE_TAGLINES = {
    1: "Five quick games to get the crew past the Mint's outer defences.",
    2: "Investigate and repair the compromised OBELISK system.",
}


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _f(db: Database, key: str, default: float = 0.0) -> float:
    return float(db.kv_get(key, str(default)))


def status(db: Database) -> str:
    return db.kv_get("event_status", "NOT_STARTED")


def phase(db: Database) -> int:
    current = int(db.kv_get("phase", "1"))
    # the games round ends on its own when its timer runs out: OBELISK (phase 2) opens automatically
    if current == 1 and status(db) == "LIVE" and now() >= _f(db, "phase1_end"):
        set_phase(db, 2)
        return 2
    return current


def start(db: Database, phase1_minutes: float = 60, phase2_minutes: float = 180, gap_minutes: float = 10) -> None:
    t = now()
    p1_end = t + phase1_minutes * 60
    p2_start = p1_end + gap_minutes * 60
    db.kv_set("event_status", "LIVE")
    db.kv_set("phase", 1)
    db.kv_set("event_start", t)
    db.kv_set("phase1_start", t)
    db.kv_set("phase1_end", p1_end)
    db.kv_set("phase2_start", p2_start)
    db.kv_set("phase2_end", p2_start + phase2_minutes * 60)
    db.kv_set("finalized", 0)


def pause(db: Database) -> None:
    if status(db) == "LIVE":
        db.kv_set("event_status", "PAUSED")
        db.kv_set("paused_at", now())


def resume(db: Database) -> None:
    if status(db) != "PAUSED":
        return
    delta = now() - _f(db, "paused_at", now())
    for key in ("phase1_end", "phase2_start", "phase2_end"):
        db.kv_set(key, _f(db, key) + delta)
    db.kv_set("event_status", "LIVE")


def end(db: Database) -> None:
    db.kv_set("event_status", "ENDED")
    db.kv_set("ended_at", now())


def set_phase(db: Database, number: int) -> None:
    db.kv_set("phase", number)
    if number == 2:
        t = now()
        length = _f(db, "phase2_end") - _f(db, "phase2_start", t)
        db.kv_set("phase2_start", t)
        db.kv_set("phase2_end", t + (length if length > 0 else 180 * 60))
        db.kv_set("phase1_end", min(_f(db, "phase1_end"), t))  # phase 1 is over once phase 2 opens
    elif number == 1:
        # going back to the games: give phase 1 some time again, or it would end (and re-open phase 2) at once
        t = now()
        if _f(db, "phase1_end") <= t:
            db.kv_set("phase1_end", t + REOPEN_MINUTES * 60)


def accepting_submissions(db: Database, unlocked_early: bool = False) -> tuple[bool, str]:
    """``unlocked_early``: the team finished all games, so OBELISK is already open for it in phase 1."""
    st = status(db)
    if st != "LIVE":
        return False, "EVENT_NOT_LIVE" if st != "ENDED" else "EVENT_ENDED"
    # OBELISK patches are only accepted in phase 2 (phase 1 is the games round)
    if phase(db) != 2 and not unlocked_early:
        return False, "PHASE_NOT_OPEN"
    if now() > _f(db, "phase2_end"):
        return False, "EVENT_ENDED"
    return True, ""


def phases(db: Database) -> list[dict]:
    st, cur = status(db), phase(db)
    t = now()
    if st == "NOT_STARTED":
        starts = {1: t, 2: t}
        ends = {1: t, 2: t}
    else:
        starts = {1: _f(db, "phase1_start"), 2: _f(db, "phase2_start")}
        ends = {1: _f(db, "phase1_end"), 2: _f(db, "phase2_end")}
    out = []
    for n in (1, 2):
        if st == "NOT_STARTED":
            ph = "UPCOMING"
        elif n < cur or (st == "ENDED" and n <= cur):
            ph = "COMPLETED"
        elif n == cur:
            ph = "ACTIVE"
        else:
            ph = "UPCOMING"
        out.append(
            {
                "id": n,
                "name": PHASE_NAMES[n],
                "tagline": PHASE_TAGLINES[n],
                "status": ph,
                "startTime": iso(starts[n]),
                "endTime": iso(ends[n]),
            }
        )
    return out
