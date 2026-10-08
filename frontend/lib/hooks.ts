"use client";

import { useEffect, useState } from "react";
import { reportConnection } from "./connection";
import { config } from "./config";
import { MOCK_EVENT } from "./mock/state";
import { ApiError } from "./api";

export interface Live<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Fetch + poll. Keeps the last good data when a refresh fails, so the UI can
 * show stale values with an offline banner instead of going blank.
 */
export function useLive<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs: number = config.pollIntervalMs,
): Live<T> {
  const [state, setState] = useState<Live<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      fetcher()
        .then((data) => {
          if (cancelled) return;
          reportConnection(true);
          setState({ data, error: null, loading: false });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const err =
            e instanceof ApiError ? e : new ApiError("SERVER_ERROR", String(e));
          if (err.code === "UNREACHABLE") reportConnection(false);
          setState((s) => ({ data: s.data, error: err, loading: false }));
        });
    run();
    const timer = setInterval(run, intervalMs);
    window.addEventListener(MOCK_EVENT, run);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(MOCK_EVENT, run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return state;
}

/** Ticking clock, corrected to the backend's clock (given as a sample ISO time). */
export function useNow(serverTime?: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const offsetMs = serverTime
      ? Math.round((new Date(serverTime).getTime() - Date.now()) / 1000) * 1000
      : 0;
    const tick = () => setNow(Date.now() + offsetMs);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [serverTime]);
  return now;
}
