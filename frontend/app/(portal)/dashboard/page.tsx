"use client";

import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { LeaderboardTable } from "@/components/Leaderboard";
import { Loading, NoSignal, Panel, PhaseBadge, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function Dashboard() {
  const me = useLive(() => api.getParticipant());
  const status = useLive(() => api.getStatus(), [], 5000);
  const phases = useLive(() => api.getPhases());
  const challenges = useLive(() => api.getChallenges());
  const board = useLive(() => api.getLeaderboard());

  if (!me.data || !status.data || !phases.data || !challenges.data) {
    return me.error || status.error ? (
      <NoSignal message="Cannot reach the Codeverse server. Check your network connection." />
    ) : (
      <Loading />
    );
  }

  const p = me.data;
  const s = status.data;
  const active = phases.data.find((x) => x.id === s.phase)!;
  const list = challenges.data;
  const total = list.reduce((n, c) => n + c.points, 0);
  const near = (board.data ?? []).filter((r) => r.rank <= 3 || Math.abs(r.rank - p.rank) <= 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label text-red-vibrant">Phase {active.id}</div>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Score" value={p.score} sub={`of ${total} points`} accent />
        <Stat
          label="Rank"
          value={
            <>
              {p.rank}
              <span className="text-xl text-paper-dim"> / {p.totalTeams}</span>
            </>
          }
          sub={`${p.teamName}`}
        />
        <Stat label="Solved" value={`${p.solvedCount} / ${list.length}`} sub={`${list.length - p.solvedCount} remaining`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-xl text-white">Challenges</h2>
            <Link href="/challenges" className="text-sm text-paper-dim hover:text-white">
              View all →
            </Link>
          </div>
          <ProgressBar done={p.solvedCount} total={list.length} />
          <div className="mt-3 divide-y divide-line">
            {list.map((c) => (
              <Link
                key={c.id}
                href={`/challenges/${c.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-white"
              >
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
              {phases.data.map((ph) => (
                <div key={ph.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{ph.name}</div>
                    <div className="text-xs text-paper-dim">Phase {ph.id}</div>
                  </div>
                  <PhaseBadge status={ph.status} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="display mb-3 text-xl text-white">How to submit</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-paper-dim">
              <li>Fix one bug in your OBELISK copy</li>
              <li>Commit it as <span className="code">FIX[OB-00X]</span></li>
              <li>Run <span className="code">codeverse submit OB-00X</span></li>
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
        {board.data ? (
          <LeaderboardTable rows={near} myTeamId={p.teamId} total={list.length} />
        ) : (
          <Loading />
        )}
      </section>
    </div>
  );
}
