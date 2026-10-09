// Run with:  node --experimental-strip-types --test tests/games.test.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import * as bugs from "../lib/games/bugs.ts";
import * as ledger from "../lib/games/ledger.ts";
import * as logic from "../lib/games/logic.ts";
import * as patrol from "../lib/games/patrol.ts";
import { Rng } from "../lib/games/prng.ts";
import * as safe from "../lib/games/safe.ts";

test("prng is deterministic and seed-sensitive", () => {
  const a = new Rng(7);
  const b = new Rng(7);
  assert.deepEqual([a.int(0, 99), a.int(0, 99), a.int(0, 99)], [b.int(0, 99), b.int(0, 99), b.int(0, 99)]);
  assert.notDeepEqual(new Rng(1).shuffle([1, 2, 3, 4, 5, 6]), new Rng(2).shuffle([1, 2, 3, 4, 5, 6]));
});

// ---------- Crack the Safe ----------
test("safe: vaults are deterministic with distinct digits", () => {
  const v = safe.makeVaults(2025);
  assert.deepEqual(v, safe.makeVaults(2025));
  assert.deepEqual(v.map((x) => x.secret.length), [3, 4, 5]);
  v.forEach((x) => assert.equal(new Set(x.secret).size, x.secret.length));
});
test("safe: feedback", () => {
  assert.deepEqual(safe.feedback("123", "123"), { place: 3, misplaced: 0 });
  assert.deepEqual(safe.feedback("123", "321"), { place: 1, misplaced: 2 });
  assert.deepEqual(safe.feedback("1234", "5678"), { place: 0, misplaced: 0 });
  assert.deepEqual(safe.feedback("1234", "1243"), { place: 2, misplaced: 2 });
});
test("safe: validation and scoring", () => {
  assert.ok(safe.isValidGuess("123", 3));
  assert.ok(!safe.isValidGuess("112", 3));
  assert.ok(!safe.isValidGuess("12", 3));
  assert.ok(!safe.isValidGuess("12a", 3));
  assert.equal(safe.vaultScore(0, false, 8, 8), 0);
  assert.equal(safe.vaultScore(0, true, 8, 8), 100);
  assert.equal(safe.vaultScore(0, true, 3, 8), 100 + 15 * 5);
  assert.equal(safe.vaultScore(2, true, 1, 10), 300 + 45 * 9);
  assert.equal(safe.timeBonus(false, 1000, 1000), 0);
  assert.equal(safe.timeBonus(true, 500, 1000), 50);
  assert.equal(safe.maxScore(), 100 + 15 * 7 + 200 + 30 * 8 + 300 + 45 * 9 + 100);
});

// ---------- Ledger ----------
test("ledger: deterministic, planted anomalies are really anomalous", () => {
  const L = ledger.generateLedger(99);
  assert.deepEqual(L, ledger.generateLedger(99));
  assert.equal(L.rows.length, 120);
  assert.equal(L.anomalies.length, 9);
  const byN = new Map(L.rows.map((r) => [r.n, r]));
  const flagged = new Set(L.anomalies.flatMap((a) => a.rows));
  const valid = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
  };
  // every row NOT in an anomaly is clean
  const ids = new Map<string, number>();
  for (const r of L.rows) ids.set(r.id, (ids.get(r.id) ?? 0) + 1);
  for (const r of L.rows) {
    if (flagged.has(r.n)) continue;
    assert.ok(valid(r.date), `clean row ${r.n} has bad date ${r.date}`);
    assert.equal(ids.get(r.id), 1, `clean row ${r.n} has duplicate id`);
    assert.ok(r.amount > 0 && r.amount < 5000, `clean row ${r.n} amount ${r.amount}`);
    assert.notEqual(r.operator, "agent13");
    assert.ok(!(r.status === "CLEARED" && r.amount === 0));
  }
  // and every anomaly is detectable from the data
  for (const a of L.anomalies) {
    const rows = a.rows.map((n) => byN.get(n)!);
    if (a.label.startsWith("Duplicate")) assert.equal(new Set(rows.map((r) => r.id)).size, 1);
    if (a.label.startsWith("Impossible")) assert.ok(!valid(rows[0].date));
    if (a.label.startsWith("Amount")) assert.ok(rows[0].amount > 5000);
    if (a.label.startsWith("Negative")) assert.ok(rows[0].amount < 0);
    if (a.label.startsWith("Cleared")) assert.ok(rows[0].amount === 0 && rows[0].status === "CLEARED");
    if (a.label.startsWith("Unknown")) assert.ok(rows.length === 6 && rows.every((r) => r.operator === "agent13"));
  }
  assert.equal(new Set(flagged).size, 2 * 2 + 3 + 1 + 1 + 1 + 6);
});
test("ledger: scoring", () => {
  const L = ledger.generateLedger(5);
  const first = L.anomalies[0].rows;
  assert.deepEqual(ledger.scoreAudit(new Set(), L.anomalies), { found: 0, falseFlags: 0, score: 0 });
  assert.equal(ledger.scoreAudit(new Set([first[0]]), L.anomalies).score, 20);
  assert.equal(ledger.scoreAudit(new Set(first), L.anomalies).score, 20); // both duplicate rows: still one
  const clean = L.rows.find((r) => !L.anomalies.some((a) => a.rows.includes(r.n)))!.n;
  assert.deepEqual(ledger.scoreAudit(new Set([first[0], clean]), L.anomalies), { found: 1, falseFlags: 1, score: 10 });
  assert.equal(ledger.scoreAudit(new Set([clean]), L.anomalies).score, 0); // never negative
  const all = new Set(L.anomalies.flatMap((a) => a.rows));
  assert.equal(ledger.scoreAudit(all, L.anomalies).score, 9 * 20);
});

