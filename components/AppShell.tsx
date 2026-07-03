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
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 ${size / 3}px ${c.accent}66)` }}>
      <circle cx="50" cy="50" r="44" fill="none" stroke={c.accent} strokeWidth="5" opacity="0.35" />
      <g style={{ transformOrigin: "50px 50px", animation: "spin-slow 14s linear infinite" }}>
        <circle cx="50" cy="50" r="32" fill="none" stroke={c.accent} strokeWidth="7"
          strokeDasharray="14 9" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="15" fill={c.accent} style={{ animation: "pulse-glow 3s ease-in-out infinite" }} />
    </svg>
  );
}

function Logo() {
  const { c } = useTheme();
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <ArcReactor />
      <div>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 3, color: c.text }}>JARVIS</div>
        <div style={{ fontSize: 9.5, color: c.muted, letterSpacing: 2.5 }}>PERSONAL OPS</div>
      </div>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { c, isDark, toggle } = useTheme();
  const pathname = usePathname();

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const pageBg = isDark
    ? `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(57,135,229,0.09), transparent), ${c.bg}`
    : c.bg;

  return (
    <div className="shell" style={{ background: pageBg, color: c.text }}>
      {/* ambient glow layers */}
      <div className="ambient ambient-a" style={{ background: isDark ? "rgba(57,135,229,0.13)" : "rgba(42,120,214,0.10)" }} />
      <div className="ambient ambient-b" style={{ background: isDark ? "rgba(144,133,233,0.09)" : "rgba(74,58,167,0.07)" }} />

      <aside className="sidebar" style={{ borderRight: `1px solid ${c.border}`, zIndex: 1, background: isDark ? "rgba(7,11,17,0.55)" : "rgba(252,252,251,0.6)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div style={{ padding: "6px 12px 22px" }}><Logo /></div>
        {NAV.map((n) => {
          const on = active(n.href);
          return (
            <Link key={n.href} href={n.href} className="navlink" style={{
              background: on ? `linear-gradient(90deg, ${c.accentSoft}, transparent)` : "transparent",
              color: on ? c.accent : c.text2,
              borderLeft: `2px solid ${on ? c.accent : "transparent"}`,
              fontWeight: on ? 650 : 500,
            }}>
              <span style={{ width: 18, textAlign: "center", opacity: on ? 1 : 0.7 }}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={toggle} style={{
          background: "transparent", border: `1px solid ${c.border}`, borderRadius: 10,
          color: c.text2, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
        }}>
          {isDark ? "☀ Light mode" : "☾ Dark mode"}
        </button>
      </aside>

      <div style={{ flex: 1, minWidth: 0, zIndex: 1, display: "flex", flexDirection: "column" }}>
        <header className="mobilehead" style={{
          borderBottom: `1px solid ${c.border}`,
          background: isDark ? "rgba(7,11,17,0.7)" : "rgba(252,252,251,0.75)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        }}>
          <Logo />
          <button onClick={toggle} aria-label="Toggle theme" style={{
            background: "transparent", border: `1px solid ${c.border}`, borderRadius: 10,
            color: c.text2, padding: "5px 10px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            {isDark ? "☀" : "☾"}
          </button>
        </header>
        <main className="main">{children}</main>
      </div>

      <nav className="tabbar" style={{ background: isDark ? "rgba(7,11,17,0.82)" : "rgba(246,247,249,0.85)", borderTop: `1px solid ${c.border}` }}>
        {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} style={{
            color: active(n.href) ? c.accent : c.muted,
            background: active(n.href) ? c.accentSoft : "transparent",
          }}>
            <span style={{ fontSize: 17, filter: active(n.href) ? `drop-shadow(0 0 6px ${c.accent}88)` : "none" }}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
