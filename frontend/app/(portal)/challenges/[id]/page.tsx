"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ObeliskLocked } from "@/components/Locked";
import { CopyButton, DifficultyTag, Loading, NoSignal, Panel, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";
import { obeliskOpen } from "@/lib/phase";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const status = useLive(() => api.getStatus(), [], 5000);
  const me = useLive(() => api.getParticipant(), [], 5000);
  const open = obeliskOpen(status.data, me.data);
  const { data: c, error } = useLive(() => (open ? api.getChallenge(id) : Promise.resolve(null)), [id, open]);

  if (status.data && me.data && !open) return <ObeliskLocked />;
  if (!c) {
    if (error?.code === "NOT_FOUND")
      return (
        <div className="space-y-4">
          <NoSignal message={`There is no challenge ${id}.`} />
          <Link href="/challenges" className="text-sm text-paper-dim hover:text-white">
            ← All challenges
          </Link>
        </div>
      );
    return error ? <NoSignal message="Cannot reach the Codeverse server." /> : <Loading />;
  }

  const commit = `git commit -m "FIX[${c.id}]: describe your fix"`;
  const submit = `codeverse submit ${c.id}`;

  return (
    <article className="space-y-6">
      <Link href="/challenges" className="text-sm text-paper-dim hover:text-white">
        ← All challenges
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold text-red-vibrant">{c.id}</span>
            <DifficultyTag level={c.difficulty} />
            <StatusBadge status={c.status} />
          </div>
          <h1 className="display mt-2 text-3xl text-white sm:text-4xl">{c.name}</h1>
        </div>
        <div className="text-right">
          <div className="display text-4xl text-gold">{c.points}</div>
          <div className="label">points</div>
        </div>
      </header>

      <Panel>
        <h2 className="label mb-2">What is going on</h2>
        <p className="max-w-prose">{c.description}</p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="label mb-2 !text-ok">Expected</h2>
          <p className="text-paper-dim">{c.expectedBehavior}</p>
        </Panel>
        <Panel>
          <h2 className="label mb-2 !text-red-vibrant">Observed</h2>
          <p className="text-paper-dim">{c.observedBehavior}</p>
        </Panel>
      </div>

      <Panel>
        <h2 className="label mb-3">Submit your fix</h2>
        <div className="space-y-2 font-mono text-sm">
          {[commit, submit].map((cmd) => (
            <div key={cmd} className="flex items-center justify-between gap-3 rounded-lg bg-ink px-3 py-2">
              <code className="min-w-0 break-all">{cmd}</code>
              <CopyButton text={cmd} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-paper-dim">
          One bug per patch. You will see how many tests passed out of the total.{" "}
          <Link href="/docs#submission" className="text-red-vibrant hover:text-white">
            Rules →
          </Link>
        </p>
      </Panel>

      {c.relatedDocs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-paper-dim">Related:</span>
          {c.relatedDocs.map((d) => (
            <Link key={d.anchor} href={`/docs#${d.anchor}`} className="btn btn-ghost !px-3 !py-1 !text-xs">
              {d.label}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
