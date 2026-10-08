# FLOW - a full dry run, as a participant and as the organizer

Follow this top to bottom on the **server laptop (or your Mac)** to prove every part works together:
servers -> team -> broken OBELISK -> wrong attempts -> real fixes -> website/admin -> end of event.
Takes about 30-40 minutes. Commands are for bash/zsh (macOS/Linux). Tick the boxes as you go.

> Numbers like `119/119` depend slightly on the bug set; what matters is **PASSED = TOTAL** on acceptance and **PASSED < TOTAL** on a wrong fix.

---

## Part 0 - Variables (use in every terminal you open)

```bash
export CV=~/CODEVERSE/codeverse           # the repo root - adjust if yours is elsewhere
codeverse() { python3 "$CV/cli/codeverse.py" "$@"; }     # the participant CLI as a shell function
adm()       { (cd "$CV/backend" && python3 -m codeverse_server admin "$@"); }   # organizer admin CLI
```
> Define these functions (not aliases/variables) - they work in both bash and zsh.

---

## Part 1 - Organizer: start everything

- [ ] **Terminal 1 - backend**
  ```bash
  rm -rf "$CV/backend/data"                 # start the dry run from a clean database
  CODEVERSE_WORKERS=3 CODEVERSE_COOLDOWN=2 "$CV/run_backend.sh"
  ```
  Expect: `judge assets missing - building them...` (first time), a note that there are no teams yet, then
  `listening on 0.0.0.0:8080`, `LAN address: http://192.168.x.x:8080`, `admin panel: ... token: <TOKEN>`.
  **Write the token down** (or later: `adm token`).

- [ ] **Terminal 2 - website**
  ```bash
  "$CV/run_frontend.sh"
  ```
  First run builds (about 1 minute). Expect `Ready` and `website on http://0.0.0.0:3000 (api mode: http ...)`.

- [ ] **Terminal 3 - checks**
  ```bash
  curl localhost:8080/api/health            # {"ok": true, ..., "judgeReady": true, "workers": 3}
  curl localhost:3000/api/health            # same answer through the website's proxy
  ```
- [ ] Find your IP (this is what participants will type):
  ```bash
  hostname -I            # Ubuntu        |   macOS: ipconfig getifaddr en0
  ```
  Call it `$IP` below: `export IP=192.168.1.40` (use yours).

---

## Part 2 - Organizer: team and event

- [ ] Open **`http://localhost:8080/admin`**, paste the token. Overview shows `NOT_STARTED`, 0 teams, judge assets `ready`.
- [ ] **Teams** tab -> *Add a team*: name `Dry Run`, leave ID/Code empty -> **Add**. It gets ID `CV-001`.
      Click the `••••••` in the *Access code* column to reveal the code. Note it: `export CODE=<code>`.
- [ ] Add a **second** team (`Dry Run B`, `CV-002`) - used in Part 8 for the time bonus.
- [ ] **Overview** -> *Start event* (Phase 1 games = 60 min, Phase 2 OBELISK = 180 min) -> the pill turns `LIVE - phase 1`.
      The event opens in **Phase 1 (the games)**: the website's **OBELISK** tab is locked and CLI submissions are refused.
- [ ] *(Optional, 5 min)* Log in on the website as a team and play one game, e.g. Crack the Safe as an official run, to see Phase 1 working.
- [ ] **When you are ready for the OBELISK part:** Overview -> **Open phase 2 (OBELISK)**. The website unlocks the OBELISK tab, official game runs close, and submissions are accepted. **Do this before Part 3's login/submit steps.**
- [ ] Optional: publish an announcement: `Dry run in progress`. Open the website later and see the gold banner.

---

## Part 3 - Participant: set up the (wrong) repo

This is exactly what a participant has: the released OBELISK, unmodified, plus a git history starting at "official base".

- [ ] ```bash
  mkdir -p ~/flow && cd ~/flow
  rm -rf obelisk && cp -R "$CV/backend/judge_assets/base" obelisk      # the exact release the judge compares against
  cd obelisk
  git init -q
  git config user.name "Dry Run" && git config user.email dry@run.local     # only if git has no global identity
  git add -A && git commit -q -m "official base"
  git log --oneline                          # one commit: official base
  ```
  > Participants will instead `git clone` the published OBELISK repo; the result is the same.
  > Check there is **no** `ORGANIZERS-ONLY` folder: `ls` should show `data docs public_tests scripts src ...`.

