#!/usr/bin/env bash
# Grant Hunter — one-line installer & launcher
#
# 友達向けの 1 行コマンドは配布ページを参照:
#   https://service.if-juku.net/Ashura/arts
#
# 何度貼っても OK。初回は全部インストール、2 回目以降は既存のものを使って起動するだけ。

set -e

# 更新時は会員のカスタマイズを残す 3方向マージで配置する（ヘルパーはサイトから取得。取得できなければ従来どおり上書きコピー）
ashura_merge_update() {
  local helper; helper="$(mktemp)"
  if curl -fsSL --max-time 30 "https://service.if-juku.net/Ashura/installers/lib/merge-update.sh" -o "$helper" 2>/dev/null; then
    if bash "$helper" "$1" "$2" "$3"; then rm -f "$helper"; return 0; fi
    echo "更新ヘルパーが失敗したため、従来どおり上書きコピーします" >&2
  fi
  rm -f "$helper"; mkdir -p "$2"; cp -R "$1/." "$2/"
}

# --- 設定 ----------------------------------------------------------------
# アプリ本体はサイトの ZIP プロキシから取得する（GitHub へは直接アクセスしない）
ZIP_URL="${GRANTHUNTER_ZIP_URL:-https://service.if-juku.net/api/ashura/download/grant-hunter}"
# インストール先：デスクトップにわかりやすく置く。中身を開いて AI（codex / Claude）に
# 直してもらえるよう、隠しフォルダではなくデスクトップの "GrantHunter" フォルダにする。
INSTALL_DIR="${GRANTHUNTER_HOME:-$HOME/Desktop/GrantHunter}"
# -----------------------------------------------------------------------

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }

__ash_on_error() {
  red ""
  red "──────────────────────────────────────────"
  red "  途中で止まりました。上の赤い文字（エラー）をそのままコピーして、"
  red "  Codex か Claude Code に貼り付け『このエラーを直して』と頼んでください。"
  red "  環境差で起きることがほとんどで、AI に貼れば直せます。"
  red "──────────────────────────────────────────"
}
trap __ash_on_error ERR

cyan "▶ Grant Hunter セットアップを開始します"

# 1. OS チェック
if [[ "$(uname)" != "Darwin" ]]; then
  red "✗ install.sh は macOS 向けです。"
  red ""
  red "Windows の方は PowerShell を開いて、配布ページの Windows 用 1 行コマンドを実行してください:"
  red "  https://service.if-juku.net/Ashura/arts"
  exit 1
fi

# 道具の確認（Homebrew/Node/Codex は「第一の儀（環境構築）」で支度済みの前提）
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -x /usr/local/bin/brew ]] && eval "$(/usr/local/bin/brew shellenv)"
__missing=""
if command -v node >/dev/null 2>&1; then
  [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 20 ] && __missing="$__missing Node.js(20以上に更新を)"
else
  __missing="$__missing Node.js"
fi
command -v codex >/dev/null 2>&1 || __missing="$__missing Codex"
if [[ -n "$__missing" ]]; then
  red "✗ 道具が足りません：$__missing"
  red ""
  red "先に『第一の儀（環境構築）』を一度だけ実行してください:"
  red "  /bin/bash -c \"\$(curl -fsSL https://service.if-juku.net/Ashura/setup.sh)\""
  red ""
  red "（整え終えたら、もう一度この 1 行を貼り直してください）"
  exit 1
fi

# 5b. Python 3（yfinance / matplotlib のため）
if ! command -v python3 >/dev/null 2>&1; then
  cyan "▶ Python 3 をインストールします"
  brew install python
fi
# 必要な Python パッケージを軽くチェック（Codex 側で pip install してくれるが、先に入れておくと初回が早い）
python3 -c "import yfinance, matplotlib, feedparser" 2>/dev/null || {
  cyan "▶ yfinance / matplotlib / feedparser を pip でインストール"
  python3 -m pip install --user --quiet yfinance matplotlib feedparser 2>/dev/null || true
}

# 6. アプリを取得 or 更新（サイトの ZIP プロキシからダウンロード）
# 旧フォルダ ~/.granthunter からの移行（新しい場所が未作成なら引っ越し）
OLD_DIR="$HOME/.granthunter"
if [[ -z "${GRANTHUNTER_HOME:-}" && -d "$OLD_DIR" && ! -d "$INSTALL_DIR" ]]; then
  cyan "▶ 旧フォルダ ~/.granthunter をデスクトップへ移動します"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  mv "$OLD_DIR" "$INSTALL_DIR"
fi

