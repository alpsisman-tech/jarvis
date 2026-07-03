import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "@/lib/server/weather";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat")) || 41.015;
  const lon = Number(sp.get("lon")) || 28.979;
  const place = sp.get("place") || "Istanbul";
  try {
    return NextResponse.json(await fetchWeather(lat, lon, place));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
