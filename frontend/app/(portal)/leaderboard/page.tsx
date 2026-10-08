"use client";

import { ArrowDown } from "lucide-react";
import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function LeaderboardPage() {
  const board = useLive(() => api.getLeaderboard(), [], 5000);
  const me = useLive(() => api.getParticipant());

  return (
    <div className="space-y-6">
      <PageTitle
        kicker="LIVE TELEMETRY"
        title="Royal Mint Standings"
        subtitle="Real-time rankings across all participating crews in CODEVERSE 2.0."
        right={
          me.data && (
            <a
              href="#my-team"
              className="btn btn-ghost text-xs gap-1.5 font-mono active:scale-95 transition-transform"
            >
              <ArrowDown className="h-3.5 w-3.5 text-red-vibrant" />
              <span>JUMP TO YOUR CREW (#{me.data.rank})</span>
            </a>
          )
        }
      />

      {board.data ? (
        <LeaderboardTable rows={board.data} myTeamId={me.data?.teamId} />
      ) : board.error ? (
        <NoSignal message="Cannot reach the Codeverse server." />
      ) : (
        <Loading what="SYNCHRONIZING SCOREBOARD DATA" />
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] text-xs font-mono text-paper-dim">
        <div className="flex items-center gap-2">
          <span className="radar-beacon h-2 w-2 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span>LIVE BROADCAST: Automatic sync active</span>
        </div>
        <span>UPDATES EVERY 5 SECONDS</span>
      </div>
    </div>
  );
}
