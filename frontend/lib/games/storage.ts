import { useMemo, useSyncExternalStore } from "react";
import { getSession } from "../session.ts";
import type { GameId } from "./registry.ts";

export interface GameResult {
  game: GameId;
  score: number;
  max: number;
  detail: string;
  durationMs: number;
  finishedAt: string;
}

type Store = Partial<Record<GameId, GameResult>>;
const EVENT = "codeverse-games-change";
const key = () => `codeverse.games.v1.${getSession()?.participantId ?? "guest"}`;

function readRaw(): string {
  try {
    return localStorage.getItem(key()) ?? "{}";
  } catch {
    return "{}";
  }
}

export function saveOfficial(result: GameResult): void {
  try {
    const store: Store = JSON.parse(readRaw());
    store[result.game] = result;
    localStorage.setItem(key(), JSON.stringify(store));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

/** Organizer escape hatch: `localStorage.setItem("codeverse.games.dev","1")` allows unlimited official runs. */
export function devMode(): boolean {
  try {
    return localStorage.getItem("codeverse.games.dev") === "1";
  } catch {
    return false;
  }
}

export function useGameResults(): Store {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    readRaw,
    () => "{}",
  );
  return useMemo(() => JSON.parse(raw) as Store, [raw]);
}
