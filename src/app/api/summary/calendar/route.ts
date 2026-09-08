import { NextResponse } from "next/server";
import { loadCalendarSummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await loadCalendarSummary(force);
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
        rangeLabel: "未來一周",
        events: [],
        error: true,
        message: "Failed to load calendar",
      },
      { status: 200 }
    );
  }
}
