# Organizer architecture notes

- **Language / runtime:** Python 3.10+, standard library only (developed on 3.14). No third-party packages.
- **State:** JSON files under `.obelisk-state/` (override `OBELISK_HOME`). Writes are atomic (`os.replace`).
- **Determinism:** own LCG generators for synthetic data (`scripts/generate_sample_data.py`, `bench.py`);
  visible ordering is always sorted explicitly; no clock, no `random`, no hash-order dependence.
- **Cross-platform:** `pathlib` everywhere, UTF-8 explicit, `\n` newlines, ASCII-only console output,
  launchers for sh / cmd / python. No POSIX-only APIs.
- **Each bug is isolated to one module** with a narrow interface, which is why the bugs can be
  verified and graded independently:

| Module            | Bug     | Interface used by the rest of the system |
|-------------------|---------|------------------------------------------|
| `indexer.py`      | OB-001  | `build_index(docs) -> InvertedIndex`      |
| `transactions.py` | OB-002  | `TransactionTable.find/get`               |
| `history.py`      | OB-003  | `QueryHistory.push/undo/redo`             |
| `query_parser.py` | OB-004  | `parse`, `evaluate`, `canonical`          |
| `cache.py`        | OB-005  | `LRUCache.get/put/keys`                   |
| `autocomplete.py` | OB-006  | `Autocomplete.suggest`                    |

- **Test oracles are independent of the code under test** (brute-force set algebra from source files, a
  separate precedence-climbing parser, `OrderedDict` model for the cache, list+cursor model for history).
  Oracle tests that depend on the index use only the *indexed* documents, so OB-001 cannot leak into
  parser/search tests.
- **Participant tests may be edited**; authority lives in `private_tests/` and the judging server.
