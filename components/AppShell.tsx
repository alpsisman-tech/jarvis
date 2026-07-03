"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";

const NAV = [
  { href: "/", label: "Today", icon: "◉" },
  { href: "/health", label: "Health", icon: "♥" },
  { href: "/training", label: "Training", icon: "▣" },
  { href: "/runs", label: "Runs", icon: "➤" },
  { href: "/nutrition", label: "Nutrition", icon: "◐" },
  { href: "/projects", label: "Projects", icon: "❒" },
  { href: "/jarvis", label: "Jarvis", icon: "✦" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

const MOBILE_TABS = ["/", "/health", "/training", "/jarvis", "/projects"];

export function ArcReactor({ size = 26 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="44" fill="none" stroke={c.accent} strokeWidth="5" opacity="0.35" />
      <g style={{ transformOrigin: "50px 50px", animation: "spin-slow 14s linear infinite" }}>
        <circle cx="50" cy="50" r="32" fill="none" stroke={c.accent} strokeWidth="7"
          strokeDasharray="14 9" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="15" fill={c.accent} style={{ animation: "pulse-glow 3s ease-in-out infinite" }} />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { c, isDark, toggle } = useTheme();
  const pathname = usePathname();

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="shell" style={{ background: c.bg, color: c.text }}>
      <aside className="sidebar" style={{ borderRight: `1px solid ${c.border}` }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 18px" }}>
          <ArcReactor />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 2 }}>JARVIS</div>
            <div style={{ fontSize: 10, color: c.muted, letterSpacing: 1 }}>PERSONAL OPS</div>
          </div>
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="navlink" style={{
            background: active(n.href) ? c.accentSoft : "transparent",
            color: active(n.href) ? c.accent : c.text2,
          }}>
            <span style={{ width: 18, textAlign: "center" }}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={toggle} style={{
          background: "transparent", border: `1px solid ${c.border}`, borderRadius: 10,
          color: c.text2, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
        }}>
          {isDark ? "☀ Light mode" : "☾ Dark mode"}
        </button>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar" style={{ background: isDark ? "rgba(10,14,20,0.85)" : "rgba(246,247,249,0.85)", borderTop: `1px solid ${c.border}` }}>
        {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} style={{
            color: active(n.href) ? c.accent : c.muted,
            background: active(n.href) ? c.accentSoft : "transparent",
          }}>
            <span style={{ fontSize: 17 }}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
