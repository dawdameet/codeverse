"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MockControls } from "@/components/MockControls";
import { ApiError } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { config } from "@/lib/config";
import { MOCK_TEAM } from "@/lib/mock/data";
import { getSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          ? "NO SIGNAL — cannot reach the Codeverse server on the LAN."
          : "ACCESS DENIED — team ID or access code not recognised.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="label text-red">DJS CODEAI PRESENTS</div>
        <h1 className="display mt-2 text-7xl">
          CODE<span className="text-red">VERSE</span>
          <span className="block text-4xl text-paper-dim">2.0</span>
        </h1>
        <div className="mt-4">
          <span className="stamp text-red text-lg">The Royal Mint</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-5 p-6">
        <div className="label">{"// SECURE ENTRY — AUTHORISED CREW ONLY"}</div>
        <label className="block">
          <span className="label">Team ID</span>
          <input
            className="input mt-1"
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
            className="input mt-1"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="border border-red px-3 py-2 text-xs text-red">
            {error}
          </p>
        )}
        <button className="btn w-full text-lg" disabled={busy}>
          {busy ? "VERIFYING…" : "Enter the Mint"}
        </button>
      </form>

      {config.apiMode === "mock" && (
        <p className="label mt-4 text-center">
          MOCK MODE · demo team <span className="text-paper">{MOCK_TEAM.teamId}</span>{" "}
          · code <span className="text-paper">{MOCK_TEAM.accessCode}</span>
        </p>
      )}
      <MockControls />
    </main>
  );
}
