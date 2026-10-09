import json
import os
import sqlite3
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import support
from support import BackendCase, auth, event

TOKEN = "test-admin-token"


class AdminCase(BackendCase):
    def setUp(self):
        super().setUp()
        os.environ["CODEVERSE_ADMIN_TOKEN"] = TOKEN
        from codeverse_server.api import make_server
        self.server = make_server(self.app, "127.0.0.1", 0)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        os.environ.pop("CODEVERSE_ADMIN_TOKEN", None)
        self.server.shutdown()
        self.server.server_close()
        super().tearDown()

    def call(self, method, path, body=None, headers=None, admin=True):
        req = urllib.request.Request(self.base + path, method=method,
                                     data=json.dumps(body).encode() if body is not None else None)
        req.add_header("Content-Type", "application/json")
        if admin:
            req.add_header("X-Admin-Token", TOKEN)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if r.headers.get_content_type() == "application/json" else raw.decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def A(self, path, body=None):
        """Admin call that must succeed."""
        code, data = self.call("POST" if body is not None else "GET", "/api/admin" + path, body)
        self.assertEqual(code, 200, data)
        return data

    def wait(self, sub_id, timeout=180):
        end = time.time() + timeout
        while time.time() < end:
            v = self.app.submission_view(sub_id)
            if v["status"] not in ("QUEUED", "RUNNING"):
                return v
            time.sleep(0.3)
        self.fail("judging timed out")


class Access(AdminCase):
    def test_token_required(self):
        self.assertEqual(self.call("GET", "/api/admin/overview", admin=False)[0], 401)
        self.assertEqual(self.call("GET", "/api/admin/overview", headers={"X-Admin-Token": "nope"}, admin=False)[0], 401)
        self.assertEqual(self.call("POST", "/api/admin/teams", {"teamName": "x"}, admin=False)[0], 401)
        self.assertEqual(self.call("GET", "/api/admin/overview")[0], 200)

    def test_ui_is_served_and_contains_no_secrets(self):
        code, html = self.call("GET", "/admin", admin=False)
        self.assertEqual(code, 200)
        self.assertIn("Codeverse Admin", html)
        self.assertNotIn(TOKEN, html)

    def test_participant_token_is_not_an_admin_token(self):
        tok = auth.login(self.app.db, "CV-001", "code1")["token"]
        code, _ = self.call("GET", "/api/admin/overview", headers={"X-Admin-Token": tok}, admin=False)
        self.assertEqual(code, 401)


class Teams(AdminCase):
    def test_create_bulk_update_delete(self):
        t = self.A("/teams", {"teamName": "Alpha"})
        self.assertEqual(t["teamId"], "CV-004")                       # next after CV-003
        self.assertEqual(len(t["accessCode"]), 6)
        self.assertEqual(self.call("POST", "/api/admin/teams", {"teamName": "Dup", "teamId": "cv-004"})[0], 409)
        self.assertEqual(self.call("POST", "/api/admin/teams", {"teamName": ""})[0], 400)
        made = self.A("/teams/bulk", {"count": 3, "namePrefix": "Crew"})
        self.assertEqual([m["teamId"] for m in made], ["CV-005", "CV-006", "CV-007"])
        csv_made = self.A("/teams/bulk", {"csv": "teamId,teamName,accessCode\nZED-1,Zed,SECRET\nJust A Name\nCV-050,Fifty"})
        self.assertEqual([m["teamId"] for m in csv_made], ["ZED-1", "CV-008", "CV-050"])
        self.assertEqual(auth.login(self.app.db, "zed-1", "SECRET")["participantId"], "ZED-1")
        self.assertEqual(len(self.A("/teams")), 3 + 1 + 3 + 3)

        # rename + reset code signs the team out and invalidates the old code
        old_tok = auth.login(self.app.db, "CV-004", t["accessCode"])["token"]
        r = self.A("/teams/CV-004", {"teamName": "Alpha Prime", "resetCode": True})
        self.assertEqual(r["teamName"], "Alpha Prime")
        self.assertIsNone(auth.login(self.app.db, "CV-004", t["accessCode"]))
        self.assertIsNone(auth.team_for_token(self.app.db, old_tok))
        self.assertTrue(auth.login(self.app.db, "CV-004", r["newAccessCode"]))

        # disqualify / restore
        self.A("/teams/CV-004", {"disqualified": True})
        with self.assertRaises(auth.Disqualified):
            auth.login(self.app.db, "CV-004", r["newAccessCode"])
        self.assertNotIn("CV-004", [x["teamId"] for x in self.app.leaderboard()])
        self.A("/teams/CV-004", {"disqualified": False})
        self.assertIn("CV-004", [x["teamId"] for x in self.app.leaderboard()])

        # delete only without submissions
        self.assertEqual(self.A("/teams/CV-004/delete", {})["deleted"], "CV-004")
        self.app.submit(self.team(1), "OB-001", "garbage")
        self.assertEqual(self.call("POST", "/api/admin/teams/CV-001/delete", {})[0], 409)
        self.assertEqual(self.call("POST", "/api/admin/teams/NOPE", {"teamName": "x"})[0], 404)

    def test_credentials_are_available_for_reprinting(self):
        rows = {t["teamId"]: t for t in self.A("/teams")}
        self.assertEqual(rows["CV-002"]["accessCode"], "code2")


