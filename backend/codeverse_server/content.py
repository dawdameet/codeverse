"""Challenge descriptions and point values (served to the website)."""

from __future__ import annotations

import json
from pathlib import Path


class Content:
    def __init__(self, path: Path) -> None:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        self.challenges: list[dict] = raw["challenges"]
        self.bonus: dict = raw["bonus"]
        self._by_id = {c["id"]: c for c in self.challenges}

    def ids(self) -> list[str]:
        return [c["id"] for c in self.challenges]

    def get(self, challenge_id: str) -> dict | None:
        return self._by_id.get(challenge_id.upper())

    def points(self, challenge_id: str) -> int:
        return int(self._by_id[challenge_id]["points"])

    def total_points(self) -> int:
        return sum(int(c["points"]) for c in self.challenges)
