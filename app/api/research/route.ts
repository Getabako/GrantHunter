import { NextResponse } from "next/server";
import { runResearch, researchJob } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(researchJob());
}

/** バックグラウンドで開始し、即座に状態を返す（UI は GET でポーリング） */
export async function POST() {
  const job = researchJob();
  if (job.running) return NextResponse.json({ error: "リサーチはすでに実行中です", job });
  runResearch("manual").catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ ok: true, job: researchJob() });
}
