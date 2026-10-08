"use client";

import { pad } from "@/lib/format";
import { useNow } from "@/lib/hooks";

/** HH:MM:SS countdown with Apple-grade tabular-digits typography and Money Heist tension. */
export function Countdown({
  to,
  serverTime,
  styled = false,
}: {
  to: string;
  serverTime: string;
  styled?: boolean;
}) {
  const now = useNow(serverTime);
  if (now === null) {
    return <span className="font-mono tracking-wider text-paper-dim">--:--:--</span>;
  }

  const diffMs = Math.max(0, new Date(to).getTime() - now);
  const total = Math.floor(diffMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (styled) {
    return (
      <div className="inline-flex items-center gap-1.5 font-mono">
        <div className="flex flex-col items-center">
          <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-2xl font-bold tracking-wider text-white backdrop-blur-md">
            {pad(h)}
          </span>
          <span className="mt-0.5 text-[9px] tracking-widest text-paper-dim">HRS</span>
        </div>
        <span className="text-xl font-bold text-red-vibrant animate-pulse pb-3">:</span>
        <div className="flex flex-col items-center">
          <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-2xl font-bold tracking-wider text-white backdrop-blur-md">
            {pad(m)}
          </span>
          <span className="mt-0.5 text-[9px] tracking-widest text-paper-dim">MIN</span>
        </div>
        <span className="text-xl font-bold text-red-vibrant animate-pulse pb-3">:</span>
        <div className="flex flex-col items-center">
          <span className="rounded-md border border-red/30 bg-red-950/40 px-2 py-1 text-2xl font-bold tracking-wider text-red-vibrant shadow-[0_0_12px_rgba(224,38,31,0.3)] backdrop-blur-md">
            {pad(s)}
          </span>
          <span className="mt-0.5 text-[9px] tracking-widest text-red-vibrant">SEC</span>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center font-mono font-bold tracking-wider">
      <span className="tabular-nums">{pad(h)}</span>
      <span className="text-red-vibrant mx-0.5 animate-pulse">:</span>
      <span className="tabular-nums">{pad(m)}</span>
      <span className="text-red-vibrant mx-0.5 animate-pulse">:</span>
      <span className="tabular-nums text-red-vibrant">{pad(s)}</span>
    </span>
  );
}
