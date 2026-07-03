"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, StatTile, Chip, Btn } from "@/components/ui";
import { Ring, Sparkline } from "@/components/charts";
import WeatherCard from "@/components/WeatherCard";
import {
  getRecovery, getSleep, getStrain, getWorkouts,
  getNutrition, getHydration, logHydration, getSettings, saveWorkout, getMode,
} from "@/lib/store";
import { todayISO, addDays, fmtHours, fmtInt, uid, weekdayShort, fmtShort, mondayOf } from "@/lib/format";
import { exerciseName } from "@/lib/exercises";
import type { RecoveryDay, SleepDay, StrainDay, Workout, NutritionLog, HydrationLog } from "@/lib/types";

function recoveryColor(score: number, c: { good: string; warning: string; critical: string }) {
  return score >= 67 ? c.good : score >= 34 ? c.warning : c.critical;
}

export default function TodayPage() {
  const { c } = useTheme();
  const [recovery, setRecovery] = useState<RecoveryDay[]>([]);
  const [sleep, setSleep] = useState<SleepDay[]>([]);
  const [strain, setStrain] = useState<StrainDay[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState<Workout[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [hydration, setHydration] = useState<HydrationLog[]>([]);
  const [demoMode, setDemoMode] = useState(true);

  const settings = getSettings();
  const today = todayISO();

  const load = async () => {
    const [r, s, st, ww, w, n, h] = await Promise.all([
      getRecovery(14), getSleep(14), getStrain(14),
      getWorkouts(mondayOf(today), today),
      getWorkouts(today, addDays(today, 7)),
      getNutrition(today, today), getHydration(today, today),
    ]);
    setRecovery(r); setSleep(s); setStrain(st); setWeekWorkouts(ww);
    setWorkouts(w); setNutrition(n); setHydration(h);
    setDemoMode(getMode() === "local");
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const rec = recovery[recovery.length - 1];
  const sl = sleep[sleep.length - 1];
  const st = strain[strain.length - 1];
  const doneThisWeek = weekWorkouts.filter((w) => w.status === "completed").length;
  const todayWorkout = workouts.find((w) => w.date === today);
  const upcoming = workouts.filter((w) => w.date > today).slice(0, 6);

  const kcal = nutrition.reduce((s, n) => s + n.calories, 0);
  const protein = nutrition.reduce((s, n) => s + n.protein_g, 0);
  const water = hydration.reduce((s, h) => s + h.ml, 0);

  const verdict = useMemo(() => {
    if (!rec) return null;
    if (rec.recovery_score >= 67) return { text: "Green light — a good day to push intensity.", color: c.good };
    if (rec.recovery_score >= 34) return { text: "Moderate recovery — train, but keep something in reserve.", color: c.warning };
    return { text: "Low recovery — favour technique work, zone 2 or rest.", color: c.critical };
  }, [rec, c]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const quickWater = async (ml: number) => {
    await logHydration({ id: uid(), date: today, ml });
    load();
  };

  const completeToday = async () => {
    if (!todayWorkout) return;
    await saveWorkout({ ...todayWorkout, status: "completed" });
    load();
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: c.text }}>
            {greeting}, {settings.name}.
          </h1>
          {demoMode && <Chip color={c.warning}>demo data — connect integrations in Settings</Chip>}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: c.muted }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {verdict && <span style={{ color: verdict.color }}> · {verdict.text}</span>}
        </p>
      </div>

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile
          label="Recovery (WHOOP)"
          value={rec ? `${rec.recovery_score}%` : "–"}
          sub={rec ? `HRV ${rec.hrv_ms} ms · RHR ${rec.resting_hr} bpm` : undefined}
          subColor={rec ? recoveryColor(rec.recovery_score, c) : undefined}
          spark={<Sparkline data={recovery.map((r) => r.recovery_score)} color={rec ? recoveryColor(rec.recovery_score, c) : c.accent} />}
        />
        <StatTile
          label="Sleep"
          value={sl ? fmtHours(sl.hours) : "–"}
          sub={sl ? `${sl.performance_pct}% of ${fmtHours(sl.need_hours)} need` : undefined}
          spark={<Sparkline data={sleep.map((s) => s.hours)} color={c.series[4]} />}
        />
        <StatTile
          label="Day strain (WHOOP)"
          value={st ? st.strain.toFixed(1) : "–"}
          sub={st ? `avg HR ${st.avg_hr} · max ${st.max_hr} bpm` : undefined}
          spark={<Sparkline data={strain.map((s) => s.strain)} color={c.series[2]} />}
        />
        <StatTile
          label="Burned today"
          value={st ? `${fmtInt(st.calories)}` : "–"}
          sub={`kcal · ${doneThisWeek} session${doneThisWeek === 1 ? "" : "s"} this week`}
          spark={<Sparkline data={strain.map((s) => s.calories)} color={c.series[1]} />}
        />
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card
          title="Today's session"
          right={todayWorkout && todayWorkout.status === "planned" && (
            <Btn onClick={completeToday} style={{ padding: "5px 12px", fontSize: 12 }}>Mark done</Btn>
          )}
        >
          {todayWorkout ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{todayWorkout.title}</span>
                <Chip color={todayWorkout.status === "completed" ? c.good : todayWorkout.status === "skipped" ? c.muted : c.accent}>
                  {todayWorkout.status}
                </Chip>
              </div>
              {todayWorkout.exercises.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {todayWorkout.exercises.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: c.text2 }}>{exerciseName(e.exercise_id)}</span>
                      <span style={{ color: c.muted, fontVariantNumeric: "tabular-nums" }}>
                        {e.sets.length} × {e.sets[0]?.reps}{e.sets[0]?.weight_kg ? ` @ ${e.sets[0].weight_kg}kg` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: c.muted }}>
                  {todayWorkout.type === "run" ? "Run day — check the weather card for conditions." : "No exercises planned."}
                </div>
              )}
              <Link href="/training" style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, color: c.accent }}>
                Open training plan →
              </Link>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: c.muted }}>
              Rest day — nothing on the calendar.{" "}
              <Link href="/jarvis" style={{ color: c.accent }}>Ask Jarvis to plan something →</Link>
            </div>
          )}
          {upcoming.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 6 }}>NEXT UP</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {upcoming.map((w) => (
                  <div key={w.id} style={{ background: c.surface2, borderRadius: 10, padding: "8px 12px", minWidth: 90, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: c.muted }}>{weekdayShort(w.date)} {fmtShort(w.date)}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{w.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <WeatherCard compact />
      </div>

      <div className="grid2">
        <Card title="Fuel today" right={<Link href="/nutrition" style={{ fontSize: 12.5, color: c.accent }}>Log food →</Link>}>
          <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 8 }}>
            <Ring value={kcal} max={settings.targets.calories} color={c.series[2]} label="Calories" sub={`of ${settings.targets.calories}`} />
            <Ring value={protein} max={settings.targets.protein_g} color={c.series[1]} label="Protein" sub={`of ${settings.targets.protein_g}g`} />
            <Ring value={water} max={settings.targets.water_ml} color={c.series[0]} label="Water" sub={`of ${settings.targets.water_ml}ml`} fmt={(v) => `${(v / 1000).toFixed(1)}L`} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            {[250, 330, 500].map((ml) => (
              <Btn key={ml} variant="ghost" onClick={() => quickWater(ml)} style={{ fontSize: 12 }}>
                +{ml}ml 💧
              </Btn>
            ))}
          </div>
        </Card>

        <Card title="Ask Jarvis">
          <div style={{ fontSize: 13, color: c.text2, lineHeight: 1.6, marginBottom: 12 }}>
            Your agent has live access to everything on this screen — recovery, training history,
            runs, nutrition, weather and your project repos — and can act on it.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Should I push hard today or recover?", "Plan next week around my recovery", "Summarise my week in one paragraph"].map((q) => (
              <Link key={q} href={`/jarvis?q=${encodeURIComponent(q)}`} className="pressable" style={{
                background: c.surface2, borderRadius: 12, padding: "11px 13px",
                fontSize: 12.5, color: c.text2, border: `1px solid ${c.border}`,
              }}>
                ✦ {q}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
