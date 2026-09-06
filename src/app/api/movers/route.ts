import { NextResponse } from "next/server";
import { loadMovers } from "@/lib/movers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await loadMovers(force);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        gainers: [],
        losers: [],
        asOf: new Date().toISOString(),
        source: "error",
        error: true,
        message: "Failed to load movers",
      },
      { status: 200 }
    );
  }
}
