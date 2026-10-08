# Solutions, one bug at a time

**ORGANIZERS ONLY.** Each section: how a participant would notice it, where it lives, the broken code, the fix,
why, and how to confirm. The clean source for every fix is `reference/src/obelisk/<file>`.

Set-up used by all repro commands (from the OBELISK root, on the participant version):

```
export OBELISK_HOME=/tmp/ob-demo          # PowerShell: $env:OBELISK_HOME="$env:TEMP\ob-demo"
python obelisk.py ingest
```

Suggested commit messages (also what the website tells participants to use): `FIX[OB-00X]: <what you repaired>`.

---

## OB-001 - Vault Index Integrity (BEGINNER, 50)

**Symptom**
```
python obelisk.py index          # Documents: 120   Indexed: 116
python obelisk.py search marker0032     # no results, although DOC-0032 exists
python obelisk.py inspect DOC-0032      # ...and inspect finds it
```
Four documents are missing: DOC-0032, DOC-0064, DOC-0096, DOC-0120 (the last of each 32-document segment).

**Where:** `src/obelisk/indexer.py`, `build_index`.

**Broken**
```python
hi = min(lo + SEGMENT_SIZE - 1, last)      # inclusive end of the segment
for i in range(lo, hi):                    # <- excludes hi
    index.add(docs[i])
lo = hi + 1
```
**Fix**
```python
for i in range(lo, hi + 1):
    index.add(docs[i])
```
**Why:** `hi` is an *inclusive* index but `range` is exclusive, so the final document of every segment is skipped
(and `lo = hi + 1` moves on, so it is never revisited).

**Confirm:** `python obelisk.py index` reports `Indexed: 120`; public tests `VaultIndex.*` and
`IndexBuilder.test_all_documents_present_for_various_sizes` pass.

---

## OB-002 - Transaction Lookup (EASY, 75)

**Symptom**
```
python obelisk.py transaction TX-11250   # works
python obelisk.py transaction TX-11251   # error: transaction not found (it is the last row of the CSV)
```
Only the highest ID is unreachable; missing IDs still correctly report not-found.

**Where:** `src/obelisk/transactions.py`, `TransactionTable._locate`.

**Broken**
```python
lo, hi = 0, len(numbers) - 1               # <- hi must be exclusive for this loop
while hi - lo > 1:
    mid = (lo + hi) // 2
    if numbers[mid] <= number: lo = mid
    else:                      hi = mid
if numbers and numbers[lo] == number: return lo
```
**Fix**
```python
lo, hi = 0, len(numbers)
```
**Why:** the loop keeps the invariant "if present, the answer is in `[lo, hi)`" - `hi` is exclusive. Starting at
`len - 1` removes the last element from the search range. (Equivalent fix: rewrite as a classic closed-interval
`while lo <= hi` search.)

**Confirm:** `transaction TX-11251` prints the record; `TransactionLookup.*` and `TableUnit.test_all_sizes` pass
(including 0-, 1- and 2-element tables).

---

## OB-003 - Query History (MEDIUM, 100)

**Symptom**
```
python obelisk.py search a --no-cache ; search b ; search c      # history: a, b, c
python obelisk.py history undo            # -> b   (correct)
python obelisk.py search d                # history should now be a, b, d
python obelisk.py history undo            # expected b, but returns c   <- an undone state came back
python obelisk.py history                 # shows a, b, c, d
```

**Where:** `src/obelisk/history.py`, `QueryHistory.push`.

**Broken**
```python
def push(self, query):
    self.states.append(query)              # <- keeps the states that were undone
    ...
    self.cursor = len(self.states) - 1
```
**Fix**
```python
def push(self, query):
    del self.states[self.cursor + 1:]      # discard anything after the cursor first
    self.states.append(query)
```
**Why:** history is a list plus a cursor. Running a new query while the cursor is not at the end must drop the
"redo" tail; otherwise undone queries stay in the list and later undo/redo walk through states that no longer
belong to the timeline.

**Confirm:** the sequence above yields `b` then `a`; `HistoryUnit.test_new_query_discards_undone_states` and
`HistoryCli.test_undo_after_new_search` pass.

---

## OB-004 - Query Parser (INTERMEDIATE, 150)

**Symptom** (documented precedence is parentheses > `NOT` > `AND` > `OR`)
```
python obelisk.py search "NOT vault AND security" --json     # should equal  (NOT vault) AND security
python obelisk.py search "NOT (vault OR treasury) AND audit"
```
The results are the complement of what they should be: it was parsed as `NOT (vault AND security)`.
Plain `AND`/`OR`, `a OR b AND c`, `a AND NOT b` and parenthesised groups without a leading `NOT` all work, which is
why it is easy to miss.