// ---------- Logic Lockpick ----------
test("logic: every level has a solution with exactly `par` gates", () => {
  const G = (op: logic.Op, a: string, b?: string): logic.Gate => ({ op, a, b });
  const solutions: Record<number, [logic.Gate[], string]> = {
    1: [[G("AND", "A", "B")], "G1"],
    2: [[G("NOT", "B"), G("OR", "A", "G1")], "G2"],
    3: [[G("AND", "A", "B"), G("NOT", "G1")], "G2"],
    4: [[G("OR", "A", "B"), G("NOT", "C"), G("AND", "G1", "G2")], "G3"],
    5: [[G("OR", "A", "B"), G("AND", "A", "B"), G("NOT", "G2"), G("AND", "G1", "G3")], "G4"],
    6: [[G("AND", "A", "B"), G("AND", "A", "C"), G("AND", "B", "C"), G("OR", "G1", "G2"), G("OR", "G4", "G3")], "G5"],
  };
  for (const level of logic.LEVELS) {
    const [gates, out] = solutions[level.id];
    assert.equal(gates.length, level.par, `level ${level.id}`);
    assert.ok(logic.passes(logic.truthTable(level, gates, out)), `level ${level.id} solution fails`);
    assert.equal(logic.levelScore(level, gates.length, 0), 150);
  }
});
test("logic: wrong and malformed circuits fail; scoring tiers", () => {
  const lvl = logic.LEVELS[0];
  assert.ok(!logic.passes(logic.truthTable(lvl, [{ op: "OR", a: "A", b: "B" }], "G1")));
  assert.equal(logic.evaluate([{ op: "AND", a: "A", b: "Z" }], "G1", { A: true, B: true }), null);
  assert.equal(logic.evaluate([], "G9", { A: true }), null);
  assert.equal(logic.assignments(["A", "B", "C"]).length, 8);
  assert.equal(logic.levelScore(lvl, 2, 0), 125);
  assert.equal(logic.levelScore(lvl, 3, 0), 100);
  assert.equal(logic.levelScore(lvl, 6, 0), 75);
  assert.equal(logic.levelScore(lvl, 1, 10), 125);
});

