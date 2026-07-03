"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface Colors {
  bg: string;          // page plane
  surface: string;     // cards / chart surface
  surface2: string;    // nested surfaces (inputs, rows)
  border: string;
  text: string;
  text2: string;
  muted: string;
  grid: string;
  axis: string;
  accent: string;      // primary interactive / brand
  accentSoft: string;  // translucent accent wash
  good: string;
  warning: string;
  serious: string;
  critical: string;
  series: string[];    // categorical palette, fixed order — never cycle
}

// Validated against the dark surface (#101821) — dataviz six-checks pass.
export const DARK: Colors = {
  bg: "#0a0e14",
  surface: "#101821",
  surface2: "#17212d",
  border: "rgba(255,255,255,0.10)",
  text: "#f2f5f9",
  text2: "#b8c2cf",
  muted: "#8a94a2",
  grid: "#1d2836",
  axis: "#33404f",
  accent: "#3987e5",
  accentSoft: "rgba(57,135,229,0.14)",
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  series: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"],
};

export const LIGHT: Colors = {
  bg: "#f6f7f9",
  surface: "#fcfcfb",
  surface2: "#f0f2f5",
  border: "rgba(11,11,11,0.10)",
  text: "#0b0b0b",
  text2: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  accent: "#2a78d6",
  accentSoft: "rgba(42,120,214,0.10)",
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  series: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
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
