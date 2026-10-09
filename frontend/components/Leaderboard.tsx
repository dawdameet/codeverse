import type { LeaderboardEntry } from "@/lib/types";

/**
 * `games`: Phase 1 board (ranked by game points). `obelisk`: Phase 2 board (ranked by OBELISK score),
 * with the Phase 1 games points shown next to it.
 */
export function LeaderboardTable({
  rows,
  myTeamId,
  total = 6,
  mode = "obelisk",
  gamesCount = 5,
}: {
  rows: LeaderboardEntry[];
  myTeamId?: string;
  total?: number;
  mode?: "games" | "obelisk";
  gamesCount?: number;
}) {
  const games = mode === "games";
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="label border-b border-line">
            <th className="px-3 py-3 font-normal sm:px-4">Rank</th>
            <th className="px-3 py-3 font-normal sm:px-4">Team</th>
            {!games && <th className="px-3 py-3 text-right font-normal sm:px-4">Solved</th>}
            {!games && <th className="px-3 py-3 text-right font-normal sm:px-4">Games pts</th>}
            {games && <th className="px-3 py-3 text-right font-normal sm:px-4">Games</th>}
            <th className="px-3 py-3 text-right font-normal sm:px-4">{games ? "Games points" : "OBELISK score"}</th>
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
                {!games && (
                  <td className="px-3 py-2.5 sm:px-4 text-right text-paper-dim">
                    {r.solvedCount}/{total}
                  </td>
                )}
                {!games && <td className="px-3 py-2.5 sm:px-4 text-right font-mono text-paper-dim">{r.gamesScore}</td>}
                {games && (
                  <td className="px-3 py-2.5 sm:px-4 text-right text-paper-dim">
                    {r.gamesPlayed}/{gamesCount}
                  </td>
                )}
                <td className="px-3 py-2.5 sm:px-4 text-right font-mono font-semibold text-white">
                  {games ? r.gamesScore : r.score}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
