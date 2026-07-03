import { PROJECTS } from "../projectsConfig";
import type { ProjectStatus } from "../types";

const GH = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "jarvis-dashboard",
  };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GH}${path}`, { headers: ghHeaders(), next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const DEMO_STATUS: Record<string, Partial<ProjectStatus>> = {
  seam: { last_commit: { message: "Tune alert cooldowns + demo data polish", author: "alp", date: "", sha: "demo" }, open_prs: 1, open_issues: 3 },
  "seam-backend": { last_commit: { message: "Bump ultralytics, warm model on boot", author: "alp", date: "", sha: "demo" }, open_prs: 0, open_issues: 1 },
  misafir: { last_commit: { message: "Pricing page copy pass", author: "alp", date: "", sha: "demo" }, open_prs: 0, open_issues: 2 },
  jarvis: { last_commit: { message: "Initial JARVIS build", author: "claude", date: "", sha: "demo" }, open_prs: 1, open_issues: 0 },
};

export async function fetchProjects(): Promise<ProjectStatus[]> {
  const hasToken = !!process.env.GITHUB_TOKEN;
  return Promise.all(
    PROJECTS.map(async (p): Promise<ProjectStatus> => {
      const base: ProjectStatus = {
        key: p.key, name: p.name, repo: p.repo, url: p.url,
        description: p.description, tech: p.tech, live: false,
      };
      if (!p.repo) return base;
      if (!hasToken) {
        return { ...base, demo: true, ...DEMO_STATUS[p.key] };
      }
      const [repo, commits, prs] = await Promise.all([
        gh<{ default_branch: string; open_issues_count: number; pushed_at: string }>(`/repos/${p.repo}`),
        gh<{ sha: string; commit: { message: string; author: { name: string; date: string } } }[]>(`/repos/${p.repo}/commits?per_page=1`),
        gh<unknown[]>(`/repos/${p.repo}/pulls?state=open&per_page=100`),
      ]);
      if (!repo) return { ...base, demo: true, ...DEMO_STATUS[p.key] };
      const openPrs = prs?.length ?? 0;
      return {
        ...base,
        live: true,
        default_branch: repo.default_branch,
        pushed_at: repo.pushed_at,
        open_prs: openPrs,
        // GitHub's open_issues_count includes PRs
        open_issues: Math.max(0, repo.open_issues_count - openPrs),
        last_commit: commits?.[0]
          ? {
              message: commits[0].commit.message.split("\n")[0],
              author: commits[0].commit.author?.name ?? "",
              date: commits[0].commit.author?.date ?? "",
              sha: commits[0].sha.slice(0, 7),
            }
          : null,
      };
    }),
  );
}

export async function createGithubIssue(repo: string, title: string, body: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!process.env.GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN not configured" };
  const allowed = PROJECTS.map((p) => p.repo).filter(Boolean);
  if (!allowed.includes(repo)) return { ok: false, error: `repo ${repo} is not in the JARVIS project list` };
  try {
    const res = await fetch(`${GH}/repos/${repo}/issues`, {
      method: "POST",
      headers: { ...ghHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) return { ok: false, error: `github ${res.status}: ${await res.text()}` };
    const j = await res.json();
    return { ok: true, url: j.html_url };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
