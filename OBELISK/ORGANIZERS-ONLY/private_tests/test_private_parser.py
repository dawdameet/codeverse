import unittest

from support import StateTestCase, run_json

from obelisk.query_parser import evaluate, parse

TERMS = ["a", "b", "c", "d", "e"]
POSTINGS = {
    "a": {f"D{i}": 1 for i in (1, 2, 3, 4, 5, 6)},
    "b": {f"D{i}": 1 for i in (2, 3, 7, 8)},
    "c": {f"D{i}": 1 for i in (3, 4, 8, 9)},
    "d": {f"D{i}": 1 for i in (1, 5, 9, 10)},
    "e": {f"D{i}": 1 for i in (6, 10, 11)},
}
UNIVERSE = {f"D{i}" for i in range(1, 13)}


class Lcg:
    def __init__(self, s):
        self.s = s

    def below(self, n):
        self.s = (1664525 * self.s + 1013904223) % 2**32
        return (self.s >> 8) % n


# --- independent oracle: precedence-climbing, written without the stack machine ---

def oracle(text):
    toks = text.replace("(", " ( ").replace(")", " ) ").split()
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take():
        t = toks[pos[0]]
        pos[0] += 1
        return t

    def operand():
        t = take()
        if t == "NOT":
            return UNIVERSE - operand()
        if t == "(":
            v = expr(0)
            assert take() == ")"
            return v
        return set(POSTINGS.get(t, ()))

    def expr(min_prec):
        left = operand()
        while True:
            t = peek()
            if t in ("AND", "OR"):
                prec = 2 if t == "AND" else 1
                implicit = False
            elif t is not None and t != ")":
                t, prec, implicit = "AND", 2, True  # implicit AND
            else:
                return left
            if prec < min_prec:
                return left
            if not implicit:
                take()
            right = expr(prec + 1)
            left = left & right if t == "AND" else left | right

    return expr(0)


def gen(rng, depth):
    if depth == 0 or rng.below(4) == 0:
        return TERMS[rng.below(len(TERMS))]
    kind = rng.below(6)
    if kind == 0:
        return f"NOT {gen(rng, depth - 1)}"
    if kind == 1:
        return f"( {gen(rng, depth - 1)} )"
    if kind == 2:
        return f"{gen(rng, depth - 1)} {gen(rng, depth - 1)}"
    op = "AND" if kind in (3, 4) else "OR"
    return f"{gen(rng, depth - 1)} {op} {gen(rng, depth - 1)}"


class PrivateParser(unittest.TestCase):
    def test_random_expressions_match_oracle(self):
        rng = Lcg(2024)
        for n in range(1500):
            text = gen(rng, 4)
            got = evaluate(parse(text), POSTINGS, UNIVERSE)
            self.assertEqual(got, oracle(text), text)

    def test_hand_picked_precedence_cases(self):
        cases = [
            "NOT a AND b", "NOT a OR b AND c", "a OR NOT b AND c", "NOT NOT a AND b",
            "NOT ( a OR b ) AND c", "( a OR b ) AND NOT ( c AND d )", "a b OR c d",
            "NOT a b", "a AND ( b OR c ) AND d", "NOT ( NOT a OR NOT b ) AND c",
            "a OR b AND NOT c OR d",
        ]
        for text in cases:
            self.assertEqual(evaluate(parse(text), POSTINGS, UNIVERSE), oracle(text), text)

    def test_deep_nesting_does_not_break(self):
        text = "(" * 40 + "a" + " OR b)" * 40
        self.assertEqual(evaluate(parse(text), POSTINGS, UNIVERSE),
                         set(POSTINGS["a"]) | set(POSTINGS["b"]))


class PrivateParserCli(StateTestCase):
    def test_operator_spelling_variants_hit_same_cache_entry(self):
        run_json("search", "vault AND (audit OR press)")
        self.assertEqual(run_json("search", "vault   AND(audit OR press)")["cache"], "hit")

    def test_not_only_query(self):
        self.assertEqual(run_json("search", "NOT NOT vault", "--limit", "500")["total"],
                         run_json("search", "vault", "--limit", "500")["total"])


if __name__ == "__main__":
    unittest.main()
