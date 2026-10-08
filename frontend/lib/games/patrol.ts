import { Rng } from "./prng.ts";

/** Game 3 - Guard Patrol: queue a route, press Run, and slip past the guards and lasers. */

export type Move = "U" | "D" | "L" | "R" | "W";
export type Cell = readonly [number, number]; // [x, y]

export interface Guard {
  path: Cell[]; // positions per turn, repeating
}

export interface Laser {
  at: Cell;
  period: number;
  onFor: number; // on for turns where t % period < onFor
}

export interface PatrolLevel {
  width: number;
  height: number;
  walls: boolean[][]; // walls[y][x]
  start: Cell;
  exit: Cell;
  guards: Guard[];
  lasers: Laser[];
  par: number; // fewest moves for a safe route
}

const DELTA: Record<Move, Cell> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };

export const guardAt = (g: Guard, t: number): Cell => g.path[t % g.path.length];
export const laserOn = (l: Laser, t: number): boolean => t % l.period < l.onFor;
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export interface StepResult {
  pos: Cell;
  caught: string | null;
  exited: boolean;
}

/** One turn: the player moves, then time advances from t to t+1. */
export function step(level: PatrolLevel, pos: Cell, move: Move, t: number): StepResult {
  const [dx, dy] = DELTA[move];
  let nx = pos[0] + dx;
  let ny = pos[1] + dy;
  if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height || level.walls[ny][nx]) {
    nx = pos[0];
    ny = pos[1]; // bumping into a wall wastes the turn
  }
  const next: Cell = [nx, ny];
  for (const g of level.guards) {
    const before = guardAt(g, t);
    const after = guardAt(g, t + 1);
    if (same(after, next)) return { pos: next, caught: "A guard spotted you", exited: false };
    if (same(before, next) && same(after, pos)) return { pos: next, caught: "You walked into a guard", exited: false };
  }
  for (const l of level.lasers) {
    if (same(l.at, next) && laserOn(l, t + 1)) return { pos: next, caught: "A laser tripped", exited: false };
  }
  return { pos: next, caught: null, exited: same(next, level.exit) };
}

export interface Frame {
  t: number;
  player: Cell;
  guards: Cell[];
  lasers: boolean[];
}

export interface Simulation {
  frames: Frame[]; // frames[0] is the starting state
  outcome: "exit" | "caught" | "unfinished";
  reason: string | null;
  movesUsed: number;
}

export function frameAt(level: PatrolLevel, player: Cell, t: number): Frame {
  return { t, player, guards: level.guards.map((g) => guardAt(g, t)), lasers: level.lasers.map((l) => laserOn(l, t)) };
}

