"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useRequireSession, useSignOut } from "@/lib/auth";
import { useLanOnline } from "@/lib/connection";
import { useLive } from "@/lib/hooks";
import { Countdown } from "./Countdown";
import { MockControls } from "./MockControls";
import { ServerDot } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/challenges", label: "Challenges" },
  { href: "/docs", label: "Documentation" },
  { href: "/leaderboard", label: "Leaderboard" },
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
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-2">
        <ServerDot status={server} />
        <span className="label">
          {status.data ? (
            <>
              PHASE {status.data.phase} ENDS IN{" "}
              <span className="text-paper">
                <Countdown
                  to={status.data.endTime}
                  serverTime={status.data.serverTime}
                />
              </span>
            </>
          ) : (
            <>SYNCING CLOCK</>
          )}
        </span>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4 py-5">
        <Link href="/dashboard" className="leading-none">
          <span className="display block text-3xl">
            CODE<span className="text-red">VERSE</span> 2.0
          </span>
          <span className="label">DJS CODEAI // CLASSIFIED</span>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          <span className="label hidden sm:inline">
            {me.data ? `${me.data.teamName} · ${me.data.teamId}` : ""}
          </span>
          <button className="btn btn-ghost !px-3 !py-1 text-xs" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="-mx-4 flex overflow-x-auto border-y border-line px-4 sm:mx-0 sm:px-0"
      >
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`display whitespace-nowrap px-4 py-3 text-lg tracking-widest ${active ? "bg-red text-paper" : "text-paper-dim hover:text-paper"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      {!online && (
        <div
          role="alert"
          className="mt-4 border border-red bg-red-dim/40 px-4 py-2 text-xs tracking-wider"
        >
          <span className="blink text-red">▲</span> LAN LINK LOST — displaying
          last known data. Retrying automatically.
        </div>
      )}

      <main className="flex-1 py-8">{children}</main>

      <footer className="border-t border-line py-4 text-[11px] text-paper-dim">
        CODEVERSE 2.0 · THE ROYAL MINT · Participant command center. Code and
        submissions live in the OBELISK repository and CLI — not here.
      </footer>
      <MockControls />
    </div>
  );
}

