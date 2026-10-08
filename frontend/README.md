# CODEVERSE 2.0 — Participant Command Center

Frontend only (Next.js). Participants read rules/challenges and see score, rank and the
leaderboard here; coding and submission happen in the separate OBELISK repo + CLI.

```bash
npm run dev      # mock mode — login: CV-007 / OBELISK
```

## Connecting the LAN backend

All data goes through `lib/api` (`CodeverseApi` interface). Mock is the default.

```bash
NEXT_PUBLIC_CODEVERSE_API=http
NEXT_PUBLIC_CODEVERSE_API_URL=http://192.168.x.x:8080   # or http://codeverse.local
```

Endpoint paths live in `lib/api/http.ts` — adjust them to the backend contract.
The "MOCK" button (bottom right) simulates server offline/degraded, Phase 2, and team progress.
