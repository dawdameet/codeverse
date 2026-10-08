"""Organizer verification: reference must be fully green; the participant
version must fail exactly the tests mapped to each bug and nothing else.

    python ORGANIZERS-ONLY/verify_bugs.py            # verify and print summary
    python ORGANIZERS-ONLY/verify_bugs.py --snapshot # (re)write test_mapping.json
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MAPPING_FILE = HERE / "test_mapping.json"

SUITES = {"public": ROOT / "public_tests", "private": HERE / "private_tests"}

# Which module belongs to which bug (used only when snapshotting).
MODULE_BUG = {
    "test_indexing": "OB-001", "test_private_index": "OB-001",
    "test_transactions": "OB-002", "test_private_transactions": "OB-002",
    "test_history": "OB-003", "test_private_history": "OB-003",
    "test_parser": "OB-004", "test_private_parser": "OB-004",
    "test_cache": "OB-005", "test_private_cache": "OB-005",
    "test_autocomplete": "OB-006", "test_private_performance": "OB-006",
}

RUNNER = r"""
import json, sys, unittest
d = sys.argv[1]
suite = unittest.defaultTestLoader.discover(d, top_level_dir=d)
out = {}
class R(unittest.TextTestResult):
    def addSuccess(s, t): out[t.id()] = "pass"; super().addSuccess(t)
    def addFailure(s, t, e): out[t.id()] = "fail"; super().addFailure(t, e)
    def addError(s, t, e): out[t.id()] = "error"; super().addError(t, e)
unittest.TextTestRunner(stream=open(__import__('os').devnull, 'w'), resultclass=R).run(suite)
print(json.dumps(out))
"""


def run_suite(name: str, src: Path | None) -> dict[str, str]:
    env = dict(os.environ)
    env.pop("OBELISK_SRC", None)
    if src is not None:
        env["OBELISK_SRC"] = str(src)
    proc = subprocess.run(
        [sys.executable, "-c", RUNNER, str(SUITES[name])],
        capture_output=True, text=True, env=env, cwd=str(HERE), timeout=900,
    )
    return json.loads(proc.stdout.strip().splitlines()[-1])


def run_all(src: Path | None) -> dict[str, dict[str, str]]:
    return {name: run_suite(name, src) for name in SUITES}


def snapshot() -> int:
    results = run_all(None)
    mapping: dict[str, dict[str, list[str]]] = {}
    for suite, tests in results.items():
        for test_id, status in sorted(tests.items()):
            if status == "pass":
                continue
            module = test_id.split(".")[0]
            bug = MODULE_BUG[module]
            mapping.setdefault(bug, {"public": [], "private": []})[suite].append(test_id)
    MAPPING_FILE.write_text(json.dumps(mapping, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {MAPPING_FILE.name}: " + ", ".join(
        f"{b}={len(v['public'])}+{len(v['private'])}" for b, v in sorted(mapping.items())))
    return 0


def verify() -> int:
    mapping = json.loads(MAPPING_FILE.read_text(encoding="utf-8"))
    ok = True

    print("== reference implementation (must be fully green)")
    ref = run_all(HERE / "reference" / "src")
    for suite, tests in ref.items():
        bad = [t for t, s in tests.items() if s != "pass"]
        print(f"   {suite}: {len(tests) - len(bad)}/{len(tests)} pass")
        ok &= not bad

    print("== participant version (must fail exactly the mapped tests)")
    cur = run_all(None)
    expected_fail = {t for bug in mapping.values() for suite in bug.values() for t in suite}
    actual_fail = {t for tests in cur.values() for t, s in tests.items() if s != "pass"}
    unexpected = sorted(actual_fail - expected_fail)
    missing = sorted(expected_fail - actual_fail)
    for t in unexpected:
        print(f"   UNEXPECTED FAILURE (collateral): {t}")
    for t in missing:
        print(f"   EXPECTED FAILURE DID NOT FAIL:   {t}")
    ok &= not unexpected and not missing

    print()
    for bug in sorted(mapping):
        fails = {t for suite in mapping[bug].values() for t in suite}
        good = fails <= actual_fail and fails
        ok &= bool(good)
        n_pub, n_priv = len(mapping[bug]["public"]), len(mapping[bug]["private"])
        print(f"{bug}  {'FAILING AS INTENDED' if good else 'NOT FAILING':<20} "
              f"(public {n_pub}, private {n_priv})")
    print("\nRESULT:", "PASS - exactly six defects, no collateral" if ok else "FAIL")
    return 0 if ok else 1


BUG_FILE = {
    "OB-001": "indexer.py", "OB-002": "transactions.py", "OB-003": "history.py",
    "OB-004": "query_parser.py", "OB-005": "cache.py", "OB-006": "autocomplete.py",
}


def isolate() -> int:
    """Apply each bug's file on top of the clean reference, one at a time."""
    import filecmp
    import shutil
    import tempfile

    mapping = json.loads(MAPPING_FILE.read_text(encoding="utf-8"))
    ref_pkg, cur_pkg = HERE / "reference" / "src" / "obelisk", ROOT / "src" / "obelisk"
    changed = sorted(
        f.name for f in cur_pkg.glob("*.py")
        if not (ref_pkg / f.name).exists() or not filecmp.cmp(f, ref_pkg / f.name, shallow=False)
    )
    print("files differing from reference:", ", ".join(changed))
    ok = changed == sorted(BUG_FILE.values())
    for bug, filename in sorted(BUG_FILE.items()):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(HERE / "reference" / "src", Path(tmp) / "src")
            shutil.copy(cur_pkg / filename, Path(tmp) / "src" / "obelisk" / filename)
            res = run_all(Path(tmp) / "src")
        failing = {t for tests in res.values() for t, st in tests.items() if st != "pass"}
        want = {t for suite in mapping[bug].values() for t in suite}
        match = failing == want
        ok &= match
        print(f"{bug} alone ({filename}): fails {len(failing)} tests, "
              f"{'matches mapping' if match else 'MISMATCH ' + str(sorted(failing ^ want))}")
    print("RESULT:", "PASS - each bug is independent" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    if "--snapshot" in sys.argv:
        sys.exit(snapshot())
    sys.exit(isolate() if "--isolate" in sys.argv else verify())
