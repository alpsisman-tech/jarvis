import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveTokens, syncWhoop } from "@/lib/server/whoop";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing code", detail: req.nextUrl.searchParams.get("error") }, { status: 400 });
  }
  try {
    const tokens = await exchangeCode(code);
    await saveTokens(tokens);
    // Pull the first two weeks immediately so the dashboard fills in.
    let synced = null;
    try { synced = await syncWhoop(14); } catch { /* first sync can be retried from Settings */ }
    const url = new URL("/settings", process.env.APP_URL ?? req.nextUrl.origin);
    url.searchParams.set("whoop", synced ? "connected" : "authorized");
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