- [ ] **Log in with the CLI** (this is what every team does once):
  ```bash
  codeverse login --server $IP:3000 --team CV-001 --code $CODE
  # Signed in as CV-001 on http://192.168.x.x:3000
  codeverse status
  ```
  Expect your team, `rank 1/2  score 0`, `event: LIVE`, six challenges `[ ]` not started.

- [ ] **Open the website** in a browser: `http://$IP:3000` -> log in as `CV-001` / `$CODE`.
      Dashboard shows score 0, rank, a running countdown, the six challenges "Not started".
      Open **Challenges > OB-004**: description, expected, observed behaviour, copy-able submit commands.
      Open **Docs**: rules, scoring, CLI section.

---

## Part 4 - Participant: look at the broken system

- [ ] Run the OBELISK commands once (state goes to `.obelisk-state/` inside the repo):
  ```bash
  python3 obelisk.py ingest
  python3 obelisk.py status
  python3 obelisk.py search "vault AND security" --limit 3
  python3 obelisk.py suggest sec
  ```
  Everything "works" - the bugs are subtle.
- [ ] Run the public tests:
  ```bash
  python3 scripts/run_tests.py
  # Ran 111 tests ... FAILED (failures=17)
  ```
  17 failures = the symptoms of the six bugs. (`python3 scripts/run_tests.py -v` lists them by name.)
- [ ] Reproduce each symptom (see `OBELISK/ORGANIZERS-ONLY/SOLUTIONS.md` for the reasoning):
  ```bash
  # OB-001
  python3 obelisk.py index                       # Documents: 120   Indexed: 116   <- four missing
  # OB-002
  python3 obelisk.py transaction TX-11251        # error: transaction not found   <- last ID
  # OB-003
  for q in aaa bbb ccc; do python3 obelisk.py search $q --no-cache >/dev/null; done
  python3 obelisk.py history undo                # Restored query: bbb
  python3 obelisk.py search ddd --no-cache >/dev/null
  python3 obelisk.py history undo                # expected "bbb", prints "ccc"   <- stale state
  # OB-004
  python3 obelisk.py search "NOT vault AND security" --limit 2    # complement of the right answer
  # OB-005
  export OBELISK_CACHE_SIZE=3
  for q in a b c; do python3 obelisk.py search $q --no-history >/dev/null; done
  python3 obelisk.py search a --no-history | tail -1              # Cache: HIT
  python3 obelisk.py search d --no-history >/dev/null
  python3 obelisk.py cache stats                  # 'a' is gone although it was just used
  unset OBELISK_CACHE_SIZE
  # OB-006
  python3 obelisk.py bench --json | grep query_seconds            # ~3 seconds (should be ~0.01)
  ```
  Reset the experiments: `rm -rf .obelisk-state`.

---

## Part 5 - Participant: deliberately WRONG submissions

Each one tests a rule the judge enforces. Undo every experiment with `git reset --hard HEAD~1` before the next.

| # | Do | Expected |
|---|---|---|
| 5.1 | **Unlabelled commit.** `codeverse submit OB-001` right now (HEAD is "official base"). | Local error, nothing sent: *"The commit message must contain FIX[OB-001]"* |
| 5.2 | **Forbidden file.** `echo "# x" >> public_tests/test_cli.py && git commit -qam "FIX[OB-001]: sneaky" && codeverse submit OB-001` | `Not accepted` + *"changes files outside src/obelisk/"* (reason `FORBIDDEN_PATH`). **Organizer:** a flag appears in the panel (Flags tab, badge on the tab). Then `git reset --hard HEAD~1`. |
| 5.3 | **No real fix.** `echo "# x" >> src/obelisk/cache.py && git commit -qam "FIX[OB-005]: nothing" && codeverse submit OB-005` | `PASSED 1xx/1yy - not accepted` (partial). Then reset. |
| 5.4 | **Wrong bug claimed.** Apply the OB-001 fix (Part 6.1 shortcut), commit as `FIX[OB-003]: totally history`, `codeverse submit OB-003` | `PASSED n/m - not accepted` (the OB-003 tests still fail). Reset. |
| 5.5 | **Two bugs in one commit.** Apply the OB-001 *and* OB-002 fixes, commit `FIX[OB-001]: greedy`, submit OB-001 | `Not accepted` + *"fixes more than one bug"* (`MULTIPLE_FIXES`). Reset. |
| 5.6 | **Wrong label.** Fix OB-001, commit `FIX[OB-002]: mislabelled`, then `codeverse submit OB-001` | Local error: label must contain `FIX[OB-001]`. Reset. |

