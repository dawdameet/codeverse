"use client";

import { useState, useSyncExternalStore } from "react";
import { config } from "@/lib/config";
import {
  MOCK_EVENT,
  readMockState,
  writeMockState,
  type MockState,
} from "@/lib/mock/state";

function Group<T extends string | number>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { v: T; t: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="mb-2">
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => onPick(o.v)}
            className={`border px-2 py-0.5 text-[11px] ${o.v === value ? "border-red bg-red text-paper" : "border-line text-paper-dim hover:text-paper"}`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dev-only panel to simulate backend states. Hidden when using the real API. */
export function MockControls() {
  const [open, setOpen] = useState(false);
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(MOCK_EVENT, cb);
      return () => window.removeEventListener(MOCK_EVENT, cb);
    },
    () => JSON.stringify(readMockState()),
    () => null,
  );
  if (config.apiMode !== "mock" || !raw) return null;
  const s: MockState = JSON.parse(raw);
  const set = (p: Partial<MockState>) => writeMockState(p);

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] text-xs">
      {open && (
        <div className="panel mb-2 w-64 bg-ink p-3">
          <Group
            label="SERVER"
            value={s.server}
            options={[
              { v: "connected", t: "ONLINE" },
              { v: "degraded", t: "DEGRADED" },
              { v: "offline", t: "OFFLINE" },
            ]}
            onPick={(server) => set({ server })}
          />
          <Group
            label="ACTIVE PHASE"
            value={s.phase}
            options={[
              { v: 1, t: "PHASE 1" },
              { v: 2, t: "PHASE 2" },
            ]}
            onPick={(phase) => set({ phase })}
          />
          <Group
            label="TEAM PROGRESS"
            value={s.scenario}
            options={[
              { v: "fresh", t: "0/6" },
              { v: "midgame", t: "3/6" },
              { v: "sweep", t: "6/6" },
            ]}
            onPick={(scenario) => set({ scenario })}
          />
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto block border border-line bg-ink px-3 py-1 text-[11px] tracking-[0.16em] text-paper-dim hover:text-paper"
      >
        {open ? "× " : "⚙ "}MOCK
      </button>
    </div>
  );
}
