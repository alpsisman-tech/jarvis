import { NextRequest, NextResponse } from "next/server";
import { callAction, unwrapItems } from "@/lib/server/n8n";
import { normalizeGmail } from "@/lib/server/gmail";

// GET /api/inbox?filter=important|unread|all&q=<gmail query>&max=25
// Fetches Gmail messages via n8n and normalizes them.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter = sp.get("filter") ?? "important";
  const q = sp.get("q") ?? "";
  const max = Math.min(Number(sp.get("max")) || 25, 50);

  // Build a Gmail search query for the requested view
  let query = q;
  if (!query) {
    if (filter === "important") query = "is:important newer_than:14d -category:promotions -category:social";
    else if (filter === "unread") query = "is:unread newer_than:7d";
    else if (filter === "needsreply") query = "is:unread newer_than:14d -category:promotions -category:social -category:updates";
    else query = "newer_than:7d";
  }

  const res = await callAction("list_emails", { query, max });
  if (!res.ok) {
    return NextResponse.json({ emails: [], error: res.error ?? `n8n ${res.status}`, configured: !!process.env.N8N_WEBHOOK_URL }, { status: 200 });
  }
  const emails = unwrapItems(res.data)
    .filter((r) => r && (r.id || r.subject || r.snippet))
    .map(normalizeGmail)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  return NextResponse.json({ emails, configured: true, query });
}
