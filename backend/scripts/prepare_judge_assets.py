"""Build ``judge_assets/`` from the OBELISK repository.

    python scripts/prepare_judge_assets.py [--obelisk ../OBELISK] [--out judge_assets]

Produces:
  base/              the participant release (everything except ORGANIZERS-ONLY)
  private_tests/     the organizer test-suite
  test_mapping.json  which tests belong to which bug
Re-run after any change to OBELISK. Nothing here is ever given to participants.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


def prepare(obelisk: Path, out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    ignore = shutil.ignore_patterns("__pycache__", ".obelisk-state", "ORGANIZERS-ONLY", ".git", "*.pyc")
    shutil.copytree(obelisk, out / "base", ignore=ignore)
    org = obelisk / "ORGANIZERS-ONLY"
    shutil.copytree(org / "private_tests", out / "private_tests", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy(org / "test_mapping.json", out / "test_mapping.json")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--obelisk", default=str(HERE.parent / "OBELISK"))
    p.add_argument("--out", default=str(HERE / "judge_assets"))
    a = p.parse_args()
    prepare(Path(a.obelisk).resolve(), Path(a.out).resolve())
    print("judge assets written to", a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
