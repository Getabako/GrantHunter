# Grant Hunter — 開発者向けメモ

## 構成

- `bin/cli.js` — standalone ビルドを起動するランチャー（既定ポート 4611）
- `instrumentation.ts` — サーバー起動時に `lib/scheduler.ts` を開始（1分ごとに定時判定）
- `lib/jgrants.ts` — Jグランツ公開 API（一覧・詳細・添付 base64）
- `lib/codex.ts` — `codex exec` ラッパー。`mode:"read-only"`（JSON 生成）/ `mode:"full"`（フォルダ内で作業）、`search:true` で `--search`
- `lib/research.ts` — キーワード生成 → 検索 → Web 追加調査 → 採点 → `proposals/YYYY-MM-DD.json`
- `lib/apply.ts` — 申請フォルダ作成 → 添付保存・zip 展開 → Codex に書類作成させる（バックグラウンド、状態は `<folder>/.granthunter.json`）
- `lib/settings.ts` — settings / profile / decisions / scores の読み書き
- `app/page.tsx` — 1 ページ 4 タブ（提案・申請フォルダ・プロフィール・設定）
- `scripts/daily.mjs` — 外部から定時実行するためのスクリプト
- `scripts/install-launchd.sh` — macOS 常駐化
- `scripts/setup-jgrants-mcp.sh` — 公式 MCP サーバーを codex に登録（任意）

## ルール

- 生成は codex サブスクのみ。Gemini / OpenAI / Claude API を組み込まない（CodexAppServer 共通ルール）
- 絵文字は UI・文書・コミットのどこにも使わない
- 日本語の可読性: 本文 17px、行間 1.9、字間 0.04em（globals.css）
- 採点キャッシュはプロフィールのハッシュ付き。プロフィールを変えると自動で再採点される
- 「見送り」は `decisions.json` に残り以後の提案から除外。取り消したいときはそのファイルから該当 id を消す
