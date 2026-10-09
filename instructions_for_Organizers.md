# Codeverse 2.0 - Organizer Handbook

Everything you need to run the event. **Organizers only** - this file mentions credentials and internals; do not publish it.
For a hands-on walkthrough as a participant, see [FLOW.md](FLOW.md).

---

## 0. The system in one picture

```
 Participant laptop                          Server laptop (Ubuntu, on the LAN)
 ┌────────────────────┐                      ┌──────────────────────────────────────────────┐
 │ OBELISK repo (git) │  codeverse submit    │  :3000  website (Next.js)  ──proxy /api──┐   │
 │ codeverse CLI      │ ───────────────────► │  :8080  backend: API + judge workers  ◄──┘   │
 │ browser (website)  │ ◄─────────────────── │         SQLite db, stored patches, admin UI  │
 └────────────────────┘   PASSED x/y         └──────────────────────────────────────────────┘
```

| Piece | Where | What it does |
|---|---|---|
| `OBELISK/` | repo | the competition project (buggy) + `ORGANIZERS-ONLY/` (reference, private tests, solutions) |
| `backend/` | repo | judging server, API, admin CLI, **admin panel** (`/admin`) |
| `frontend/` | repo | participant website (login, dashboard, challenges, docs, leaderboard) |
| `cli/` | repo | participant CLI (`codeverse.py`) - this is the folder you publish on GitHub |
| `run_backend.sh`, `run_frontend.sh` | repo root | start the two servers from any directory |

Participants only ever need **one address**: `http://<server-ip>:3000`. The website proxies `/api` to the backend, and the CLI uses the same address.

---

## 1. One-time server preparation (do this WITH internet, days before)

On the Ubuntu laptop:

| Need | Check | Install if missing |
|---|---|---|
| Python 3.10+ | `python3 --version` | `sudo apt install python3` |
| git | `git --version` | `sudo apt install git` |
| Node.js 20+ and npm | `node -v` | install Node 20 LTS (NodeSource or `nvm`); the Ubuntu apt default is too old |
| tmux (recommended) | `tmux -V` | `sudo apt install tmux` |
| curl | `curl --version` | `sudo apt install curl` |

Then:

```bash
git clone <your-repo-url> ~/codeverse          # or copy the folder over
cd ~/codeverse/frontend && npm install         # needs internet, once
cd ~/codeverse && ./run_frontend.sh --rebuild  # builds the website (fonts are bundled; no internet needed after install)
```
Stop it with `Ctrl-C` after it prints "Ready". The website build is cached in `frontend/.next`.

**The server never needs internet during the event.** Nothing fetches fonts, packages or APIs at runtime.

Laptop settings that prevent embarrassing outages:
- Plug into AC power. Disable sleep/suspend; close-lid must not suspend: set `HandleLidSwitch=ignore` and `HandleLidSwitchExternalPower=ignore` in `/etc/systemd/logind.conf`, then `sudo systemctl restart systemd-logind`.
- Correct time matters (the countdown and the time bonus use the server clock): `timedatectl` should say `System clock synchronized: yes`. If the venue has no internet, set it once by hand before the event (`sudo timedatectl set-time "YYYY-MM-DD HH:MM:SS"`) - never change it mid-event.
- Firewall (if `ufw` is on): `sudo ufw allow 22/tcp`, `sudo ufw allow 3000/tcp`. Allow `8080/tcp` **only** if you want to open the admin panel from another machine (it needs the token anyway; see section 4).

---

## 2. Finding the server's IP address ("IP extraction")

Participants need the address of this laptop on the venue network. Find it **after** the laptop is connected to the event router/switch.

**Ubuntu (what you will use):**
```bash
hostname -I                                   # all addresses, e.g. "192.168.1.40 172.17.0.1"
ip -4 -o addr show scope global               # interface + address
ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}'   # the address used for the default route
```
Use the address on the same subnet as the participants' laptops (usually `192.168.x.x` or `10.x.x.x`). Ignore `172.17.x.x` (Docker) and `127.0.0.1`.
The backend also prints it when it starts: `LAN address: http://192.168.1.40:8080` - use that IP with **port 3000** for participants.

