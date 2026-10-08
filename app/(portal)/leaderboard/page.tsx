"use client";

import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function LeaderboardPage() {
  const board = useLive(() => api.getLeaderboard(), [], 5000);
  const me = useLive(() => api.getParticipant());

  return (
    <>
      <PageTitle
        kicker="LIVE STANDINGS"
        title="Leaderboard"
        right={
          me.data && (
            <a href="#my-team" className="btn btn-ghost text-sm">
              Jump to my team (#{me.data.rank})
            </a>
          )
        }
      />
      {board.data ? (
        <LeaderboardTable rows={board.data} myTeamId={me.data?.teamId} />
      ) : board.error ? (
        <NoSignal message="Cannot reach the Codeverse server." />
      ) : (
        <Loading />
      )}
      <p className="label mt-4">
        Updates automatically while the server is reachable
      </p>
    </>
  );
}
