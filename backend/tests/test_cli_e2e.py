"""The participant CLI against a real (in-process) server and a real git repository."""

import os
import shutil
import subprocess
import sys
import threading
import unittest
from pathlib import Path

import support
from support import BackendCase, git

CLI = support.BACKEND.parent / "cli" / "codeverse.py"


class CliEndToEnd(BackendCase):
    def setUp(self):
        super().setUp()
        from codeverse_server.api import make_server
        self.server = make_server(self.app, "127.0.0.1", 0)
        self.url = f"127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.home = Path(self.cfg.data_dir) / "cli-home"
        self.repo = Path(self.cfg.data_dir) / "participant"
        shutil.copytree(self.assets / "base", self.repo)
        git(self.repo, "init", "-q")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "official base")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        super().tearDown()

    def cli(self, *args):
        env = dict(os.environ, CODEVERSE_HOME=str(self.home))
        env.pop("CODEVERSE_SERVER", None)
        p = subprocess.run([sys.executable, str(CLI), *args], cwd=self.repo, env=env,
                           capture_output=True, text=True, timeout=240)
        return p.returncode, p.stdout, p.stderr

    def commit_fix(self, bug, message):
        rel = f"src/obelisk/{support.BUG_FILE[bug]}"
        (self.repo / rel).write_text((support.REFERENCE / support.BUG_FILE[bug]).read_text(), encoding="utf-8", newline="\n")
        git(self.repo, "commit", "-q", "-am", message)

    def login(self):
        return self.cli("login", "--server", self.url, "--team", "CV-001", "--code", "code1")

    def test_login_failures_and_success(self):
        code, _, err = self.cli("login", "--server", self.url, "--team", "CV-001", "--code", "wrong")
        self.assertEqual(code, 2)
        self.assertIn("wrong team ID or access code", err)
        code, out, _ = self.login()
        self.assertEqual(code, 0)
        self.assertIn("Signed in as CV-001", out)

    def test_not_signed_in(self):
        code, _, err = self.cli("status")
        self.assertEqual(code, 2)
        self.assertIn("codeverse login", err)

    def test_unreachable_server(self):
        code, _, err = self.cli("login", "--server", "127.0.0.1:9", "--team", "CV-001", "--code", "x")
        self.assertEqual(code, 2)
        self.assertIn("cannot reach", err)

    def test_label_checked_before_sending(self):
        self.login()
        self.commit_fix("OB-001", "repair index with no label")
        code, _, err = self.cli("submit", "OB-001")
        self.assertEqual(code, 2)
        self.assertIn("FIX[OB-001]", err)
        self.assertEqual(self.app.db.conn().execute("SELECT COUNT(*) FROM submissions").fetchone()[0], 0)

    def test_full_workflow(self):
        self.login()
        self.commit_fix("OB-001", "FIX[OB-001]: repair vault index")
        code, out, err = self.cli("submit", "OB-001")
        self.assertEqual(code, 0, out + err)
        self.assertRegex(out, r"PASSED (\d+)/\1\s+-\s+OB-001 ACCEPTED")
        code, out, _ = self.cli("status")
        self.assertIn("score 50", out)
        self.assertIn("[x] OB-001", out)
        code, out, _ = self.cli("submit", "OB-001")      # already solved
        self.assertEqual(code, 1)
        self.assertIn("already solved", out)
        code, out, _ = self.cli("history")
        self.assertIn("ACCEPTED", out)
        code, out, _ = self.cli("leaderboard")
        self.assertIn("Team 1", out)

    def test_wrong_bug_gets_partial_pass_count(self):
        self.login()
        self.commit_fix("OB-001", "FIX[OB-003]: totally the history")
        code, out, _ = self.cli("submit", "OB-003")
        self.assertEqual(code, 1)
        self.assertRegex(out, r"PASSED \d+/\d+\s+-\s+not accepted")


if __name__ == "__main__":
    unittest.main()
