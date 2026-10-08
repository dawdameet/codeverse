"use client";

import Link from "next/link";
import { LeaderboardTable } from "@/components/Leaderboard";
import { Countdown } from "@/components/Countdown";
import {
  Loading,
  NoSignal,
  Panel,
  PhaseBadge,
  ProgressBar,
  ServerDot,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useLanOnline } from "@/lib/connection";
import { useLive } from "@/lib/hooks";
import { formatClock } from "@/lib/format";

export default function Dashboard() {
  const me = useLive(() => api.getParticipant());
  const status = useLive(() => api.getStatus(), [], 5000);
  const phases = useLive(() => api.getPhases());
  const challenges = useLive(() => api.getChallenges());
  const board = useLive(() => api.getLeaderboard());
  const online = useLanOnline();

  if (!me.data || !status.data || !phases.data || !challenges.data) {
    return me.error || status.error ? (
      <NoSignal message="Cannot reach the Codeverse server. Check your LAN connection." />
    ) : (
      <Loading />
    );
  }

  const p = me.data;
  const s = status.data;
  const active = phases.data.find((x) => x.id === s.phase)!;
  const total = challenges.data.reduce((n, c) => n + c.points, 0);
  const solved = challenges.data.filter((c) => c.status === "SOLVED");
  const server = !online ? "offline" : s.serverStatus;

  const top = (board.data ?? []).filter(
    (r) => r.rank <= 3 || Math.abs(r.rank - p.rank) <= 1,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label text-red">
            PHASE {active.id} {"//"} {active.status}
          </div>
          <h1 className="display mt-1 text-5xl sm:text-7xl">{active.name}</h1>
          <p className="mt-2 text-paper-dim">{active.tagline}</p>
        </div>
        <div className="text-right">
          <div className="label">Team</div>
          <div className="display text-3xl">{p.teamName}</div>
          <div className="label">{p.teamId}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Score"
          value={p.score}
          sub={`of ${total} possible`}
          accent
        />
        <Stat
          label="Rank"
          value={
            <>
              #{p.rank}
              <span className="text-2xl text-paper-dim"> / {p.totalTeams}</span>
            </>
          }
          sub="live standing"
        />
        <Stat
          label="Progress"
          value={`${p.solvedCount} / ${challenges.data.length}`}
          sub={`${challenges.data.length - p.solvedCount} remaining`}
        />
        <Stat
          label="Phase timer"
          value={<Countdown to={s.endTime} serverTime={s.serverTime} />}
          sub={`until Phase ${s.phase} closes`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-2xl">Vulnerabilities</h2>
            <Link href="/challenges" className="label hover:text-red">
              [ ALL CHALLENGES ]
            </Link>
          </div>
          <ProgressBar done={solved.length} total={challenges.data.length} />
          <ul className="mt-4 divide-y divide-line/60">
            {challenges.data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/challenges/${c.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:text-red"
                >
                  <span>
                    <span className="display mr-3 text-lg text-red">{c.id}</span>
                    {c.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="hidden text-paper-dim sm:inline">
                      {c.points} PTS
                    </span>
                    <StatusBadge status={c.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="display mb-3 text-2xl">Operation status</h2>
            <dl className="space-y-3 text-xs tracking-wider">
              <Row k="EVENT" v={<span className="text-ok">● {s.status}</span>} />
              <Row k="SERVER" v={<ServerDot status={server} />} />
              <Row
                k="STARTED"
                v={<span>{formatClock(s.startTime)}</span>}
              />
            </dl>
            <div className="mt-5 space-y-2">
              {phases.data.map((ph) => (
                <div
                  key={ph.id}
                  className={`flex items-center justify-between border p-3 ${ph.status === "ACTIVE" ? "border-red" : "border-line"}`}
                >
                  <div>
                    <div className="label">PHASE {ph.id}</div>
                    <div className="display text-xl">{ph.name}</div>
                  </div>
                  <PhaseBadge status={ph.status} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="display mb-3 text-2xl">Operating procedure</h2>
            <ol className="space-y-1 text-xs tracking-wider text-paper-dim">
              <li>1. CODE in the OBELISK repository</li>
              <li>2. TEST locally</li>
              <li>3. COMMIT one fix per bug</li>
              <li>4. SUBMIT using the CLI</li>
            </ol>
            <Link href="/docs#submission" className="label mt-3 block hover:text-red">
              [ READ THE RULES ]
            </Link>
          </Panel>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl">Standings</h2>
          <Link href="/leaderboard" className="label hover:text-red">
            [ FULL LEADERBOARD ]
          </Link>
        </div>
        {board.data ? (
          <LeaderboardTable rows={top} myTeamId={p.teamId} />
        ) : (
          <Loading />
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line/50 pb-2">
      <dt className="text-paper-dim">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
