# The six injected defects

Each bug lives in exactly **one** source file. `reference/src/obelisk/<file>` is the clean version;
`src/obelisk/<file>` is the participant version. `diff -r ORGANIZERS-ONLY/reference/src src` shows
exactly these six files (and nothing else). Bugs are independent: applying any one on top of the
reference fails only that bug's tests (`verify_bugs.py --isolate`).

Points are a proposal matching the website: 50 / 75 / 100 / 150 / 200 / 300 (total 875).

---

## OB-001 - Vault Index Integrity
- **Difficulty:** BEGINNER - **Points:** 50 - **Performance involved:** no
- **Subsystem:** document indexing
- **Intended behaviour:** every ingested document is present in the inverted index (`index.doc_ids`
  and its postings), searchable and counted by `NOT`.
- **Broken behaviour:** the last document of every 32-document segment is silently omitted. With the
  bundled 120 documents, DOC-0032, DOC-0064, DOC-0096 and DOC-0120 are missing
  (`obelisk index` prints `Documents: 120 / Indexed: 116`; searching `marker0032` finds nothing).
  `inspect` still works because it reads the document store, not the index.
- **Root cause:** off-by-one. Segments are walked with an *inclusive* end (`hi`), but the inner loop is
  `range(lo, hi)`, which excludes `hi`.
- **File / function:** `src/obelisk/indexer.py` - `build_index` (line `for i in range(lo, hi):`).
- **Expected fix:** `range(lo, hi + 1)` (or restructure with an exclusive end).
- **Public tests:** `VaultIndex.test_index_reports_every_document`,
  `VaultIndex.test_every_document_is_searchable_by_its_marker`,
  `IndexBuilder.test_all_documents_present_for_various_sizes`.
- **Private tests:** see `TEST-MAPPING.md` (`test_private_index`).
- **Regression risks:** changing `SEGMENT_SIZE` or the final-segment handling; empty input; sizes that are exact multiples of the segment size.

## OB-002 - Transaction Lookup
- **Difficulty:** EASY - **Points:** 75 - **Performance involved:** no
- **Subsystem:** transaction lookup
- **Intended behaviour:** every transaction ID in the sorted table is retrievable; absent IDs report not-found.
- **Broken behaviour:** the **last** (highest) transaction ID can never be found. In the bundled data
  `TX-11251` returns "not found". All other IDs and all genuinely missing IDs behave correctly.
- **Root cause:** the search keeps the invariant "answer lies in `[lo, hi)`" but initialises `hi` to
  `len(numbers) - 1` instead of `len(numbers)`, so the final element is never a candidate.
- **File / function:** `src/obelisk/transactions.py` - `TransactionTable._locate`
  (line `lo, hi = 0, len(numbers) - 1`).
- **Expected fix:** `hi = len(numbers)` (or convert to a consistent closed-interval search).
- **Public tests:** `TransactionLookup.test_first_and_last_transactions`,
  `TransactionLookup.test_every_transaction_is_retrievable`, `TableUnit.test_all_sizes`.
- **Private tests:** `test_private_transactions`.
- **Regression risks:** empty and one-element tables; IDs below the first / above the last; infinite loops if the loop condition is changed carelessly.

## OB-003 - Query History
- **Difficulty:** MEDIUM - **Points:** 100 - **Performance involved:** no
- **Subsystem:** query history / undo
- **Intended behaviour:** the history is a list with a cursor; a new query made after undo discards
  the undone queries, so later undo walks back through *existing* history only.
- **Broken behaviour:** `push` appends without discarding states beyond the cursor. After
  `search a, b, c` -> `undo` (b) -> `search d`, history is `[a, b, c, d]` and `undo` restores **c**,
  a state that had been undone, instead of b.
- **Root cause:** missing truncation `del self.states[self.cursor + 1:]` at the start of `push`.
- **File / function:** `src/obelisk/history.py` - `QueryHistory.push`.
- **Expected fix:** restore the truncation before appending.
- **Public tests:** `HistoryUnit.test_new_query_discards_undone_states`, `HistoryCli.test_undo_after_new_search`.
- **Private tests:** `test_private_history`.
- **Regression risks:** the `MAX_ENTRIES` cap (cursor must stay valid); undo at the beginning; redo semantics.

