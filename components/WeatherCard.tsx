"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card } from "./ui";
import { getSettings } from "@/lib/store";
import { weatherLabel } from "@/lib/format";
import type { WeatherBundle } from "@/lib/types";

export default function WeatherCard({ compact = false }: { compact?: boolean }) {
  const { c } = useTheme();
  const [w, setW] = useState<WeatherBundle | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const s = getSettings();
    fetch(`/api/weather?lat=${s.lat}&lon=${s.lon}&place=${encodeURIComponent(s.place)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setW)
      .catch(() => setErr(true));
  }, []);

  if (err) {
    return (
      <Card title="Weather">
        <div style={{ color: c.muted, fontSize: 13 }}>Weather unavailable right now.</div>
      </Card>
    );
  }
  if (!w) {
    return (
      <Card title="Weather">
        <div style={{ color: c.muted, fontSize: 13 }}>Loading…</div>
      </Card>
    );
  }

  const now = weatherLabel(w.now.code);

  return (
    <Card title={`Weather · ${w.place}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 38 }}>{now.icon}</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: c.text }}>{Math.round(w.now.temp_c)}°</div>
          <div style={{ fontSize: 12, color: c.text2 }}>
            {now.label} · feels {Math.round(w.now.feels_c)}° · wind {Math.round(w.now.wind_kmh)} km/h
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, padding: "8px 10px", background: c.accentSoft, borderRadius: 10, fontSize: 12.5, color: c.text2 }}>
        🏃 {w.run_advice}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
          {w.hourly.slice(0, 12).map((h) => (
            <div key={h.time} style={{ textAlign: "center", minWidth: 44, flexShrink: 0 }}>
              <div style={{ fontSize: 10.5, color: c.muted }}>{h.time.slice(11, 16)}</div>
              <div style={{ fontSize: 15, margin: "2px 0" }}>{weatherLabel(h.code).icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{Math.round(h.temp_c)}°</div>
              <div style={{ fontSize: 10, color: h.precip_prob > 40 ? c.serious : c.muted }}>{h.precip_prob}%</div>
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${c.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {w.daily.slice(0, 5).map((d) => (
            <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 38, color: c.text2 }}>
                {new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
              <span style={{ width: 22 }}>{weatherLabel(d.code).icon}</span>
              <span style={{ color: d.precip_prob > 40 ? c.serious : c.muted, width: 36 }}>{d.precip_prob}%</span>
              <span style={{ marginLeft: "auto", color: c.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(d.max_c)}° <span style={{ color: c.muted, fontWeight: 400 }}>{Math.round(d.min_c)}°</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
