import Link from "next/link";
import type { Challenge } from "@/lib/types";
import { DifficultyTag, StatusBadge } from "./ui";

export function ChallengeCard({ c }: { c: Challenge }) {
  return (
    <Link
      href={`/challenges/${c.id}`}
      className="panel interactive-card flex flex-col p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-red-vibrant">{c.id}</span>
        <StatusBadge status={c.status} />
      </div>
      <h3 className="display mt-3 text-xl text-white">{c.name}</h3>
      <div className="mt-1">
        <DifficultyTag level={c.difficulty} />
      </div>
      <p className="mt-3 flex-1 text-sm text-paper-dim">{c.summary}</p>
      <div className="mt-4 border-t border-line pt-3 text-sm font-semibold text-gold">
        {c.points} points
      </div>
    </Link>
  );
}
