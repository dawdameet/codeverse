# ORGANIZERS ONLY - DO NOT DISTRIBUTE

Everything in this directory is for the organizers. It reveals every bug and its fix.
**Delete this whole directory before the repository is given to participants** (see
`RELEASE-CHECKLIST.md`).

| File / dir              | Purpose                                                        |
|-------------------------|----------------------------------------------------------------|
| `BUGS.md`               | the six injected defects: cause, files, fix, tests             |
| `ARCHITECTURE.md`       | internal design notes for organizers                           |
| `SOLUTIONS.md`         | step-by-step fix for every bug (repro, broken code, fix, why) |
| `REFERENCE-SOLUTION.md` | clean implementation and its recorded test results            |
| `TEST-MAPPING.md`       | which tests detect which bug (generated from `test_mapping.json`) |
| `PERFORMANCE.md`        | the ELITE (OB-006) benchmark specification                     |
| `RELEASE-CHECKLIST.md`  | steps before handing the repo to participants                  |
| `reference/src/`        | the known-good source tree (canonical expected behaviour)      |
| `private_tests/`        | private test-suite (also run against `reference/src`)          |
| `run_private_tests.py`  | `python ORGANIZERS-ONLY/run_private_tests.py [src-dir]`         |
| `verify_bugs.py`        | `python ORGANIZERS-ONLY/verify_bugs.py [--isolate\|--snapshot]` |
| `test_mapping.json`     | machine-readable bug -> tests mapping                          |

## Quick verification

```
python ORGANIZERS-ONLY/verify_bugs.py            # reference green; participant fails exactly the mapped tests
python ORGANIZERS-ONLY/verify_bugs.py --isolate  # each bug alone on top of the reference
```

Expected summary:

```
OB-001  FAILING AS INTENDED
OB-002  FAILING AS INTENDED
OB-003  FAILING AS INTENDED
OB-004  FAILING AS INTENDED
OB-005  FAILING AS INTENDED
OB-006  FAILING AS INTENDED
```

## Judging against a participant patch
Copy the participant's `src/` somewhere, then run
`python ORGANIZERS-ONLY/run_private_tests.py <their-src>` and
`OBELISK_SRC=<their-src> python scripts/run_tests.py` (public tests honour `OBELISK_SRC`).
`test_mapping.json` tells you which tests must turn green for a given challenge.
