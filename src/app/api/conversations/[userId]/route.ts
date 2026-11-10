import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const messages = await getMessages(userId);
    return NextResponse.json(messages);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
