# Codeverse 2.0 — Participant Guide & Mission Dossier

Welcome to **Codeverse 2.0**! This guide contains everything you need to know as a participant: how the competition is structured, how to set up your environment, how to play Phase 1 and Phase 2, how to fix bugs in OBELISK, and how to submit your patches for judging.

---

## 0. Quick Overview & Mission Story

### The Story
Your crew has breached the inner network of the **Royal Mint**. At the center of the compound sits **OBELISK**, a high-performance Search & Intelligence Engine. Saboteurs have corrupted OBELISK's internal subsystems (indexing boundaries, transaction lookups, query history, caching algorithms, query parsing, and autocomplete performance). Your mission is to breach outer security, restore OBELISK to operational status, and extract the prize.

### The Competition Structure
Codeverse runs in **two phases** on an isolated local network (LAN):

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: The Infiltration (Browser Games) (~60 min)                    │
│ 5 logic & security puzzles in your browser. Earn up to 1,200 points.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: The Royal Mint (OBELISK) (~180 min)                           │
│ Inspect, diagnose, and fix 6 real bugs in OBELISK.                     │
│ Submit git patches via the Codeverse CLI. Earn up to 875+ points.      │
└────────────────────────────────────────────────────────────────────────┘
```

| Component | Where it is | Purpose |
|---|---|---|
| **Web Portal** | `http://<server-ip>:3000` | Login, Phase 1 games, challenge briefs, documentation, live dashboard & leaderboard |
| **OBELISK Repo** | Your laptop (`git`) | The buggy search engine codebase where you debug and write fixes |
| **Codeverse CLI** | `cli/codeverse.py` | Command-line tool used to submit your git commits to the judging server |

---

## 1. Prerequisites & Equipment Setup

Before the event begins, ensure your laptop has:

1. **Python 3.10 or newer**
   - Check with: `python3 --version` (macOS/Linux) or `python --version` (Windows)
   - *Note:* OBELISK uses standard library features from Python 3.10+. No third-party packages or virtualenvs are required.
2. **Git installed**
   - Check with: `git --version`
3. **A Modern Web Browser** (Chrome, Firefox, Safari, Edge)
4. **Venue Network Connection**
   - Connect to the venue Wi-Fi / Ethernet switch provided by organizers.

### What the Organizers Provide
You will receive:
- **Server Address:** `http://<server-ip>:3000` (e.g. `http://192.168.1.40:3000`)
- **Team Slip:** Your unique **Team ID** (e.g. `CV-007`) and 6-character **Access Code** (e.g. `A7X9K2`)
- **OBELISK Repository:** The competition code repository (clean clone)
- **CLI Tool:** The `cli/` directory containing `codeverse.py` (and `./codeverse` / `codeverse.cmd` wrappers)

---

## 2. Step-by-Step Walkthrough

### Step 1: Connect to the Venue Network
1. Join the designated Wi-Fi or plug in your Ethernet cable.
2. Open your terminal and test connectivity to the server:
   ```bash
   curl http://<server-ip>:3000/api/health
   ```
   *(Expected response: `{"ok": true, ...}`)*
3. If this fails, double-check your Wi-Fi network and verify the server IP with an organizer.

---

### Step 2: Sign In (Web Portal & CLI)

#### A. Web Portal Sign-in
1. In your browser, open `http://<server-ip>:3000`.
2. Enter your **Team ID** and **Access Code** from your slip.
3. You will see your team dashboard, event status countdown, and navigation tabs:
   - **Dashboard:** Your score, rank, and challenge status.
   - **Games:** Phase 1 infiltration challenges.
   - **Challenges:** Phase 2 OBELISK dossiers (unlocked in Phase 2).
   - **Docs:** Official rulebook and telemetry.
   - **Leaderboard:** Live standings.

