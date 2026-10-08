"""Runtime configuration, overridable through CODEVERSE_* environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _env(name: str, default: str) -> str:
    return os.environ.get(f"CODEVERSE_{name}", default)


@dataclass
class Config:
    data_dir: Path = field(default_factory=lambda: Path(_env("DATA", str(BACKEND_DIR / "data"))))
    assets_dir: Path = field(default_factory=lambda: Path(_env("ASSETS", str(BACKEND_DIR / "judge_assets"))))
    content_file: Path = field(default_factory=lambda: BACKEND_DIR / "content" / "challenges.json")
    host: str = field(default_factory=lambda: _env("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(_env("PORT", "8080")))
    workers: int = field(default_factory=lambda: int(_env("WORKERS", "2")))
    max_bonus: float = field(default_factory=lambda: float(_env("MAX_BONUS", "0.5")))
    cooldown_seconds: float = field(default_factory=lambda: float(_env("COOLDOWN", "15")))
    max_patch_bytes: int = 200_000
    suite_timeout_seconds: int = 180
    allowed_prefix: str = "src/obelisk/"
    # Challenges whose timing is measured: they run with the machine to themselves.
    exclusive_challenges: tuple[str, ...] = ("OB-006",)
    keep_failed_jobs: bool = False

    @property
    def db_path(self) -> Path:
        return self.data_dir / "codeverse.db"

    @property
    def patches_dir(self) -> Path:
        return self.data_dir / "patches"

    @property
    def jobs_dir(self) -> Path:
        return self.data_dir / "jobs"
