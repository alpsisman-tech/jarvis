"use client";

import React from "react";
import { useTheme } from "@/lib/theme";

export function Card({ title, right, children, style }: {
  title?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const { c } = useTheme();
  return (
    <section style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
      padding: 16, ...style,
    }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: c.text2, letterSpacing: 0.2 }}>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, subColor, spark }: {
  label: string; value: string; sub?: string; subColor?: string; spark?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: c.muted }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: c.text, lineHeight: 1.1 }}>{value}</div>
        {spark}
      </div>
      {sub && <div style={{ fontSize: 12, color: subColor ?? c.text2 }}>{sub}</div>}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", disabled, type, style }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger"; disabled?: boolean;
  type?: "button" | "submit"; style?: React.CSSProperties;
}) {
  const { c } = useTheme();
  const base: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: c.accent, color: "#fff" },
    ghost: { background: "transparent", color: c.text2, border: `1px solid ${c.border}` },
    danger: { background: "transparent", color: c.critical, border: `1px solid ${c.critical}44` },
  };
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg ?? `${color}22`,
      borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { c } = useTheme();
  return (
    <input {...props} style={{
      background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: "8px 12px", fontSize: 13, color: c.text, outline: "none", width: "100%",
      fontFamily: "inherit", ...props.style,
    }} />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { c } = useTheme();
  return (
    <select {...props} style={{
      background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: "8px 12px", fontSize: 13, color: c.text, outline: "none",
      fontFamily: "inherit", ...props.style,
    }} />
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{title}</h1>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 13, color: c.muted }}>{sub}</p>}
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
    <div style={{ display: "flex", gap: 4, background: c.surface2, borderRadius: 10, padding: 3 }}>
      {opts.map((o) => (
        <button key={o.days} onClick={() => onChange(o.days)} style={{
          border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          background: value === o.days ? c.accent : "transparent",
          color: value === o.days ? "#fff" : c.text2,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
