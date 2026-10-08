"""Test helpers: a throw-away server instance and real OBELISK fix patches."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "scripts"))

from codeverse_server import auth, event  # noqa: E402
from codeverse_server.config import Config  # noqa: E402
from codeverse_server.service import ApiError, App  # noqa: E402
from codeverse_server.worker import start_workers  # noqa: E402
import prepare_judge_assets  # noqa: E402

OBELISK = BACKEND.parent / "OBELISK"
REFERENCE = OBELISK / "ORGANIZERS-ONLY" / "reference" / "src" / "obelisk"
BUG_FILE = {
    "OB-001": "indexer.py", "OB-002": "transactions.py", "OB-003": "history.py",
    "OB-004": "query_parser.py", "OB-005": "cache.py", "OB-006": "autocomplete.py",
}

GIT = ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false",
       "-c", "core.autocrlf=false"]


def git(cwd, *args, check=True):
    return subprocess.run(GIT + list(args), cwd=cwd, capture_output=True, text=True, check=check)


class PatchFactory:
    """Builds ``git format-patch`` text on top of the official base release."""

    def __init__(self, base: Path, workdir: Path) -> None:
        self.repo = workdir / "repo"
        shutil.copytree(base, self.repo)
        git(self.repo, "init", "-q")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "base")
        self.base_rev = git(self.repo, "rev-parse", "HEAD").stdout.strip()

    def make(self, subject: str, changes: dict[str, str]) -> str:
        git(self.repo, "reset", "-q", "--hard", self.base_rev)
        for rel, content in changes.items():
            target = self.repo / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", subject)
        text = git(self.repo, "format-patch", "--stdout", "-1").stdout
        git(self.repo, "reset", "-q", "--hard", self.base_rev)
        return text

    def fix(self, bug: str, label: str | None = None) -> str:
        rel = f"src/obelisk/{BUG_FILE[bug]}"
        return self.make(f"FIX[{label or bug}]: repair {bug}", {rel: (REFERENCE / BUG_FILE[bug]).read_text(encoding="utf-8")})


class BackendCase(unittest.TestCase):
    workers = 2

    @classmethod
    def setUpClass(cls):
        if not REFERENCE.is_dir():
            raise unittest.SkipTest("OBELISK reference not found")
        cls.tmp = Path(tempfile.mkdtemp(prefix="cv-backend-"))
        cls.assets = cls.tmp / "assets"
        prepare_judge_assets.prepare(OBELISK, cls.assets)
        cls.factory = PatchFactory(cls.assets / "base", cls.tmp / "patches")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def setUp(self):
        data = Path(tempfile.mkdtemp(prefix="cv-data-", dir=self.tmp))
        self.cfg = Config(data_dir=data, assets_dir=self.assets, cooldown_seconds=0, workers=self.workers)
        self.app = App(self.cfg)
        for i in (1, 2, 3):
            auth.upsert_team(self.app.db, f"CV-00{i}", f"Team {i}", f"code{i}")
        event.start(self.app.db, phase1_minutes=60)
        start_workers(self.app)

    def tearDown(self):
        self.app.stop.set()
        time.sleep(0.6)

    def team(self, n=1):
        tok = auth.login(self.app.db, f"CV-00{n}", f"code{n}")["token"]
        return auth.team_for_token(self.app.db, tok)

    def submit_and_wait(self, team, challenge, patch, timeout=180):
        view = self.app.submit(team, challenge, patch)
        deadline = time.time() + timeout
        while view["status"] in ("QUEUED", "RUNNING") and time.time() < deadline:
            time.sleep(0.3)
            view = self.app.submission_view(view["id"])
        return view
