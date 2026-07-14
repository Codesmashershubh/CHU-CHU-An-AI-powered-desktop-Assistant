// Runs in an isolated context with access to Node APIs, but the renderer
// (contextIsolation: true, sandbox: true) can't reach Node or Electron
// directly — only whatever's explicitly exposed here. Keep this surface
// small and specific; it's the actual security boundary of the app.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chuchu", {
  platform: process.platform,

  window: {
    minimize: () => ipcRenderer.send("chuchu:window-minimize"),
    toggleMaximize: () => ipcRenderer.send("chuchu:window-toggle-maximize"),
    hide: () => ipcRenderer.send("chuchu:window-hide"),
    isMaximized: () => ipcRenderer.invoke("chuchu:window-is-maximized"),
    setAlwaysOnTop: (value) => ipcRenderer.send("chuchu:window-set-always-on-top", value),
    setLaunchAtLogin: (value) => ipcRenderer.send("chuchu:window-set-launch-at-login", value),
  },

  automation: {
    openApp: (params) => ipcRenderer.invoke("chuchu:automation:open_app", params),
    openUrl: (params) => ipcRenderer.invoke("chuchu:automation:open_url", params),
    takeScreenshot: () => ipcRenderer.invoke("chuchu:automation:take_screenshot"),
    getSystemInfo: () => ipcRenderer.invoke("chuchu:automation:get_system_info"),
    copyToClipboard: (params) => ipcRenderer.invoke("chuchu:automation:copy_to_clipboard", params),
    openWorkspace: () => ipcRenderer.invoke("chuchu:automation:open_workspace"),
  },
});
