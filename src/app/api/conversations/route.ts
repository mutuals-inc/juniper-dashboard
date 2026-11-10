import { NextRequest, NextResponse } from "next/server";
import { getThreads } from "@/lib/data";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q");
    const threads = await getThreads(query || undefined);
    return NextResponse.json(threads);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
