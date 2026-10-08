import { useSyncExternalStore } from "react";

/** Tiny store tracking whether the last LAN request succeeded. */
let online = true;
const listeners = new Set<() => void>();

export function reportConnection(ok: boolean) {
  if (ok === online) return;
  online = ok;
  listeners.forEach((l) => l());
}

export function useLanOnline() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => online,
    () => true,
  );
}
