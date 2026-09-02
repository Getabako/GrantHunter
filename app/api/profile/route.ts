import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ profile: getProfile() });
}

export async function POST(req: Request) {
  const { profile } = (await req.json()) as { profile: string };
  if (typeof profile !== "string") return NextResponse.json({ error: "profile が不正です" }, { status: 400 });
  saveProfile(profile);
  return NextResponse.json({ ok: true });
}
