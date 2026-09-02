// Jグランツ公開API（デジタル庁）。認証不要・無料。
// 仕様: https://developers.digital.go.jp/documents/jgrants/api/
// 同じAPIを MCP 化したものが https://github.com/digital-go-jp/jgrants-mcp-server
// （本ツールは追加セットアップ不要にするため API を直接叩く。MCP は codex 側の任意オプション）

import fs from "node:fs";
import { paths, readJSON, writeJSON } from "./paths";
import type { JgSummary, JgDetail, Candidate } from "./types";

const BASE = process.env.JGRANTS_API_BASE ?? "https://api.jgrants-portal.go.jp/exp/v1/public";
const TIMEOUT_MS = 30_000;

async function getJSON<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`jGrants API ${res.status}: ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** キーワード検索（受付中のみ）。キーワードは2文字以上必須。 */
export async function searchSubsidies(keyword: string): Promise<JgSummary[]> {
  const kw = keyword.trim();
  if (kw.length < 2) return [];
  const q = new URLSearchParams({
    keyword: kw,
    sort: "acceptance_end_datetime",
    order: "ASC",
    acceptance: "1",
  });
  const data = await getJSON<{ result?: JgSummary[] }>(`${BASE}/subsidies?${q}`);
  return data.result ?? [];
}

/** 詳細（募集要項・交付要綱・申請様式の base64 を含む）。ローカルにキャッシュ。 */
export async function getSubsidyDetail(id: string, force = false): Promise<JgDetail> {
  const file = paths.subsidyFile(id);
  if (!force && fs.existsSync(file)) {
    const cached = readJSON<JgDetail | null>(file, null);
    if (cached) return cached;
  }
  const data = await getJSON<{ result?: JgDetail[] }>(`${BASE}/subsidies/id/${encodeURIComponent(id)}`);
  const d = data.result?.[0];
  if (!d) throw new Error(`jGrants 詳細が見つかりません: ${id}`);
  writeJSON(file, d);
  return d;
}

/** 対象地域フィルタ: 全国 / 未指定 / 指定都道府県のいずれかなら残す */
export function matchesArea(area: string | null | undefined, prefectures: string[]): boolean {
  if (!area) return true;
  if (area.includes("全国")) return true;
  return prefectures.some((p) => area.includes(p) || area.includes(p.replace(/[都道府県]$/, "")));
}

export function toCandidate(s: JgSummary): Candidate {
  return {
    id: s.id,
    source: "jgrants",
    title: s.title,
    url: `https://www.jgrants-portal.go.jp/subsidy/${s.id}`,
    area: s.target_area_search ?? null,
    maxLimit: s.subsidy_max_limit ?? null,
    deadline: s.acceptance_end_datetime ?? null,
    institution: s.institution_name ?? null,
  };
}

/** 複数キーワードで検索し、地域で絞ってユニーク化 */
export async function collectCandidates(
  keywords: string[],
  prefectures: string[],
  log: (s: string) => void = () => {}
): Promise<{ candidates: Candidate[]; fetched: number }> {
  const seen = new Map<string, Candidate>();
  let fetched = 0;
  for (const kw of keywords) {
    try {
      const list = await searchSubsidies(kw);
      fetched += list.length;
      let kept = 0;
      for (const s of list) {
        if (!matchesArea(s.target_area_search, prefectures)) continue;
        if (!seen.has(s.id)) {
          seen.set(s.id, toCandidate(s));
          kept++;
        }
      }
      log(`「${kw}」: ${list.length}件中 ${kept}件を追加`);
    } catch (e) {
      log(`「${kw}」: 取得失敗 (${(e as Error).message})`);
    }
  }
  return { candidates: [...seen.values()], fetched };
}

/** HTML の detail をざっくりテキスト化 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
