// Server-side helper to invoke the n8n "Jarvis Actions" webhook. Every
// life-feature route (calendar, inbox, subscriptions) and the agent go
// through here. n8n holds the Google Calendar + Gmail credentials.

export interface N8nResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

export async function callAction(action: string, payload: Record<string, unknown> = {}): Promise<N8nResult> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    return { ok: false, status: 501, data: null, error: "N8N_WEBHOOK_URL not configured" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep as text */ }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 502, data: null, error: String(e) };
  }
}

// n8n's "respond with all items" returns an array of {json:...} or bare objects.
export function unwrapItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((x) => (x && typeof x === "object" && "json" in x ? (x as { json: Record<string, unknown> }).json : x)) as Record<string, unknown>[];
  }
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}