**macOS (for rehearsals):** `ipconfig getifaddr en0` (Wi-Fi) or `en1`.
**Windows:** `ipconfig` and read "IPv4 Address".

**Make the address stable** - if the IP changes mid-event every participant's CLI breaks:
1. Best: a **DHCP reservation** on the router for the server's MAC address (`ip link` shows it).
2. Or a static address in netplan (`/etc/netplan/*.yaml`, set `dhcp4: false`, `addresses`, `routes`, then `sudo netplan apply`) - pick an address outside the router's DHCP pool.

Do **not** rely on `codeverse.local` (mDNS); Windows machines often cannot resolve it. Give people the numeric address, printed on a slide/poster.

Verify from a participant laptop before the event: open `http://<ip>:3000` in a browser, and run `curl http://<ip>:3000/api/health` (should print `{"ok": true, ...}`).

---

## 3. Starting the servers

Use two tmux windows (survive an SSH disconnect):

```bash
tmux new -s codeverse
cd ~/codeverse
./run_backend.sh                  # window 1  -> judge + API on :8080
# Ctrl-b c   (new window)
./run_frontend.sh                 # window 2  -> website on :3000
# Ctrl-b d   to detach;   tmux attach -t codeverse   to come back
```
Both scripts work from any directory.

**`./run_backend.sh`** - checks python/git, builds the judge assets from `OBELISK/` if they are missing, tells you if there are no teams yet, then serves. Extra flags pass through: `./run_backend.sh --port 9000 --workers 3`.
Useful environment variables (put them before the command):

| Variable | Default | Meaning |
|---|---|---|
| `CODEVERSE_PORT` | 8080 | backend port |
| `CODEVERSE_WORKERS` | 2 | parallel judge workers - **use `cores - 1`, max 4** on an i5 (judging is CPU-heavy) |
| `CODEVERSE_COOLDOWN` | 15 | seconds a team must wait between submissions (also editable in the admin panel) |
| `CODEVERSE_MAX_BONUS` | 0.5 | time-bonus fraction (editable in the admin panel) |
| `CODEVERSE_DATA` | `backend/data` | database, patches, logs, backups, admin token |
| `CODEVERSE_ASSETS` | `backend/judge_assets` | judge material (base release, private tests, mapping) |
| `CODEVERSE_ADMIN_TOKEN` | generated | admin panel token |
| `CODEVERSE_ADMIN_LOCAL_ONLY` | off | `1` = admin panel only reachable from the server itself |

Example for the event: `CODEVERSE_WORKERS=3 ./run_backend.sh`

**`./run_frontend.sh`** - builds if needed and serves on `0.0.0.0:3000`, proxying `/api` to `http://127.0.0.1:8080`.
`./run_frontend.sh --rebuild` forces a rebuild; `--mock` serves the demo mode (no backend); `PORT=8000 ./run_frontend.sh` changes the port.
It writes `frontend/.env.local` with `NEXT_PUBLIC_CODEVERSE_API=http` (mock vs real is decided at **build** time - that is why switching modes rebuilds).

Health checks:
```bash
curl localhost:8080/api/health        # {"ok": true, "queued": 0, "judgeReady": true, "workers": 3}
curl localhost:3000/api/status        # event status via the website proxy
```
`judgeReady: false` means the judge assets are missing - `./run_backend.sh` rebuilds them, or run `python3 backend/scripts/prepare_judge_assets.py`.

Restarting is safe: if the backend is killed while judging, interrupted submissions go back to the queue on the next start and nothing is lost.

---

## 4. Credentials - who has what

| Credential | Who | Where it lives | How to get / change it |
|---|---|---|---|
| **Admin token** | you only | printed at backend start-up; `backend/data/admin_token.txt` | `python3 -m codeverse_server admin token` (run from `backend/`); or set `CODEVERSE_ADMIN_TOKEN` yourself |
| **Team ID + access code** | each team | generated by you; shown in the admin panel > Teams (click the dots to reveal) | panel: add / generate / "New code"; or `admin make-teams` + `import-teams` |
| **Team session token** | CLI/website (automatic) | participant's `~/.codeverse/config.json` / browser storage | issued at login; "New code" in the panel invalidates it |
| SSH to the laptop | you | - | - |

