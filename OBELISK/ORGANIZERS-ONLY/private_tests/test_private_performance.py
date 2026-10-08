"""ELITE challenge (OB-006): fixed workload, checksum + time threshold.

Parameters are duplicated in PERFORMANCE.md. Reference time is ~0.01s; the
threshold leaves a wide margin for slow machines while still failing any
implementation that scans the whole vocabulary per query.
"""

import unittest

from obelisk import bench
from obelisk.autocomplete import Autocomplete

VOCAB, QUERIES, SEED = 100_000, 500, 1337
EXPECTED_CHECKSUM = "e87ef41f9c466ca6760e843d9d4299d9b952911713a9b4a9abc12ad3c594650b"
THRESHOLD_SECONDS = 0.5


class PrivatePerformance(unittest.TestCase):
    def test_official_workload_checksum(self):
        result = bench.run_autocomplete(VOCAB, QUERIES, SEED)
        self.assertEqual(result["checksum"], EXPECTED_CHECKSUM)

    def test_official_workload_threshold(self):
        best = min(bench.run_autocomplete(VOCAB, QUERIES, SEED)["query_seconds"] for _ in range(3))
        self.assertLess(best, THRESHOLD_SECONDS, f"best of 3 = {best}s")

    def test_results_match_brute_force(self):
        vocab = bench.make_vocabulary(5000, 3)
        engine = Autocomplete(vocab)
        for prefix in bench.make_queries(vocab, 80, 3) + ["b", "ka", "zzzz"]:
            want = sorted((t for t in vocab if t[0].startswith(prefix)),
                          key=lambda e: (-e[1], e[0]))[:7]
            self.assertEqual(engine.suggest(prefix, 7), want, prefix)


if __name__ == "__main__":
    unittest.main()
