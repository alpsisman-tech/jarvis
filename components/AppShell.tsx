"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";
import {
  IconSun, IconHeart, IconDumbbell, IconBolt, IconApple, IconCode,
  IconSliders, IconDots, IconSpark, IconX, type IconProps,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: IconProps) => React.JSX.Element;
}

const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: IconSun },
  { href: "/health", label: "Health", icon: IconHeart },
  { href: "/training", label: "Training", icon: IconDumbbell },
  { href: "/runs", label: "Runs", icon: IconBolt },
  { href: "/nutrition", label: "Nutrition", icon: IconApple },
  { href: "/projects", label: "Projects", icon: IconCode },
  { href: "/jarvis", label: "Jarvis", icon: IconSpark },
  { href: "/settings", label: "Settings", icon: IconSliders },
];

// Bottom bar: Today · Health · [Jarvis FAB] · Training · More
const TAB_LEFT = ["/", "/health"];
const TAB_RIGHT = ["/training"];
const SHEET_ITEMS = ["/runs", "/nutrition", "/projects", "/settings"];

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

function TabLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const { c } = useTheme();
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick} className="pressable" style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      padding: "7px 14px", borderRadius: 15, minWidth: 58,
      background: active ? c.accentSoft : "transparent",
      color: active ? c.accent : c.muted,
      transition: "background 0.2s, color 0.2s",
    }}>
      <Icon size={21} strokeWidth={active ? 2.1 : 1.8} />
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{item.label}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { c, isDark, toggle } = useTheme();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const sheetActive = SHEET_ITEMS.some((h) => pathname.startsWith(h));

  const closeSheet = () => {
    setSheetClosing(true);
    setTimeout(() => { setSheetOpen(false); setSheetClosing(false); }, 240);
  };

  useEffect(() => {
    // close the sheet when navigation happens through it
    setSheetOpen(false);
    setSheetClosing(false);
  }, [pathname]);

  const pageBg = isDark
    ? `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(57,135,229,0.09), transparent), ${c.bg}`
    : c.bg;

  const item = (href: string) => NAV.find((n) => n.href === href)!;

  return (
    <div className="shell" style={{ background: pageBg, color: c.text }}>
      <div className="ambient ambient-a" style={{ background: isDark ? "rgba(57,135,229,0.13)" : "rgba(42,120,214,0.10)" }} />
      <div className="ambient ambient-b" style={{ background: isDark ? "rgba(144,133,233,0.09)" : "rgba(74,58,167,0.07)" }} />

      {/* ── Desktop sidebar ── */}
      <aside className="sidebar" style={{ borderRight: `1px solid ${c.border}`, zIndex: 1, background: isDark ? "rgba(7,11,17,0.55)" : "rgba(252,252,251,0.6)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div style={{ padding: "6px 12px 22px" }}><Logo /></div>
        {NAV.map((n) => {
          const on = active(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className="navlink pressable" style={{
              background: on ? `linear-gradient(90deg, ${c.accentSoft}, transparent)` : "transparent",
              color: on ? c.accent : c.text2,
              borderLeft: `2px solid ${on ? c.accent : "transparent"}`,
              fontWeight: on ? 650 : 500,
            }}>
              <Icon size={18} strokeWidth={on ? 2 : 1.7} />
              {n.label}
            </Link>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={toggle} className="pressable" style={{
          background: "transparent", border: `1px solid ${c.border}`, borderRadius: 10,
          color: c.text2, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
        }}>
          {isDark ? "☀ Light mode" : "☾ Dark mode"}
        </button>
      </aside>

      {/* ── Content ── */}
      <div style={{ flex: 1, minWidth: 0, zIndex: 1, display: "flex", flexDirection: "column" }}>
        <header className="mobilehead" style={{
          borderBottom: `1px solid ${c.border}`,
          background: isDark ? "rgba(7,11,17,0.7)" : "rgba(252,252,251,0.75)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        }}>
          <Logo />
          <Link href="/settings" aria-label="Settings" className="pressable" style={{
            border: `1px solid ${c.border}`, borderRadius: 12, padding: 8,
            color: pathname.startsWith("/settings") ? c.accent : c.text2, display: "flex",
          }}>
            <IconSliders size={18} />
          </Link>
        </header>
        <main className="main">
          <div key={pathname} className="page">{children}</div>
        </main>
      </div>

      {/* ── Mobile tab bar with center Jarvis button ── */}
      <nav className="tabbar" style={{ background: isDark ? "rgba(7,11,17,0.86)" : "rgba(246,247,249,0.9)", borderTop: `1px solid ${c.border}` }}>
        {TAB_LEFT.map((h) => <TabLink key={h} item={item(h)} active={active(h)} />)}

        <Link href="/jarvis" aria-label="Jarvis" className="fab pressable" style={{
          background: `linear-gradient(140deg, ${c.accent}, #164a8c)`,
          boxShadow: `0 6px 22px ${c.accent}66, 0 0 0 5px ${isDark ? "rgba(7,11,17,0.9)" : "rgba(246,247,249,0.95)"}`,
          outline: active("/jarvis") ? `2px solid ${c.accent}` : "none",
        }}>
          <svg width="26" height="26" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff" strokeWidth="6" opacity="0.4" />
            <g style={{ transformOrigin: "50px 50px", animation: "spin-slow 12s linear infinite" }}>
              <circle cx="50" cy="50" r="29" fill="none" stroke="#ffffff" strokeWidth="8" strokeDasharray="13 9" strokeLinecap="round" />
            </g>
            <circle cx="50" cy="50" r="13" fill="#ffffff" />
          </svg>
        </Link>

        {TAB_RIGHT.map((h) => <TabLink key={h} item={item(h)} active={active(h)} />)}

        <button onClick={() => (sheetOpen ? closeSheet() : setSheetOpen(true))} className="pressable" style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          padding: "7px 14px", borderRadius: 15, minWidth: 58, border: "none",
          background: sheetActive && !sheetOpen ? c.accentSoft : "transparent",
          color: sheetActive || sheetOpen ? c.accent : c.muted,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <IconDots size={21} />
          <span style={{ fontSize: 10, fontWeight: sheetActive ? 700 : 500 }}>More</span>
        </button>
      </nav>

      {/* ── More sheet (mobile) ── */}
      {sheetOpen && (
        <div className="sheet-root" onClick={closeSheet} style={{ background: "rgba(0,0,0,0.45)", animation: sheetClosing ? "fade-out 0.24s both" : "fade-in 0.2s both" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet"
            style={{
              background: isDark ? "#0d1420" : c.surface,
              borderTop: `1px solid ${c.border}`,
              animation: sheetClosing ? "sheet-down 0.24s ease-in both" : "sheet-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: c.axis, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: c.muted }}>MORE</span>
              <button onClick={closeSheet} aria-label="Close" className="pressable" style={{ background: c.surface2, border: "none", borderRadius: 10, padding: 7, color: c.text2, cursor: "pointer", display: "flex" }}>
                <IconX size={15} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SHEET_ITEMS.map((h, i) => {
                const n = item(h);
                const Icon = n.icon;
                const on = active(h);
                return (
                  <Link key={h} href={h} className="pressable" style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "16px 16px",
                    borderRadius: 16, background: on ? c.accentSoft : c.surface2,
                    color: on ? c.accent : c.text,
                    animation: `rise-in 0.35s ${0.05 + i * 0.05}s cubic-bezier(0.22,1,0.36,1) both`,
                  }}>
                    <Icon size={21} color={on ? c.accent : c.accent} />
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{n.label}</span>
                  </Link>
                );
              })}
            </div>
            <button onClick={toggle} className="pressable" style={{
              width: "100%", marginTop: 12, padding: "14px 16px", borderRadius: 16,
              background: "transparent", border: `1px solid ${c.border}`, color: c.text2,
              fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              animation: "rise-in 0.35s 0.25s cubic-bezier(0.22,1,0.36,1) both",
            }}>
              {isDark ? "☀ Switch to light mode" : "☾ Switch to dark mode"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