#### B. CLI Sign-in (Terminal)
Open a terminal in your workspace and log in using the CLI:
```bash
python cli/codeverse.py login --server <server-ip>:3000 --team <TEAM-ID> --code <ACCESS-CODE>
```
*(Or run `python cli/codeverse.py login` and follow the interactive prompts).*

Verify your status:
```bash
python cli/codeverse.py status
```
*(Shows your team name, ID, score, current event phase, and challenge status).*

---

### Step 3: Phase 1 — The Infiltration (Browser Games)

During Phase 1, the OBELISK challenges are locked. Your team competes in **5 interactive browser challenges** under the **Games** tab:

| Game | Difficulty | Weight | Objective |
|---|---|---|---|
| **Crack the Safe** | Easy | ×1 | Deduce secret vault digit combinations using feedback clues. |
| **The Ledger Audit** | Medium | ×2 | Scan transaction rows and pinpoint manipulated entries. |
| **Guard Patrol** | Medium | ×2 | Plan safe navigation paths dodging lasers and moving guards. |
| **Logic Lockpick** | Intermediate | ×3 | Assemble logic gate circuit wiring to produce target outputs. |
| **Bug Hunt Terminal** | Hard | ×4 | Read code snippets, forecast execution behavior, and identify bugs. |

#### Phase 1 Rules:
- **Practice vs. Official Run:**
  - You can play **Practice Mode** as many times as you like to learn the mechanics (practice runs are not recorded).
  - Each team receives **exactly ONE Official Run** per game. Official runs are scored and recorded permanently to the server.
- **Scoring:**
  - Games award points for accuracy and completion speed.
  - Harder games carry higher multipliers (up to 1,200 points total).
- **Team Synchronization:**
  - All teammates logged in under the same Team ID share progress in real time. Coordinate who plays which game!

---

### Step 4: Phase 2 — The Royal Mint (OBELISK)

When organizers announce Phase 2, the **Challenges** tab unlocks on the portal, and the CLI begins accepting code submissions.

#### 1. Explore OBELISK
Navigate to your `obelisk` repository:
```bash
cd obelisk
```

OBELISK is a zero-dependency, pure Python search and record management engine:
```bash
python obelisk.py ingest                    # Ingest bundled data and build inverted index
python obelisk.py status                    # Display system health & record counts
python obelisk.py search "vault AND security" # Search ingested documents
python obelisk.py suggest sec               # Autocomplete search terms
python obelisk.py transaction TX-10100      # Look up transaction records
python obelisk.py bench --json              # Benchmark query performance
```

*State storage:* OBELISK writes state to `.obelisk-state/`. You can delete this folder anytime to start fresh (`rm -rf .obelisk-state`).

#### 2. Run the Public Test Suite
Run the test suite locally at any time:
```bash
python scripts/run_tests.py
```
*(Add `-v` for verbose output listing each individual test).*

When you start, you will see **approximately 17 failures across 111 tests**. These failures correspond directly to the defects you need to fix!

---

## 3. The 6 OBELISK Challenges

| ID | Challenge Name | Subsystem | Difficulty | Base Points |
|---|---|---|---|---|
| **OB-001** | Vault Index Integrity | `src/obelisk/indexer.py` | Beginner | 50 PTS |
| **OB-002** | Transaction Lookup | `src/obelisk/transactions.py` | Easy | 75 PTS |
| **OB-003** | Query History | `src/obelisk/history.py` | Medium | 100 PTS |
| **OB-004** | Query Parser | `src/obelisk/query_parser.py` | Intermediate | 150 PTS |
| **OB-005** | Query Cache | `src/obelisk/cache.py` | Hard | 200 PTS |
| **OB-006** | Autocomplete at Scale | `src/obelisk/autocomplete.py` | Elite | 300 PTS |
| **Total** | | | | **875 PTS** |

### Challenge Descriptions

- **OB-001: Vault Index Integrity (50 PTS)**
  - *Symptom:* `python obelisk.py index` reports `Documents: 120 / Indexed: 116`. The last document in boundary segments is silently dropped.
  - *Goal:* Ensure every single document (including boundary entries) is indexed and searchable.

