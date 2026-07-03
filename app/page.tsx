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
import { syncNow, lastSyncAgoLabel } from "@/lib/autoSync";
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
  const [syncing, setSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

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
    setSyncLabel(lastSyncAgoLabel());
  };

  useEffect(() => {
    load();
    // Opportunistic sync on open so "today" is actually today
    syncNow().then((did) => { if (did) load(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setSyncing(true);
    await syncNow(true);
    await load();
    setSyncing(false);
  };

  // Honest "today": only surface intraday numbers when the row IS today's.
  const recLatest = recovery[recovery.length - 1];
  const rec = recLatest; // recovery is a morning metric — show latest, label if stale
  const recIsToday = recLatest?.date === today;
  const slLatest = sleep[sleep.length - 1];
  const sl = slLatest;
  const slIsToday = slLatest?.date === today;
  const stToday = strain.find((s) => s.date === today) ?? null;

  const doneThisWeek = weekWorkouts.filter((w) => w.status === "completed").length;
  const todayWorkout = workouts.find((w) => w.date === today);
  const upcoming = workouts.filter((w) => w.date > today).slice(0, 6);

  const kcalIn = nutrition.reduce((s, n) => s + n.calories, 0);
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

  const heroColor = rec ? recoveryColor(rec.recovery_score, c) : c.accent;

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: c.text, letterSpacing: -0.4 }}>
              {greeting}, {settings.name}.
            </h1>
            {demoMode && <Chip color={c.warning}>demo data — connect in Settings</Chip>}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: c.muted }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {!demoMode && (
          <button onClick={refresh} className="pressable" style={{
            display: "flex", alignItems: "center", gap: 6, background: c.surface2,
            border: `1px solid ${c.border}`, borderRadius: 999, padding: "6px 12px",
            fontSize: 11.5, color: c.text2, cursor: "pointer", fontFamily: "inherit",
          }}>
            <span style={{
              display: "inline-block",
              animation: syncing ? "spin-slow 1.2s linear infinite" : "none",
            }}>⟳</span>
            {syncing ? "Syncing…" : syncLabel ? `Synced ${syncLabel}` : "Sync"}
          </button>
        )}
      </div>

      {/* ── Hero: recovery ── */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Ring
            value={rec?.recovery_score ?? 0} max={100} size={140} color={heroColor}
            label={recIsToday ? "Recovery today" : rec ? `Recovery · ${weekdayShort(rec.date)}` : "Recovery"}
            sub="WHOOP" fmt={(v) => (rec ? `${Math.round(v)}%` : "–")}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            {verdict && (
              <div style={{ fontSize: 16.5, fontWeight: 700, color: c.text, lineHeight: 1.4, marginBottom: 10 }}>
                {verdict.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {rec && <Chip color={c.text2} bg={c.surface2}>HRV <b style={{ color: c.text }}>{rec.hrv_ms} ms</b></Chip>}
              {rec && <Chip color={c.text2} bg={c.surface2}>RHR <b style={{ color: c.text }}>{rec.resting_hr} bpm</b></Chip>}
              {sl && <Chip color={c.text2} bg={c.surface2}>Sleep <b style={{ color: c.text }}>{fmtHours(sl.hours)}</b></Chip>}
              {stToday && <Chip color={c.text2} bg={c.surface2}>Strain <b style={{ color: c.text }}>{stToday.strain.toFixed(1)}</b></Chip>}
            </div>
            {!recIsToday && rec && (
              <div style={{ fontSize: 11.5, color: c.muted, marginTop: 10 }}>
                Latest reading is from {weekdayShort(rec.date)} — today's arrives after your WHOOP syncs overnight data.
              </div>
            )}
          </div>
          <div style={{ minWidth: 120 }}>
            <Sparkline data={recovery.map((r) => r.recovery_score)} color={heroColor} width={130} height={44} />
            <div style={{ fontSize: 10.5, color: c.muted, marginTop: 4, textAlign: "right" }}>14-day trend</div>
          </div>
        </div>
      </Card>

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile
          label={slIsToday ? "Last night" : "Sleep"}
          value={sl ? fmtHours(sl.hours) : "–"}
          sub={sl ? `${sl.performance_pct}% of need${slIsToday ? "" : ` · ${weekdayShort(sl.date)}`}` : "no data yet"}
          spark={<Sparkline data={sleep.map((s) => s.hours)} color={c.series[4]} />}
        />
        <StatTile
          label="Day strain"
          value={stToday ? stToday.strain.toFixed(1) : "–"}
          sub={stToday ? `avg HR ${stToday.avg_hr} bpm` : "no reading yet today"}
          spark={<Sparkline data={strain.map((s) => s.strain)} color={c.series[2]} />}
        />
        <StatTile
          label="Burned today"
          value={stToday ? fmtInt(stToday.calories) : "–"}
          sub={stToday ? "kcal so far (live at last sync)" : "no reading yet today"}
          spark={<Sparkline data={strain.map((s) => s.calories)} color={c.series[1]} />}
        />
        <StatTile
          label="This week"
          value={String(doneThisWeek)}
          sub={`session${doneThisWeek === 1 ? "" : "s"} done · ${upcoming.length} planned ahead`}
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
              {todayWorkout.notes && (
                <div style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>{todayWorkout.notes}</div>
              )}
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
                  {todayWorkout.type === "run" ? "Run day — check the weather card for conditions." : "No exercises listed."}
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
              <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 6, letterSpacing: 1 }}>NEXT UP</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {upcoming.map((w) => (
                  <div key={w.id} style={{ background: c.surface2, borderRadius: 10, padding: "8px 12px", minWidth: 92, flexShrink: 0 }}>
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
            <Ring value={kcalIn} max={settings.targets.calories} color={c.series[2]} label="Calories" sub={`of ${settings.targets.calories}`} />
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
            Live access to everything on this screen — plus your Google Calendar and Gmail.
            It plans, schedules, logs, reminds and books.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Should I push hard today or recover?", "What's on my calendar this week?", "Plan next week around my recovery"].map((q) => (
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
