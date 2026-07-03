import { NextRequest, NextResponse } from "next/server";
import { callAction, unwrapItems } from "@/lib/server/n8n";
import { normalizeGmail } from "@/lib/server/gmail";
import type { Subscription } from "@/lib/types";

export const maxDuration = 60;

// GET /api/subscriptions — scans recent receipt/renewal emails and uses the
// LLM to extract recurring subscriptions the user is paying for.
export async function GET(_req: NextRequest) {
  const query = 'newer_than:120d (subscription OR "your receipt" OR "payment received" OR "renews" OR "renewal" OR "invoice" OR "billed" OR "auto-renew" OR "membership")';
  const res = await callAction("list_emails", { query, max: 60 });
  if (!res.ok) {
    return NextResponse.json({ subscriptions: [], error: res.error ?? `n8n ${res.status}`, configured: !!process.env.N8N_WEBHOOK_URL }, { status: 200 });
  }
  const emails = unwrapItems(res.data).filter((r) => r && (r.subject || r.snippet)).map(normalizeGmail);
  if (emails.length === 0) {
    return NextResponse.json({ subscriptions: [], configured: true, scanned: 0 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ subscriptions: [], error: "ANTHROPIC_API_KEY not set (needed to extract subscriptions)", configured: true, scanned: emails.length }, { status: 200 });
  }

  const digest = emails.slice(0, 60).map((e) =>
    `- from="${e.fromName} <${e.from.replace(/^.*</, "").replace(/>.*$/, "")}>" subject="${e.subject}" date=${e.date.slice(0, 10)} snippet="${e.snippet.slice(0, 140)}"`,
  ).join("\n");

  const prompt = `From these receipt/renewal emails, extract the user's RECURRING subscriptions only (skip one-off purchases, shipping notices, and marketing). Merge duplicates per merchant, keeping the most recent. Output STRICT JSON: {"subscriptions":[{"merchant","amount"(number or null),"currency"(ISO like USD/EUR/TRY, default USD),"cadence"("monthly"|"yearly"|"weekly"|"unknown"),"lastSeen"(YYYY-MM-DD),"category"(e.g. Streaming, Software, Cloud, News, Fitness, Music, Other),"cancelHint"(short how-to-cancel note or null),"emailQuery"(a gmail search string to find this merchant's emails, e.g. from:netflix.com)}]}. No prose.

Emails:
${digest}`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) throw new Error(`anthropic ${aiRes.status}`);
    const j = await aiRes.json();
    const text = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { subscriptions: [] };
    const subs: Subscription[] = (parsed.subscriptions ?? []).map((s: Partial<Subscription>) => ({
      merchant: s.merchant ?? "Unknown",
      amount: typeof s.amount === "number" ? s.amount : null,
      currency: s.currency ?? "USD",
      cadence: (["monthly", "yearly", "weekly", "unknown"].includes(s.cadence as string) ? s.cadence : "unknown") as Subscription["cadence"],
      lastSeen: s.lastSeen ?? emails[0].date.slice(0, 10),
      category: s.category ?? "Other",
      cancelHint: s.cancelHint ?? null,
      emailQuery: s.emailQuery ?? `${s.merchant}`,
    }));
    return NextResponse.json({ subscriptions: subs, configured: true, scanned: emails.length });
  } catch (e) {
    return NextResponse.json({ subscriptions: [], error: String(e), configured: true, scanned: emails.length }, { status: 200 });
  }
}
