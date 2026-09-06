import { NextResponse } from "next/server";
import { exportEntry } from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { review?: string; judge?: string };
  try {
    const application = exportEntry(id, body);
    return NextResponse.json({ ok: true, application });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
