# Release checklist

Work on a **copy** of the repository (or a fresh export); never delete in your working tree.

- [ ] Run `python ORGANIZERS-ONLY/verify_bugs.py` -> reference green, all six `FAILING AS INTENDED`
- [ ] Run `python ORGANIZERS-ONLY/verify_bugs.py --isolate` -> PASS (each bug independent)
- [ ] Remove `ORGANIZERS-ONLY/` (contains BUGS.md, reference/, private_tests/, verification scripts)
- [ ] Remove private tests (inside `ORGANIZERS-ONLY/private_tests/` - removed with the line above; confirm no `test_private_*` anywhere: `grep -r private .`)
- [ ] Remove the reference implementation (`ORGANIZERS-ONLY/reference/`)
- [ ] Verify `public_tests/` remain and `python scripts/run_tests.py` runs (expect 17 failures, all from the six bugs)
- [ ] Verify OBELISK launches: `python obelisk.py --version` -> `OBELISK v1.0.0`
- [ ] Verify all commands work: ingest, inspect, search, history, suggest, transaction, cache, logs, status, index, rebuild, bench
- [ ] Verify exactly six intended vulnerabilities exist (`verify_bugs.py --isolate` before deleting the directory)
- [ ] Verify no accidental vulnerabilities (no collateral failures in `verify_bugs.py`)
- [ ] Verify participant documentation does not reveal solutions: `grep -rniE "off-by-one|binary search|shunting|precedence table|hash map|doubly|trie|bisect|LRU" README.md docs/ src/ public_tests/` and read the hits
      (the docs deliberately state the *documented* LRU policy and operator precedence - that is allowed)
- [ ] Verify cross-platform launch instructions: run `python obelisk.py status` on Windows, macOS and Linux
- [ ] Verify sample data is present: `data/documents` (120 files), `data/transactions/transactions.csv`, `data/logs/ops.log`
- [ ] Verify the repository works without internet (disconnect and run the public tests)
- [ ] Verify the repository contains no organizer secrets (grep for hostnames, tokens, "ORGANIZER")
- [ ] Verify the repository contains no hidden tests (`find . -name "test_private*"` is empty)
- [ ] Delete `.obelisk-state/`, every `__pycache__/`, and any `.git` history that contains `ORGANIZERS-ONLY/` (export a fresh archive, e.g. `git archive`, from a commit that excludes it)
- [ ] Tag the base commit participants start from (the Codeverse CLI diffs against it)
