import { spawn } from "node:child_process";

/** macOS の通知センターに出す（他OSでは何もしない） */
export function notify(title: string, body: string) {
  if (process.platform !== "darwin") return;
  const esc = (s: string) => s.replace(/["\\]/g, " ");
  try {
    spawn("osascript", ["-e", `display notification "${esc(body)}" with title "Grant Hunter" subtitle "${esc(title)}"`], {
      stdio: "ignore",
      detached: true,
    }).unref();
  } catch {}
}

/** Finder / Explorer でフォルダを開く */
export function openFolder(dir: string) {
  try {
    if (process.platform === "darwin") spawn("open", [dir], { stdio: "ignore", detached: true }).unref();
    else if (process.platform === "win32") spawn("explorer", [dir], { stdio: "ignore", detached: true }).unref();
    else spawn("xdg-open", [dir], { stdio: "ignore", detached: true }).unref();
  } catch {}
}