Creating the teams (pick one):
- **Panel:** Teams tab > *Bulk > Generate teams* (e.g. 30), or paste lines `Team name` / `CV-050,Team name` / `CV-050,Team name,CODE12`. Then **Download credentials (CSV)** or **Print credential slips** and hand each team its slip.
- **CLI:** from `backend/`:
  ```bash
  python3 -m codeverse_server admin make-teams --count 30 --out teams.csv     # edit the names in the file
  python3 -m codeverse_server admin import-teams teams.csv
  ```
Team IDs look like `CV-001`; codes are 6 characters without look-alikes (no 0/O/1/I). IDs are not case-sensitive.
**Admin panel:** `http://<server-ip>:8080/admin` -> paste the token. (Participants can technically reach this port; the token protects it. To lock it down: `CODEVERSE_ADMIN_LOCAL_ONLY=1` and use `ssh -L 8080:localhost:8080 you@server`, then browse `http://localhost:8080/admin`.)

Treat `backend/data/` as sensitive: it contains plain-text access codes and every submitted patch.

---

## 5. What participants receive

Hand out **before the event, while they still have internet**:
1. **OBELISK repository** - the participant release. Publish it from a *clean export*, never from this repo's git history (it contains `ORGANIZERS-ONLY/`). Follow `OBELISK/ORGANIZERS-ONLY/RELEASE-CHECKLIST.md`.
2. **The `cli/` folder** - pushed to GitHub (it is a single file, `codeverse.py`, standard library only, plus `codeverse` / `codeverse.cmd` launchers).
3. Their **team slip**: team ID, access code, and the server address `http://<ip>:3000`.

They need Python 3.10+ and git (OBELISK needs 3.10+; the CLI itself works on 3.8+). On the day they only run:
```
python codeverse.py login --server <ip>:3000     # team ID + access code
python codeverse.py submit OB-003                 # from inside their OBELISK folder, after committing FIX[OB-003]
```

> **Critical:** the judge compares against the exact release participants have. After you publish OBELISK, rebuild the judge assets from **that** release (`python3 backend/scripts/prepare_judge_assets.py --obelisk <path-to-released-copy>`), or any later edit to OBELISK makes patches fail with "does not apply". Never edit OBELISK after publishing without republishing and rebuilding.

---

## 6. Running the event

### 6.1 Pre-event checklist (T-1 day)
- [ ] Servers start cleanly on the real laptop and the real network; `curl http://<ip>:3000/api/health` works from a *participant* laptop.
- [ ] IP is fixed (reservation/static) and written on the slides.
- [ ] Teams created, slips printed, **one test login per OS** (Windows, macOS, Linux) with the CLI.
- [ ] A full dry run with a spare team: do the whole [FLOW.md](FLOW.md); then **disqualify/delete the test team** (panel > Teams) and rebuild a clean database (or note which test submissions to invalidate).
- [ ] Judge assets rebuilt from the released OBELISK; `judgeReady: true`.
- [ ] Load rehearsal: ~10 laptops submit at once (expect ~15 s per judging run; see "Capacity").
- [ ] Backup taken (panel > Overview > *Create database backup now*), copied off the laptop (USB).
- [ ] Laptop on AC power, sleep disabled, clock correct.
- [ ] Printed list: IP, admin token, your phone number.

### 6.2 Start of event
1. Servers running (section 3). Admin panel signed in.
2. Overview > **Start event** (Phase 1 = games, default 60 min; Phase 2 = OBELISK, default 180 min) - or `admin start --phase1-minutes 60 --phase2-minutes 180`. The event opens in **Phase 1**: participants play the five games; the OBELISK challenges are locked on the website and CLI submissions are refused (`PHASE_NOT_OPEN`).
   **Phase 2 never starts by itself.** When the games round is over, press Overview > "Open phase 2 (OBELISK)" (or `admin phase 2`): the challenges appear, submissions are accepted, official game runs close, and the countdown switches to the Phase 2 clock. If the Phase 1 timer runs out first, games close for new runs but everything stays in Phase 1 until you press the button (use *Extend* to give more time).
