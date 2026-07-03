import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "@/lib/server/weather";
import { fetchProjects, createGithubIssue } from "@/lib/server/projects";

export const maxDuration = 60;

// ── Tool schemas ─────────────────────────────────────────────────────────────
// Client tools run in the browser against the data store (works in demo/local
// AND cloud mode); server tools run here because they need env secrets.

const CLIENT_TOOLS = [
  { name: "get_health_summary", description: "Daily WHOOP recovery/HRV/RHR, sleep, strain and Garmin steps/body battery/stress/VO2max for the last N days.", input_schema: { type: "object", properties: { days: { type: "number", description: "How many days back (max 120)" } }, required: ["days"] } },
  { name: "get_runs", description: "Garmin running activities: distance, pace, HR, cadence, elevation, training effect. Set detail=true to include per-km splits.", input_schema: { type: "object", properties: { days: { type: "number" }, detail: { type: "boolean" } }, required: ["days"] } },
  { name: "get_workouts", description: "Strength workouts and planned sessions between two dates (YYYY-MM-DD), including exercises, sets and per-muscle-group volume.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } },
  { name: "list_exercises", description: "The exercise library with valid exercise_id values and muscle groups. Call before plan_workout if unsure of ids.", input_schema: { type: "object", properties: {} } },
  { name: "plan_workout", description: "Create a planned workout on the calendar.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, title: { type: "string" }, type: { type: "string", enum: ["push", "pull", "legs", "upper", "lower", "full", "run", "mobility", "other"] }, notes: { type: "string" }, exercises: { type: "array", items: { type: "object", properties: { exercise_id: { type: "string" }, sets: { type: "number" }, reps: { type: "number" }, weight_kg: { type: "number" } }, required: ["exercise_id", "sets", "reps"] } } }, required: ["date", "title", "type"] } },
  { name: "update_workout_status", description: "Mark a workout planned/completed/skipped.", input_schema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["planned", "completed", "skipped"] } }, required: ["id", "status"] } },
  { name: "delete_workout", description: "Delete a workout by id.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "log_nutrition", description: "Log a meal/food with macros.", input_schema: { type: "object", properties: { meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }, name: { type: "string" }, calories: { type: "number" }, protein_g: { type: "number" }, carbs_g: { type: "number" }, fat_g: { type: "number" }, date: { type: "string" } }, required: ["meal", "name", "calories"] } },
  { name: "log_hydration", description: "Log water intake in ml.", input_schema: { type: "object", properties: { ml: { type: "number" }, date: { type: "string" } }, required: ["ml"] } },
  { name: "get_nutrition_summary", description: "Daily calories/protein/carbs/fat/water vs targets for the last N days.", input_schema: { type: "object", properties: { days: { type: "number" } }, required: ["days"] } },
  { name: "update_targets", description: "Update daily nutrition/hydration targets.", input_schema: { type: "object", properties: { calories: { type: "number" }, protein_g: { type: "number" }, carbs_g: { type: "number" }, fat_g: { type: "number" }, water_ml: { type: "number" } } } },
];

