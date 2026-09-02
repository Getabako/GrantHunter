import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { openFolder } from "@/lib/notify";
import { paths } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** 申請フォルダ配下だけ Finder で開けるようにする */
export async function POST(req: Request) {
  const { folder } = (await req.json()) as { folder: string };
  const target = path.resolve(String(folder || ""));
  const root = path.resolve(paths.appsRoot);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "申請フォルダ以外は開けません" }, { status: 400 });
  }
  if (!fs.existsSync(target)) return NextResponse.json({ error: "フォルダがありません" }, { status: 404 });
  openFolder(target);
  return NextResponse.json({ ok: true });
}
