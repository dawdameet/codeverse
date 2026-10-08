import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import support
from support import StateTestCase, run, run_json


def _middle_tx():
    import csv
    with open(support.DATA / "transactions" / "transactions.csv", newline="", encoding="utf-8") as fh:
        ids = [r["id"] for r in csv.DictReader(fh)]
    return ids[len(ids) // 2]


MIDDLE = _middle_tx()


def cli(*args, home):
    env = dict(os.environ, OBELISK_HOME=home, PYTHONPATH=str(support.SRC))
    return subprocess.run([sys.executable, "-m", "obelisk", *args],
                          capture_output=True, text=True, env=env, timeout=120)


class PrivateIntegration(unittest.TestCase):
    def test_end_to_end_workflow_via_subprocess(self):
        with tempfile.TemporaryDirectory() as home:
            self.assertEqual(cli("ingest", str(support.DATA), home=home).returncode, 0)
            p = cli("search", "(vault OR treasury) AND security", "--json", home=home)
            self.assertEqual(p.returncode, 0)
            self.assertIn("results", json.loads(p.stdout))
            self.assertEqual(cli("suggest", "sec", home=home).returncode, 0)
            self.assertEqual(cli("transaction", MIDDLE, home=home).returncode, 0)
            self.assertEqual(cli("history", home=home).returncode, 0)
            self.assertEqual(cli("status", home=home).returncode, 0)
            self.assertEqual(cli("search", "(", home=home).returncode, 4)
            self.assertEqual(cli("inspect", "DOC-9999", home=home).returncode, 3)

    def test_two_independent_states_give_identical_output(self):
        outs = []
        for _ in range(2):
            with tempfile.TemporaryDirectory() as home:
                cli("ingest", str(support.DATA), home=home)
                outs.append([cli(*a, "--json", home=home).stdout for a in (
                    ("search", "security AND NOT vault"), ("suggest", "s"), ("status",),
                    ("logs",), ("transaction", "TX-10010"))])
        self.assertEqual(outs[0], outs[1])

    def test_no_traceback_on_corrupt_state(self):
        with tempfile.TemporaryDirectory() as home:
            cli("ingest", str(support.DATA), home=home)
            Path(home, "index.json").write_text("{not json", encoding="utf-8")
            p = cli("search", "vault", home=home)
            self.assertEqual(p.returncode, 5)
            self.assertNotIn("Traceback", p.stderr)

    def test_no_network_modules_imported(self):
        import obelisk.cli  # noqa: F401
        banned = {"socket", "urllib.request", "http.client", "requests"}
        loaded = {m for m in sys.modules if m.startswith("obelisk")}
        self.assertTrue(loaded)
        src = "".join(p.read_text(encoding="utf-8") for p in Path(support.SRC, "obelisk").glob("*.py"))
        for name in banned:
            self.assertNotIn(f"import {name}", src)


class PrivateDeterminism(StateTestCase):
    def test_search_output_is_stable_across_runs(self):
        a = run("search", "royal mint", "--no-cache", "--no-history")[1]
        b = run("search", "royal mint", "--no-cache", "--no-history")[1]
        self.assertEqual(a, b)

    def test_rebuild_does_not_change_results(self):
        before = run_json("search", "audit OR press", "--limit", "500", "--no-history")
        run("rebuild")
        after = run_json("search", "audit OR press", "--limit", "500", "--no-history")
        self.assertEqual(before["results"], after["results"])


if __name__ == "__main__":
    unittest.main()
