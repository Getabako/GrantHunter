import fs from "node:fs";
import crypto from "node:crypto";
import { paths, readJSON, writeJSON, ensureAll } from "./paths";
import type { Settings, Decision, Score } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  dailyEnabled: true,
  dailyTime: "07:30",
  prefectures: [],
  keywords: [],
  keywordsProfileHash: "",
  minScore: 55,
  maxProposals: 12,
  webResearch: true,
  model: "gpt-5.5",
  notifyMac: true,
  lastRunAt: null,
  onboarded: false,
};

export const DEFAULT_PROFILE = `# 申請者プロフィール

このファイルが「補助金の合う・合わない」を判断する唯一の材料です。
正直に・具体的に書くほど提案の精度が上がります。金額や固有名詞も書いて構いません（このPCの中だけで使います）。

## 事業

- 事業者名（屋号・法人名）:
- 法人 / 個人事業主:
- 所在地（都道府県・市区町村）:
- 業種:
- 創業年:
- 従業員数（役員含む）:
- 直近年度の売上規模:
- 主なサービス・顧客:
- 今後1〜2年でやりたいこと（設備投資・新事業・採用・販路開拓・IT導入 など）:
- 使える自己資金の目安:
- 過去に採択された補助金・受給中の助成金:

## 生活・家族

- 家族構成（配偶者・子どもの年齢）:
- 住まい（持ち家 / 賃貸、築年数、リフォーム・省エネ改修の予定）:
- 車（EV・買い替え予定）:
- 子育て・教育（保育・習い事・進学）:
- 健康・介護:
- 移住・定住・地域活動:
- 学び直し・資格取得の予定:

## 補助金に対する希望

- 優先したいテーマ:
- 避けたいもの（例: 事務負担が重い、後払いで立替が大きい）:
- 申請にかけられる時間の目安:
`;

export function getSettings(): Settings {
  ensureAll();
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(paths.settings, {}) };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  writeJSON(paths.settings, next);
  return next;
}

export function getProfile(): string {
  ensureAll();
  if (!fs.existsSync(paths.profile)) {
    fs.writeFileSync(paths.profile, DEFAULT_PROFILE, "utf8");
  }
  return fs.readFileSync(paths.profile, "utf8");
}

export function saveProfile(text: string) {
  ensureAll();
  fs.writeFileSync(paths.profile, text, "utf8");
}

export function profileHash(): string {
  return crypto.createHash("sha1").update(getProfile()).digest("hex").slice(0, 12);
}

export function getDecisions(): Record<string, Decision> {
  return readJSON<Record<string, Decision>>(paths.decisions, {});
}

export function setDecision(d: Decision) {
  const all = getDecisions();
  all[d.id] = d;
  writeJSON(paths.decisions, all);
}

export function clearDecision(id: string) {
  const all = getDecisions();
  delete all[id];
  writeJSON(paths.decisions, all);
}

export function getScores(): Record<string, Score> {
  return readJSON<Record<string, Score>>(paths.scores, {});
}

export function saveScores(scores: Record<string, Score>) {
  writeJSON(paths.scores, scores);
}
