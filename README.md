# JARVIS — Personal Ops Dashboard

One place for everything: WHOOP recovery/sleep/strain, Garmin daily activity and
run analytics, strength training with per-muscle-group tracking, nutrition &
hydration, weather with run-conditions advice, live status of all projects —
and **Jarvis**, an AI agent with tool access to all of it.

Built with Next.js (App Router). Installable as a PWA on your phone
(Share → Add to Home Screen) and usable as a normal site on desktop.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

It works immediately in **local mode**: deterministic demo data for WHOOP /
Garmin / training history, plus everything you log stored on-device. No keys,
no accounts.

To go live with real data (Supabase, WHOOP OAuth, Garmin, the Anthropic-powered
agent, GitHub project status, n8n automations, briefing emails) follow
**[SETUP.md](./SETUP.md)** — each integration is independent and optional.

## Pages

| Route | What it does |
|---|---|
| `/` | Today: recovery, sleep, strain, Garmin, today's session, weather, fuel rings, quick water log |
| `/health` | WHOOP + Garmin deep dive: recovery, HRV vs RHR, sleep stages, strain, steps, body battery vs stress |
| `/training` | Muscle-group heatmap (front/back body), hard sets per muscle, recency warnings, session log & planner |
| `/runs` | Strava-style Garmin run insights: weekly mileage, pace trend, HR zones, PRs, per-km splits |
| `/nutrition` | Calories/macros/water vs targets, quick-add foods, 14-day charts, Bevel CSV import (Settings) |
| `/projects` | Live GitHub status for Seam, Misafir, Jarvis, Gaia, Hassan RFQ agent |
| `/jarvis` | The agent — reads every data source above and acts: plans workouts, logs food, files GitHub issues, triggers n8n |
| `/settings` | Profile, targets, local/cloud mode, integration status, syncs, CSV import |

## Architecture (short version)

- `lib/store.ts` — single data-access layer. Local mode = demo data +
  localStorage overlay; cloud mode = `/api/data/*` → Supabase.
- `app/api/jarvis/route.ts` — the agent. Anthropic tool-use loop; server tools
  (weather, projects, GitHub issues, n8n) run server-side, data tools are
  executed by the browser against the store so they work in every mode.
- `app/api/whoop/*` — OAuth + scheduled sync into Supabase.
  `app/api/garmin/*` — sync (optional `garmin-connect` package) or push ingest.
- `supabase/schema.sql` — all tables; RLS locked, service-role only.
- `n8n/` — workflow definitions for scheduled syncs, morning briefing and the
  agent's action webhook.

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve production build
npm run icons    # regenerate PWA icons (scripts/gen-icons.mjs)
```