- [ ] Each of these shows up in the panel: **Submissions** tab -> click one -> see the diff and the **exact failing tests**.
- [ ] `codeverse history` lists all your attempts with their `passed/total`.

---

## Part 6 - Participant: the real fixes, one commit each

Two ways to apply a fix - pick one per bug:
- **By hand:** open the file named in `OBELISK/ORGANIZERS-ONLY/SOLUTIONS.md` and make the change shown there.
- **Shortcut** (copies the reference version of that one file):
  `cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/<file>.py" src/obelisk/<file>.py`

Do them **in a different order from 1-6** to prove any order works. After each: test, commit, submit, then glance at the website and the admin panel.

### 6.1 OB-005 - Query cache (hard) - first
```bash
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/cache.py" src/obelisk/cache.py     # adds self._touch(node) in get()
git diff --stat                                      # exactly one file changed
python3 scripts/run_tests.py 2>&1 | tail -3          # 13 failures left (was 17)
git commit -qam "FIX[OB-005]: refresh recency on cache reads"
codeverse submit OB-005
```
Expect: `queued ... judging... PASSED 1xx/1xx - OB-005 ACCEPTED`. (About 10-15 s.)
- [ ] `codeverse status` -> `score 200`, `[x] OB-005`.
- [ ] Website dashboard: score 200, rank 1, **Solved 1/6**, OB-005 "Solved". (It refreshes by itself.)

### 6.2 OB-001 - Vault index (beginner)
```bash
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/indexer.py" src/obelisk/indexer.py    # range(lo, hi) -> range(lo, hi + 1)
python3 obelisk.py ingest >/dev/null && python3 obelisk.py index       # Indexed: 120
git commit -qam "FIX[OB-001]: include the last document of every segment"
codeverse submit OB-001
```
- [ ] Accepted; score 250.

### 6.3 OB-003 - Query history (medium)
```bash
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/history.py" src/obelisk/history.py    # discard states after the cursor on push
git commit -qam "FIX[OB-003]: drop undone states when a new query is run"
codeverse submit OB-003
```
- [ ] Accepted; score 350.

### 6.4 OB-002 - Transaction lookup (easy)
```bash
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/transactions.py" src/obelisk/transactions.py   # hi = len(numbers)
python3 obelisk.py transaction TX-11251            # prints the record now
git commit -qam "FIX[OB-002]: last transaction ID was unreachable"
codeverse submit OB-002
```
- [ ] Accepted; score 425.

### 6.5 OB-004 - Query parser (intermediate)
```bash
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/query_parser.py" src/obelisk/query_parser.py   # precedence table order
git commit -qam "FIX[OB-004]: NOT binds tighter than AND"
codeverse submit OB-004
```
- [ ] Accepted; score 575.

### 6.6 OB-006 - Autocomplete at scale (elite, the timed one)
```bash
python3 obelisk.py bench --json | grep query_seconds                  # before: ~3 s
cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/autocomplete.py" src/obelisk/autocomplete.py
python3 obelisk.py bench --json | grep -E "query_seconds|checksum"    # after: ~0.01 s, same checksum
git commit -qam "FIX[OB-006]: prefix lookup no longer scans the whole vocabulary"
codeverse submit OB-006
```
- [ ] Accepted; score **875**. (This job takes the server exclusively for a few seconds - other submissions wait.)
- [ ] Final check on the participant side:
  ```bash
  python3 scripts/run_tests.py | tail -3       # Ran 111 tests ... OK
  codeverse status                             # score 875, rank 1/2, all six [x]
  ```
