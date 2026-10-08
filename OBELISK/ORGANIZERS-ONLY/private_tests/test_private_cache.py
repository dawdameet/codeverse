import unittest
from collections import OrderedDict

from support import StateTestCase, run_json

from obelisk.cache import LRUCache


class Lcg:
    def __init__(self, s):
        self.s = s

    def below(self, n):
        self.s = (1664525 * self.s + 1013904223) % 2**32
        return (self.s >> 8) % n


class PrivateCache(unittest.TestCase):
    def test_random_workloads_match_ordered_dict_model(self):
        for seed in range(30):
            rng = Lcg(seed)
            cap = 1 + rng.below(8)
            real, model = LRUCache(cap), OrderedDict()
            for step in range(400):
                key = f"k{rng.below(cap * 2 + 1)}"
                if rng.below(3) == 0:
                    real.put(key, step)
                    model[key] = step
                    model.move_to_end(key)
                    if len(model) > cap:
                        model.popitem(last=False)
                else:
                    got = real.get(key)
                    want = model.get(key)
                    if key in model:
                        model.move_to_end(key)
                    self.assertEqual(got, want, (seed, step))
                self.assertEqual(real.keys(), list(reversed(model)), (seed, step))

    def test_capacity_one(self):
        c = LRUCache(1)
        c.put("a", 1)
        c.get("a")
        c.put("b", 2)
        self.assertIsNone(c.get("a"))
        self.assertEqual(c.get("b"), 2)

    def test_stats_consistency(self):
        c = LRUCache(2)
        ops = [("p", "a"), ("p", "b"), ("g", "a"), ("g", "z"), ("p", "c"), ("g", "b"), ("g", "a")]
        for op, k in ops:
            c.put(k, k) if op == "p" else c.get(k)
        self.assertEqual((c.hits, c.misses, c.evictions), (2, 2, 1))

    def test_persistence_preserves_recency_order(self):
        c = LRUCache(4)
        for k in "abcd":
            c.put(k, k)
        c.get("b")
        c.get("a")
        again = LRUCache.from_dict(c.to_dict(), 4)
        again.put("e", "e")
        self.assertEqual(sorted(again.keys()), ["a", "b", "d", "e"][:0] or sorted(["a", "b", "d", "e"]))
        self.assertNotIn("c", again.keys())


class PrivateCacheCli(StateTestCase):
    cache_size = 2

    def test_scripted_scenario(self):
        s = lambda q: run_json("search", q, "--no-history")["cache"]
        self.assertEqual([s("vault"), s("audit"), s("vault"), s("press")],
                         ["miss", "miss", "hit", "miss"])
        # audit was least recently used and must be gone; vault must survive
        self.assertEqual(s("vault"), "hit")
        self.assertEqual(s("audit"), "miss")

    def test_capacity_from_environment(self):
        self.assertEqual(run_json("cache")["capacity"], 2)


if __name__ == "__main__":
    unittest.main()
