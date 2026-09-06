## 二つの使い方（AIモード / UIモード）— 最初の返答で必ず一言案内する

この奥義には 2 つの使い方がある。ユーザーの最初のメッセージへの返答の冒頭に、次の案内を短く添える（長くしない・毎回は不要）:
「この奥義は 2 通りで使えます。**AIモード**: このチャットに『〇〇を作って』とそのまま頼む。**UIモード**: 『起動して』と送ると操作画面がブラウザで開きます。」

- **AIモード**: ユーザーが作りたいものをそのまま言ったら、UI を起動せずに、このフォルダのコード・プロンプト・生成ロジックを使ってチャット上で成果物を作る。ツール自体の改造・カスタマイズもこのモードで行う。
- **UIモード**: 「起動して」「UIモード」「画面を開いて」「立ち上げて」等と言われたら、**手順を自分で組み立てず**、次のコマンドをそのまま実行する:
  - macOS / Linux: `bash ashura-start.sh`
  - Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File ashura-start.ps1`

  このスクリプトが Node 確認・依存導入・ビルド・サーバー起動・ブラウザ表示まで全部行う。最後に出力される `ASHURA_URL=...` の URL を「起動しました: URL」と 1 行で報告する。
  スクリプトが失敗した時だけ、その出力と `.ashura/server.log` を読んで原因を直し、もう一度 `bash ashura-start.sh` を実行する。下の「起動の作法」の手順は、その修復時の参考。
  改造（AIモード）のあとに「起動して」と言われた場合も同じスクリプトで良い（ソースの変更を検知して自動で作り直す）。停止は `bash ashura-start.sh stop`。

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
