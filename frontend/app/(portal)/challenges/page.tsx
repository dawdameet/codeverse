"use client";

import { ChallengeCard } from "@/components/ChallengeCard";
import { ObeliskLocked } from "@/components/Locked";
import { Loading, NoSignal, PageTitle, PhaseBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";
import { obeliskOpen } from "@/lib/phase";

export default function ChallengesPage() {
  const status = useLive(() => api.getStatus(), [], 5000);
  const me = useLive(() => api.getParticipant(), [], 5000);
  const open = obeliskOpen(status.data, me.data);
  const challenges = useLive(() => (open ? api.getChallenges() : Promise.resolve(null)), [open]);
  const phases = useLive(() => api.getPhases());

  if (!status.data || !phases.data || !me.data) {
    return status.error || me.error || phases.error ? <NoSignal message="Cannot reach the Codeverse server." /> : <Loading />;
  }
  if (!open) {
    return (
      <>
        <PageTitle title="OBELISK" subtitle={`Phase 2 · locked · games finished ${me.data.gamesPlayed}/${me.data.gamesTotal}`} />
        <ObeliskLocked />
      </>
    );
  }
  if (!challenges.data) return challenges.error ? <NoSignal message="Cannot reach the Codeverse server." /> : <Loading />;

  const p2 = phases.data[1];
  const solved = challenges.data.filter((c) => c.status === "SOLVED");
  const earned = solved.reduce((n, c) => n + c.points, 0);
  const total = challenges.data.reduce((n, c) => n + c.points, 0);

  return (
    <div className="space-y-8">
      <PageTitle
        title="OBELISK challenges"
        subtitle={`Phase 2 · ${p2.name} · ${solved.length}/${challenges.data.length} solved · ${earned}/${total} points`}
        right={<PhaseBadge status={p2.status} />}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {challenges.data.map((c) => (
          <ChallengeCard key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}
