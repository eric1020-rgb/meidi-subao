import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { loadMarketData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const vercelCron = request.headers.get("x-vercel-cron");
  if (vercelCron === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fresh fetch (uncached), then invalidate tagged cache so /api/market picks it up.
    const data = await loadMarketData();
    revalidateTag("market");
    return NextResponse.json({
      ok: true,
      asOf: data.asOf,
      source: data.source,
    });
  } catch (e) {
    console.error("[cron/refresh]", e);
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
