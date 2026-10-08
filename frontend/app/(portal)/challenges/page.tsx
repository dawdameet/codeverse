"use client";

import { ChallengeCard } from "@/components/ChallengeCard";
import { Loading, NoSignal, PageTitle, Panel, PhaseBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function ChallengesPage() {
  const challenges = useLive(() => api.getChallenges());
  const phases = useLive(() => api.getPhases());
  const bonus = useLive(() => api.getBonusChallenge());

  if (!challenges.data || !phases.data) {
    return challenges.error ? <NoSignal message="Cannot reach the Codeverse server." /> : <Loading />;
  }

  const [p1, p2] = phases.data;
  const solved = challenges.data.filter((c) => c.status === "SOLVED");
  const earned = solved.reduce((n, c) => n + c.points, 0);
  const total = challenges.data.reduce((n, c) => n + c.points, 0);

  return (
    <div className="space-y-8">
      <PageTitle
        title="Challenges"
        subtitle={`Phase 1 · ${p1.name} · ${solved.length}/${challenges.data.length} solved · ${earned}/${total} points`}
        right={<PhaseBadge status={p1.status} />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {challenges.data.map((c) => (
          <ChallengeCard key={c.id} c={c} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="display text-xl text-white">Phase 2 · {p2.name}</h2>
            <PhaseBadge status={p2.status} />
          </div>
          <p className="mt-2 text-sm text-paper-dim">
            {p2.tagline}{" "}
            {p2.status === "UPCOMING" ? "Details are released when the phase opens." : ""}
          </p>
        </Panel>
        {bonus.data && (
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="display text-xl text-white">Bonus · {bonus.data.name}</h2>
              <span className="text-xs font-semibold capitalize text-gold">{bonus.data.status.toLowerCase()}</span>
            </div>
            <p className="mt-2 text-sm text-paper-dim">{bonus.data.summary}</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
