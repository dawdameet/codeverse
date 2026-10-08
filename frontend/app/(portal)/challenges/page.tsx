"use client";

import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { ChallengeCard } from "@/components/ChallengeCard";
import {
  Loading,
  NoSignal,
  PageTitle,
  Panel,
  PhaseBadge,
  ProgressBar,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

type FilterStatus = "ALL" | "UNSOLVED" | "SOLVED";

export default function ChallengesPage() {
  const challenges = useLive(() => api.getChallenges());
  const phases = useLive(() => api.getPhases());
  const bonus = useLive(() => api.getBonusChallenge());
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  if (!challenges.data || !phases.data) {
    return challenges.error ? (
      <NoSignal message="Cannot reach the Codeverse server." />
    ) : (
      <Loading />
    );
  }

  const [p1, p2] = phases.data;
  const solvedCount = challenges.data.filter((c) => c.status === "SOLVED").length;
  const earnedPoints = challenges.data
    .filter((c) => c.status === "SOLVED")
    .reduce((n, c) => n + c.points, 0);
  const totalPoints = challenges.data.reduce((n, c) => n + c.points, 0);

  const displayedChallenges = challenges.data.filter((c) => {
    if (statusFilter === "SOLVED") return c.status === "SOLVED";
    if (statusFilter === "UNSOLVED") return c.status !== "SOLVED";
    return true;
  });

  return (
    <div className="space-y-8">
      <PageTitle
        kicker={`PHASE 1 // ${p1.name}`}
        title="Operation Vaults"
        subtitle="Investigate OBELISK subsystems, uncover vulnerabilities, and repair the production system."
        right={<PhaseBadge status={p1.status} />}
      />

      {/* Progress & Quick Stats Card */}
      <Panel className="p-6 bg-gradient-to-r from-red-950/20 via-ink-2/90 to-ink-2">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="label text-[10px]">VULNERABILITIES CLEARED</div>
              <div className="display text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                {solvedCount} <span className="text-paper-dim text-lg">/ {challenges.data.length}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="label text-[10px]">LOOT ACCUMULATED</div>
              <div className="display text-2xl sm:text-3xl font-extrabold text-gold mt-0.5">
                {earnedPoints} <span className="text-paper-dim text-lg">/ {totalPoints} PTS</span>
              </div>
            </div>
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md">
            {(["ALL", "UNSOLVED", "SOLVED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded-full px-3.5 py-1 text-xs font-mono font-semibold transition-all duration-150 active:scale-95 ${
                  statusFilter === f
                    ? "bg-red text-white shadow-[0_0_10px_rgba(224,38,31,0.4)]"
                    : "text-paper-dim hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <ProgressBar done={solvedCount} total={challenges.data.length} />
      </Panel>

      {/* Grid of Challenges */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displayedChallenges.map((c) => (
          <ChallengeCard key={c.id} c={c} />
        ))}
      </div>

      {/* Sealed Vaults (Phase 2 & Bonus) */}
      <div className="pt-6 border-t border-white/[0.08]">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="h-4 w-4 text-paper-dim" />
          <h2 className="display text-2xl font-bold text-white">Upcoming &amp; Bonus Operations</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Phase 2: The Escape */}
          <Panel className="border-dashed border-white/20 bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="label text-red">PHASE 2</div>
                <h3 className="display text-2xl font-bold text-white mt-1">{p2.name}</h3>
              </div>
              <PhaseBadge status={p2.status} />
            </div>

            <p className="mt-3 text-sm text-paper-dim leading-relaxed">{p2.tagline}</p>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-paper-dim/80">
              {p2.status === "UPCOMING" ? (
                <div className="flex items-center gap-2 text-paper-dim">
                  <Lock className="h-4 w-4 text-red-vibrant shrink-0" />
                  <span>DOSSIER SEALED — Briefing released when Phase 2 opens.</span>
                </div>
              ) : p2.status === "ACTIVE" ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>PHASE 2 IS ACTIVE — Check official briefing instructions.</span>
                </div>
              ) : (
                <span>PHASE 2 HAS CONCLUDED</span>
              )}
            </div>
          </Panel>

          {/* Bonus Challenge: The Ledger */}
          {bonus.data && (
            <Panel className="border-dashed border-gold/30 bg-gradient-to-b from-gold/5 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="label text-gold">BONUS SPECIFICATION</div>
                  <h3 className="display text-2xl font-bold text-white mt-1">{bonus.data.name}</h3>
                </div>
                <span className="stamp text-gold text-xs border-gold/50 bg-gold/10">
                  {bonus.data.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-paper-dim leading-relaxed">{bonus.data.summary}</p>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-emerald-300">
                <div className="text-[10px] text-paper-dim/60 mb-1">SYNTAX SPECIFICATION:</div>
                {bonus.data.example.map((ex, i) => (
                  <div key={i}>{ex}</div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-mono text-gold">
                <span>+{bonus.data.points} BONUS BOUNTY POINTS</span>
                <span className="text-paper-dim">BROWNIE POINTS</span>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