**Where:** `src/obelisk/query_parser.py`, the `_PRECEDENCE` table used by `_to_postfix` (operator-stack /
postfix conversion).

**Broken**
```python
_PRECEDENCE = {"OR": 1, "NOT": 2, "AND": 3}
```
**Fix**
```python
_PRECEDENCE = {"OR": 1, "AND": 2, "NOT": 3}
```
**Why:** when `AND` arrives, the pending `NOT` is only flushed to the output if its precedence is `>=` that of
`AND`. With `NOT` ranked below `AND` it stays on the stack and ends up applying to the whole `AND` expression.
The documented order must be the table order. (Debug aid: `canonical(parse(q))` prints the grouping.)

**Confirm:** `canonical(parse("NOT a AND b")) == "((NOT a) AND b)"`; `ParserTree.*`, `ParserSemantics.*` pass.

---

## OB-005 - Query Cache (HARD, 200)

**Symptom**
```
export OBELISK_CACHE_SIZE=3
search a ; search b ; search c      # cache holds c, b, a
search a                            # HIT - should refresh a
search d                            # evicts ... a (wrong; b is the least recently used)
python obelisk.py cache stats       # entries: d, c, b - 'a' disappeared although it was just used
search a                            # MISS
```

**Where:** `src/obelisk/cache.py`, `LRUCache.get`.

**Broken**
```python
self.hits += 1
return node.value                   # <- never marks the entry as most recently used
```
**Fix**
```python
self.hits += 1
self._touch(node)                   # unlink + push to the front of the list
return node.value
```
**Why:** the policy is least-recently-used, so a read must move the entry to the front. `put` already does this for
overwrites, which hides the defect under light use; with reads only the cache degenerates to first-in-first-out.
The persisted order (`cache.json`, most-recent first) shows the stale ordering.

**Confirm:** `CacheUnit.test_reading_refreshes_recency`, `...keys_are_ordered_most_recent_first`,
`...repeated_access_pattern`, `CacheCli.test_recently_used_entry_survives_eviction` pass.

---

## OB-006 - Autocomplete at Scale (ELITE, 300)

**Symptom**
```
python obelisk.py bench --json      # query_seconds ~3 s (reference ~0.007 s); checksum identical
python obelisk.py bench --vocab 200000 --queries 500 --json    # roughly doubles: grows with vocabulary size
```
Correct output, but each query touches every term in the vocabulary.

**Where:** `src/obelisk/autocomplete.py`, `Autocomplete.__init__` / `suggest`.

**Broken**
```python
self._entries = list(entries)
...
matches = [(t, f) for t, f in self._entries if t.startswith(prefix)]   # O(V) per query
matches.sort(key=lambda e: (-e[1], e[0]))
return matches[:limit]
```
**Fix (reference):** keep the vocabulary sorted and jump to the prefix range with binary search, then take the top
`limit` by `(-frequency, term)`.
```python
ordered = sorted(entries)
self._terms = [t for t, _ in ordered]
self._freq  = [f for _, f in ordered]
...
lo = bisect_left(self._terms, prefix)
hi = bisect_left(self._terms, prefix + "\U0010ffff", lo)
best = heapq.nsmallest(limit, ((-self._freq[i], self._terms[i]) for i in range(lo, hi)))
return [(t, -neg) for neg, t in best]
```
**Alternatives that also pass:** a trie with per-node top-k, or a trie walk plus heap. Anything with sub-linear
prefix lookup is fine as long as the ranking (frequency descending, then term ascending) and case-insensitive
prefix matching are preserved.

**Confirm:** `python obelisk.py bench --json` prints the same `checksum`
(`e87ef41f9c466ca6760e843d9d4299d9b952911713a9b4a9abc12ad3c594650b`) with `query_seconds` below 0.5 (threshold) -
normally ~0.01; `AutocompleteScale.test_large_vocabulary_stays_fast` passes.

---

## Applying all six at once (for your own checks)

```
cp -R ORGANIZERS-ONLY/reference/src/obelisk/* src/obelisk/      # makes the tree identical to the reference
python scripts/run_tests.py                                       # public: 111/111
```
Remember to restore the participant files afterwards (`git checkout -- src`), and note that
`reference/` carries a slightly different `transactions.py` docstring (the documented invariant) on purpose.
