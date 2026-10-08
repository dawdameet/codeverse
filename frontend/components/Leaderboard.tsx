import type { LeaderboardEntry } from "@/lib/types";

export function LeaderboardTable({
  rows,
  myTeamId,
  total = 6,
}: {
  rows: LeaderboardEntry[];
  myTeamId?: string;
  total?: number;
  showPodium?: boolean;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="label border-b border-line">
            <th className="px-3 py-3 font-normal sm:px-4">Rank</th>
            <th className="px-3 py-3 font-normal sm:px-4">Team</th>
            <th className="px-3 py-3 text-right font-normal sm:px-4">Solved</th>
            <th className="px-3 py-3 text-right font-normal sm:px-4">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = r.teamId === myTeamId;
            return (
              <tr
                key={r.teamId}
                id={mine ? "my-team" : undefined}
                className={`border-b border-line/60 last:border-0 ${mine ? "bg-red/15" : ""}`}
              >
                <td className="px-3 py-2.5 sm:px-4 font-mono font-semibold">
                  <span className={r.rank <= 3 ? "text-gold" : "text-paper-dim"}>{r.rank}</span>
                </td>
                <td className="px-3 py-2.5 sm:px-4">
                  <span className={mine ? "font-semibold text-white" : ""}>{r.teamName}</span>
                  {mine && <span className="ml-2 text-xs text-red-vibrant">you</span>}
                </td>
                <td className="px-3 py-2.5 sm:px-4 text-right text-paper-dim">
                  {r.solvedCount}/{total}
                </td>
                <td className="px-3 py-2.5 sm:px-4 text-right font-mono font-semibold text-white">{r.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
