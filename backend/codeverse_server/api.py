"""HTTP layer: a small router on top of http.server (threaded, stdlib only)."""

from __future__ import annotations

import json
import logging
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlparse

from . import adminapi, auth, event
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
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _read_raw(self) -> bytes:
        """Read the request body exactly once. Handlers that ignore it must still consume it, or the
        leftover bytes corrupt the next request on this keep-alive connection."""
        if getattr(self, "_raw", None) is None:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                self.close_connection = True
                raise ApiError(413, "TOO_LARGE", "request body too large")
            self._raw = self.rfile.read(length) if length else b""
        return self._raw

    def _body(self) -> dict:
        raw = self._read_raw()
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
        if team["disqualified"]:
            raise ApiError(403, "DISQUALIFIED", "this team has been disqualified")
        return team

    @property
    def query(self) -> dict:
        return dict(parse_qsl(urlparse(self.path).query))

    def _admin(self) -> None:
        adminapi.check(self.app, self.headers.get("X-Admin-Token", ""), self.client_address[0])

    def _send_html(self, text: str) -> None:
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def _dispatch(self, method: str) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        self._raw = None
        try:
            if method == "POST":
                self._read_raw()
            if method == "GET" and path == "/admin":
                self._send_html(adminapi.UI_FILE.read_text(encoding="utf-8"))
                return
            if path.startswith("/api/admin"):
                self._admin()
            for verb, pattern, fn in ROUTES + ADMIN_ROUTES:
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
    try:
        session = auth.login(h.app.db, str(body.get("teamId", "")), str(body.get("accessCode", "")))
    except auth.Disqualified:
        raise ApiError(403, "DISQUALIFIED", "this team has been disqualified and can no longer sign in")
    if session is None:
        raise ApiError(401, "UNAUTHORIZED", "invalid team ID or access code")
    return session


def r_health(h: Handler):
    n, age = h.app.queue_depth()
    return {"ok": True, "queued": n, "oldestSeconds": round(age, 1),
            "judgeReady": h.app.assets.ok, "workers": h.app.cfg.workers}


def r_challenge(h: Handler, cid: str):
    team = h._team()
    h.app.require_obelisk(team)
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
    ("GET", re.compile(r"/api/games"), lambda h: h.app.game_results(h._team())),
    ("POST", re.compile(r"/api/games/start"), lambda h: h.app.start_game(h._team(), h._body())),
    ("POST", re.compile(r"/api/games"), lambda h: h.app.record_game(h._team(), h._body())),
    ("POST", re.compile(r"/api/submissions"), r_submit),
    ("GET", re.compile(r"/api/submissions"), lambda h: h.app.submissions_for(h._team())),
    ("GET", re.compile(r"/api/submissions/(\d+)"),
     lambda h, sid: h.app.submission_for(h._team(), int(sid))),
]


def _a(fn):
    """Adapt ``fn(app, ...)`` admin functions to route handlers."""
    return lambda h, *g: fn(h.app, *g)


def _ab(fn, convert=str):
    """Admin handler taking (app, id, body)."""
    return lambda h, ident: fn(h.app, convert(ident), h._body())


ADMIN_ROUTES = [
    ("GET", re.compile(r"/api/admin/overview"), _a(adminapi.overview)),
    ("POST", re.compile(r"/api/admin/event"), lambda h: adminapi.event_action(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/announcement"), lambda h: adminapi.set_announcement(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/settings"), lambda h: adminapi.set_settings(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/backup"), _a(adminapi.create_backup)),
    ("GET", re.compile(r"/api/admin/teams"), _a(adminapi.teams)),
    ("POST", re.compile(r"/api/admin/teams"), lambda h: adminapi.create_team(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/teams/bulk"), lambda h: adminapi.bulk_teams(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/teams/([A-Za-z0-9-]+)"), _ab(adminapi.update_team)),
    ("POST", re.compile(r"/api/admin/teams/([A-Za-z0-9-]+)/delete"), lambda h, t: adminapi.delete_team(h.app, t)),
    ("GET", re.compile(r"/api/admin/submissions"), lambda h: adminapi.submissions(h.app, h.query)),
    ("GET", re.compile(r"/api/admin/submissions/(\d+)"), lambda h, i: adminapi.submission_detail(h.app, int(i))),
    ("POST", re.compile(r"/api/admin/submissions/(\d+)"), _ab(adminapi.submission_action, int)),
    ("POST", re.compile(r"/api/admin/rejudge"), lambda h: adminapi.bulk_rejudge(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/grant"), lambda h: adminapi.grant_solve(h.app, h._body())),
    ("GET", re.compile(r"/api/admin/leaderboard"), _a(adminapi.leaderboard)),
    ("GET", re.compile(r"/api/admin/adjustments"), _a(adminapi.adjustments)),
    ("POST", re.compile(r"/api/admin/adjustments"), lambda h: adminapi.add_adjustment(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/adjustments/(\d+)/delete"),
     lambda h, i: adminapi.delete_adjustment(h.app, int(i))),
    ("GET", re.compile(r"/api/admin/flags"), lambda h: adminapi.flags(h.app, h.query)),
    ("POST", re.compile(r"/api/admin/flags"), lambda h: adminapi.create_flag(h.app, h._body())),
    ("POST", re.compile(r"/api/admin/flags/(\d+)"), _ab(adminapi.update_flag, int)),
    ("GET", re.compile(r"/api/admin/audit"), _a(adminapi.audit_log)),
    ("GET", re.compile(r"/api/admin/games"), _a(adminapi.game_results)),
    ("POST", re.compile(r"/api/admin/games/reset"), lambda h: adminapi.reset_game(h.app, h._body())),
]


def make_server(app: App, host: str, port: int) -> ThreadingHTTPServer:
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.request_queue_size = 128
    server = ThreadingHTTPServer((host, port), Handler)
    server.app = app  # type: ignore[attr-defined]
    return server
