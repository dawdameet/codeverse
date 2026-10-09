import { useMemo, useSyncExternalStore } from "react";
import { api, ApiError } from "../api";
import { refreshLive, useLive } from "../hooks";
import { getSession } from "../session.ts";
import type { GameId, GameMeta } from "./registry.ts";

export interface GameResult {
  game: GameId;
  score: number;
  max: number;
  detail: string;
  durationMs: number;
  finishedAt: string;
  /** Weighted points as computed by the server. */
  share?: number;
}

/** Weighted points of a recorded result (the server's number when it has one). */
export function resultShare(meta: GameMeta, r: GameResult): number {
  return r.share ?? (r.max ? Math.round((meta.weight * 100 * r.score) / r.max) : 0);
}

type Store = Partial<Record<GameId, GameResult>>;

/**
 * Official results are stored on the server (one per game per team), so every device of the
 * team, the dashboard and the admin panel see the same numbers. A result that cannot be sent
 * right away (network blip) waits in this browser and is retried on every refresh.
 */
const EVENT = "codeverse-games-pending";
const pendingKey = () => `codeverse.games.pending.${getSession()?.participantId ?? "guest"}`;

function readPendingRaw(): string {
  try {
    return localStorage.getItem(pendingKey()) ?? "{}";
  } catch {
    return "{}";
  }
}

function writePending(store: Store): void {
  try {
    if (Object.keys(store).length) localStorage.setItem(pendingKey(), JSON.stringify(store));
    else localStorage.removeItem(pendingKey());
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export type SaveOutcome =
  | { state: "saved" }
  | { state: "pending" } // kept on this device, will be retried
  | { state: "rejected"; message: string };

const transient = (e: unknown) =>
  !(e instanceof ApiError) || e.code === "UNREACHABLE" || e.code === "SERVER_ERROR";

async function send(r: GameResult): Promise<SaveOutcome> {
  try {
    await api.submitGameResult(r);
    return { state: "saved" };
  } catch (e) {
    if (transient(e)) return { state: "pending" };
    const err = e as ApiError;
    if (err.reason === "ALREADY_PLAYED") return { state: "rejected", message: "Your team already has an official result for this game." };
    if (err.reason === "GAMES_CLOSED") return { state: "rejected", message: "The games round had already closed." };
    return { state: "rejected", message: err.message };
  }
}

let flushing: Promise<void> | null = null;

/** Retry results that could not be sent earlier. */
export function flushPending(): Promise<void> {
  flushing ??= (async () => {
    const pending: Store = JSON.parse(readPendingRaw());
    for (const r of Object.values(pending)) {
      if (r && (await send(r)).state !== "pending") delete pending[r.game];
    }
    writePending(pending);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function saveOfficial(result: GameResult): Promise<SaveOutcome> {
  const pending: Store = JSON.parse(readPendingRaw());
  pending[result.game] = result;
  writePending(pending);
  const outcome = await send(result);
  if (outcome.state !== "pending") {
    delete pending[result.game];
    writePending(pending);
  }
  refreshLive(); // dashboard, score and the OBELISK unlock update immediately
  return outcome;
}

/** Organizer escape hatch: `localStorage.setItem("codeverse.games.dev","1")` allows unlimited official runs. */
export function devMode(): boolean {
  try {
    return localStorage.getItem("codeverse.games.dev") === "1";
  } catch {
    return false;
  }
}

/** The team's official results (server + any still waiting to be sent). `loaded` = server answered. */
export function useGameResults(): { results: Store; loaded: boolean } {
  const live = useLive(async () => {
    await flushPending();
    return api.getGameResults();
  }, [], 5000);
  const pendingRaw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    readPendingRaw,
    () => "{}",
  );
  return useMemo(
    () => ({
      results: { ...JSON.parse(pendingRaw), ...(live.data ?? {}) } as Store,
      loaded: live.data !== null,
    }),
    [live.data, pendingRaw],
  );
}
