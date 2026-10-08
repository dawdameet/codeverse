"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { ChallengeStatus, Difficulty, PhaseStatus, ServerStatus } from "@/lib/types";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
  tactical?: boolean;
}) {
  return <section className={`panel p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="panel p-5">
      <div className="label">{label}</div>
      <div className={`display mt-2 text-4xl sm:text-5xl ${accent ? "text-red-vibrant" : "text-paper"}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-sm text-paper-dim">{sub}</div>}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  right,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-3xl sm:text-4xl text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-paper-dim">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

const DIFF_COLOR: Record<Difficulty, string> = {
  BEGINNER: "text-ok",
  EASY: "text-ok",
  MEDIUM: "text-amber",
  INTERMEDIATE: "text-amber",
  HARD: "text-red-vibrant",
  ELITE: "text-red-vibrant",
};

export function DifficultyTag({ level }: { level: Difficulty }) {
  return (
    <span className={`label !tracking-[0.12em] ${DIFF_COLOR[level] ?? ""}`}>
      {level.charAt(0) + level.slice(1).toLowerCase()}
    </span>
  );
}

const STATUS: Record<ChallengeStatus, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not started", cls: "text-paper-dim border-line-strong" },
  IN_PROGRESS: { label: "In progress", cls: "text-amber border-amber/40" },
  SOLVED: { label: "Solved", cls: "text-ok border-ok/40" },
};

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function PhaseBadge({ status }: { status: PhaseStatus }) {
  const cls =
    status === "ACTIVE"
      ? "text-red-vibrant border-red/50"
      : status === "COMPLETED"
        ? "text-ok border-ok/40"
        : "text-paper-dim border-line-strong";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function ServerDot({ status }: { status: ServerStatus }) {
  const map = {
    connected: ["text-ok", "bg-ok", "Server online"],
    degraded: ["text-amber", "bg-amber", "Server busy"],
    offline: ["text-red-vibrant", "bg-red-vibrant", "Server offline"],
  } as const;
  const [text, dot, label] = map[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot} ${status === "connected" ? "" : "blink"}`} />
      {label}
    </span>
  );
}

export function NoSignal({ message }: { message: string }) {
  return (
    <Panel className="py-12 text-center">
      <div className="display text-2xl text-red-vibrant">No connection</div>
      <p className="mx-auto mt-2 max-w-md text-paper-dim">{message}</p>
    </Panel>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return (
    <p className="py-16 text-center text-paper-dim">
      {what}
      <span className="blink">…</span>
    </p>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${done} of ${total} solved`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-red" : "bg-white/10"}`} />
      ))}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost !px-2.5 !py-1 !text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
