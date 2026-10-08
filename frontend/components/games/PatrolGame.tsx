"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import * as patrol from "@/lib/games/patrol";
import type { Frame, Move, Simulation } from "@/lib/games/patrol";
import type { PlayApi } from "./GameFrame";

interface Playback {
  id: number;
  kind: "run" | "watch";
  sim: Simulation;
  i: number;
  done: boolean;
}

const ARROW: Record<Move, string> = { U: "↑", D: "↓", L: "←", R: "→", W: "⏸" };
const KEYS: Record<string, Move> = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", " ": "W" };
const WATCH_TURNS = 14;
const STEP_MS = 380;

export function PatrolGame({ api }: { api: PlayApi }) {
  const levels = useMemo(() => patrol.makeLevels(api.seed), [api.seed]);
  const [li, setLi] = useState(0);
  const [queue, setQueue] = useState<Move[]>([]);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [failed, setFailed] = useState<number[]>(() => levels.map(() => 0));
  const [scores, setScores] = useState<(number | null)[]>(() => levels.map(() => null));
  const [message, setMessage] = useState("");
  const playId = useRef(0);
  const failedRef = useRef<number[]>(levels.map(() => 0));

  const level = levels[li];
  const solved = scores[li] !== null;
  const playing = playback !== null && !playback.done;
  const frame: Frame = playback ? playback.sim.frames[playback.i] : patrol.frameAt(level, level.start, 0);

  const start = (kind: "run" | "watch") => {
    if (playing || solved) return;
    const moves: Move[] = kind === "watch" ? Array<Move>(WATCH_TURNS).fill("W") : queue;
    if (kind === "run" && moves.length === 0) {
      setMessage("Queue some moves first.");
      return;
    }
    const sim = patrol.simulate(level, moves);
    setMessage("");
    playId.current += 1;
    const p: Playback = { id: playId.current, kind, sim, i: 0, done: false };
    setPlayback(p);
    const levelIndex = li;
    const par = level.par;
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => settle(p, levelIndex, par), (sim.frames.length - 1) * STEP_MS + 450);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPlayback((p) => (p && p.i < p.sim.frames.length - 1 ? { ...p, i: p.i + 1 } : p));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, playback?.id]);

  // run-end bookkeeping happens on a timer (not in an effect) so scoring is applied exactly once
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (endTimer.current) clearTimeout(endTimer.current);
  }, []);
  const settle = (p: Playback, levelIndex: number, par: number) => {
    setPlayback((cur) => (cur && cur.id === p.id ? { ...cur, i: cur.sim.frames.length - 1, done: true } : cur));
    if (p.kind === "watch") return;
    if (p.sim.outcome === "exit") {
      setScores((sc) => sc.map((v, i) => (i === levelIndex ? patrol.levelScore(par, p.sim.movesUsed, failedRef.current[levelIndex]) : v)));
      setMessage(`Escaped in ${p.sim.movesUsed} moves!`);
    } else {
      setFailed((f) => {
        const next = f.map((v, i) => (i === levelIndex ? v + 1 : v));
        failedRef.current = next;
        return next;
      });
      setMessage(p.sim.outcome === "caught" ? `${p.sim.reason}. Adjust your route and run again.` : "Your route ended before reaching the exit.");
    }
  };

  const finishNow = () => {
    const done = scores.filter((s) => s !== null).length;
    const sum = scores.reduce<number>((n, s) => n + (s ?? 0), 0);
    api.finish(sum + patrol.timeBonus(done, api.remainingMs, api.limitMs), `${done} of ${levels.length} levels escaped.`);
  };
  const onTimeUp = useEffectEvent(() => finishNow());
  useEffect(() => {
    if (api.timeUp) onTimeUp();
  }, [api.timeUp]);

  const push = (m: Move) => {
    if (playing || solved) return;
    if (playback?.done) setPlayback(null);
    setQueue((q) => (q.length < 60 ? [...q, m] : q));
  };
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (KEYS[e.key]) {
      e.preventDefault();
      push(KEYS[e.key]);
    } else if (e.key === "Backspace") {
      if (!playing && !solved) setQueue((q) => q.slice(0, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      start("run");
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      onKey(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const goNext = () => {
    setLi(li + 1);
    setQueue([]);
    setPlayback(null);
    setMessage("");
  };
  const last = li === levels.length - 1;
  const activeStep = playback && !playback.done ? playback.i : -1;

  const cell = (x: number, y: number) => {
    const isWall = level.walls[y][x];
    const isStart = level.start[0] === x && level.start[1] === y;
    const isExit = level.exit[0] === x && level.exit[1] === y;
    const laserIdx = level.lasers.findIndex((l) => l.at[0] === x && l.at[1] === y);
    const guardHere = frame.guards.some((g) => g[0] === x && g[1] === y);
    const player = frame.player[0] === x && frame.player[1] === y;
    let bg = "bg-ink";
    if (isWall) bg = "bg-white/15";
    if (isExit) bg = "bg-ok/30";
    if (isStart) bg = "bg-white/5";
    return (
      <div key={`${x},${y}`} className={`relative flex aspect-square items-center justify-center rounded-sm border border-line/60 text-xs font-bold ${bg}`}>
        {isExit && <span className="absolute text-[10px] text-ok">EXIT</span>}
        {isStart && !player && <span className="absolute text-[10px] text-paper-dim">START</span>}
        {laserIdx >= 0 && (
          <span className={`absolute inset-1 rounded-sm ${frame.lasers[laserIdx] ? "bg-red-vibrant/80 shadow-[0_0_10px_var(--color-red-vibrant)]" : "border border-dashed border-red/40"}`} />
        )}
        {guardHere && <span className="relative z-10 flex h-3/4 w-3/4 items-center justify-center rounded-full bg-red text-white">G</span>}
        {player && <span className="relative z-20 flex h-3/5 w-3/5 items-center justify-center rounded-full bg-gold text-black">P</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {levels.map((_, i) => (
          <span key={i} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${i === li ? "border-red bg-red/20 text-white" : "border-line-strong text-paper-dim"}`}>
            Level {i + 1} {scores[i] !== null && <span className="text-ok">✓ {scores[i]}</span>}
          </span>
        ))}
        <button className="btn btn-ghost ml-auto !py-1.5" onClick={finishNow}>
          Finish &amp; submit
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_1fr]">
        <section className="panel p-4">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${level.width}, minmax(0, 1fr))` }}>
            {Array.from({ length: level.height }, (_, y) => Array.from({ length: level.width }, (_, x) => cell(x, y)))}
          </div>
          <p className="mt-3 text-xs text-paper-dim">
            <span className="text-gold">P</span> you · <span className="text-red-vibrant">G</span> guard (walks a fixed loop) ·
            red bar = laser on, dashed = laser off · grey = wall (bumping wastes a turn)
          </p>
        </section>

        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="display text-xl text-white">Level {li + 1}</h2>
            <p className="text-sm text-paper-dim">
              Moves queued: {queue.length} · failed runs: {failed[li]}
            </p>
          </div>

          <div className="flex min-h-[3rem] flex-wrap gap-1 rounded-lg bg-ink p-2">
            {queue.length === 0 && <span className="px-1 text-sm text-paper-dim">Use the arrow keys or buttons to add moves.</span>}
            {queue.map((m, i) => (
              <span
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded font-mono ${i === activeStep - 1 || (playback?.done && playback.kind === "run" && i === playback.sim.movesUsed - 1) ? "bg-gold text-black" : "bg-white/10"}`}
              >
                {ARROW[m]}
              </span>
            ))}
          </div>

          <div className="grid max-w-[220px] grid-cols-3 gap-2">
            <span />
            <button className="btn btn-ghost !px-0" onClick={() => push("U")} disabled={playing || solved}>↑</button>
            <span />
            <button className="btn btn-ghost !px-0" onClick={() => push("L")} disabled={playing || solved}>←</button>
            <button className="btn btn-ghost !px-0" onClick={() => push("W")} disabled={playing || solved}>wait</button>
            <button className="btn btn-ghost !px-0" onClick={() => push("R")} disabled={playing || solved}>→</button>
            <span />
            <button className="btn btn-ghost !px-0" onClick={() => push("D")} disabled={playing || solved}>↓</button>
            <span />
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => start("run")} disabled={playing || solved}>
              Run
            </button>
            <button className="btn btn-ghost" onClick={() => start("watch")} disabled={playing || solved}>
              Watch patrols (free)
            </button>
            <button className="btn btn-ghost" onClick={() => setQueue((q) => q.slice(0, -1))} disabled={playing || solved}>
              Undo
            </button>
            <button className="btn btn-ghost" onClick={() => setQueue([])} disabled={playing || solved}>
              Clear
            </button>
          </div>
          <p className="text-xs text-paper-dim">Keys: arrows add moves · Space = wait · Backspace = undo · Enter = run.</p>

          {message && (
            <p className={solved ? "text-ok" : "text-red-vibrant"}>{message}</p>
          )}
          {solved && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-paper-dim">{scores[li]} points</span>
              {last ? (
                <button className="btn" onClick={finishNow}>
                  See results
                </button>
              ) : (
                <button className="btn" onClick={goNext}>
                  Next level
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
