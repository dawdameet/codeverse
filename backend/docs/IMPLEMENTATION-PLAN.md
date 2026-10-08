# Codeverse backend - architecture & implementation plan

## Decisions (from the organizer)
| Topic | Decision |
|---|---|
| Scale | 30 teams, one laptop each; one server laptop (i5-class), one router/switch |
| Server OS | Ubuntu CLI over SSH; must also run on macOS and Windows for testing |
| Dependencies | **None** for participants; server is **Python stdlib only** (+ `git` for applying patches) |
| Sandbox | no Docker: subprocess in a throw-away directory, timeouts, process-tree kill, minimal env |
| Scoring | points per bug + **time bonus computed at the end**, relative to all solvers of that bug |
| Submission | any bug order; the commit must be labelled `FIX[OB-00X]` and match the claimed bug |
| Feedback | participants see **PASSED/TOTAL only** (plus a one-word reason when nothing could be judged) |
| Bonus (formula engine) / Phase 2 | skipped for now; endpoints exist as stubs |
| Threat model | low (supervised); integrity checks exist for correctness, not hostile attackers |

## Components
```
 participant CLI --HTTP--> [ API (ThreadingHTTPServer) ] --> SQLite (WAL)  <-- admin CLI (SSH)
 website (Next.js) -HTTP->        |  validate + enqueue                ^
                                  v                                    |
                           queue = rows with status QUEUED  --> [ worker threads ] --> judge --> verdict
```
One Python process (`serve`) runs the API and N worker threads. SQLite is the queue, results store and
audit trail, so a crash or reboot loses nothing (RUNNING jobs return to QUEUED on start-up).
The admin CLI talks to the same database file directly, so you can operate over SSH while the server runs.

## Submission lifecycle
1. **Intake** (`POST /api/submissions`): auth, event is LIVE, claimed bug exists and is not already solved,
   team has no job in flight, cool-down respected, patch size sane.
2. **Static checks** on the patch: `git format-patch` text; commit subject contains `FIX[<bug>]` equal to the
   claimed bug; every touched path is under `src/obelisk/`; no binary or symlink changes. Violations are
   REJECTED immediately (and logged to `flags` for the organizers). This replaces "check if tests were altered":
   tests can't be altered because the server never uses the participant's tests.
3. **Queue**: status QUEUED, FIFO.
4. **Judge** (worker): fresh directory = official base release + team's already-accepted patches + new patch,
   plus the private tests overlaid. Run the public and private suites against that tree.
5. **Verdict**: judged set = target tests of the claimed bug + tests of bugs the team already solved + all tests
   that belong to no bug. `passed/total` over that set; **ACCEPTED iff passed == total**. If the patch also
   fully fixes a *different* unsolved bug it is rejected (one bug = one patch).
6. **Scoring**: accepted submissions are the only source of truth; leaderboard is derived from them.
7. **OB-006** (timing sensitive) takes an exclusive gate so no other job runs while it is measured.

## Scoring
`base` = sum of points of solved bugs (shown live). For each bug, solvers are ordered by submission-receipt time;
with N solvers the solver at rank r (1 = first) gets `points * MAX_BONUS * (N - r) / (N - 1)` (N = 1 gets the full
bonus). `MAX_BONUS` defaults to 0.5. Bonuses are computed by `admin finalize` once the event ends, after which the
leaderboard score includes them. The formula lives in one function (`scoring.py`) so it is easy to change.

## HTTP API (matches the website's `CodeverseApi`)
Public: `POST /api/login`, `GET /api/status`, `GET /api/phases`, `GET /api/leaderboard`, `GET /api/health`
Team (Bearer token): `GET /api/me`, `GET /api/challenges`, `GET /api/challenges/{id}`, `GET /api/bonus`,
`POST /api/submissions`, `GET /api/submissions/{id}`, `GET /api/submissions`

## Database (SQLite)
`teams`, `tokens`, `submissions`, `flags`, `kv` (event state). See `db.py`.

## Admin CLI (`python -m codeverse_server admin ...`)
`init`, `import-teams`, `start`, `pause`, `resume`, `end`, `status`, `queue`, `submissions`, `rejudge`,
`invalidate`, `disqualify`, `leaderboard`, `finalize`, `export`, `flags`.

## Milestones
1. Skeleton: config, DB, event state, auth, read-only API for the website  *(done)*
2. Submission intake, patch validation, queue  *(done)*
3. Judge + workers + scoring + leaderboard  *(done)*
4. Admin CLI  *(done)*
5. Backend tests incl. end-to-end with real OBELISK patches  *(done)*
6. **Next:** participant CLI (separate), load test with 30 simulated teams, venue runbook (static IP, systemd unit, firewall).

## Open assumptions to confirm
- Bonus formula above (linear by solve order, max +50%, hidden until `finalize`).
- Re-submitting an already-solved bug is rejected, not re-judged.
- Rate limit: one job in flight per team and a 15 s cool-down between submissions.
