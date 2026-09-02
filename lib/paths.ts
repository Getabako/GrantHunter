import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// 設定・キャッシュ置き場（隠しフォルダ）
const ROOT =
  process.env.GRANTHUNTER_DATA_ROOT ?? path.join(os.homedir(), ".granthunter-data");

// 申請フォルダ置き場（目に見える場所。1案件 = 1フォルダ）
const APPS_ROOT =
  process.env.GRANTHUNTER_APPS_ROOT ?? path.join(os.homedir(), "Desktop", "補助金申請");

export const paths = {
  root: ROOT,
  settings: path.join(ROOT, "settings.json"),
  profile: path.join(ROOT, "profile.md"),
  decisions: path.join(ROOT, "decisions.json"),
  scores: path.join(ROOT, "scores.json"),
  subsidies: path.join(ROOT, "subsidies"),
  proposals: path.join(ROOT, "proposals"),
  logs: path.join(ROOT, "logs"),
  appsRoot: APPS_ROOT,
  proposalFile(date: string) {
    return path.join(ROOT, "proposals", `${date}.json`);
  },
  subsidyFile(id: string) {
    return path.join(ROOT, "subsidies", `${id}.json`);
  },
};

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function ensureAll() {
  for (const p of [paths.root, paths.subsidies, paths.proposals, paths.logs, paths.appsRoot]) {
    ensureDir(p);
  }
}

export function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(file: string, data: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** フォルダ名に使えない文字を落とす（日本語はそのまま残す） */
export function sanitizeName(s: string, max = 40): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\s　]+/g, "_")
    .trim()
    .slice(0, max);
}
