// 毎日のリサーチ: キーワード生成 → jGrants 検索 → (任意) Web 追加調査 → Codex 採点 → 提案ファイル保存

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { codexJSON } from "./codex";
import { collectCandidates } from "./jgrants";
import { paths, writeJSON, readJSON, today, ensureAll } from "./paths";
import {
  getSettings,
  saveSettings,
  getProfile,
  profileHash,
  getDecisions,
  getScores,
  saveScores,
} from "./settings";
import { notify } from "./notify";
import type { Candidate, Score, Proposal, ProposalDay, ResearchJob } from "./types";

// プロセス内シングルトンのジョブ状態
const g = globalThis as unknown as { __ghResearch?: ResearchJob };
export function researchJob(): ResearchJob {
  if (!g.__ghResearch) {
    g.__ghResearch = { running: false, startedAt: null, phase: "", log: [], error: null, lastDate: null };
  }
  return g.__ghResearch;
}

function log(s: string) {
  const j = researchJob();
  const line = `[${new Date().toLocaleTimeString("ja-JP")}] ${s}`;
  j.log.push(line);
  if (j.log.length > 300) j.log.shift();
  try {
    fs.appendFileSync(path.join(paths.logs, `${today()}.log`), line + "\n");
  } catch {}
}

/** プロフィールから検索キーワードを生成（プロフィールが変わった時だけ再生成） */
async function ensureKeywords(): Promise<string[]> {
  const s = getSettings();
  const hash = profileHash();
  if (s.keywords.length > 0 && s.keywordsProfileHash === hash) return s.keywords;

  log("プロフィールから検索キーワードを生成中…");
  const prompt = `以下は補助金を探している人のプロフィールです。
Jグランツ（国の補助金ポータル）のキーワード検索に使う、日本語の検索語を 14 個作ってください。

条件:
- 事業向け（設備投資・IT導入・販路開拓・人材・創業・DX・教育 など）と、生活向け（子育て・住宅・省エネ・移住・学び直し など）を両方含める
- 1語は 2〜8 文字の名詞（例: "IT導入", "省エネ", "子育て", "販路開拓", "創業"）
- 地域名（都道府県・市名）も 1〜2 個入れる
- 汎用すぎる語（"補助金", "支援"）は入れない

プロフィール:
${getProfile()}

出力 JSON: {"keywords": ["...", "..."]}`;
  const r = await codexJSON<{ keywords: string[] }>(prompt, { effort: "low", timeoutMs: 5 * 60_000 });
  const keywords = (r.keywords || []).map((k) => String(k).trim()).filter((k) => k.length >= 2).slice(0, 16);
  if (keywords.length === 0) throw new Error("キーワード生成に失敗しました");
  saveSettings({ keywords, keywordsProfileHash: hash });
  log(`キーワード: ${keywords.join(" / ")}`);
  return keywords;
}

