"use client";

import { GameFrame } from "@/components/games/GameFrame";
import { PatrolGame } from "@/components/games/PatrolGame";
import { byId } from "@/lib/games/registry";

export default function Page() {
  return <GameFrame meta={byId("patrol")}>{(api) => <PatrolGame api={api} />}</GameFrame>;
}
