import { NextResponse } from "next/server";
import { latestProposal, proposalHistory } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ day: latestProposal(), history: proposalHistory() });
}
