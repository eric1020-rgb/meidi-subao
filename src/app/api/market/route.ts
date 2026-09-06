import { NextResponse } from "next/server";
import { loadMarketData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await loadMarketData();
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load market data" }, { status: 500 });
  }
}
