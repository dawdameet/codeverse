import type {
  BonusChallenge,
  Challenge,
  CompetitionStatus,
  LeaderboardEntry,
  Participant,
  Phase,
  Session,
} from "../types";

/**
 * The only surface the UI talks to. A mock implementation backs it today;
 * the HTTP implementation targets the LAN backend later.
 */
export interface CodeverseApi {
  login(teamId: string, accessCode: string): Promise<Session>;
  getParticipant(): Promise<Participant>;
  getStatus(): Promise<CompetitionStatus>;
  getPhases(): Promise<Phase[]>;
  getChallenges(): Promise<Challenge[]>;
  getChallenge(id: string): Promise<Challenge>;
  getBonusChallenge(): Promise<BonusChallenge>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNREACHABLE"
  | "SERVER_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}
