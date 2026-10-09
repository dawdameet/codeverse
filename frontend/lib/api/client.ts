import type {
  BonusChallenge,
  Challenge,
  CompetitionStatus,
  GameResultRecord,
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
  /** The team's official game results, keyed by game id. */
  getGameResults(): Promise<Record<string, GameResultRecord>>;
  /** Open the single official run of a game (refreshing the page does not give another). */
  startGame(game: string): Promise<unknown>;
  /** Record an official game run (once per game). */
  submitGameResult(r: GameResultRecord): Promise<GameResultRecord>;
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "DISQUALIFIED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNREACHABLE"
  | "SERVER_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    /** Error code from the server body, e.g. PHASE_NOT_OPEN or ALREADY_PLAYED. */
    public reason?: string,
  ) {
    super(message);
  }
}
