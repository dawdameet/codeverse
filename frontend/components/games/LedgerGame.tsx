"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import * as ledger from "@/lib/games/ledger";
import type { LedgerRow } from "@/lib/games/ledger";
import type { PlayApi } from "./GameFrame";

type SortKey = keyof Pick<LedgerRow, "n" | "id" | "date" | "time" | "operator" | "amount" | "status">;

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "n", label: "#" },
  { key: "id", label: "Transaction" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "operator", label: "Operator" },
  { key: "amount", label: "Amount", right: true },
  { key: "status", label: "Status" },
];

export function LedgerGame({ api }: { api: PlayApi }) {
  const data = useMemo(() => ledger.generateLedger(api.seed), [api.seed]);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "n", dir: 1 });
  const [text, setText] = useState("");
  const [status, setStatus] = useState("ALL");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = data.rows.filter(
      (r) =>
        (status === "ALL" || r.status === status) &&
        (!onlyFlagged || flagged.has(r.n)) &&
        (!q || [r.id, r.date, r.time, r.operator, r.status, r.amount.toFixed(2)].some((v) => v.toLowerCase().includes(q))),
    );
    return list.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [data, text, status, onlyFlagged, flagged, sort]);

  const finishNow = () => {
    const s = ledger.scoreAudit(flagged, data.anomalies);
    const total = s.score + ledger.timeBonus(s.found, api.remainingMs, api.limitMs);
    api.finish(total, `${s.found} of ${data.anomalies.length} problems found, ${s.falseFlags} clean rows flagged by mistake.`);
  };
  const onTimeUp = useEffectEvent(() => finishNow());
  useEffect(() => {
    if (api.timeUp) onTimeUp();
  }, [api.timeUp]);

  const toggle = (n: number) =>
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const header = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <input className="input !w-56" placeholder="Filter rows..." value={text} onChange={(e) => setText(e.target.value)} />
        <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["ALL", "CLEARED", "PENDING", "REJECTED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-paper-dim">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
          Only flagged
        </label>
        <span className="ml-auto text-sm text-paper-dim">
          {flagged.size} flagged · <b className="text-white">{data.anomalies.length}</b> problems hidden in {data.rows.length} rows
        </span>
        <button className="btn" onClick={finishNow}>
          Submit audit
        </button>
      </div>

      <div className="panel max-h-[62vh] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2 shadow-[0_1px_0_var(--color-line)]">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`label cursor-pointer select-none px-3 py-2.5 font-normal ${c.right ? "text-right" : ""}`} onClick={() => header(c.key)}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="label px-3 py-2.5 text-right font-normal">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = flagged.has(r.n);
              return (
                <tr
                  key={r.n}
                  onClick={() => toggle(r.n)}
                  className={`cursor-pointer border-t border-line/60 ${on ? "bg-red/20" : "hover:bg-white/[0.04]"}`}
                >
                  <td className="px-3 py-1.5 text-paper-dim">{r.n}</td>
                  <td className="px-3 py-1.5 font-mono">{r.id}</td>
                  <td className="px-3 py-1.5 font-mono">{r.date}</td>
                  <td className="px-3 py-1.5 font-mono">{r.time}</td>
                  <td className="px-3 py-1.5">{r.operator}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.amount.toFixed(2)}</td>
                  <td className="px-3 py-1.5">{r.status}</td>
                  <td className="px-3 py-1.5 text-right">{on ? <span className="text-red-vibrant">⚑</span> : <span className="text-paper-dim/40">⚐</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-paper-dim">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-paper-dim">+20 for each problem found · -10 for each clean row flagged · click a column title to sort.</p>
    </div>
  );
}
