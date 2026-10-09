"""Phase 1 game results, OBELISK unlocking and disqualification."""

import time
import unittest

from support import ApiError, event
from test_admin import AdminCase

from codeverse_server import games

ALL = list(games.WEIGHTS)


class Games(AdminCase):
    def setUp(self):
        super().setUp()
        event.start(self.app.db, phase1_minutes=60)  # back to the games round
        self.tok = self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "code1"}, admin=False)[1]["token"]

    def T(self, method, path, body=None, tok=None):
        return self.call(method, path, body, {"Authorization": "Bearer " + (tok or self.tok)}, admin=False)

    def play(self, game, score=50, max_=100, tok=None):
        self.T("POST", "/api/games/start", {"game": game}, tok)  # official runs must be opened first
        return self.T("POST", "/api/games", {"game": game, "score": score, "max": max_, "detail": "d", "durationMs": 1000}, tok)

    def test_results_are_stored_once_and_visible_everywhere(self):
        code, r = self.play("logic", 720, 900)
        self.assertEqual((code, r["share"]), (200, 240))           # weight 3 x 80%
        self.assertEqual(self.play("logic")[1]["error"], "ALREADY_PLAYED")
        self.assertEqual(self.play("chess")[0], 404)
        self.assertEqual(self.play("safe", 5000, 100)[0], 400)
        self.assertEqual(self.T("GET", "/api/games")[1]["logic"]["score"], 720)
        me = self.T("GET", "/api/me")[1]
        self.assertEqual((me["gamesPlayed"], me["gamesScore"], me["gamesTotal"]), (1, 240, 5))
        # another login of the same team (another laptop) sees the same results
        other = self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "code1"}, admin=False)[1]["token"]
        self.assertIn("logic", self.T("GET", "/api/games", tok=other)[1])
        # admin panel
        row = next(r for r in self.A("/games")["rows"] if r["teamId"] == "CV-001")
        self.assertEqual((row["played"], row["total"]), (1, 240))
        team = next(t for t in self.A("/teams") if t["teamId"] == "CV-001")
        self.assertEqual((team["gamesPlayed"], team["gamesScore"], team["obeliskOpen"]), (1, 240, False))
        self.assertEqual(self.A("/overview")["counts"]["gameRuns"], 1)
        # organizer can let a team replay a game
        self.A("/games/reset", {"teamId": "CV-001", "game": "logic"})
        self.assertEqual(self.play("logic")[0], 200)

    def test_obelisk_stays_locked_until_the_organizer_opens_phase_2(self):
        self.assertEqual(self.T("GET", "/api/challenges")[1]["error"], "PHASE_NOT_OPEN")
        self.assertEqual(self.T("GET", "/api/challenges/OB-001")[0], 403)
        for g in ALL:
            self.play(g)
        # all five games finished, still locked
        self.assertFalse(self.T("GET", "/api/me")[1]["obeliskOpen"])
        self.assertEqual(self.T("GET", "/api/challenges")[0], 403)
        with self.assertRaises(ApiError) as cm:
            self.app.submit(self.team(1), "OB-001", "garbage")
        self.assertEqual(cm.exception.code, "PHASE_NOT_OPEN")
        # a finished timer does not open it either
        self.app.db.kv_set("phase1_end", time.time() - 1)
        self.assertEqual(self.call("GET", "/api/status")[1]["phase"], 1)
        self.assertEqual(self.T("GET", "/api/challenges")[0], 403)
        # the organizer opens it by hand
        self.A("/event", {"action": "phase", "number": 2})
        self.assertTrue(self.T("GET", "/api/me")[1]["obeliskOpen"])
        self.assertEqual(len(self.T("GET", "/api/challenges")[1]), 6)
        self.assertEqual(self.app.submit(self.team(1), "OB-001", "garbage")["reason"], "BAD_PATCH")

    def test_games_close_when_phase_1_time_is_up(self):
        self.assertEqual(self.play("safe")[0], 200)
        self.app.db.kv_set("phase1_end", time.time() - games.GRACE_SECONDS - 5)
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "bugs"})[1]["error"], "GAMES_CLOSED")
        # extending phase 1 re-opens the games
        self.A("/event", {"action": "extend", "minutes": 10})
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "bugs"})[0], 200)

    def test_admin_dashboard_shows_phase_1_points_live(self):
        self.play("logic", 720, 900)                       # team 1: 240 pts
        self.play("safe", 725, 1450)                      # team 1: +50
        tok2 = self.call("POST", "/api/login", {"teamId": "CV-002", "accessCode": "code2"}, admin=False)[1]["token"]
        self.play("logic", 900, 900, tok2)                # team 2: 300 pts
        self.T("POST", "/api/games/start", {"game": "bugs"}, tok2)   # team 2 is mid-run on bugs
        ov = self.A("/overview")["phase1"]
        self.assertEqual([t["teamId"] for t in ov["top"]], ["CV-002", "CV-001"])
        self.assertEqual((ov["top"][0]["score"], ov["top"][1]["score"]), (300, 290))
        by = {g["game"]: g for g in ov["games"]}
        self.assertEqual((by["logic"]["finished"], by["logic"]["avgPercent"]), (2, 90))
        self.assertEqual((by["bugs"]["finished"], by["bugs"]["running"]), (0, 1))
        self.assertEqual(ov["activeTeams"], 3)
        lb = {r["teamId"]: r for r in self.A("/leaderboard")["rows"]}
        self.assertEqual((lb["CV-001"]["gamesPlayed"], lb["CV-001"]["gamesScore"]), (2, 290))
        self.assertEqual(lb["CV-002"]["gamesScore"], 300)
        # a disqualified team drops out of the Phase 1 summary
        self.A("/teams/CV-002", {"disqualified": True})
        self.assertEqual([t["teamId"] for t in self.A("/overview")["phase1"]["top"]], ["CV-001"])

    def test_a_forged_maximum_or_score_is_rejected(self):
        self.T("POST", "/api/games/start", {"game": "bugs"})
        # claiming max=1 no longer turns 1 point into 100%
        code, body = self.T("POST", "/api/games", {"game": "bugs", "score": 1000, "max": 1})
        self.assertEqual(code, 400)
        code, body = self.T("POST", "/api/games", {"game": "bugs", "score": 300, "max": 1, "durationMs": 1})
        self.assertEqual((code, body["max"], body["share"]), (200, 300, 400))   # real max, real share
        # absurd numbers are a clean 400, not a crash
        self.T("POST", "/api/games/start", {"game": "logic"})
        for bad in ({"score": 10**30}, {"score": "x"}, {"score": None}, {"score": -1}, {"score": [1]}):
            self.assertEqual(self.T("POST", "/api/games", {"game": "logic", **bad})[0], 400, bad)
        # a 300/300 in a few milliseconds is flagged for the organizers
        flags = self.A("/flags")
        self.assertIn("GAME_TOO_FAST", [f["kind"] for f in flags])

    def test_hostile_requests_are_clean_errors(self):
        import socket
        for cl in ("abc", "-5"):
            s = socket.create_connection(("127.0.0.1", self.server.server_address[1]), timeout=5)
            s.sendall(f"POST /api/login HTTP/1.1\r\nHost: x\r\nContent-Length: {cl}\r\n\r\n".encode())
            self.assertIn(b" 400 ", s.recv(100).split(b"\r\n")[0])
            s.close()

    def test_wrong_codes_are_throttled(self):
        from codeverse_server import api
        api._login_failures.clear()
        for i in range(api.LOGIN_FAILS):
            self.assertEqual(self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": f"no{i}"}, admin=False)[0], 401)
        code, body = self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "code1"}, admin=False)
        self.assertEqual((code, body["error"]), (429, "TOO_MANY_ATTEMPTS"))   # even the right code waits
        # another team from the same address is not affected
        self.assertEqual(self.call("POST", "/api/login", {"teamId": "CV-002", "accessCode": "code2"}, admin=False)[0], 200)
        api._login_failures.clear()

    def test_participant_leaderboard_shows_phase_1_points_live(self):
        tok2 = self.call("POST", "/api/login", {"teamId": "CV-002", "accessCode": "code2"}, admin=False)[1]["token"]
        self.play("logic", 450, 900)                       # team 1: 150
        self.play("logic", 900, 900, tok2)                 # team 2: 300
        board = self.call("GET", "/api/leaderboard", admin=False)[1]
        self.assertEqual([(r["teamId"], r["gamesScore"], r["rank"]) for r in board[:2]],
                         [("CV-002", 300, 1), ("CV-001", 150, 2)])
        self.assertEqual(self.T("GET", "/api/me")[1]["rank"], 2)          # rank follows the games board in phase 1
        # it moves as soon as another game is recorded
        self.play("bugs", 300, 300)                        # team 1: +400
        self.assertEqual(self.call("GET", "/api/leaderboard", admin=False)[1][0]["teamId"], "CV-001")
        # phase 2: ranked by OBELISK score, games points shown alongside
        self.A("/event", {"action": "phase", "number": 2})
        board = self.call("GET", "/api/leaderboard", admin=False)[1]
        self.assertTrue(all(r["score"] == 0 for r in board))
        self.assertEqual({r["teamId"]: r["gamesScore"] for r in board}["CV-001"], 550)

    def test_organizer_can_edit_game_scores_and_adjust_totals(self):
        self.play("logic", 450, 900)                       # 150
        r = self.A("/games/set", {"teamId": "CV-001", "game": "logic", "score": 900, "note": "re-graded"})
        self.assertEqual((r["score"], r["share"]), (900, 300))
        res = self.T("GET", "/api/games")[1]["logic"]
        self.assertEqual((res["score"], res["share"]), (900, 300))
        self.assertIn("Set by organizer (was 450)", res["detail"])
        self.assertEqual(self.T("GET", "/api/me")[1]["gamesScore"], 300)
        # create a result for a game that was never played; the team cannot replay it afterwards
        self.A("/games/set", {"teamId": "CV-001", "game": "safe", "score": 725})
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[1]["error"], "ALREADY_PLAYED")
        # bounds
        for bad in (-1, 901, "x", None):
            self.assertEqual(self.call("POST", "/api/admin/games/set", {"teamId": "CV-001", "game": "logic", "score": bad})[0], 400)
        self.assertEqual(self.call("POST", "/api/admin/games/set", {"teamId": "CV-001", "game": "chess", "score": 1})[0], 404)
        # a phase-1 adjustment changes the games points but not the OBELISK score; phase 2 is unaffected
        before = self.T("GET", "/api/me")[1]
        self.A("/adjustments", {"teamId": "CV-001", "points": 40, "reason": "bonus", "phase": "1"})
        me = self.T("GET", "/api/me")[1]
        self.assertEqual((me["gamesScore"], me["score"]), (before["gamesScore"] + 40, before["score"]))
        self.A("/adjustments", {"teamId": "CV-001", "points": 7, "reason": "obelisk", "phase": "2"})
        me = self.T("GET", "/api/me")[1]
        self.assertEqual((me["gamesScore"], me["score"]), (before["gamesScore"] + 40, before["score"] + 7))
        row = next(r for r in self.A("/games")["rows"] if r["teamId"] == "CV-001")
        self.assertEqual((row["adjustment"], row["total"]), (40, before["gamesScore"] + 40))

    def test_refreshing_mid_run_does_not_give_a_second_run(self):
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[0], 200)
        # page refreshed: asking for another official run is refused
        code, body = self.T("POST", "/api/games/start", {"game": "safe"})
        self.assertEqual((code, body["error"]), (409, "RUN_IN_PROGRESS"))
        # a result cannot be recorded for a run that was never started
        self.assertEqual(self.T("POST", "/api/games", {"game": "ledger", "score": 1, "max": 10})[1]["error"], "NOT_STARTED")
        # once its time limit has passed the abandoned run is scored 0 and cannot be replayed
        self.app.db.conn().execute("UPDATE game_starts SET started=?", (time.time() - 3600,))
        self.assertEqual(self.T("GET", "/api/games")[1]["safe"]["score"], 0)
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[1]["error"], "ALREADY_PLAYED")
        self.assertEqual(self.T("GET", "/api/me")[1]["gamesPlayed"], 1)
        # an organizer can reset it
        self.A("/games/reset", {"teamId": "CV-001", "game": "safe"})
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[0], 200)

    def test_new_runs_are_refused_while_paused(self):
        event.pause(self.app.db)
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[1]["error"], "EVENT_PAUSED")
        event.resume(self.app.db)
        self.assertEqual(self.T("POST", "/api/games/start", {"game": "safe"})[0], 200)

    def test_disqualified_team_is_signed_out_and_cannot_sign_in(self):
        self.A("/teams/CV-001", {"disqualified": True})
        code, body = self.T("GET", "/api/me")
        self.assertEqual((code, body["error"]), (403, "DISQUALIFIED"))
        self.assertEqual(self.play("safe")[1]["error"], "DISQUALIFIED")
        code, body = self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "code1"}, admin=False)
        self.assertEqual((code, body["error"]), (403, "DISQUALIFIED"))
        # a wrong code does not reveal anything
        self.assertEqual(self.call("POST", "/api/login", {"teamId": "CV-001", "accessCode": "x"}, admin=False)[0], 401)


if __name__ == "__main__":
    unittest.main()
