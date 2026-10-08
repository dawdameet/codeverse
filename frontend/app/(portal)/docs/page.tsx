import { PageTitle } from "@/components/ui";
import { config } from "@/lib/config";
import { CHALLENGES } from "@/lib/mock/data";

const SECTIONS = [
  ["about", "What is Codeverse?"],
  ["story", "Competition story"],
  ["phase-1", "Phase 1 — The Royal Mint"],
  ["phase-2", "Phase 2 — The Escape"],
  ["challenges", "Challenge overview"],
  ["rules", "Rules"],
  ["scoring", "Scoring"],
  ["submission", "Submission rules"],
  ["testing", "Local testing"],
  ["cli", "CLI submission"],
  ["event", "Event information"],
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
    <section id={id} className="prose-doc scroll-mt-6 border-b border-line py-8">
      <h2 className="display text-4xl">
        <span className="text-red">{"// "}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <>
      <PageTitle kicker="BRIEFING" title="Documentation" />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Documentation sections" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block whitespace-nowrap border-l-2 border-line px-3 py-1 text-xs tracking-wider text-paper-dim hover:border-red hover:text-paper"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 -mt-8">
          <Section id="about" title="What is Codeverse?">
            <p>
              CODEVERSE 2.0 is a software-engineering competition organised by
              DJS CodeAI. It is not a LeetCode-style contest. You are an
              engineer who has inherited a damaged production system, and you
              must read it, understand what it is meant to do, find what is
              wrong and repair it.
            </p>
            <p>The competition tests:</p>
            <ul>
              <li>debugging and reading unfamiliar code</li>
              <li>data structures and algorithms</li>
              <li>parsing and software engineering</li>
              <li>algorithmic complexity and optimisation</li>
              <li>reasoning under pressure</li>
            </ul>
            <p>
              <strong>This website is your command center.</strong> It shows
              the rules, the challenges, your phase, score, rank and the live
              leaderboard. You do not write or submit code here. All coding
              happens in the separate <span className="code">OBELISK</span>{" "}
              repository, which you receive separately.
            </p>
          </Section>

          <Section id="story" title="Competition story">
            <p>
              The crew has gained access to the Royal Mint&apos;s internal
              intelligence system: <strong>OBELISK</strong>, a command-line
              Search &amp; Intelligence Engine. It has been compromised. Several
              of its systems are malfunctioning. Repair it, then use it to get
              out.
            </p>
          </Section>

          <Section id="phase-1" title="Phase 1 — The Royal Mint">
            <p>
              Investigate and repair OBELISK. Phase 1 contains exactly six
              primary vulnerabilities, from <span className="code">OB-001</span>{" "}
              (beginner) to <span className="code">OB-006</span> (elite). Each
              is a separate fault in a different subsystem. The website tells
              you what is misbehaving; finding out why, and fixing it, is your
              job.
            </p>
          </Section>

          <Section id="phase-2" title="Phase 2 — The Escape">
            <p>
              The system is repaired, but the extraction begins and OBELISK
              must handle much larger workloads. Phase 2 focuses on performance,
              scalability, algorithmic complexity and optimisation. Its
              challenges are released when the phase opens; the dashboard shows
              whether it is upcoming, active or closed.
            </p>
            <p>
              A <strong>bonus challenge</strong> — an extension to OBELISK worth
              brownie points — will also be announced. Its status appears on
              the Challenges page.
            </p>
          </Section>

          <Section id="challenges" title="Challenge overview">
            <div className="my-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="label border-b border-line">
                  <tr>
                    <th className="py-2 font-normal">ID</th>
                    <th className="font-normal">Subsystem</th>
                    <th className="font-normal">Difficulty</th>
                    <th className="text-right font-normal">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {CHALLENGES.map((c) => (
                    <tr key={c.id} className="border-b border-line/50">
                      <td className="py-2 text-red">{c.id}</td>
                      <td>{c.name}</td>
                      <td>{c.difficulty}</td>
                      <td className="text-right">{c.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Challenge pages describe the expected behaviour and the observed
              behaviour. They never reveal the faulty line, the intended
              algorithm or a solution strategy.
            </p>
          </Section>

          <Section id="rules" title="Rules">
            <ul>
              <li>Work only inside your own copy of OBELISK.</li>
              <li>Fix the faults; do not tamper with the judging system, the CLI or the network.</li>
              <li>Do not share code or solutions with other teams.</li>
              <li>Judging decisions by the organisers are final.</li>
              <li>Core functionality works entirely on the event LAN — no internet is required.</li>
            </ul>
          </Section>

          <Section id="scoring" title="Scoring">
            <p>
              Each challenge has a fixed point value shown on its card. Points
              are awarded when the official judging system accepts your patch
              for that challenge. Your score, rank and the leaderboard come from
              the Codeverse server and refresh automatically.
            </p>
            <p>
              Total possible Phase 1 score:{" "}
              <strong>{CHALLENGES.reduce((n, c) => n + c.points, 0)}</strong>{" "}
              points.
            </p>
          </Section>

          <Section id="submission" title="Submission rules">
            <p>
              <strong>ONE BUG = ONE PATCH.</strong> Start from the official
              OBELISK base and make one commit per bug:
            </p>
            <pre>{`BASE
  └─ FIX[OB-001]: repair vault index
       └─ FIX[OB-002]: repair transaction lookup
            └─ FIX[OB-003]: repair query history`}</pre>
            <ul>
              <li>Each fix is submitted independently.</li>
              <li>A patch should address one challenge only.</li>
              <li>Submission happens through the CLI, never through this website.</li>
            </ul>
          </Section>

          <Section id="testing" title="Local testing">
            <p>
              Public tests are provided for local development and debugging.
              Official judging is performed using the Codeverse judging system.
            </p>
            <p>
              You may modify your local tests, but they have no authority over
              your official score. A green local run does not guarantee an
              accepted patch.
            </p>
          </Section>

          <Section id="cli" title="CLI submission">
            <p>
              The Codeverse CLI sends your committed fix to the judging server
              over the event LAN. Exact commands and credentials are provided
              with the CLI on event day; the flow is:
            </p>
            <pre>{`1. commit   git commit -m "FIX[OB-003]: repair query history"
2. submit   <codeverse CLI> submit OB-003
3. watch    score and rank update on this website`}</pre>
            <p>Command names above are illustrative and may differ in the released CLI.</p>
          </Section>

          <Section id="event" title="Event information">
            <ul>
              <li>Organiser: DJS CodeAI</li>
              <li>
                Server address:{" "}
                <span className="code">
                  {config.apiMode === "http" ? config.apiBaseUrl : "mock data (not connected)"}
                </span>
              </li>
              <li>Server status is shown in the top bar of every page.</li>
              <li>If the bar shows OFFLINE, check your LAN connection, then ask a volunteer.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