/** Web 追加調査（自治体・民間財団など jGrants に載らないもの） */
async function webResearch(prefectures: string[]): Promise<Candidate[]> {
  log("Web で自治体・財団系の補助金を追加調査中（codex --search）…");
  const prompt = `あなたは補助金リサーチャーです。ライブ Web 検索を使って、以下のプロフィールの人が **今（${today()} 時点）申請できる** 補助金・助成金・給付金を探してください。
特に Jグランツに載りにくいもの（${prefectures.join("・")} の自治体制度、市区町村の子育て・住宅・省エネ・移住支援、民間財団の助成）を優先します。

条件:
- 受付中、または今後 3 か月以内に受付開始が公表されているものだけ
- 公式ページ（自治体・省庁・財団のドメイン）の URL を必ず添える。まとめサイトの URL は不可
- 6〜12 件
- 締切が分からなければ null

プロフィール:
${getProfile()}

出力 JSON: {"items": [{"title": "...", "url": "https://...", "institution": "実施主体", "area": "対象地域", "maxLimit": 上限額の数値または null, "deadline": "YYYY-MM-DD または null", "summary": "対象と内容を2文で"}]}`;
  try {
    const r = await codexJSON<{ items: Array<Record<string, unknown>> }>(prompt, {
      search: true,
      effort: "medium",
      timeoutMs: 15 * 60_000,
    });
    const items = (r.items || []).filter((x) => typeof x.url === "string" && /^https?:\/\//.test(String(x.url)));
    log(`Web 追加調査: ${items.length}件`);
    return items.map((x) => {
      const url = String(x.url);
      const id = "web:" + crypto.createHash("sha1").update(url).digest("hex").slice(0, 10);
      return {
        id,
        source: "web" as const,
        title: String(x.title || "").trim() || url,
        url,
        area: x.area ? String(x.area) : null,
        maxLimit: typeof x.maxLimit === "number" ? x.maxLimit : null,
        deadline: x.deadline ? String(x.deadline) : null,
        summary: x.summary ? String(x.summary) : null,
        institution: x.institution ? String(x.institution) : null,
      };
    });
  } catch (e) {
    log(`Web 追加調査は失敗（スキップ）: ${(e as Error).message}`);
    return [];
  }
}

/** Codex に候補を採点させる（30件ずつ） */
async function scoreCandidates(cands: Candidate[], hash: string): Promise<Score[]> {
  const out: Score[] = [];
  const profile = getProfile();
  for (let i = 0; i < cands.length; i += 30) {
    const batch = cands.slice(i, i + 30);
    log(`Codex で適合度を採点中… (${i + 1}〜${i + batch.length} / ${cands.length})`);
    const list = batch
      .map(
        (c, k) =>
          `${k + 1}. id=${c.id}\n   題名: ${c.title}\n   地域: ${c.area ?? "不明"} / 上限: ${c.maxLimit ?? "不明"} / 締切: ${c.deadline ?? "不明"}${c.summary ? `\n   概要: ${c.summary}` : ""}`
      )
      .join("\n");
    const prompt = `あなたは中小企業診断士 兼 行政書士レベルの補助金アドバイザーです。
以下のプロフィールの人にとって、各補助金がどれだけ「実際に申請する価値があるか」を採点してください。

採点基準（score 0〜100）:
- 対象要件（地域・業種・規模・個人/法人）に合っていなければ 20 以下
- 合っていて、プロフィールの「やりたいこと」「生活の予定」に直結するなら 70 以上
- 金額が大きく、事務負担が現実的なら加点。返済不要でないもの（融資）は減点
- 情報が足りず判断できない場合は 40〜55 にして reason にその旨を書く

プロフィール:
${profile}

候補:
${list}

出力 JSON: {"scores": [{"id": "...", "score": 0-100, "category": "事業" | "生活" | "両方", "reason": "なぜ合う/合わないかを2文で", "hurdle": "低" | "中" | "高", "suggestedUse": "この人が具体的に何に使えるかを1文で"}]}
候補は全件（${batch.length}件）について必ず出力すること。`;
    try {
      const r = await codexJSON<{ scores: Array<Record<string, unknown>> }>(prompt, {
        effort: "medium",
        timeoutMs: 10 * 60_000,
      });
      const now = new Date().toISOString();
      for (const s of r.scores || []) {
        const id = String(s.id || "");
        if (!batch.some((c) => c.id === id)) continue;
        const cat = String(s.category || "事業");
        const hurdle = String(s.hurdle || "中");
        out.push({
          id,
          score: Math.max(0, Math.min(100, Number(s.score) || 0)),
          category: cat === "生活" || cat === "両方" ? cat : "事業",
          reason: String(s.reason || ""),
          hurdle: hurdle === "低" || hurdle === "高" ? hurdle : "中",
          suggestedUse: String(s.suggestedUse || ""),
          scoredAt: now,
          profileHash: hash,
        });
      }
    } catch (e) {
      log(`採点バッチ失敗（スキップ）: ${(e as Error).message}`);
    }
  }
  return out;
}

/** 同じ制度の「第N回」「N次締切」違いは、締切が一番近いものだけ残す */
function dedupeRounds(list: Proposal[]): Proposal[] {
  const key = (t: string) =>
    t
      .replace(/[（(【\[][^）)】\]]*(次|回|期)[^）)】\]]*[）)】\]]/g, "")
      .replace(/第\s*[0-9０-９一二三四五六七八九十]+\s*(次|回|期)(締切|公募|募集)?/g, "")
      .replace(/\s+/g, "")
      .trim();
  const best = new Map<string, Proposal>();
  for (const p of list) {
    const k = key(p.title);
    const cur = best.get(k);
    if (!cur) {
      best.set(k, p);
      continue;
    }
    const a = Date.parse(p.deadline ?? "2100-01-01");
    const b = Date.parse(cur.deadline ?? "2100-01-01");
    if (a < b) best.set(k, { ...p, score: Math.max(p.score, cur.score) });
  }
  return [...best.values()];
}

