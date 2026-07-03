"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, Segmented, Empty, Chip, Input, Btn } from "@/components/ui";
import { IconSearch, IconReply } from "@/components/icons";
import { fetchInbox } from "@/lib/life";
import type { EmailMsg } from "@/lib/types";

type Filter = "important" | "needsreply" | "unread" | "all";

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 604800) return `${Math.round(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function avatarColor(name: string, series: string[]): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return series[h % series.length];
}

export default function InboxPage() {
  const { c } = useTheme();
  const [filter, setFilter] = useState<Filter>("important");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [emails, setEmails] = useState<EmailMsg[]>([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (f: Filter, query: string) => {
    setLoading(true);
    fetchInbox(f, query, 30).then((r) => {
      setEmails(r.emails);
      setConfigured(r.configured);
      setError(r.error ?? null);
      setLoading(false);
    });
  };

  useEffect(() => { load(filter, submitted); /* eslint-disable-next-line */ }, [filter, submitted]);

  return (
    <div>
      <PageTitle
        title="Inbox"
        sub="What actually needs you — important mail, things to reply to"
        right={
          <Segmented value={filter} onChange={(v) => { setQ(""); setSubmitted(""); setFilter(v); }} options={[
            { label: "Important", value: "important" },
            { label: "To reply", value: "needsreply" },
            { label: "Unread", value: "unread" },
            { label: "All", value: "all" },
          ]} />
        }
      />

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q); }} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: c.muted, display: "flex" }}><IconSearch size={16} /></span>
          <Input placeholder="Search all mail (e.g. from:bank, invoice, flight)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <Btn type="submit" variant="soft">Search</Btn>
      </form>

      {!configured ? (
        <Card>
          <Empty icon="✉️" title="Gmail not connected yet"
            hint={<>Publish the n8n backend, set <code>N8N_WEBHOOK_URL</code>, and make sure the Gmail credential has read access. Then your important mail shows here.</>} />
        </Card>
      ) : (
        <Card pad={8}>
          {loading ? (
            <div style={{ color: c.muted, fontSize: 13, padding: 20 }}>Reading your inbox…</div>
          ) : emails.length === 0 ? (
            <Empty icon="📭" title={submitted ? "No matches" : "Inbox zero here"} hint={submitted ? "Try a different search." : "Nothing needs you in this view."} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {emails.map((m, i) => (
                <div key={m.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 10px",
                  borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1,
                    background: `${avatarColor(m.fromName, c.series)}22`, color: avatarColor(m.fromName, c.series),
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800,
                  }}>
                    {m.fromName.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: m.unread ? 800 : 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.fromName}</span>
                      {m.important && <Chip color={c.warning}>★</Chip>}
                      {m.unread && <span style={{ width: 7, height: 7, borderRadius: 4, background: c.accent, flexShrink: 0 }} />}
                      <span style={{ marginLeft: "auto", fontSize: 11, color: c.muted, flexShrink: 0 }}>{ago(m.date)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: m.unread ? 700 : 500, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subject}</div>
                    <div style={{ fontSize: 12, color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.snippet}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                      <Link href={`/jarvis?q=${encodeURIComponent(`Draft a reply to the email from ${m.fromName} about "${m.subject}"`)}`} className="pressable" style={{
                        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 650,
                        color: c.accent, background: c.accentSoft, borderRadius: 8, padding: "4px 10px",
                      }}>
                        <IconReply size={13} /> Reply with Jarvis
                      </Link>
                      <Link href={`/jarvis?q=${encodeURIComponent(`Summarise the email from ${m.fromName} about "${m.subject}" and tell me if it needs action`)}`} className="pressable" style={{
                        fontSize: 11.5, fontWeight: 650, color: c.text2, background: c.surface2, borderRadius: 8, padding: "4px 10px",
                      }}>
                        Summarise
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && configured && <div style={{ fontSize: 11.5, color: c.muted, padding: "8px 10px" }}>Note: {error}</div>}
        </Card>
      )}

      <div style={{ marginTop: 14, fontSize: 12.5, color: c.muted }}>
        Tip: ask Jarvis things like <Link href={`/jarvis?q=${encodeURIComponent("Do I have any emails I need to reply to today?")}`} style={{ color: c.accent }}>&ldquo;anything I need to reply to today?&rdquo;</Link>
      </div>
    </div>
  );
}
