"""Judging: rebuild the team's tree, run both test suites, compute PASSED/TOTAL.

Participant code runs in a throw-away directory with a minimal environment, a hard
timeout and process-tree kill. No container is needed (and none is available).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from . import patches
from .config import Config

RUNNER = r"""
import json, sys, unittest
d = sys.argv[1]
skip = set(json.load(open(sys.argv[2])))
prefix = sys.argv[3]
def flatten(s):
    for t in s:
        if isinstance(t, unittest.TestSuite):
            yield from flatten(t)
        else:
            yield t
suite = unittest.TestSuite(
    t for t in flatten(unittest.defaultTestLoader.discover(d, top_level_dir=d))
    if prefix + ":" + t.id() not in skip
)
out = {}
class R(unittest.TextTestResult):
    def addSuccess(s, t): out[t.id()] = "pass"; super().addSuccess(t)
    def addFailure(s, t, e): out[t.id()] = "fail"; super().addFailure(t, e)
    def addError(s, t, e): out[t.id()] = "error"; super().addError(t, e)
    def addSkip(s, t, r): out[t.id()] = "skip"; super().addSkip(t, r)
import os
unittest.TextTestRunner(stream=open(os.devnull, "w"), resultclass=R).run(suite)
print("RESULT_JSON=" + json.dumps(out))
"""


class Gate:
    """Reader/writer gate: ordinary jobs share the machine, timed jobs own it."""

    def __init__(self) -> None:
        self._cond = threading.Condition()
        self._shared = 0
        self._exclusive = False
        self._waiting_exclusive = 0

    @contextmanager
    def shared(self):
        with self._cond:
            while self._exclusive or self._waiting_exclusive:
                self._cond.wait()
            self._shared += 1
        try:
            yield
        finally:
            with self._cond:
                self._shared -= 1
                self._cond.notify_all()

    @contextmanager
    def exclusive(self):
        with self._cond:
            self._waiting_exclusive += 1
            while self._exclusive or self._shared:
                self._cond.wait()
            self._waiting_exclusive -= 1
            self._exclusive = True
        try:
            yield
        finally:
            with self._cond:
                self._exclusive = False
                self._cond.notify_all()


@dataclass
class Verdict:
    status: str  # ACCEPTED | REJECTED
    passed: int | None
    total: int | None
    reason: str | None = None
    failed: list | None = None


class Assets:
    """Organizer-side material: base release, private tests, bug-to-test mapping."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.base = self.root / "base"
        self.private_tests = self.root / "private_tests"
        mapping_file = self.root / "test_mapping.json"
        self.ok = self.base.is_dir() and self.private_tests.is_dir() and mapping_file.is_file()
        self.mapping: dict[str, dict[str, list[str]]] = (
            json.loads(mapping_file.read_text(encoding="utf-8")) if mapping_file.is_file() else {}
        )

    def bug_tests(self, bug: str) -> set[str]:
        entry = self.mapping.get(bug, {})
        return {f"pub:{t}" for t in entry.get("public", [])} | {
            f"priv:{t}" for t in entry.get("private", [])
        }

    def all_bug_tests(self) -> set[str]:
        out: set[str] = set()
        for bug in self.mapping:
            out |= self.bug_tests(bug)
        return out


def _kill_tree(proc: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        else:
            import signal

            os.killpg(proc.pid, signal.SIGKILL)
    except (OSError, ProcessLookupError):
        pass
    try:
        proc.kill()
    except OSError:
        pass


def _limits():  # POSIX only: runs in the child before exec
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (300, 300))
    resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 2**20, 100 * 2**20))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_AS, (3 * 2**30, 3 * 2**30))


