import { Rng } from "./prng.ts";

/** Game 1 - Crack the Safe: a code-breaking (Bulls & Cows) game. */

export interface VaultSpec {
  digits: number;
  maxGuesses: number;
  secret: string; // distinct digits
}

const SHAPES = [
  { digits: 3, maxGuesses: 8 },
  { digits: 4, maxGuesses: 9 },
  { digits: 5, maxGuesses: 10 },
];

export function makeVaults(seed: number): VaultSpec[] {
  const rng = new Rng(seed);
  return SHAPES.map((s) => ({
    ...s,
    secret: rng.shuffle(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]).slice(0, s.digits).join(""),
  }));
}

export interface Feedback {
  place: number; // right digit, right position
  misplaced: number; // right digit, wrong position
}

export function feedback(secret: string, guess: string): Feedback {
  let place = 0;
  let misplaced = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) place++;
    else if (secret.includes(guess[i])) misplaced++;
  }
  return { place, misplaced };
}

export function isValidGuess(guess: string, digits: number): boolean {
  return guess.length === digits && /^\d+$/.test(guess) && new Set(guess).size === digits;
}

const BASE = (index: number) => 100 * (index + 1);
const PER_SPARE_GUESS = (index: number) => 15 * (index + 1);

export function vaultScore(index: number, solved: boolean, guessesUsed: number, maxGuesses: number): number {
  if (!solved) return 0;
  return BASE(index) + PER_SPARE_GUESS(index) * Math.max(0, maxGuesses - guessesUsed);
}

export const TIME_BONUS_MAX = 100;

export function timeBonus(anySolved: boolean, remainingMs: number, limitMs: number): number {
  if (!anySolved) return 0;
  return Math.round(TIME_BONUS_MAX * Math.max(0, Math.min(1, remainingMs / limitMs)));
}

export function maxScore(): number {
  return SHAPES.reduce((n, s, i) => n + vaultScore(i, true, 1, s.maxGuesses), 0) + TIME_BONUS_MAX;
}
