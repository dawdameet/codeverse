"use client";

import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function LeaderboardPage() {
  const board = useLive(() => api.getLeaderboard(), [], 5000);
  const me = useLive(() => api.getParticipant(), [], 5000);
  const status = useLive(() => api.getStatus(), [], 5000);
  const gamesRound = !!status.data && status.data.phase === 1 && status.data.status !== "ENDED";

  return (
    <div>
      <PageTitle
        title="Leaderboard"
        subtitle={
          !status.data
            ? "Updates every few seconds."
            : gamesRound
              ? "Phase 1 · games. Ranked by game points (faster, cleaner runs score more). Updates every few seconds."
              : "OBELISK round (Phase 2), with your Phase 1 games points alongside. Updates every few seconds. Time bonuses are added when the event ends."
        }
        right={
          me.data && (
            <a href="#my-team" className="btn btn-ghost !text-sm">
              Jump to my team (#{me.data.rank})
            </a>
          )
        }
      />
      {board.data && status.data ? (
        <LeaderboardTable
          rows={board.data}
          myTeamId={me.data?.teamId}
          total={6}
          mode={gamesRound ? "games" : "obelisk"}
          gamesCount={me.data?.gamesTotal ?? 5}
        />
      ) : board.error ? (
        <NoSignal message="Cannot reach the Codeverse server." />
      ) : (
        <Loading />
      )}
    </div>
  );
}
