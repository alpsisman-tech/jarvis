import type { EmailMsg } from "../types";

// Normalize a message from the n8n Gmail node ("getAll", simple mode) into our
// EmailMsg. That mode returns fields like: From/To/Subject (capitalized
// strings), snippet, internalDate (ms), labels ([{id,name}]) — plus other
// shapes across versions, so read every field defensively.
export function normalizeGmail(raw: Record<string, unknown>): EmailMsg {
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") return raw[k];
    }
    // payload.headers array form
    const arr = (raw.payload as { headers?: { name: string; value: string }[] })?.headers;
    if (Array.isArray(arr)) {
      for (const k of keys) {
        const found = arr.find((x) => x.name?.toLowerCase() === k.toLowerCase());
        if (found?.value) return found.value;
      }
    }
    // nested headers object
    const hdrs = raw.headers as Record<string, unknown> | undefined;
    if (hdrs) for (const k of keys) { const v = hdrs[k] ?? hdrs[k.toLowerCase()]; if (v) return v; }
    return undefined;
  };

  // Sender: string "Name <addr>" or object { text, value:[{address,name}] }
  const fromField = pick("From", "from");
  let fromRaw = "";
  let fromName = "";
  if (fromField && typeof fromField === "object") {
    const v = (fromField as { text?: string; value?: { address?: string; name?: string }[] });
    const first = v.value?.[0];
    fromRaw = v.text ?? first?.address ?? "";
    fromName = (first?.name || "").trim() || (first?.address || "").split("@")[0];
  } else {
    fromRaw = String(fromField ?? "");
    const nameMatch = fromRaw.match(/^\s*"?([^"<]*?)"?\s*<([^>]*)>\s*$/);
    if (nameMatch) fromName = (nameMatch[1] || "").trim() || nameMatch[2].split("@")[0];
    else fromName = fromRaw.includes("@") ? fromRaw.split("@")[0] : fromRaw;
  }
  fromName = fromName.replace(/^["']|["']$/g, "").trim() || (fromRaw ? fromRaw : "Unknown");

  // Labels: ["UNREAD"] or [{id,name}]
  const labelsRaw = (raw.labels ?? raw.labelIds ?? []) as unknown[];
  const labels = (Array.isArray(labelsRaw) ? labelsRaw : []).map((l) =>
    typeof l === "string" ? l : String((l as { id?: string; name?: string })?.id ?? (l as { name?: string })?.name ?? ""),
  ).filter(Boolean).map((s) => s.toUpperCase());

  // Date
  let iso = "";
  const internal = Number(raw.internalDate);
  if (internal > 0) iso = new Date(internal).toISOString();
  else {
    const ds = String(pick("Date", "date") ?? "");
    const d = new Date(ds);
    iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  return {
    id: String(raw.id ?? raw.messageId ?? Math.random().toString(36).slice(2)),
    threadId: String(raw.threadId ?? raw.id ?? ""),
    from: fromRaw,
    fromName,
    subject: String(pick("Subject", "subject") ?? "(no subject)"),
    snippet: String(raw.snippet ?? raw.text ?? "").replace(/‌/g, "").trim().slice(0, 240),
    date: iso,
    unread: labels.includes("UNREAD"),
    important: labels.includes("IMPORTANT") || labels.includes("STARRED"),
    labels,
  };
}
