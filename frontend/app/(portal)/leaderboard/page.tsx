"use client";

import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function LeaderboardPage() {
  const board = useLive(() => api.getLeaderboard(), [], 5000);
  const me = useLive(() => api.getParticipant());
  const challenges = useLive(() => api.getChallenges());

  return (
    <div>
      <PageTitle
        title="Leaderboard"
        subtitle="OBELISK round (Phase 2). Updates every few seconds. Time bonuses are added when the event ends."
        right={
          me.data && (
            <a href="#my-team" className="btn btn-ghost !text-sm">
              Jump to my team (#{me.data.rank})
            </a>
          )
        }
      />
      {board.data ? (
        <LeaderboardTable rows={board.data} myTeamId={me.data?.teamId} total={challenges.data?.length ?? 6} />
      ) : board.error ? (
        <NoSignal message="Cannot reach the Codeverse server." />
      ) : (
        <Loading />
      )}
    </div>
  );
}
