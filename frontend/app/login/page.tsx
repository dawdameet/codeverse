"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, ShieldAlert, Sparkles, ArrowRight, Lock, Users } from "lucide-react";
import { DaliMask } from "@/components/DaliMask";
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

  const fillMock = () => {
    setTeamId(MOCK_TEAM.teamId);
    setCode(MOCK_TEAM.accessCode);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden selection:bg-red selection:text-white">
      {/* Cinematic Ambient Backdrop Lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] sm:w-[700px] rounded-full bg-red/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full bg-gold/10 blur-[100px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header with Dalí Emblem */}
        <div className="mb-8 text-center flex flex-col items-center">
          <DaliMask className="w-16 h-16 sm:w-20 sm:h-20 mb-3" glow />
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red animate-pulse" />
            <span className="label text-red tracking-[0.24em]">DJS CODEAI PRESENTS</span>
          </div>
          <h1 className="display mt-2 text-5xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-md">
            CODE<span className="text-red-vibrant">VERSE</span>
            <span className="ml-2 font-mono text-3xl font-bold text-paper-dim">2.0</span>
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="stamp text-red text-sm border-red/60 bg-red-950/20">
              THE ROYAL MINT
            </span>
            <span className="font-mono text-[10px] text-paper-dim/80 tracking-widest">
              OBELISK TERMINAL
            </span>
          </div>
        </div>

        {/* Frosted Glass Entry Card */}
        <div className="panel border-white/[0.12] p-8 sm:p-9 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 text-xs font-mono text-paper-dim">
              <Lock className="h-3.5 w-3.5 text-red-vibrant" />
              <span>SECURE ACCESS GATEWAY</span>
            </div>
            <span className="rounded-full bg-red-950/60 border border-red/40 px-2 py-0.5 text-[9px] font-mono font-bold text-red-vibrant">
              CLASSIFIED
            </span>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-mono tracking-wider text-paper-dim mb-1.5">
                CREW TEAM ID
              </label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-dim/60" />
                <input
                  className="input !pl-10"
                  placeholder="e.g. CV-007"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-wider text-paper-dim mb-1.5">
                ACCESS CIPHER CODE
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-dim/60" />
                <input
                  className="input !pl-10"
                  type="password"
                  placeholder="••••••••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red/60 bg-red-950/60 p-3 text-xs text-red-vibrant animate-in fade-in"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn w-full !py-3 text-sm font-bold tracking-widest"
              disabled={busy}
            >
              {busy ? (
                <span>DECRYPTING CREDENTIALS…</span>
              ) : (
                <>
                  <span>BREACH THE VAULT</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Mock Fill Pill */}
          {config.apiMode === "mock" && (
            <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
              <button
                type="button"
                onClick={fillMock}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-mono text-gold hover:bg-gold/20 active:scale-95 transition-all"
              >
                <Sparkles className="h-3 w-3" />
                <span>Auto-fill Demo Crew ({MOCK_TEAM.teamId})</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center font-mono text-[11px] text-paper-dim/60">
          AUTHORIZED CREW MEMBERS ONLY · DJS CODEAI
        </p>
      </div>

      <MockControls />
    </main>
  );
}
