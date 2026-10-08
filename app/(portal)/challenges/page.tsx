"use client";

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

export default function ChallengesPage() {
  const challenges = useLive(() => api.getChallenges());
  const phases = useLive(() => api.getPhases());
  const bonus = useLive(() => api.getBonusChallenge());

  if (!challenges.data || !phases.data) {
    return challenges.error ? (
      <NoSignal message="Cannot reach the Codeverse server." />
    ) : (
      <Loading />
    );
  }

  const [p1, p2] = phases.data;
  const solved = challenges.data.filter((c) => c.status === "SOLVED").length;
  const earned = challenges.data
    .filter((c) => c.status === "SOLVED")
    .reduce((n, c) => n + c.points, 0);
  const total = challenges.data.reduce((n, c) => n + c.points, 0);

  return (
    <>
      <PageTitle
        kicker={`PHASE 1 // ${p1.name}`}
        title="Challenges"
        right={<PhaseBadge status={p1.status} />}
      />

      <Panel className="mb-6">
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs tracking-wider">
          <span>
            {solved} / {challenges.data.length} SOLVED
          </span>
          <span>
            {earned} / {total} POINTS
          </span>
        </div>
        <ProgressBar done={solved} total={challenges.data.length} />
      </Panel>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {challenges.data.map((c) => (
          <ChallengeCard key={c.id} c={c} />
        ))}
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Panel className="border-dashed">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label">PHASE 2</div>
              <h2 className="display text-3xl">{p2.name}</h2>
            </div>
            <PhaseBadge status={p2.status} />
          </div>
          <p className="mt-3 text-paper-dim">{p2.tagline}</p>
          <p className="label mt-4">
            {p2.status === "UPCOMING"
              ? "▒▒▒▒ FILES SEALED — RELEASED WHEN PHASE 2 OPENS ▒▒▒▒"
              : p2.status === "ACTIVE"
                ? "PHASE 2 IS LIVE — BRIEFING RELEASED BY THE ORGANISERS"
                : "PHASE 2 CLOSED"}
          </p>
        </Panel>

        {bonus.data && (
          <Panel className="border-dashed">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="label">BONUS // BROWNIE POINTS</div>
                <h2 className="display text-3xl">{bonus.data.name}</h2>
              </div>
              <span className="stamp text-amber text-sm">
                {bonus.data.status}
              </span>
            </div>
            <p className="mt-3 text-paper-dim">{bonus.data.summary}</p>
            <pre className="code mt-3 whitespace-pre-wrap">
              {bonus.data.example.join("\n")}
            </pre>
            <p className="label mt-3">+{bonus.data.points} BONUS POINTS</p>
          </Panel>
        )}
      </div>
    </>
  );
}
