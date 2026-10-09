"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { DaliMask } from "@/components/DaliMask";
import { MockControls } from "@/components/MockControls";
import { ApiError } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { config } from "@/lib/config";
import { MOCK_TEAM } from "@/lib/mock/data";
import { getSession } from "@/lib/session";

const DQ_MESSAGE = "This team has been disqualified and can no longer sign in. Contact the organizers.";

export default function LoginPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // sent here by the portal when the server reports the team as disqualified
  const kickedOut = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("disqualified"),
    () => false,
  );

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(teamId, code);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "UNREACHABLE"
          ? "Cannot reach the Codeverse server. Check your network connection."
          : err instanceof ApiError && err.code === "DISQUALIFIED"
            ? DQ_MESSAGE
            : "Team ID or access code not recognised.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <DaliMask className="mb-4 h-16 w-16" />
          <h1 className="display text-5xl text-white">
            CODE<span className="text-red-vibrant">VERSE</span>{" "}
            <span className="text-3xl text-paper-dim">2.0</span>
          </h1>
          <p className="mt-2 text-paper-dim">The Royal Mint · DJS CodeAI</p>
        </div>

        <form onSubmit={onSubmit} className="panel space-y-4 p-6">
          <label className="block">
            <span className="label">Team ID</span>
            <input
              className="input mt-1.5"
              placeholder="CV-007"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </label>
          <label className="block">
            <span className="label">Access code</span>
            <input
              className="input mt-1.5"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {(error ?? (kickedOut ? DQ_MESSAGE : null)) && (
            <p role="alert" className="rounded-lg border border-red/50 bg-red-dim/30 px-3 py-2 text-sm">
              {error ?? DQ_MESSAGE}
            </p>
          )}
          <button type="submit" className="btn w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {config.apiMode === "mock" && (
            <button
              type="button"
              className="w-full text-sm text-paper-dim hover:text-white"
              onClick={() => {
                setTeamId(MOCK_TEAM.teamId);
                setCode(MOCK_TEAM.accessCode);
              }}
            >
              Fill demo credentials
            </button>
          )}
        </form>
      </div>
      <MockControls />
    </main>
  );
}
