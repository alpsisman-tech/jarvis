"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, RangePicker, StatTile } from "@/components/ui";
import { LineChart, StackedBars, Bars, Sparkline } from "@/components/charts";
import { getRecovery, getSleep, getStrain, getGarminDaily } from "@/lib/store";
import { fmtShort, fmtHours } from "@/lib/format";
import type { RecoveryDay, SleepDay, StrainDay, GarminDaily } from "@/lib/types";

export default function HealthPage() {
  const { c } = useTheme();
  const [days, setDays] = useState(30);
  const [recovery, setRecovery] = useState<RecoveryDay[]>([]);
  const [sleep, setSleep] = useState<SleepDay[]>([]);
  const [strain, setStrain] = useState<StrainDay[]>([]);
  const [garmin, setGarmin] = useState<GarminDaily[]>([]);

  useEffect(() => {
    Promise.all([getRecovery(days), getSleep(days), getStrain(days), getGarminDaily(days)])
      .then(([r, s, st, g]) => { setRecovery(r); setSleep(s); setStrain(st); setGarmin(g); });
  }, [days]);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const stats = useMemo(() => ({
    rec: avg(recovery.map((r) => r.recovery_score)),
    hrv: avg(recovery.map((r) => r.hrv_ms)),
    rhr: avg(recovery.map((r) => r.resting_hr)),
    sleepH: avg(sleep.map((s) => s.hours)),
    strain: avg(strain.map((s) => s.strain)),
    vo2: garmin.length ? garmin[garmin.length - 1].vo2max : null,
  }), [recovery, sleep, strain, garmin]);

  return (
    <div>
      <PageTitle
        title="Health"
        sub="WHOOP recovery, sleep and strain · Garmin daily physiology"
        right={<RangePicker value={days} onChange={setDays} />}
      />

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile label={`Avg recovery (${days}d)`} value={`${Math.round(stats.rec)}%`}
          spark={<Sparkline data={recovery.map((r) => r.recovery_score)} color={c.good} />} />
        <StatTile label="Avg HRV" value={`${Math.round(stats.hrv)} ms`} sub={`RHR ${Math.round(stats.rhr)} bpm`}
          spark={<Sparkline data={recovery.map((r) => r.hrv_ms)} color={c.series[0]} />} />
        <StatTile label="Avg sleep" value={fmtHours(stats.sleepH)}
          spark={<Sparkline data={sleep.map((s) => s.hours)} color={c.series[4]} />} />
        <StatTile label="VO₂max (Garmin)" value={stats.vo2 ? String(stats.vo2) : "–"} sub={`avg strain ${stats.strain.toFixed(1)}`}
          spark={<Sparkline data={garmin.map((g) => g.vo2max ?? 0)} color={c.series[1]} />} />
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
        <Card title="Day strain (WHOOP)">
          <Bars data={strain.map((s) => ({ x: s.date, y: s.strain }))} color={c.series[2]}
            xFmt={fmtShort} yFmt={(v) => v.toFixed(1)} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Steps (Garmin)">
          <Bars data={garmin.map((g) => ({ x: g.date, y: g.steps }))} color={c.series[1]}
            xFmt={fmtShort} yFmt={(v) => `${Math.round(v / 1000)}k`} />
        </Card>
        <Card title="Body battery vs stress">
          <LineChart
            data={garmin.map((g) => ({ x: g.date, y: g.body_battery }))}
            series2={garmin.map((g) => ({ x: g.date, y: g.stress_avg }))}
            color={c.series[1]} color2={c.series[7]} xFmt={fmtShort} yMin={0} yMax={100}
            label="Body battery" label2="Stress"
          />
        </Card>
      </div>
    </div>
  );
}
