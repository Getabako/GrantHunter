// Codex CLI 呼び出しヘルパー（サーバー専用）
// 有料APIではなく、ローカルの codex CLI（サブスク認証済み ~/.codex）で生成する。

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type CodexOptions = {
  model?: string;
  effort?: "low" | "medium" | "high";
  /** read-only: ファイルを書かせない（JSON生成向け） / full: フォルダ内で作業させる */
  mode?: "read-only" | "full";
  cwd?: string;
  search?: boolean; // ライブWeb検索を有効化
  timeoutMs?: number;
  onLog?: (line: string) => void;
};

const DEFAULT_MODEL = process.env.GRANTHUNTER_MODEL || "gpt-5.5";

/** codex exec を1回走らせ、最終メッセージを文字列で返す */
export async function codexRun(prompt: string, opts: CodexOptions = {}): Promise<string> {
  const model = opts.model || DEFAULT_MODEL;
  const effort = opts.effort || "medium";
  const timeoutMs = opts.timeoutMs ?? 20 * 60_000;
  const tmp = mkdtempSync(path.join(tmpdir(), "granthunter-"));
  const outFile = path.join(tmp, "last-message.txt");
  const cwd = opts.cwd || tmp;

  // --search は codex 本体側のフラグ（exec のサブコマンド引数ではない）
  const args = [
    ...(opts.search ? ["--search"] : []),
    "exec",
    "-m", model,
    "-c", `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--color", "never",
    "-o", outFile,
  ];
  if (opts.mode === "full") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else {
    args.push("-s", "read-only", "--ephemeral");
  }
  args.push("-");

  const text = await new Promise<string>((resolve, reject) => {
    const proc = spawn("codex", args, { cwd, env: process.env });
    let stderr = "";
    proc.stderr.on("data", (c) => {
      const s = c.toString();
      stderr += s;
      if (opts.onLog) {
        for (const line of s.split("\n")) {
          const t = line.trim();
          if (t) opts.onLog(t);
        }
      }
    });
    proc.stdout.on("data", (c) => {
      if (opts.onLog) {
        for (const line of c.toString().split("\n")) {
          const t = line.trim();
          if (t) opts.onLog(t);
        }
      }
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`codex の応答がタイムアウトしました（${Math.round(timeoutMs / 60000)}分）。`));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          "codex CLI を起動できませんでした。`brew install codex` でインストールし、`codex login` を済ませてください。 " +
            err.message
        )
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      let out = "";
      try {
        out = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
      } catch {}
      if (code !== 0 && !out.trim()) {
        reject(new Error(`codex exec が失敗しました (exit ${code}): ${stderr.slice(-800)}`));
        return;
      }
      resolve(out);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  }).finally(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  return text;
}

/** JSON を返させる（コードフェンス混入にも耐える） */
export async function codexJSON<T = unknown>(prompt: string, opts: CodexOptions = {}): Promise<T> {
  const full =
    prompt +
    "\n\n重要: 返答は指定された JSON のみを出力すること。前置き・説明・コードフェンスは一切付けない。";
  const text = await codexRun(full, opts);
  return parseLooseJSON<T>(text);
}

export function parseLooseJSON<T = unknown>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("codex 応答のJSON解析に失敗しました: " + cleaned.slice(0, 300));
  }
}
