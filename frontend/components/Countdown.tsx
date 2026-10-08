"use client";

import { pad } from "@/lib/format";
import { useNow } from "@/lib/hooks";

/** HH:MM:SS until `to`, corrected for the backend's clock. */
export function Countdown({
  to,
  serverTime,
}: {
  to: string;
  serverTime: string;
  styled?: boolean;
}) {
  const now = useNow(serverTime);
  if (now === null) return <span className="tabular-nums text-paper-dim">--:--:--</span>;
  const total = Math.floor(Math.max(0, new Date(to).getTime() - now) / 1000);
  return (
    <span className="tabular-nums">
      {pad(Math.floor(total / 3600))}:{pad(Math.floor((total % 3600) / 60))}:{pad(total % 60)}
    </span>
  );
}
