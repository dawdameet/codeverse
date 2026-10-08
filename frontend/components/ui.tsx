"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Lock,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type {
  ChallengeStatus,
  Difficulty,
  PhaseStatus,
  ServerStatus,
} from "@/lib/types";

export function Panel({
  children,
  className = "",
  tactical = true,
}: {
  children: ReactNode;
  className?: string;
  tactical?: boolean;
}) {
  return (
    <section
      className={`panel p-6 ${tactical ? "tactical-corners" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`panel relative overflow-hidden p-6 transition-all duration-300 ${
        accent
          ? "border-red/40 bg-gradient-to-b from-red/15 via-ink-2/80 to-ink-2 shadow-[0_12px_32px_-8px_rgba(224,38,31,0.25)]"
          : "hover:border-white/20"
      }`}
    >
      {accent && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red/20 blur-2xl" />
      )}
      <div className="flex items-center justify-between">
        <span className="label text-[10px] tracking-[0.2em]">{label}</span>
        {icon && <span className="text-paper-dim/60">{icon}</span>}
      </div>
      <div
        className={`display mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight ${
          accent ? "text-red-vibrant drop-shadow-[0_2px_12px_rgba(224,38,31,0.5)]" : "text-paper"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs font-medium text-paper-dim flex items-center gap-1.5">
          {sub}
        </div>
      )}
    </div>
  );
}

export function PageTitle({
  kicker,
  title,
  right,
  subtitle,
}: {
  kicker: string;
  title: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-red animate-pulse" />
          <span className="label text-red tracking-[0.22em]">{kicker}</span>
        </div>
        <h1 className="display mt-2 text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-paper-dim">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}

const DIFF_MAP: Record<Difficulty, { label: string; text: string; bg: string; dot: string }> = {
  BEGINNER: {
    label: "BEGINNER",
    text: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  EASY: {
    label: "EASY",
    text: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  MEDIUM: {
    label: "MEDIUM",
    text: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-500/30",
    dot: "bg-amber-400",
  },
  INTERMEDIATE: {
    label: "INTERMEDIATE",
    text: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-500/30",
    dot: "bg-amber-400",
  },
  HARD: {
    label: "HARD",
    text: "text-rose-400",
    bg: "bg-rose-950/40 border-rose-500/30",
    dot: "bg-rose-400",
  },
  ELITE: {
    label: "ELITE",
    text: "text-red-vibrant",
    bg: "bg-red-950/50 border-red/40",
    dot: "bg-red-vibrant animate-pulse",
  },
};

export function DifficultyTag({ level }: { level: Difficulty }) {
  const d = DIFF_MAP[level] ?? DIFF_MAP.BEGINNER;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] ${d.bg} ${d.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${d.dot}`} />
      {d.label}
    </span>
  );
}

const STATUS_MAP: Record<
  ChallengeStatus,
  { label: string; text: string; bg: string; icon: typeof Lock }
> = {
  NOT_STARTED: {
    label: "NOT STARTED",
    text: "text-paper-dim",
    bg: "border-white/10 bg-white/[0.04]",
    icon: Lock,
  },
  IN_PROGRESS: {
    label: "IN PROGRESS",
    text: "text-amber-400",
    bg: "border-amber-500/30 bg-amber-950/30",
    icon: Clock,
  },
  SOLVED: {
    label: "SOLVED",
    text: "text-emerald-400",
    bg: "border-emerald-500/40 bg-emerald-950/40",
    icon: CheckCircle2,
  },
};

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  const s = STATUS_MAP[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${s.bg} ${s.text}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {s.label}
    </span>
  );
}

export function PhaseBadge({ status }: { status: PhaseStatus }) {
  const isActive = status === "ACTIVE";
  const isDone = status === "COMPLETED";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-bold tracking-[0.18em] ${
        isActive
          ? "border-red/50 bg-red-950/50 text-red-vibrant shadow-[0_0_16px_rgba(224,38,31,0.35)]"
          : isDone
            ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
            : "border-white/10 bg-white/[0.04] text-paper-dim"
      }`}
    >
      {isActive && (
        <span className="radar-beacon h-2 w-2 text-red-vibrant">
          <span className="h-2 w-2 rounded-full bg-red-vibrant" />
        </span>
      )}
      {status}
    </span>
  );
}

export function ServerDot({ status }: { status: ServerStatus }) {
  const map = {
    connected: {
      color: "text-emerald-400",
      bg: "bg-emerald-400",
      text: "SYSTEM ONLINE",
      pulse: false,
    },
    degraded: {
      color: "text-amber-400",
      bg: "bg-amber-400",
      text: "LINK DEGRADED",
      pulse: true,
    },
    offline: {
      color: "text-red-vibrant",
      bg: "bg-red-vibrant",
      text: "SIGNAL LOST",
      pulse: true,
    },
  } as const;

  const current = map[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md">
      <span className={`radar-beacon h-2 w-2 ${current.color}`}>
        <span className={`h-2 w-2 rounded-full ${current.bg}`} />
      </span>
      <span className={`label text-[10px] tracking-[0.18em] ${current.color}`}>
        {current.text}
      </span>
    </div>
  );
}

export function NoSignal({ message }: { message: string }) {
  return (
    <Panel className="py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red/30 bg-red-950/40 text-red">
        <AlertCircle className="h-7 w-7" />
      </div>
      <div className="stamp mt-4 text-red text-xl border-red">NO SIGNAL // DISCONNECTED</div>
      <p className="label mt-4 text-paper-dim max-w-md mx-auto">{message}</p>
    </Panel>
  );
}

export function Loading({ what = "DECRYPTING OBELISK TELEMETRY" }: { what?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-4 h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-red/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-red" />
      </div>
      <p className="label text-paper-dim tracking-[0.2em]">
        {what}
        <span className="blink text-red">_</span>
      </p>
    </div>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5" aria-label={`${done} of ${total} resolved`}>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              i < done
                ? "bg-gradient-to-r from-red to-red-vibrant shadow-[0_0_8px_rgba(224,38,31,0.5)]"
                : "border border-white/10 bg-white/[0.04]"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-paper-dim/80">
        <span>SECURITY CLEARANCE</span>
        <span className="text-paper">{percent}% COMPLETED</span>
      </div>
    </div>
  );
}

export function CopyButton({
  text,
  label = "COPY COMMAND",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={onCopy}
      type="button"
      className="btn btn-ghost !px-3 !py-1 text-xs gap-1.5 active:scale-95 transition-transform"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400">COPIED ✓</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-paper-dim" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
