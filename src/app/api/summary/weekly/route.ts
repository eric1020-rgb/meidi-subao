import { NextResponse } from "next/server";
import { loadWeeklySummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await loadWeeklySummary(force);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        source: "error",
        weekLabel: "本週",
        indices: [],
        sectorLeaders: [],
        sectorLaggards: [],
        themes: [],
        highlights: [{ text: "無法載入每周總結", kind: "neutral" }],
        error: true,
        message: "Failed to load weekly summary",
      },
      { status: 200 }
    );
  }
}