const SERVER_TOOLS = [
  { name: "get_weather", description: "Current weather + hourly and 5-day forecast with a run-conditions verdict for the user's location.", input_schema: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" }, place: { type: "string" } } } },
  { name: "get_projects", description: "Live status of the user's software projects (Seam, Misafir, Jarvis, …): latest commit, open PRs/issues.", input_schema: { type: "object", properties: {} } },
  { name: "create_github_issue", description: "Open a GitHub issue on one of the user's project repos — use this to request changes to a project (e.g. 'change X on the misafir website'). Confirm repo, title and body with the user before calling.", input_schema: { type: "object", properties: { repo: { type: "string", description: "owner/repo, e.g. alpsisman-tech/misafir" }, title: { type: "string" }, body: { type: "string" } }, required: ["repo", "title", "body"] } },
  { name: "create_calendar_event", description: "Create an event on the user's Google Calendar — meetings, reminders, dinner reservations, appointments, blocks of time. For a reminder, create a short event at the reminder time (default calendar notifications will fire).", input_schema: { type: "object", properties: { title: { type: "string" }, start: { type: "string", description: "ISO 8601 datetime with timezone, e.g. 2026-07-04T19:30:00+03:00" }, end: { type: "string", description: "ISO end time; omit to use duration_min" }, duration_min: { type: "number", description: "Duration in minutes if no end given (default 60)" }, description: { type: "string" }, location: { type: "string" } }, required: ["title", "start"] } },
  { name: "list_calendar_events", description: "List the user's Google Calendar events between two times (defaults: now → +7 days). Use before scheduling to avoid conflicts.", input_schema: { type: "object", properties: { from: { type: "string", description: "ISO datetime" }, to: { type: "string", description: "ISO datetime" } } } },
  { name: "send_email", description: "Send an email from the user's Gmail — reservation requests, inquiries, follow-ups. ALWAYS show the user the recipient, subject and body and get explicit confirmation before calling this.", input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  { name: "trigger_n8n_action", description: "Fire the n8n 'Jarvis Actions' webhook for other automations (sync_whoop, sync_garmin, custom actions).", input_schema: { type: "object", properties: { action: { type: "string", description: "e.g. sync_whoop, sync_garmin" }, payload: { type: "object" } }, required: ["action"] } },
];

const SERVER_TOOL_NAMES = new Set(SERVER_TOOLS.map((t) => t.name));

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  tool_use_id?: string;
  content?: unknown;
}
interface Msg { role: "user" | "assistant"; content: string | ContentBlock[] }

async function callN8n(action: string, payload: Record<string, unknown>): Promise<string> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return JSON.stringify({ ok: false, error: "N8N_WEBHOOK_URL not configured — set it in Netlify env (SETUP.md §6) to enable calendar/email actions" });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const text = (await res.text()).slice(0, 2000);
  return JSON.stringify({ ok: res.ok, status: res.status, result: text });
}

