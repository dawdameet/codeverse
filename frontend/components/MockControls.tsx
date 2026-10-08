"use client";

import { useState, useSyncExternalStore } from "react";
import { SlidersHorizontal, X, Server, Shield, Activity } from "lucide-react";
import { config } from "@/lib/config";
import {
  MOCK_EVENT,
  readMockState,
  writeMockState,
  type MockState,
} from "@/lib/mock/state";

function Group<T extends string | number>({
  label,
  icon,
  value,
  options,
  onPick,
}: {
  label: string;
  icon?: React.ReactNode;
  value: T;
  options: { v: T; t: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center gap-1.5 label mb-1.5 text-[10px] text-paper-dim">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o.v === value;
          return (
            <button
              key={String(o.v)}
              onClick={() => onPick(o.v)}
              type="button"
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-medium transition-all duration-150 active:scale-95 ${
                selected
                  ? "bg-red text-white shadow-[0_0_10px_rgba(224,38,31,0.5)] border border-red"
                  : "border border-white/10 bg-white/[0.04] text-paper-dim hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              {o.t}
            </button>
          );
        })}
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
    <div className="fixed bottom-4 right-4 z-50 text-xs">
      {open && (
        <div className="panel mb-2.5 w-72 p-4 shadow-2xl border-white/15 bg-ink-2/95 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red animate-pulse" />
              <span className="label text-[10px] text-paper">MOCK SIMULATION ENGINE</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-paper-dim hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Group
            label="SERVER LINK STATE"
            icon={<Server className="h-3 w-3 text-red-vibrant" />}
            value={s.server}
            options={[
              { v: "connected", t: "ONLINE" },
              { v: "degraded", t: "DEGRADED" },
              { v: "offline", t: "OFFLINE" },
            ]}
            onPick={(server) => set({ server })}
          />

          <Group
            label="ACTIVE HEIST PHASE"
            icon={<Shield className="h-3 w-3 text-gold" />}
            value={s.phase}
            options={[
              { v: 1, t: "PHASE 1 (MINT)" },
              { v: 2, t: "PHASE 2 (ESCAPE)" },
            ]}
            onPick={(phase) => set({ phase })}
          />

          <Group
            label="TEAM HEIST PROGRESS"
            icon={<Activity className="h-3 w-3 text-emerald-400" />}
            value={s.scenario}
            options={[
              { v: "fresh", t: "0/6 SOLVED" },
              { v: "midgame", t: "3/6 SOLVED" },
              { v: "sweep", t: "6/6 SOLVED" },
            ]}
            onPick={(scenario) => set({ scenario })}
          />
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="ml-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3.5 py-1.5 font-mono text-[11px] font-semibold text-paper-dim shadow-lg backdrop-blur-xl transition-all duration-150 hover:border-red/40 hover:text-white active:scale-95"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-red-vibrant" />
        <span>SIMULATOR</span>
      </button>
    </div>
  );
}
