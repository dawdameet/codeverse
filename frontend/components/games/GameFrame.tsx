"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { type GameMeta } from "@/lib/games/registry";
import { useLive } from "@/lib/hooks";
import { gamesOpen } from "@/lib/phase";
import { devMode, saveOfficial, useGameResults, type GameResult, type SaveOutcome } from "@/lib/games/storage";

export type Mode = "practice" | "official";

export interface PlayApi {
  mode: Mode;
  seed: number;
  limitMs: number;
  elapsedMs: number;
  remainingMs: number;
  timeUp: boolean;
  /** End the run with the final score. Safe to call more than once. */
  finish: (score: number, detail: string) => void;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function TierTag({ tier }: { tier: GameMeta["tier"] }) {
  const cls = {
    EASY: "text-ok border-ok/40",
    MEDIUM: "text-amber border-amber/40",
    INTERMEDIATE: "text-red-vibrant border-red/40",
    HARD: "text-red-vibrant border-red/70",
  }[tier];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {tier.charAt(0) + tier.slice(1).toLowerCase()}
    </span>
  );
}

function Run({
  meta,
  mode,
  seed,
  onDone,
  children,
}: {
  meta: GameMeta;
  mode: Mode;
  seed: number;
  onDone: (r: GameResult) => void;
  children: (api: PlayApi) => ReactNode;
}) {
  const limitMs = meta.minutes * 60_000;
  const [elapsedMs, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.min(limitMs, Date.now() - start));
    }, 250);
    return () => clearInterval(id);
  }, [limitMs]);

  const finish = (score: number, detail: string) => {
    if (done) return;
    setDone(true);
    onDone({
      game: meta.id,
      score: Math.max(0, Math.round(score)),
      max: meta.max,
      detail,
      durationMs: elapsedMs,
      finishedAt: new Date().toISOString(),
    });
  };

  const remainingMs = limitMs - elapsedMs;
  const low = remainingMs < 60_000;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="display text-lg text-white">{meta.title}</span>
          <span className={`label ${mode === "official" ? "!text-red-vibrant" : ""}`}>
            {mode === "official" ? "Official run" : "Practice (not recorded)"}
          </span>
        </div>
        <div className={`font-mono text-xl font-semibold tabular-nums ${low ? "text-red-vibrant" : "text-white"}`}>
          {mmss(remainingMs)}
        </div>
      </div>
      {children({ mode, seed, limitMs, elapsedMs, remainingMs, timeUp: remainingMs <= 0, finish })}
    </div>
  );
}

export function GameFrame({
  meta,
  children,
}: {
  meta: GameMeta;
  children: (api: PlayApi) => ReactNode;
}) {
  const { results, loaded } = useGameResults();
  const previous = results[meta.id];
  const [run, setRun] = useState<{ mode: Mode; seed: number; id: number } | null>(null);
  const [result, setResult] = useState<{ r: GameResult; mode: Mode; saved?: SaveOutcome | "saving" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const status = useLive(() => api.getStatus(), [], 5000);
  const window_ = gamesOpen(status.data);
  const locked = Boolean(previous) && !devMode();
  const closed = !window_.open && !devMode();

  const start = (mode: Mode) => {
    setResult(null);
    setConfirming(false);
    setRun({
      mode,
      seed: mode === "official" ? meta.officialSeed : Math.floor(Math.random() * 1_000_000_000),
      id: Date.now(),
    });
  };

  if (run && !result) {
    return (
      <Run
        key={run.id}
        meta={meta}
        mode={run.mode}
        seed={run.seed}
        onDone={(r) => {
          if (run.mode !== "official") {
            setResult({ r, mode: run.mode });
            return;
          }
          setResult({ r, mode: run.mode, saved: "saving" });
          saveOfficial(r).then((saved) => setResult({ r, mode: run.mode, saved }));
        }}
      >
        {children}
      </Run>
    );
  }

  if (result) {
    const pct = result.r.max ? Math.round((100 * result.r.score) / result.r.max) : 0;
    return (
      <div className="panel mx-auto max-w-xl space-y-4 p-8 text-center">
        <div className="label">
          {result.mode === "practice"
            ? "Practice result (not recorded)"
            : result.saved === "saving"
              ? "Recording official result…"
              : result.saved?.state === "saved"
                ? "Official result recorded"
                : result.saved?.state === "pending"
                  ? "Saved on this device · will be sent when the server is reachable"
                  : "Official result not recorded"}
        </div>
        {result.saved && result.saved !== "saving" && result.saved.state === "rejected" && (
          <p className="text-sm text-amber">{result.saved.message}</p>
        )}
        <h1 className="display text-3xl text-white">{meta.title}</h1>
        <div className="display text-6xl text-red-vibrant">
          {result.r.score}
          <span className="text-2xl text-paper-dim"> / {result.r.max}</span>
        </div>
        <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-red" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-paper-dim">{result.r.detail}</p>
        <p className="font-mono text-sm text-paper-dim">Time used: {mmss(result.r.durationMs)}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/games" className="btn">
            Back to games
          </Link>
          {result.mode === "practice" && (
            <button className="btn btn-ghost" onClick={() => start("practice")}>
              Practice again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/games" className="text-sm text-paper-dim hover:text-white">
        ← All games
      </Link>
      <header>
        <div className="flex items-center gap-3">
          <TierTag tier={meta.tier} />
          <span className="label">{meta.minutes} minutes</span>
          <span className="label">up to {meta.max} points</span>
        </div>
        <h1 className="display mt-2 text-4xl text-white">{meta.title}</h1>
        <p className="mt-1 text-paper-dim">{meta.tagline}</p>
      </header>
      <section className="panel p-6">
        <h2 className="label mb-3">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-paper">
          {meta.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      </section>
      {previous && (
        <section className="panel p-5">
          <div className="label mb-1">Your official result</div>
          <div className="display text-3xl text-white">
            {previous.score} <span className="text-lg text-paper-dim">/ {previous.max}</span>
          </div>
          <p className="mt-1 text-sm text-paper-dim">{previous.detail}</p>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" onClick={() => start("practice")}>
          Practice (different puzzles, not recorded)
        </button>
        {!loaded && !devMode() ? (
          <span className="text-sm text-paper-dim">Checking your team&apos;s official results…</span>
        ) : locked ? (
          <span className="text-sm text-paper-dim">Your team has already used its official run.</span>
        ) : closed ? (
          <span className="text-sm text-amber">{window_.reason} Official runs are only open during Phase 1.</span>
        ) : confirming ? (
          <>
            <button className="btn" onClick={() => start("official")}>
              Yes, start the official run now
            </button>
            <button className="text-sm text-paper-dim hover:text-white" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirming(true)}>
            Start official run
          </button>
        )}
      </div>
      {!locked && confirming && (
        <p className="text-sm text-amber">You only get one official run. The clock starts immediately.</p>
      )}
    </div>
  );
}