class PanelRegressions(AdminCase):
    def test_admin_script_has_valid_javascript(self):
        import re, shutil, subprocess, tempfile
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        html = (Path(__file__).resolve().parent.parent / "admin_ui" / "index.html").read_text(encoding="utf-8")
        js = re.search(r"<script>(.*)</script>", html, re.S).group(1)
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "admin.js"
            f.write_text(js, encoding="utf-8")
            r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_post_without_reading_body_does_not_break_the_connection(self):
        import http.client
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_address[1])
        hdr = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}
        for _ in range(3):  # backup ignores its body; the next request on the same connection must still work
            conn.request("POST", "/api/admin/backup", body="{}", headers=hdr)
            r = conn.getresponse(); r.read()
            self.assertEqual(r.status, 200)
            conn.request("GET", "/api/admin/overview", headers=hdr)
            r = conn.getresponse(); r.read()
            self.assertEqual(r.status, 200)
        conn.close()


class EventControl(AdminCase):
    def test_event_controls_announcement_and_settings(self):
        self.assertEqual(self.A("/overview")["event"]["status"], "LIVE")
        self.A("/event", {"action": "pause"})
        self.assertEqual(self.call("GET", "/api/status")[1]["status"], "PAUSED")
        self.assertEqual(self.call("GET", "/api/admin/overview")[1]["event"]["status"], "PAUSED")
        self.A("/event", {"action": "resume"})
        end_before = event._f(self.app.db, "phase2_end")
        self.A("/event", {"action": "extend", "minutes": 10})
        self.assertAlmostEqual(event._f(self.app.db, "phase2_end") - end_before, 600, delta=1)
        self.A("/event", {"action": "phase", "number": 1})
        self.assertEqual(self.call("GET", "/api/status")[1]["phase"], 1)
        self.A("/event", {"action": "phase", "number": 2})
        self.assertEqual(self.call("GET", "/api/status")[1]["phase"], 2)
        self.A("/event", {"action": "end"})
        self.assertEqual(self.call("GET", "/api/status")[1]["status"], "ENDED")
        self.A("/event", {"action": "start", "phase1Minutes": 30})
        self.assertEqual(self.call("GET", "/api/status")[1]["status"], "LIVE")
        self.assertEqual(self.call("POST", "/api/admin/event", {"action": "explode"})[0], 400)

        self.A("/announcement", {"text": "Phase 1 extended by 10 minutes"})
        self.assertEqual(self.call("GET", "/api/status")[1]["announcement"], "Phase 1 extended by 10 minutes")
        self.A("/announcement", {"text": ""})
        self.assertEqual(self.call("GET", "/api/status")[1]["announcement"], "")

        s = self.A("/settings", {"maxBonus": 1.0, "cooldownSeconds": 30})
        self.assertEqual((s["maxBonus"], s["cooldownSeconds"]), (1.0, 30.0))
        self.assertEqual(self.app.cooldown(), 30.0)
        self.assertEqual(self.call("POST", "/api/admin/settings", {"maxBonus": 99})[0], 400)

    def test_backup_and_audit(self):
        b = self.A("/backup", {})
        self.assertTrue(Path(b["file"]).exists())
        con = sqlite3.connect(b["file"])
        self.assertEqual(con.execute("select count(*) from teams").fetchone()[0], 3)
        con.close()
        self.A("/announcement", {"text": "hello"})
        actions = [a["action"] for a in self.A("/audit")]
        self.assertIn("backup", actions)
        self.assertIn("announcement", actions)