## OB-004 - Query Parser
- **Difficulty:** INTERMEDIATE - **Points:** 150 - **Performance involved:** no
- **Subsystem:** search expression parser (operator-stack to postfix to tree)
- **Intended behaviour:** documented precedence: parentheses > `NOT` > `AND` > `OR`.
- **Broken behaviour:** `NOT` is given *lower* precedence than `AND`, so `NOT a AND b` parses as
  `NOT (a AND b)`. `NOT (a OR b) AND c` and similar mixes are also wrong. Plain `AND`/`OR`,
  `a OR b AND c`, `a AND NOT b` and parenthesised groups without a leading `NOT` still work, so most
  queries look fine. Reproduce: `search "NOT vault AND security"` returns the complement of the
  intended result.
- **Root cause:** wrong precedence table: `{"OR": 1, "NOT": 2, "AND": 3}` instead of `{"OR": 1, "AND": 2, "NOT": 3}`.
- **File / function:** `src/obelisk/query_parser.py` - `_PRECEDENCE` (used by `_to_postfix`).
- **Expected fix:** restore the documented ordering.
- **Public tests:** `ParserTree.test_not_binds_tighter_than_and`, `ParserTree.test_nested_groups`,
  `ParserSemantics.test_not_leading`, `ParserSemantics.test_not_group`.
- **Private tests:** `test_private_parser`.
- **Regression risks:** implicit-AND insertion; left associativity; unary `NOT NOT x`.

## OB-005 - Query Cache
- **Difficulty:** HARD - **Points:** 200 - **Performance involved:** no
- **Subsystem:** query cache (LRU: hash map + doubly linked list)
- **Intended behaviour:** reading an entry makes it most recently used; eviction removes the least recently used.
- **Broken behaviour:** `get` records a hit but does not refresh recency, so the cache behaves like
  FIFO for reads. With `OBELISK_CACHE_SIZE=3`: `search a, b, c` -> `search a` (hit) -> `search d`
  evicts **a** instead of b. Overwrites via `put` still refresh recency, which hides the defect in light use.
- **Root cause:** `LRUCache.get` omits `self._touch(node)` on a hit.
- **File / function:** `src/obelisk/cache.py` - `LRUCache.get`.
- **Expected fix:** call `self._touch(node)` after counting the hit.
- **Public tests:** `CacheUnit.test_reading_refreshes_recency`, `CacheUnit.test_keys_are_ordered_most_recent_first`,
  `CacheUnit.test_repeated_access_pattern`, `CacheCli.test_recently_used_entry_survives_eviction`.
- **Private tests:** `test_private_cache`.
- **Regression risks:** capacity 1; sentinel pointers; persisted order (entries are stored most-recent first).

## OB-006 - Autocomplete at Scale
- **Difficulty:** ELITE - **Points:** 300 - **Performance involved:** **yes**
- **Subsystem:** autocomplete
- **Intended behaviour:** correct suggestions that stay fast as the vocabulary grows.
- **Broken behaviour:** results are identical to the reference (same checksum) but each query scans the
  entire vocabulary: O(V) per query. Official workload (100,000 terms, 500 queries): reference about
  0.01 s, participant version about 3 s.
- **Root cause:** `suggest` filters every entry with `startswith` and sorts the matches, with no
  ordered structure to jump to the prefix range.
- **File / function:** `src/obelisk/autocomplete.py` - `Autocomplete.__init__` / `suggest`.
- **Expected fix:** any structure giving sub-linear prefix lookup (sorted array + bisect, trie, ...)
  while preserving the ranking (frequency desc, term asc).
- **Public tests:** `AutocompleteScale.test_large_vocabulary_stays_fast`.
- **Private tests:** `test_private_performance` (threshold test; checksum test must keep passing).
- **Regression risks:** ranking ties; case-insensitive prefixes; empty-match prefixes; memory for large tries.
