"use client";

// 「プログラム応募」タブ: 質問に答えて応募書類を作る（ASHIOTO 2026 など）。
// 旧 AshiotoDoc の UI を GrantHunter の見た目に合わせて移植したもの。

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answers, EntryDoc, EntrySummary, ProgramInfo, Question } from "@/lib/programs/types";

type JobView = { jobId: string; state: "running" | "done" | "error"; text: string; log: string[] };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 最小マークダウン（見出し・太字・箇条書き・表の区切りのみ）
function mdLite(s: string) {
  return esc(s)
    .replace(/^### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^## (.*)$/gm, "<h3>$1</h3>")
    .replace(/^# (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\|[-:| ]+\|$/gm, "")
    .replace(/^\|(.*)\|$/gm, (_m, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join("　｜　"))
    .replace(/^[-・*] (.*)$/gm, "・$1")
    .replace(/\n{3,}/g, "\n\n");
}

function fmtDeadline(iso: string | null) {
  if (!iso) return "締切: 未定";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return `締切: ${iso}`;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const s = d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `締切: ${s}${days < 0 ? "（締切済・次回募集の準備に使えます）" : days === 0 ? "（本日）" : `（あと${days}日）`}`;
}

function visible(q: Question, a: Answers) {
  return !q.showIf || a[q.showIf.id] === q.showIf.equals;
}

function filled(q: Question, a: Answers) {
  const v = a[q.id];
  if (Array.isArray(v)) return v.length > 0;
  return !!(v ?? "").toString().trim();
}

export function ProgramsTab({ say, onExported }: { say: (m: string) => void; onExported: () => void }) {
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [programId, setProgramId] = useState("ashioto2026");
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [entry, setEntry] = useState<EntryDoc | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [assist, setAssist] = useState<Record<string, JobView>>({});
  const [review, setReview] = useState<JobView | null>(null);
  const [judge, setJudge] = useState<JobView | null>(null);
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const program = programs.find((p) => p.id === programId) ?? null;

  const loadEntries = useCallback(async (pid: string) => {
    const r = await fetch(`/api/entries?programId=${encodeURIComponent(pid)}`).then((x) => x.json());
    setEntries(r.entries ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((r) => {
        setPrograms(r.programs ?? []);
        if (r.programs?.[0] && !r.programs.some((p: ProgramInfo) => p.id === programId)) setProgramId(r.programs[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch(`/api/entries?programId=${encodeURIComponent(programId)}`)
      .then((x) => x.json())
      .then((r) => setEntries(r.entries ?? []));
  }, [programId]);

  async function openEntry(id: string) {
    const r = await fetch(`/api/entries/${id}`).then((x) => x.json());
    if (r.error) return say(r.error);
    setEntry(r.entry);
    setAnswers(r.entry.answers ?? {});
    setAssist({});
    setReview(null);
    setJudge(null);
    setSaveState("saved");
  }

  async function newEntry() {
    const r = await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programId }) }).then((x) => x.json());
    if (r.error) return say(r.error);
    await loadEntries(programId);
    openEntry(r.entry.id);
  }

  async function deleteEntry(id: string, title: string) {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (entry?.id === id) setEntry(null);
    loadEntries(programId);
  }

  // 変更は 800ms 後にまとめて保存
  const scheduleSave = useCallback(
    (next: Answers) => {
      if (!entry) return;
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState("saving");
        await fetch(`/api/entries/${entry.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: next }) });
        setSaveState("saved");
        loadEntries(programId);
      }, 800);
    },
    [entry, programId, loadEntries]
  );

  function setAnswer(id: string, v: string | string[]) {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    scheduleSave(next);
  }

  async function flushSave() {
    if (!entry) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    await fetch(`/api/entries/${entry.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) });
    setSaveState("saved");
  }

  // ジョブのポーリング（3秒）
  useEffect(() => {
    const running: { key: string; jobId: string }[] = [];
    for (const [qid, j] of Object.entries(assist)) if (j.state === "running") running.push({ key: `a:${qid}`, jobId: j.jobId });
    if (review?.state === "running") running.push({ key: "review", jobId: review.jobId });
    if (judge?.state === "running") running.push({ key: "judge", jobId: judge.jobId });
    if (running.length === 0) return;
    const t = setInterval(async () => {
      for (const r of running) {
        const j = (await fetch(`/api/entries/jobs/${r.jobId}`).then((x) => x.json())) as JobView & { state: JobView["state"] };
        const view: JobView = { jobId: r.jobId, state: j.state, text: j.text ?? "", log: j.log ?? [] };
        if (r.key === "review") setReview(view);
        else if (r.key === "judge") setJudge(view);
        else setAssist((prev) => ({ ...prev, [r.key.slice(2)]: view }));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [assist, review, judge]);

  async function runAssist(q: Question) {
    if (!entry) return;
    await flushSave();
    const draft = String(answers[q.id] ?? "");
    const r = await fetch("/api/entries/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId: entry.id, questionId: q.id, draft }) }).then((x) => x.json());
    if (r.error) return say(r.error);
    setAssist((prev) => ({ ...prev, [q.id]: { jobId: r.jobId, state: "running", text: "", log: [] } }));
  }

  async function runWhole(kind: "review" | "judge") {
    if (!entry) return;
    await flushSave();
    const r = await fetch(`/api/entries/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId: entry.id }) }).then((x) => x.json());
    if (r.error) return say(r.error);
    const view: JobView = { jobId: r.jobId, state: "running", text: "", log: [] };
    if (kind === "review") setReview(view);
    else setJudge(view);
  }

  async function exportEntry() {
    if (!entry) return;
    await flushSave();
    setExporting(true);
    const r = await fetch(`/api/entries/${entry.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ review: review?.state === "done" ? review.text : undefined, judge: judge?.state === "done" ? judge.text : undefined }),
    }).then((x) => x.json());
    setExporting(false);
    if (r.error) return say(r.error);
    say(`申請フォルダに書き出しました: ${r.application.folder}`);
    onExported();
  }

  if (!program) return <div className="card px-6 py-8 text-center muted">プログラム定義を読み込み中…</div>;

  const visibleQs = program.questions.filter((q) => visible(q, answers));
  const requiredQs = visibleQs.filter((q) => q.required);
  const doneCount = requiredQs.filter((q) => filled(q, answers)).length;
  const pct = requiredQs.length ? Math.round((doneCount / requiredQs.length) * 100) : 0;
  const sectionIds = Object.keys(program.sections);

  return (
    <section className="space-y-5">
      <div className="card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[16rem]">
            {programs.length > 1 && (
              <select value={programId} onChange={(e) => { setProgramId(e.target.value); setEntry(null); }} className="mb-3" style={{ width: "auto" }}>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <h2 className="text-2xl font-bold">{program.name}</h2>
            <p className="mt-1">{program.subtitle}</p>
            <div className="muted mt-2 text-sm">{fmtDeadline(program.deadline)}</div>
          </div>
          <a className="btn" href={program.url} target="_blank" rel="noreferrer">公式情報</a>
        </div>
      </div>

      <div className="card px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold">応募書類</h3>
          <button className="btn btn-primary" onClick={newEntry}>新しく作る</button>
        </div>
        {entries.length === 0 ? (
          <div className="muted">まだ書類はありません。「新しく作る」から始めてください。</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <button className="text-left flex-1 min-w-[12rem]" onClick={() => openEntry(e.id)}>
                  <span className={`font-semibold ${entry?.id === e.id ? "underline underline-offset-4" : ""}`}>{e.title}</span>
                  <span className="muted text-sm ml-3">更新 {new Date(e.updatedAt).toLocaleString("ja-JP")}</span>
                </button>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => openEntry(e.id)}>開く</button>
                  <button className="btn btn-ghost" onClick={() => deleteEntry(e.id, e.title)}>削除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entry && (
        <>
          <div className="card px-6 py-4 sticky top-2 z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[14rem]">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">必須項目 {doneCount} / {requiredQs.length}</span>
                  <span className="muted">{saveState === "saved" ? "保存済み" : saveState === "saving" ? "保存中…" : "未保存の変更あり"}</span>
                </div>
                <div className="mt-1 h-2 rounded-full" style={{ background: "var(--accent-soft)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => runWhole("review")} disabled={review?.state === "running"}>
                  {review?.state === "running" ? "レビュー中…" : "採択レビュー"}
                </button>
                <button className="btn" onClick={() => runWhole("judge")} disabled={judge?.state === "running"}>
                  {judge?.state === "running" ? "採点中…" : "審査員採点"}
                </button>
                <button className="btn btn-primary" onClick={exportEntry} disabled={exporting}>
                  {exporting ? "書き出し中…" : "申請フォルダに書き出す"}
                </button>
              </div>
            </div>
          </div>

          {sectionIds.map((sid) => {
            const qs = program.questions.filter((q) => q.section === sid && visible(q, answers));
            if (qs.length === 0) return null;
            return (
              <div key={sid} className="card px-6 py-5 space-y-6">
                <h3 className="text-xl font-bold">{program.sections[sid]}</h3>
                {qs.map((q) => (
                  <QuestionField
                    key={q.id}
                    q={q}
                    value={answers[q.id]}
                    onChange={(v) => setAnswer(q.id, v)}
                    job={assist[q.id]}
                    onAssist={() => runAssist(q)}
                    onAdopt={() => {
                      const j = assist[q.id];
                      if (j?.state === "done") setAnswer(q.id, j.text);
                    }}
                  />
                ))}
              </div>
            );
          })}

          {(review || judge) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {review && <ResultCard title="採択レビュー" job={review} />}
              {judge && <ResultCard title="審査員採点（100点満点）" job={judge} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function QuestionField({
  q,
  value,
  onChange,
  job,
  onAssist,
  onAdopt,
}: {
  q: Question;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  job?: JobView;
  onAssist: () => void;
  onAdopt: () => void;
}) {
  const str = Array.isArray(value) ? "" : String(value ?? "");
  const arr = Array.isArray(value) ? value : [];
  const len = str.length;
  const short = q.minChars ? len < q.minChars : false;

  return (
    <div>
      <div className="font-semibold">
        {q.label}
        {q.required && <span className="muted font-normal text-sm"> （必須）</span>}
      </div>
      {q.help && <div className="muted text-sm mb-1">{q.help}</div>}

      {q.type === "text" && <input value={str} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />}
      {q.type === "textarea" && <textarea rows={q.assist ? 8 : 4} value={str} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />}
      {q.type === "dropdown" && (
        <select value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">選択してください</option>
          {q.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
      {q.type === "radio" && (
        <div className="flex flex-col gap-1 mt-1">
          {q.options?.map((o) => (
            <label key={o} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name={q.id} style={{ width: "1.2rem" }} checked={str === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}
      {q.type === "checkbox" && (
        <div className="flex flex-col gap-1 mt-1">
          {q.options?.map((o) => (
            <label key={o} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                style={{ width: "1.2rem" }}
                checked={arr.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {(q.minChars || q.assist) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <span className={`text-sm ${short ? "text-red-600" : "muted"}`}>
            {q.minChars ? `${len} 文字 / 最低 ${q.minChars} 文字` : q.type === "textarea" ? `${len} 文字` : ""}
          </span>
          {q.assist && (
            <button className="btn" onClick={onAssist} disabled={job?.state === "running"}>
              {job?.state === "running" ? "AI が作成中…" : "AIで補完・ブラッシュアップ"}
            </button>
          )}
        </div>
      )}

      {job && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: "var(--accent-soft)" }}>
          {job.state === "running" && (
            <div>
              <div className="font-semibold">AI が回答案を書いています…（1〜3分）</div>
              {job.log.length > 0 && <pre className="log mt-2" style={{ background: "var(--card)", maxHeight: "8rem" }}>{job.log.slice(-6).join("\n")}</pre>}
            </div>
          )}
          {job.state === "error" && <div className="text-red-600">エラー: {job.text}</div>}
          {job.state === "done" && (
            <div>
              <div className="font-semibold mb-1">AI の回答案（{job.text.length} 文字）</div>
              <div className="whitespace-pre-wrap">{job.text}</div>
              <div className="mt-3">
                <button className="btn btn-primary" onClick={onAdopt}>この内容を採用</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, job }: { title: string; job: JobView }) {
  return (
    <div className="card px-6 py-5">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      {job.state === "running" && (
        <div>
          <div className="muted">AI が読んでいます…（1〜3分）</div>
          {job.log.length > 0 && <pre className="log mt-2" style={{ maxHeight: "8rem" }}>{job.log.slice(-6).join("\n")}</pre>}
        </div>
      )}
      {job.state === "error" && <div className="text-red-600">エラー: {job.text}</div>}
      {job.state === "done" && <div className="md-lite whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: mdLite(job.text) }} />}
    </div>
  );
}
