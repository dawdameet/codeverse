"""Run the organizer suite: ``python ORGANIZERS-ONLY/run_private_tests.py [src-dir] [-v]``.

With no src-dir, tests run against the repository's own ``src/`` (the
participant version). Pass ``reference/src`` to run against the clean build.
"""

import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
args = [a for a in sys.argv[1:] if not a.startswith("-")]
if args:
    os.environ["OBELISK_SRC"] = str(Path(args[0]).resolve())
verbosity = 2 if "-v" in sys.argv else 1
os.chdir(HERE)
suite = unittest.defaultTestLoader.discover(str(HERE / "private_tests"), top_level_dir=str(HERE / "private_tests"))
sys.exit(0 if unittest.TextTestRunner(verbosity=verbosity).run(suite).wasSuccessful() else 1)
