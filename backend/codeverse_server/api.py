"""HTTP layer: a small router on top of http.server (threaded, stdlib only)."""

from __future__ import annotations

import json
import logging
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from . import auth, event
from .service import ApiError, App

log = logging.getLogger("codeverse.http")
MAX_BODY = 1_000_000


class Handler(BaseHTTPRequestHandler):
    server_version = "Codeverse"
    protocol_version = "HTTP/1.1"

    @property
    def app(self) -> App:
        return self.server.app  # type: ignore[attr-defined]

    # --- plumbing ----------------------------------------------------------

    def log_message(self, fmt, *args):  # quieter, goes through logging
        log.debug("%s %s", self.address_string(), fmt % args)

    def _send(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "TOO_LARGE", "request body too large")
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "BAD_JSON", "body must be JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "BAD_JSON", "body must be a JSON object")
        return data

    def _team(self):
        header = self.headers.get("Authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else ""
        team = auth.team_for_token(self.app.db, token) if token else None
        if team is None:
            raise ApiError(401, "UNAUTHORIZED", "missing or invalid token")
        return team

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def _dispatch(self, method: str) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            for verb, pattern, fn in ROUTES:
                m = pattern.fullmatch(path)
                if verb == method and m:
                    self._send(200, fn(self, *m.groups()))
                    return
            raise ApiError(404, "NOT_FOUND", f"no route for {method} {path}")
        except ApiError as exc:
            self._send(exc.status, {"error": exc.code, "message": exc.message, **exc.extra})
        except Exception:
            log.exception("unhandled error on %s %s", method, path)
            self._send(500, {"error": "SERVER_ERROR", "message": "internal error"})


# --- route handlers ---------------------------------------------------------


def r_login(h: Handler):
    body = h._body()
    session = auth.login(h.app.db, str(body.get("teamId", "")), str(body.get("accessCode", "")))
    if session is None:
        raise ApiError(401, "UNAUTHORIZED", "invalid team ID or access code")
    return session


def r_health(h: Handler):
    n, age = h.app.queue_depth()
    return {"ok": True, "queued": n, "oldestSeconds": round(age, 1),
            "judgeReady": h.app.assets.ok, "workers": h.app.cfg.workers}


def r_challenge(h: Handler, cid: str):
    team = h._team()
    base = h.app.content.get(cid)
    if base is None:
        raise ApiError(404, "NOT_FOUND", f"no such challenge: {cid}")
    return h.app.challenge_view(team, base)


def r_submit(h: Handler):
    team = h._team()
    body = h._body()
    return h.app.submit(team, str(body.get("challenge", "")), body.get("patch"))


ROUTES = [
    ("POST", re.compile(r"/api/login"), r_login),
    ("GET", re.compile(r"/api/health"), r_health),
    ("GET", re.compile(r"/api/status"), lambda h: h.app.status()),
    ("GET", re.compile(r"/api/phases"), lambda h: event.phases(h.app.db)),
    ("GET", re.compile(r"/api/leaderboard"), lambda h: h.app.leaderboard()),
    ("GET", re.compile(r"/api/me"), lambda h: h.app.me(h._team())),
    ("GET", re.compile(r"/api/challenges"), lambda h: h.app.challenges(h._team())),
    ("GET", re.compile(r"/api/challenges/([A-Za-z0-9-]+)"), r_challenge),
    ("GET", re.compile(r"/api/bonus"), lambda h: (h._team(), h.app.content.bonus)[1]),
    ("POST", re.compile(r"/api/submissions"), r_submit),
    ("GET", re.compile(r"/api/submissions"), lambda h: h.app.submissions_for(h._team())),
    ("GET", re.compile(r"/api/submissions/(\d+)"),
     lambda h, sid: h.app.submission_for(h._team(), int(sid))),
]


def make_server(app: App, host: str, port: int) -> ThreadingHTTPServer:
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.request_queue_size = 128
    server = ThreadingHTTPServer((host, port), Handler)
    server.app = app  # type: ignore[attr-defined]
    return server
