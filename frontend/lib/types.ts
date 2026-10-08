export type Difficulty =
  | "BEGINNER"
  | "EASY"
  | "MEDIUM"
  | "INTERMEDIATE"
  | "HARD"
  | "ELITE";

export type ChallengeStatus = "NOT_STARTED" | "IN_PROGRESS" | "SOLVED";
export type PhaseStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";
export type EventStatus = "NOT_STARTED" | "LIVE" | "PAUSED" | "ENDED";
export type ServerStatus = "connected" | "degraded" | "offline";

export interface Participant {
  id: string;
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
  totalTeams: number;
  solvedCount: number;
}

export interface Phase {
  id: 1 | 2;
  name: string;
  tagline: string;
  status: PhaseStatus;
  startTime: string; // ISO-8601
  endTime: string; // ISO-8601
}

export interface Challenge {
  id: string; // e.g. "OB-001"
  name: string;
  difficulty: Difficulty;
  phase: 1 | 2;
  /** One-to-two sentence blurb for cards. */
  summary: string;
  /** Longer description for the detail page. */
  description: string;
  expectedBehavior: string;
  observedBehavior: string;
  /** Titles of docs sections relevant to this challenge. */
  relatedDocs: { label: string; anchor: string }[];
  points: number;
  status: ChallengeStatus;
}

export interface BonusChallenge {
  id: string;
  name: string;
  summary: string;
  description: string;
  example: string[];
  status: "CLASSIFIED" | "AVAILABLE" | "SOLVED";
  points: number;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  solvedCount: number;
}

export interface CompetitionStatus {
  /** Id of the phase that is currently active (or next up). */
  phase: 1 | 2;
  status: EventStatus;
  serverStatus: ServerStatus;
  startTime: string;
  endTime: string;
  /** Backend clock, used to correct for client clock drift. */
  serverTime: string;
  /** Organizer message shown as a banner (empty when none). */
  announcement?: string;
}

export interface Session {
  token: string;
  participantId: string;
}
