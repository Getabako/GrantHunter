// サーバー内スケジューラ: 設定の dailyTime に1日1回 runResearch を走らせる。
// launchd で常駐させれば cron 不要（scripts/install-launchd.sh）。

import { getSettings } from "./settings";
import { runResearch, researchJob } from "./research";
import { today } from "./paths";

const g = globalThis as unknown as { __ghSched?: NodeJS.Timeout };

export function startScheduler() {
  if (g.__ghSched) return;
  g.__ghSched = setInterval(tick, 60_000);
  console.log("[granthunter] 定時リサーチのスケジューラを開始しました");
}

async function tick() {
  try {
    const s = getSettings();
    if (!s.dailyEnabled) return;
    if (researchJob().running) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm < s.dailyTime) return;
    const ranToday = s.lastRunAt && s.lastRunAt.slice(0, 10) === today();
    if (ranToday) return;
    console.log("[granthunter] 定時リサーチを開始");
    await runResearch("daily");
  } catch (e) {
    console.error("[granthunter] 定時リサーチ失敗:", (e as Error).message);
  }
}
