// Extension point for local, opt-in browser automation. Not called from
// main.js by default — see plugins/browser-skills/README.md for why (a real
// browser is a large local dependency most people trying Chu Chu for the
// first time don't need) and how to wire this in.
//
// Sketch of what a real implementation looks like, once you've run
// `npx playwright install chromium` locally:
//
//   const { chromium } = require("playwright");
//
//   async function fillForm({ url, fields }) {
//     const browser = await chromium.launch({ headless: false });
//     try {
//       const page = await browser.newPage();
//       await page.goto(url, { waitUntil: "domcontentloaded" });
//       for (const [selector, value] of Object.entries(fields)) {
//         await page.fill(selector, value);
//       }
//       return { ok: true, message: `Filled ${Object.keys(fields).length} field(s) on ${url}.` };
//     } finally {
//       await browser.close();
//     }
//   }
//
// Whatever you add here, register it the same way as the other actions:
// 1. Describe it in plugins/automation-skills/actions.json
// 2. Add a matching ActionSpec + pydantic params model to
//    backend/app/services/automation_intents.py
// 3. Export a function here and wire it into main.js's ipcMain.handle(...)
//    calls, exactly like the built-in actions in ./actions.js
//
// Treat it as system-modifying (requires_confirmation: true), and make the
// confirmation text specific about exactly what page/fields are involved —
// see docs/ARCHITECTURE.md for why that matters here more than most actions.

"use strict";

module.exports = {
  // Intentionally empty — see the comment above for how to fill this in.
};
