// 「出す」と決めた補助金について、1フォルダに
//   原本（募集要項・交付要綱・申請様式）→ Codex が書式に沿って書類を作成 → チェックリスト
// までを一気に作る。

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { codexRun } from "./codex";
import { getSubsidyDetail, htmlToText } from "./jgrants";
import { paths, ensureDir, sanitizeName, writeJSON, readJSON, today } from "./paths";
import { getProfile, getSettings, setDecision } from "./settings";
import { notify } from "./notify";
import type { ApplicationStatus, Candidate, JgDetail, Proposal } from "./types";

const g = globalThis as unknown as { __ghApps?: Map<string, ApplicationStatus> };
function jobs(): Map<string, ApplicationStatus> {
  if (!g.__ghApps) g.__ghApps = new Map();
  return g.__ghApps;
}

function statusFile(folder: string) {
  return path.join(folder, ".granthunter.json");
}

function persist(st: ApplicationStatus) {
  jobs().set(st.id, st);
  try {
    writeJSON(statusFile(st.folder), st);
  } catch {}
}

function log(st: ApplicationStatus, s: string) {
  const line = `[${new Date().toLocaleTimeString("ja-JP")}] ${s}`;
  st.log.push(line);
  if (st.log.length > 400) st.log.shift();
  st.message = s;
  persist(st);
}

