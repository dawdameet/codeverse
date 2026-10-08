import { Rng } from "./prng.ts";

/** Game 2 - The Ledger Audit: find the doctored entries in a transaction table. */

export interface LedgerRow {
  n: number; // stable row number (1-based) shown to the player
  id: string;
  date: string;
  time: string;
  operator: string;
  amount: number;
  status: "CLEARED" | "PENDING" | "REJECTED";
}

export interface Anomaly {
  label: string;
  rows: number[]; // row numbers; flagging any one of them finds the anomaly
}

export interface Ledger {
  rows: LedgerRow[];
  anomalies: Anomaly[];
}

const OPERATORS = ["agent01", "agent02", "agent03", "agent04", "agent05", "agent06", "agent07"];
const STATUSES: LedgerRow["status"][] = ["CLEARED", "CLEARED", "CLEARED", "PENDING", "REJECTED"];
const pad = (n: number) => String(n).padStart(2, "0");

export function generateLedger(seed: number, size = 120): Ledger {
  const rng = new Rng(seed);
  const rows: LedgerRow[] = [];
  let tx = 10200;
  for (let i = 0; i < size; i++) {
    tx += rng.int(1, 5);
    rows.push({
      n: i + 1,
      id: `TX-${tx}`,
      date: `2025-${pad(rng.int(3, 5))}-${pad(rng.int(1, 28))}`,
      time: `${pad(rng.int(8, 21))}:${pad(rng.int(0, 59))}`,
      operator: rng.pick(OPERATORS),
      amount: Math.round((rng.float() * rng.float() * 4700 + 40) * 100) / 100,
      status: rng.pick(STATUSES),
    });
  }

  // choose distinct rows to tamper with
  const slots = rng.shuffle(Array.from({ length: size }, (_, i) => i));
  let cursor = 0;
  const take = () => slots[cursor++];
  const anomalies: Anomaly[] = [];

  for (let d = 0; d < 2; d++) {
    const a = take();
    const b = take();
    const [first, second] = a < b ? [a, b] : [b, a];
    rows[second].id = rows[first].id;
    anomalies.push({ label: "Duplicate transaction ID", rows: [rows[first].n, rows[second].n] });
  }
  for (const bad of ["2025-02-30", "2025-13-04", "2025-04-31"]) {
    const i = take();
    rows[i].date = bad;
    anomalies.push({ label: "Impossible date", rows: [rows[i].n] });
  }
  {
    const i = take();
    rows[i].amount = 98765.43;
    anomalies.push({ label: "Amount wildly out of range", rows: [rows[i].n] });
  }
  {
    const i = take();
    rows[i].amount = -250;
    anomalies.push({ label: "Negative amount", rows: [rows[i].n] });
  }
  {
    const i = take();
    rows[i].amount = 0;
    rows[i].status = "CLEARED";
    anomalies.push({ label: "Cleared with a zero amount", rows: [rows[i].n] });
  }
  {
    const burst: number[] = [];
    for (let k = 0; k < 6; k++) {
      const i = take();
      rows[i].operator = "agent13";
      rows[i].date = "2025-04-09";
      rows[i].time = "03:12";
      burst.push(rows[i].n);
    }
    anomalies.push({ label: "Unknown operator acting in a burst", rows: burst });
  }
  return { rows, anomalies };
}

export interface AuditScore {
  found: number;
  falseFlags: number;
  score: number;
}

export const POINTS_FOUND = 20;
export const PENALTY_FALSE = 10;
export const TIME_BONUS_MAX = 60;

/** Anomaly-level scoring: any flagged row of an anomaly finds it; other rows of it are not penalised. */
export function scoreAudit(flagged: ReadonlySet<number>, anomalies: Anomaly[]): AuditScore {
  const inAnomaly = new Set(anomalies.flatMap((a) => a.rows));
  const found = anomalies.filter((a) => a.rows.some((r) => flagged.has(r))).length;
  const falseFlags = [...flagged].filter((r) => !inAnomaly.has(r)).length;
  return { found, falseFlags, score: Math.max(0, found * POINTS_FOUND - falseFlags * PENALTY_FALSE) };
}

export function maxScore(anomalyCount: number): number {
  return anomalyCount * POINTS_FOUND + TIME_BONUS_MAX;
}

export function timeBonus(found: number, remainingMs: number, limitMs: number): number {
  if (found === 0) return 0;
  return Math.round(TIME_BONUS_MAX * Math.max(0, Math.min(1, remainingMs / limitMs)));
}
