import tempfile
import unittest
from pathlib import Path

from support import StateTestCase, run_json

from obelisk.indexer import SEGMENT_SIZE, build_index
from obelisk.models import Document


def docs(n):
    return [Document(f"DOC-{i:05d}", f"T{i}", "t", "x", {}, f"shared uniq{i:05d}")
            for i in range(1, n + 1)]


class PrivateIndex(unittest.TestCase):
    def test_every_size_around_segment_boundaries(self):
        sizes = {0, 1, 2, 3}
        for m in range(1, 6):
            sizes |= {m * SEGMENT_SIZE - 1, m * SEGMENT_SIZE, m * SEGMENT_SIZE + 1}
        for n in sorted(sizes):
            index = build_index(docs(n))
            self.assertEqual(len(index.doc_ids), n, n)
            self.assertEqual(len(index.postings.get("shared", {})), n, n)

    def test_first_and_last_of_every_segment_are_present(self):
        n = SEGMENT_SIZE * 4 + 5
        index = build_index(docs(n))
        for seg in range(5):
            for pos in (seg * SEGMENT_SIZE, min((seg + 1) * SEGMENT_SIZE, n) - 1):
                self.assertIn(f"uniq{pos + 1:05d}", index.postings, pos)

    def test_unsorted_input_is_still_complete_and_ordered(self):
        shuffled = list(reversed(docs(100)))
        index = build_index(shuffled)
        self.assertEqual(index.doc_ids, sorted(index.doc_ids))
        self.assertEqual(len(index.doc_ids), 100)


class PrivateIndexIntegration(StateTestCase):
    ingest = False

    def test_large_ingest_is_fully_indexed(self):
        with tempfile.TemporaryDirectory() as tmp:
            for i in range(1, 1001):
                Path(tmp, f"d{i}.txt").write_text(
                    f"ID: DOC-{i:05d}\nTitle: D{i}\nType: t\n---\nbulk token{i:05d}\n",
                    encoding="utf-8")
            result = run_json("ingest", tmp)
        self.assertEqual(result["documents"], 1000)
        self.assertEqual(result["indexed"], 1000)
        for i in (1, 32, 33, 64, 500, 992, 1000):
            found = run_json("search", f"token{i:05d}", "--no-cache", "--no-history")
            self.assertEqual(found["total"], 1, i)

    def test_not_universe_covers_every_document(self):
        run_json("ingest")
        everything = run_json("search", "NOT zzzzqqqq", "--limit", "500", "--no-cache")
        self.assertEqual(everything["total"], 120)


if __name__ == "__main__":
    unittest.main()
