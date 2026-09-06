import { NextResponse } from "next/server";
import { startReview } from "@/lib/entries";

export const dynamic = "force-dynamic";

/** バックグラウンドで codex を走らせ jobId を返す。結果は GET /api/entries/jobs/[jobId] でポーリング */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { entryId?: string; questionId?: string; draft?: string };
  if (!body.entryId) return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
  try {
    const job = startReview(body.entryId);
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
