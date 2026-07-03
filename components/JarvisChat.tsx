"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { ArcReactor } from "./AppShell";
import { executeClientTool, buildContextPack } from "@/lib/agentTools";

interface Block { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; content?: unknown }
interface ApiMsg { role: "user" | "assistant"; content: string | Block[] }

interface DisplayItem {
  kind: "user" | "jarvis" | "tool" | "error";
  text: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_health_summary: "Reading WHOOP & Garmin data",
  get_runs: "Pulling run history",
  get_workouts: "Checking the training log",
  list_exercises: "Browsing exercise library",
  plan_workout: "Writing workout to calendar",
  update_workout_status: "Updating workout",
  delete_workout: "Removing workout",
  log_nutrition: "Logging food",
  log_hydration: "Logging water",
  get_nutrition_summary: "Summarising nutrition",
  update_targets: "Updating targets",
  get_weather: "Checking the weather",
  get_projects: "Checking project status",
  create_github_issue: "Opening GitHub issue",
  trigger_n8n_action: "Triggering automation",
};

// Minimal markdown: **bold**, bullet lines, paragraphs.
function Md({ text }: { text: string }) {
  const { c } = useTheme();
  const lines = text.split("\n");
  const render = (s: string, key: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: c.text }}>{p.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{p}</React.Fragment>
    );
    return <React.Fragment key={key}>{parts}</React.Fragment>;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        if (t.startsWith("- ") || t.startsWith("• ")) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 4 }}>
              <span style={{ color: c.accent }}>•</span>
              <span>{render(t.slice(2), i)}</span>
            </div>
          );
        }
        return <div key={i}>{render(t, i)}</div>;
      })}
    </div>
  );
}

const SUGGESTIONS = [
  "How's my recovery? Should I train hard today?",
  "Plan my workouts for next week",
  "Which muscle groups am I neglecting?",
  "How's my running trending vs last month?",
  "Am I hitting my protein target?",
  "What's the status of my projects?",
];

export default function JarvisChat({ tall = false, initialQuery }: { tall?: boolean; initialQuery?: string }) {
  const { c } = useTheme();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (initialQuery && !sentInitial.current) {
      sentInitial.current = true;
      send(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setItems((it) => [...it, { kind: "user", text }]);

    let convo: ApiMsg[] = [...apiMessages, { role: "user", content: text }];
    const context = await buildContextPack();

    try {
      for (let hop = 0; hop < 10; hop++) {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: convo, context }),
        });
        const j = await res.json();

        if (!res.ok) {
          setItems((it) => [...it, { kind: "error", text: j.error ?? `Request failed (${res.status})` }]);
          break;
        }

        if (j.type === "offline") {
          setItems((it) => [...it, { kind: "jarvis", text: j.text }]);
          break;
        }

        if (j.type === "text") {
          convo = [...convo, j.message];
          const textOut = (j.message.content as Block[])
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          if (textOut.trim()) setItems((it) => [...it, { kind: "jarvis", text: textOut }]);
          break;
        }

        if (j.type === "client_tools") {
          convo = [...convo, j.message];
          const blocks = j.message.content as Block[];
          // Show intermediate text + tool chips
          const interText = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
          if (interText.trim()) setItems((it) => [...it, { kind: "jarvis", text: interText }]);
          for (const t of [...(j.pending as Block[])]) {
            setItems((it) => [...it, { kind: "tool", text: TOOL_LABELS[t.name!] ?? t.name! }]);
          }
          for (const sr of j.server_results as { tool_use_id: string }[]) {
            const name = blocks.find((b) => b.id === sr.tool_use_id)?.name;
            if (name) setItems((it) => [...it, { kind: "tool", text: TOOL_LABELS[name] ?? name }]);
          }

          const clientResults = await Promise.all(
            (j.pending as { id: string; name: string; input: Record<string, unknown> }[]).map(async (t) => ({
              type: "tool_result",
              tool_use_id: t.id,
              content: await executeClientTool(t.name, t.input ?? {}),
            })),
          );
          convo = [...convo, { role: "user", content: [...j.server_results, ...clientResults] as Block[] }];
          continue;
        }

        setItems((it) => [...it, { kind: "error", text: "Unexpected response from Jarvis." }]);
        break;
      }
    } catch (e) {
      setItems((it) => [...it, { kind: "error", text: `Connection problem: ${String(e)}` }]);
    }
    setApiMessages(convo);
    setBusy(false);
  }

  return (
    <div className={tall ? "chat-tall" : undefined} style={{
      display: "flex", flexDirection: "column",
      height: tall ? undefined : 480, minHeight: 380,
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, overflow: "hidden",
      boxShadow: `0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px ${c.accent}11, 0 0 60px ${c.accent}0d`,
    }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><ArcReactor size={46} /></div>
            <div style={{ fontWeight: 700, fontSize: 16, color: c.text, letterSpacing: 1 }}>At your service.</div>
            <div style={{ fontSize: 13, color: c.muted, margin: "6px 0 14px" }}>
              I can read all of your data — WHOOP, Garmin, training, nutrition, weather, projects — and act on it.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="pressable" style={{
                  background: c.surface2, color: c.text2, border: `1px solid ${c.border}`,
                  borderRadius: 999, padding: "8px 13px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((m, i) => {
          if (m.kind === "tool") {
            return (
              <div key={i} className="bubble-in" style={{ alignSelf: "flex-start", fontSize: 11.5, color: c.muted, display: "flex", alignItems: "center", gap: 6, paddingLeft: 6 }}>
                <span style={{ color: c.accent }}>✦</span> {m.text}…
              </div>
            );
          }
          const isUser = m.kind === "user";
          return (
            <div key={i} className="bubble-in" style={{
              alignSelf: isUser ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: isUser ? c.accent : m.kind === "error" ? `${c.critical}22` : c.surface2,
              color: isUser ? "#fff" : m.kind === "error" ? c.critical : c.text2,
              borderRadius: 14,
              borderTopRightRadius: isUser ? 4 : 14,
              borderTopLeftRadius: isUser ? 14 : 4,
              padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55,
            }}>
              {isUser ? m.text : <Md text={m.text} />}
            </div>
          );
        })}
        {busy && (
          <div style={{ alignSelf: "flex-start", color: c.muted, fontSize: 12.5, display: "flex", gap: 8, alignItems: "center", paddingLeft: 6 }}>
            <span style={{ animation: "pulse-glow 1.2s ease-in-out infinite", color: c.accent }}>✦</span> Jarvis is thinking…
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${c.border}` }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Jarvis anything…"
          style={{
            flex: 1, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 12,
            padding: "10px 14px", fontSize: 13.5, color: c.text, outline: "none", fontFamily: "inherit",
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} style={{
          background: `linear-gradient(135deg, ${c.accent}, #1c5cab)`, color: "#fff", border: "none", borderRadius: 12,
          padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: busy || !input.trim() ? "none" : `0 4px 16px ${c.accent}55`,
          opacity: busy || !input.trim() ? 0.5 : 1, fontFamily: "inherit",
        }}>
          ➤
        </button>
      </form>
    </div>
  );
}
