// Opportunistic WHOOP sync: fires when the app opens (cloud mode only),
// throttled so repeated opens don't hammer the API. This is what keeps
// "today" numbers live even before the n8n schedule is running.

import { getMode, getToken } from "./store";

const KEY = "jarvis-last-sync";

export function lastSyncAt(): number | null {
  if (typeof window === "undefined") return null;
  const v = Number(localStorage.getItem(KEY) || 0);
  return v > 0 ? v : null;
}

export function lastSyncAgoLabel(): string | null {
  const at = lastSyncAt();
  if (!at) return null;
  const min = Math.round((Date.now() - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

export async function syncNow(force = false, minGapMin = 10): Promise<boolean> {
  if (typeof window === "undefined" || getMode() !== "cloud" || !getToken()) return false;
  const last = Number(localStorage.getItem(KEY) || 0);
  if (!force && Date.now() - last < minGapMin * 60_000) return false;
  localStorage.setItem(KEY, String(Date.now()));
  try {
    const res = await fetch("/api/whoop/sync?days=3", {
      method: "POST",
      headers: { authorization: `Bearer ${getToken()}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
