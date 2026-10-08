"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
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
        <div>
          <NoSignal message={`No file matches ${id}.`} />
          <Link href="/challenges" className="label mt-4 block hover:text-red">
            ← BACK TO CHALLENGES
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
    <article className="space-y-6">
      <Link href="/challenges" className="label hover:text-red">
        ← ALL CHALLENGES
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="display text-3xl text-red">{c.id}</div>
          <h1 className="display text-5xl sm:text-7xl">{c.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <DifficultyTag level={c.difficulty} />
            <StatusBadge status={c.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="label">Worth</div>
          <div className="display text-6xl text-red">{c.points}</div>
          <div className="label">POINTS</div>
        </div>
      </header>

      <Block title="Description">{c.description}</Block>

      <div className="grid gap-6 md:grid-cols-2">
        <Block title="Expected behavior" tone="ok">
          {c.expectedBehavior}
        </Block>
        <Block title="Observed behavior" tone="red">
          {c.observedBehavior}
        </Block>
      </div>

      <Panel>
        <h2 className="display text-2xl">Submission instructions</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-paper-dim">
          <li>
            Work in your local copy of the OBELISK repository, starting from
            the official base.
          </li>
          <li>Investigate, reproduce and repair this issue — and only this issue.</li>
          <li>
            Commit with a message starting <span className="code">FIX[{c.id}]</span>.
          </li>
          <li>Submit the commit using the Codeverse CLI while on the event LAN.</li>
        </ol>
        <p className="mt-3 text-xs text-paper-dim">
          ONE BUG = ONE PATCH. Public tests are for local debugging only;
          official judging happens on the Codeverse judging system.{" "}
          <Link href="/docs#submission" className="text-red underline">
            Full rules
          </Link>
        </p>
      </Panel>

      <Panel>
        <h2 className="display text-2xl">Relevant documentation</h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {c.relatedDocs.map((d) => (
            <li key={d.anchor}>
              <Link
                href={`/docs#${d.anchor}`}
                className="btn btn-ghost !px-3 !py-1 text-sm"
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </article>
  );
}

function Block({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "ok" | "red";
}) {
  return (
    <Panel>
      <h2
        className={`display text-2xl ${tone === "ok" ? "text-ok" : tone === "red" ? "text-red" : ""}`}
      >
        {title}
      </h2>
      <p className="mt-3 max-w-prose">{children}</p>
    </Panel>
  );
}
