import { NextResponse } from "next/server";
import { PROGRAMS, toInfo } from "@/lib/programs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ programs: PROGRAMS.map(toInfo) });
}