export function simulate(level: PatrolLevel, moves: Move[]): Simulation {
  let pos = level.start;
  const frames: Frame[] = [frameAt(level, pos, 0)];
  for (let t = 0; t < moves.length; t++) {
    const r = step(level, pos, moves[t], t);
    pos = r.pos;
    frames.push(frameAt(level, pos, t + 1));
    if (r.caught) return { frames, outcome: "caught", reason: r.caught, movesUsed: t + 1 };
    if (r.exited) return { frames, outcome: "exit", reason: null, movesUsed: t + 1 };
  }
  return { frames, outcome: "unfinished", reason: null, movesUsed: moves.length };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** Shortest safe route length (BFS over position x time-cycle), or null if there is none. */
export function solve(level: PatrolLevel, limit = 60): number | null {
  let cycle = 1;
  for (const g of level.guards) cycle = lcm(cycle, g.path.length);
  for (const l of level.lasers) cycle = lcm(cycle, l.period);
  const key = (p: Cell, t: number) => `${p[0]},${p[1]},${t % cycle}`;
  let frontier: { pos: Cell; t: number }[] = [{ pos: level.start, t: 0 }];
  const seen = new Set([key(level.start, 0)]);
  for (let depth = 1; depth <= limit; depth++) {
    const nextFrontier: { pos: Cell; t: number }[] = [];
    for (const { pos, t } of frontier) {
      for (const m of ["U", "D", "L", "R", "W"] as Move[]) {
        const r = step(level, pos, m, t);
        if (r.caught) continue;
        if (r.exited) return depth;
        const k = key(r.pos, t + 1);
        if (!seen.has(k)) {
          seen.add(k);
          nextFrontier.push({ pos: r.pos, t: t + 1 });
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) return null;
  }
  return null;
}

interface Shape {
  size: number;
  guards: number;
  lasers: number;
  walls: number;
}
const SHAPES: Shape[] = [
  { size: 7, guards: 1, lasers: 1, walls: 6 },
  { size: 8, guards: 2, lasers: 2, walls: 9 },
  { size: 9, guards: 3, lasers: 3, walls: 12 },
];

function attempt(rng: Rng, shape: Shape): PatrolLevel | null {
  const { size } = shape;
  const walls = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const start: Cell = [0, size - 1];
  const exit: Cell = [size - 1, 0];
  const keep = (x: number, y: number) => (x === start[0] && y === start[1]) || (x === exit[0] && y === exit[1]);
  for (let i = 0; i < shape.walls; i++) {
    const x = rng.int(0, size - 1);
    const y = rng.int(0, size - 1);
    if (!keep(x, y)) walls[y][x] = true;
  }
  const taken = new Set<string>([`${start}`, `${exit}`]);
  const guards: Guard[] = [];
  for (let k = 0; k < shape.guards; k++) {
    const horizontal = rng.chance(0.5);
    const len = rng.int(3, 5);
    const x0 = rng.int(0, size - (horizontal ? len : 1));
    const y0 = rng.int(0, size - (horizontal ? 1 : len));
    const seg: Cell[] = Array.from({ length: len }, (_, i) => (horizontal ? [x0 + i, y0] : [x0, y0 + i]) as Cell);
    if (seg.some((c) => walls[c[1]][c[0]] || taken.has(`${c}`))) return null;
    seg.forEach((c) => taken.add(`${c}`));
    // out and back: c0 c1 .. c(n-1) c(n-2) .. c1
    guards.push({ path: [...seg, ...seg.slice(1, -1).reverse()] });
  }
  const lasers: Laser[] = [];
  for (let k = 0; k < shape.lasers; k++) {
    const x = rng.int(0, size - 1);
    const y = rng.int(0, size - 1);
    if (walls[y][x] || taken.has(`${[x, y]}`)) return null;
    taken.add(`${[x, y]}`);
    lasers.push({ at: [x, y], period: rng.pick([4, 5, 6]), onFor: 2 });
  }
  const level: PatrolLevel = { width: size, height: size, walls, start, exit, guards, lasers, par: 0 };
  const par = solve(level);
  const direct = Math.abs(exit[0] - start[0]) + Math.abs(exit[1] - start[1]);
  if (par === null || par < direct + 2) return null; // must be solvable but need some care
  return { ...level, par };
}

export function makeLevels(seed: number): PatrolLevel[] {
  const rng = new Rng(seed);
  return SHAPES.map((shape) => {
    for (let tries = 0; tries < 5000; tries++) {
      const level = attempt(rng, shape);
      if (level) return level;
    }
    throw new Error("could not generate a patrol level");
  });
}

/** 100 for escaping + up to 50 for efficiency, minus 10 per failed run (never below 30 once escaped). */
export function levelScore(par: number, movesUsed: number, failedRuns: number): number {
  const efficiency = Math.max(0, 50 - 10 * Math.max(0, movesUsed - par));
  return Math.max(30, 100 + efficiency - 10 * failedRuns);
}

export const TIME_BONUS_MAX = 50;
export const maxScore = (levels = SHAPES.length) => levels * 150 + TIME_BONUS_MAX;

export function timeBonus(solved: number, remainingMs: number, limitMs: number): number {
  if (solved === 0) return 0;
  return Math.round(TIME_BONUS_MAX * Math.max(0, Math.min(1, remainingMs / limitMs)));
}
