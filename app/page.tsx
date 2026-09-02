"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProposalDay, Proposal, ApplicationStatus, Settings, ResearchJob } from "@/lib/types";

type Tab = "proposals" | "applications" | "profile" | "settings";

function yen(n: number | null) {
  if (n == null) return "上限不明";
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}億円`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000)}万円`;
  return `${n.toLocaleString()}円`;
}

function untilDeadline(iso: string | null) {
  if (!iso) return "締切不明";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" });
  if (days < 0) return `${date}（締切済）`;
  if (days === 0) return `${date}（本日）`;
  return `${date}（あと${days}日）`;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("proposals");
  const [day, setDay] = useState<ProposalDay | null>(null);
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [apps, setApps] = useState<ApplicationStatus[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, j, a, s, pr] = await Promise.all([
      fetch("/api/proposals").then((r) => r.json()),
      fetch("/api/research").then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]);
    setDay(p.day);
    setJob(j);
    setApps(a.applications);
    setSettings(s);
    if (!profileDirty) setProfile(pr.profile);
  }, [profileDirty]);

  useEffect(() => {
    load();
  }, [load]);

  // 実行中は 3 秒ごとに更新
  useEffect(() => {
    const running = job?.running || apps.some((a) => a.state === "preparing" || a.state === "drafting");
    if (!running) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [job?.running, apps, load]);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  async function runResearch() {
    setBusy("research");
    const r = await fetch("/api/research", { method: "POST" });
    const j = await r.json();
    if (j.error) say(j.error);
    setBusy(null);
    load();
  }

  async function decide(p: Proposal, decision: "apply" | "skip") {
    setBusy(p.id);
    const r = await fetch("/api/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposal: p, decision }),
    });
    const j = await r.json();
    if (j.error) say(j.error);
    else if (decision === "apply") {
      say("申請フォルダを作成し、Codex が書類作成を始めました");
      setTab("applications");
    }
    setBusy(null);
    load();
  }

  async function saveProfile() {
    setBusy("profile");
    await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) });
    setProfileDirty(false);
    setBusy(null);
    say("プロフィールを保存しました。次のリサーチから反映されます");
  }

  async function saveSettings(patch: Partial<Settings>) {
    const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    setSettings(await r.json());
  }

  async function openFolder(folder: string) {
    await fetch("/api/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder }) });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 flex-1">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Grant Hunter</h1>
        <p className="muted mt-1">自分の事業と生活に合う補助金を毎日探し、出すと決めたら書類一式を1フォルダに作り切る。</p>
      </header>

      <nav className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["proposals", "今日の提案"],
            ["applications", "申請フォルダ"],
            ["profile", "プロフィール"],
            ["settings", "設定"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
            {k === "applications" && apps.some((a) => a.state === "drafting" || a.state === "preparing") ? " (作成中)" : ""}
          </button>
        ))}
      </nav>

      {toast && <div className="card px-5 py-3 mb-5 border-l-4" style={{ borderLeftColor: "var(--accent)" }}>{toast}</div>}

      {tab === "proposals" && (
        <section className="space-y-5">
          <div className="card px-5 py-4 flex flex-wrap items-center gap-4 justify-between">
            <div>
              {day ? (
                <>
                  <div className="font-semibold">{day.date} の提案 {day.proposals.length}件</div>
                  <div className="muted text-sm">
                    Jグランツ取得 {day.stats.fetched}件 / 新規採点 {day.stats.newScored}件 / 次回の定時リサーチ {settings?.dailyEnabled ? settings.dailyTime : "停止中"}
                  </div>
                </>
              ) : (
                <div>まだリサーチしていません。先に「プロフィール」を書いてから実行してください。</div>
              )}
            </div>
            <button className="btn btn-primary" onClick={runResearch} disabled={busy === "research" || job?.running}>
              {job?.running ? `実行中: ${job.phase}` : "今すぐリサーチ"}
            </button>
          </div>

          {job?.running && <pre className="log">{job.log.slice(-40).join("\n")}</pre>}
          {job?.error && !job.running && <div className="card px-5 py-3 text-red-600">前回エラー: {job.error}</div>}

          {day?.proposals.map((p) => (
            <article key={p.id} className="card px-6 py-5">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="flex-1 min-w-[16rem]">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="badge">適合 {p.score}点</span>
                    <span className="badge">{p.category}</span>
                    <span className="badge">難易度 {p.hurdle}</span>
                    <span className="badge">{p.source === "jgrants" ? "Jグランツ" : "Web調査"}</span>
                  </div>
                  <h2 className="text-xl font-bold">
                    <a href={p.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4">
                      {p.title}
                    </a>
                  </h2>
                  <div className="muted mt-1">
                    {yen(p.maxLimit)} / {untilDeadline(p.deadline)} / {p.area ?? "地域不明"}
                    {p.institution ? ` / ${p.institution}` : ""}
                  </div>
                  <p className="mt-3">{p.reason}</p>
                  <p className="mt-1"><span className="font-semibold">使い道:</span> {p.suggestedUse}</p>
                </div>
                <div className="flex flex-col gap-2 min-w-[9rem]">
                  <button className="btn btn-primary" disabled={busy === p.id} onClick={() => decide(p, "apply")}>
                    出す（書類を作る）
                  </button>
                  <button className="btn btn-ghost" disabled={busy === p.id} onClick={() => decide(p, "skip")}>
                    見送り
                  </button>
                </div>
              </div>
            </article>
          ))}
          {day && day.proposals.length === 0 && !job?.running && (
            <div className="card px-6 py-8 text-center muted">条件に合う新しい提案はありません。プロフィールを詳しくするか、設定の最低スコアを下げてみてください。</div>
          )}
        </section>
      )}

      {tab === "applications" && (
        <section className="space-y-4">
          <div className="card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              申請フォルダは <span className="font-semibold">{settings ? "デスクトップ/補助金申請" : ""}</span> に案件ごとに作られます。
            </div>
            {apps[0] && (
              <button className="btn" onClick={() => openFolder(apps[0].folder.replace(/\/[^/]+$/, ""))}>
                親フォルダを開く
              </button>
            )}
          </div>
          {apps.length === 0 && <div className="card px-6 py-8 text-center muted">まだ申請フォルダはありません。「今日の提案」で「出す」を押すとここに並びます。</div>}
          {apps.map((a) => (
            <article key={a.folder} className="card px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[16rem]">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="badge">
                      {a.state === "done" ? "書類作成済" : a.state === "error" ? "エラー" : a.state === "drafting" ? "Codex 作成中" : "資料取得中"}
                    </span>
                    <span className="badge">{untilDeadline(a.deadline)}</span>
                  </div>
                  <h2 className="text-xl font-bold">{a.title}</h2>
                  <div className="muted mt-1 text-sm break-all">{a.folder}</div>
                  <p className="mt-2">{a.message}</p>
                </div>
                <div className="flex flex-col gap-2 min-w-[9rem]">
                  <button className="btn btn-primary" onClick={() => openFolder(a.folder)}>フォルダを開く</button>
                  <a className="btn text-center" href={a.url} target="_blank" rel="noreferrer">公式ページ</a>
                  <button className="btn btn-ghost" onClick={() => setOpenLog(openLog === a.folder ? null : a.folder)}>
                    {openLog === a.folder ? "ログを閉じる" : "ログを見る"}
                  </button>
                </div>
              </div>
              {openLog === a.folder && <pre className="log mt-4">{a.log.slice(-80).join("\n")}</pre>}
            </article>
          ))}
        </section>
      )}

      {tab === "profile" && (
        <section className="space-y-4">
          <div className="card px-5 py-4">
            「合う・合わない」はこの文章だけで判断します。事業のことも生活のことも、具体的に書くほど提案が良くなります。内容はこの PC の中だけで使われます（Codex サブスクへの送信のみ）。
          </div>
          <textarea
            value={profile}
            onChange={(e) => {
              setProfile(e.target.value);
              setProfileDirty(true);
            }}
            rows={28}
          />
          <div className="flex gap-3">
            <button className="btn btn-primary" onClick={saveProfile} disabled={!profileDirty || busy === "profile"}>
              保存する
            </button>
            {profileDirty && <span className="muted self-center">未保存の変更があります</span>}
          </div>
        </section>
      )}

      {tab === "settings" && settings && (
        <section className="space-y-4">
          <div className="card px-6 py-5 space-y-5">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-5 h-5" style={{ width: "1.3rem" }} checked={settings.dailyEnabled} onChange={(e) => saveSettings({ dailyEnabled: e.target.checked })} />
              <span>毎日自動でリサーチする（このアプリが起動している間。常駐させるには README の launchd 手順）</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-5">
              <label>
                <div className="font-semibold mb-1">実行時刻</div>
                <input type="time" value={settings.dailyTime} onChange={(e) => saveSettings({ dailyTime: e.target.value })} />
              </label>
              <label>
                <div className="font-semibold mb-1">対象の都道府県（読点区切り）</div>
                <input
                  value={settings.prefectures.join("、")}
                  onChange={(e) => saveSettings({ prefectures: e.target.value.split(/[、,]/).map((s) => s.trim()).filter(Boolean) })}
                />
              </label>
              <label>
                <div className="font-semibold mb-1">提案に載せる最低スコア（{settings.minScore}）</div>
                <input type="range" min={30} max={90} value={settings.minScore} onChange={(e) => saveSettings({ minScore: Number(e.target.value) })} />
              </label>
              <label>
                <div className="font-semibold mb-1">1日の提案件数の上限</div>
                <input type="number" min={3} max={30} value={settings.maxProposals} onChange={(e) => saveSettings({ maxProposals: Number(e.target.value) })} />
              </label>
              <label>
                <div className="font-semibold mb-1">Codex モデル</div>
                <input value={settings.model} onChange={(e) => saveSettings({ model: e.target.value })} />
              </label>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" style={{ width: "1.3rem" }} checked={settings.webResearch} onChange={(e) => saveSettings({ webResearch: e.target.checked })} />
              <span>Jグランツに加えて Web でも探す（自治体・財団系。時間が数分伸びます）</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" style={{ width: "1.3rem" }} checked={settings.notifyMac} onChange={(e) => saveSettings({ notifyMac: e.target.checked })} />
              <span>macOS の通知を出す</span>
            </label>
            <div>
              <div className="font-semibold mb-1">検索キーワード（プロフィールから自動生成。空にすると次回作り直し）</div>
              <textarea
                rows={3}
                value={settings.keywords.join("、")}
                onChange={(e) => saveSettings({ keywords: e.target.value.split(/[、,]/).map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="muted text-sm">最終リサーチ: {settings.lastRunAt ? new Date(settings.lastRunAt).toLocaleString("ja-JP") : "未実行"}</div>
          </div>
        </section>
      )}
    </main>
  );
}
