"""``python -m codeverse_server serve`` / ``python -m codeverse_server admin <command>``."""

from __future__ import annotations

import argparse
import logging
import shutil
import socket
import sys
from logging.handlers import RotatingFileHandler

from . import admin
from .api import make_server
from .config import Config
from .service import App
from .worker import start_workers


def lan_addresses() -> list[str]:
    found = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # no packets are sent
        found.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    return sorted(a for a in found if not a.startswith("127."))


def serve(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="codeverse_server serve")
    p.add_argument("--host")
    p.add_argument("--port", type=int)
    p.add_argument("--workers", type=int)
    a = p.parse_args(argv)
    cfg = Config()
    cfg.host = a.host or cfg.host
    cfg.port = a.port or cfg.port
    cfg.workers = a.workers or cfg.workers

    cfg.data_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    fh = RotatingFileHandler(cfg.data_dir / "server.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(fh)
    log = logging.getLogger("codeverse")

    if not shutil.which("git"):
        print("error: `git` is required on the server (used to apply patches)", file=sys.stderr)
        return 2
    app = App(cfg)
    if not app.assets.ok:
        log.warning("judge assets missing in %s - run scripts/prepare_judge_assets.py", cfg.assets_dir)
    recovered = app.recover()
    if recovered:
        log.info("re-queued %d submissions interrupted by the last shutdown", recovered)
    start_workers(app)
    server = make_server(app, cfg.host, cfg.port)
    log.info("listening on %s:%d with %d workers", cfg.host, cfg.port, cfg.workers)
    for addr in lan_addresses():
        log.info("LAN address: http://%s:%d", addr, cfg.port)
    from .adminapi import admin_token

    log.info("admin panel: http://<this-machine>:%d/admin   token: %s", cfg.port, admin_token(app))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down")
    finally:
        app.stop.set()
        server.server_close()
    return 0


def main() -> int:
    argv = sys.argv[1:]
    if argv and argv[0] == "serve":
        return serve(argv[1:])
    if argv and argv[0] == "admin":
        return admin.main(argv[1:])
    print("usage: python -m codeverse_server {serve|admin} ...", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