class Submissions(AdminCase):
    def test_inspect_override_grant_and_rejudge(self):
        t1, t2 = self.team(1), self.team(2)
        good = self.app.submit(t1, "OB-001", self.factory.fix("OB-001"))
        wrong = self.app.submit(t2, "OB-003", self.factory.fix("OB-001", label="OB-003"))
        self.wait(good["id"]); self.wait(wrong["id"])

        listing = self.A("/submissions?team=CV-001")
        self.assertEqual([i["id"] for i in listing["items"]], [good["id"]])
        self.assertEqual(self.A("/submissions?status=REJECTED")["items"][0]["id"], wrong["id"])
        self.assertEqual(self.A("/submissions?challenge=OB-001")["total"], 1)

        d = self.A(f"/submissions/{wrong['id']}")
        self.assertIn("diff --git", d["patch"])
        self.assertTrue(d["failedTests"], "failing test names should be recorded")
        self.assertEqual(d["teamId"], "CV-002")

        board = {r["teamId"]: r["score"] for r in self.app.leaderboard()}
        self.assertEqual(board["CV-001"], 50)
        self.A(f"/submissions/{good['id']}", {"action": "invalidate"})
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()}["CV-001"], 0)
        self.A(f"/submissions/{good['id']}", {"action": "restore"})
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()}["CV-001"], 50)

        # force-accept the rejected one -> scores for OB-003, and does not poison later judging
        self.A(f"/submissions/{wrong['id']}", {"action": "accept"})
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()}["CV-002"], 100)
        later = self.app.submit(t2, "OB-002", self.factory.fix("OB-002"))
        self.assertEqual(self.wait(later["id"])["status"], "ACCEPTED")
        self.A(f"/submissions/{wrong['id']}", {"action": "reject"})
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()}["CV-002"], 75)

        # grant (no patch) then judge another bug: the granted bug's tests must not be required
        g = self.A("/grant", {"teamId": "CV-003", "challenge": "OB-004", "note": "test"})
        self.assertEqual(g["granted"], "OB-004")
        self.assertEqual(self.call("POST", "/api/admin/grant", {"teamId": "CV-003", "challenge": "OB-004"})[0], 409)
        self.assertEqual({r["teamId"]: r["score"] for r in self.app.leaderboard()}["CV-003"], 150)
        s3 = self.app.submit(self.team(3), "OB-005", self.factory.fix("OB-005"))
        self.assertEqual(self.wait(s3["id"])["status"], "ACCEPTED")

        # rejudge a single submission and in bulk
        self.A(f"/submissions/{good['id']}", {"action": "rejudge"})
        self.assertEqual(self.wait(good["id"])["status"], "ACCEPTED")
        self.assertEqual(self.A("/rejudge", {"challenge": "OB-001"})["requeued"], 1)
        self.assertEqual(self.wait(good["id"])["status"], "ACCEPTED")


class Scores(AdminCase):
    def test_adjustments_change_public_scores(self):
        self.A("/adjustments", {"teamId": "CV-002", "points": 25, "reason": "bonus for helping"})
        self.A("/adjustments", {"teamId": "CV-003", "points": -10, "reason": "late"})
        board = {r["teamId"]: r["score"] for r in self.call("GET", "/api/leaderboard")[1]}
        self.assertEqual(board, {"CV-001": 0, "CV-002": 25, "CV-003": -10})
        self.assertEqual(self.call("GET", "/api/leaderboard")[1][0]["teamId"], "CV-002")
        rows = {r["teamId"]: r for r in self.A("/leaderboard")["rows"]}
        self.assertEqual((rows["CV-002"]["adjustment"], rows["CV-002"]["score"]), (25, 25))
        listed = self.A("/adjustments")
        self.assertEqual(len(listed), 2)
        self.A(f"/adjustments/{listed[0]['id']}/delete", {})
        self.assertEqual(len(self.A("/adjustments")), 1)
        self.assertEqual(self.call("POST", "/api/admin/adjustments", {"teamId": "CV-001", "points": 0})[0], 400)
        self.assertEqual(self.call("POST", "/api/admin/adjustments", {"teamId": "CV-001", "points": "x"})[0], 400)
        self.assertEqual(self.call("POST", "/api/admin/adjustments", {"teamId": "NOPE", "points": 5})[0], 404)

    def test_finalize_toggles_bonus_visibility(self):
        self.app.db.conn().execute(
            "INSERT INTO submissions(team_pk, challenge, status, created, manual) "
            "SELECT pk, 'OB-002', 'ACCEPTED', 100 + pk, 1 FROM teams")
        self.assertEqual([r["score"] for r in self.app.leaderboard()], [75, 75, 75])
        self.A("/event", {"action": "finalize"})
        self.assertEqual([r["score"] for r in self.app.leaderboard()], [75 + 38, 75 + 19, 75])
        self.A("/event", {"action": "unfinalize"})
        self.assertEqual([r["score"] for r in self.app.leaderboard()], [75, 75, 75])


