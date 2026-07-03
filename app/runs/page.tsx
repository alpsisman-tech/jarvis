"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, RangePicker, StatTile, Chip } from "@/components/ui";
import { Bars, LineChart, HBars } from "@/components/charts";
import { getRuns } from "@/lib/store";
import { weeklyMileage, personalRecords, zoneTotals, paceTrend } from "@/lib/runsAnalytics";
import { fmtPace, fmtShort, fmtDuration, fmtDay } from "@/lib/format";
import type { RunActivity } from "@/lib/types";

export default function RunsPage() {
  const { c } = useTheme();
  const [days, setDays] = useState(90);
  const [runs, setRuns] = useState<RunActivity[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { getRuns(days).then(setRuns); }, [days]);

  const weeks = useMemo(() => weeklyMileage(runs), [runs]);
  const prs = useMemo(() => personalRecords(runs), [runs]);
  const zones = useMemo(() => zoneTotals(runs), [runs]);
  const trend = useMemo(() => paceTrend(runs), [runs]);

  const totalKm = runs.reduce((s, r) => s + r.distance_km, 0);
  const thisWeek = weeks[weeks.length - 1];
  const avgPace = runs.length ? runs.reduce((s, r) => s + r.avg_pace_sec, 0) / runs.length : 0;
  const paceDelta = trend.length > 8 ? trend[trend.length - 1].paceSec - trend[7].paceSec : 0;

  const ZONE_LABELS = ["Z1 recovery", "Z2 aerobic", "Z3 tempo", "Z4 threshold", "Z5 max"];
  const zoneRows = zones.map((sec, i) => ({
    label: ZONE_LABELS[i],
    value: Math.round(sec / 60),
    color: [c.series[1], c.series[0], c.series[2], c.series[7], c.series[5]][i],
  }));

  return (
    <div>
      <PageTitle
        title="Runs"
        sub="Garmin activities with pace, heart rate and split analysis"
        right={<RangePicker value={days} onChange={setDays} options={[{ label: "30d", days: 30 }, { label: "90d", days: 90 }, { label: "120d", days: 120 }]} />}
      />

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile label={`Distance (${days}d)`} value={`${totalKm.toFixed(0)} km`} sub={`${runs.length} runs`} />
        <StatTile label="This week" value={thisWeek ? `${thisWeek.km.toFixed(1)} km` : "0 km"} sub={thisWeek ? `${thisWeek.runs} run${thisWeek.runs === 1 ? "" : "s"} · ${fmtDuration(thisWeek.timeSec)}` : undefined} />
        <StatTile label="Avg pace" value={fmtPace(avgPace)}
          sub={paceDelta !== 0 ? `${paceDelta < 0 ? "▲ faster" : "▼ slower"} ${Math.abs(Math.round(paceDelta))}s/km vs. earlier` : undefined}
          subColor={paceDelta < 0 ? c.good : c.serious} />
        <StatTile label="Best 5K+ pace" value={prs[0] ? fmtPace(prs[0].paceSec) : "–"} sub={prs[0] ? fmtShort(prs[0].run.date) : undefined} />
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Weekly mileage">
          <Bars data={weeks.map((w) => ({ x: w.weekStart, y: w.km }))} color={c.series[0]}
            xFmt={fmtShort} yFmt={(v) => `${Math.round(v)}km`} />
        </Card>
        <Card title="Pace trend (rolling 4-run avg)">
          <LineChart data={trend.map((t) => ({ x: t.date, y: t.paceSec }))} color={c.series[1]}
            xFmt={fmtShort} yFmt={(v) => fmtPace(v).replace("/km", "")} fill />
        </Card>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Time in HR zones (minutes)">
          <HBars rows={zoneRows} fmt={(v) => `${v} min`} />
        </Card>
        <Card title="Personal records">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prs.map((pr) => (
              <div key={pr.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>🏅</span>
                <span style={{ color: c.text2, flex: 1 }}>{pr.label}</span>
                <span style={{ fontWeight: 700, color: c.text, fontVariantNumeric: "tabular-nums" }}>
                  {pr.label === "Longest run" ? `${pr.run.distance_km.toFixed(1)} km` : fmtPace(pr.paceSec)}
                </span>
                <span style={{ color: c.muted, fontSize: 11.5 }}>{fmtShort(pr.run.date)}</span>
              </div>
            ))}
            {prs.length === 0 && <div style={{ color: c.muted, fontSize: 13 }}>No runs in range.</div>}
          </div>
        </Card>
      </div>

      <Card title="Activity log">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...runs].reverse().map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="pressable"
                style={{
                  width: "100%", textAlign: "left", background: c.surface2, border: "none",
                  borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: c.muted, width: 86 }}>{fmtDay(r.date)}</span>
                  <span style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>{r.name}</span>
                  <Chip color={c.accent}>{r.distance_km.toFixed(1)} km</Chip>
                  <span style={{ marginLeft: "auto", fontSize: 12.5, color: c.text2, fontVariantNumeric: "tabular-nums" }}>
                    {fmtPace(r.avg_pace_sec)} · {fmtDuration(r.duration_sec)} · {r.avg_hr} bpm
                  </span>
                </div>
              </button>
              {open === r.id && (
                <div style={{ padding: "12px 14px", border: `1px solid ${c.border}`, borderTop: "none", borderRadius: "0 0 12px 12px" }}>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5, color: c.text2, marginBottom: 10 }}>
                    <span>Cadence <b style={{ color: c.text }}>{r.cadence} spm</b></span>
                    <span>Elevation <b style={{ color: c.text }}>{r.elevation_gain_m} m</b></span>
                    <span>Max HR <b style={{ color: c.text }}>{r.max_hr} bpm</b></span>
                    <span>Calories <b style={{ color: c.text }}>{r.calories}</b></span>
                    <span>Training effect <b style={{ color: c.text }}>{r.training_effect}</b></span>
                  </div>
                  <SplitsChart run={r} />
                </div>
              )}
            </div>
          ))}
          {runs.length === 0 && <div style={{ color: c.muted, fontSize: 13 }}>No runs in this range.</div>}
        </div>
      </Card>
    </div>
  );
}

function SplitsChart({ run }: { run: RunActivity }) {
  const { c } = useTheme();
  if (run.splits.length === 0) return null;
  const fastest = Math.min(...run.splits.map((s) => s.pace_sec));
  return (
    <div>
      <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 6 }}>SPLITS (km · pace · HR)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {run.splits.map((s) => {
          const width = (fastest / s.pace_sec) * 100;
          const isFastest = s.pace_sec === fastest;
          return (
            <div key={s.km} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 22, color: c.muted, fontVariantNumeric: "tabular-nums" }}>{s.km}</span>
              <div style={{ flex: 1, height: 14, background: c.grid, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${width}%`, height: "100%", borderRadius: 4,
                  background: isFastest ? c.series[1] : c.series[0],
                }} />
              </div>
              <span style={{ width: 52, textAlign: "right", color: c.text, fontWeight: isFastest ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                {fmtPace(s.pace_sec).replace("/km", "")}
              </span>
              <span style={{ width: 56, textAlign: "right", color: c.muted, fontVariantNumeric: "tabular-nums" }}>{s.hr} bpm</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
