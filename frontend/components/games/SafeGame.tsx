"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import * as safe from "@/lib/games/safe";
import type { PlayApi } from "./GameFrame";

interface VaultState {
  guesses: string[];
  status: "open" | "solved" | "failed";
}

export function SafeGame({ api }: { api: PlayApi }) {
  const vaults = useMemo(() => safe.makeVaults(api.seed), [api.seed]);
  const [states, setStates] = useState<VaultState[]>(() => vaults.map(() => ({ guesses: [], status: "open" })));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const vault = vaults[index];
  const state = states[index];
  const left = vault.maxGuesses - state.guesses.length;

  const result = () => {
    const sum = states.reduce(
      (n, s, i) => n + safe.vaultScore(i, s.status === "solved", s.guesses.length, vaults[i].maxGuesses),
      0,
    );
    const solved = states.filter((s) => s.status === "solved").length;
    const total = sum + safe.timeBonus(solved > 0, api.remainingMs, api.limitMs);
    return { total, detail: `${solved} of ${vaults.length} vaults cracked.` };
  };
  const finishNow = () => {
    const r = result();
    api.finish(r.total, r.detail);
  };
  const onTimeUp = useEffectEvent(() => finishNow());
  useEffect(() => {
    if (api.timeUp) onTimeUp();
  }, [api.timeUp]);

  const press = (d: string) => {
    if (state.status !== "open" || input.length >= vault.digits || input.includes(d)) return;
    setError("");
    setInput(input + d);
  };
  const back = () => setInput(input.slice(0, -1));
  const submit = () => {
    if (state.status !== "open") return;
    if (!safe.isValidGuess(input, vault.digits)) {
      setError(`Enter ${vault.digits} different digits.`);
      return;
    }
    const guesses = [...state.guesses, input];
    const status = input === vault.secret ? "solved" : guesses.length >= vault.maxGuesses ? "failed" : "open";
    setStates(states.map((s, i) => (i === index ? { guesses, status } : s)));
    setInput("");
    setError("");
  };
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9") press(e.key);
    else if (e.key === "Backspace") back();
    else if (e.key === "Enter") {
      e.preventDefault(); // do not also "click" whatever button has focus
      submit();
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const allDone = states.every((s) => s.status !== "open");
  const last = index === vaults.length - 1;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-[1fr_280px]">
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl text-white">
            Vault {index + 1} <span className="text-paper-dim">of {vaults.length}</span>
          </h2>
          <span className="label">
            {vault.digits} digits · {left} guesses left
          </span>
        </div>

        <div className="space-y-2">
          {state.guesses.map((g, i) => {
            const f = safe.feedback(vault.secret, g);
            return (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink px-3 py-2">
                <span className="font-mono text-xl tracking-[0.4em]">{g}</span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-ok">{f.place} in place</span>
                  <span className="text-amber">{f.misplaced} misplaced</span>
                </span>
              </div>
            );
          })}
          {state.status === "open" && (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-line-strong px-3 py-2">
              <span className="font-mono text-xl tracking-[0.4em]">
                {input.padEnd(vault.digits, "·")}
              </span>
              <span className="label">your guess</span>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-vibrant">{error}</p>}

        {state.status === "open" ? (
          <div className="mt-5">
            <div className="grid grid-cols-5 gap-2">
              {"0123456789".split("").map((d) => (
                <button
                  key={d}
                  className="btn btn-ghost !px-0 font-mono !text-lg"
                  disabled={input.includes(d)}
                  onClick={() => press(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={back}>
                Delete
              </button>
              <button className="btn flex-1" onClick={submit}>
                Try code
              </button>
            </div>
            <p className="mt-2 text-xs text-paper-dim">Keyboard: digits, Backspace, Enter.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-line-strong p-4">
            <p className={state.status === "solved" ? "text-ok" : "text-red-vibrant"}>
              {state.status === "solved"
                ? `Vault cracked in ${state.guesses.length} guesses!`
                : `The vault stays locked. The code was ${vault.secret}.`}
            </p>
            <div className="mt-3">
              {!last ? (
                <button
                  className="btn"
                  onClick={() => {
                    setIndex(index + 1);
                    setInput("");
                  }}
                >
                  Next vault
                </button>
              ) : (
                <button className="btn" onClick={finishNow}>
                  See results
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="panel p-5">
          <h3 className="label mb-2">Reading the clues</h3>
          <p className="text-sm text-paper-dim">
            <span className="text-ok">In place</span>: right digit, right spot.
            <br />
            <span className="text-amber">Misplaced</span>: right digit, wrong spot.
            <br />A code never repeats a digit.
          </p>
        </section>
        <section className="panel p-5">
          <h3 className="label mb-2">Vaults</h3>
          <ul className="space-y-1 text-sm">
            {states.map((s, i) => (
              <li key={i} className="flex justify-between">
                <span>Vault {i + 1}</span>
                <span className={s.status === "solved" ? "text-ok" : s.status === "failed" ? "text-red-vibrant" : "text-paper-dim"}>
                  {s.status === "open" ? (i === index ? "in progress" : "waiting") : s.status}
                </span>
              </li>
            ))}
          </ul>
          {allDone && !last && <p className="mt-2 text-xs text-paper-dim">All vaults resolved.</p>}
        </section>
      </aside>
    </div>
  );
}