cyan "▶ 最新版をダウンロードします"
TMP_DIR="$(mktemp -d)"
TMPZIP="$TMP_DIR/app.zip"
curl -fsSL -o "$TMPZIP" "$ZIP_URL"
unzip -q "$TMPZIP" -d "$TMP_DIR/unzipped"
SRC_DIR="$(find "$TMP_DIR/unzipped" -mindepth 1 -maxdepth 1 -type d -name '*-main' | head -n 1)"
[[ -z "$SRC_DIR" ]] && SRC_DIR="$(find "$TMP_DIR/unzipped" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "$SRC_DIR" ]]; then
  red "✗ ダウンロードした ZIP を展開できませんでした。時間をおいて再実行してください。"
  rm -rf "$TMP_DIR"
  exit 1
fi
NEW_HASH="$(shasum -a 256 "$TMPZIP" | awk '{print $1}')"
HASH_FILE="$INSTALL_DIR/.ashura-zip-hash"
OLD_HASH=""
[[ -f "$HASH_FILE" ]] && OLD_HASH="$(cat "$HASH_FILE" 2>/dev/null || echo)"
if [[ -d "$INSTALL_DIR" && "$NEW_HASH" == "$OLD_HASH" ]]; then
  # 配布内容が前回と同じなら上書きしない（あなたの修正を保持したまま起動）
  cyan "▶ 既に最新版です。あなたの修正を保持したまま起動します"
else
  # 既存フォルダは削除せず、最新版を上書きコピー（生成物・データは残る）
  cyan "▶ 最新版を配置します → $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  ashura_merge_update "$SRC_DIR" "$INSTALL_DIR" "$TMPZIP"
  echo "$NEW_HASH" > "$HASH_FILE"
fi
rm -rf "$TMP_DIR"

cd "$INSTALL_DIR"

# 7. 依存と本番ビルド（配布 ZIP の内容が変わった or 成果物が無いなら再ビルド）
MARK_FILE="$INSTALL_DIR/.next/.built-sha"
LAST_HASH=""
[[ -f "$MARK_FILE" ]] && LAST_HASH="$(cat "$MARK_FILE" 2>/dev/null || echo)"

NEED_BUILD=0
[[ ! -d node_modules ]] && NEED_BUILD=1
[[ ! -f .next/standalone/server.js ]] && NEED_BUILD=1
[[ "$NEW_HASH" != "$LAST_HASH" ]] && NEED_BUILD=1
# ローカルで直したソースがビルドより新しければ、その修正を反映するため再ビルド
if [[ -f "$MARK_FILE" ]] && [[ -n "$(find app lib bin public next.config.ts package.json -newer "$MARK_FILE" 2>/dev/null || true)" ]]; then
  NEED_BUILD=1
fi

if [[ "$NEED_BUILD" -eq 1 ]]; then
  cyan "▶ アプリを準備中（初回 or 更新があった時のみ・30 秒〜1 分）"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
    pnpm build
  else
    npm install
    npm run build
  fi
  mkdir -p "$INSTALL_DIR/.next"
  echo "$NEW_HASH" > "$MARK_FILE"
fi

# 8. ChatGPT へのログイン状態を確認（必要なら本人にやってもらう）
if ! codex login status >/dev/null 2>&1; then
  cyan ""
  cyan "▶ 初回ログイン: ChatGPT アカウントと接続します"
  cyan "  ブラウザが開きます。ChatGPT (Plus/Pro/Business) でサインインしてください。"
  cyan ""
  codex login || {
    red "ログインがキャンセルされました。次回もう一度この 1 行を実行してください。"
    exit 1
  }
fi

# 9. 起動
green ""
green "✓ 起動します。ブラウザが自動で開きます。終了は Ctrl+C。"
green ""
# スラッシュコマンドを設置（/granthunter で起動できるように）
curl -fsSL https://service.if-juku.net/Ashura/install-command.sh | bash -s -- granthunter "Grant Hunter" "$INSTALL_DIR" "node bin/cli.js" 2>/dev/null || true
trap - ERR

# ダブルクリック起動ファイルを設置（次回からはこのファイルを開くだけで起動できる）
LAUNCHER="$INSTALL_DIR/Grant Hunterを起動.command"
cat > "$LAUNCHER" <<'ASHEOS'
#!/bin/bash
# ダブルクリックで Grant Hunter を起動します（終了はこのウインドウで Ctrl+C）
cd "$(dirname "$0")"
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -x /usr/local/bin/brew ]] && eval "$(/usr/local/bin/brew shellenv)"
exec bash ashura-start.sh
ASHEOS
chmod +x "$LAUNCHER"
green "✓ 次回からはインストール先フォルダの「Grant Hunterを起動.command」をダブルクリックするだけで起動できます" 2>/dev/null || echo "✓ 次回からは「Grant Hunterを起動.command」をダブルクリックするだけで起動できます"

exec node bin/cli.js
