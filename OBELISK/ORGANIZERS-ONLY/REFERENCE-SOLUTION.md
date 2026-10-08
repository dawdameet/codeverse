# Reference solution

The clean, known-good implementation is `reference/src/obelisk/` (a full copy of the package before
the defects were injected, with the OB-002 search rewritten to the invariant form described in BUGS.md).
It is the canonical source of expected behaviour. Run it with:

```
OBELISK_SRC=ORGANIZERS-ONLY/reference/src python scripts/run_tests.py
python ORGANIZERS-ONLY/run_private_tests.py ORGANIZERS-ONLY/reference/src
```

## Subsystems (correct behaviour)
- **Indexer:** walks documents in ID order in 32-document segments with an inclusive segment end and
  `range(lo, hi + 1)`; every document ends up in `doc_ids` and the postings.
- **Transactions:** half-open search interval `[0, n)`; `lo` advances to the last element `<= target`;
  the answer is `numbers[lo] == target`.
- **History:** `push` truncates everything after the cursor, appends, moves the cursor; undo/redo move the cursor.
- **Parser:** operator stack to postfix to tree; precedence `OR 1 < AND 2 < NOT 3`; `NOT` is prefix and never pops;
  implicit `AND` inserted between adjacent operands.
- **Cache:** dict plus doubly linked list with sentinels; `get` and `put` both move the node to the front;
  eviction takes `tail.prev`.
- **Autocomplete:** sorted `(term, freq)` arrays; `bisect_left` finds the prefix range; `heapq.nsmallest`
  picks the top-k by `(-freq, term)`.

## Recorded clean-reference results (locked before injection)

| Suite                          | Result           |
|--------------------------------|------------------|
| public_tests (reference)       | 111 / 111 pass   |
| private_tests (reference)      | 37 / 37 pass     |
| Official benchmark checksum    | `e87ef41f9c466ca6760e843d9d4299d9b952911713a9b4a9abc12ad3c594650b` |
| Official benchmark query time  | about 0.007 s (100k terms, 500 queries) |

Re-verify at any time with `python ORGANIZERS-ONLY/verify_bugs.py` (first section).
