"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Target,
  BookOpen,
  Trophy,
  LogOut,
  Users,
  WifiOff,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRequireSession, useSignOut } from "@/lib/auth";
import { useLanOnline } from "@/lib/connection";
import { useLive } from "@/lib/hooks";
import { Countdown } from "./Countdown";
import { DaliMask } from "./DaliMask";
import { MockControls } from "./MockControls";
import { ServerDot } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/challenges", label: "Challenges", icon: Target },
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function Shell({ children }: { children: ReactNode }) {
  const ready = useRequireSession();
  const pathname = usePathname();
  const signOut = useSignOut();
  const online = useLanOnline();
  const status = useLive(() => api.getStatus(), [], 5000);
  const me = useLive(() => api.getParticipant(), [], 15000);

  if (!ready) return null;

  const server = !online ? "offline" : (status.data?.serverStatus ?? "connected");

  return (
    <div className="relative min-h-screen flex flex-col selection:bg-red selection:text-white">
      {/* Floating Translucent Top Command Bar */}
      <header className="sticky top-0 z-40 w-full glass-chrome border-b border-white/[0.08]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 py-2 border-b border-white/[0.06] text-xs">
            <div className="flex items-center gap-3">
              <ServerDot status={server} />
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-paper-dim/80 font-mono">
                <span className="text-red">●</span> THE ROYAL MINT COMMAND FREQUENCY
              </div>
            </div>

            <div className="flex items-center gap-4">
              {status.data ? (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px]">
                  <Clock className="h-3 w-3 text-red-vibrant" />
                  <span className="text-paper-dim">PHASE {status.data.phase}:</span>
                  <span className="text-white font-semibold">
                    <Countdown
                      to={status.data.endTime}
                      serverTime={status.data.serverTime}
                    />
                  </span>
                </div>
              ) : (
                <span className="label text-[10px] animate-pulse">SYNCHRONIZING ATOMIC CLOCK...</span>
              )}
            </div>
          </div>

          {/* Primary Header Row */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            {/* Brand Logo & Heist Identity */}
            <Link
              href="/dashboard"
              className="group flex items-center gap-3.5 transition-transform active:scale-[0.98]"
            >
              <DaliMask className="w-9 h-9" glow />
              <div>
                <div className="flex items-center gap-2">
                  <span className="display text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-red-vibrant transition-colors">
                    CODE<span className="text-red-vibrant">VERSE</span>
                  </span>
                  <span className="rounded border border-red/40 bg-red-950/40 px-1.5 py-0.2 text-[10px] font-mono font-bold text-red-vibrant">
                    2.0
                  </span>
                </div>
                <div className="label text-[10px] tracking-[0.2em] text-paper-dim/70 -mt-0.5">
                  THE ROYAL MINT // CLASSIFIED
                </div>
              </div>
            </Link>

            {/* Crew Identifier & Actions */}
            <div className="flex items-center gap-3">
              {me.data && (
                <div className="hidden md:flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs">
                  <Users className="h-3.5 w-3.5 text-gold" />
                  <span className="font-semibold text-paper">{me.data.teamName}</span>
                  <span className="font-mono text-[11px] text-paper-dim border-l border-white/10 pl-2">
                    {me.data.teamId}
                  </span>
                </div>
              )}

              <button
                onClick={signOut}
                className="btn btn-ghost !px-3.5 !py-1.5 text-xs gap-1.5 active:scale-95 transition-transform"
                title="Log out of command session"
              >
                <LogOut className="h-3.5 w-3.5 text-paper-dim" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>

          {/* Apple-style Segmented Navigation Control */}
          <div className="pb-3 pt-1">
            <nav
              aria-label="Primary"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-full border border-white/[0.08] bg-black/40 p-1 backdrop-blur-xl"
            >
              {NAV.map((n) => {
                const active = pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold tracking-wider transition-all duration-200 active:scale-95 ${
                      active
                        ? "bg-gradient-to-r from-red to-red-vibrant text-white shadow-[0_2px_12px_rgba(224,38,31,0.4)]"
                        : "text-paper-dim hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-paper-dim"}`} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {!online && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl border border-red/60 bg-red-950/60 p-4 text-xs tracking-wider text-white shadow-[0_4px_20px_rgba(224,38,31,0.3)] backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <span className="radar-beacon h-3 w-3 text-red-vibrant">
                <WifiOff className="h-4 w-4 text-red-vibrant" />
              </span>
              <div>
                <span className="font-bold text-red-vibrant">LAN LINK LOST:</span> Displaying cached
                intelligence. Automatic reconnect in progress...
              </div>
            </div>
            <span className="label text-[10px] text-paper-dim hidden sm:inline">
              RETRYING LAN DAEMON
            </span>
          </div>
        )}

        <main>{children}</main>
      </div>

      {/* Tactile Translucent Footer */}
      <footer className="mt-auto border-t border-white/[0.08] bg-black/30 backdrop-blur-lg py-6 text-xs text-paper-dim">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DaliMask className="w-5 h-5 opacity-80" />
            <span>
              CODEVERSE 2.0 · <span className="text-paper">THE ROYAL MINT</span> · DJS CodeAI
            </span>
          </div>
          <p className="text-[11px] text-paper-dim/80 text-center sm:text-right">
            Classified participant terminal. Submissions accepted solely via the official OBELISK
            CLI.
          </p>
        </div>
      </footer>

      <MockControls />
    </div>
  );
}
