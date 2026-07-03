"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import type { CalEvent } from "@/lib/types";
import { isoDate } from "@/lib/format";

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mon=0
  const d = new Date(first);
  d.setDate(1 - dow);
  return d;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function evColor(e: CalEvent, c: { accent: string }): string {
  return e.color ?? c.accent;
}

export function MonthGrid({ events, year, month, onPick }: {
  events: CalEvent[]; year: number; month: number; onPick: (day: string) => void;
}) {
  const { c } = useTheme();
  const grid = useMemo(() => {
    const start = startOfMonthGrid(year, month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = e.start.slice(0, 10);
      (m.get(key) ?? m.set(key, []).get(key)!).push(e);
    }
    return m;
  }, [events]);

  const today = isoDate(new Date());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        {days.map((d) => (
          <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, textAlign: "center", letterSpacing: 0.5 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {grid.map((d, i) => {
          const key = isoDate(d);
          const inMonth = d.getMonth() === month;
          const evs = byDay.get(key) ?? [];
          const isToday = key === today;
          return (
            <button key={i} onClick={() => onPick(key)} className="pressable" style={{
              minHeight: 76, textAlign: "left", padding: "6px 6px 5px", borderRadius: 11,
              background: isToday ? c.accentSoft : inMonth ? c.surface2 : "transparent",
              border: `1px solid ${isToday ? c.accent + "55" : "transparent"}`,
              cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 3,
              opacity: inMonth ? 1 : 0.4, overflow: "hidden",
            }}>
              <span style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? c.accent : c.text2 }}>{d.getDate()}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {evs.slice(0, 3).map((e) => (
                  <div key={e.id} style={{
                    fontSize: 9.5, lineHeight: 1.25, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    borderLeft: `2px solid ${evColor(e, c)}`, paddingLeft: 4,
                  }}>
                    {e.title}
                  </div>
                ))}
                {evs.length > 3 && <div style={{ fontSize: 9, color: c.muted }}>+{evs.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Agenda({ events }: { events: CalEvent[] }) {
  const { c } = useTheme();
  const grouped = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of [...events].sort((a, b) => (a.start < b.start ? -1 : 1))) {
      const key = e.start.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return [...m.entries()];
  }, [events]);

  const today = isoDate(new Date());

  if (grouped.length === 0) {
    return <div style={{ color: c.muted, fontSize: 13, padding: "20px 4px" }}>Nothing scheduled in this range.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {grouped.map(([day, evs]) => {
        const d = new Date(day + "T12:00:00");
        const isToday = day === today;
        return (
          <div key={day}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? c.accent : c.text }}>
                {isToday ? "Today" : d.toLocaleDateString("en-GB", { weekday: "long" })}
              </span>
              <span style={{ fontSize: 11.5, color: c.muted }}>{d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {evs.map((e) => {
                const inner = (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 13px",
                    background: c.surface2, borderRadius: 12, borderLeft: `3px solid ${evColor(e, c)}`,
                  }}>
                    <span style={{ fontSize: 11.5, color: c.muted, width: 48, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {e.allDay ? "all day" : fmtTime(e.start)}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 650, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                      {(e.location || e.description) && (
                        <div style={{ fontSize: 11.5, color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {e.location || e.description}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: evColor(e, c), textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                      {e.source === "google" ? "" : e.source}
                    </span>
                  </div>
                );
                return e.link && e.link.startsWith("/")
                  ? <Link key={e.id} href={e.link} className="pressable">{inner}</Link>
                  : e.link
                  ? <a key={e.id} href={e.link} target="_blank" rel="noreferrer" className="pressable">{inner}</a>
                  : <div key={e.id}>{inner}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
