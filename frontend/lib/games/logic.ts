/** Game 4 - Logic Lockpick: build a circuit whose output matches the lock's truth table. */

export type Op = "AND" | "OR" | "NOT";

export interface Gate {
  op: Op;
  a: string; // signal id: an input name ("A") or an earlier gate ("G1")
  b?: string; // second input (not used by NOT)
}

export interface LogicLevel {
  id: number;
  title: string;
  hint: string;
  inputs: string[];
  target: (v: Record<string, boolean>) => boolean;
  par: number; // fewest gates needed
}

export const MAX_GATES = 8;

export const LEVELS: LogicLevel[] = [
  { id: 1, title: "Twin keys", hint: "Both keys must be turned.", inputs: ["A", "B"], par: 1, target: (v) => v.A && v.B },
  { id: 2, title: "Open door or closed gate", hint: "The lock opens if A is on, or B is off.", inputs: ["A", "B"], par: 2, target: (v) => v.A || !v.B },
  { id: 3, title: "Anything but both", hint: "It stays shut only when both are on.", inputs: ["A", "B"], par: 2, target: (v) => !(v.A && v.B) },
  { id: 4, title: "Guard on duty", hint: "A or B, but never while C is on.", inputs: ["A", "B", "C"], par: 3, target: (v) => (v.A || v.B) && !v.C },
  { id: 5, title: "Odd one out", hint: "Exactly one of A and B.", inputs: ["A", "B"], par: 4, target: (v) => v.A !== v.B },
  { id: 6, title: "Majority rules", hint: "At least two of the three.", inputs: ["A", "B", "C"], par: 5, target: (v) => [v.A, v.B, v.C].filter(Boolean).length >= 2 },
];

export function assignments(inputs: string[]): Record<string, boolean>[] {
  const rows: Record<string, boolean>[] = [];
  for (let m = 0; m < 1 << inputs.length; m++) {
    const row: Record<string, boolean> = {};
    inputs.forEach((name, i) => (row[name] = Boolean(m & (1 << (inputs.length - 1 - i)))));
    rows.push(row);
  }
  return rows;
}

export function gateName(index: number): string {
  return `G${index + 1}`;
}

/** Evaluate a circuit for one input assignment. Returns null if it is malformed. */
export function evaluate(gates: Gate[], output: string, input: Record<string, boolean>): boolean | null {
  const signals: Record<string, boolean> = { ...input };
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const a = signals[g.a];
    if (a === undefined) return null;
    let value: boolean;
    if (g.op === "NOT") value = !a;
    else {
      const b = g.b === undefined ? undefined : signals[g.b];
      if (b === undefined) return null;
      value = g.op === "AND" ? a && b : a || b;
    }
    signals[gateName(i)] = value;
  }
  const out = signals[output];
  return out === undefined ? null : out;
}

export interface TruthRow {
  input: Record<string, boolean>;
  expected: boolean;
  actual: boolean | null;
}

export function truthTable(level: LogicLevel, gates: Gate[], output: string): TruthRow[] {
  return assignments(level.inputs).map((input) => ({
    input,
    expected: level.target(input),
    actual: evaluate(gates, output, input),
  }));
}

export function passes(rows: TruthRow[]): boolean {
  return rows.every((r) => r.actual === r.expected);
}

export const PER_WRONG_TEST = 5;

/** 150 at par, 125 at par+1, 100 at par+2, 75 beyond; minus 5 per wrong test (max 25). */
export function levelScore(level: LogicLevel, gatesUsed: number, wrongTests: number): number {
  const over = Math.max(0, gatesUsed - level.par);
  const base = [150, 125, 100][over] ?? 75;
  return base - Math.min(25, wrongTests * PER_WRONG_TEST);
}

export function maxScore(): number {
  return LEVELS.length * 150;
}
