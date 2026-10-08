"""Static validation and application of submitted patches (``git format-patch`` text)."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path, PurePosixPath

LABEL = re.compile(r"FIX\[(OB-\d{3})\]", re.IGNORECASE)
DIFF_LINE = re.compile(r"^diff --git (.+)$")


class PatchError(Exception):
    def __init__(self, reason: str, detail: str = "") -> None:
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason
        self.detail = detail


def _split_paths(rest: str) -> tuple[str, str]:
    if rest.startswith('"') or '"' in rest:
        raise PatchError("BAD_PATCH", "quoted paths are not supported")
    m = re.fullmatch(r"a/(.+) b/(.+)", rest)
    if not m:
        raise PatchError("BAD_PATCH", f"cannot parse diff header: {rest!r}")
    return m.group(1), m.group(2)


def fingerprint(text: str) -> tuple[str, int]:
    """Hash of the diff body only (not commit hash/author/date) and its number of changed lines."""
    import hashlib

    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if DIFF_LINE.match(l)), len(lines))
    body = [l.rstrip() for l in lines[start:] if not l.startswith(("index ", "--- ", "+++ "))]
    changed = sum(1 for l in body if l[:1] in "+-" and not l.startswith(("+++", "---")))
    return hashlib.sha256("\n".join(body).encode("utf-8", "replace")).hexdigest(), changed


def validate(text: str, claimed: str, allowed_prefix: str, max_bytes: int) -> list[str]:
    """Check label and touched paths. Returns the touched paths or raises PatchError."""
    if len(text.encode("utf-8", "replace")) > max_bytes:
        raise PatchError("BAD_PATCH", "patch too large")
    lines = text.splitlines()
    first = next((i for i, l in enumerate(lines) if DIFF_LINE.match(l)), None)
    if first is None:
        raise PatchError("BAD_PATCH", "no diff found")
    header = "\n".join(lines[:first])
    labels = {m.upper() for m in LABEL.findall(header)}
    if not labels:
        raise PatchError("LABEL_MISSING", "commit message must contain FIX[OB-00X]")
    if labels != {claimed.upper()}:
        raise PatchError("LABEL_MISMATCH", f"commit labelled {sorted(labels)} but submitted for {claimed}")

    paths: list[str] = []
    for line in lines[first:]:
        m = DIFF_LINE.match(line)
        if m:
            old, new = _split_paths(m.group(1))
            paths += [old, new]
        elif line.startswith(("GIT binary patch", "Binary files ")):
            raise PatchError("BAD_PATCH", "binary changes are not allowed")
        elif re.match(r"^(new|old|deleted) (file )?mode 120000", line):
            raise PatchError("BAD_PATCH", "symlinks are not allowed")
        elif line.startswith(("rename from ", "rename to ", "copy from ", "copy to ")):
            paths.append(line.split(" ", 2)[2])
    for p in paths:
        pp = PurePosixPath(p)
        if pp.is_absolute() or ".." in pp.parts or not p.startswith(allowed_prefix):
            raise PatchError("FORBIDDEN_PATH", p)
    return sorted(set(paths))


def apply(tree: Path, text: str) -> None:
    """Apply a patch inside ``tree`` (no git repository needed)."""
    env = dict(os.environ)
    env["GIT_CEILING_DIRECTORIES"] = str(tree.parent)  # never discover an outer repository
    proc = subprocess.run(
        ["git", "apply", "--whitespace=nowarn", "--ignore-whitespace", "--recount", "-p1", "-"],
        input=text.encode("utf-8"),
        cwd=str(tree),
        env=env,
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0:
        raise PatchError("DOES_NOT_APPLY", proc.stderr.decode("utf-8", "replace")[:300])
