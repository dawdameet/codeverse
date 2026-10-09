import json
import threading
import time
import unittest
import urllib.error
import urllib.request

import support
from support import ApiError, BackendCase, event


class Intake(BackendCase):
    def test_event_must_be_live(self):
        event.pause(self.app.db)
        with self.assertRaises(ApiError) as cm:
            self.app.submit(self.team(), "OB-001", self.factory.fix("OB-001"))
        self.assertEqual((cm.exception.status, cm.exception.code), (403, "EVENT_NOT_LIVE"))

    def test_submissions_are_closed_during_the_games_phase(self):
        event.set_phase(self.app.db, 1)
        with self.assertRaises(ApiError) as cm:
            self.app.submit(self.team(), "OB-001", self.factory.fix("OB-001"))
        self.assertEqual((cm.exception.status, cm.exception.code), (403, "PHASE_NOT_OPEN"))
        event.set_phase(self.app.db, 2)
        self.assertEqual(self.app.submit(self.team(), "OB-001", "garbage")["reason"], "BAD_PATCH")

    def test_unknown_challenge(self):
        with self.assertRaises(ApiError) as cm:
            self.app.submit(self.team(), "OB-999", "x")
        self.assertEqual(cm.exception.status, 404)

    def test_label_must_match_claim(self):
        view = self.app.submit(self.team(), "OB-002", self.factory.fix("OB-001"))
        self.assertEqual((view["status"], view["reason"]), ("REJECTED", "LABEL_MISMATCH"))

    def test_label_missing(self):
        patch = self.factory.make("repair stuff", {"src/obelisk/cache.py": "x = 1\n"})
        view = self.app.submit(self.team(), "OB-005", patch)
        self.assertEqual(view["reason"], "LABEL_MISSING")

    def test_forbidden_path_is_rejected_and_flagged(self):
        patch = self.factory.make("FIX[OB-001]: sneaky", {"public_tests/test_cli.py": "pass\n"})
        view = self.app.submit(self.team(), "OB-001", patch)
        self.assertEqual((view["status"], view["reason"]), ("REJECTED", "FORBIDDEN_PATH"))
        flags = self.app.db.conn().execute("SELECT kind FROM flags").fetchall()
        self.assertEqual([f["kind"] for f in flags], ["FORBIDDEN_PATH"])

    def test_garbage_patch(self):
        view = self.app.submit(self.team(), "OB-001", "this is not a patch")
        self.assertEqual(view["reason"], "BAD_PATCH")

    def test_one_submission_in_flight_per_team(self):
        team = self.team()
        first = self.app.submit(team, "OB-001", self.factory.fix("OB-001"))
        with self.assertRaises(ApiError) as cm:
            self.app.submit(team, "OB-002", self.factory.fix("OB-002"))
        self.assertEqual((cm.exception.status, cm.exception.code), (409, "ACTIVE_SUBMISSION"))
        self.assertEqual(cm.exception.extra["submissionId"], first["id"])

    def test_cooldown(self):
        self.cfg.cooldown_seconds = 60
        team = self.team()
        self.app.submit(team, "OB-001", "garbage")   # rejected instantly, but counts
        with self.assertRaises(ApiError) as cm:
            self.app.submit(team, "OB-001", "garbage")
        self.assertEqual((cm.exception.status, cm.exception.code), (429, "COOLDOWN"))


