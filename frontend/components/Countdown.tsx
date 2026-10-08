"use client";

import { formatDuration } from "@/lib/format";
import { useNow } from "@/lib/hooks";

/** HH:MM:SS until `to`, corrected for backend clock drift. */
export function Countdown({
  to,
  serverTime,
}: {
  to: string;
  serverTime: string;
}) {
  const now = useNow(serverTime);
  if (now === null) return <>--:--:--</>;
  return <>{formatDuration(new Date(to).getTime() - now)}</>;
}
