"use client";

import React from "react";
import { useTheme } from "@/lib/theme";

export function Card({ title, right, children, style, pad = 18, onClick }: {
  title?: string; right?: React.ReactNode; children: React.ReactNode;
  style?: React.CSSProperties; pad?: number; onClick?: () => void;
}) {
  const { c, isDark } = useTheme();
  return (
    <section className="card-hover" onClick={onClick} style={{
      background: isDark
        ? `linear-gradient(180deg, rgba(160,180,255,0.035), rgba(160,180,255,0) 55%), ${c.surface}`
        : c.surface,
      border: `1px solid ${c.border}`, borderRadius: 18,
      padding: pad,
      boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.28)" : "0 6px 22px rgba(30,40,70,0.06)",
      cursor: onClick ? "pointer" : undefined,
      ...style,
    }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
          {title && (
            <h2 style={{
              margin: 0, fontSize: 11.5, fontWeight: 700, color: c.muted,
              letterSpacing: 1.3, textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <span style={{ width: 4, height: 13, borderRadius: 2, background: c.accentGrad, boxShadow: `0 0 10px ${c.glow}` }} />
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, subColor, spark, accent }: {
  label: string; value: string; sub?: string; subColor?: string; spark?: React.ReactNode; accent?: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <div className="card-hover" style={{
      background: isDark
        ? `linear-gradient(180deg, rgba(160,180,255,0.045), rgba(160,180,255,0) 70%), ${c.surface}`
        : c.surface,
      border: `1px solid ${c.border}`, borderRadius: 18,
      padding: "15px 17px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0,
      boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.24)" : "0 6px 22px rgba(30,40,70,0.05)",
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: c.muted, letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 27, fontWeight: 800, color: accent ?? c.text, lineHeight: 1.05, letterSpacing: -0.5 }}>{value}</div>
        {spark}
      </div>
      {sub && <div style={{ fontSize: 12, color: subColor ?? c.text2 }}>{sub}</div>}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", disabled, type, style }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft"; disabled?: boolean;
  type?: "button" | "submit"; style?: React.CSSProperties;
}) {
  const { c } = useTheme();
  const base: React.CSSProperties = {
    border: "none", borderRadius: 11, padding: "9px 15px", fontSize: 13, fontWeight: 650,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit", whiteSpace: "nowrap",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: c.accentGrad, color: "#fff", boxShadow: `0 4px 16px ${c.glow}` },
    soft: { background: c.accentSoft, color: c.accent, border: `1px solid ${c.accent}33` },
    ghost: { background: "transparent", color: c.text2, border: `1px solid ${c.border}` },
    danger: { background: "transparent", color: c.critical, border: `1px solid ${c.critical}44` },
  };
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className="pressable" style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 650, color, background: bg ?? `${color}1e`,
      borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { c } = useTheme();
  return (
    <input {...props} style={{
      background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 11,
      padding: "9px 13px", fontSize: 13, color: c.text, outline: "none", width: "100%",
      fontFamily: "inherit", ...props.style,
    }} />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { c } = useTheme();
  return (
    <select {...props} style={{
      background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 11,
      padding: "9px 13px", fontSize: 13, color: c.text, outline: "none",
      fontFamily: "inherit", ...props.style,
    }} />
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: c.text, letterSpacing: -0.5 }}>{title}</h1>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 13, color: c.muted }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function RangePicker({ value, onChange, options }: {
  value: number; onChange: (v: number) => void; options?: { label: string; days: number }[];
}) {
  const { c } = useTheme();
  const opts = options ?? [
    { label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 },
  ];
  return (
    <div style={{ display: "flex", gap: 3, background: c.surface2, borderRadius: 11, padding: 3 }}>
      {opts.map((o) => (
        <button key={o.days} onClick={() => onChange(o.days)} className="pressable" style={{
          border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 650,
          cursor: "pointer", fontFamily: "inherit",
          background: value === o.days ? c.accentGrad : "transparent",
          color: value === o.days ? "#fff" : c.text2,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { label: string; value: T }[];
}) {
  const { c } = useTheme();
  return (
    <div style={{ display: "flex", gap: 3, background: c.surface2, borderRadius: 11, padding: 3, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className="pressable" style={{
          border: "none", borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 650,
          cursor: "pointer", fontFamily: "inherit",
          background: value === o.value ? c.accentGrad : "transparent",
          color: value === o.value ? "#fff" : c.text2,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: string; title: string; hint?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "36px 20px", textAlign: "center",
      border: `1px dashed ${c.border}`, borderRadius: 16,
    }}>
      {icon && <div style={{ fontSize: 30, opacity: 0.8 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 650, color: c.text2 }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: c.muted, maxWidth: 380, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