// ---------- Guard Patrol ----------
test("patrol: levels are deterministic, solvable and need some care", () => {
  const levels = patrol.makeLevels(1234);
  assert.equal(levels.length, 3);
  assert.deepEqual(levels, patrol.makeLevels(1234));
  for (const L of levels) {
    const direct = Math.abs(L.exit[0] - L.start[0]) + Math.abs(L.exit[1] - L.start[1]);
    assert.ok(L.par >= direct + 2 && L.par <= 40, `par ${L.par}`);
    assert.equal(patrol.solve(L), L.par);
  }
});
test("patrol: rules - guards, swaps, lasers, walls", () => {
  const base: patrol.PatrolLevel = {
    width: 5, height: 1, walls: [[false, false, false, false, false]],
    start: [0, 0], exit: [4, 0], guards: [], lasers: [], par: 4,
  };
  assert.equal(patrol.simulate(base, ["R", "R", "R", "R"]).outcome, "exit");
  assert.equal(patrol.simulate(base, ["R", "R"]).outcome, "unfinished");
  // wall bump wastes the turn
  const walled = { ...base, walls: [[false, true, false, false, false]] };
  const bump = patrol.simulate(walled, ["R"]);
  assert.deepEqual(bump.frames[1].player, [0, 0]);
  // guard standing still on the route
  const guarded = { ...base, guards: [{ path: [[2, 0]] as patrol.Cell[] }] };
  const hit = patrol.simulate(guarded, ["R", "R"]);
  assert.equal(hit.outcome, "caught");
  // swapping places with a guard counts as being caught
  const swap = { ...base, guards: [{ path: [[1, 0], [0, 0]] as patrol.Cell[] }] };
  assert.equal(patrol.simulate(swap, ["R"]).outcome, "caught");
  // laser: on for t%4<2 -> position (2,0) on at turns 0,1,4,5.. ; arriving at t=2 is safe
  const laser = { ...base, lasers: [{ at: [1, 0] as patrol.Cell, period: 4, onFor: 2 }] };
  assert.equal(patrol.simulate(laser, ["R"]).outcome, "caught"); // arrives at t=1 -> on
  assert.equal(patrol.simulate(laser, ["W", "R", "R", "R", "R"]).outcome, "exit"); // arrives at t=2 -> off
  assert.equal(patrol.levelScore(10, 10, 0), 150);
  assert.equal(patrol.levelScore(10, 12, 1), 100 + 30 - 10);
  assert.equal(patrol.levelScore(10, 40, 9), 30);
});

// ---------- Bug Hunt ----------
test("bugs: the answer key matches real Python output", () => {
  const session = bugs.makeSession(1);
  assert.equal(session.length, 8);
  for (const s of session) {
    assert.ok(s.options.includes(s.answer));
    assert.equal(new Set(s.options).size, 4);
    assert.ok(s.bugLine >= 1 && s.bugLine <= s.code.length && s.code[s.bugLine - 1].trim() !== "");
    let out: string;
    try {
      out = execFileSync("python3", ["-c", s.code.join("\n")], { encoding: "utf8" }).trim().split("\n").pop()!;
    } catch (e) {
      assert.fail(`snippet ${s.id} does not run: ${e}`);
    }
    assert.equal(out, s.answer, `snippet ${s.id}`);
  }
});
test("bugs: grading", () => {
  const session = bugs.makeSession(3);
  const perfect = Object.fromEntries(session.map((s) => [s.id, { choice: s.answer, line: s.bugLine }]));
  assert.equal(bugs.grade(session, perfect).score, bugs.maxScore());
  assert.equal(bugs.maxScore(), 300);
  assert.equal(bugs.grade(session, {}).score, 0);
  const half = bugs.grade(session, { 7: { choice: session[6].answer, line: null } });
  assert.equal(half.score, 30);
  assert.deepEqual(
    [bugs.makeSession(3).map((s) => s.options), bugs.makeSession(3).map((s) => s.options)].map((x) => x.length),
    [8, 8],
  );
});

// ---------- the backend pins each game's maximum score (it must not trust the browser) ----------
test("backend MAX_SCORE table matches the games' real maximums", async () => {
  const { readFileSync } = await import("node:fs");
  const { GAMES } = await import("../lib/games/registry.ts");
  const py = readFileSync(new URL("../../backend/codeverse_server/games.py", import.meta.url), "utf8");
  const m = py.match(/MAX_SCORE = \{([^}]*)\}/);
  assert.ok(m, "MAX_SCORE not found in games.py");
  const table = Object.fromEntries([...m![1].matchAll(/"(\w+)":\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]));
  assert.deepEqual(table, Object.fromEntries(GAMES.map((g) => [g.id, g.max])));
});
