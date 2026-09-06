# Grant Hunter — Windows one-line installer & launcher
#
# 友達向けの 1 行コマンドは配布ページを参照:
#   https://service.if-juku.net/Ashura/arts
#
# 何度貼っても OK。初回は全部インストール、2 回目以降は最新版に更新して起動。

$ErrorActionPreference = "Stop"

# 更新時は会員のカスタマイズを残す 3方向マージで配置する（ヘルパーはサイトから取得。取得できなければ従来どおり上書きコピー）
# .ps1 ファイルの直接実行は実行ポリシーで止まる環境があるため、内容をスクリプトブロックとして実行する
function Ashura-MergeUpdate([string]$Src, [string]$Dest, [string]$Zip) {
    try {
        $code = (Invoke-WebRequest -UseBasicParsing -Uri "https://service.if-juku.net/Ashura/installers/lib/merge-update.ps1" -TimeoutSec 30).Content
        & ([scriptblock]::Create($code)) -Src $Src -Dest $Dest -Zip $Zip
        return
    } catch {
        Write-Host "更新ヘルパーを実行できなかったため、従来どおり上書きコピーします: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Copy-Item -Path (Join-Path $Src "*") -Destination $Dest -Recurse -Force
}

trap {
    Write-Host "" -ForegroundColor Red
    Write-Host "──────────────────────────────────────────" -ForegroundColor Red
    Write-Host "  途中で止まりました。上の赤い文字（エラー）をコピーして" -ForegroundColor Red
    Write-Host "  Codex か Claude Code に貼り付け『このエラーを直して』と頼んでください。" -ForegroundColor Red
    Write-Host "──────────────────────────────────────────" -ForegroundColor Red
    break
}

# --- 設定 ---
# アプリ本体はサイトの ZIP プロキシから取得する（GitHub へは直接アクセスしない）
$ZipUrl = if ($env:GRANTHUNTER_ZIP_URL) { $env:GRANTHUNTER_ZIP_URL } else { "https://service.if-juku.net/api/ashura/download/grant-hunter" }
# インストール先：デスクトップにわかりやすく置く（隠しフォルダにしない）。
# OneDrive でデスクトップがリダイレクトされている場合も考慮して GetFolderPath を使う。
$DesktopDir = [Environment]::GetFolderPath('Desktop')
$InstallDir = if ($env:GRANTHUNTER_HOME)  { $env:GRANTHUNTER_HOME }  else { Join-Path $DesktopDir "GrantHunter" }

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function OK($msg)   { Write-Host $msg -ForegroundColor Green }
function Err($msg)  { Write-Host $msg -ForegroundColor Red }

Info "▶ Grant Hunter セットアップを開始します（Windows）"

# 道具の確認（Node/Codex は「第一の儀（環境構築）」で支度済みの前提）
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$__missing = @()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $__missing += "Node.js"
} else {
    $__nodeMajor = 0; try { $__nodeMajor = [int](node -p "process.versions.node.split('.')[0]") } catch {}
    if ($__nodeMajor -lt 20) { $__missing += "Node.js(20以上に更新を)" }
}
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { $__missing += "Codex" }
if ($__missing.Count -gt 0) {
    Write-Host ("✗ 道具が足りません：" + ($__missing -join ", ")) -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "先に『第一の儀（環境構築）』を一度だけ実行してください:" -ForegroundColor Red
    Write-Host "  iwr -useb https://service.if-juku.net/Ashura/setup.ps1 | iex" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "（整え終えたら、もう一度この 1 行を貼り直してください）" -ForegroundColor Red
    exit 1
}

# 7. アプリを取得 or 更新（サイトの ZIP プロキシからダウンロード）
# 旧フォルダ ~\.granthunter からの移行（新しい場所が未作成なら引っ越し）
$OldDir = Join-Path $HOME ".granthunter"
if ((-not $env:GRANTHUNTER_HOME) -and (Test-Path $OldDir) -and (-not (Test-Path $InstallDir))) {
    Info "▶ 旧フォルダ ~\.granthunter をデスクトップへ移動します"
    Move-Item -Force $OldDir $InstallDir
}

