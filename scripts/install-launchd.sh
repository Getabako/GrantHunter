#!/usr/bin/env bash
# Grant Hunter を macOS ログイン時に常駐させ、設定した時刻に毎日リサーチさせる。
# 使い方:  bash scripts/install-launchd.sh        （登録）
#          bash scripts/install-launchd.sh remove （解除）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="net.if-juku.granthunter"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"
PORT="${PORT:-4611}"

if [[ "${1:-}" == "remove" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "解除しました: $PLIST"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.granthunter-data/logs"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$ROOT/bin/cli.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.granthunter-data/logs/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$HOME/.granthunter-data/logs/launchd.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "登録しました: $PLIST"
echo "常駐中は http://localhost:$PORT で開けます。設定タブの実行時刻に毎日リサーチが走ります。"
