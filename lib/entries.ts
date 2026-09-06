// プログラム応募（ASHIOTO 等）の回答保存・AI ジョブ・申請フォルダへの書き出し
// 保存先: ~/.granthunter-data/entries/<programId>/<id>.json

import fs from "node:fs";
import path from "node:path";
import { codexRun } from "./codex";
import { paths, ensureDir, readJSON, writeJSON, sanitizeName, today } from "./paths";
import { getProfile, getSettings, DEFAULT_PROFILE } from "./settings";
import { getProgram } from "./programs";
import type { Answers, EntryDoc, EntryJob, EntrySummary, ProgramTemplate, Question } from "./programs/types";
import type { ApplicationStatus } from "./types";

function nowIso() {
  return new Date().toISOString();
}

/** AshiotoDoc と同じ形式: YYYYMMDD-HHMMSS-xxxx */
export function newId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rnd}`;
}

export function titleOf(answers: Answers): string {
  const t = answers?.project_name;
  const s = Array.isArray(t) ? t.join(" ") : String(t ?? "");
  return s.trim() || "無題";
}

/** 旧 AshiotoDoc（~/.ashioto-doc/documents/*.json）を初回だけ取り込む。元は消さない */
function migrateLegacy() {
  const dest = paths.entryDir("ashioto2026");
  ensureDir(dest);
  const already = fs.readdirSync(dest).some((f) => f.endsWith(".json"));
  if (already) return;
  const src = paths.legacyAshiotoDocs;
  if (!fs.existsSync(src)) return;
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(src, f), "utf8")) as Partial<EntryDoc> & { answers?: Answers };
      const id = raw.id || f.replace(/\.json$/, "");
      const doc: EntryDoc = {
        id,
        programId: "ashioto2026",
        answers: raw.answers ?? {},
        createdAt: raw.createdAt ?? nowIso(),
        updatedAt: raw.updatedAt ?? nowIso(),
      };
      writeJSON(paths.entryFile("ashioto2026", id), doc);
    } catch {}
  }
}

let migrated = false;

export function listEntries(programId: string): EntrySummary[] {
  if (!migrated) {
    migrated = true;
    try {
      migrateLegacy();
    } catch {}
  }
  const dir = paths.entryDir(programId);
  ensureDir(dir);
  const out: EntrySummary[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = readJSON<EntryDoc | null>(path.join(dir, f), null);
    if (!doc) continue;
    out.push({ id: doc.id, programId, title: titleOf(doc.answers), createdAt: doc.createdAt, updatedAt: doc.updatedAt });
  }
  out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return out;
}

function findFile(id: string): { programId: string; file: string } | null {
  ensureDir(paths.entries);
  for (const programId of fs.readdirSync(paths.entries)) {
    const file = paths.entryFile(programId, id);
    if (fs.existsSync(file)) return { programId, file };
  }
  return null;
}

export function getEntry(id: string): EntryDoc | null {
  const hit = findFile(id);
  return hit ? readJSON<EntryDoc | null>(hit.file, null) : null;
}

export function createEntry(programId: string): EntryDoc {
  if (!getProgram(programId)) throw new Error("不明なプログラムです: " + programId);
  const doc: EntryDoc = { id: newId(), programId, answers: {}, createdAt: nowIso(), updatedAt: nowIso() };
  writeJSON(paths.entryFile(programId, doc.id), doc);
  return doc;
}

export function saveEntry(id: string, answers: Answers): EntryDoc | null {
  const existing = getEntry(id);
  if (!existing) return null;
  const doc: EntryDoc = { ...existing, answers: answers ?? {}, updatedAt: nowIso() };
  writeJSON(paths.entryFile(doc.programId, id), doc);
  return doc;
}

export function removeEntry(id: string): boolean {
  const hit = findFile(id);
  if (!hit) return false;
  fs.unlinkSync(hit.file);
  return true;
}

// ---------- AI ジョブ（assist / review / judge） ----------

const g = globalThis as unknown as { __ghEntryJobs?: Map<string, EntryJob> };
function jobs(): Map<string, EntryJob> {
  if (!g.__ghEntryJobs) g.__ghEntryJobs = new Map();
  return g.__ghEntryJobs;
}

export function getEntryJob(jobId: string): EntryJob | null {
  return jobs().get(jobId) ?? null;
}

/** プロフィールが初期テンプレのままなら渡さない */
function usableProfile(): string | undefined {
  const p = getProfile().trim();
  if (!p || p === DEFAULT_PROFILE.trim()) return undefined;
  return p;
}

function loadFor(entryId: string): { doc: EntryDoc; program: ProgramTemplate } {
  const doc = getEntry(entryId);
  if (!doc) throw new Error("書類が見つかりません");
  const program = getProgram(doc.programId);
  if (!program) throw new Error("プログラム定義がありません: " + doc.programId);
  return { doc, program };
}

function startJob(kind: EntryJob["kind"], entryId: string, prompt: string, questionId?: string): EntryJob {
  const job: EntryJob = { id: newId(), kind, entryId, questionId, state: "running", text: "", log: [], startedAt: nowIso() };
  jobs().set(job.id, job);
  // 古いジョブを間引く
  if (jobs().size > 60) {
    const old = [...jobs().values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(0, jobs().size - 60);
    for (const o of old) if (o.state !== "running") jobs().delete(o.id);
  }
  (async () => {
    try {
      const settings = getSettings();
      const text = await codexRun(prompt, {
        mode: "read-only",
        model: settings.model,
        effort: "high",
        timeoutMs: 15 * 60_000,
        onLog: (line) => {
          if (line.length < 200) {
            job.log.push(line);
            if (job.log.length > 200) job.log.shift();
          }
        },
      });
      job.text = text.trim();
      job.state = "done";
    } catch (e) {
      job.state = "error";
      job.text = (e as Error).message;
    }
  })();
  return job;
}

export function startAssist(entryId: string, questionId: string, draft: string): EntryJob {
  const { doc, program } = loadFor(entryId);
  const q: Question | undefined = program.questions.find((x) => x.id === questionId);
  if (!q) throw new Error("設問が見つかりません: " + questionId);
  return startJob("assist", entryId, program.assistPrompt(q, draft ?? "", doc.answers, usableProfile()), questionId);
}

export function startReview(entryId: string): EntryJob {
  const { doc, program } = loadFor(entryId);
  return startJob("review", entryId, program.reviewPrompt(doc.answers, usableProfile()));
}

export function startJudge(entryId: string): EntryJob {
  const { doc, program } = loadFor(entryId);
  return startJob("judge", entryId, program.judgePrompt(doc.answers, usableProfile()));
}

// ---------- 申請フォルダへの書き出し ----------

function isVisible(q: Question, answers: Answers): boolean {
  if (!q.showIf) return true;
  return answers[q.showIf.id] === q.showIf.equals;
}

export function buildEntryMarkdown(program: ProgramTemplate, doc: EntryDoc): string {
  const a = doc.answers;
  const title = titleOf(a);
  const lines: string[] = [];
  lines.push(`# ${program.name} エントリー書類`);
  lines.push("");
  lines.push(`プロジェクト名：**${title}**`);
  lines.push("");
  lines.push(`- 公式情報: ${program.url}`);
  if (program.deadline) {
    const d = new Date(program.deadline);
    lines.push(`- 締切: ${isNaN(d.getTime()) ? program.deadline : d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
  }
  lines.push(`- 最終更新: ${new Date(doc.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
  lines.push("- 提出前チェック: フォーム末尾の同意事項へのチェック忘れに注意");
  lines.push("");
  lines.push("---");
  for (const [secId, secName] of Object.entries(program.sections)) {
    const qs = program.questions.filter((q) => q.section === secId && isVisible(q, a));
    if (qs.length === 0) continue;
    lines.push("");
    lines.push(`## ${secName}`);
    for (const q of qs) {
      const v = a[q.id];
      const val = Array.isArray(v) ? v.join(" / ") : String(v ?? "").trim();
      lines.push("");
      lines.push(`### ${q.label}${q.minChars ? `（${q.minChars}字以上）` : ""}`);
      lines.push(val || "（未記入）");
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function exportEntry(id: string, extra?: { review?: string; judge?: string }): ApplicationStatus {
  const { doc, program } = loadFor(id);
  ensureDir(paths.appsRoot);
  const title = titleOf(doc.answers);
  const folderName = `${today().replace(/-/g, "")}_${sanitizeName(program.id.toUpperCase(), 20)}_${sanitizeName(title, 40)}`;
  const folder = path.join(paths.appsRoot, folderName);
  const docs = path.join(folder, "04_作成書類");
  ensureDir(docs);

  const files: string[] = [];
  const mdName = program.id === "ashioto2026" ? "ASHIOTO応募書類.md" : `${sanitizeName(program.name, 30)}_応募書類.md`;
  fs.writeFileSync(path.join(docs, mdName), buildEntryMarkdown(program, doc), "utf8");
  files.push(mdName);
  if (extra?.review?.trim()) {
    fs.writeFileSync(path.join(docs, "採択レビュー.md"), `# 採択レビュー（${title}）\n\n${extra.review.trim()}\n`, "utf8");
    files.push("採択レビュー.md");
  }
  if (extra?.judge?.trim()) {
    fs.writeFileSync(path.join(docs, "審査員採点.md"), `# 審査員採点（${title}）\n\n${extra.judge.trim()}\n`, "utf8");
    files.push("審査員採点.md");
  }

  const statusPath = path.join(folder, ".granthunter.json");
  const prev = readJSON<ApplicationStatus | null>(statusPath, null);
  const st: ApplicationStatus = {
    id: `entry:${doc.id}`,
    title: program.name,
    folder,
    createdAt: prev?.createdAt ?? nowIso(),
    state: "done",
    message: `書き出し完了: ${files.join("、")}（${title}）`,
    log: [...(prev?.log ?? []), `[${new Date().toLocaleTimeString("ja-JP")}] 書き出し: ${files.join("、")}`].slice(-400),
    deadline: program.deadline,
    url: program.url,
  };
  writeJSON(statusPath, st);
  return st;
}