- **OB-002: Transaction Lookup (75 PTS)**
  - *Symptom:* Boundary transaction lookups fail (e.g. `python obelisk.py transaction TX-11251` returns "not found" even though it exists in the data).
  - *Goal:* Ensure lookup functions locate all valid IDs from the first to the very last.

- **OB-003: Query History (100 PTS)**
  - *Symptom:* Undoing queries and executing a new search results in stale or skipped history states upon subsequent undo operations.
  - *Goal:* Restore proper undo stack behavior; running a new query after an undo must discard undone future states.

- **OB-004: Query Parser (150 PTS)**
  - *Symptom:* Compound search expressions with `NOT` and `AND` produce unexpected boolean results due to faulty operator precedence.
  - *Goal:* Ensure logical operators follow correct parsing precedence (`NOT` binds tighter than `AND`).

- **OB-005: Query Cache (200 PTS)**
  - *Symptom:* Query cache evicts recently read entries prematurely instead of strictly evicting the least-recently used.
  - *Goal:* Fix cache eviction recency so reading a cached query updates its LRU position.

- **OB-006: Autocomplete at Scale (300 PTS)**
  - *Symptom:* `python obelisk.py bench --json` shows `query_seconds` taking ~3.0s instead of milliseconds under benchmark workloads.
  - *Goal:* Optimize prefix autocomplete lookup from linear vocabulary scanning to an efficient prefix/trie structure that satisfies the server's strict performance threshold.

---

## 4. The Golden Submission Protocol

> [!IMPORTANT]
> **THE PROFESSOR'S GOLDEN RULE: ONE BUG = ONE PATCH**
> Each challenge must be fixed in its own separate git commit. Never combine multiple bug fixes into one commit.

### Submission Requirements Checklist
1. **Source Files Only:**
   - You must **ONLY** modify files under `src/obelisk/`.
   - Never modify files in `public_tests/`, `scripts/`, `data/`, or `docs/`. Modifying files outside `src/obelisk/` will be rejected as `FORBIDDEN_PATH` and will flag your submission.
2. **Order Independence:**
   - You may solve the challenges in **any order** you choose (e.g. solve OB-005 first, then OB-001).
3. **Commit Message Label:**
   - Your commit message **MUST** contain `FIX[OB-00X]`, matching the challenge you are submitting:
   ```bash
   git commit -am "FIX[OB-001]: include boundary document in indexer"
   ```
4. **Clean Baseline:**
   - Work cleanly in git. The judge tests your patch against the official release base plus any previously accepted fixes.

### How to Submit a Fix
Inside your OBELISK repository, run:
```bash
python path/to/codeverse.py submit OB-001
```
*(Or `codeverse submit OB-001` if using the launcher).*

#### What Happens Next:
1. The CLI extracts your latest commit patch and transmits it to the server.
2. The server queues your submission and runs an extensive test suite (both public tests and hidden private regression tests).
3. The CLI streams progress:
   ```
   Submitting OB-001: FIX[OB-001]: include boundary document in indexer
     queued (position 1)
     judging...

   PASSED 119/119  -  OB-001 ACCEPTED
   ```
4. If your patch passes all tests, your score is immediately updated on the portal dashboard!

---

## 5. Scoring & Leaderboard

1. **Base Points:**
   - Credited immediately upon an `ACCEPTED` submission.
2. **Time Bonus:**
   - The fastest teams to solve a given challenge earn bonus points (up to +50% of the challenge value).
   - Time bonuses are calculated relative to all teams that solve the challenge.
   - To keep the competition suspenseful, **time bonuses are kept hidden during the event** and are revealed on the final leaderboard when the organizers finalize the event!
3. **Leaderboard Tie-Breaking:**
   1. Highest total score.
   2. Most challenges solved.
   3. Earliest timestamp of the last accepted submission.

---

## 6. Participant Command Cheat Sheet