3. Optionally publish an **announcement** ("Phase 1 is live - good luck", later "Phase 2 is open: OBELISK repos at the ready").
4. Watch Overview: queue depth, open flags.

### 6.3 During the event - your dashboard
| I want to... | Do |
|---|---|
| See who is stuck / how a team failed | Submissions > open the submission: **diff + exact failing tests** |
| Give extra time | Overview > *Extend* (adds minutes to the current phase) and publish an announcement |
| Pause for a fire alarm | Overview > **Pause** (closes submissions; deadlines shift by the pause length on Resume) |
| A team lost its code | Teams > *New code* (signs them out; give them the new one) |
| Fix a wrong judgement | Submissions > *Re-judge*, or *Force accept/reject*, or *Grant solve* |
| Remove a cheater | Teams > *Disqualify* (removed from leaderboard, signed out on every device, cannot sign in again - website and CLI show "disqualified"; *Restore* undoes a mistake); or Scores/Submissions > *Invalidate* only the offending submission |
| Reward / penalise | Scores > *Adjust a score* (+/- points with a reason; visible immediately) |
| A test turned out wrong | fix the test in `OBELISK/ORGANIZERS-ONLY/private_tests`, rebuild judge assets, restart backend, Submissions > *Re-judge everything for OB-00X* |
| Look at suspicious activity | Flags tab (forbidden file paths; identical non-trivial patches across teams). Flags never change scores by themselves. |
| Search logs | `backend/data/server.log` (rotating), `tmux` window 1 |

### 6.4 End of event
1. Overview > **End event** (submissions close; anything received before the end is still judged).
2. Wait for the queue to reach 0 (Overview shows "in queue").
3. Review Flags; resolve or act on them (invalidate/disqualify). Check the top teams' submissions manually (diff view) - worth 10 minutes.
4. Scores tab: sanity-check, apply adjustments if needed.
5. Overview > **Finalize scores (publish time bonus)** - the public leaderboard now includes the time bonus.
6. Scores > **Export CSV** (and `admin export --out results.csv` for the per-challenge solve times). Create a final backup.

---

## 7. How scoring works (so you can explain it)

- **Phase 1 (games)** is played in the browser and recorded by the backend (see 10b; admin panel > Games); **Phase 2 (OBELISK)** is what the backend judges and what the leaderboard shows. The OBELISK points per bug: OB-001 50, OB-002 75, OB-003 100, OB-004 150, OB-005 200, OB-006 300 (total 875).
- A bug is solved when the patch is **ACCEPTED**: all tests for that bug pass **and** nothing that previously passed now fails (`PASSED = TOTAL`). Participants only ever see `PASSED x/y`.
- One bug = one patch. A commit must be labelled `FIX[OB-00X]` and match the challenge submitted; it may only change files under `src/obelisk/`; a patch that fixes two bugs is rejected; already-solved bugs are rejected.
- **Time bonus:** for each bug, solvers are ranked by *submission time*. With N solvers, the rank-r solver gets `points x maxBonus x (N-r)/(N-1)` (a lone solver gets the full `points x maxBonus`). `maxBonus` defaults to 0.5. **Hidden until you Finalize**, so the leaderboard shows base points during the event.
- Tie-break on the leaderboard: score, then more solves, then the earlier last solve.
- Everything is derived from accepted submissions + adjustments, so any correction is "invalidate / grant / adjust", all recorded in the **Audit log**.

---

## 8. Capacity and performance (measured on a Mac; the i5 will be similar)

