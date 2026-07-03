"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, StatTile, Empty, Chip, Btn } from "@/components/ui";
import { fetchSubscriptions } from "@/lib/life";
import type { Subscription } from "@/lib/types";

const SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", TRY: "₺" };

function monthly(s: Subscription): number {
  if (s.amount == null) return 0;
  if (s.cadence === "yearly") return s.amount / 12;
  if (s.cadence === "weekly") return s.amount * 4.33;
  return s.amount;
}

export default function MoneyPage() {
  const { c } = useTheme();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(0);

  // The scan hits Gmail + the LLM, so cache results for 30 min per session.
  const CACHE_KEY = "jarvis-subs-cache";
  const load = (force = false) => {
    if (!force && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Date.now() - cached.at < 30 * 60_000) {
            setSubs(cached.subs); setConfigured(cached.configured);
            setScanned(cached.scanned); setError(cached.error ?? null);
            setLoading(false);
            return;
          }
        }
      } catch { /* rescan */ }
    }
    setLoading(true);
    fetchSubscriptions().then((r) => {
      setSubs(r.subscriptions);
      setConfigured(r.configured);
      setError(r.error ?? null);
      setScanned(r.scanned ?? 0);
      setLoading(false);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), subs: r.subscriptions, configured: r.configured, scanned: r.scanned ?? 0, error: r.error ?? null }));
      } catch { /* ignore */ }
    });
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const sorted = useMemo(() => [...subs].sort((a, b) => monthly(b) - monthly(a)), [subs]);
  // Currencies don't sum — total in the dominant one, count the rest separately
  const currency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of subs) counts.set(s.currency, (counts.get(s.currency) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
  }, [subs]);
  const mainSubs = useMemo(() => subs.filter((s) => s.currency === currency), [subs, currency]);
  const otherCount = subs.length - mainSubs.length;
  const totalMonthly = useMemo(() => mainSubs.reduce((s, x) => s + monthly(x), 0), [mainSubs]);
  const sym = SYM[currency] ?? currency + " ";

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of mainSubs) m.set(s.category, (m.get(s.category) ?? 0) + monthly(s));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [mainSubs]);

  return (
    <div>
      <PageTitle
        title="Money"
        sub="What you're paying for — found by scanning your receipts"
        right={<Btn variant="ghost" onClick={() => load(true)} disabled={loading}>{loading ? "Scanning…" : "↻ Rescan"}</Btn>}
      />

      {!configured ? (
        <Card><Empty icon="💳" title="Gmail not connected yet" hint={<>Connect Gmail via the n8n backend (<code>N8N_WEBHOOK_URL</code>) so Jarvis can scan your receipts for subscriptions.</>} /></Card>
      ) : loading ? (
        <Card><div style={{ color: c.muted, fontSize: 13, padding: 20 }}>Scanning your recent receipts and renewals… this takes a few seconds.</div></Card>
      ) : subs.length === 0 ? (
        <Card><Empty icon="🔍" title="No subscriptions detected" hint={error ? `Note: ${error}` : `Scanned ${scanned} recent receipt-like emails and found no recurring charges. Try Rescan, or ask Jarvis to look deeper.`} /></Card>
      ) : (
        <>
          <div className="grid3" style={{ marginBottom: 14 }}>
            <StatTile label="Monthly total" value={`${sym}${totalMonthly.toFixed(2)}`}
              sub={`${mainSubs.length} in ${currency}${otherCount > 0 ? ` · +${otherCount} in other currencies` : ""}`} accent={c.accent} />
            <StatTile label="Yearly" value={`${sym}${(totalMonthly * 12).toFixed(0)}`} sub="projected annual spend" />
            <StatTile label="Priciest" value={sorted[0]?.merchant ?? "–"} sub={sorted[0]?.amount != null ? `${sym}${monthly(sorted[0]).toFixed(2)}/mo` : undefined} />
          </div>

          {byCategory.length > 1 && (
            <Card title="By category" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byCategory.map(([cat, amt]) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: c.text2 }}>{cat}</span>
                      <span style={{ color: c.text, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{sym}{amt.toFixed(2)}/mo</span>
                    </div>
                    <div style={{ height: 7, background: c.grid, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(amt / totalMonthly) * 100}%`, height: "100%", background: c.accentGrad, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="All subscriptions" pad={8}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sorted.map((s, i) => (
                <div key={`${s.merchant}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 10px",
                  borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{s.merchant}</span>
                      <Chip color={c.muted} bg={c.surface2}>{s.category}</Chip>
                    </div>
                    <div style={{ fontSize: 11.5, color: c.muted, marginTop: 2 }}>
                      last charge {new Date(s.lastSeen + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {s.cancelHint ? ` · ${s.cancelHint}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c.text, fontVariantNumeric: "tabular-nums" }}>
                      {s.amount != null ? `${sym}${s.amount.toFixed(2)}` : "—"}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.muted }}>{s.cadence}</div>
                  </div>
                  <Link href={`/jarvis?q=${encodeURIComponent(`Help me cancel my ${s.merchant} subscription`)}`} className="pressable" style={{
                    fontSize: 11.5, fontWeight: 650, color: c.critical, background: `${c.critical}18`, borderRadius: 8, padding: "5px 10px", flexShrink: 0,
                  }}>
                    Cancel
                  </Link>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ marginTop: 12, fontSize: 11.5, color: c.muted }}>
            Detected by AI from {scanned} recent receipt emails — double-check before cancelling. Ask Jarvis to dig deeper on any of them.
          </div>
        </>
      )}
    </div>
  );
}
