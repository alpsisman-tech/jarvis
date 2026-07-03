# JARVIS setup — from demo to fully live

Every integration is optional and independent. The app runs out of the box in
local mode; each section below lights up one more part of the system. All
server configuration is environment variables (`.env.local` in dev; site
environment settings on Netlify/Vercel in production).

## 0. Deploy the app

- **Netlify** (matches your other projects): connect the repo, build command
  `npm run build`, the included `netlify.toml` does the rest.
- Set `APP_URL` to the deployed URL (needed for WHOOP OAuth redirects).
- Set `JARVIS_ACCESS_TOKEN` to a long random string (e.g. `openssl rand -hex 24`).
  This is your personal key: enter the same value in **Settings → Data mode &
  access** on each device. It protects every data/sync API route.

Install on your phone: open the site in Safari/Chrome → Share → **Add to Home
Screen**. It runs standalone with the JARVIS icon.

## 1. Supabase (cloud storage)

1. Create a project at supabase.com.
2. SQL editor → paste and run `supabase/schema.sql`.
3. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (Project Settings → API → service_role key — server-only, never exposed).
4. In the app: Settings → enter your access token → **Connect**. The badge
   flips to CLOUD and all reads/writes go to Supabase.

Note: RLS is enabled with **no policies** — the anon key can read nothing;
all access flows through the app's token-guarded API routes.

## 2. The Jarvis agent (Anthropic)

- `ANTHROPIC_API_KEY` from console.anthropic.com.
- Optional `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-6`).

Without a key the chat runs in a limited offline mode; with it, Jarvis gets the
full tool loop (health queries, workout planning, nutrition logging, weather,
project status, GitHub issues, n8n actions).

## 3. WHOOP

1. Create an app at **developer.whoop.com** (any personal app works).
2. Redirect URI: `{APP_URL}/api/whoop/callback`.
   Scopes: `read:recovery read:sleep read:workout read:cycles read:profile offline`.
3. Env vars: `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`.
4. Visit `/api/whoop/auth` once (or Settings → WHOOP → Authorize) and approve.
   Tokens land in `integration_tokens`; the first 14 days sync immediately.
5. Keep it fresh: n8n workflow **Jarvis · WHOOP Sync** (see §6) or any cron
   hitting `POST {APP_URL}/api/whoop/sync` with header
   `Authorization: Bearer $JARVIS_ACCESS_TOKEN`.

## 4. Garmin

Garmin has no free official consumer API. Two supported paths:

**A — server-side sync (easiest):**
```bash
npm i garmin-connect      # optional dependency, install on the server
```
Set `GARMIN_EMAIL` / `GARMIN_PASSWORD`, then Settings → Garmin → **Sync now**
(or schedule `POST /api/garmin/sync` via n8n). Pulls runs + daily steps.

**B — push ingest (richer data, no password on the server):**
`POST {APP_URL}/api/garmin/ingest` with the bearer token and body
`{ "runs": [...], "daily": [...] }` matching `lib/types.ts`. Works great from a
small [garth](https://github.com/matin/garth)-based Python script or an n8n
workflow — including per-km `splits` and `hr_zones`, which path A can't get.

## 5. Weather

Nothing to configure — Open-Meteo, no key. Set your location in Settings
(defaults to Istanbul).

## 6. n8n (automation backend)

Three workflows ship with the repo (see `n8n/README.md`): scheduled WHOOP +
Garmin syncs, a 06:30 morning briefing, and a **Jarvis Actions** webhook the
agent can trigger. Import/create them in your n8n instance, set the
`APP_URL`/token values, then set `N8N_WEBHOOK_URL` to the Actions webhook URL
so the agent's `trigger_n8n_action` tool comes alive.

## 7. Projects hub (GitHub)

- `GITHUB_TOKEN`: fine-grained PAT with **read** on your repos (add **issues:
  write** if Jarvis should be able to file issues).
- Repos are configured in `lib/projectsConfig.ts` — Gaia and the Hassan RFQ
  agent have placeholder entries; point them at their repos when ready.

## 8. Morning briefing email (Resend)

`RESEND_API_KEY`, `RESEND_FROM` (verified domain), `BRIEFING_TO`.
Test: `curl -X POST {APP_URL}/api/briefing -H "Authorization: Bearer $TOKEN"`.
Schedule it via the n8n briefing workflow.

## 9. Bevel (nutrition/hydration)

Bevel has no public API, so JARVIS accepts CSV import (Settings → Bevel/CSV):
food rows `date,meal,name,calories,protein_g,carbs_g,fat_g`, water rows
`date,water,ml`. Anything you or Jarvis log in-app is first-class regardless.

## Environment variable reference

See `.env.example` — copy to `.env.local` and fill in what you use.