- One judging run takes about **10-15 seconds of CPU** (about 230 tests, including subprocess-heavy ones).
- 30 teams submitting **simultaneously** with 3 workers cleared in ~165 s. Real traffic is far smoother (people finish bugs at different times).
- Workers = cores - 1 (max 4). More workers than cores makes the timed OB-006 benchmark noisy; OB-006 jobs run alone (they take an exclusive lock), so expect a brief pause for everyone when someone submits OB-006.
- The website polls every 5-15 s; 30 laptops are nothing for the server.
- If the queue grows (> 20 in flight or oldest > 3 min) the website status turns to "busy" and participants see a banner. Fixes: raise workers (restart backend), pause briefly, or announce a short delay.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Website shows "No connection" for everyone | backend not running or wrong port: `curl localhost:8080/api/health`; restart `run_backend.sh`. Website was built with a different backend URL: `CODEVERSE_BACKEND_URL=... ./run_frontend.sh` rebuilds |
| Website works only in the browser tab where I tested | you built in `--mock` mode: run `./run_frontend.sh` (without `--mock`) |
| Participant: `cannot reach the Codeverse server` | wrong IP/port (must be `:3000`), different Wi-Fi network, server firewall (`ufw allow 3000/tcp`) |
| Participant: `wrong team ID or access code` | typo (codes have no 0/O/1/I), or you reset it - panel > Teams |
| Participant: `your session is not valid` | they were signed out (new code / DQ / DB reset) -> `codeverse login` again |
| Participant: `DOES_NOT_APPLY` ("does not apply on top of the official base") | their OBELISK is not the released one (edited files, different clone) **or** you republished OBELISK without rebuilding judge assets |
| Participant: `LABEL_MISMATCH` / `LABEL_MISSING` | commit message must contain `FIX[OB-00X]` for the challenge they submit |
| Participant: `FORBIDDEN_PATH` | commit touches files outside `src/obelisk/` (tests, scripts, data). It is also flagged for you |
| `ACTIVE_SUBMISSION` (409) | they already have a job in flight; wait |
| `COOLDOWN` (429) | submitting faster than the cooldown (default 15 s) |
| Many `JUDGE_ERROR` / status ERROR | check `backend/data/server.log`; usually `git` missing or disk full; fix, then Submissions > *Re-judge* |
| Everything REJECTED with `TIMEOUT` | server overloaded or a participant's code loops forever; suite timeout is 180 s |
| `judgeReady: false` | judge assets missing: `python3 backend/scripts/prepare_judge_assets.py` |
| Queue stuck, nothing RUNNING | restart backend (jobs requeue automatically) |
| Countdown wrong | server clock wrong (section 1) - fix before the event, not during |

**Disaster plan:** keep a second laptop with the repo cloned and Node/Python installed. Restoring = copy the latest `backend/data/backups/*.db` to `backend/data/codeverse.db` (plus the `patches/` folder), start the servers, tell participants the new IP. Take a backup every ~30 minutes (panel button), and copy it off the machine.

---

## 10. Things to know / limits

- **No sandbox isolation** (no Docker): participant code runs in a throw-away directory with a timeout, process-tree kill, and CPU/memory limits on Linux/macOS; there is no network or filesystem isolation. With supervised participants this is acceptable; do not run the judge on a laptop holding anything private.
- **The private tests are on the server** (`backend/judge_assets/private_tests`). Keep the server physically yours.
- The bonus challenge (formula engine) is not built; its panel was removed from the website. The judge handles the six OBELISK bugs (Phase 2).
- The OB-006 timing threshold (0.5 s for the official workload; the reference takes ~0.01 s) is generous; if your laptop is much slower, re-measure (`python3 obelisk.py bench --json` inside a fixed copy) before the event - see `OBELISK/ORGANIZERS-ONLY/PERFORMANCE.md`.
- Access codes are stored in plain text on purpose (so you can reprint slips). The data folder is the secret.
- The admin panel's *Force accept*, *Grant solve* and *Adjust* are your overrides; use them sparingly and add a reason - they are all in the Audit log.
- Windows participants: both OBELISK and the CLI are tested for portability but only run-tested on macOS/Linux here; rehearse one Windows laptop.

---

## 10b. The shortlisting games (website, `/games`)

Five browser games live in the same website (nav item **Games**): Crack the Safe (easy), The Ledger Audit and Guard Patrol (medium),
Logic Lockpick (intermediate), Bug Hunt Terminal (hard). The games run in the browser; each official result is sent to the backend.

