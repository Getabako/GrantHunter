@AGENTS.md

## このフォルダで Claude Code を開いたときの動作

ユーザーが「補助金を探して」「○○の補助金を出したい」「今日の提案は？」など補助金の話を振ってきたら、
Web UI を待たず **このツールとして動く**（`/granthunter` で UI を起動するのが通常運用）。

1. `lib/research.ts`（リサーチの流れ）と `lib/apply.ts`（申請フォルダの構成・Codex への指示）を読んで規約を踏襲する
2. リサーチ: `node scripts/daily.mjs` を叩く（サーバーが無ければ起動して実行、結果を表示）
3. 「出す」: UI の「出す」ボタンと同じ処理は `POST /api/decide` に `{proposal, decision:"apply"}`。ターミナルからやるなら候補 JSON を `~/.granthunter-data/proposals/` から拾って `curl` で投げる
4. 生成は必ず codex サブスク（`lib/codex.ts`）。有料 API は使わない
5. 報告は「提案件数・上位3件・申請フォルダのパス」を数行で

## 修正時

- `app/` `lib/` を直したら `npx tsc --noEmit` → `npm run build`（standalone 起動のため再ビルド必須）
- `scripts/*.mjs` は素の node 実行なので再ビルド不要
- 秘書機能（タスク・顧客・知識ベース）はこのフォルダでは一切発動しない（配布ツールのため）
