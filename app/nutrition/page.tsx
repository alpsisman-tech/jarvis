"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, Btn, Chip, Input, Select, StatTile } from "@/components/ui";
import { Ring, StackedBars, Bars } from "@/components/charts";
import {
  getNutrition, getHydration, logNutrition, logHydration, deleteNutrition, getSettings,
} from "@/lib/store";
import { todayISO, daysAgoISO, uid, fmtShort } from "@/lib/format";
import type { NutritionLog, HydrationLog, Meal } from "@/lib/types";

const QUICK_FOODS: [string, Meal, number, number, number, number][] = [
  ["Oats, whey & banana", "breakfast", 520, 38, 68, 12],
  ["Eggs & toast", "breakfast", 420, 24, 34, 20],
  ["Chicken, rice & veg", "lunch", 680, 52, 72, 16],
  ["Protein shake", "snack", 180, 30, 6, 3],
  ["Greek yogurt & almonds", "snack", 280, 22, 14, 14],
  ["Salmon, potatoes & salad", "dinner", 720, 46, 58, 30],
];

export default function NutritionPage() {
  const { c } = useTheme();
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [hyd, setHyd] = useState<HydrationLog[]>([]);
  const [weekLogs, setWeekLogs] = useState<NutritionLog[]>([]);
  const [weekHyd, setWeekHyd] = useState<HydrationLog[]>([]);
  const [form, setForm] = useState({ name: "", meal: "lunch" as Meal, calories: "", protein_g: "", carbs_g: "", fat_g: "" });

  const settings = getSettings();
  const today = todayISO();

  const load = async () => {
    const [n, h, wn, wh] = await Promise.all([
      getNutrition(today, today), getHydration(today, today),
      getNutrition(daysAgoISO(13), today), getHydration(daysAgoISO(13), today),
    ]);
    setLogs(n); setHyd(h); setWeekLogs(wn); setWeekHyd(wh);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const totals = useMemo(() => ({
    kcal: logs.reduce((s, n) => s + n.calories, 0),
    protein: logs.reduce((s, n) => s + n.protein_g, 0),
    carbs: logs.reduce((s, n) => s + n.carbs_g, 0),
    fat: logs.reduce((s, n) => s + n.fat_g, 0),
    water: hyd.reduce((s, h) => s + h.ml, 0),
  }), [logs, hyd]);

  const daily = useMemo(() => {
    const map = new Map<string, { p: number; cb: number; f: number; water: number }>();
    for (let i = 13; i >= 0; i--) map.set(daysAgoISO(i), { p: 0, cb: 0, f: 0, water: 0 });
    for (const n of weekLogs) {
      const d = map.get(n.date); if (!d) continue;
      d.p += n.protein_g; d.cb += n.carbs_g; d.f += n.fat_g;
    }
    for (const h of weekHyd) {
      const d = map.get(h.date); if (!d) continue;
      d.water += h.ml;
    }
    return [...map.entries()];
  }, [weekLogs, weekHyd]);

  const quickAdd = async (f: (typeof QUICK_FOODS)[number]) => {
    await logNutrition({ id: uid(), date: today, meal: f[1], name: f[0], calories: f[2], protein_g: f[3], carbs_g: f[4], fat_g: f[5] });
    load();
  };

  const submit = async () => {
    if (!form.name.trim() || !form.calories) return;
    await logNutrition({
      id: uid(), date: today, meal: form.meal, name: form.name.trim(),
      calories: Number(form.calories) || 0, protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0, fat_g: Number(form.fat_g) || 0,
    });
    setForm({ name: "", meal: "lunch", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
    load();
  };

  const t = settings.targets;
  const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div>
      <PageTitle title="Nutrition & Hydration" sub="Daily fuel vs targets — log manually, via Jarvis, or import from Bevel (Settings)" />

      <div className="grid4" style={{ marginBottom: 14 }}>
        <StatTile label="Calories" value={`${totals.kcal}`} sub={`of ${t.calories} target`} subColor={totals.kcal > t.calories * 1.1 ? c.serious : c.text2} />
        <StatTile label="Protein" value={`${totals.protein}g`} sub={`of ${t.protein_g}g target`} subColor={totals.protein >= t.protein_g ? c.good : c.text2} />
        <StatTile label="Carbs / Fat" value={`${totals.carbs} / ${totals.fat}g`} sub={`targets ${t.carbs_g} / ${t.fat_g}g`} />
        <StatTile label="Water" value={`${(totals.water / 1000).toFixed(1)}L`} sub={`of ${(t.water_ml / 1000).toFixed(1)}L target`} subColor={totals.water >= t.water_ml ? c.good : c.text2} />
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Log food">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {QUICK_FOODS.map((f) => (
              <button key={f[0]} onClick={() => quickAdd(f)} style={{
                background: c.surface2, color: c.text2, border: `1px solid ${c.border}`,
                borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>
                + {f[0]} <span style={{ color: c.muted }}>({f[2]} kcal)</span>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
            <Input placeholder="Food / meal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value as Meal })}>
              {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
            {([["calories", "kcal"], ["protein_g", "protein g"], ["carbs_g", "carbs g"], ["fat_g", "fat g"]] as const).map(([k, ph]) => (
              <Input key={k} type="number" placeholder={ph} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ))}
          </div>
          <Btn onClick={submit} disabled={!form.name.trim() || !form.calories}>Log it</Btn>
        </Card>

        <Card title="Hydration">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Ring value={totals.water} max={t.water_ml} size={130} color={c.series[0]} label="Today" sub={`of ${(t.water_ml / 1000).toFixed(1)}L`} fmt={(v) => `${(v / 1000).toFixed(1)}L`} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[250, 330, 500, 750].map((ml) => (
              <Btn key={ml} variant="ghost" onClick={async () => { await logHydration({ id: uid(), date: today, ml }); load(); }}>
                +{ml}ml
              </Btn>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 6 }}>LAST 14 DAYS (L)</div>
            <Bars data={daily.map(([d, v]) => ({ x: d, y: v.water / 1000 }))} color={c.series[0]} height={120}
              xFmt={fmtShort} yFmt={(v) => `${v.toFixed(1)}`} />
          </div>
        </Card>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Macros — last 14 days (g)">
          <StackedBars
            data={daily.map(([d, v]) => ({
              x: d,
              parts: [
                { v: v.p, color: c.series[1], label: "Protein" },
                { v: v.cb, color: c.series[2], label: "Carbs" },
                { v: v.f, color: c.series[4], label: "Fat" },
              ],
            }))}
            xFmt={fmtShort} yFmt={(v) => `${Math.round(v)}g`}
          />
        </Card>
        <Card title="Today's log">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {logs.length === 0 && <div style={{ color: c.muted, fontSize: 13 }}>Nothing logged yet today.</div>}
            {logs.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, background: c.surface2, borderRadius: 10, padding: "8px 12px" }}>
                <Chip color={c.accent}>{n.meal}</Chip>
                <span style={{ fontSize: 13, color: c.text, flex: 1 }}>{n.name}</span>
                <span style={{ fontSize: 12, color: c.text2, fontVariantNumeric: "tabular-nums" }}>
                  {n.calories} kcal · P{n.protein_g} C{n.carbs_g} F{n.fat_g}
                </span>
                <button onClick={async () => { await deleteNutrition(n.id); load(); }} style={{
                  background: "none", border: "none", color: c.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                }}>✕</button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
