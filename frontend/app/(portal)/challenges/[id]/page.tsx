"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Terminal,
  FileText,
  CheckCircle2,
} from "lucide-react";
import {
  CopyButton,
  DifficultyTag,
  Loading,
  NoSignal,
  Panel,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error } = useLive(() => api.getChallenge(id), [id]);

  if (!c) {
    if (error?.code === "NOT_FOUND")
      return (
        <div className="space-y-4">
          <NoSignal message={`No classified dossier matches vault ID ${id}.`} />
          <Link
            href="/challenges"
            className="btn btn-ghost !px-4 !py-2 text-xs gap-2 inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>RETURN TO CHALLENGES</span>
          </Link>
        </div>
      );
    return error ? (
      <NoSignal message="Cannot reach the Codeverse server." />
    ) : (
      <Loading />
    );
  }

  return (
    <article className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/challenges"
          className="group inline-flex items-center gap-2 font-mono text-xs text-paper-dim hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transform transition-transform group-hover:-translate-x-1 text-red-vibrant" />
          <span>RETURN TO OPERATION VAULTS</span>
        </Link>
      </div>

      {/* Challenge Dossier Header */}
      <div className="panel p-6 sm:p-8 bg-gradient-to-r from-red-950/30 via-ink-2/90 to-ink-2 border-white/[0.12]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold tracking-widest text-red-vibrant bg-red-950/70 border border-red/40 px-2.5 py-0.5 rounded-md">
                {c.id}
              </span>
              <DifficultyTag level={c.difficulty} />
              <StatusBadge status={c.status} />
            </div>

            <h1 className="display mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              {c.name}
            </h1>
          </div>

          {/* Points Bullion Badge */}
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-right backdrop-blur-xl min-w-[140px]">
            <div className="label text-[10px] text-gold">BOUNTY VALUE</div>
            <div className="display text-4xl font-extrabold text-gold mt-0.5">
              {c.points}
            </div>
            <div className="font-mono text-[10px] text-paper-dim/80">POINTS REWARD</div>
          </div>
        </div>
      </div>

      {/* Description Dossier */}
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-red-vibrant" />
          <h2 className="display text-xl font-bold text-white">Subsystem Overview</h2>
        </div>
        <p className="text-sm sm:text-base text-paper-dim leading-relaxed max-w-prose">
          {c.description}
        </p>
      </Panel>

      {/* Expected vs Observed Behavior */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Expected Behavior */}
        <div className="panel border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-ink-2/80 to-ink-2 p-6 shadow-[0_4px_24px_rgba(16,185,129,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="display text-xl font-bold text-emerald-400">Expected Specification</h2>
          </div>
          <p className="text-sm text-paper-dim leading-relaxed">{c.expectedBehavior}</p>
        </div>

        {/* Observed Behavior */}
        <div className="panel border-rose-500/30 bg-gradient-to-b from-rose-950/20 via-ink-2/80 to-ink-2 p-6 shadow-[0_4px_24px_rgba(244,63,94,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <h2 className="display text-xl font-bold text-rose-400">Observed Malfunction</h2>
          </div>
          <p className="text-sm text-paper-dim leading-relaxed">{c.observedBehavior}</p>
        </div>
      </div>

      {/* Submission Protocol Card with Instant Copy */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-4 w-4 text-gold" />
          <h2 className="display text-xl font-bold text-white">Repair &amp; Submission Protocol</h2>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-xs">
            <div className="text-[10px] text-paper-dim/80 mb-2 font-sans font-semibold">
              CLI SUBMISSION WORKFLOW:
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                <span className="text-paper">
                  <span className="text-red-vibrant">git</span> commit -m &quot;FIX[{c.id}]:
                  repair subsystem&quot;
                </span>
                <CopyButton
                  text={`git commit -m "FIX[${c.id}]: repair subsystem"`}
                  label="COPY"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-paper">
                  <span className="text-red-vibrant">codeverse</span> submit {c.id}
                </span>
                <CopyButton text={`codeverse submit ${c.id}`} label="COPY" />
              </div>
            </div>
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-xs sm:text-sm text-paper-dim leading-relaxed">
            <li>
              Diagnose and repair this fault in your local copy of the{" "}
              <strong className="text-white">OBELISK</strong> repository.
            </li>
            <li>Commit your patch following the <span className="code">FIX[{c.id}]</span> naming convention.</li>
            <li>Submit using the Codeverse CLI while connected to the event LAN.</li>
            <li>
              One patch = one bug. Public tests are for local verification; official judging runs
              on the central server.
            </li>
          </ol>
        </div>
      </Panel>

      {/* Relevant Documentation */}
      {c.relatedDocs.length > 0 && (
        <Panel>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-paper-dim" />
            <h2 className="display text-xl font-bold text-white">Relevant Intelligence Briefings</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {c.relatedDocs.map((d) => (
              <Link
                key={d.anchor}
                href={`/docs#${d.anchor}`}
                className="btn btn-ghost !px-4 !py-1.5 text-xs font-mono"
              >
                <span>{d.label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </article>
  );
}
