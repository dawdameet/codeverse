import * as bugs from "./bugs.ts";
import * as ledger from "./ledger.ts";
import * as logic from "./logic.ts";
import * as patrol from "./patrol.ts";
import * as safe from "./safe.ts";

export type GameId = "safe" | "ledger" | "patrol" | "logic" | "bugs";
export type Tier = "EASY" | "MEDIUM" | "INTERMEDIATE" | "HARD";

export interface GameMeta {
  id: GameId;
  title: string;
  tier: Tier;
  minutes: number;
  tagline: string;
  how: string[];
  max: number;
  /** Tier weight for the combined score (harder games count more). */
  weight: number;
  /** Everyone playing the official run gets the same puzzles (seeded). */
  officialSeed: number;
}

const EVENT_SEED = 20251107;

export const GAMES: GameMeta[] = [
  {
    id: "safe",
    title: "Crack the Safe",
    tier: "EASY",
    minutes: 10,
    tagline: "Deduce the secret codes of three vaults.",
    how: [
      "Each vault has a secret code of different digits (3, then 4, then 5 digits).",
      "Enter a guess. You are told how many digits are right and in the right place, and how many are right but in the wrong place.",
      "You have a limited number of guesses per vault. Fewer guesses and a faster finish score more.",
    ],
    max: safe.maxScore(),
    weight: 1,
    officialSeed: EVENT_SEED + 1,
  },
  {
    id: "ledger",
    title: "The Ledger Audit",
    tier: "MEDIUM",
    minutes: 12,
    tagline: "Someone doctored the Mint's books. Find the tampered entries.",
    how: [
      "A table of 120 transactions contains 9 hidden problems (duplicates, impossible values, a suspicious burst of activity...).",
      "Sort by any column, filter, and click a row to flag it. Click again to un-flag.",
      "+20 for each problem found, -10 for each clean row you flag. Press Submit when you are done.",
    ],
    max: ledger.maxScore(9),
    weight: 2,
    officialSeed: EVENT_SEED + 2,
  },
  {
    id: "patrol",
    title: "Guard Patrol",
    tier: "MEDIUM",
    minutes: 15,
    tagline: "Plan a route across the vault floor without being seen.",
    how: [
      "Queue moves with the arrow keys (Space = wait, Backspace = undo), then press Run.",
      "Guards walk fixed loops and are seen when they land on you or swap places with you. Lasers blink on a timer.",
      "Use Watch to observe the patrols (free). Reach the exit with few moves and few failed runs for the best score.",
    ],
    max: patrol.maxScore(3),
    weight: 2,
    officialSeed: EVENT_SEED + 3,
  },
  {
    id: "logic",
    title: "Logic Lockpick",
    tier: "INTERMEDIATE",
    minutes: 15,
    tagline: "Wire up logic gates so the lock opens for the right switches.",
    how: [
      "Each lock shows which switch settings must open it. Build a circuit from AND, OR and NOT gates that gives exactly that.",
      "Every gate takes inputs from the switches or from earlier gates. Choose which gate is the output.",
      "Press Test lock. Using the fewest gates scores most; wrong tests cost a few points.",
    ],
    max: logic.maxScore(),
    weight: 3,
    officialSeed: EVENT_SEED + 4,
  },
  {
    id: "bugs",
    title: "Bug Hunt Terminal",
    tier: "HARD",
    minutes: 20,
    tagline: "Read intercepted code, predict what it prints, and name the bug.",
    how: [
      "Eight short Python snippets. For each: say what it prints, then click the line that contains the bug.",
      "You do not need to write any code. Later snippets are worth more.",
      "You may move between snippets freely. Press Submit when you are done.",
    ],
    max: bugs.maxScore(),
    weight: 4,
    officialSeed: EVENT_SEED + 5,
  },
];

export const byId = (id: GameId): GameMeta => GAMES.find((g) => g.id === id)!;

/** Weighted share of one game: weight x percentage (so every game is comparable). */
export function share(meta: GameMeta, score: number): number {
  return Math.round((meta.weight * 100 * score) / meta.max);
}

export const TOTAL_SHARE = GAMES.reduce((n, g) => n + g.weight * 100, 0);
