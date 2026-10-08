"use client";

import { GameFrame } from "@/components/games/GameFrame";
import { SafeGame } from "@/components/games/SafeGame";
import { byId } from "@/lib/games/registry";

export default function Page() {
  return <GameFrame meta={byId("safe")}>{(api) => <SafeGame api={api} />}</GameFrame>;
}
