import { NextResponse } from "next/server";
import { fetchProjects } from "@/lib/server/projects";

export async function GET() {
  try {
    return NextResponse.json(await fetchProjects());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
