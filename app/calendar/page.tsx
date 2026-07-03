"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, Segmented, Btn, Empty, Chip } from "@/components/ui";
import { MonthGrid, Agenda } from "@/components/CalendarView";
import { fetchCalendar, fetchTrainingEvents } from "@/lib/life";
import type { CalEvent } from "@/lib/types";
import { isoDate } from "@/lib/format";

export default function CalendarPage() {
  const { c } = useTheme();
  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [training, setTraining] = useState<CalEvent[]>([]);
  const [gcalConfigured, setGcalConfigured] = useState(true);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date(cursor.y, cursor.m - 1, 1);
    const to = new Date(cursor.y, cursor.m + 2, 0);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }, [cursor]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCalendar(range.fromISO, range.toISO),
      fetchTrainingEvents(range.fromISO, range.toISO, c.series),
    ]).then(([cal, tr]) => {
      setEvents(cal.events);
      setGcalConfigured(cal.configured);
      setGcalError(cal.error ?? null);
      setTraining(tr);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.fromISO, range.toISO]);

  const all = useMemo(() => [...events, ...training], [events, training]);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const shift = (n: number) => setCursor((cur) => {
    const d = new Date(cur.y, cur.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const pickedEvents = picked ? all.filter((e) => e.start.slice(0, 10) === picked).sort((a, b) => (a.start < b.start ? -1 : 1)) : [];

  return (
    <div>
      <PageTitle
        title="Calendar"
        sub="Google Calendar, workouts and runs in one place"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Segmented value={view} onChange={setView} options={[{ label: "Month", value: "month" }, { label: "Agenda", value: "agenda" }]} />
            <Link href={`/jarvis?q=${encodeURIComponent("Add an event to my calendar")}`}><Btn variant="soft">✦ New event</Btn></Link>
          </div>
        }
      />

      {!gcalConfigured && (
        <Card style={{ marginBottom: 14 }}>
          <Empty icon="🗓️" title="Google Calendar not connected yet"
            hint={<>Publish the n8n backend and set <code>N8N_WEBHOOK_URL</code> to see your Google events here. Your workouts and runs already show below.</>} />
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => shift(-1)} className="pressable" style={navBtn(c)}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 800, color: c.text, minWidth: 150, textAlign: "center" }}>{monthLabel}</span>
            <button onClick={() => shift(1)} className="pressable" style={navBtn(c)}>›</button>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: c.muted, flexWrap: "wrap" }}>
            <Chip color={c.accent}>events</Chip>
            <Chip color={c.series[3]}>workouts</Chip>
            <Chip color={c.series[1]}>runs</Chip>
          </div>
        </div>

        {loading ? (
          <div style={{ color: c.muted, fontSize: 13, padding: 20 }}>Loading…</div>
        ) : view === "month" ? (
          <MonthGrid events={all} year={cursor.y} month={cursor.m} onPick={setPicked} />
        ) : (
          <Agenda events={all.filter((e) => e.start.slice(0, 7) === `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`)} />
        )}
        {gcalError && gcalConfigured && (
          <div style={{ fontSize: 11.5, color: c.muted, marginTop: 10 }}>Calendar note: {gcalError}</div>
        )}
      </Card>

      {picked && (
        <div className="sheet-root" onClick={() => setPicked(null)} style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s both" }}>
          <div onClick={(e) => e.stopPropagation()} className="sheet" style={{ background: c.surface, borderTop: `1px solid ${c.border}`, animation: "sheet-up 0.3s cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: c.axis, margin: "0 auto 14px" }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 12 }}>
              {new Date(picked + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {pickedEvents.length === 0
              ? <Empty title="Nothing scheduled" hint={<Link href={`/jarvis?q=${encodeURIComponent(`Add an event on ${picked}`)}`} style={{ color: c.accent }}>Ask Jarvis to add something →</Link>} />
              : <Agenda events={pickedEvents} />}
          </div>
        </div>
      )}
    </div>
  );
}

function navBtn(c: { surface2: string; border: string; text2: string }): React.CSSProperties {
  return { background: c.surface2, border: `1px solid ${c.border}`, color: c.text2, borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: "pointer", fontFamily: "inherit" };
}
