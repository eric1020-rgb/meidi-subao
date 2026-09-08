import { NextResponse } from "next/server";
import { loadDailySummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await loadDailySummary(force);
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
        sessionLabel: "美股盤後總結",
        indices: [],
        sectorLeaders: [],
        sectorLaggards: [],
        topGainers: [],
        topLosers: [],
        highlights: [{ text: "無法載入每日總結", kind: "neutral" }],
        error: true,
        message: "Failed to load daily summary",
      },
      { status: 200 }
    );
  }
}
