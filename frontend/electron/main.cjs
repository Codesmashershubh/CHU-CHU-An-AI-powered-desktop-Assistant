// Electron main process. Deliberately plain CommonJS, not TypeScript — the
// main process runs directly in Node with no bundling step, so there's
// nothing to compile and nothing that can go stale between a TS source file
// and a build artifact. The renderer (src/) is TypeScript + React, built by
// Vite; this file just hosts it in a window.
"use strict";

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require("electron");
const path = require("node:path");

const isDev = process.env.NODE_ENV === "development";
const DEV_SERVER_URL = "http://localhost:5173";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

// --- Single instance lock ---------------------------------------------------
// An "always-accessible OS assistant" that opens a second window every time
// you trigger its shortcut isn't very assistant-like. Second launches just
// focus the existing window instead.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      showWindow();
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
    backgroundColor: "#0d1013",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.on("close", (event) => {
    // Hide-to-tray only in production. In dev, this exact behavior is what
    // makes Ctrl+C in the terminal look like it "does nothing" — Electron
    // lingers invisibly, and the single-instance lock then blocks the next
    // `npm run electron:dev` from opening a new window at all. Closing the
    // window in dev just quits normally, like any other dev server would.
    if (!isDev && !app.isQuittingChuChu) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 20, height: 20 });
  }
  tray = new Tray(trayIcon);
  tray.setToolTip("Chu Chu");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Chu Chu", click: showWindow },
      { type: "separator" },
      {
        label: "Quit Chu Chu",
        click: () => {
          app.isQuittingChuChu = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", toggleWindow);
}

function registerShortcut() {
  // Cmd/Ctrl+Shift+Space — deliberately not a bare Space/Cmd combo that's
  // likely to collide with Spotlight, window managers, etc.
  const accelerator = "CommandOrControl+Shift+Space";
  const ok = globalShortcut.register(accelerator, toggleWindow);
  if (!ok) {
    console.warn(`Chu Chu: couldn't register global shortcut ${accelerator} (already taken by another app?)`);
  }
}

// --- IPC: window chrome (the renderer draws its own titlebar, since frame: false) --
ipcMain.on("chuchu:window-minimize", () => mainWindow?.minimize());
ipcMain.on("chuchu:window-toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("chuchu:window-hide", () => mainWindow?.hide());
ipcMain.handle("chuchu:window-is-maximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.on("chuchu:window-set-always-on-top", (_event, value) => mainWindow?.setAlwaysOnTop(!!value));
ipcMain.on("chuchu:window-set-launch-at-login", (_event, value) => {
  app.setLoginItemSettings({ openAtLogin: !!value });
});

// --- IPC: automation actions -------------------------------------------------
// Every handler here is the ONLY place in the whole app that touches a real
// OS API. The backend can request one of these by name (see
// backend/app/services/automation_intents.py) but never executes anything
// itself — this process, running locally, is what actually does it, and the
// renderer is expected to have already shown a confirmation dialog for
// anything that isn't purely read-only. See docs/ARCHITECTURE.md.
const automation = require("./automation/actions.cjs");

ipcMain.handle("chuchu:automation:open_app", (_event, params) => automation.openApp(params));
ipcMain.handle("chuchu:automation:open_url", (_event, params) => automation.openUrl(params));
ipcMain.handle("chuchu:automation:take_screenshot", () => automation.takeScreenshot());
ipcMain.handle("chuchu:automation:get_system_info", () => automation.getSystemInfo());
ipcMain.handle("chuchu:automation:copy_to_clipboard", (_event, params) => automation.copyToClipboard(params));
ipcMain.handle("chuchu:automation:open_workspace", () => automation.openWorkspace());

// --- App lifecycle -----------------------------------------------------------
app.whenReady().then(() => {
  mainWindow = createWindow();
  createTray();
  registerShortcut();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      showWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Production: tray-resident, stays running with no windows open — quitting
  // only happens via the tray menu / app menu (isQuittingChuChu is set first).
  // Dev: quit normally, same reasoning as the close handler above.
  if (isDev) {
    app.isQuittingChuChu = true;
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuittingChuChu = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Ctrl+C in the terminal sends SIGINT to this process. Electron doesn't wire
// that to app.quit() on its own — without this, the tray-resident behavior
// above means Ctrl+C kills the visible terminal output but leaves Electron
// running invisibly, which then blocks the next `npm run electron:dev` via
// the single-instance lock. This makes Ctrl+C always do a full, clean quit.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    app.isQuittingChuChu = true;
    app.quit();
    // app.quit() is asynchronous and can be swallowed by a lingering
    // handle (e.g. the tray icon); force it after a short grace period.
    setTimeout(() => process.exit(0), 500);
  });
}