### Codeverse CLI Commands

```bash
# Authenticate with the judging server
python codeverse.py login --server <ip>:3000 --team CV-007 --code CODE12

# Check your current score, rank, and challenge status
python codeverse.py status

# Submit your latest commit for a challenge
python codeverse.py submit OB-001

# View your submission history and test results
python codeverse.py history

# View top teams on the leaderboard
python codeverse.py leaderboard
```

### Git Workflow Commands

```bash
# Check modified files (ensure only src/obelisk/ files are modified!)
git status
git diff

# Commit your fix with the required FIX[OB-00X] tag
git commit -am "FIX[OB-002]: correct upper boundary in transaction lookup"

# Need to fix your commit message?
git commit --amend -m "FIX[OB-002]: new commit message"

# Undo changes if you want to start over
git checkout -- src/obelisk/transactions.py
# Or reset the latest commit back to work on it:
git reset HEAD~1
```

### OBELISK Commands

```bash
# Ingest data & build search index
python obelisk.py ingest

# Check indexed document count
python obelisk.py status

# Run search query
python obelisk.py search "vault AND security"

# Run autocomplete
python obelisk.py suggest sec

# Run performance benchmark
python obelisk.py bench --json

# Run public tests
python scripts/run_tests.py
python scripts/run_tests.py -v
```

---

## 7. Troubleshooting & Error Explanations

| Error Code / Message | Meaning | What to do |
|---|---|---|
| `The commit message must contain FIX[OB-00X]` | Your commit message is missing the required tag. | Run `git commit --amend -m "FIX[OB-00X]: your message"` and submit again. |
| `LABEL_MISMATCH` | You ran `submit OB-001` but your commit says `FIX[OB-002]`. | Make sure the challenge ID in `codeverse submit` matches your commit message. |
| `FORBIDDEN_PATH` | Your commit modifies files outside `src/obelisk/` (e.g. tests or scripts). | Revert changes outside `src/obelisk/` using `git checkout HEAD~1 -- public_tests/ scripts/` and re-commit. |
| `DOES_NOT_APPLY` | Your git branch has diverged or contains uncommitted conflicting changes. | Ensure your repo history is clean and based on the official base release. |
| `MULTIPLE_FIXES` | Your commit fixed two or more bugs simultaneously. | Revert one of the fixes. The rule is strictly **one bug per commit**. |
| `ALREADY_SOLVED` | Your team already successfully solved this challenge. | Check `codeverse status`; move on to the next challenge! |
| `TIMEOUT` | Your code exceeded the execution time limit (possible infinite loop). | Inspect your loops, recursion, and search termination conditions. |
| `COOLDOWN` (429) | You submitted too quickly after your last submission. | Wait 15 seconds (cooldown period) before submitting again. |
| `You already have a submission being judged` (409) | A previous submission is still running in the judge queue. | Wait a few seconds for the active judging run to finish. |
| `PHASE_NOT_OPEN` | Phase 2 has not been opened yet by organizers. | Focus on Phase 1 browser games until Phase 2 is announced. |
| `cannot reach the Codeverse server` | Network connection lost or wrong IP. | Check your Wi-Fi/LAN connection and test `curl http://<ip>:3000/api/health`. |

---

## 8. Strategy Tips for Teams

1. **Phase 1 Coordination:** Divide and conquer. Have different crew members practice and execute the 5 games simultaneously.
2. **Read the Documentation:** Explore `obelisk/docs/` (`commands.md`, `search.md`, `architecture.md`). The expected behaviors are documented in detail.
3. **Make Surgical Edits:** Each bug is localized to a single file and often just a few lines of code. Do not rewrite entire modules; find the root cause and apply a minimal, surgical fix.
4. **Use Local Tests First:** Run `python scripts/run_tests.py` before submitting to save time and avoid cooldown delays.
5. **Speed Earns Loot:** Early solves earn a higher time bonus. If you identify an easy bug, solve and submit it quickly!