- **Official run vs practice:** each team gets **one official run** per game with the *same* seeded puzzles for everyone
  (seeds in `frontend/lib/games/registry.ts`); practice uses random puzzles and is never recorded.
- **Scoring:** each game reports its own points; the hub shows a combined total as `weight x percentage` with weights
  Easy 1, Medium 2, Intermediate 3, Hard 4 (max 1200). Weights live in `registry.ts`.
- **Phase rules:** official runs only work while the event is LIVE in **Phase 1** (a run still in progress when Phase 1 closes
  may report up to 2 minutes late); after that they close (practice stays open).
- **OBELISK unlock:** manual only. The event runs Phase 1 (games) first; OBELISK stays locked for every team, even ones that finished all five
  games, until you press *Open phase 2 (OBELISK)*. Pausing stops the timer. *Back to phase 1* re-opens the games for at least 10 minutes.
- **Where results live:** in the backend database (`game_results`), one official result per game per team, so every laptop of a
  team sees the same progress. If the network drops, the result waits in that browser and is re-sent automatically.
  Admin panel > **Games** shows every team's results live; **Teams** shows games played / games points / OBELISK locked or open.
- **Re-run a game for a team:** Admin panel > Games, click the team's result and confirm - it is deleted and the team can play that
  official run again. For testing, `localStorage.setItem("codeverse.games.dev","1")` in the browser console allows unlimited runs
  on that browser (the server still keeps only the first result).
- **Known limitation:** the answer keys (Safe codes, Ledger anomalies, Bug Hunt answers) are generated in the browser, so a
  determined person could read them from the page source. Fine for a supervised round; for a hard guarantee, move the
  generators/`grade()` to the backend (they are pure functions in `frontend/lib/games/`).
- **Tests:** `cd frontend && node --experimental-strip-types --test tests/games.test.ts` (checks the generators, rules,
  solvability of every patrol level, and runs the Bug Hunt snippets in Python to prove the answer key).

---

## 11. Command cheat sheet (run from `backend/`)

```bash
python3 -m codeverse_server admin token                  # admin panel token
python3 -m codeverse_server admin init                   # data dir, db, judge status
python3 -m codeverse_server admin make-teams --count 30 --out teams.csv
python3 -m codeverse_server admin import-teams teams.csv
python3 -m codeverse_server admin start --phase1-minutes 60 --phase2-minutes 180
python3 -m codeverse_server admin status                 # event + queue
python3 -m codeverse_server admin queue                  # in-flight jobs
python3 -m codeverse_server admin submissions --team CV-007
python3 -m codeverse_server admin leaderboard
python3 -m codeverse_server admin flags
python3 -m codeverse_server admin rejudge <id>
python3 -m codeverse_server admin invalidate <id>        # --undo to restore
python3 -m codeverse_server admin disqualify CV-007      # --undo to restore
python3 -m codeverse_server admin pause | resume | end | phase 2     # "phase 2" opens OBELISK
python3 -m codeverse_server admin finalize
python3 -m codeverse_server admin export --out results.csv
```
Tests (for after you change anything): `cd backend/tests && python3 -W ignore -m unittest test_backend test_cli_e2e test_admin` (about 6 minutes) and, for OBELISK, `python3 OBELISK/ORGANIZERS-ONLY/verify_bugs.py`.

## 12. Where things are

```
OBELISK/                         competition project
  ORGANIZERS-ONLY/               BUGS.md, SOLUTIONS.md, reference/, private_tests/, verify_bugs.py, RELEASE-CHECKLIST.md ...
backend/
  codeverse_server/              server code      admin_ui/index.html   admin panel
  judge_assets/                  (generated) base release + private tests + mapping
  data/                          (generated) codeverse.db, patches/, backups/, server.log, admin_token.txt
  docs/IMPLEMENTATION-PLAN.md    architecture
frontend/                        website
cli/                             participant CLI (publish this)
run_backend.sh  run_frontend.sh  launchers
FLOW.md                          end-to-end dry run as a participant
```