def run_suite(tree: Path, suite_dir: Path, scratch: Path, timeout: int, skip: set[str], prefix: str) -> dict[str, str] | None:
    """Run one unittest suite in a sandboxed subprocess. None on timeout/crash."""
    keep = ("PATH", "SYSTEMROOT", "SystemRoot", "COMSPEC", "LANG", "LC_ALL")
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env.update(
        PYTHONDONTWRITEBYTECODE="1",
        PYTHONIOENCODING="utf-8",
        TMPDIR=str(scratch),
        TEMP=str(scratch),
        TMP=str(scratch),
    )
    out_file = scratch / f"out-{suite_dir.name}.txt"
    skip_file = scratch / f"skip-{suite_dir.name}.json"
    skip_file.write_text(json.dumps(sorted(skip)), encoding="utf-8")
    kwargs: dict = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
        kwargs["preexec_fn"] = _limits
    with open(out_file, "wb") as sink:
        proc = subprocess.Popen(
            [sys.executable, "-B", "-c", RUNNER, str(suite_dir), str(skip_file), prefix],
            cwd=str(tree),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=sink,
            stderr=subprocess.STDOUT,
            **kwargs,
        )
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            _kill_tree(proc)
            proc.wait()
            return None
    with open(out_file, "rb") as fh:
        fh.seek(0, os.SEEK_END)
        fh.seek(max(0, fh.tell() - 200_000))
        tail = fh.read().decode("utf-8", "replace")
    for line in reversed(tail.splitlines()):
        if line.startswith("RESULT_JSON="):
            return json.loads(line[len("RESULT_JSON="):])
    return None


def _rmtree(path: Path) -> None:
    def onerror(func, p, _exc):
        try:
            os.chmod(p, 0o700)
            func(p)
        except OSError:
            pass

    shutil.rmtree(path, onerror=onerror)


def judge(
    cfg: Config,
    assets: Assets,
    job_id: int,
    claimed: str,
    new_patch: str,
    accepted_patches: list[str],
    solved_bugs: set[str],
) -> Verdict:
    job_dir = cfg.jobs_dir / f"job-{job_id}"
    if job_dir.exists():
        _rmtree(job_dir)
    scratch = job_dir / "scratch"
    tree = job_dir / "tree"
    scratch.mkdir(parents=True)
    ok = False
    try:
        shutil.copytree(assets.base, tree, ignore=shutil.ignore_patterns("__pycache__", ".obelisk-state"))
        shutil.copytree(assets.private_tests, tree / "_judge" / "private_tests",
                        ignore=shutil.ignore_patterns("__pycache__"))
        try:
            for text in accepted_patches:
                patches.apply(tree, text)
            patches.apply(tree, new_patch)
        except patches.PatchError as exc:
            return Verdict("REJECTED", None, None, exc.reason)

        # Timed (exclusive) bugs are slow while unfixed: only run their tests when they matter.
        skip: set[str] = set()
        for bug in cfg.exclusive_challenges:
            if bug != claimed and bug not in solved_bugs:
                skip |= assets.bug_tests(bug)
        results: dict[str, str] = {}
        for prefix, suite in (("pub", tree / "public_tests"), ("priv", tree / "_judge" / "private_tests")):
            res = run_suite(tree, suite, scratch, cfg.suite_timeout_seconds, skip, prefix)
            if res is None:
                judged = _judged_set(assets, claimed, solved_bugs, None)
                return Verdict("REJECTED", 0, len(judged), "TIMEOUT")
            results.update({f"{prefix}:{k}": v for k, v in res.items()})

        judged = _judged_set(assets, claimed, solved_bugs, set(results))
        passed = sum(1 for t in judged if results.get(t) == "pass")
        total = len(judged)
        failed = sorted(t for t in judged if results.get(t) != "pass")

        # One bug = one patch: reject patches that also repair a different, unsolved bug.
        extra = [
            b for b in assets.mapping
            if b != claimed and b not in solved_bugs
            and all(results.get(t) == "pass" for t in assets.bug_tests(b))
        ]
        claimed_fixed = all(results.get(t) == "pass" for t in assets.bug_tests(claimed))
        if extra and claimed_fixed:
            return Verdict("REJECTED", passed, total, "MULTIPLE_FIXES", failed)
        ok = passed == total
        return Verdict("ACCEPTED" if ok else "REJECTED", passed, total, None, failed)
    finally:
        if ok or not cfg.keep_failed_jobs:
            _rmtree(job_dir)


def _judged_set(assets: Assets, claimed: str, solved: set[str], seen: set[str] | None) -> set[str]:
    """Target tests + tests of already-solved bugs + tests that belong to no bug."""
    judged = set(assets.bug_tests(claimed))
    for bug in solved:
        judged |= assets.bug_tests(bug)
    if seen is not None:
        judged |= seen - assets.all_bug_tests()
    return judged
