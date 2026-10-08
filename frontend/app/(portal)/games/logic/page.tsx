"use client";

import { GameFrame } from "@/components/games/GameFrame";
import { LogicGame } from "@/components/games/LogicGame";
import { byId } from "@/lib/games/registry";

export default function Page() {
  return <GameFrame meta={byId("logic")}>{(api) => <LogicGame api={api} />}</GameFrame>;
}
