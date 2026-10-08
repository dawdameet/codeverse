"use client";

import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  Activity,
  Terminal,
  Zap,
} from "lucide-react";
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
      <NoSignal message="Cannot reach the Codeverse server. Verify your LAN link." />
    ) : (
      <Loading />
    );
  }

  const p = me.data;
  const s = status.data;
  const active = phases.data.find((x) => x.id === s.phase)!;
  const totalPoints = challenges.data.reduce((n, c) => n + c.points, 0);
  const solved = challenges.data.filter((c) => c.status === "SOLVED");
  const server = !online ? "offline" : s.serverStatus;

  const top = (board.data ?? []).filter(
    (r) => r.rank <= 3 || Math.abs(r.rank - p.rank) <= 1,
  );

  return (
    <div className="space-y-8">
      {/* Tactical Hero Banner */}
      <div className="panel relative overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-red-950/40 via-ink-2/90 to-ink-2 border-white/[0.12] shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-red/15 blur-3xl" />
        
        <div className="flex flex-wrap items-start justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="radar-beacon h-2 w-2 text-red-vibrant">
                <span className="h-2 w-2 rounded-full bg-red-vibrant" />
              </span>
              <span className="label text-red tracking-[0.22em]">
                ACTIVE OPERATION // PHASE {active.id}
              </span>
            </div>
            <h1 className="display mt-2 text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
              {active.name}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-paper-dim max-w-2xl leading-relaxed">
              {active.tagline}
            </p>
          </div>

          {/* Crew Quick Card */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 backdrop-blur-xl min-w-[200px] text-right">
            <div className="label text-[10px] text-paper-dim/80">AUTHENTICATED CREW</div>
            <div className="display text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {p.teamName}
            </div>
            <div className="font-mono text-xs text-red-vibrant mt-0.5">{p.teamId}</div>
          </div>
        </div>
      </div>

      {/* 4-Stat Metric Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="VAULT LOOT SCORE"
          value={p.score}
          sub={`of ${totalPoints} available loot`}
          icon={<Trophy className="h-4 w-4 text-gold" />}
          accent
        />
        <Stat
          label="HEIST RANKING"
          value={
            <>
              #{p.rank}
              <span className="text-xl text-paper-dim font-normal font-sans">
                {" "}
                / {p.totalTeams}
              </span>
            </>
          }
          sub="Live competition position"
          icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
        />
        <Stat
          label="VULNERABILITIES CLEARED"
          value={`${p.solvedCount} / ${challenges.data.length}`}
          sub={`${challenges.data.length - p.solvedCount} vaults sealed`}
          icon={<CheckCircle2 className="h-4 w-4 text-red-vibrant" />}
        />
        <Stat
          label="PHASE COUNTDOWN"
          value={<Countdown to={s.endTime} serverTime={s.serverTime} />}
          sub={`until Phase ${s.phase} closes`}
          icon={<Clock className="h-4 w-4 text-amber-400" />}
        />
      </div>

      {/* Two-Column Operation Overview */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Vulnerabilities List (2 cols) */}
        <Panel className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-vibrant" />
                  <h2 className="display text-2xl font-bold text-white">System Vulnerabilities</h2>
                </div>
                <p className="text-xs text-paper-dim mt-0.5">
                  Subsystems requiring investigation and repair
                </p>
              </div>
              <Link
                href="/challenges"
                className="btn btn-ghost !px-3.5 !py-1 text-xs gap-1 font-mono tracking-wider"
              >
                <span>ALL CHALLENGES</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <ProgressBar done={solved.length} total={challenges.data.length} />

            <div className="mt-6 divide-y divide-white/[0.06]">
              {challenges.data.map((c) => (
                <Link
                  key={c.id}
                  href={`/challenges/${c.id}`}
                  className="group flex items-center justify-between gap-3 py-3.5 transition-all duration-150 hover:bg-white/[0.03] px-2 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-red-vibrant bg-red-950/60 border border-red/30 px-2 py-0.5 rounded">
                      {c.id}
                    </span>
                    <span className="font-medium text-sm text-paper group-hover:text-white transition-colors">
                      {c.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="hidden sm:inline font-mono text-xs font-semibold text-gold">
                      {c.points} PTS
                    </span>
                    <StatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-paper-dim/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        {/* Tactical Status & Rules (1 col) */}
        <div className="space-y-6">
          {/* Operation Status */}
          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-red-vibrant" />
              <h2 className="display text-xl font-bold text-white">Operation Telemetry</h2>
            </div>

            <dl className="space-y-3 text-xs tracking-wider">
              <Row
                k="EVENT STATUS"
                v={
                  <span className="font-mono font-bold text-emerald-400">
                    ● {s.status}
                  </span>
                }
              />
              <Row k="LAN LINK" v={<ServerDot status={server} />} />
              <Row
                k="COMMENCED"
                v={<span className="font-mono text-paper">{formatClock(s.startTime)}</span>}
              />
            </dl>

            <div className="mt-5 space-y-2.5 pt-4 border-t border-white/[0.08]">
              {phases.data.map((ph) => (
                <div
                  key={ph.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    ph.status === "ACTIVE"
                      ? "border-red/40 bg-red-950/30 shadow-[0_0_12px_rgba(224,38,31,0.2)]"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                >
                  <div>
                    <div className="label text-[10px]">PHASE {ph.id}</div>
                    <div className="display text-base font-bold text-white">{ph.name}</div>
                  </div>
                  <PhaseBadge status={ph.status} />
                </div>
              ))}
            </div>
          </Panel>

          {/* Operating Protocol */}
          <Panel>
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="h-4 w-4 text-gold" />
              <h2 className="display text-xl font-bold text-white">Heist Protocol</h2>
            </div>
            <ol className="space-y-2 text-xs font-mono text-paper-dim">
              <li className="flex items-start gap-2">
                <span className="text-red font-bold">1.</span>
                <span>INVESTIGATE in OBELISK local repository</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red font-bold">2.</span>
                <span>REPRODUCE &amp; TEST on your test suite</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red font-bold">3.</span>
                <span>COMMIT exactly one bug fix per patch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red font-bold">4.</span>
                <span>SUBMIT patch through Codeverse CLI</span>
              </li>
            </ol>
            <Link
              href="/docs#submission"
              className="mt-4 flex items-center justify-between text-xs font-mono font-bold text-red-vibrant hover:text-white transition-colors pt-3 border-t border-white/[0.08]"
            >
              <span>INSPECTION RULES</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        </div>
      </div>

      {/* Live Standings Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-gold" />
            <h2 className="display text-2xl font-bold text-white">Leaderboard Standings</h2>
          </div>
          <Link
            href="/leaderboard"
            className="btn btn-ghost !px-3.5 !py-1 text-xs gap-1 font-mono tracking-wider"
          >
            <span>FULL LEADERBOARD</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {board.data ? (
          <LeaderboardTable rows={top} myTeamId={p.teamId} showPodium={false} />
        ) : (
          <Loading what="SYNCHRONIZING STANDINGS TELEMETRY" />
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 font-mono text-xs">
      <dt className="text-paper-dim/80">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
