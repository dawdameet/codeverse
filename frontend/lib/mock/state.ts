import type { ServerStatus } from "../types";

/** Simulation knobs for the mock backend (driven by the on-screen MOCK panel). */
export type Scenario = "fresh" | "midgame" | "sweep";

export interface MockState {
  server: ServerStatus;
  phase: 1 | 2;
  scenario: Scenario;
}

const KEY = "codeverse.mock";
const EPOCH_KEY = "codeverse.mock.epoch";
export const MOCK_EVENT = "codeverse-mock-change";

const DEFAULTS: MockState = { server: "connected", phase: 1, scenario: "midgame" };

export function readMockState(): MockState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function writeMockState(patch: Partial<MockState>) {
  const next = { ...readMockState(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(MOCK_EVENT));
  return next;
}

/** A stable "event start" anchor so timers survive page reloads. */
export function mockEpoch(): number {
  try {
    const saved = Number(localStorage.getItem(EPOCH_KEY));
    if (saved && Date.now() - saved < 6 * 3600_000) return saved;
    localStorage.setItem(EPOCH_KEY, String(Date.now()));
  } catch {}
  return Date.now();
}
