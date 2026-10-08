# OB-006 performance specification

| Item                    | Value |
|-------------------------|-------|
| Benchmark command       | `python obelisk.py bench --vocab 100000 --queries 500 --seed 1337 --limit 10 --json` |
| Dataset                 | synthetic vocabulary generated in-process from the fixed seed (no files) |
| Vocabulary size         | 100,000 distinct terms, frequencies 1..1000 |
| Queries                 | 500 prefixes of length 3-5 taken from existing terms |
| Deterministic seed      | 1337 (own LCG, independent of Python's `random`) |
| Expected correct result | checksum `e87ef41f9c466ca6760e843d9d4299d9b952911713a9b4a9abc12ad3c594650b` |
| Metric                  | `query_seconds` from the JSON output (query phase only; build excluded) |
| Reference runtime       | about 0.007 s |
| Participant (buggy)     | about 3 s (linear scan per query) |
| **Pass threshold**      | `query_seconds < 0.5` and checksum equal, best of 3 runs |
| Warm-up                 | vocabulary is generated and the index built before the timer starts |
| Measured runs           | 3 (take the minimum, to discount scheduler noise) |
| Environment             | any modern laptop/desktop CPU, single thread, CPython 3.10+, nothing else heavy running |

The threshold is about 70x the reference and about 6x faster than the buggy version, so slow judging
hardware still separates the two cleanly. If the judging machine is much slower, scale the threshold
by measuring the reference on it first (`OBELISK_SRC=ORGANIZERS-ONLY/reference/src`) and keeping the
buggy time as the upper bound.

No `sleep` or artificial delay exists anywhere: the slowdown is a real O(V) scan per query.
Private test: `test_private_performance.py` (checksum, threshold, brute-force equivalence).
The public smoke check (`test_large_vocabulary_stays_fast`) uses the same workload with a 1.0 s limit.
