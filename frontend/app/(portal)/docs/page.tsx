"use client";

import { useState } from "react";
import {
  BookOpen,
  Terminal,
  ShieldAlert,
  HelpCircle,
  FileText,
  ListOrdered,
  Award,
  GitBranch,
  Laptop,
  Radio,
} from "lucide-react";
import { CopyButton, DifficultyTag, PageTitle } from "@/components/ui";
import { config } from "@/lib/config";
import { CHALLENGES } from "@/lib/mock/data";

const SECTIONS = [
  { id: "about", label: "What is Codeverse?", icon: HelpCircle },
  { id: "story", label: "Competition Story", icon: BookOpen },
  { id: "phase-1", label: "Phase 1: The Infiltration", icon: FileText },
  { id: "phase-2", label: "Phase 2: The Royal Mint", icon: Radio },
  { id: "challenges", label: "Challenge Overview", icon: ListOrdered },
  { id: "rules", label: "Competition Rules", icon: ShieldAlert },
  { id: "scoring", label: "Scoring & Loot", icon: Award },
  { id: "submission", label: "Submission Rules", icon: GitBranch },
  { id: "testing", label: "Local Testing", icon: Laptop },
  { id: "cli", label: "CLI Workflow", icon: Terminal },
  { id: "event", label: "Event Telemetry", icon: Radio },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="prose-doc scroll-mt-28 border-b border-white/[0.08] py-10">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-xs font-bold text-red-vibrant bg-red-950/60 border border-red/40 px-2 py-0.5 rounded">
          {"// BRIEFING"}
        </span>
      </div>
      <h2 className="display text-3xl sm:text-4xl font-extrabold text-white mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("about");

  return (
    <div className="space-y-8">
      <PageTitle
        kicker="MISSION INTEL"
        title="Command Documentation"
        subtitle="Operational briefing, competition rules, and system protocols for CODEVERSE 2.0."
      />

      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        {/* Sticky Translucent Sidebar Navigation */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3 backdrop-blur-xl">
            <div className="label text-[10px] text-paper-dim/80 px-3 py-2 border-b border-white/[0.06] mb-2">
              NAVIGATION INDEX
            </div>
            <nav aria-label="Documentation sections">
              <ul className="flex gap-1 overflow-x-auto lg:flex-col no-scrollbar">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-red text-white font-semibold shadow-[0_2px_10px_rgba(224,38,31,0.4)]"
                            : "text-paper-dim hover:text-white hover:bg-white/[0.05]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{s.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Documentation Content Body */}
        <div className="min-w-0 -mt-10">
          <Section id="about" title="What is Codeverse?">
            <p>
              <strong>CODEVERSE 2.0</strong> is a premier software engineering and debugging
              competition organized by <strong>DJS CodeAI</strong>. It is not an abstract LeetCode
              puzzle contest. Instead, you and your crew step into the shoes of elite engineers
              inheriting a real-world, damaged production system.
            </p>
            <p>
              Your objective is to read unfamiliar architecture, formulate hypotheses, reproduce
              boundary defects, and repair the damaged subsystems under high pressure.
            </p>

            <div className="my-6 rounded-2xl border border-white/10 bg-gradient-to-r from-red-950/20 via-ink-2/80 to-ink-2 p-6">
              <div className="label text-[10px] text-red-vibrant mb-2">CORE SKILL MATRIX</div>
              <ul className="!my-0 grid gap-2 sm:grid-cols-2 text-xs font-mono">
                <li>Reading complex codebases</li>
                <li>Data structure integrity</li>
                <li>Algorithmic complexity &amp; scale</li>
                <li>Parser &amp; state machine recovery</li>
                <li>Edge-case diagnosis</li>
                <li>Execution under deadline pressure</li>
              </ul>
            </div>

            <p>
              <strong>This portal is your mission command center.</strong> Here you monitor the
              rules, challenge briefings, phase countdowns, your score, and the live competition
              leaderboard. You do not edit code directly here — all coding is conducted inside the{" "}
              <span className="code">OBELISK</span> repository.
            </p>
          </Section>

          <Section id="story" title="Competition Story">
            <p>
              The crew has breached the internal network of the Royal Mint. At the center of the
              compound sits <strong>OBELISK</strong>, a high-performance Search &amp; Intelligence
              Engine.
            </p>
            <p>
              A coordinated sabotage incident has corrupted multiple OBELISK subsystems. Vault
              ledgers are failing, query history is corrupting state, and search indexing is dropping
              records. To execute the plan and extract the prize, you must restore OBELISK to full
              operational fidelity.
            </p>
          </Section>

          <Section id="phase-1" title="Phase 1 — The Infiltration (games)">
            <p>
              Before anyone touches code, the crew has to get past the Mint&apos;s outer defences.
              Phase 1 is a set of five short games played in the browser, from easy to hard:
            </p>
            <ul>
              <li><strong>Crack the Safe</strong> (easy): deduce secret vault codes.</li>
              <li><strong>The Ledger Audit</strong> (medium): spot tampered entries in a table.</li>
              <li><strong>Guard Patrol</strong> (medium): plan a route past guards and lasers.</li>
              <li><strong>Logic Lockpick</strong> (intermediate): build circuits from logic gates.</li>
              <li><strong>Bug Hunt Terminal</strong> (hard): read code, predict its output, find the bug.</li>
            </ul>
            <p>
              Each game has a practice mode (random puzzles, not recorded) and <strong>one official run</strong>{" "}
              with the same puzzles for every team. Harder games count for more in your Phase 1 total
              (Easy ×1, Medium ×2, Intermediate ×3, Hard ×4).
            </p>
          </Section>

          <Section id="phase-2" title="Phase 2 — The Royal Mint (OBELISK)">
            <p>
              When the organizers open Phase 2, the OBELISK challenges are revealed. There are exactly
              six primary vulnerabilities, spanning from <span className="code">OB-001</span> (Beginner)
              to <span className="code">OB-006</span> (Elite). Each defect resides in an independent
              subsystem of OBELISK.
            </p>
            <p>
              The mission dossier highlights observed anomalies and intended behaviors. Isolating the
              root defect and crafting the surgical patch is the responsibility of your crew. Patches
              are submitted with the Codeverse CLI, and only while Phase 2 is open.
            </p>
          </Section>

          <Section id="challenges" title="Challenge Overview">
            <div className="my-6 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/40">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="label border-b border-white/[0.08] bg-white/[0.02]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">ID</th>
                    <th className="px-5 py-3 font-semibold">Subsystem Target</th>
                    <th className="px-5 py-3 font-semibold">Difficulty</th>
                    <th className="px-5 py-3 text-right font-semibold">Loot Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {CHALLENGES.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-red-vibrant">{c.id}</td>
                      <td className="px-5 py-3 font-medium text-white">{c.name}</td>
                      <td className="px-5 py-3">
                        <DifficultyTag level={c.difficulty} />
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gold">
                        {c.points} PTS
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Each dossier provides expected output contracts and reproduction notes without
              revealing internal algorithms or solutions.
            </p>
          </Section>

          <Section id="rules" title="Competition Rules">
            <div className="rounded-2xl border border-red/40 bg-red-950/20 p-6 my-4 space-y-3">
              <div className="flex items-center gap-2 text-red-vibrant font-bold text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>OFFICIAL ENGAGEMENT RULES:</span>
              </div>
              <ul className="!my-0 space-y-2 text-xs sm:text-sm text-paper-dim">
                <li>Operate exclusively inside your assigned OBELISK repository fork.</li>
                <li>Do not tamper with the judging server, scoring APIs, or local event LAN infrastructure.</li>
                <li>No cross-crew collaboration or leakage of solutions.</li>
                <li>Organizing committee and automated judging decisions are final.</li>
                <li>Core competition services operate 100% offline over the isolated event LAN.</li>
              </ul>
            </div>
          </Section>

          <Section id="scoring" title="Scoring &amp; Loot">
            <p>
              <strong>Phase 1 (games):</strong> every game awards points for correct play and a
              little for speed. Your games total is shown on the dashboard.
            </p>
            <p>
              <strong>Phase 2 (OBELISK):</strong> points are allocated per challenge according to
              difficulty. When your patch passes
              all verification suites on the official judging server, the points are credited to
              your crew immediately.
            </p>
            <p>
              <strong>Time bonus:</strong> teams that solve a challenge earlier earn extra points on
              top of its base value. The bonus is relative to every team that solved that challenge,
              so it is calculated once the event ends and added to the final leaderboard. Until then
              the leaderboard shows base points.
            </p>
            <p>
              Total Phase 2 Loot Bounty:{" "}
              <strong className="text-gold font-mono text-base">
                {CHALLENGES.reduce((n, c) => n + c.points, 0)} POINTS
              </strong>
            </p>
          </Section>

          <Section id="submission" title="Submission Protocol">
            <div className="rounded-2xl border border-white/10 bg-black/60 p-6 my-4">
              <div className="text-xs font-mono font-bold text-gold mb-2">
                THE PROFESSOR&apos;S GOLDEN RULE: ONE BUG = ONE PATCH
              </div>
              <p className="!my-0 text-xs text-paper-dim">
                Every patch must branch or sequentially build from the base with isolated commits:
              </p>
              <pre className="!my-4">{`BASE
  └─ FIX[OB-001]: repair vault index boundary
       └─ FIX[OB-002]: repair transaction lookup
            └─ FIX[OB-003]: restore query history stack`}</pre>
              <p className="!my-0 text-xs text-paper-dim">
                Never bundle fixes for multiple bugs into a single commit. You may fix the bugs in any
                order, but the commit message must name the bug it fixes, and a commit that repairs
                more than one bug is rejected. You only change files under{" "}
                <span className="code">src/obelisk/</span>; tests are never taken from your copy.
              </p>
            </div>
          </Section>

          <Section id="testing" title="Local Testing">
            <p>
              Public test harnesses are provided in the OBELISK repository for local sanity
              checking. You are encouraged to write your own regression tests.
            </p>
            <p>
              Note: Local test passing does not guarantee official acceptance. The server executes
              an expanded test suite under varied adversarial inputs.
            </p>
          </Section>

          <Section id="cli" title="CLI Workflow">
            <p>
              The Codeverse CLI sends your latest commit to the judging server and prints the
              result as <strong>PASSED / TOTAL</strong> tests. Run it from inside your OBELISK
              repository, after signing in once with <span className="code">codeverse login</span>.
            </p>
            <div className="rounded-xl border border-white/10 bg-black/80 p-4 my-4 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                <span>git commit -m &quot;FIX[OB-001]: repair vault index&quot;</span>
                <CopyButton text='git commit -m "FIX[OB-001]: repair vault index"' label="COPY" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>codeverse submit OB-001</span>
                <CopyButton text="codeverse submit OB-001" label="COPY" />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <span>codeverse status</span>
                <CopyButton text="codeverse status" label="COPY" />
              </div>
            </div>
          </Section>

          <Section id="event" title="Event Telemetry">
            <ul className="space-y-2 text-xs sm:text-sm text-paper-dim">
              <li>
                <strong className="text-white">Host:</strong> DJS CodeAI
              </li>
              <li>
                <strong className="text-white">API Gateway:</strong>{" "}
                <span className="code font-mono">
                  {config.apiMode === "http" ? config.apiBaseUrl || "this server" : "mock data (not connected)"}
                </span>
              </li>
              <li>
                <strong className="text-white">Server status:</strong> shown in the footer of every
                page.
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
