"use client";

import { useEffect, useEffectEvent, useState } from "react";
import * as logic from "@/lib/games/logic";
import type { Gate, Op } from "@/lib/games/logic";
import type { PlayApi } from "./GameFrame";

const bit = (b: boolean | null) => (b === null ? "?" : b ? "1" : "0");

export function LogicGame({ api }: { api: PlayApi }) {
  const levels = logic.LEVELS;
  const [li, setLi] = useState(0);
  const [circuits, setCircuits] = useState<Gate[][]>(() => levels.map(() => []));
  const [outputs, setOutputs] = useState<string[]>(() => levels.map(() => ""));
  const [wrong, setWrong] = useState<number[]>(() => levels.map(() => 0));
  const [scores, setScores] = useState<(number | null)[]>(() => levels.map(() => null));
  const [message, setMessage] = useState("");

  const level = levels[li];
  const gates = circuits[li];
  const output = outputs[li] || (gates.length ? logic.gateName(gates.length - 1) : "");
  const table = logic.truthTable(level, gates, output);
  const solved = scores[li] !== null;

  const update = (next: Gate[]) => setCircuits(circuits.map((c, i) => (i === li ? next : c)));
  const signalsBefore = (i: number) => [...level.inputs, ...gates.slice(0, i).map((_, k) => logic.gateName(k))];

  const addGate = (op: Op) => {
    if (gates.length >= logic.MAX_GATES || solved) return;
    const first = level.inputs[0];
    const second = level.inputs[1] ?? first;
    update([...gates, op === "NOT" ? { op, a: first } : { op, a: first, b: second }]);
    setOutputs(outputs.map((o, i) => (i === li ? "" : o))); // output follows the newest gate
  };
  const edit = (i: number, patch: Partial<Gate>) => update(gates.map((g, k) => (k === i ? { ...g, ...patch } : g)));

  const test = () => {
    if (solved) return;
    if (logic.passes(table)) {
      setScores(scores.map((s, i) => (i === li ? logic.levelScore(level, gates.length, wrong[li]) : s)));
      setMessage("Click! The lock opens.");
    } else {
      setWrong(wrong.map((w, i) => (i === li ? w + 1 : w)));
      const bad = table.filter((r) => r.actual !== r.expected).length;
      setMessage(`The lock stays shut: ${bad} of ${table.length} settings are wrong.`);
    }
  };

  const finishNow = () => {
    const done = scores.filter((s) => s !== null).length;
    const total = scores.reduce<number>((n, s) => n + (s ?? 0), 0);
    api.finish(total, `${done} of ${levels.length} locks opened.`);
  };
  const onTimeUp = useEffectEvent(() => finishNow());
  useEffect(() => {
    if (api.timeUp) onTimeUp();
  }, [api.timeUp]);

  const lastLevel = li === levels.length - 1;
  const signals = [...level.inputs, ...gates.map((_, k) => logic.gateName(k))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {levels.map((l, i) => (
          <button
            key={l.id}
            onClick={() => {
              setLi(i);
              setMessage("");
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              i === li ? "border-red bg-red/20 text-white" : "border-line-strong text-paper-dim hover:text-white"
            }`}
          >
            Lock {l.id} {scores[i] !== null && <span className="text-ok">✓</span>}
          </button>
        ))}
        <button className="btn btn-ghost ml-auto !py-1.5" onClick={finishNow}>
          Finish &amp; submit
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="panel p-5">
          <h2 className="display text-xl text-white">
            Lock {level.id}: {level.title}
          </h2>
          <p className="mt-1 text-sm text-paper-dim">{level.hint}</p>

          <div className="mt-4 space-y-2">
            {gates.length === 0 && <p className="text-sm text-paper-dim">No gates yet. Add one below.</p>}
            {gates.map((g, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-ink px-3 py-2">
                <span className="w-9 font-mono font-semibold text-red-vibrant">{logic.gateName(i)}</span>
                <span className="text-paper-dim">=</span>
                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-sm">{g.op}</span>
                <select className="input !w-24 !py-1" disabled={solved} value={g.a} onChange={(e) => edit(i, { a: e.target.value })}>
                  {signalsBefore(i).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {g.op !== "NOT" && (
                  <>
                    <span className="text-paper-dim">{g.op === "AND" ? "and" : "or"}</span>
                    <select className="input !w-24 !py-1" disabled={solved} value={g.b} onChange={(e) => edit(i, { b: e.target.value })}>
                      {signalsBefore(i).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ))}
          </div>

          {!solved && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(["AND", "OR", "NOT"] as Op[]).map((op) => (
                <button key={op} className="btn btn-ghost !py-1.5" disabled={gates.length >= logic.MAX_GATES} onClick={() => addGate(op)}>
                  + {op}
                </button>
              ))}
              <button className="btn btn-ghost !py-1.5" disabled={!gates.length} onClick={() => {
                  update(gates.slice(0, -1));
                  setOutputs(outputs.map((o, i) => (i === li ? "" : o)));
                }}>
                Remove last
              </button>
              <span className="text-xs text-paper-dim">
                {gates.length}/{logic.MAX_GATES} gates
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-sm">
              Output:
              <select
                className="input !w-24 !py-1"
                disabled={solved}
                value={output}
                onChange={(e) => setOutputs(outputs.map((o, i) => (i === li ? e.target.value : o)))}
              >
                {!gates.length && <option value="">-</option>}
                {signals.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {!solved ? (
              <button className="btn" onClick={test} disabled={!gates.length}>
                Test lock
              </button>
            ) : lastLevel ? (
              <button className="btn" onClick={finishNow}>
                See results
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  setLi(li + 1);
                  setMessage("");
                }}
              >
                Next lock
              </button>
            )}
          </div>
          {message && <p className={`mt-3 text-sm ${solved ? "text-ok" : "text-red-vibrant"}`}>{message}</p>}
          {solved && (
            <p className="mt-1 text-sm text-paper-dim">
              Used {gates.length} gate{gates.length === 1 ? "" : "s"} · {scores[li]} points
            </p>
          )}
        </section>

        <section className="panel p-5">
          <h3 className="label mb-3">Truth table</h3>
          <table className="w-full text-center font-mono text-sm">
            <thead>
              <tr className="text-paper-dim">
                {level.inputs.map((n) => (
                  <th key={n} className="pb-2 font-normal">
                    {n}
                  </th>
                ))}
                <th className="pb-2 font-normal">Opens?</th>
                <th className="pb-2 font-normal">Yours</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  {level.inputs.map((n) => (
                    <td key={n} className="py-1">
                      {bit(r.input[n])}
                    </td>
                  ))}
                  <td className="py-1 text-white">{bit(r.expected)}</td>
                  <td className={`py-1 ${r.actual === r.expected ? "text-ok" : "text-red-vibrant"}`}>{bit(r.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-paper-dim">1 = on, 0 = off. Match the &quot;Opens?&quot; column in every row.</p>
        </section>
      </div>
    </div>
  );
}
