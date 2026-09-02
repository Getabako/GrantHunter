import { NextResponse } from "next/server";
import { setDecision } from "@/lib/settings";
import { startApplication } from "@/lib/apply";
import type { Proposal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { proposal: Proposal; decision: "apply" | "skip" };
  const p = body.proposal;
  if (!p?.id || !p.title) return NextResponse.json({ error: "proposal が不正です" }, { status: 400 });
  if (body.decision === "skip") {
    setDecision({ id: p.id, decision: "skip", decidedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }
  try {
    const st = startApplication(p, p);
    return NextResponse.json({ ok: true, application: st });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
