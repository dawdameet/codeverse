import Link from "next/link";
import { Panel } from "./ui";

export function ObeliskLocked() {
  return (
    <Panel className="py-12 text-center">
      <div className="label">Phase 2</div>
      <h2 className="display mt-2 text-3xl text-white">The Royal Mint opens after the games</h2>
      <p className="mx-auto mt-3 max-w-md text-paper-dim">
        The OBELISK debugging challenges are revealed when Phase 2 begins. Finish the games first - they come before the code.
      </p>
      <Link href="/games" className="btn mt-6">
        Go to the games
      </Link>
    </Panel>
  );
}
