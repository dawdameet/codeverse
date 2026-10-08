"use client";

import { GameFrame } from "@/components/games/GameFrame";
import { LedgerGame } from "@/components/games/LedgerGame";
import { byId } from "@/lib/games/registry";

export default function Page() {
  return <GameFrame meta={byId("ledger")}>{(api) => <LedgerGame api={api} />}</GameFrame>;
}
