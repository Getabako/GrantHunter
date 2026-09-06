import { NextResponse } from "next/server";
import { listEntries, createEntry } from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const programId = new URL(req.url).searchParams.get("programId") || "ashioto2026";
  return NextResponse.json({ entries: listEntries(programId) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { programId?: string };
  try {
    const entry = createEntry(body.programId || "ashioto2026");
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
