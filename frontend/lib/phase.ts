import type { CompetitionStatus } from "./types";

/** Phase 1 = the games round. Phase 2 = the OBELISK debugging round. */
export const PHASE_GAMES = 1;
export const PHASE_OBELISK = 2;

/** The OBELISK challenges are revealed once phase 2 opens (and stay visible after the event). */
export function obeliskOpen(s: CompetitionStatus | null | undefined): boolean {
  return !!s && (s.phase === PHASE_OBELISK || s.status === "ENDED");
}

/** Official game runs are only allowed while phase 1 is live. Unknown status = allowed (fail open). */
export function gamesOpen(s: CompetitionStatus | null | undefined): { open: boolean; reason: string } {
  if (!s) return { open: true, reason: "" };
  if (s.status === "NOT_STARTED") return { open: false, reason: "The event has not started yet." };
  if (s.status === "PAUSED") return { open: false, reason: "The event is paused." };
  if (s.status === "ENDED" || s.phase !== PHASE_GAMES) return { open: false, reason: "The games round (Phase 1) is over." };
  return { open: true, reason: "" };
}
