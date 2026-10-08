import Link from "next/link";
import { ChevronRight, Coins } from "lucide-react";
import type { Challenge } from "@/lib/types";
import { DifficultyTag, StatusBadge } from "./ui";

export function ChallengeCard({ c }: { c: Challenge }) {
  const isSolved = c.status === "SOLVED";
  const inProgress = c.status === "IN_PROGRESS";

  return (
    <Link
      href={`/challenges/${c.id}`}
      className={`interactive-card group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
        isSolved
          ? "border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-ink-2/80 to-ink-2/90 shadow-[0_4px_20px_rgba(16,185,129,0.08)]"
          : inProgress
            ? "border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-ink-2/80 to-ink-2/90 shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
            : "border-white/[0.08] bg-gradient-to-b from-white/[0.04] via-ink-2/80 to-ink-2/90 hover:border-red/40"
      }`}
    >
      {/* Ambient status light bar at the top */}
      <div
        className={`absolute left-0 top-0 h-1 w-full ${
          isSolved
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
            : inProgress
              ? "bg-gradient-to-r from-amber-500 to-amber-400"
              : "bg-gradient-to-r from-red/60 via-red to-transparent opacity-60 group-hover:opacity-100 transition-opacity"
        }`}
      />

      {/* Top Header: ID & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-widest text-red-vibrant bg-red-950/50 border border-red/30 px-2 py-0.5 rounded">
            {c.id}
          </span>
          <DifficultyTag level={c.difficulty} />
        </div>
        <StatusBadge status={c.status} />
      </div>

      {/* Title */}
      <h3 className="display mt-4 text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-red-vibrant transition-colors">
        {c.name}
      </h3>

      {/* Summary Description */}
      <p className="mt-2.5 flex-1 text-xs sm:text-sm text-paper-dim leading-relaxed line-clamp-3">
        {c.summary}
      </p>

      {/* Bottom Footer: Points Bullion & Open Action */}
      <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <div className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
          <Coins className="h-3.5 w-3.5" />
          <span>{c.points} PTS</span>
        </div>

        <div className="flex items-center gap-1 text-xs font-mono font-semibold tracking-wider text-paper-dim group-hover:text-white transition-colors">
          <span>{isSolved ? "REVIEW DOSSIER" : "INVESTIGATE"}</span>
          <ChevronRight className="h-4 w-4 transform transition-transform group-hover:translate-x-1 text-red-vibrant" />
        </div>
      </div>
    </Link>
  );
}
