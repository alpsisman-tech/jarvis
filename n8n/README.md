# n8n backend

The automation backend lives in your n8n instance as one workflow:

**Jarvis · Backend (Syncs, Briefing, Actions)** — already created at
https://alpsisman.app.n8n.cloud/workflow/TGb1hN7PqNoroxzb (draft).
Source code: `jarvis-backend.sdk.js` (n8n Workflow SDK — paste into the
"create from code" flow of any other n8n instance to recreate it).

It contains four independent branches:

| Trigger | Does |
|---|---|
| Schedule · every 30 min | `POST /api/whoop/sync` — pull latest WHOOP recovery/sleep/strain into Supabase |
| Schedule · every 2 h | `POST /api/garmin/sync` — pull Garmin runs + daily activity |
| Schedule · daily 06:30 | `POST /api/briefing` — compose and email the morning briefing (Resend) |
| Webhook `POST /jarvis-actions` | Agent-triggered actions: body `{"action": "sync_whoop" \| "sync_garmin" \| "send_briefing"}` |

## Activation checklist

1. Open the workflow and replace every `https://YOUR-JARVIS-APP/...` placeholder
   URL with your deployed app URL.
2. Create the **Jarvis Access Token** credential (type: Bearer Auth) with the
   same value as the app's `JARVIS_ACCESS_TOKEN` env var, and select it on all
   six HTTP nodes.
3. Publish the workflow.
4. Copy the production webhook URL (`.../webhook/jarvis-actions`) into the
   app's `N8N_WEBHOOK_URL` env var — this is what the agent's
   `trigger_n8n_action` tool calls.

## Extending

All the heavy lifting (API auth, data mapping, Supabase writes, email
composition) lives in the app's API routes, so n8n stays a thin scheduler:
add a new automation by adding an API route to the app and pointing a new
schedule/switch-case at it. For richer Garmin data (per-km splits, HR zones),
add a branch that runs a [garth](https://github.com/matin/garth) export and
POSTs to `/api/garmin/ingest`.
