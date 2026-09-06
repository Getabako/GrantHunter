import { NextResponse } from "next/server";
import { getEntryJob } from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getEntryJob(jobId);
  if (!job) return NextResponse.json({ state: "error", text: "ジョブが見つかりません（サーバー再起動の可能性）", log: [] }, { status: 404 });
  return NextResponse.json({ state: job.state, text: job.text, log: job.log, kind: job.kind, questionId: job.questionId });
}
