"use client";

import { GameFrame } from "@/components/games/GameFrame";
import { BugsGame } from "@/components/games/BugsGame";
import { byId } from "@/lib/games/registry";

export default function Page() {
  return <GameFrame meta={byId("bugs")}>{(api) => <BugsGame api={api} />}</GameFrame>;
}
