import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: Request) {
  const patch = (await req.json()) as Partial<Settings>;
  delete (patch as Record<string, unknown>).lastRunAt;
  return NextResponse.json(saveSettings(patch));
}
