"""Prefix suggestions over the indexed vocabulary.

Ranking: higher term frequency first, ties broken alphabetically.
"""

from __future__ import annotations

import heapq
from bisect import bisect_left


class Autocomplete:
    def __init__(self, entries: list[tuple[str, int]]) -> None:
        ordered = sorted(entries)
        self._terms = [term for term, _ in ordered]
        self._freq = [freq for _, freq in ordered]

    def __len__(self) -> int:
        return len(self._terms)

    def suggest(self, prefix: str, limit: int) -> list[tuple[str, int]]:
        prefix = prefix.lower()
        lo = bisect_left(self._terms, prefix)
        hi = bisect_left(self._terms, prefix + "\U0010ffff", lo)
        best = heapq.nsmallest(
            limit, ((-self._freq[i], self._terms[i]) for i in range(lo, hi))
        )
        return [(term, -neg) for neg, term in best]
