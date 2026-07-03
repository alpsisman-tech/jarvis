import type { EmailMsg } from "../types";

// Normalize a Gmail message (from the n8n Gmail node, "getAll" with metadata)
// into our EmailMsg shape. The Gmail node returns varied shapes across
// versions, so read defensively.
export function normalizeGmail(raw: Record<string, unknown>): EmailMsg {
  const headers = (raw.headers ?? raw.payload ?? {}) as Record<string, unknown>;
  const h = (k: string): string => {
    const direct = headers[k] ?? headers[k.toLowerCase()];
    if (typeof direct === "string") return direct;
    // payload.headers array form
    const arr = (raw.payload as { headers?: { name: string; value: string }[] })?.headers;
    if (Array.isArray(arr)) {
      const found = arr.find((x) => x.name?.toLowerCase() === k.toLowerCase());
      if (found) return found.value;
    }
    return "";
  };
  // The Gmail node returns `from` either as a string or as
  // { text, value: [{ address, name }] }.
  let fromRaw = "";
  let fromName = "";
  const fromObj = raw.from as { text?: string; value?: { address?: string; name?: string }[] } | string | undefined;
  if (fromObj && typeof fromObj === "object") {
    const v = fromObj.value?.[0];
    fromRaw = fromObj.text ?? v?.address ?? "";
    fromName = (v?.name || "").trim() || (v?.address || "").split("@")[0];
  } else {
    fromRaw = String(fromObj ?? h("From") ?? "");
    const nameMatch = fromRaw.match(/^\s*"?([^"<]*?)"?\s*<?([^>]*)>?\s*$/);
    fromName = (nameMatch?.[1] || "").trim() || fromRaw.split("@")[0];
  }
  if (!fromName) fromName = "Unknown";
  const labels = (raw.labelIds ?? raw.labels ?? []) as string[];
  const labelArr = Array.isArray(labels) ? labels.map(String) : [];
  const dateStr = String(raw.date ?? raw.internalDate ?? h("Date") ?? "");
  let iso = dateStr;
  const asNum = Number(raw.internalDate);
  if (asNum > 0) iso = new Date(asNum).toISOString();
  else { const d = new Date(dateStr); if (!isNaN(d.getTime())) iso = d.toISOString(); }
  return {
    id: String(raw.id ?? raw.messageId ?? Math.random().toString(36).slice(2)),
    threadId: String(raw.threadId ?? raw.id ?? ""),
    from: fromRaw,
    fromName,
    subject: String(raw.subject ?? h("Subject") ?? "(no subject)"),
    snippet: String(raw.snippet ?? raw.text ?? "").slice(0, 240),
    date: iso,
    unread: labelArr.includes("UNREAD"),
    important: labelArr.includes("IMPORTANT") || labelArr.includes("STARRED"),
    labels: labelArr,
  };
}