- [ ] Re-submit a solved bug: `codeverse submit OB-001` -> `You have already solved this challenge.`

---

## Part 7 - Organizer: everything in the admin panel (`http://localhost:8080/admin`)

- [ ] **Overview:** accepted/rejected counts, queue back to 0, open flags (the sneaky 5.2 attempt).
- [ ] **Submissions:** filter by team `CV-001`; open an *accepted* one and a *rejected* one (diff, failing tests, flags, reasons).
- [ ] **Flags:** see `FORBIDDEN_PATH` from 5.2 -> *Resolve...* with the note `dry run`. Add a manual flag on CV-001: `checked, ok`.
- [ ] **Scores:** `Dry Run` has 875. *Adjust a score*: `CV-001`, `-25`, reason `dry run penalty` -> the website leaderboard shows 850 within a few seconds. Remove the adjustment again.
- [ ] **Submissions > invalidate** the OB-006 acceptance -> score drops by 300 on the leaderboard; open it -> **Restore** -> it comes back. (Both are in the Audit log.)
- [ ] **Submissions > Re-judge** one accepted submission -> it goes QUEUED -> RUNNING -> ACCEPTED again.
- [ ] **Teams:** reveal a code, *New code* for CV-002 (note the code), *Download credentials (CSV)*, *Print credential slips* (just look, then close).
- [ ] **Overview:** *Pause* -> run `codeverse submit OB-001`-style attempt with a new commit -> error "event is not live"; *Resume*.
      *Extend* by 5 minutes; publish/clear the announcement; *Create database backup now* (`backend/data/backups/`).
- [ ] **Audit log:** every action above is listed.

---

## Part 8 - Optional: see the time bonus with two teams

- [ ] Second repo + second CLI profile:
  ```bash
  cd ~/flow && rm -rf obelisk2 && cp -R "$CV/backend/judge_assets/base" obelisk2 && cd obelisk2
  git init -q && git config user.name B && git config user.email b@run.local && git add -A && git commit -q -m "official base"
  export CODEVERSE_HOME=~/flow/cv-b                         # separate login for team B
  codeverse login --server $IP:3000 --team CV-002 --code <the code from the panel>
  cp "$CV/OBELISK/ORGANIZERS-ONLY/reference/src/obelisk/indexer.py" src/obelisk/indexer.py
  git commit -qam "FIX[OB-001]: indexer" && codeverse submit OB-001
  unset CODEVERSE_HOME
  ```
- [ ] Team B solved OB-001 **after** team A -> A gets the larger time bonus for OB-001 (A first: `50 x 0.5 = +25`; B last: `+0`).
- [ ] Website leaderboard still shows **base points only** (875 vs 50): the bonus is hidden until finalization.
- [ ] Panel > **Scores** shows the provisional bonus column.

---

## Part 9 - Organizer: end of event

- [ ] Overview -> **End event** (confirm). Submissions now answer "event has ended".
- [ ] Wait for `in queue: 0`.
- [ ] Overview -> **Finalize scores (publish time bonus)**.
- [ ] Website leaderboard now shows bonuses (A = 875 + bonuses). Scores > **Export CSV**.
- [ ] Terminal: `adm export --out ~/flow/results.csv && head ~/flow/results.csv`
- [ ] Panel > Overview > *Un-finalize* once to see it is reversible; finalize again.

---

## Part 10 - Reset for the real event

- [ ] Stop both servers (`Ctrl-C` in terminals 1 and 2).
- [ ] Remove all dry-run data: `rm -rf "$CV/backend/data"` (deletes teams, submissions, patches, the old admin token).
- [ ] Rebuild judge assets from the **released** OBELISK if it changed: `rm -rf "$CV/backend/judge_assets"` (the next `run_backend.sh` rebuilds it).
- [ ] Remove the dry-run files: `rm -rf ~/flow ~/.codeverse`.
- [ ] Start from section 3 of `instructions_for_Organizers.md`: create the real teams, print slips, `Start event` at the agreed time.

If anything in this flow did not behave as written, stop and fix it **before** the event - every line above has been exercised during development, so a deviation points at your environment (IP, firewall, Node/Python versions).
