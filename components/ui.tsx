import type { ReactNode } from "react";
import type {
  ChallengeStatus,
  Difficulty,
  PhaseStatus,
  ServerStatus,
} from "@/lib/types";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel p-5 ${className}`}>{children}</section>;
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
}) {
  return (
    <Panel>
      <div className="label">{label}</div>
      <div
        className={`display mt-2 text-5xl sm:text-6xl ${accent ? "text-red" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-paper-dim">{sub}</div>}
    </Panel>
  );
}

export function PageTitle({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <div className="label text-red">{kicker}</div>
        <h1 className="display mt-1 text-4xl sm:text-6xl">{title}</h1>
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
  HARD: "text-red",
  ELITE: "text-red",
};

export function DifficultyTag({ level }: { level: Difficulty }) {
  return (
    <span className={`label !tracking-[0.2em] ${DIFF_COLOR[level]}`}>
      ■ {level}
    </span>
  );
}

const STATUS_STYLE: Record<ChallengeStatus, { text: string; cls: string }> = {
  NOT_STARTED: { text: "NOT STARTED", cls: "text-paper-dim border-line" },
  IN_PROGRESS: { text: "IN PROGRESS", cls: "text-amber border-amber" },
  SOLVED: { text: "SOLVED", cls: "text-ok border-ok" },
};

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[11px] tracking-[0.18em] ${s.cls}`}
    >
      {s.text}
    </span>
  );
}

export function PhaseBadge({ status }: { status: PhaseStatus }) {
  const cls =
    status === "ACTIVE"
      ? "text-red border-red"
      : status === "COMPLETED"
        ? "text-ok border-ok"
        : "text-paper-dim border-line";
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[11px] tracking-[0.18em] ${cls}`}
    >
      {status === "ACTIVE" && <span className="blink mr-1">●</span>}
      {status}
    </span>
  );
}

export function ServerDot({ status }: { status: ServerStatus }) {
  const map = {
    connected: ["text-ok", "SERVER CONNECTED"],
    degraded: ["text-amber", "SERVER DEGRADED"],
    offline: ["text-red", "SERVER OFFLINE"],
  } as const;
  const [cls, text] = map[status];
  return (
    <span className={`${cls} whitespace-nowrap text-[11px] tracking-[0.16em]`}>
      <span className={status === "connected" ? "" : "blink"}>●</span> {text}
    </span>
  );
}

export function NoSignal({ message }: { message: string }) {
  return (
    <Panel className="py-12 text-center">
      <div className="stamp text-red text-2xl">No signal</div>
      <p className="label mt-6">{message}</p>
    </Panel>
  );
}

export function Loading({ what = "DECRYPTING" }: { what?: string }) {
  return (
    <p className="label py-12 text-center">
      {what}
      <span className="blink">_</span>
    </p>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1" aria-label={`${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 ${i < done ? "bg-red" : "bg-ink-3 border border-line"}`}
        />
      ))}
    </div>
  );
}
