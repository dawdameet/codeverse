"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useRequireSession, useSignOut } from "@/lib/auth";
import { useLanOnline } from "@/lib/connection";
import { useLive } from "@/lib/hooks";
import { Countdown } from "./Countdown";
import { DaliMask } from "./DaliMask";
import { MockControls } from "./MockControls";
import { ServerDot } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <DaliMask className="h-8 w-8" />
            <span className="display hidden text-xl text-white sm:inline">
              CODE<span className="text-red-vibrant">VERSE</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-white/10 text-white" : "text-paper-dim hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-4 text-sm">
            {status.data && pathname !== "/dashboard" && (
              <span className="hidden items-baseline gap-2 sm:flex" title={`Phase ${status.data.phase} time remaining`}>
                <span className="font-mono text-base font-semibold text-white">
                  <Countdown to={status.data.endTime} serverTime={status.data.serverTime} />
                </span>
              </span>
            )}
            {me.data && (
              <span className="hidden text-paper-dim md:inline">
                <span className="font-semibold text-paper">{me.data.teamName}</span>
              </span>
            )}
            <button onClick={signOut} className="text-paper-dim transition-colors hover:text-white">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {status.data?.announcement && (
          <div role="status" className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold">
            {status.data.announcement}
          </div>
        )}
        {server !== "connected" && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red/50 bg-red-dim/30 px-4 py-2.5 text-sm"
          >
            {server === "offline" ? (
              <>Lost connection to the server. Showing the last known data; retrying automatically.</>
            ) : (
              <>The judging server is busy. Results may take longer than usual.</>
            )}
          </div>
        )}
        <main>{children}</main>
      </div>

      <footer className="border-t border-line py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 text-xs text-paper-dim sm:px-6">
          <span>CODEVERSE 2.0 · DJS CodeAI</span>
          <ServerDot status={server} />
        </div>
      </footer>
      <MockControls />
    </div>
  );
}
