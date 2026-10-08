"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { clearSession, getSession, saveSession } from "./session";

/** Thin auth layer. Swap `api.login` for the real backend; nothing else changes. */
export async function signIn(teamId: string, accessCode: string) {
  const session = await api.login(teamId, accessCode);
  saveSession(session);
}

export function useRequireSession() {
  const router = useRouter();
  const ready = useSyncExternalStore(
    () => () => {},
    () => getSession() !== null,
    () => false,
  );
  useEffect(() => {
    if (!getSession()) router.replace("/login");
  }, [router]);
  return ready;
}

export function useSignOut() {
  const router = useRouter();
  return useCallback(() => {
    clearSession();
    router.replace("/login");
  }, [router]);
}
