import tempfile
import unittest
from pathlib import Path

from support import StateTestCase, run, run_json

from obelisk.models import Transaction
from obelisk.transactions import TransactionTable


class Lcg:
    def __init__(self, s):
        self.s = s

    def below(self, n):
        self.s = (1664525 * self.s + 1013904223) % 2**32
        return (self.s >> 8) % n


def table(numbers):
    return TransactionTable(
        [Transaction(f"TX-{n}", "CLEARED", "1", "2025-01-01", "a") for n in numbers])


class PrivateTransactions(unittest.TestCase):
    def test_exhaustive_small_tables(self):
        for size in range(0, 70):
            nums = list(range(10, 10 + 2 * size, 2))
            t = table(nums)
            for n in nums:
                self.assertIsNotNone(t.find(f"TX-{n}"), (size, n))
            for n in range(5, 15 + 2 * size):
                self.assertEqual(t.find(f"TX-{n}") is not None, n in nums, (size, n))

    def test_large_random_tables(self):
        rng = Lcg(99)
        for _ in range(10):
            n = 500 + rng.below(4000)
            nums, cur = [], 10_000
            for _ in range(n):
                cur += 1 + rng.below(7)
                nums.append(cur)
            t = table(nums)
            for x in nums:
                self.assertIsNotNone(t.find(f"TX-{x}"), x)
            present = set(nums)
            for x in range(nums[0] - 3, nums[0] + 60):
                self.assertEqual(t.find(f"TX-{x}") is not None, x in present)

    def test_first_last_single_pair(self):
        for nums in ([7], [7, 9], [7, 9, 11]):
            t = table(nums)
            for x in nums:
                self.assertIsNotNone(t.find(f"TX-{x}"), (nums, x))

    def test_unsorted_input_is_sorted_on_load(self):
        t = table([30, 10, 20, 50, 40])
        for x in (10, 20, 30, 40, 50):
            self.assertIsNotNone(t.find(f"TX-{x}"))

    def test_leading_zeros_and_whitespace(self):
        t = table([42])
        self.assertIsNotNone(t.find(" tx-0042 "))


class PrivateTransactionCli(StateTestCase):
    ingest = False

    def test_custom_csv(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = ["id,status,amount,date,operator"] + [
                f"TX-{n},CLEARED,1.00,2025-01-01,agent01" for n in (500, 100, 300, 200, 400)]
            Path(tmp, "t.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
            run_json("ingest", tmp)
        for n in (100, 200, 300, 400, 500):
            self.assertEqual(run_json("transaction", f"TX-{n}")["id"], f"TX-{n}")
        self.assertEqual(run("transaction", "TX-250")[0], 3)

    def test_corrupt_transaction_row_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "t.csv").write_text(
                "id,status,amount,date,operator\nBAD,CLEARED,1,2025-01-01,a\n", encoding="utf-8")
            result = run_json("ingest", tmp)
        self.assertEqual(len(result["errors"]), 1)


if __name__ == "__main__":
    unittest.main()
