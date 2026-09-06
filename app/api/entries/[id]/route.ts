import { NextResponse } from "next/server";
import { getEntry, saveEntry, removeEntry } from "@/lib/entries";
import type { Answers } from "@/lib/programs/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const entry = getEntry(id);
  if (!entry) return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { answers?: Answers };
  const entry = saveEntry(id, body.answers ?? {});
  if (!entry) return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return NextResponse.json({ ok: removeEntry(id) });
}