class Judging(BackendCase):
    def test_correct_fix_is_accepted_with_full_marks(self):
        team = self.team()
        view = self.submit_and_wait(team, "OB-001", self.factory.fix("OB-001"))
        self.assertEqual(view["status"], "ACCEPTED", view)
        self.assertEqual(view["passed"], view["total"])
        self.assertGreater(view["total"], 100)
        self.assertEqual(self.app.me(team)["score"], 50)
        status = {c["id"]: c["status"] for c in self.app.challenges(team)}
        self.assertEqual(status["OB-001"], "SOLVED")
        self.assertEqual(status["OB-002"], "NOT_STARTED")

    def test_wrong_bug_claimed_is_rejected_with_partial_score(self):
        team = self.team()
        view = self.submit_and_wait(team, "OB-003", self.factory.fix("OB-001", label="OB-003"))
        self.assertEqual(view["status"], "REJECTED")
        self.assertLess(view["passed"], view["total"])
        self.assertEqual(self.app.me(team)["score"], 0)
        self.assertEqual({c["id"]: c["status"] for c in self.app.challenges(team)}["OB-003"], "IN_PROGRESS")

    def test_no_op_patch_is_rejected(self):
        patch = self.factory.make("FIX[OB-005]: nothing", {"src/obelisk/cache.py": (
            self.assets / "base" / "src" / "obelisk" / "cache.py").read_text() + "\n# touched\n"})
        view = self.submit_and_wait(self.team(), "OB-005", patch)
        self.assertEqual(view["status"], "REJECTED")
        self.assertLess(view["passed"], view["total"])

    def test_two_fixes_in_one_patch_are_rejected(self):
        both = self.factory.make("FIX[OB-001]: greedy", {
            f"src/obelisk/{support.BUG_FILE[b]}": (support.REFERENCE / support.BUG_FILE[b]).read_text()
            for b in ("OB-001", "OB-002")})
        view = self.submit_and_wait(self.team(), "OB-001", both)
        self.assertEqual((view["status"], view["reason"]), ("REJECTED", "MULTIPLE_FIXES"))

    def test_already_solved_is_rejected_without_judging(self):
        team = self.team()
        self.submit_and_wait(team, "OB-002", self.factory.fix("OB-002"))
        view = self.app.submit(team, "OB-002", self.factory.fix("OB-002"))
        self.assertEqual((view["status"], view["reason"]), ("REJECTED", "ALREADY_SOLVED"))

    def test_patch_that_does_not_apply(self):
        patch = self.factory.fix("OB-001").replace("range(lo, hi):", "range(lo, hiX):")
        view = self.submit_and_wait(self.team(), "OB-001", patch)
        self.assertEqual((view["status"], view["reason"]), ("REJECTED", "DOES_NOT_APPLY"))

    def test_fixes_accumulate_in_any_order_across_submissions(self):
        team = self.team()
        for bug in ("OB-005", "OB-003", "OB-001"):
            view = self.submit_and_wait(team, bug, self.factory.fix(bug))
            self.assertEqual(view["status"], "ACCEPTED", (bug, view))
        me = self.app.me(team)
        self.assertEqual((me["solvedCount"], me["score"]), (3, 200 + 100 + 50))

    def test_regression_is_caught(self):
        team = self.team()
        # a correct OB-004 fix that also breaks the tokenizer (covered by tests that belong to no bug)
        tokenizer = (self.assets / "base" / "src" / "obelisk" / "tokenizer.py").read_text()
        patch = self.factory.make("FIX[OB-004]: regress", {
            "src/obelisk/query_parser.py": (support.REFERENCE / "query_parser.py").read_text(),
            "src/obelisk/tokenizer.py": tokenizer.replace("return _WORD.findall(text.lower())", "return []")})
        view = self.submit_and_wait(team, "OB-004", patch)
        self.assertEqual(view["status"], "REJECTED")
        self.assertLess(view["passed"], view["total"])
        self.assertEqual(self.app.me(team)["score"], 0)


class Sweep(BackendCase):
    def test_all_six_reference_fixes_including_the_timed_one(self):
        team = self.team()
        for bug in ("OB-001", "OB-002", "OB-003", "OB-004", "OB-005", "OB-006"):
            view = self.submit_and_wait(team, bug, self.factory.fix(bug))
            self.assertEqual(view["status"], "ACCEPTED", (bug, view))
            self.assertEqual(view["passed"], view["total"])
        me = self.app.me(team)
        self.assertEqual((me["solvedCount"], me["score"]), (6, 875))


class Scoring(BackendCase):
    def test_time_bonus_is_ranked_by_solve_order_and_hidden_until_finalized(self):
        order = [self.team(1), self.team(2), self.team(3)]
        for team in order:
            self.assertEqual(self.submit_and_wait(team, "OB-002", self.factory.fix("OB-002"))["status"], "ACCEPTED")
            time.sleep(0.05)
        board = self.app.leaderboard()
        self.assertEqual([r["score"] for r in board], [75, 75, 75])          # base only
        self.assertEqual([r["teamId"] for r in board], ["CV-001", "CV-002", "CV-003"])  # earliest first
        self.app.db.kv_set("finalized", 1)
        scores = {r["teamId"]: r["score"] for r in self.app.leaderboard()}
        # 75 pts, max bonus 50%: first +37.5, second +18.75, third +0
        self.assertEqual(scores, {"CV-001": 75 + 38, "CV-002": 75 + 19, "CV-003": 75})

    def test_bonus_formula(self):
        from codeverse_server.scoring import bonus_for_solvers
        self.assertEqual(bonus_for_solvers({1: 5.0}, 100, 0.5), {1: 50.0})
        self.assertEqual(bonus_for_solvers({1: 1.0, 2: 2.0}, 100, 0.5), {1: 50.0, 2: 0.0})
        got = bonus_for_solvers({1: 1.0, 2: 2.0, 3: 3.0, 4: 4.0, 5: 5.0}, 200, 0.5)
        self.assertEqual([got[i] for i in range(1, 6)], [100.0, 75.0, 50.0, 25.0, 0.0])

    def test_invalidated_and_disqualified_do_not_score(self):
        t1, t2 = self.team(1), self.team(2)
        v1 = self.submit_and_wait(t1, "OB-001", self.factory.fix("OB-001"))
        self.submit_and_wait(t2, "OB-001", self.factory.fix("OB-001"))
        self.app.db.conn().execute("UPDATE submissions SET valid=0 WHERE id=?", (v1["id"],))
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()},
                         {"CV-001": 0, "CV-002": 50, "CV-003": 0})
        self.app.db.conn().execute("UPDATE teams SET disqualified=1 WHERE team_id='CV-002'")
        self.assertNotIn("CV-002", [r["teamId"] for r in self.app.leaderboard()])


