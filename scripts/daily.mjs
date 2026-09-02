#!/usr/bin/env node
// 定時リサーチを外部（cron / launchd / 手動）から叩くためのスクリプト。
// サーバーが起動していなければ bin/cli.js で起動してから /api/research を呼ぶ。
// 使い方: node scripts/daily.mjs   （PORT 環境変数で対象ポートを指定可。既定 4611）

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "4611";
const BASE = `http://127.0.0.1:${PORT}`;

async function alive() {
  try {
    const r = await fetch(`${BASE}/api/settings`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await alive()) return null;
  console.log("Grant Hunter を起動します…");
  const child = spawn(process.execPath, [path.join(ROOT, "bin", "cli.js")], {
    env: { ...process.env, PORT },
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await alive()) return child;
  }
  throw new Error("サーバーが起動しませんでした");
}

async function main() {
  await ensureServer();
  const start = await fetch(`${BASE}/api/research`, { method: "POST" }).then((r) => r.json());
  if (start.error) {
    console.log(start.error);
  }
  // 完了までポーリング（最大 60 分）
  for (let i = 0; i < 720; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const j = await fetch(`${BASE}/api/research`).then((r) => r.json());
    if (!j.running) {
      if (j.error) {
        console.error("失敗:", j.error);
        process.exit(1);
      }
      break;
    }
  }
  const { day } = await fetch(`${BASE}/api/proposals`).then((r) => r.json());
  if (!day) {
    console.log("提案なし");
    return;
  }
  console.log(`\n${day.date} の提案 ${day.proposals.length}件\n`);
  for (const p of day.proposals) {
    console.log(`[${p.score}] ${p.title}`);
    console.log(`     ${p.url}`);
    console.log(`     ${p.reason}`);
  }
  console.log(`\nブラウザで開く: ${BASE}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