/** 1つの添付（base64）を保存。zip は展開もする。 */
function saveAttachment(dir: string, name: string, b64: string, unzip: boolean): string[] {
  ensureDir(dir);
  const safe = sanitizeName(name, 80) || "file";
  const file = path.join(dir, safe);
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(file, buf);
  const written = [file];
  if (unzip && /\.zip$/i.test(safe)) {
    try {
      const zip = new AdmZip(buf);
      const outDir = path.join(dir, safe.replace(/\.zip$/i, ""));
      zip.extractAllTo(outDir, true);
      written.push(outDir);
    } catch (e) {
      written.push(`(zip展開失敗: ${(e as Error).message})`);
    }
  }
  return written;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "不明";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function writeOverview(folder: string, c: Candidate, d: JgDetail | null, p?: Proposal) {
  const lines: string[] = [];
  lines.push(`# ${c.title}`);
  lines.push("");
  lines.push(`- 公式ページ: ${c.url}`);
  lines.push(`- 実施主体: ${d?.institution_name ?? c.institution ?? "不明"}`);
  lines.push(`- 対象地域: ${d?.target_area_search ?? c.area ?? "不明"}${d?.target_area_detail ? `（${d.target_area_detail}）` : ""}`);
  lines.push(`- 従業員数の条件: ${d?.target_number_of_employees ?? "不明"}`);
  lines.push(`- 補助率: ${d?.subsidy_rate ?? "不明"}`);
  lines.push(`- 上限額: ${d?.subsidy_max_limit ?? c.maxLimit ?? "不明"} 円`);
  lines.push(`- 受付開始: ${fmtDate(d?.acceptance_start_datetime)}`);
  lines.push(`- 受付締切: ${fmtDate(d?.acceptance_end_datetime ?? c.deadline)}`);
  lines.push(`- 事業終了期限: ${d?.project_end_deadline ?? "記載なし"}`);
  lines.push(`- 電子申請: ${d?.request_reception_presence ?? "不明"}`);
  if (p) {
    lines.push("");
    lines.push("## Grant Hunter の見立て");
    lines.push(`- 適合スコア: ${p.score} / 難易度: ${p.hurdle} / 区分: ${p.category}`);
    lines.push(`- 理由: ${p.reason}`);
    lines.push(`- 想定する使い道: ${p.suggestedUse}`);
  }
  if (d?.subsidy_catch_phrase) {
    lines.push("");
    lines.push(`> ${d.subsidy_catch_phrase}`);
  }
  if (d?.detail) {
    lines.push("");
    lines.push("## 概要（Jグランツ掲載文）");
    lines.push(htmlToText(d.detail));
  }
  if (d?.use_purpose) lines.push("", `利用目的: ${d.use_purpose}`);
  if (d?.industry) lines.push(`対象業種: ${d.industry}`);
  if (c.summary) lines.push("", "## Web調査時の要約", c.summary);
  fs.writeFileSync(path.join(folder, "案件概要.md"), lines.join("\n"), "utf8");
}

function buildDraftPrompt(folder: string, c: Candidate, hasForms: boolean): string {
  return `あなたは補助金申請の専門家（中小企業診断士・行政書士）です。
このフォルダ（${folder}）は「${c.title}」の申請書類を作るための作業フォルダです。
公式ページ: ${c.url}

## フォルダの中身
- 00_申請者情報.md … 申請者のプロフィール（これが唯一の事実。ここに無い情報は捏造せず、【要確認: ○○】と書いて空欄にする）
- 案件概要.md … 制度の要点
- 01_募集要項/ … 募集要項（PDF）※無い場合もある
- 02_交付要綱/ … 交付要綱（PDF）※無い場合もある
- 03_申請様式_原本/ … 公式の申請様式（docx / xlsx / pdf / zip 展開済み）※無い場合もある
- 04_作成書類/ … あなたがここに成果物を作る（空フォルダ）

## やること（順番に、最後まで全部やる）
1. まず 00_申請者情報.md と 案件概要.md を読む。
2. 01/02/03 の資料を全部読む。PDF は \`pdftotext\`（なければ \`python3 -c "import pypdf"\` 等。無ければ \`pip3 install --user pypdf python-docx openpyxl\` を試みてよい）で本文を抜く。docx は python-docx、xlsx は openpyxl で構造とセル・段落を確認する。
${hasForms ? "" : `3'. 03_申請様式_原本 が空なので、ライブ Web 検索で公式サイトから申請様式（Word / Excel / PDF）と募集要項を探し、\`curl -L\` で 03_申請様式_原本/ と 01_募集要項/ にダウンロードする。見つからなければ、要項に書かれている「記載事項」から様式を再現する。\n`}3. 04_作成書類/ に以下を作る:
   a. **各申請様式の記入済みコピー**。docx は python-docx で元ファイルをコピーして該当箇所を埋める（レイアウト・様式番号・体裁を壊さない）。xlsx は openpyxl で該当セルだけ埋める。PDF 様式（編集不可）は \`<様式名>_記入内容.md\` に「項目 → 記入する文章」の対応表を作る。ファイル名は「記入済_<元ファイル名>」。
   b. **事業計画書.md**（事業系）または **申請理由書.md**（生活系）。募集要項の審査項目・加点項目を見出しにして、審査員が読みやすい構成で書く。数値目標・スケジュール・経費内訳（税抜、補助対象経費と自己負担を分ける）を入れる。
   c. **経費明細.md**: 補助対象経費の一覧（品目 / 数量 / 単価 / 金額 / 補助対象かどうか / 根拠）。プロフィールに金額が無ければ相場感で仮置きし【仮】と印を付ける。
   d. **チェックリスト.md**: 提出書類一覧（様式番号ごとに「作成済 / 要取得（納税証明・登記簿 等）/ 要署名」の状態）、締切、提出方法（電子申請の URL・GビズID の要否）、審査から交付・実績報告までのスケジュール、よくある不備。
   e. **要確認事項.md**: 申請者に確認しないと埋められない項目を、質問文の形で列挙（番号付き）。
   f. **README.md**: このフォルダの使い方（どれを提出するか、次に何をすべきか）を 10 行以内で。
4. 最後に、作ったファイルの一覧と「要確認事項」の件数を報告する。

## 守ること
- 申請者情報に無い事実（売上、従業員数、住所、日付など）を勝手に埋めない。必ず【要確認: 内容】の形で残す。
- 要項に「対象外」と書かれている使い道を提案しない。要件を満たさない可能性があれば README の冒頭に太字で警告する。
- 日本語で、公的書類の文体（です・ます / である を様式に合わせる）。
- 04_作成書類/ 以外のファイルは変更しない（原本は必ず残す）。
- 途中でエラーが出ても止まらず、できる範囲で最後まで作る。`;
}

/** 「出す」= 申請フォルダを作って Codex に書類を作らせる。バックグラウンドで走る。 */
export function startApplication(c: Candidate, p?: Proposal): ApplicationStatus {
  ensureDir(paths.appsRoot);
  const folderName = `${today().replace(/-/g, "")}_${sanitizeName(c.title, 40)}`;
  const folder = path.join(paths.appsRoot, folderName);
  ensureDir(folder);

  const st: ApplicationStatus = {
    id: c.id,
    title: c.title,
    folder,
    createdAt: new Date().toISOString(),
    state: "preparing",
    message: "準備中",
    log: [],
    deadline: c.deadline,
    url: c.url,
  };
  persist(st);
  setDecision({ id: c.id, decision: "apply", decidedAt: st.createdAt, folder });

  (async () => {
    try {
      const settings = getSettings();
      fs.writeFileSync(path.join(folder, "00_申請者情報.md"), getProfile(), "utf8");
      for (const d of ["01_募集要項", "02_交付要綱", "03_申請様式_原本", "04_作成書類"]) ensureDir(path.join(folder, d));

      let detail: JgDetail | null = null;
      let hasForms = false;
      if (c.source === "jgrants") {
        log(st, "Jグランツから詳細・添付資料を取得中…");
        detail = await getSubsidyDetail(c.id, true);
        st.deadline = detail.acceptance_end_datetime ?? st.deadline;
        for (const a of detail.application_guidelines ?? []) {
          const w = saveAttachment(path.join(folder, "01_募集要項"), a.name, a.data, true);
          log(st, `募集要項: ${path.basename(w[0])}`);
        }
        for (const a of detail.outline_of_grant ?? []) {
          const w = saveAttachment(path.join(folder, "02_交付要綱"), a.name, a.data, true);
          log(st, `交付要綱: ${path.basename(w[0])}`);
        }
        for (const a of detail.application_form ?? []) {
          const w = saveAttachment(path.join(folder, "03_申請様式_原本"), a.name, a.data, true);
          hasForms = true;
          log(st, `申請様式: ${path.basename(w[0])}${w.length > 1 ? "（zip 展開済み）" : ""}`);
        }
        if (!hasForms) log(st, "Jグランツに様式の添付なし。Codex に Web から探させます。");
      } else {
        log(st, "Web 由来の案件です。Codex に公式サイトから要項・様式を取得させます。");
      }
      writeOverview(folder, c, detail, p);

      st.state = "drafting";
      log(st, "Codex が書類を作成中…（数分〜十数分かかります）");
      const result = await codexRun(buildDraftPrompt(folder, c, hasForms), {
        mode: "full",
        cwd: folder,
        search: true,
        effort: "high",
        model: settings.model,
        timeoutMs: 40 * 60_000,
        onLog: (line) => {
          if (line.length < 200 && !/^\s*[{}\[\]]/.test(line)) {
            st.log.push(`  ${line}`);
            if (st.log.length > 400) st.log.shift();
          }
        },
      });
      fs.writeFileSync(path.join(folder, "04_作成書類", "_codex_report.md"), result, "utf8");
      const made = fs.readdirSync(path.join(folder, "04_作成書類")).filter((f) => !f.startsWith("_") && !f.startsWith("."));
      st.state = "done";
      log(st, `完了: 04_作成書類 に ${made.length} ファイル`);
      if (settings.notifyMac) notify("申請書類ができました", c.title.slice(0, 50));
    } catch (e) {
      st.state = "error";
      log(st, `エラー: ${(e as Error).message}`);
      if (getSettings().notifyMac) notify("書類作成でエラー", (e as Error).message.slice(0, 80));
    }
  })();

  return st;
}

/** 進行中 + 過去のフォルダを一覧 */
export function listApplications(): ApplicationStatus[] {
  ensureDir(paths.appsRoot);
  const map = new Map<string, ApplicationStatus>();
  for (const name of fs.readdirSync(paths.appsRoot)) {
    const dir = path.join(paths.appsRoot, name);
    const st = readJSON<ApplicationStatus | null>(statusFile(dir), null);
    if (st) map.set(st.folder, st);
  }
  for (const st of jobs().values()) map.set(st.folder, st);
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getApplication(id: string): ApplicationStatus | null {
  return jobs().get(id) ?? listApplications().find((a) => a.id === id) ?? null;
}
