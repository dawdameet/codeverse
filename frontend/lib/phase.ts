import type { CompetitionStatus, Participant } from "./types";

/** Phase 1 = the games round. Phase 2 = the OBELISK debugging round. */
export const PHASE_GAMES = 1;
export const PHASE_OBELISK = 2;

/**
 * OBELISK is revealed only when the organizer opens phase 2 (and stays visible after the event).
 * The server decides (`me.obeliskOpen`); the status-only rule is the fallback while that is loading.
 */
export function obeliskOpen(
  s: CompetitionStatus | null | undefined,
  me?: Participant | null,
): boolean {
  if (me && typeof me.obeliskOpen === "boolean") return me.obeliskOpen;
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
