"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, RangePicker, StatTile } from "@/components/ui";
import { LineChart, StackedBars, Bars, Sparkline } from "@/components/charts";
import { getRecovery, getSleep, getStrain, getWorkouts } from "@/lib/store";
import { fmtShort, fmtHours, daysAgoISO, todayISO, mondayOf, fmtInt } from "@/lib/format";
import type { RecoveryDay, SleepDay, StrainDay, Workout } from "@/lib/types";

export default function HealthPage() {
  const { c } = useTheme();
  const [days, setDays] = useState(30);
  const [recovery, setRecovery] = useState<RecoveryDay[]>([]);
  const [sleep, setSleep] = useState<SleepDay[]>([]);
  const [strain, setStrain] = useState<StrainDay[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    Promise.all([
      getRecovery(days), getSleep(days), getStrain(days),
      getWorkouts(daysAgoISO(days - 1), todayISO()),
    ]).then(([r, s, st, w]) => { setRecovery(r); setSleep(s); setStrain(st); setWorkouts(w); });
  }, [days]);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const stats = useMemo(() => ({
    rec: avg(recovery.map((r) => r.recovery_score)),
    hrv: avg(recovery.map((r) => r.hrv_ms)),
    rhr: avg(recovery.map((r) => r.resting_hr)),
    sleepH: avg(sleep.map((s) => s.hours)),
    strain: avg(strain.map((s) => s.strain)),
    kcal: avg(strain.map((s) => s.calories)),
    sessions: workouts.filter((w) => w.status === "completed").length,
  }), [recovery, sleep, strain, workouts]);

  const sessionsPerWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of workouts) {
      if (w.status !== "completed") continue;
      const wk = mondayOf(w.date);
      map.set(wk, (map.get(wk) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [workouts]);

  return (
    <div>
      <PageTitle
        title="Health"
        sub="WHOOP recovery, sleep, strain and training load"
        right={<RangePicker value={days} onChange={setDays} />}
      />

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile label={`Avg recovery (${days}d)`} value={`${Math.round(stats.rec)}%`}
          spark={<Sparkline data={recovery.map((r) => r.recovery_score)} color={c.good} />} />
        <StatTile label="Avg HRV" value={`${Math.round(stats.hrv)} ms`} sub={`RHR ${Math.round(stats.rhr)} bpm`}
          spark={<Sparkline data={recovery.map((r) => r.hrv_ms)} color={c.series[0]} />} />
        <StatTile label="Avg sleep" value={fmtHours(stats.sleepH)}
          spark={<Sparkline data={sleep.map((s) => s.hours)} color={c.series[4]} />} />
        <StatTile label="Avg day strain" value={stats.strain.toFixed(1)}
          sub={`${fmtInt(stats.kcal)} kcal/day · ${stats.sessions} sessions`}
          spark={<Sparkline data={strain.map((s) => s.strain)} color={c.series[2]} />} />
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Recovery score">
          <LineChart data={recovery.map((r) => ({ x: r.date, y: r.recovery_score }))}
            color={c.good} xFmt={fmtShort} yMin={0} yMax={100} fill label="Recovery %" />
        </Card>
        <Card title="HRV vs resting HR">
          <LineChart
            data={recovery.map((r) => ({ x: r.date, y: r.hrv_ms }))}
            series2={recovery.map((r) => ({ x: r.date, y: r.resting_hr }))}
            color={c.series[0]} color2={c.series[5]} xFmt={fmtShort}
            label="HRV (ms)" label2="Resting HR (bpm)"
          />
        </Card>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Sleep stages">
          <StackedBars
            data={sleep.map((s) => ({
              x: s.date,
              parts: [
                { v: s.deep_hours, color: c.series[0], label: "Deep" },
                { v: s.rem_hours, color: c.series[4], label: "REM" },
                { v: s.light_hours, color: c.series[1], label: "Light" },
                { v: s.awake_hours, color: c.axis, label: "Awake" },
              ],
            }))}
            xFmt={fmtShort} yFmt={(v) => `${v.toFixed(1)}h`}
          />
        </Card>
        <Card title="Day strain">
          <Bars data={strain.map((s) => ({ x: s.date, y: s.strain }))} color={c.series[2]}
            xFmt={fmtShort} yFmt={(v) => v.toFixed(1)} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Calories burned">
          <Bars data={strain.map((s) => ({ x: s.date, y: s.calories }))} color={c.series[1]}
            xFmt={fmtShort} yFmt={(v) => `${(v / 1000).toFixed(1)}k`} />
        </Card>
        <Card title="Training sessions per week">
          <Bars data={sessionsPerWeek.map(([wk, n]) => ({ x: wk, y: n }))} color={c.series[0]}
            xFmt={fmtShort} yFmt={(v) => String(Math.round(v))} />
        </Card>
      </div>
    </div>
  );
}
