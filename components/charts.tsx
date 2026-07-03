"use client";

// Hand-rolled SVG charts following the dataviz method: thin marks, recessive
// grid, hover tooltips by default, text in ink tokens (never series color).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";

export interface Pt { x: string; y: number }

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = (span / n) / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = mult * step;
  const lo = Math.ceil(min / s) * s;
  const ticks: number[] = [];
  for (let v = lo; v <= max + 1e-9; v += s) ticks.push(+v.toFixed(6));
  return ticks;
}

interface TipState { left: number; top: number; title: string; lines: string[] }

function Tooltip({ tip }: { tip: TipState | null }) {
  const { c } = useTheme();
  if (!tip) return null;
  return (
    <div style={{
      position: "absolute", left: tip.left, top: tip.top, transform: "translate(-50%, -100%)",
      background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8,
      padding: "6px 10px", pointerEvents: "none", zIndex: 5, whiteSpace: "nowrap",
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)", fontSize: 12,
    }}>
      <div style={{ color: c.text2, marginBottom: 2 }}>{tip.title}</div>
      {tip.lines.map((l, i) => (
        <div key={i} style={{ color: c.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{l}</div>
      ))}
    </div>
  );
}

export function LineChart({
  data, color, height = 180, yFmt = (v) => String(Math.round(v)), xFmt = (x) => x,
  fill = false, yMin, yMax, series2, color2, label, label2,
}: {
  data: Pt[]; color: string; height?: number;
  yFmt?: (v: number) => string; xFmt?: (x: string) => string;
  fill?: boolean; yMin?: number; yMax?: number;
  series2?: Pt[]; color2?: string; label?: string; label2?: string;
}) {
  const { c } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [hoverI, setHoverI] = useState<number | null>(null);
  const W = 600, H = height, PAD = { l: 40, r: 10, t: 10, b: 22 };

  const { ticks, lo, hi } = useMemo(() => {
    const ys = [...data.map((d) => d.y), ...(series2 ?? []).map((d) => d.y)];
    let lo = yMin ?? Math.min(...ys), hi = yMax ?? Math.max(...ys);
    if (yMin === undefined) lo -= (hi - lo) * 0.1 || 1;
    if (yMax === undefined) hi += (hi - lo) * 0.1 || 1;
    return { ticks: niceTicks(lo, hi), lo, hi };
  }, [data, series2, yMin, yMax]);

  if (data.length === 0) return <Empty height={height} />;

  const px = (i: number) => PAD.l + (i / Math.max(1, data.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (pts: Pt[]) => pts.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.y).toFixed(1)}`).join(" ");

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((fx - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    if (i < 0 || i >= data.length) { setTip(null); setHoverI(null); return; }
    setHoverI(i);
    const lines = [`${label ? label + ": " : ""}${yFmt(data[i].y)}`];
    if (series2 && series2[i]) lines.push(`${label2 ? label2 + ": " : ""}${yFmt(series2[i].y)}`);
    setTip({
      left: (px(i) / W) * rect.width,
      top: (py(data[i].y) / H) * rect.height - 8,
      title: xFmt(data[i].x), lines,
    });
  };

  const xTickIdx = data.length <= 8 ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove} onMouseLeave={() => { setTip(null); setHoverI(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} stroke={c.grid} strokeWidth={1} />
            <text x={PAD.l - 6} y={py(t) + 4} fontSize={11} fill={c.muted} textAnchor="end"
              style={{ fontVariantNumeric: "tabular-nums" }}>{yFmt(t)}</text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text key={i} x={px(i)} y={H - 6} fontSize={11} fill={c.muted} textAnchor="middle">{xFmt(data[i].x)}</text>
        ))}
        {fill && (
          <path d={`${path(data)} L${px(data.length - 1)},${py(lo)} L${px(0)},${py(lo)} Z`}
            fill={color} opacity={0.10} />
        )}
        {series2 && color2 && <path d={path(series2)} fill="none" stroke={color2} strokeWidth={2} strokeLinejoin="round" pathLength={1} strokeDasharray={1} className="draw-in" />}
        <path d={path(data)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" pathLength={1} strokeDasharray={1} className="draw-in" />
        {hoverI !== null && (
          <g>
            <line x1={px(hoverI)} x2={px(hoverI)} y1={PAD.t} y2={H - PAD.b} stroke={c.axis} strokeWidth={1} />
            <circle cx={px(hoverI)} cy={py(data[hoverI].y)} r={4} fill={color} stroke={c.surface} strokeWidth={2} />
            {series2 && series2[hoverI] && (
              <circle cx={px(hoverI)} cy={py(series2[hoverI].y)} r={4} fill={color2} stroke={c.surface} strokeWidth={2} />
            )}
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
      {series2 && (label || label2) && (
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: c.text2, marginTop: 4 }}>
          {label && <span><i style={dot(color)} />{label}</span>}
          {label2 && color2 && <span><i style={dot(color2)} />{label2}</span>}
        </div>
      )}
    </div>
  );
}

const dot = (color: string): React.CSSProperties => ({
  display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, marginRight: 5,
});

export function Bars({
  data, color, height = 180, yFmt = (v) => String(Math.round(v)), xFmt = (x) => x, colorFor,
}: {
  data: Pt[]; color: string; height?: number;
  yFmt?: (v: number) => string; xFmt?: (x: string) => string;
  colorFor?: (p: Pt, i: number) => string;
}) {
  const { c } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const W = 600, H = height, PAD = { l: 40, r: 10, t: 10, b: 22 };
  if (data.length === 0) return <Empty height={height} />;
  const hi = Math.max(...data.map((d) => d.y)) * 1.1 || 1;
  const ticks = niceTicks(0, hi);
  const bw = (W - PAD.l - PAD.r) / data.length;
  const py = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b);
  const xTickIdx = data.length <= 8 ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} stroke={c.grid} strokeWidth={1} />
            <text x={PAD.l - 6} y={py(t) + 4} fontSize={11} fill={c.muted} textAnchor="end"
              style={{ fontVariantNumeric: "tabular-nums" }}>{yFmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.l + i * bw + 1;
          const w = Math.max(2, bw - 2);
          const y = py(d.y);
          const h = Math.max(0, H - PAD.b - y);
          return (
            <rect key={i} x={x} y={y} width={w} height={h} rx={Math.min(4, w / 2)}
              fill={colorFor ? colorFor(d, i) : color}
              onMouseEnter={(e) => {
                const rect = ref.current!.getBoundingClientRect();
                setTip({
                  left: ((x + w / 2) / W) * rect.width,
                  top: (y / H) * rect.height - 8,
                  title: xFmt(d.x), lines: [yFmt(d.y)],
                });
              }}
            />
          );
        })}
        {xTickIdx.map((i) => (
          <text key={i} x={PAD.l + i * bw + bw / 2} y={H - 6} fontSize={11} fill={c.muted} textAnchor="middle">
            {xFmt(data[i].x)}
          </text>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={c.axis} strokeWidth={1} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export function StackedBars({
  data, height = 180, yFmt = (v) => v.toFixed(1), xFmt = (x) => x,
}: {
  data: { x: string; parts: { v: number; color: string; label: string }[] }[];
  height?: number; yFmt?: (v: number) => string; xFmt?: (x: string) => string;
}) {
  const { c } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const W = 600, H = height, PAD = { l: 40, r: 10, t: 10, b: 22 };
  if (data.length === 0) return <Empty height={height} />;
  const hi = Math.max(...data.map((d) => d.parts.reduce((s, p) => s + p.v, 0))) * 1.08 || 1;
  const ticks = niceTicks(0, hi);
  const bw = (W - PAD.l - PAD.r) / data.length;
  const py = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b);
  const legend = data[0]?.parts.map((p) => ({ label: p.label, color: p.color })) ?? [];
  const xTickIdx = data.length <= 8 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} stroke={c.grid} strokeWidth={1} />
            <text x={PAD.l - 6} y={py(t) + 4} fontSize={11} fill={c.muted} textAnchor="end"
              style={{ fontVariantNumeric: "tabular-nums" }}>{yFmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.l + i * bw + 1;
          const w = Math.max(2, bw - 2);
          let acc = 0;
          return d.parts.map((p, pi) => {
            const y0 = py(acc), y1 = py(acc + p.v);
            acc += p.v;
            return (
              <rect key={pi} x={x} y={y1} width={w} height={Math.max(0, y0 - y1 - 1)}
                rx={pi === d.parts.length - 1 ? Math.min(3, w / 2) : 0} fill={p.color}
                onMouseEnter={() => {
                  const rect = ref.current!.getBoundingClientRect();
                  setTip({
                    left: ((x + w / 2) / W) * rect.width,
                    top: (py(d.parts.reduce((s, q) => s + q.v, 0)) / H) * rect.height - 8,
                    title: xFmt(d.x),
                    lines: d.parts.map((q) => `${q.label}: ${yFmt(q.v)}`),
                  });
                }}
              />
            );
          });
        })}
        {xTickIdx.map((i) => (
          <text key={i} x={PAD.l + i * bw + bw / 2} y={H - 6} fontSize={11} fill={c.muted} textAnchor="middle">
            {xFmt(data[i].x)}
          </text>
        ))}
      </svg>
      <Tooltip tip={tip} />
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: c.text2, marginTop: 4, flexWrap: "wrap" }}>
        {legend.map((l) => <span key={l.label}><i style={dot(l.color)} />{l.label}</span>)}
      </div>
    </div>
  );
}

export function Ring({
  value, max, size = 110, color, label, sub, fmt = (v) => String(Math.round(v)),
}: {
  value: number; max: number; size?: number; color: string;
  label: string; sub?: string; fmt?: (v: number) => string;
}) {
  const { c } = useTheme();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.grid} strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${armed ? circ * frac : 0} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: size / 4.2, fontWeight: 700, color: c.text }}>{fmt(value)}</div>
          {sub && <div style={{ fontSize: 11, color: c.muted }}>{sub}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: c.text2 }}>{label}</div>
    </div>
  );
}

export function Sparkline({ data, color, width = 120, height = 36 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const lo = Math.min(...data), hi = Math.max(...data);
  const px = (i: number) => (i / (data.length - 1)) * (width - 4) + 2;
  const py = (v: number) => 2 + (1 - (hi === lo ? 0.5 : (v - lo) / (hi - lo))) * (height - 4);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} className="draw-in" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r={3} fill={color} className="fade-in-late" />
    </svg>
  );
}

export function HBars({ rows, fmt }: {
  rows: { label: string; value: number; color: string; detail?: string }[];
  fmt: (v: number) => string;
}) {
  const { c } = useTheme();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: c.text2 }}>{r.label}{r.detail ? <span style={{ color: c.muted }}> · {r.detail}</span> : null}</span>
            <span style={{ color: c.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(r.value)}</span>
          </div>
          <div style={{ height: 8, background: c.grid, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: r.color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ height }: { height: number }) {
  const { c } = useTheme();
  return (
    <div style={{
      height, display: "flex", alignItems: "center", justifyContent: "center",
      color: c.muted, fontSize: 13, border: `1px dashed ${c.border}`, borderRadius: 10,
    }}>
      No data yet
    </div>
  );
}
