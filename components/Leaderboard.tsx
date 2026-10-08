import type { LeaderboardEntry } from "@/lib/types";

export function LeaderboardTable({
  rows,
  myTeamId,
}: {
  rows: LeaderboardEntry[];
  myTeamId?: string;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <thead>
          <tr className="label border-b border-line">
            <th className="px-4 py-3 font-normal">Rank</th>
            <th className="px-4 py-3 font-normal">Team</th>
            <th className="px-4 py-3 text-right font-normal">Solved</th>
            <th className="px-4 py-3 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = r.teamId === myTeamId;
            return (
              <tr
                key={r.teamId}
                id={mine ? "my-team" : undefined}
                className={`border-b border-line/50 ${mine ? "bg-red/20 font-bold" : ""}`}
              >
                <td className="display px-4 py-2 text-xl">
                  <span className={r.rank <= 3 ? "text-red" : ""}>#{r.rank}</span>
                </td>
                <td className="px-4 py-2">
                  {r.teamName}
                  {mine && <span className="ml-2 text-red">◄ YOUR TEAM</span>}
                </td>
                <td className="px-4 py-2 text-right">{r.solvedCount} / 6</td>
                <td className="display px-4 py-2 text-right text-xl">{r.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