async function executeServerTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "get_weather": {
        const lat = Number(input.lat) || 41.015;
        const lon = Number(input.lon) || 28.979;
        const w = await fetchWeather(lat, lon, String(input.place ?? "your location"));
        return JSON.stringify({
          now: w.now, run_advice: w.run_advice,
          next_hours: w.hourly.slice(0, 8),
          daily: w.daily.map((d) => ({ date: d.date, min: d.min_c, max: d.max_c, precip_prob: d.precip_prob })),
        });
      }
      case "get_projects": {
        const ps = await fetchProjects();
        return JSON.stringify(ps.map((p) => ({
          name: p.name, repo: p.repo, live_data: p.live, description: p.description,
          last_commit: p.last_commit?.message, last_push: p.pushed_at,
          open_prs: p.open_prs, open_issues: p.open_issues,
        })));
      }
      case "create_github_issue":
        return JSON.stringify(await createGithubIssue(String(input.repo), String(input.title), String(input.body)));
      case "create_calendar_event":
        return callN8n("create_event", {
          title: input.title, start: input.start, end: input.end,
          duration_min: input.duration_min, description: input.description, location: input.location,
        });
      case "list_calendar_events":
        return callN8n("list_events", { from: input.from, to: input.to });
      case "send_email":
        return callN8n("send_email", { to: input.to, subject: input.subject, body: input.body });
      case "trigger_n8n_action":
        return callN8n(String(input.action), (input.payload as Record<string, unknown>) ?? {});
      default:
        return JSON.stringify({ error: `unknown server tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

function systemPrompt(context: string): string {
  return `You are JARVIS, Alp's personal AI agent — not just a dashboard assistant, but his day-to-day operator. You live in his personal app, which aggregates WHOOP (recovery, sleep, strain, workouts), Garmin (runs + coach plan), strength training with per-muscle tracking, nutrition & hydration, weather, his software projects (Seam, Misafir, Jarvis, Gaia, Hassan RFQ agent), his Google Calendar, and his Gmail.

Personality: composed, precise, lightly witty — a butler-engineer. Address the user plainly (no "sir" every sentence; an occasional one is fine).

What you can DO (not just answer):
- Health & training: query all data; plan/edit workouts on the app calendar (respect recovery, muscle recency, weather for runs; use list_exercises for valid ids).
- Google Calendar: create events, blocks, and reminders (create_calendar_event); check availability first with list_calendar_events when scheduling.
- Reminders: a reminder = a short calendar event at that time — the phone notification comes from Google Calendar.
- Email (send_email): reservations, inquiries, follow-ups — sent from Alp's real Gmail. NON-NEGOTIABLE: show recipient, subject and full body, get an explicit "yes", THEN send. Never send unconfirmed.
- Dinner reservations & similar errands: gather specifics (place, date, time, party size), check his calendar for conflicts, then EITHER send the reservation email (if an email address is known/provided) or create a calendar hold and give him the restaurant's phone number to call. Be honest that you can't book through reservation platforms yet.
- Projects: file scoped GitHub issues (create_github_issue) when he wants something changed on Seam/Misafir/etc.
- Nutrition/hydration logging, targets, syncs (trigger_n8n_action for sync_whoop / sync_garmin).

Rules:
- Use tools for real data before answering — never invent numbers, events, or availability.
- Cheap reads (calendar list, health queries): just do them. Mutations that are visible to other people (emails) always need confirmation; private mutations (calendar events, workouts, logs) need confirmation only if ambiguous.
- When something is beyond your tools, say so and offer the closest thing you CAN do.
- Keep responses tight: short paragraphs, occasional bullets, bold key numbers. Plain text — the UI renders minimal markdown (bold, bullets).

Live context snapshot (may be slightly stale; fetch details with tools when precision matters):
${context}`;
}

export async function POST(req: NextRequest) {
  let body: { messages?: Msg[]; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const messages = body.messages ?? [];
  const context = body.context ?? "";
  if (messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      type: "offline",
      text: "I'm running without an ANTHROPIC_API_KEY, so the full agent is offline. The dashboard itself is fully functional — and here's what I can see right now:\n\n" +
        context.split("\n").map((l) => "• " + l).join("\n") +
        "\n\nAdd ANTHROPIC_API_KEY to the server environment (see SETUP.md) to bring me online.",
    });
  }

  const tools = [...CLIENT_TOOLS, ...SERVER_TOOLS];
  const convo: Msg[] = [...messages];

  // Agent loop: execute server tools here; hand client tools back to the browser.
  for (let turn = 0; turn < 8; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt(context),
        tools,
        messages: convo,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Anthropic API ${res.status}: ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const msg = await res.json();
    const blocks: ContentBlock[] = msg.content ?? [];
    const toolUses = blocks.filter((b) => b.type === "tool_use");

    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) {
      return NextResponse.json({ type: "text", message: { role: "assistant", content: blocks } });
    }

    const serverUses = toolUses.filter((t) => SERVER_TOOL_NAMES.has(t.name!));
    const clientUses = toolUses.filter((t) => !SERVER_TOOL_NAMES.has(t.name!));

    const serverResults = await Promise.all(
      serverUses.map(async (t) => ({
        type: "tool_result",
        tool_use_id: t.id!,
        content: await executeServerTool(t.name!, t.input ?? {}),
      })),
    );

    if (clientUses.length > 0) {
      // Hand off: browser executes its tools, merges these results, re-POSTs.
      return NextResponse.json({
        type: "client_tools",
        message: { role: "assistant", content: blocks },
        server_results: serverResults,
        pending: clientUses.map((t) => ({ id: t.id, name: t.name, input: t.input })),
      });
    }

    convo.push({ role: "assistant", content: blocks });
    convo.push({ role: "user", content: serverResults as unknown as ContentBlock[] });
  }

  return NextResponse.json({
    type: "text",
    message: { role: "assistant", content: [{ type: "text", text: "I hit my tool-use limit for one request — ask me to continue." }] },
  });
}