/** リサーチ本体。UI からも定時実行からも呼ばれる。 */
export async function runResearch(trigger: "manual" | "daily" = "manual"): Promise<ProposalDay> {
  const job = researchJob();
  if (job.running) throw new Error("リサーチはすでに実行中です");
  ensureAll();
  job.running = true;
  job.startedAt = new Date().toISOString();
  job.error = null;
  job.log = [];
  job.phase = "開始";
  try {
    const settings = getSettings();
    const hash = profileHash();
    log(`リサーチ開始（${trigger === "daily" ? "定時" : "手動"}）`);

    job.phase = "キーワード";
    const keywords = await ensureKeywords();

    job.phase = "Jグランツ検索";
    const { candidates: jg, fetched } = await collectCandidates(keywords, settings.prefectures, log);
    log(`Jグランツ: 受付中の候補 ${jg.length}件`);

    let all: Candidate[] = jg;
    if (settings.webResearch) {
      job.phase = "Web調査";
      const web = await webResearch(settings.prefectures);
      all = [...jg, ...web];
    }

    // 締切を過ぎたものは落とす
    const now = Date.now();
    all = all.filter((c) => !c.deadline || Date.parse(c.deadline) > now - 86_400_000);

    // 既に判断済み（見送り／申請中）は除外
    const decisions = getDecisions();
    all = all.filter((c) => !decisions[c.id]);

    // 採点（未採点 or プロフィール変更後のものだけ Codex に投げる）
    job.phase = "採点";
    const scores = getScores();
    const need = all.filter((c) => !scores[c.id] || scores[c.id].profileHash !== hash);
    log(`採点対象: ${need.length}件（キャッシュ済み ${all.length - need.length}件）`);
    const fresh = await scoreCandidates(need, hash);
    for (const s of fresh) scores[s.id] = s;
    saveScores(scores);

    const proposals: Proposal[] = dedupeRounds(
      all
        .filter((c) => scores[c.id])
        .map((c) => ({ ...c, ...scores[c.id] }))
        .filter((p) => p.score >= settings.minScore)
    )
      .sort((a, b) => b.score - a.score || (Date.parse(a.deadline ?? "2100-01-01") - Date.parse(b.deadline ?? "2100-01-01")))
      .slice(0, settings.maxProposals);

    const day: ProposalDay = {
      date: today(),
      generatedAt: new Date().toISOString(),
      proposals,
      stats: { fetched, newScored: fresh.length, keywords },
    };
    writeJSON(paths.proposalFile(day.date), day);
    saveSettings({ lastRunAt: day.generatedAt });
    job.lastDate = day.date;
    job.phase = "完了";
    log(`完了: 提案 ${proposals.length}件`);

    if (settings.notifyMac) {
      const top = proposals[0];
      notify(
        `補助金の提案 ${proposals.length}件`,
        top ? `1位: ${top.title.slice(0, 40)}（${top.score}点）` : "今日は新しい提案はありません"
      );
    }
    return day;
  } catch (e) {
    job.error = (e as Error).message;
    job.phase = "エラー";
    log(`エラー: ${job.error}`);
    throw e;
  } finally {
    job.running = false;
  }
}

export function latestProposal(): ProposalDay | null {
  ensureAll();
  const files = fs
    .readdirSync(paths.proposals)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  const day = readJSON<ProposalDay | null>(path.join(paths.proposals, files[0]), null);
  if (!day) return null;
  // 表示時点で判断済みのものは落とす
  const decisions = getDecisions();
  return { ...day, proposals: day.proposals.filter((p) => !decisions[p.id]) };
}

export function proposalHistory(): string[] {
  ensureAll();
  return fs
    .readdirSync(paths.proposals)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}
