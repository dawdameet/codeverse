"use client";

import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { TierTag } from "@/components/games/GameFrame";
import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, Panel, PhaseBadge, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { GAMES, TOTAL_SHARE } from "@/lib/games/registry";
import { resultShare, useGameResults } from "@/lib/games/storage";
import { useLive } from "@/lib/hooks";
import { obeliskOpen } from "@/lib/phase";
import type { Challenge, LeaderboardEntry, Phase } from "@/lib/types";

export default function Dashboard() {
  const me = useLive(() => api.getParticipant(), [], 5000);
  const status = useLive(() => api.getStatus(), [], 5000);
  const phases = useLive(() => api.getPhases(), [], 5000);
  const { results } = useGameResults();
  const open = obeliskOpen(status.data, me.data);
  const challenges = useLive(() => (open ? api.getChallenges() : Promise.resolve(null)), [open], 5000);
  const board = useLive(() => api.getLeaderboard(), [], 5000);

  if (!me.data || !status.data || !phases.data) {
    return me.error || status.error || phases.error ? (
      <NoSignal message="Cannot reach the Codeverse server. Check your network connection." />
    ) : (
      <Loading />
    );
  }

  const p = me.data;
  const s = status.data;
  const active = phases.data.find((x) => x.id === s.phase)!;
  const gamesDone = GAMES.filter((g) => results[g.id]).length;
  const gamesTotal = GAMES.reduce((n, g) => n + (results[g.id] ? resultShare(g, results[g.id]!) : 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label text-red-vibrant">
            Phase {active.id} · {active.id === 1 ? "Games" : "OBELISK"}
          </div>
          <h1 className="display mt-1 text-4xl text-white sm:text-5xl">{active.name}</h1>
          <p className="mt-2 text-paper-dim">{active.tagline}</p>
        </div>
        <div className="text-right">
          <div className="label">Time remaining</div>
          <div className="font-mono text-3xl font-semibold text-white">
            <Countdown to={s.endTime} serverTime={s.serverTime} />
          </div>
        </div>
      </div>

      {!open ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Games score" value={gamesTotal} sub={`of ${TOTAL_SHARE} (weighted)`} accent />
            <Stat label="Games played" value={`${gamesDone} / ${GAMES.length}`} sub={`${GAMES.length - gamesDone} to go`} />
            <Stat label="Team" value={<span className="text-3xl">{p.teamName}</span>} sub={p.teamId} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="display text-xl text-white">Phase 1 games</h2>
                <Link href="/games" className="text-sm text-paper-dim hover:text-white">
                  Open games →
                </Link>
              </div>
              <ProgressBar done={gamesDone} total={GAMES.length} />
              <div className="mt-3 divide-y divide-line">
                {GAMES.map((g) => {
                  const r = results[g.id];
                  return (
                    <Link key={g.id} href={`/games/${g.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-white">
                      <span className="flex min-w-0 items-center gap-3">
                        <TierTag tier={g.tier} />
                        <span className="truncate">{g.title}</span>
                      </span>
                      <span className={`shrink-0 text-sm ${r ? "font-semibold text-ok" : "text-paper-dim"}`}>
                        {r ? `${Math.round((100 * r.score) / r.max)}%` : `${g.minutes} min`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <h2 className="display mb-3 text-xl text-white">Phases</h2>
              <div className="space-y-3">
                {phases.data.map((ph) => (
                  <div key={ph.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{ph.name}</div>
                      <div className="text-xs text-paper-dim">Phase {ph.id} · {ph.id === 1 ? "games" : "OBELISK debugging"}</div>
                    </div>
                    <PhaseBadge status={ph.status} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-paper-dim">
                The OBELISK challenges are revealed when the organizers start Phase 2 ({gamesDone}/{GAMES.length} games done).
              </p>
            </Panel>
          </div>
        </>
      ) : (
        <ObeliskDashboard
          teamName={p.teamName}
          teamId={p.teamId}
          score={p.score}
          rank={p.rank}
          totalTeams={p.totalTeams}
          solved={p.solvedCount}
          challenges={challenges.data}
          board={board.data}
          gamesTotal={gamesTotal}
          phasesData={phases.data}
        />
      )}
    </div>
  );
}


function ObeliskDashboard(props: {
  teamName: string;
  teamId: string;
  score: number;
  rank: number;
  totalTeams: number;
  solved: number;
  challenges: Challenge[] | null;
  board: LeaderboardEntry[] | null;
  gamesTotal: number;
  phasesData: Phase[];
}) {
  const { score, rank, totalTeams, solved, challenges, board } = props;
  if (!challenges) return <Loading />;
  const total = challenges.reduce((n, c) => n + c.points, 0);
  const near = (board ?? []).filter((r) => r.rank <= 3 || Math.abs(r.rank - rank) <= 1);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="OBELISK score" value={score} sub={`of ${total} points`} accent />
        <Stat
          label="Rank"
          value={
            <>
              {rank}
              <span className="text-xl text-paper-dim"> / {totalTeams}</span>
            </>
          }
          sub={props.teamName}
        />
        <Stat label="Solved" value={`${solved} / ${challenges.length}`} sub={`${challenges.length - solved} remaining`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-xl text-white">OBELISK challenges</h2>
            <Link href="/challenges" className="text-sm text-paper-dim hover:text-white">
              View all →
            </Link>
          </div>
          <ProgressBar done={solved} total={challenges.length} />
          <div className="mt-3 divide-y divide-line">
            {challenges.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-white">
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-sm font-semibold text-red-vibrant">{c.id}</span>
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-sm text-paper-dim sm:inline">{c.points} pts</span>
                  <StatusBadge status={c.status} />
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="display mb-3 text-xl text-white">Phases</h2>
            <div className="space-y-3">
              {props.phasesData.map((ph) => (
                <div key={ph.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{ph.name}</div>
                    <div className="text-xs text-paper-dim">Phase {ph.id} · {ph.id === 1 ? "games" : "OBELISK debugging"}</div>
                  </div>
                  <PhaseBadge status={ph.status} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-paper-dim">
              Games score: <span className="font-semibold text-white">{props.gamesTotal}</span> / {TOTAL_SHARE}
            </p>
          </Panel>

          <Panel>
            <h2 className="display mb-3 text-xl text-white">How to submit</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-paper-dim">
              <li>Fix one bug in your OBELISK copy</li>
              <li>
                Commit it as <span className="code">FIX[OB-00X]</span>
              </li>
              <li>
                Run <span className="code">codeverse submit OB-00X</span>
              </li>
            </ol>
            <Link href="/docs#submission" className="mt-3 inline-block text-sm text-red-vibrant hover:text-white">
              Full rules →
            </Link>
          </Panel>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-xl text-white">Standings</h2>
          <Link href="/leaderboard" className="text-sm text-paper-dim hover:text-white">
            Full leaderboard →
          </Link>
        </div>
        {board ? <LeaderboardTable rows={near} myTeamId={props.teamId} total={challenges.length} /> : <Loading />}
      </section>
    </>
  );
}
