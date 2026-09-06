import { NextResponse } from "next/server";
import { loadNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await loadNews(force);
    return NextResponse.json(data, {
      headers: {
        // Client polls ~90s; brief CDN hint keeps sources from being hammered.
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        items: [],
        asOf: new Date().toISOString(),
        source: "error",
        error: true,
        message: "Failed to load news",
      },
      { status: 200 }
    );
  }
}
