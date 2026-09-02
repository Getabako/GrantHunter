#!/usr/bin/env bash
# 任意: デジタル庁公式の Jグランツ MCP サーバー（https://github.com/digital-go-jp/jgrants-mcp-server）を
# codex に登録する。本ツール自体は公開 API を直接叩くので必須ではないが、
# 登録しておくと書類作成フェーズで codex が PDF/Word/Excel → Markdown 変換や追加検索に使える。
# 前提: Python 3.11+ と uv（brew install uv）
set -e
DIR="$HOME/.granthunter-data/jgrants-mcp-server"
PORT="${JGRANTS_MCP_PORT:-8000}"

if [[ ! -d "$DIR" ]]; then
  git clone https://github.com/digital-go-jp/jgrants-mcp-server.git "$DIR"
fi
cd "$DIR"
git pull --ff-only || true
uv venv >/dev/null 2>&1 || python3 -m venv .venv
uv pip install -r requirements.txt 2>/dev/null || (. .venv/bin/activate && pip install -r requirements.txt)

# codex の MCP 設定に追記（既にあればスキップ）
CFG="$HOME/.codex/config.toml"
if ! grep -q "mcp_servers.jgrants" "$CFG" 2>/dev/null; then
  cat >> "$CFG" <<EOF

[mcp_servers.jgrants]
url = "http://127.0.0.1:$PORT/mcp"
EOF
  echo "codex の config.toml に mcp_servers.jgrants を追加しました"
fi

echo ""
echo "MCP サーバーを起動するには（別ターミナルで常駐）:"
echo "  cd $DIR && uv run python -m jgrants_mcp_server.core --port $PORT"
