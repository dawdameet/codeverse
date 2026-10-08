"use client";

import { useState } from "react";
import { Search, CheckCircle2 } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";

export function LeaderboardTable({
  rows,
  myTeamId,
  showPodium = true,
}: {
  rows: LeaderboardEntry[];
  myTeamId?: string;
  showPodium?: boolean;
}) {
  const [filter, setFilter] = useState("");

  const filteredRows = filter.trim()
    ? rows.filter(
        (r) =>
          r.teamName.toLowerCase().includes(filter.toLowerCase()) ||
          r.teamId.toLowerCase().includes(filter.toLowerCase()),
      )
    : rows;

  const top3 = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Top 3 Podium Highlights */}
      {showPodium && rows.length >= 3 && !filter && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 2nd Place */}
          {top3[1] && (
            <PodiumCard
              entry={top3[1]}
              rank={2}
              badge="SILVER HEIST"
              color="text-slate-300"
              borderColor="border-slate-400/30"
              glowColor="from-slate-500/15"
              isMyTeam={top3[1].teamId === myTeamId}
            />
          )}

          {/* 1st Place - Gold Royal Mint */}
          {top3[0] && (
            <PodiumCard
              entry={top3[0]}
              rank={1}
              badge="ROYAL TREASURY"
              color="text-gold"
              borderColor="border-gold/40"
              glowColor="from-gold/20"
              isMyTeam={top3[0].teamId === myTeamId}
              isFirst
            />
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <PodiumCard
              entry={top3[2]}
              rank={3}
              badge="BRONZE VAULT"
              color="text-amber-600"
              borderColor="border-amber-700/30"
              glowColor="from-amber-700/15"
              isMyTeam={top3[2].teamId === myTeamId}
            />
          )}
        </div>
      )}

      {/* Search Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-dim" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search teams or team ID..."
            className="input !pl-10 !py-2 text-xs"
          />
        </div>
        <div className="label text-xs">
          SHOWING {filteredRows.length} OF {rows.length} CREWS
        </div>
      </div>

      {/* Leaderboard Glass Table */}
      <div className="panel overflow-hidden border border-white/[0.08] p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left">
            <thead>
              <tr className="label border-b border-white/[0.08] bg-white/[0.02]">
                <th className="px-5 py-3.5 font-semibold">Rank</th>
                <th className="px-5 py-3.5 font-semibold">Crew / Team</th>
                <th className="px-5 py-3.5 text-center font-semibold">Vulnerabilities Solved</th>
                <th className="px-5 py-3.5 text-right font-semibold">Total Loot / Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRows.map((r) => {
                const mine = r.teamId === myTeamId;
                const isTop = r.rank <= 3;
                return (
                  <tr
                    key={r.teamId}
                    id={mine ? "my-team" : undefined}
                    className={`transition-colors duration-150 ${
                      mine
                        ? "bg-red/15 font-semibold text-white shadow-[inset_0_0_12px_rgba(224,38,31,0.2)]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {r.rank === 1 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-gold border border-gold/40 text-xs font-bold font-mono">
                            #1
                          </span>
                        ) : r.rank === 2 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 text-xs font-bold font-mono">
                            #2
                          </span>
                        ) : r.rank === 3 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40 text-xs font-bold font-mono">
                            #3
                          </span>
                        ) : (
                          <span className="font-mono text-sm text-paper-dim">
                            #{r.rank}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Team Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-paper">{r.teamName}</span>
                        <span className="font-mono text-[10px] text-paper-dim/80">
                          ({r.teamId})
                        </span>
                        {mine && (
                          <span className="rounded border border-red/60 bg-red px-2 py-0.5 text-[10px] font-bold tracking-widest text-white shadow-[0_0_8px_rgba(224,38,31,0.5)]">
                            YOUR CREW
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Solved */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs text-paper-dim">
                        <CheckCircle2
                          className={`h-3.5 w-3.5 ${
                            r.solvedCount > 0 ? "text-emerald-400" : "text-paper-dim/40"
                          }`}
                        />
                        <span className="font-semibold text-paper">{r.solvedCount}</span>
                        <span>/ 6</span>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`display text-xl font-bold tracking-tight ${
                          isTop ? "text-gold" : mine ? "text-red-vibrant" : "text-white"
                        }`}
                      >
                        {r.score.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  rank,
  badge,
  color,
  borderColor,
  glowColor,
  isMyTeam,
  isFirst,
}: {
  entry: LeaderboardEntry;
  rank: number;
  badge: string;
  color: string;
  borderColor: string;
  glowColor: string;
  isMyTeam?: boolean;
  isFirst?: boolean;
}) {
  return (
    <div
      className={`panel relative overflow-hidden p-6 transition-transform duration-200 hover:-translate-y-1 ${
        isFirst ? "sm:-translate-y-2 border-gold/50 shadow-[0_12px_32px_rgba(229,181,79,0.18)]" : ""
      } ${borderColor} bg-gradient-to-b ${glowColor} via-ink-2/90 to-ink-2`}
    >
      <div className="flex items-center justify-between">
        <span className={`label text-[10px] tracking-[0.2em] ${color}`}>{badge}</span>
        <span className={`font-mono text-lg font-bold ${color}`}>#{rank}</span>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <span className="display text-xl font-bold text-white truncate">{entry.teamName}</span>
        </div>
        <div className="font-mono text-[11px] text-paper-dim">{entry.teamId}</div>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-white/[0.08] pt-3">
        <span className="text-xs text-paper-dim">{entry.solvedCount} solved</span>
        <span className={`display text-2xl font-extrabold ${color}`}>{entry.score} PTS</span>
      </div>

      {isMyTeam && (
        <div className="mt-2 text-center text-[10px] font-bold text-red-vibrant tracking-wider">
          ★ YOUR CREW ★
        </div>
      )}
    </div>
  );
}
