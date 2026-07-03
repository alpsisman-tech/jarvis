"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface Colors {
  bg: string;          // page plane
  bgElev: string;      // subtly raised plane
  surface: string;     // cards / chart surface
  surface2: string;    // nested surfaces (inputs, rows)
  surface3: string;    // hover / pressed
  border: string;
  borderStrong: string;
  text: string;
  text2: string;
  muted: string;
  faint: string;
  grid: string;
  axis: string;
  accent: string;      // primary interactive / brand
  accent2: string;     // gradient companion
  accentSoft: string;  // translucent accent wash
  accentGrad: string;  // ready-to-use CSS gradient
  glow: string;        // accent glow shadow color
  good: string;
  warning: string;
  serious: string;
  critical: string;
  series: string[];    // categorical palette, fixed order — never cycle
}

// Premium dark — deep cool near-black, electric indigo→violet signature.
export const DARK: Colors = {
  bg: "#080a0f",
  bgElev: "#0c0f16",
  surface: "#12151d",
  surface2: "#191d27",
  surface3: "#222735",
  border: "rgba(150,170,220,0.09)",
  borderStrong: "rgba(150,170,220,0.16)",
  text: "#f4f6fb",
  text2: "#b3bccd",
  muted: "#7f8aa0",
  faint: "#5a6478",
  grid: "#1b1f2b",
  axis: "#2e3547",
  accent: "#6d8bff",
  accent2: "#a779ff",
  accentSoft: "rgba(109,139,255,0.14)",
  accentGrad: "linear-gradient(135deg, #6d8bff 0%, #a779ff 100%)",
  glow: "rgba(109,139,255,0.45)",
  good: "#34d399",
  warning: "#fbbf24",
  serious: "#fb923c",
  critical: "#f87171",
  series: ["#6d8bff", "#34d399", "#fbbf24", "#22d3ee", "#a779ff", "#f87171", "#f472b6", "#fb923c"],
};

export const LIGHT: Colors = {
  bg: "#f5f6f9",
  bgElev: "#eef0f5",
  surface: "#ffffff",
  surface2: "#f2f4f8",
  surface3: "#e8ebf1",
  border: "rgba(20,30,60,0.08)",
  borderStrong: "rgba(20,30,60,0.14)",
  text: "#0d1117",
  text2: "#41495a",
  muted: "#6b7385",
  faint: "#98a0b0",
  grid: "#e6e9ef",
  axis: "#cfd4de",
  accent: "#4d63d8",
  accent2: "#8b5cf6",
  accentSoft: "rgba(77,99,216,0.10)",
  accentGrad: "linear-gradient(135deg, #4d63d8 0%, #8b5cf6 100%)",
  glow: "rgba(77,99,216,0.30)",
  good: "#059669",
  warning: "#d97706",
  serious: "#ea580c",
  critical: "#dc2626",
  series: ["#4d63d8", "#059669", "#d97706", "#0891b2", "#8b5cf6", "#dc2626", "#db2777", "#ea580c"],
};

interface ThemeCtx {
  c: Colors;
  isDark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ c: DARK, isDark: true, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("jarvis-theme") : null;
    if (saved === "light") setIsDark(false);
  }, []);

  const toggle = () => {
    setIsDark((d) => {
      localStorage.setItem("jarvis-theme", d ? "light" : "dark");
      return !d;
    });
  };

  return <Ctx.Provider value={{ c: isDark ? DARK : LIGHT, isDark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
