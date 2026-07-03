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
  { name: "trigger_n8n_action", description: "Fire the n8n 'Jarvis Actions' webhook for automations (send briefing email, run WHOOP/Garmin sync, custom actions).", input_schema: { type: "object", properties: { action: { type: "string", description: "e.g. send_briefing, sync_whoop, sync_garmin" }, payload: { type: "object" } }, required: ["action"] } },
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
      case "trigger_n8n_action": {
        const url = process.env.N8N_WEBHOOK_URL;
        if (!url) return JSON.stringify({ ok: false, error: "N8N_WEBHOOK_URL not configured — set it in the environment to enable automations" });
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: input.action, payload: input.payload ?? {} }),
        });
        return JSON.stringify({ ok: res.ok, status: res.status, body: (await res.text()).slice(0, 500) });
      }
      default:
        return JSON.stringify({ error: `unknown server tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

function systemPrompt(context: string): string {
  return `You are JARVIS, ${""}the personal AI operations agent for Alp. You run inside his personal dashboard app which aggregates WHOOP (recovery, sleep, strain), Garmin (daily activity + runs), strength training with per-muscle-group tracking, nutrition & hydration logs, weather, and the live status of his software projects (Seam, Misafir, Jarvis, Gaia, Hassan RFQ agent).

Personality: composed, precise, lightly witty — a butler-engineer. Address the user plainly (no "sir" every sentence; an occasional one is fine).

Rules:
- Use tools to fetch real data before answering questions about health, training, runs, nutrition, weather or projects. Never invent numbers.
- When planning workouts, use list_exercises to get valid exercise_id values, respect recovery (low recovery → suggest lighter sessions), recently-trained muscle groups (avoid hitting the same group on consecutive days), and the weather for runs.
- When asked to change something on a project (e.g. the misafir website), gather the specifics, then use create_github_issue on the right repo with a clear, actionable description. Tell the user the issue URL.
- Mutating actions (plan/delete workouts, log food, create issues, trigger automations): confirm once if the request is ambiguous, otherwise just do it and report what you did.
- Keep responses tight: short paragraphs, occasional bullet lists, bold key numbers. No headers unless the answer is long. Plain text — the UI renders minimal markdown (bold, bullets).

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
