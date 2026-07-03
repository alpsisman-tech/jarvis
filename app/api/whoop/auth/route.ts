import { NextResponse } from "next/server";
import { whoopAuthUrl } from "@/lib/server/whoop";

export async function GET() {
  if (!process.env.WHOOP_CLIENT_ID || !process.env.APP_URL) {
    return NextResponse.json({ error: "Set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET and APP_URL first (see SETUP.md)" }, { status: 501 });
  }
  const state = Math.random().toString(36).slice(2);
  return NextResponse.redirect(whoopAuthUrl(state));
}
