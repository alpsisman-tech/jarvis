"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, Chip, Btn, Empty } from "@/components/ui";
import { Ring } from "@/components/charts";
import { IconReply, IconMail } from "@/components/icons";
import WeatherCard from "@/components/WeatherCard";
import { getRecovery, getWorkouts, getNutrition, getHydration, logHydration, getSettings, getMode } from "@/lib/store";
import { fetchCalendar, fetchInbox, fetchTrainingEvents } from "@/lib/life";
import { syncNow } from "@/lib/autoSync";
import { todayISO, uid } from "@/lib/format";
import type { RecoveryDay, CalEvent, EmailMsg } from "@/lib/types";

function recColor(s: number, c: { good: string; warning: string; critical: string }) {
  return s >= 67 ? c.good : s >= 34 ? c.warning : c.critical;
}
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

export default function HomePage() {
  const { c } = useTheme();
  const [rec, setRec] = useState<RecoveryDay | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [emails, setEmails] = useState<EmailMsg[]>([]);
  const [gmailOn, setGmailOn] = useState(true);
  const [gcalOn, setGcalOn] = useState(true);
  const [kcal, setKcal] = useState(0);
  const [water, setWater] = useState(0);
  const [demoMode, setDemoMode] = useState(true);

  const settings = getSettings();
  const today = todayISO();

  const load = async () => {
    // RFC3339 with timezone — Google's Calendar API rejects offset-less times
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const dayEnd = new Date(new Date().setHours(23, 59, 59, 0)).toISOString();
    const twoDays = new Date(Date.now() + 2 * 86400000).toISOString();
    const [r, cal, tr, inbox, nut, hyd] = await Promise.all([
      getRecovery(2), // recovery is a morning metric — fall back to yesterday's
      fetchCalendar(dayStart, twoDays),
      fetchTrainingEvents(dayStart, dayEnd, c.series),
      fetchInbox("important", "", 5),
      getNutrition(today, today),
      getHydration(today, today),
    ]);
    setRec(r[r.length - 1] ?? null);
    setEvents([...cal.events, ...tr].filter((e) => e.start.slice(0, 10) === today).sort((a, b) => (a.start < b.start ? -1 : 1)));
    setGcalOn(cal.configured);
    setEmails(inbox.emails.slice(0, 4));
    setGmailOn(inbox.configured);
    setKcal(nut.reduce((s, n) => s + n.calories, 0));
    setWater(hyd.reduce((s, h) => s + h.ml, 0));
    setDemoMode(getMode() === "local");
  };

  useEffect(() => {
    load();
    syncNow().then((did) => { if (did) load(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const verdict = useMemo(() => {
    if (!rec) return null;
    if (rec.recovery_score >= 67) return "You're recovered — a strong day ahead.";
    if (rec.recovery_score >= 34) return "Moderate recovery — pace yourself today.";
    return "Low recovery — keep it easy where you can.";
  }, [rec]);

  const quickWater = async (ml: number) => { await logHydration({ id: uid(), date: today, ml }); load(); };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: c.text, letterSpacing: -0.5 }}>{greeting}, {settings.name}.</h1>
          {demoMode && <Chip color={c.warning}>demo — connect in Settings</Chip>}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: c.muted }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {verdict && <span style={{ color: c.text2 }}> · {verdict}</span>}
        </p>
      </div>

      {/* Jarvis command bar */}
      <Link href="/jarvis" className="pressable" style={{ textDecoration: "none", display: "block", marginBottom: 14 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16,
          background: c.accentGrad, color: "#fff", boxShadow: `0 10px 30px ${c.glow}`,
        }}>
          <span style={{ fontSize: 20 }}>✦</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, opacity: 0.96 }}>Ask Jarvis to plan, schedule, book, email or find anything…</span>
          <span style={{ marginLeft: "auto", fontSize: 18, opacity: 0.9 }}>→</span>
        </div>
      </Link>

      <div className="grid2" style={{ marginBottom: 14 }}>
        {/* Today's agenda */}
        <Card title="Today" right={<Link href="/calendar" style={{ fontSize: 12.5, color: c.accent }}>Calendar →</Link>}>
          {events.length === 0 ? (
            <Empty icon="🗓️" title="Nothing scheduled today" hint={gcalOn ? <Link href={`/jarvis?q=${encodeURIComponent("Add something to my calendar today")}`} style={{ color: c.accent }}>Ask Jarvis to add something →</Link> : "Connect Google Calendar to see your events."} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {events.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: c.surface2, borderRadius: 11, borderLeft: `3px solid ${e.color ?? c.accent}` }}>
                  <span style={{ fontSize: 11.5, color: c.muted, width: 46, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{e.allDay ? "all day" : fmtTime(e.start)}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
                  {e.source !== "google" && <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: e.color ?? c.accent, textTransform: "uppercase" }}>{e.source}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Needs you (inbox) */}
        <Card title="Needs you" right={<Link href="/inbox" style={{ fontSize: 12.5, color: c.accent }}>Inbox →</Link>}>
          {!gmailOn ? (
            <Empty icon="✉️" title="Connect Gmail" hint="Set up the n8n backend to surface important mail here." />
          ) : emails.length === 0 ? (
            <Empty icon="✅" title="You're clear" hint="Nothing important waiting." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {emails.map((m) => (
                <Link key={m.id} href={`/jarvis?q=${encodeURIComponent(`Draft a reply to ${m.fromName} about "${m.subject}"`)}`} className="pressable" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: c.surface2, borderRadius: 11 }}>
                  <IconMail size={16} color={c.muted} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: m.unread ? 750 : 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.fromName}</div>
                    <div style={{ fontSize: 11.5, color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subject}</div>
                  </div>
                  <IconReply size={15} color={c.accent} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid3" style={{ marginBottom: 14 }}>
        {/* Recovery glance */}
        <Card title="Recovery" onClick={undefined}>
          <Link href="/fitness" style={{ display: "flex", justifyContent: "center", textDecoration: "none" }}>
            <Ring value={rec?.recovery_score ?? 0} max={100} size={116} color={rec ? recColor(rec.recovery_score, c) : c.accent}
              label={rec ? "WHOOP" : "no data"} fmt={(v) => (rec ? `${Math.round(v)}%` : "–")} />
          </Link>
        </Card>

        {/* Fuel */}
        <Card title="Fuel today" right={<Link href="/nutrition" style={{ fontSize: 12.5, color: c.accent }}>Log →</Link>}>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <Ring value={kcal} max={settings.targets.calories} size={92} color={c.series[2]} label="kcal" sub={`/${settings.targets.calories}`} />
            <Ring value={water} max={settings.targets.water_ml} size={92} color={c.series[3]} label="water" fmt={(v) => `${(v / 1000).toFixed(1)}L`} sub={`/${(settings.targets.water_ml / 1000).toFixed(1)}L`} />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
            {[250, 500].map((ml) => <Btn key={ml} variant="ghost" onClick={() => quickWater(ml)} style={{ fontSize: 12, padding: "6px 12px" }}>+{ml}ml 💧</Btn>)}
          </div>
        </Card>

        <WeatherCard compact />
      </div>
    </div>
  );
}
