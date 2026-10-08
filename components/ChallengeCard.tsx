import Link from "next/link";
import type { Challenge } from "@/lib/types";
import { DifficultyTag, StatusBadge } from "./ui";

export function ChallengeCard({ c }: { c: Challenge }) {
  return (
    <Link
      href={`/challenges/${c.id}`}
      className={`panel group flex flex-col p-5 transition-colors hover:bg-ink-3 ${c.status === "SOLVED" ? "opacity-80" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="display text-3xl text-red">{c.id}</span>
        <StatusBadge status={c.status} />
      </div>
      <h3 className="display mt-3 text-2xl">{c.name}</h3>
      <div className="mt-1">
        <DifficultyTag level={c.difficulty} />
      </div>
      <p className="mt-3 flex-1 text-paper-dim">{c.summary}</p>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
        <span className="display text-xl">{c.points} POINTS</span>
        <span className="label group-hover:text-red">[ VIEW ]</span>
      </div>
    </Link>
  );
}
