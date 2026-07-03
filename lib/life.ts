// Client fetchers for the life surfaces (calendar, inbox, subscriptions).
import type { CalEvent, EmailMsg, Subscription, Workout, RunActivity } from "./types";
import { getWorkouts, getRuns } from "./store";

export interface CalendarResp { events: CalEvent[]; configured: boolean; error?: string }
export interface InboxResp { emails: EmailMsg[]; configured: boolean; error?: string; query?: string }
export interface SubsResp { subscriptions: Subscription[]; configured: boolean; error?: string; scanned?: number }

export async function fetchCalendar(fromISO: string, toISO: string): Promise<CalendarResp> {
  try {
    const r = await fetch(`/api/calendar?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
    return await r.json();
  } catch (e) {
    return { events: [], configured: false, error: String(e) };
  }
}

export async function fetchInbox(filter: string, q = "", max = 25): Promise<InboxResp> {
  try {
    const r = await fetch(`/api/inbox?filter=${filter}&q=${encodeURIComponent(q)}&max=${max}`);
    return await r.json();
  } catch (e) {
    return { emails: [], configured: false, error: String(e) };
  }
}

export async function fetchSubscriptions(): Promise<SubsResp> {
  try {
    const r = await fetch(`/api/subscriptions`);
    return await r.json();
  } catch (e) {
    return { subscriptions: [], configured: false, error: String(e) };
  }
}

// Merge training (workouts + runs) into calendar events so the calendar shows
// everything in one place regardless of Gmail/Calendar connectivity.
export async function fetchTrainingEvents(fromISO: string, toISO: string, seriesColors: string[]): Promise<CalEvent[]> {
  const from = fromISO.slice(0, 10);
  const to = toISO.slice(0, 10);
  const [workouts, runs] = await Promise.all([getWorkouts(from, to), getRuns(120)]);
  const out: CalEvent[] = [];
  for (const w of workouts as Workout[]) {
    if (w.source_run_id) continue; // avoid double with the run itself
    out.push({
      id: `wk-${w.id}`,
      title: w.title,
      start: `${w.date}T07:00:00`,
      end: `${w.date}T08:00:00`,
      allDay: false,
      location: null,
      description: w.notes,
      link: "/training",
      source: "workout",
      color: w.type === "run" ? seriesColors[3] : seriesColors[4],
    });
  }
  for (const r of runs as RunActivity[]) {
    if (r.date < from || r.date > to) continue;
    out.push({
      id: `run-${r.id}`,
      title: `${r.name} · ${r.distance_km.toFixed(1)}km`,
      start: `${r.date}T07:00:00`,
      end: `${r.date}T08:00:00`,
      allDay: false,
      location: null,
      description: null,
      link: "/runs",
      source: "run",
      color: seriesColors[1],
    });
  }
  return out;
}
