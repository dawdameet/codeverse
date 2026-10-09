import { GAMES, share } from "../games/registry";
import { BONUS, CHALLENGES, MOCK_TEAM, RIVALS } from "../mock/data";
import { mockEpoch, readMockState, type Scenario } from "../mock/state";
import type {
  Challenge,
  ChallengeStatus,
  GameResultRecord,
  LeaderboardEntry,
  Participant,
  Phase,
} from "../types";
import { ApiError, type CodeverseApi } from "./client";

const MIN = 60_000;
const LATENCY_MS = 120;

async function gate() {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  if (readMockState().server === "offline") {
    throw new ApiError("UNREACHABLE", "Codeverse server unreachable on LAN");
  }
}

const SCENARIOS: Record<
  Scenario,
  { solved: string[]; inProgress: string[] }
> = {
  fresh: { solved: [], inProgress: [] },
  midgame: { solved: ["OB-001", "OB-002", "OB-003"], inProgress: ["OB-004"] },
  sweep: {
    solved: CHALLENGES.map((c) => c.id),
    inProgress: [],
  },
};

function challenges(): Challenge[] {
  const { solved, inProgress } = SCENARIOS[readMockState().scenario];
  return CHALLENGES.map((c) => {
    const status: ChallengeStatus = solved.includes(c.id)
      ? "SOLVED"
      : inProgress.includes(c.id)
        ? "IN_PROGRESS"
        : "NOT_STARTED";
    return { ...c, status };
  });
}

function scoreOf(ids: string[]) {
  return CHALLENGES.filter((c) => ids.includes(c.id)).reduce(
    (sum, c) => sum + c.points,
    0,
  );
}

function board(): LeaderboardEntry[] {
  const mine = SCENARIOS[readMockState().scenario].solved;
  const rows = [
    {
      teamId: MOCK_TEAM.teamId,
      teamName: MOCK_TEAM.teamName,
      score: scoreOf(mine),
      solvedCount: mine.length,
    },
    ...RIVALS.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      score: scoreOf(r.solved),
      solvedCount: r.solved.length,
    })),
  ];
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.solvedCount - a.solvedCount ||
      a.teamName.localeCompare(b.teamName),
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// Mock mode has no server: official game results live in this browser.
const GAMES_KEY = "codeverse.mock.games";

function gameStore(): Record<string, GameResultRecord> {
  try {
    return JSON.parse(localStorage.getItem(GAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function gamesSummary() {
  const store = gameStore();
  const played = GAMES.filter((g) => store[g.id]);
  return {
    gamesPlayed: played.length,
    gamesTotal: GAMES.length,
    gamesScore: played.reduce((n, g) => n + share(g, store[g.id].score), 0),
  };
}

function phases(): Phase[] {
  const now = mockEpoch();
  const { phase } = readMockState();
  const p1 =
    phase === 1
      ? { start: now - 45 * MIN, end: now + 135 * MIN }
      : { start: now - 210 * MIN, end: now - 30 * MIN };
  const p2 =
    phase === 2
      ? { start: now - 20 * MIN, end: now + 70 * MIN }
      : { start: p1.end + 15 * MIN, end: p1.end + 105 * MIN };
  const iso = (t: number) => new Date(t).toISOString();
  return [
    {
      id: 1,
      name: "THE INFILTRATION",
      tagline: "Five quick games to get the crew past the Mint's outer defences.",
      status: phase === 1 ? "ACTIVE" : "COMPLETED",
      startTime: iso(p1.start),
      endTime: iso(p1.end),
    },
    {
      id: 2,
      name: "THE ROYAL MINT",
      tagline: "Investigate and repair the compromised OBELISK system.",
      status: phase === 2 ? "ACTIVE" : "UPCOMING",
      startTime: iso(p2.start),
      endTime: iso(p2.end),
    },
  ];
}

export const mockApi: CodeverseApi = {
  async login(teamId, accessCode) {
    await gate();
    if (
      teamId.trim().toUpperCase() !== MOCK_TEAM.teamId ||
      accessCode.trim().toUpperCase() !== MOCK_TEAM.accessCode
    ) {
      throw new ApiError("UNAUTHORIZED", "Invalid team ID or access code");
    }
    return { token: `mock-token-${MOCK_TEAM.id}`, participantId: MOCK_TEAM.id };
  },

  async getParticipant(): Promise<Participant> {
    await gate();
    const me = board().find((r) => r.teamId === MOCK_TEAM.teamId)!;
    const games = gamesSummary();
    return {
      id: MOCK_TEAM.id,
      teamId: me.teamId,
      teamName: me.teamName,
      score: me.score,
      rank: me.rank,
      totalTeams: RIVALS.length + 1,
      solvedCount: me.solvedCount,
      ...games,
      obeliskOpen: readMockState().phase === 2 || games.gamesPlayed === games.gamesTotal,
    };
  },

  async getStatus() {
    await gate();
    const state = readMockState();
    const all = phases();
    const active = all.find((p) => p.id === state.phase)!;
    return {
      phase: state.phase,
      status: "LIVE",
      serverStatus: state.server,
      startTime: all[0].startTime,
      endTime: active.endTime,
      serverTime: new Date().toISOString(),
    };
  },

  async getPhases() {
    await gate();
    return phases();
  },

  async getChallenges() {
    await gate();
    return challenges();
  },

  async getChallenge(id) {
    await gate();
    const found = challenges().find((c) => c.id === id.toUpperCase());
    if (!found) throw new ApiError("NOT_FOUND", `No such challenge: ${id}`);
    return found;
  },

  async getBonusChallenge() {
    await gate();
    return BONUS;
  },

  async getLeaderboard() {
    await gate();
    return board();
  },

  async getGameResults() {
    await gate();
    return gameStore();
  },

  async submitGameResult(r) {
    await gate();
    const store = gameStore();
    if (store[r.game]) throw new ApiError("CONFLICT", "Already recorded", "ALREADY_PLAYED");
    store[r.game] = r;
    try {
      localStorage.setItem(GAMES_KEY, JSON.stringify(store));
    } catch {}
    return r;
  },
};
