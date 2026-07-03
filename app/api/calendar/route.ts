import { NextRequest, NextResponse } from "next/server";
import { callAction, unwrapItems } from "@/lib/server/n8n";
import type { CalEvent } from "@/lib/types";

// GET /api/calendar?from=ISO&to=ISO → Google Calendar events (via n8n).
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? new Date().toISOString();
  const to = req.nextUrl.searchParams.get("to") ?? new Date(Date.now() + 30 * 86400000).toISOString();

  const res = await callAction("list_events", { from, to });
  if (!res.ok) {
    return NextResponse.json({ events: [], error: res.error ?? `n8n ${res.status}`, configured: !!process.env.N8N_WEBHOOK_URL }, { status: 200 });
  }
  const rows = unwrapItems(res.data);
  const events: CalEvent[] = rows
    .filter((r) => r.start || r.summary || r.id)
    .map((r) => {
      const start = (r.start as { dateTime?: string; date?: string }) ?? {};
      const end = (r.end as { dateTime?: string; date?: string }) ?? {};
      const startIso = start.dateTime ?? (start.date ? `${start.date}T00:00:00` : String(r.start ?? ""));
      const endIso = end.dateTime ?? (end.date ? `${end.date}T00:00:00` : null);
      return {
        id: String(r.id ?? startIso),
        title: String(r.summary ?? r.title ?? "(untitled)"),
        start: startIso,
        end: endIso,
        allDay: !!start.date && !start.dateTime,
        location: (r.location as string) ?? null,
        description: (r.description as string) ?? null,
        link: (r.htmlLink as string) ?? null,
        source: "google" as const,
      };
    })
    .filter((e) => e.start);
  return NextResponse.json({ events, configured: true });
}
