# Codeverse backend

Judging server + API for CODEVERSE 2.0. **Python standard library only** (plus `git` on the PATH, used to
apply patches). Runs the same on Ubuntu, macOS and Windows; participants install nothing.

Architecture and decisions: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

## Quick launch (from any directory)

```
./run_backend.sh                 # judge + API on :8080 (builds judge assets on first run)
./run_frontend.sh                # website on :3000, proxies /api to the backend
./run_frontend.sh --mock         # website alone with mock data
```
Team/event administration is done with the `admin` commands below.

## Set-up (once)

```
cd backend
python3 scripts/prepare_judge_assets.py        # copies base release + private tests from ../OBELISK
python3 -m codeverse_server admin make-teams --count 30 --out teams.csv   # then edit team names
python3 -m codeverse_server admin import-teams teams.csv
python3 -m codeverse_server admin init         # sanity check
```

Re-run `prepare_judge_assets.py` whenever OBELISK or its tests change. Hand out each team's
`teamId` / `accessCode` from `teams.csv`.

## Run

```
python3 -m codeverse_server serve              # API + workers, prints the LAN addresses
python3 -m codeverse_server admin start --phase1-minutes 180      # open the event
```

Environment (all optional): `CODEVERSE_HOST` (0.0.0.0), `CODEVERSE_PORT` (8080), `CODEVERSE_WORKERS` (2),
`CODEVERSE_DATA` (backend/data), `CODEVERSE_ASSETS` (backend/judge_assets), `CODEVERSE_MAX_BONUS` (0.5),
`CODEVERSE_COOLDOWN` (15 s between submissions per team).

### Website + participant CLI (one address for everything)
```
cd frontend
echo "NEXT_PUBLIC_CODEVERSE_API=http" > .env.local      # build-time switch from mock data to the backend
npm run build && npm start -- -p 3000
```
The website calls same-origin `/api/...`; `frontend/next.config.ts` proxies it to `CODEVERSE_BACKEND_URL`
(default `http://127.0.0.1:8080`, i.e. the backend on the same laptop). Participants therefore need only
**one address**, `http://<laptop-ip>:3000`, for both the website and the CLI:
`python codeverse.py login --server <laptop-ip>:3000` (see `cli/README.md`). Fonts are bundled, nothing is
fetched from the internet.

## During the event (over SSH)

```
python3 -m codeverse_server admin status | queue | submissions [--team CV-007] | leaderboard | flags
python3 -m codeverse_server admin pause | resume | end | phase 2
python3 -m codeverse_server admin rejudge <id>          # after a JUDGE_ERROR or a fixed test
python3 -m codeverse_server admin invalidate <id>       # stops a submission scoring (--undo to restore)
python3 -m codeverse_server admin disqualify CV-007     # (--undo)
python3 -m codeverse_server admin end
python3 -m codeverse_server admin finalize              # publishes scores with the time bonus
python3 -m codeverse_server admin export --out results.csv
```

Pausing shifts all deadlines by the pause length. Back up `backend/data/` (it contains the database and every submitted patch).

## API (what the participant CLI and website use)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/login` `{teamId, accessCode}` | - | returns `{token, participantId}` |
| GET | `/api/status`, `/api/phases`, `/api/leaderboard`, `/api/health` | - | |
| GET | `/api/me`, `/api/challenges`, `/api/challenges/{id}`, `/api/bonus` | Bearer | |
| POST | `/api/submissions` `{challenge, patch}` | Bearer | `patch` = `git format-patch --stdout -1` text; returns the submission |
| GET | `/api/submissions/{id}` , `/api/submissions` | Bearer | poll until `status` is not QUEUED/RUNNING |

Submission result: `{id, challenge, status, passed, total, reason, queuePosition?}`.
`status` is `QUEUED`, `RUNNING`, `ACCEPTED`, `REJECTED` or `ERROR`; participants only ever see `passed/total`,
plus a one-word `reason` when the patch could not be judged (`LABEL_MISSING`, `LABEL_MISMATCH`,
`FORBIDDEN_PATH`, `BAD_PATCH`, `DOES_NOT_APPLY`, `ALREADY_SOLVED`, `MULTIPLE_FIXES`, `TIMEOUT`).
Errors: `401` bad token, `403` event not live, `409` a submission is already in flight, `429` cool-down.

## Tests

```
cd backend/tests && python3 -W ignore -m unittest test_backend test_cli_e2e   # ~5 min: runs real judging
```
