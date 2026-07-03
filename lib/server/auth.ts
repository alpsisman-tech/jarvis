import { NextRequest, NextResponse } from "next/server";

// Single-user auth: every mutating/data API route requires the shared token
// from JARVIS_ACCESS_TOKEN (set the same value in Settings → Access).
// Returns a NextResponse error to bubble up, or null when authorized.
export function requireToken(req: NextRequest): NextResponse | null {
  const expected = process.env.JARVIS_ACCESS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "JARVIS_ACCESS_TOKEN is not configured on the server" },
      { status: 501 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
