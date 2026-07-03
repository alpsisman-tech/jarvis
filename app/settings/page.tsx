"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, Btn, Chip, Input } from "@/components/ui";
import { getSettings, saveSettings, getMode, setMode, getToken, setToken } from "@/lib/store";
import { logNutrition, logHydration } from "@/lib/store";
import { todayISO, uid } from "@/lib/format";
import type { UserSettings, Meal } from "@/lib/types";

interface StatusResp {
  cloud: boolean;
  integrations: Record<string, boolean>;
  token_valid?: boolean;
}

export default function SettingsPage() {
  const { c } = useTheme();
  const [s, setS] = useState<UserSettings | null>(null);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [mode, setModeState] = useState<"local" | "cloud">("local");
  const [msg, setMsg] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setS(getSettings());
    setModeState(getMode());
    setTokenInput(getToken());
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  if (!s) return null;

  const save = () => {
    saveSettings(s);
    setMsg("Saved.");
    setTimeout(() => setMsg(""), 2000);
  };

  const connectCloud = async () => {
    setToken(tokenInput.trim());
    try {
      const r = await fetch("/api/status", { headers: { authorization: `Bearer ${tokenInput.trim()}` } });
      const j: StatusResp = await r.json();
      setStatus(j);
      if (j.token_valid && j.cloud) {
        setMode("cloud");
        setModeState("cloud");
        setMsg("Cloud mode enabled — reading from Supabase.");
      } else if (!j.cloud) {
        setMsg("Server has no Supabase configured — staying in local mode.");
      } else {
        setMsg("Token rejected by the server.");
      }
    } catch {
      setMsg("Could not reach the server.");
    }
    setTimeout(() => setMsg(""), 4000);
  };

  const goLocal = () => {
    setMode("local");
    setModeState("local");
  };

  const syncNow = async (what: "whoop" | "garmin") => {
    setMsg(`Syncing ${what}…`);
    try {
      const r = await fetch(`/api/${what}/sync`, { method: "POST", headers: { authorization: `Bearer ${getToken()}` } });
      const j = await r.json();
      setMsg(r.ok ? `${what} sync: ${JSON.stringify(j).slice(0, 120)}` : `${what} sync failed: ${j.error ?? r.status}`);
    } catch (e) {
      setMsg(`${what} sync failed: ${String(e)}`);
    }
    setTimeout(() => setMsg(""), 6000);
  };

  // Bevel CSV import: rows of either
  //   food:  date,meal,name,calories,protein_g,carbs_g,fat_g
  //   water: date,water,ml
  const importBevel = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    let foods = 0, waters = 0, skipped = 0;
    for (const line of lines) {
      const cells = line.split(",").map((x) => x.trim());
      if (/^date/i.test(cells[0])) continue; // header
      const date = /^\d{4}-\d{2}-\d{2}$/.test(cells[0]) ? cells[0] : todayISO();
      if (cells[1]?.toLowerCase() === "water") {
        const ml = Number(cells[2]);
        if (ml > 0) { await logHydration({ id: uid(), date, ml }); waters++; } else skipped++;
      } else if (cells.length >= 4) {
        const meal = (["breakfast", "lunch", "dinner", "snack"].includes(cells[1]?.toLowerCase()) ? cells[1].toLowerCase() : "snack") as Meal;
        await logNutrition({
          id: uid(), date, meal, name: cells[2] || "Imported",
          calories: Number(cells[3]) || 0, protein_g: Number(cells[4]) || 0,
          carbs_g: Number(cells[5]) || 0, fat_g: Number(cells[6]) || 0,
        });
        foods++;
      } else skipped++;
    }
    setImportMsg(`Imported ${foods} food entries, ${waters} water entries${skipped ? ` (${skipped} rows skipped)` : ""}.`);
  };

  const integrationRows: [string, string, string][] = [
    ["supabase", "Supabase", "Cloud storage for synced WHOOP/Garmin data and your logs"],
    ["anthropic", "Anthropic API", "Powers the Jarvis agent"],
    ["whoop", "WHOOP", "Recovery, sleep, strain — OAuth app on developer.whoop.com"],
    ["garmin", "Garmin Connect", "Daily activity + runs (server-side sync or n8n push)"],
    ["github", "GitHub", "Live project status + issue creation"],
    ["n8n", "n8n webhook", "Automations: scheduled syncs, briefings, custom actions"],
    ["resend", "Resend", "Morning briefing email"],
  ];

  return (
    <div>
      <PageTitle title="Settings" sub="Profile, targets, data mode and integrations" />
      {msg && <div style={{ marginBottom: 12, padding: "8px 14px", background: c.accentSoft, borderRadius: 10, fontSize: 13, color: c.text }}>{msg}</div>}

      <div className="grid2" style={{ marginBottom: 14 }}>
        <Card title="Profile">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, color: c.muted }}>Name
              <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
            <label style={{ fontSize: 12, color: c.muted }}>Location name (for weather)
              <Input value={s.place} onChange={(e) => setS({ ...s, place: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, color: c.muted }}>Lat
                <Input type="number" value={s.lat} onChange={(e) => setS({ ...s, lat: Number(e.target.value) })} /></label>
              <label style={{ fontSize: 12, color: c.muted }}>Lon
                <Input type="number" value={s.lon} onChange={(e) => setS({ ...s, lon: Number(e.target.value) })} /></label>
              <label style={{ fontSize: 12, color: c.muted }}>Max HR
                <Input type="number" value={s.max_hr} onChange={(e) => setS({ ...s, max_hr: Number(e.target.value) })} /></label>
            </div>
            <Btn onClick={save} style={{ alignSelf: "flex-start", marginTop: 4 }}>Save profile</Btn>
          </div>
        </Card>

        <Card title="Daily targets">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {([["calories", "Calories"], ["protein_g", "Protein (g)"], ["carbs_g", "Carbs (g)"], ["fat_g", "Fat (g)"], ["water_ml", "Water (ml)"]] as const).map(([k, label]) => (
              <label key={k} style={{ fontSize: 12, color: c.muted }}>{label}
                <Input type="number" value={s.targets[k]}
                  onChange={(e) => setS({ ...s, targets: { ...s.targets, [k]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
          <Btn onClick={save} style={{ marginTop: 12 }}>Save targets</Btn>
        </Card>
      </div>

      <Card title="Data mode & access" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <Chip color={mode === "cloud" ? c.good : c.warning}>{mode === "cloud" ? "CLOUD — Supabase" : "LOCAL — demo data + this device"}</Chip>
          {mode === "cloud" && <Btn variant="ghost" onClick={goLocal}>Switch to local</Btn>}
        </div>
        <p style={{ fontSize: 12.5, color: c.text2, lineHeight: 1.6, margin: "0 0 10px" }}>
          Local mode runs entirely on this device with demo data plus anything you log. Cloud mode reads/writes
          Supabase through the server, where WHOOP/Garmin syncs also land. Enter the access token you set as
          <code style={{ color: c.accent }}> JARVIS_ACCESS_TOKEN</code> on the server:
        </p>
        <div style={{ display: "flex", gap: 8, maxWidth: 480 }}>
          <Input type="password" placeholder="Access token" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          <Btn onClick={connectCloud} disabled={!tokenInput.trim()}>Connect</Btn>
        </div>
      </Card>

      <Card title="Integrations" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {integrationRows.map(([key, name, desc]) => {
            const on = status?.integrations?.[key] ?? false;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, background: c.surface2, borderRadius: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                <Chip color={on ? c.good : c.muted} bg={on ? undefined : c.surface}>{on ? "● connected" : "○ not configured"}</Chip>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text, width: 130 }}>{name}</span>
                <span style={{ fontSize: 12, color: c.muted, flex: 1, minWidth: 200 }}>{desc}</span>
                {key === "whoop" && on && (
                  <span style={{ display: "flex", gap: 6 }}>
                    <a href="/api/whoop/auth"><Btn variant="ghost" style={{ fontSize: 12 }}>Authorize</Btn></a>
                    <Btn variant="ghost" onClick={() => syncNow("whoop")} style={{ fontSize: 12 }}>Sync now</Btn>
                  </span>
                )}
                {key === "garmin" && on && <Btn variant="ghost" onClick={() => syncNow("garmin")} style={{ fontSize: 12 }}>Sync now</Btn>}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: c.muted, marginTop: 10 }}>
          Configure these via environment variables — full walkthrough in <code>SETUP.md</code> in the repo.
        </p>
      </Card>

      <Card title="Bevel / CSV import">
        <p style={{ fontSize: 12.5, color: c.text2, lineHeight: 1.6, marginTop: 0 }}>
          Export nutrition & hydration from Bevel (or any app) as CSV and import here.
          Food rows: <code>date,meal,name,calories,protein_g,carbs_g,fat_g</code> ·
          Water rows: <code>date,water,ml</code>
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importBevel(f); }} />
        <Btn onClick={() => fileRef.current?.click()}>Choose CSV…</Btn>
        {importMsg && <div style={{ marginTop: 8, fontSize: 12.5, color: c.good }}>{importMsg}</div>}
      </Card>
    </div>
  );
}
