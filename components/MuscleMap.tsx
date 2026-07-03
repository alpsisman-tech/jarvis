"use client";

// Front/back body heatmap. Fill is a one-hue sequential ramp (magnitude = sets
// this period). Values are also listed as bars beside the figure, so color is
// never the only channel.

import React from "react";
import { useTheme } from "@/lib/theme";
import type { MuscleGroup } from "@/lib/types";
import { MUSCLE_LABELS } from "@/lib/exercises";

// One-hue blue ramp, monotonic lightness per mode (0 = untrained → grid tone)
const DARK_RAMP = ["#1d2836", "#16324f", "#1c4a7a", "#2a68ab", "#3987e5"];
const LIGHT_RAMP = ["#e1e0d9", "#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6"];

function rampColor(v: number, max: number, isDark: boolean): string {
  const ramp = isDark ? DARK_RAMP : LIGHT_RAMP;
  if (max <= 0 || v <= 0) return ramp[0];
  const idx = Math.min(ramp.length - 1, 1 + Math.floor((v / max) * (ramp.length - 2) + 0.0001));
  return ramp[idx];
}

// Region shapes: [muscle, cx, cy, rx, ry, rotate?] on a 170x330 canvas
type Region = [MuscleGroup, number, number, number, number, number?];

const FRONT: Region[] = [
  ["shoulders", 51, 78, 13, 10], ["shoulders", 119, 78, 13, 10],
  ["chest", 68, 95, 16, 13], ["chest", 102, 95, 16, 13],
  ["biceps", 44, 112, 9, 16, -8], ["biceps", 126, 112, 9, 16, 8],
  ["forearms", 38, 148, 8, 18, -10], ["forearms", 132, 148, 8, 18, 10],
  ["core", 85, 133, 18, 25],
  ["quads", 68, 210, 14, 32], ["quads", 102, 210, 14, 32],
  ["calves", 66, 285, 10, 24], ["calves", 104, 285, 10, 24],
];

const BACK: Region[] = [
  ["shoulders", 51, 78, 13, 10], ["shoulders", 119, 78, 13, 10],
  ["back", 85, 92, 24, 14],
  ["back", 72, 122, 13, 22], ["back", 98, 122, 13, 22],
  ["triceps", 44, 112, 9, 16, 8], ["triceps", 126, 112, 9, 16, -8],
  ["forearms", 38, 148, 8, 18, -10], ["forearms", 132, 148, 8, 18, 10],
  ["glutes", 71, 172, 14, 13], ["glutes", 99, 172, 14, 13],
  ["hamstrings", 68, 222, 13, 28], ["hamstrings", 102, 222, 13, 28],
  ["calves", 66, 285, 10, 24], ["calves", 104, 285, 10, 24],
];

function Figure({ regions, volumes, max, title }: {
  regions: Region[]; volumes: Record<MuscleGroup, number>; max: number; title: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 170 330" style={{ width: "100%", maxWidth: 150, height: "auto" }}>
        {/* silhouette */}
        <circle cx="85" cy="38" r="17" fill={c.surface2} />
        <path d="M85 58 C 52 58 38 72 38 95 L 30 160 C 28 172 40 176 44 165 L 54 118
                 L 54 165 C 54 178 58 185 60 200 L 58 265 L 60 318 C 60 326 76 326 76 318
                 L 78 240 L 85 215 L 92 240 L 94 318 C 94 326 110 326 110 318 L 112 265
                 L 110 200 C 112 185 116 178 116 165 L 116 118 L 126 165 C 130 176 142 172 140 160
                 L 132 95 C 132 72 118 58 85 58 Z"
          fill={c.surface2} />
        {regions.map((r, i) => {
          const [m, cx, cy, rx, ry, rot] = r;
          const v = volumes[m] ?? 0;
          return (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
              transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
              fill={rampColor(v, max, isDark)} stroke={c.surface} strokeWidth={1.5}>
              <title>{`${MUSCLE_LABELS[m]}: ${Math.round(v)} sets`}</title>
            </ellipse>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{title}</div>
    </div>
  );
}

export default function MuscleMap({ volumes }: { volumes: Record<MuscleGroup, number> }) {
  const { c, isDark } = useTheme();
  const max = Math.max(...Object.values(volumes), 1);
  const ramp = isDark ? DARK_RAMP : LIGHT_RAMP;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Figure regions={FRONT} volumes={volumes} max={max} title="Front" />
        <Figure regions={BACK} volumes={volumes} max={max} title="Back" />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, fontSize: 11, color: c.muted }}>
        <span>fewer sets</span>
        {ramp.map((col) => (
          <span key={col} style={{ width: 16, height: 8, borderRadius: 3, background: col, display: "inline-block" }} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