class Flags(AdminCase):
    def test_automatic_and_manual_flags(self):
        # forbidden path
        bad = self.factory.make("FIX[OB-001]: sneaky", {"public_tests/test_cli.py": "pass\n"})
        self.app.submit(self.team(1), "OB-001", bad)
        # identical non-trivial patches from two teams (rejected instantly by label mismatch)
        body = "".join(f"# line {i}\n" for i in range(12))
        tok = (self.assets / "base" / "src" / "obelisk" / "tokenizer.py").read_text()
        same = self.factory.make("FIX[OB-001]: copy", {"src/obelisk/tokenizer.py": tok + body})
        self.app.submit(self.team(2), "OB-002", same)
        self.app.submit(self.team(3), "OB-002", same)

        flags = self.A("/flags?resolved=0")
        kinds = sorted(f["kind"] for f in flags)
        self.assertEqual(kinds, ["DUPLICATE_PATCH", "FORBIDDEN_PATH"])
        dup = next(f for f in flags if f["kind"] == "DUPLICATE_PATCH")
        self.assertEqual(dup["teamId"], "CV-003")
        self.assertIn("CV-002", dup["detail"])
        self.assertEqual(self.A("/overview")["counts"]["openFlags"], 2)

        listed = self.A("/flags", {"teamId": "CV-001", "detail": "seen sharing screens", "kind": "behaviour"})
        self.assertIn("BEHAVIOUR", [f["kind"] for f in listed])
        fid = next(f["id"] for f in listed if f["kind"] == "FORBIDDEN_PATH")
        self.A(f"/flags/{fid}", {"resolved": True, "note": "checked, accidental"})
        open_now = self.A("/flags?resolved=0")
        self.assertNotIn(fid, [f["id"] for f in open_now])
        allf = {f["id"]: f for f in self.A("/flags")}
        self.assertEqual(allf[fid]["note"], "checked, accidental")
        self.assertEqual(self.call("POST", "/api/admin/flags", {"teamId": "CV-001", "detail": ""})[0], 400)

    def test_tiny_identical_patches_are_not_flagged(self):
        tiny = self.factory.fix("OB-001")        # one-line fix, legitimately identical across teams
        self.app.submit(self.team(1), "OB-002", tiny)   # label mismatch -> instant rejection
        self.app.submit(self.team(2), "OB-002", tiny)
        self.assertEqual(self.A("/flags"), [])


class Migration(unittest.TestCase):
    def test_old_database_is_upgraded_in_place(self):
        import tempfile
        from codeverse_server.db import Database
        d = Path(tempfile.mkdtemp()) / "old.db"
        con = sqlite3.connect(d)
        con.executescript("""
            CREATE TABLE teams (pk INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT UNIQUE, team_name TEXT, code_hash TEXT, disqualified INTEGER DEFAULT 0);
            CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, team_pk INTEGER, challenge TEXT, patch_file TEXT, patch_sha TEXT, status TEXT, passed INTEGER, total INTEGER, reason TEXT, created REAL, started REAL, finished REAL, valid INTEGER DEFAULT 1);
            CREATE TABLE flags (id INTEGER PRIMARY KEY AUTOINCREMENT, team_pk INTEGER, submission_id INTEGER, kind TEXT, detail TEXT, created REAL);
            INSERT INTO teams(team_id, team_name, code_hash) VALUES('CV-001','Old','x');
        """)
        con.commit(); con.close()
        db = Database(d)
        db.init()
        cols = {r["name"] for r in db.conn().execute("PRAGMA table_info(teams)")}
        self.assertIn("code_plain", cols)
        self.assertIn("manual", {r["name"] for r in db.conn().execute("PRAGMA table_info(submissions)")})
        self.assertIn("resolved", {r["name"] for r in db.conn().execute("PRAGMA table_info(flags)")})
        self.assertEqual(db.conn().execute("select team_name from teams").fetchone()[0], "Old")


if __name__ == "__main__":
    unittest.main()
