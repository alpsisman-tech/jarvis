"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, StatTile } from "@/components/ui";
import { Ring, Sparkline } from "@/components/charts";
import { IconHeart, IconDumbbell, IconBolt, IconApple } from "@/components/icons";
import { getRecovery, getSleep, getStrain, getRuns, getWorkouts } from "@/lib/store";
import { syncNow } from "@/lib/autoSync";
import { fmtHours, todayISO, daysAgoISO, weekdayShort } from "@/lib/format";
import type { RecoveryDay, SleepDay, StrainDay, RunActivity } from "@/lib/types";

const SECTIONS = [
  { href: "/health", label: "Health", icon: IconHeart, desc: "Recovery, HRV, sleep & strain" },
  { href: "/training", label: "Training", icon: IconDumbbell, desc: "Muscle map, plan & session log" },
  { href: "/runs", label: "Runs", icon: IconBolt, desc: "Pace, splits, HR zones & PRs" },
  { href: "/nutrition", label: "Nutrition", icon: IconApple, desc: "Calories, macros & hydration" },
];

function recColor(s: number, c: { good: string; warning: string; critical: string }) {
  return s >= 67 ? c.good : s >= 34 ? c.warning : c.critical;
}

export default function FitnessPage() {
  const { c } = useTheme();
  const [rec, setRec] = useState<RecoveryDay[]>([]);
  const [sleep, setSleep] = useState<SleepDay[]>([]);
  const [strain, setStrain] = useState<StrainDay[]>([]);
  const [runs, setRuns] = useState<RunActivity[]>([]);
  const [weekDone, setWeekDone] = useState(0);

  useEffect(() => {
    syncNow().then(() => {});
    Promise.all([
      getRecovery(14), getSleep(7), getStrain(7), getRuns(28),
      getWorkouts(daysAgoISO(6), todayISO()),
    ]).then(([r, s, st, ru, w]) => {
      setRec(r); setSleep(s); setStrain(st); setRuns(ru);
      setWeekDone(w.filter((x) => x.status === "completed").length);
    });
  }, []);

  const today = rec[rec.length - 1];
  const sl = sleep[sleep.length - 1];
  const weekKm = runs.filter((r) => r.date >= daysAgoISO(6)).reduce((s, r) => s + r.distance_km, 0);

  return (
    <div>
      <PageTitle title="Fitness" sub="Your training & health, powered by WHOOP and Garmin" />

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Ring value={today?.recovery_score ?? 0} max={100} size={116} color={today ? recColor(today.recovery_score, c) : c.accent}
            label="Recovery" sub="WHOOP" fmt={(v) => (today ? `${Math.round(v)}%` : "–")} />
          <div style={{ flex: 1, minWidth: 200, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Mini label="Sleep" value={sl ? fmtHours(sl.hours) : "–"} c={c} />
            <Mini label="Day strain" value={strain[strain.length - 1] ? strain[strain.length - 1].strain.toFixed(1) : "–"} c={c} />
            <Mini label="This week" value={`${weekKm.toFixed(0)} km`} sub={`${weekDone} sessions`} c={c} />
            <Mini label="HRV" value={today ? `${today.hrv_ms} ms` : "–"} c={c} />
          </div>
          <Sparkline data={rec.map((r) => r.recovery_score)} color={today ? recColor(today.recovery_score, c) : c.accent} width={120} height={40} />
        </div>
      </Card>

      <div className="grid2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="pressable" style={{ textDecoration: "none" }}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: c.accentSoft, color: c.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={23} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15.5, fontWeight: 750, color: c.text }}>{s.label}</div>
                    <div style={{ fontSize: 12.5, color: c.muted }}>{s.desc}</div>
                  </div>
                  <span style={{ marginLeft: "auto", color: c.muted, fontSize: 18 }}>›</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, sub, c }: { label: string; value: string; sub?: string; c: { muted: string; text: string; text2: string } }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.text, letterSpacing: -0.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: c.text2 }}>{sub}</div>}
    </div>
  );
}