Info "▶ 最新版をダウンロードします"
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ashura-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
$TmpZip = Join-Path $TmpDir "app.zip"
Invoke-WebRequest -UseBasicParsing -Uri $ZipUrl -OutFile $TmpZip
$ExtractDir = Join-Path $TmpDir "unzipped"
Expand-Archive -Path $TmpZip -DestinationPath $ExtractDir -Force
$SrcDir = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
if (-not $SrcDir) {
    Err "✗ ダウンロードした ZIP を展開できませんでした。時間をおいて再実行してください。"
    Remove-Item -Recurse -Force $TmpDir
    exit 1
}
$NewHash = (Get-FileHash -Path $TmpZip -Algorithm SHA256).Hash.ToLower()
$HashFile = Join-Path $InstallDir ".ashura-zip-hash"
$OldHash = if (Test-Path $HashFile) { (Get-Content $HashFile -ErrorAction SilentlyContinue | Select-Object -First 1) } else { "" }
if ((Test-Path $InstallDir) -and ($NewHash -eq $OldHash)) {
    # 配布内容が前回と同じなら上書きしない（あなたの修正を保持したまま起動）
    Info "▶ 既に最新版です。あなたの修正を保持したまま起動します"
} else {
    # 既存フォルダは削除せず、最新版を上書きコピー（生成物・データは残る）
    Info "▶ 最新版を配置します → $InstallDir"
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Ashura-MergeUpdate -Src $SrcDir.FullName -Dest $InstallDir -Zip $TmpZip
    Set-Content -Path $HashFile -Value $NewHash
}
Remove-Item -Recurse -Force $TmpDir

Set-Location $InstallDir

# 8. 配布 ZIP の内容が変わった or 成果物が無いなら再ビルド
$MarkFile = "$InstallDir\.next\.built-sha"
$LastHash = if (Test-Path $MarkFile) { (Get-Content $MarkFile -ErrorAction SilentlyContinue | Select-Object -First 1) } else { "" }

$NeedBuild = $false
if (-not (Test-Path "$InstallDir\node_modules")) { $NeedBuild = $true }
if (-not (Test-Path "$InstallDir\.next\standalone\server.js")) { $NeedBuild = $true }
if ($NewHash -ne $LastHash) { $NeedBuild = $true }
# ローカルで直したソースがビルドより新しければ、その修正を反映するため再ビルド
if (Test-Path $MarkFile) {
    $buildTime = (Get-Item $MarkFile).LastWriteTime
    $srcDirs = @("app","lib","bin","public","next.config.ts","package.json") | Where-Object { Test-Path (Join-Path $InstallDir $_) }
    $newer = Get-ChildItem -Path $srcDirs -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $buildTime } | Select-Object -First 1
    if ($newer) { $NeedBuild = $true }
}

if ($NeedBuild) {
    Info "▶ アプリを準備中（初回 or 更新時のみ）"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install
        pnpm build
    } else {
        npm install
        npm run build
    }
    New-Item -ItemType Directory -Force -Path "$InstallDir\.next" | Out-Null
    Set-Content -Path $MarkFile -Value $NewHash
}

# 9. ChatGPT ログイン状態
try { codex login status *>$null } catch {
    Info ""
    Info "▶ 初回ログイン: ChatGPT アカウントと接続します"
    Info "  ブラウザが開きます。サインインしてください。"
    Info ""
    codex login
}

# 10. 起動
OK ""
OK "✓ 起動します。終了は Ctrl+C。"
OK ""
# スラッシュコマンドを設置（/granthunter で起動できるように）
try { & ([scriptblock]::Create((iwr -useb https://service.if-juku.net/Ashura/install-command.ps1).Content)) granthunter "Grant Hunter" "$InstallDir" "node bin\cli.js" } catch {}

# ダブルクリック起動ファイルを設置（次回からはこのファイルを開くだけで起動できる）
$LauncherPath = Join-Path $InstallDir "Grant Hunterを起動.bat"
$LauncherBody = "@echo off`r`ncd /d `"%~dp0`"`r`npowershell -NoProfile -ExecutionPolicy Bypass -File ashura-start.ps1`r`npause"
Set-Content -Path $LauncherPath -Value $LauncherBody
Write-Host "✓ 次回からはインストール先フォルダの「Grant Hunterを起動.bat」をダブルクリックするだけで起動できます" -ForegroundColor Green

node "$InstallDir\bin\cli.js"
