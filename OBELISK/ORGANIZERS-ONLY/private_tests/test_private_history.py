import unittest

from support import StateTestCase, run_json

from obelisk.history import QueryHistory


class Lcg:
    def __init__(self, s):
        self.s = s

    def below(self, n):
        self.s = (1664525 * self.s + 1013904223) % 2**32
        return (self.s >> 8) % n


class Model:
    """Independent reference model: list + cursor."""

    def __init__(self):
        self.items, self.cur = [], -1

    def push(self, q):
        self.items = self.items[: self.cur + 1] + [q]
        self.cur = len(self.items) - 1

    def undo(self):
        if self.cur < 0:
            return False, None
        self.cur -= 1
        return True, self.items[self.cur] if self.cur >= 0 else None

    def redo(self):
        if self.cur + 1 >= len(self.items):
            return False, self.items[self.cur] if self.cur >= 0 else None
        self.cur += 1
        return True, self.items[self.cur]


class PrivateHistory(unittest.TestCase):
    def test_random_operation_sequences_match_model(self):
        for seed in range(25):
            rng, real, model = Lcg(seed), QueryHistory(), Model()
            for step in range(120):
                op = rng.below(5)
                if op <= 1:
                    q = f"q{rng.below(1000)}"
                    real.push(q); model.push(q)
                elif op in (2, 3):
                    self.assertEqual(real.undo(), model.undo(), (seed, step))
                else:
                    self.assertEqual(real.redo(), model.redo(), (seed, step))
                self.assertEqual(real.current, model.items[model.cur] if model.cur >= 0 else None)

    def test_persistence_between_operations(self):
        rng, real, model = Lcg(5), QueryHistory(), Model()
        for step in range(150):
            real = QueryHistory.from_dict(real.to_dict())  # reload each time
            op = rng.below(4)
            if op == 0:
                q = f"x{step}"
                real.push(q); model.push(q)
            elif op in (1, 2):
                self.assertEqual(real.undo(), model.undo())
            else:
                self.assertEqual(real.redo(), model.redo())

    def test_capacity_cap_keeps_newest(self):
        h = QueryHistory()
        for i in range(80):
            h.push(f"q{i}")
        self.assertEqual(len(h.states), 50)
        self.assertEqual(h.current, "q79")
        self.assertEqual(h.states[0], "q30")

    def test_deep_undo_then_diverge_twice(self):
        h = QueryHistory()
        for q in "abcdef":
            h.push(q)
        for _ in range(4):
            h.undo()
        h.push("X")
        h.push("Y")
        self.assertEqual(h.states, ["a", "b", "X", "Y"])
        self.assertEqual([h.undo()[1] for _ in range(3)], ["X", "b", "a"])


class PrivateHistoryCli(StateTestCase):
    def test_cli_sequence(self):
        for q in ("alpha", "beta", "gamma", "delta"):
            run_json("search", q)
        self.assertEqual(run_json("history", "undo")["query"], "gamma")
        self.assertEqual(run_json("history", "undo")["query"], "beta")
        run_json("search", "epsilon")
        self.assertEqual(run_json("history")["states"], ["alpha", "beta", "epsilon"])
        self.assertEqual(run_json("history", "undo")["query"], "beta")
        self.assertEqual(run_json("history", "undo")["query"], "alpha")
        self.assertEqual(run_json("history", "redo")["query"], "beta")
        self.assertEqual(run_json("history", "redo")["query"], "epsilon")
        self.assertFalse(run_json("history", "redo")["changed"])


if __name__ == "__main__":
    unittest.main()
