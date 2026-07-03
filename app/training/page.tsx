"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, RangePicker, Btn, Chip, Input, Select } from "@/components/ui";
import { HBars } from "@/components/charts";
import MuscleMap from "@/components/MuscleMap";
import { getWorkouts, saveWorkout, deleteWorkout } from "@/lib/store";
import { muscleVolume, muscleRecency } from "@/lib/muscleVolume";
import { EXERCISES, MUSCLE_GROUPS, MUSCLE_LABELS, exerciseName } from "@/lib/exercises";
import { todayISO, addDays, daysAgoISO, fmtDay, uid, weekdayShort } from "@/lib/format";
import type { Workout, WorkoutType, MuscleGroup } from "@/lib/types";

const TYPE_OPTIONS: WorkoutType[] = ["push", "pull", "legs", "upper", "lower", "full", "run", "mobility", "other"];

interface DraftExercise { exercise_id: string; sets: number; reps: number; weight_kg: number }

export default function TrainingPage() {
  const { c } = useTheme();
  const [volDays, setVolDays] = useState(28);
  const [past, setPast] = useState<Workout[]>([]);
  const [plan, setPlan] = useState<Workout[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ date: string; title: string; type: WorkoutType; exercises: DraftExercise[] }>({
    date: todayISO(), title: "", type: "push", exercises: [],
  });

  const today = todayISO();

  const load = async () => {
    const [p, f] = await Promise.all([
      getWorkouts(daysAgoISO(90), today),
      getWorkouts(daysAgoISO(7), addDays(today, 14)),
    ]);
    setPast(p);
    setPlan(f.sort((a, b) => a.date.localeCompare(b.date)));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const volWindow = useMemo(() => past.filter((w) => w.date >= daysAgoISO(volDays - 1)), [past, volDays]);
  const volumes = useMemo(() => muscleVolume(volWindow), [volWindow]);
  const recency = useMemo(() => muscleRecency(past, today), [past, today]);

  const neglected = MUSCLE_GROUPS
    .filter((m) => recency[m] >= 5)
    .sort((a, b) => recency[b] - recency[a]);

  const setStatus = async (w: Workout, status: Workout["status"]) => {
    await saveWorkout({ ...w, status });
    load();
  };
  const remove = async (w: Workout) => {
    await deleteWorkout(w.id);
    load();
  };

  const submitDraft = async () => {
    if (!draft.title.trim()) return;
    const w: Workout = {
      id: uid(), date: draft.date, title: draft.title.trim(), type: draft.type,
      status: draft.date <= today ? "completed" : "planned",
      exercises: draft.exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: Array.from({ length: Math.max(1, e.sets) }, () => ({ reps: e.reps, weight_kg: e.weight_kg })),
      })),
      duration_min: null, notes: null,
    };
    await saveWorkout(w);
    setEditing(false);
    setDraft({ date: todayISO(), title: "", type: "push", exercises: [] });
    load();
  };

  const volRows = MUSCLE_GROUPS
    .map((m) => ({ m, v: volumes[m] }))
    .sort((a, b) => b.v - a.v)
    .map(({ m, v }) => ({
      label: MUSCLE_LABELS[m],
      value: Math.round(v * 10) / 10,
      color: c.series[0],
      detail: recency[m] === Infinity ? "never" : recency[m] === 0 ? "today" : `${recency[m]}d ago`,
    }));

  return (
    <div>
      <PageTitle
        title="Training"
        sub="Muscle-group coverage, session log and the week's plan"
        right={<Btn onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "+ Add workout"}</Btn>}
      />

      {editing && (
        <Card title="New workout" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ width: 160 }} />
            <Input placeholder="Title (e.g. Push A)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ width: 220 }} />
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as WorkoutType })}>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          {draft.exercises.map((ex, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <Select value={ex.exercise_id} onChange={(e) => {
                const xs = [...draft.exercises]; xs[i] = { ...ex, exercise_id: e.target.value }; setDraft({ ...draft, exercises: xs });
              }} style={{ minWidth: 200 }}>
                {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
              {(["sets", "reps", "weight_kg"] as const).map((f) => (
                <label key={f} style={{ fontSize: 11.5, color: c.muted, display: "flex", alignItems: "center", gap: 4 }}>
                  {f === "weight_kg" ? "kg" : f}
                  <Input type="number" value={ex[f]} style={{ width: 70 }}
                    onChange={(e) => {
                      const xs = [...draft.exercises]; xs[i] = { ...ex, [f]: Number(e.target.value) }; setDraft({ ...draft, exercises: xs });
                    }} />
                </label>
              ))}
              <Btn variant="danger" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, j) => j !== i) })} style={{ padding: "6px 10px" }}>✕</Btn>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setDraft({ ...draft, exercises: [...draft.exercises, { exercise_id: EXERCISES[0].id, sets: 3, reps: 10, weight_kg: 0 }] })}>
              + Exercise
            </Btn>
            <Btn onClick={submitDraft} disabled={!draft.title.trim()}>Save workout</Btn>
          </div>
        </Card>
      )}

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title={`Muscle heatmap — last ${volDays} days`} right={<RangePicker value={volDays} onChange={setVolDays} options={[{ label: "7d", days: 7 }, { label: "14d", days: 14 }, { label: "28d", days: 28 }]} />}>
          <MuscleMap volumes={volumes} />
          {neglected.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${c.warning}18`, borderRadius: 10, fontSize: 12.5, color: c.text2 }}>
              ⚠ Not trained in 5+ days: {neglected.map((m) => `${MUSCLE_LABELS[m]} (${recency[m] === Infinity ? "never" : recency[m] + "d"})`).join(", ")}
            </div>
          )}
        </Card>
        <Card title="Hard sets per muscle group">
          <HBars rows={volRows} fmt={(v) => `${v} sets`} />
        </Card>
      </div>

      <Card title="Sessions — past week & plan">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan.length === 0 && <div style={{ color: c.muted, fontSize: 13 }}>Nothing logged or planned. Add a workout or ask Jarvis to plan your week.</div>}
          {plan.map((w) => (
            <div key={w.id} style={{
              background: c.surface2, borderRadius: 12, padding: "10px 14px",
              borderLeft: `3px solid ${w.status === "completed" ? c.good : w.status === "skipped" ? c.axis : c.accent}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: w.date === today ? c.accent : c.muted, fontWeight: w.date === today ? 700 : 400, width: 86 }}>
                  {w.date === today ? "TODAY" : fmtDay(w.date)}
                </span>
                <span style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>{w.title}</span>
                <Chip color={w.status === "completed" ? c.good : w.status === "skipped" ? c.muted : c.accent}>{w.status}</Chip>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {w.status === "planned" && <Btn variant="ghost" onClick={() => setStatus(w, "completed")} style={{ padding: "4px 10px", fontSize: 11.5 }}>Done</Btn>}
                  {w.status === "planned" && <Btn variant="ghost" onClick={() => setStatus(w, "skipped")} style={{ padding: "4px 10px", fontSize: 11.5 }}>Skip</Btn>}
                  {w.status !== "planned" && <Btn variant="ghost" onClick={() => setStatus(w, "planned")} style={{ padding: "4px 10px", fontSize: 11.5 }}>Reopen</Btn>}
                  <Btn variant="danger" onClick={() => remove(w)} style={{ padding: "4px 10px", fontSize: 11.5 }}>✕</Btn>
                </span>
              </div>
              {w.exercises.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {w.exercises.map((e, i) => (
                    <span key={i} style={{ fontSize: 11.5, color: c.text2, background: c.surface, borderRadius: 8, padding: "3px 8px" }}>
                      {exerciseName(e.exercise_id)} {e.sets.length}×{e.sets[0]?.reps}{e.sets[0]?.weight_kg ? `@${e.sets[0].weight_kg}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Weekly pattern — sessions by weekday (90d)">
        <WeekdayPattern workouts={past} />
      </Card>
    </div>
  );
}

function WeekdayPattern({ workouts }: { workouts: Workout[] }) {
  const { c } = useTheme();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = new Array(7).fill(0) as number[];
  const types = new Array(7).fill(null).map(() => new Map<string, number>());
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    const dow = (new Date(w.date + "T12:00:00").getDay() + 6) % 7;
    counts[dow]++;
    types[dow].set(w.title, (types[dow].get(w.title) ?? 0) + 1);
  }
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {days.map((d, i) => {
        const top = [...types[i].entries()].sort((a, b) => b[1] - a[1])[0];
        return (
          <div key={d} style={{ textAlign: "center" }}>
            <div style={{
              height: 64, display: "flex", alignItems: "flex-end", justifyContent: "center",
              marginBottom: 6,
            }}>
              <div style={{
                width: "70%", borderRadius: 6,
                height: `${(counts[i] / max) * 100}%`, minHeight: 3,
                background: counts[i] > 0 ? c.series[0] : c.grid,
              }} title={`${counts[i]} sessions`} />
            </div>
            <div style={{ fontSize: 11.5, color: c.text2, fontWeight: 600 }}>{d}</div>
            <div style={{ fontSize: 10, color: c.muted, minHeight: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {top ? top[0] : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
