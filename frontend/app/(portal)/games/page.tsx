"use client";

import Link from "next/link";
import { TierTag } from "@/components/games/GameFrame";
import { PageTitle, Panel } from "@/components/ui";
import { GAMES, TOTAL_SHARE } from "@/lib/games/registry";
import { resultShare, useGameResults } from "@/lib/games/storage";

export default function GamesHub() {
  const { results } = useGameResults();
  const total = GAMES.reduce((n, g) => n + (results[g.id] ? resultShare(g, results[g.id]!) : 0), 0);

  return (
    <div className="space-y-8">
      <PageTitle
        title="Games"
        subtitle="Phase 1 · The Infiltration. Five short games, easiest to hardest. Each has one official run; practise first with different puzzles."
        right={
          <div className="text-right">
            <div className="label">Your total</div>
            <div className="display text-3xl text-white">
              {total} <span className="text-lg text-paper-dim">/ {TOTAL_SHARE}</span>
            </div>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => {
          const r = results[g.id];
          return (
            <Link key={g.id} href={`/games/${g.id}`} className="panel interactive-card flex flex-col p-5">
              <div className="flex items-center justify-between">
                <TierTag tier={g.tier} />
                <span className="label">{g.minutes} min</span>
              </div>
              <h2 className="display mt-3 text-2xl text-white">{g.title}</h2>
              <p className="mt-2 flex-1 text-sm text-paper-dim">{g.tagline}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                {r ? (
                  <span className="font-semibold text-ok">
                    Done · {Math.round((100 * r.score) / r.max)}%
                  </span>
                ) : (
                  <span className="text-paper-dim">Not played · counts x{g.weight}</span>
                )}
                <span className="text-red-vibrant">{r ? "Review" : "Play"} →</span>
              </div>
            </Link>
          );
        })}
      </div>
      <Panel>
        <h2 className="display mb-2 text-lg text-white">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-paper-dim">
          <li>Your total weights each game by difficulty: Easy x1, Medium x2, Intermediate x3, Hard x4 (of the percentage you score).</li>
          <li>Practice runs use random puzzles and are never recorded.</li>
          <li>The official run uses the same puzzles for every team and can only be played once.</li>
          <li>The clock starts the moment you start. Leave this tab open until you see your result.</li>
        </ul>
      </Panel>
    </div>
  );
}
