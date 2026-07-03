"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Card, PageTitle, Chip } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function ProjectsPage() {
  const { c } = useTheme();
  const [projects, setProjects] = useState<ProjectStatus[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProjects)
      .catch(() => setErr(true));
  }, []);

  return (
    <div>
      <PageTitle
        title="Projects"
        sub="Live status across your repos — commits, PRs and issues. Jarvis can open issues on any of them."
      />
      {err && <Card><div style={{ color: c.muted, fontSize: 13 }}>Couldn&apos;t load project status.</div></Card>}
      {!projects && !err && <Card><div style={{ color: c.muted, fontSize: 13 }}>Loading…</div></Card>}
      {projects && (
        <div className="grid2">
          {projects.map((p) => (
            <Card key={p.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{p.name}</span>
                {p.live && <Chip color={c.good}>● live data</Chip>}
                {p.demo && <Chip color={c.warning}>demo status — add GITHUB_TOKEN</Chip>}
                {!p.repo && <Chip color={c.muted} bg={c.surface2}>repo not connected</Chip>}
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: c.muted }}>{p.tech}</span>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: c.text2, lineHeight: 1.5 }}>{p.description}</p>
              {p.last_commit && (
                <div style={{ background: c.surface2, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: c.text }}>
                    <span style={{ color: c.accent, fontFamily: "monospace" }}>{p.last_commit.sha}</span>{" "}
                    {p.last_commit.message}
                  </div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                    {p.last_commit.author}{p.pushed_at ? ` · pushed ${timeAgo(p.pushed_at)}` : ""}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: c.text2, flexWrap: "wrap" }}>
                {p.open_prs !== undefined && <span>⇄ <b style={{ color: c.text }}>{p.open_prs}</b> open PRs</span>}
                {p.open_issues !== undefined && <span>◎ <b style={{ color: c.text }}>{p.open_issues}</b> issues</span>}
                {p.repo && (
                  <a href={`https://github.com/${p.repo}`} target="_blank" rel="noreferrer" style={{ color: c.accent, marginLeft: "auto" }}>
                    GitHub →
                  </a>
                )}
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ color: c.accent }}>
                    Site →
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 12.5, color: c.muted }}>
        Need a change on one of these? <Link href={`/jarvis?q=${encodeURIComponent("I want to change something on the misafir website")}`} style={{ color: c.accent }}>Tell Jarvis</Link> — it files a scoped GitHub issue on the right repo.
      </div>
    </div>
  );
}
