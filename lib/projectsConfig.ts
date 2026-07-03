// The projects JARVIS watches. Repos wired to real GitHub data when
// GITHUB_TOKEN is configured; entries with repo: null (or unreachable repos)
// render from the description alone until you point them at a repository.

export interface ProjectDef {
  key: string;
  name: string;
  repo: string | null;   // owner/repo
  url: string | null;    // live deployment
  description: string;
  tech: string;
}

export const PROJECTS: ProjectDef[] = [
  {
    key: "seam",
    name: "Seam",
    repo: "alpsisman-tech/seam-app",
    url: "https://seam-app.netlify.app",
    description: "AI textile defect detection platform — Next.js dashboard, Supabase, YOLO model.",
    tech: "Next.js · Supabase · YOLO",
  },
  {
    key: "seam-backend",
    name: "Seam Backend",
    repo: "alpsisman-tech/seam-backend",
    url: null,
    description: "Flask inference service for Seam's defect-detection model (Hugging Face Space).",
    tech: "Flask · Ultralytics",
  },
  {
    key: "misafir",
    name: "Misafir",
    repo: "alpsisman-tech/misafir",
    url: null,
    description: "Guest-experience static site — landing, pricing, onboarding flow.",
    tech: "Static HTML/CSS",
  },
  {
    key: "jarvis",
    name: "Jarvis",
    repo: "alpsisman-tech/jarvis",
    url: null,
    description: "This app — personal ops dashboard + AI agent.",
    tech: "Next.js · Anthropic · n8n",
  },
  {
    key: "gaia",
    name: "Gaia",
    repo: null, // point at the repo when it lives on GitHub
    url: null,
    description: "Gaia project — connect its repo in lib/projectsConfig.ts to go live.",
    tech: "—",
  },
  {
    key: "hassan-rfq",
    name: "Hassan RFQ→Quote Agent",
    repo: null, // point at the repo when it lives on GitHub
    url: null,
    description: "RFQ-to-quote automation agent — connect its repo in lib/projectsConfig.ts to go live.",
    tech: "—",
  },
];