class Recovery(BackendCase):
    workers = 0

    def test_interrupted_jobs_return_to_the_queue(self):
        team = self.team()
        view = self.app.submit(team, "OB-001", self.factory.fix("OB-001"))
        self.app.db.conn().execute("UPDATE submissions SET status='RUNNING' WHERE id=?", (view["id"],))
        self.assertEqual(self.app.recover(), 1)
        self.assertEqual(self.app.submission_view(view["id"])["status"], "QUEUED")


class Http(BackendCase):
    def setUp(self):
        super().setUp()
        from codeverse_server.api import make_server
        self.server = make_server(self.app, "127.0.0.1", 0)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        super().tearDown()

    def call(self, method, path, body=None, token=None):
        req = urllib.request.Request(self.base + path, method=method,
                                     data=json.dumps(body).encode() if body is not None else None)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_public_endpoints_and_auth(self):
        self.assertEqual(self.call("GET", "/api/health")[1]["ok"], True)
        code, status = self.call("GET", "/api/status")
        self.assertEqual((code, status["status"], status["phase"]), (200, "LIVE", 2))
        code, phases = self.call("GET", "/api/phases")
        self.assertEqual([p["status"] for p in phases], ["COMPLETED", "ACTIVE"])
        self.assertEqual([p["name"] for p in phases], ["THE INFILTRATION", "THE ROYAL MINT"])
        self.assertEqual(self.call("GET", "/api/leaderboard")[0], 200)
        self.assertEqual(self.call("GET", "/api/me")[0], 401)
        self.assertEqual(self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "nope"})[0], 401)

    def test_login_and_team_endpoints_match_the_website_contract(self):
        code, session = self.call("POST", "/api/login", {"teamId": "cv-001", "accessCode": "code1"})
        self.assertEqual(code, 200)
        tok = session["token"]
        _, me = self.call("GET", "/api/me", token=tok)
        self.assertEqual(set(me), {"id", "teamId", "teamName", "score", "rank", "totalTeams", "solvedCount",
                                   "gamesPlayed", "gamesTotal", "gamesScore", "obeliskOpen"})
        self.assertEqual(me["totalTeams"], 3)
        _, chs = self.call("GET", "/api/challenges", token=tok)
        self.assertEqual(len(chs), 6)
        self.assertTrue({"id", "name", "difficulty", "points", "status", "expectedBehavior"} <= set(chs[0]))
        self.assertEqual(self.call("GET", "/api/challenges/OB-004", token=tok)[1]["id"], "OB-004")
        self.assertEqual(self.call("GET", "/api/challenges/OB-999", token=tok)[0], 404)
        self.assertEqual(self.call("GET", "/api/bonus", token=tok)[1]["status"], "CLASSIFIED")

    def test_submit_over_http_and_poll(self):
        _, session = self.call("POST", "/api/login", {"teamId": "CV-002", "accessCode": "code2"})
        tok = session["token"]
        code, sub = self.call("POST", "/api/submissions",
                              {"challenge": "OB-005", "patch": self.factory.fix("OB-005")}, tok)
        self.assertEqual(code, 200)
        for _ in range(300):
            _, sub = self.call("GET", f"/api/submissions/{sub['id']}", token=tok)
            if sub["status"] not in ("QUEUED", "RUNNING"):
                break
            time.sleep(0.3)
        self.assertEqual((sub["status"], sub["passed"] == sub["total"]), ("ACCEPTED", True))
        # another team cannot read it
        _, other = self.call("POST", "/api/login", {"teamId": "CV-003", "accessCode": "code3"})
        self.assertEqual(self.call("GET", f"/api/submissions/{sub['id']}", token=other["token"])[0], 404)
        self.assertEqual(len(self.call("GET", "/api/submissions", token=tok)[1]), 1)


if __name__ == "__main__":
    unittest.main()
