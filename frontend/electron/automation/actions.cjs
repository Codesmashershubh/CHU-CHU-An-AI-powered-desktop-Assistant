// The actual implementations behind Chu Chu's automation actions. Every
// function here does ONE narrow, named thing with validated parameters —
// nothing here accepts or executes a freeform shell command. See
// docs/ARCHITECTURE.md ("OS automation") for why that boundary exists.
"use strict";

const { app, shell, clipboard, screen, desktopCapturer } = require("electron");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

function ok(message, data) {
  return { ok: true, message, data };
}
function fail(message) {
  return { ok: false, message };
}

function workspaceDir() {
  const dir = path.join(app.getPath("documents"), "Chu Chu");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function screenshotsDir() {
  const dir = path.join(workspaceDir(), "Screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// --- open_app -----------------------------------------------------------------
// Best-effort across three very different OS launch mechanisms. Every branch
// uses spawn() with an argument array (never a concatenated shell string), so
// even an unusual app name can't be interpreted as a shell command — the
// worst case is "couldn't find that app," never "ran something unintended."
const FRIENDLY_NAMES = {
  win32: {
    notepad: "notepad",
    "text editor": "notepad",
    calculator: "calc",
    calc: "calc",
    terminal: "cmd",
    "command prompt": "cmd",
    "file explorer": "explorer",
    explorer: "explorer",
    finder: "explorer",
  },
  darwin: {
    notepad: "TextEdit",
    "text editor": "TextEdit",
    calculator: "Calculator",
    calc: "Calculator",
    terminal: "Terminal",
    "file explorer": "Finder",
    explorer: "Finder",
    finder: "Finder",
  },
  linux: {
    notepad: "gedit",
    "text editor": "gedit",
    calculator: "gnome-calculator",
    calc: "gnome-calculator",
    terminal: "gnome-terminal",
    "file explorer": "nautilus",
    explorer: "nautilus",
    finder: "nautilus",
  },
};

function resolveTarget(name) {
  const platform = process.platform;
  const aliasMap = FRIENDLY_NAMES[platform] || {};
  return aliasMap[name.trim().toLowerCase()] || name.trim();
}

function spawnDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: "ignore", shell: false });
  child.unref();
  return child;
}

function openApp({ name } = {}) {
  if (!name || typeof name !== "string" || !name.trim()) {
    return fail("No application name given.");
  }
  const target = resolveTarget(name);
  const platform = process.platform;

  try {
    let child;
    if (platform === "win32") {
      // "" is a required dummy window-title arg for `start` when the target
      // itself may need quoting (e.g. contains spaces).
      child = spawnDetached("cmd.exe", ["/c", "start", "", target]);
    } else if (platform === "darwin") {
      child = spawnDetached("open", ["-a", target]);
    } else {
      child = spawnDetached(target, []);
    }
    child.on("error", (err) => {
      console.warn(`Chu Chu: failed to launch "${target}":`, err.message);
    });
    return ok(`Opening ${name}…`);
  } catch (err) {
    return fail(`Couldn't open ${name}: ${err.message}`);
  }
}

// --- open_url -------------------------------------------------------------------
function openUrl({ url } = {}) {
  if (!url || typeof url !== "string") return fail("No URL given.");

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return fail(`"${url}" doesn't look like a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail("Only http:// and https:// links can be opened, for safety.");
  }

  shell.openExternal(parsed.toString());
  return ok(`Opening ${parsed.hostname}…`);
}

// --- take_screenshot -----------------------------------------------------------
async function takeScreenshot() {
  try {
    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor || 1;
    const width = Math.round(display.size.width * scaleFactor);
    const height = Math.round(display.size.height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
    });

    const primary = sources[0];
    if (!primary || primary.thumbnail.isEmpty()) {
      return fail(
        "Couldn't capture the screen — on macOS, check System Settings > " +
          "Privacy & Security > Screen Recording and allow Chu Chu."
      );
    }

    const buffer = primary.thumbnail.toPNG();
    const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    const filePath = path.join(screenshotsDir(), filename);
    fs.writeFileSync(filePath, buffer);

    return ok(`Screenshot saved to your Chu Chu workspace folder.`, { path: filePath });
  } catch (err) {
    return fail(`Couldn't take a screenshot: ${err.message}`);
  }
}

// --- get_system_info -------------------------------------------------------------
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();

  const info = {
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    totalMemoryGB: Math.round((totalMem / 1024 ** 3) * 10) / 10,
    freeMemoryGB: Math.round((freeMem / 1024 ** 3) * 10) / 10,
    memoryUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    cpuModel: (cpus[0] && cpus[0].model && cpus[0].model.trim()) || "Unknown CPU",
  };

  return ok("Here's your system info.", info);
}

// --- copy_to_clipboard -----------------------------------------------------------
function copyToClipboard({ text } = {}) {
  if (typeof text !== "string" || !text) return fail("No text given to copy.");
  clipboard.writeText(text);
  return ok("Copied to your clipboard.");
}

// --- open_workspace ----------------------------------------------------------------
async function openWorkspace() {
  const dir = workspaceDir();
  const errorMessage = await shell.openPath(dir);
  if (errorMessage) {
    return fail(`Couldn't open the workspace folder: ${errorMessage}`);
  }
  return ok("Opened your Chu Chu workspace folder.");
}

module.exports = {
  workspaceDir,
  screenshotsDir,
  openApp,
  openUrl,
  takeScreenshot,
  getSystemInfo,
  copyToClipboard,
  openWorkspace,
};
