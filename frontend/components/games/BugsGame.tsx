"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import * as bugs from "@/lib/games/bugs";
import type { Answer } from "@/lib/games/bugs";
import type { PlayApi } from "./GameFrame";

export function BugsGame({ api }: { api: PlayApi }) {
  const session = useMemo(() => bugs.makeSession(api.seed), [api.seed]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  const s = session[index];
  const a = answers[s.id] ?? { choice: null, line: null };
  const set = (patch: Partial<Answer>) => setAnswers({ ...answers, [s.id]: { ...a, ...patch } });

  const finishNow = () => {
    const g = bugs.grade(session, answers);
    api.finish(g.score, `${g.correctOutputs} of ${session.length} outputs and ${g.correctLines} of ${session.length} bug lines correct.`);
  };
  const onTimeUp = useEffectEvent(() => finishNow());
  useEffect(() => {
    if (api.timeUp) onTimeUp();
  }, [api.timeUp]);

  const answered = (id: number) => answers[id]?.choice != null && answers[id]?.line != null;
  const unanswered = session.filter((x) => !answered(x.id)).length;
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {session.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setIndex(i)}
            className={`h-9 w-9 rounded-lg border text-sm font-semibold ${
              i === index ? "border-red bg-red/20 text-white" : answered(x.id) ? "border-ok/50 text-ok" : "border-line-strong text-paper-dim"
            }`}
            aria-label={`Snippet ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-2 text-sm text-paper-dim">{unanswered} unanswered</span>
        {!confirm ? (
          <button className="btn ml-auto !py-1.5" onClick={() => (unanswered ? setConfirm(true) : finishNow())}>
            Submit all
          </button>
        ) : (
          <span className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-amber">{unanswered} snippets are incomplete. Submit anyway?</span>
            <button className="btn !py-1.5" onClick={finishNow}>
              Yes, submit
            </button>
            <button className="text-paper-dim hover:text-white" onClick={() => setConfirm(false)}>
              Keep going
            </button>
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-mono text-sm text-paper-dim">snippet_{s.id}.py</span>
            <span className="label">worth {s.weight * bugs.POINTS_PER_WEIGHT * 2} points</span>
          </div>
          <pre className="overflow-x-auto bg-ink p-0 font-mono text-[13px] leading-6">
            {s.code.map((line, i) => {
              const n = i + 1;
              const picked = a.line === n;
              const clickable = line.trim() !== "";
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!clickable}
                  onClick={() => set({ line: picked ? null : n })}
                  className={`flex w-full items-start text-left ${picked ? "bg-red/25" : clickable ? "hover:bg-white/[0.06]" : ""}`}
                >
                  <span className="w-10 shrink-0 select-none px-2 text-right text-paper-dim">{n}</span>
                  <span className="whitespace-pre px-2">{line || " "}</span>
                  {picked && <span className="ml-auto px-3 text-red-vibrant">◄ bug</span>}
                </button>
              );
            })}
          </pre>
        </section>

        <section className="panel space-y-5 p-5">
          <div>
            <h2 className="display text-xl text-white">{s.title}</h2>
            <p className="mt-1 text-sm text-paper-dim">{s.intent}</p>
          </div>
          <div>
            <h3 className="label mb-2">1. {s.question}</h3>
            <div className="space-y-2">
              {s.options.map((o) => (
                <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 font-mono text-sm ${a.choice === o ? "border-red bg-red/15" : "border-line-strong hover:bg-white/[0.04]"}`}>
                  <input type="radio" name={`q-${s.id}`} checked={a.choice === o} onChange={() => set({ choice: o })} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="label mb-1">2. {s.bugPrompt}</h3>
            <p className="text-sm text-paper-dim">{a.line ? `You picked line ${a.line}.` : "Click a line of code on the left."}</p>
          </div>
          <div className="flex justify-between pt-1">
            <button className="btn btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              ← Previous
            </button>
            <button className="btn btn-ghost" disabled={index === session.length - 1} onClick={() => setIndex(index + 1)}>
              Next →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
