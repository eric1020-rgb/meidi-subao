import { NextResponse } from "next/server";
import { getCachedMarketData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCachedMarketData();
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load market data" }, { status: 500 });
  }
}
