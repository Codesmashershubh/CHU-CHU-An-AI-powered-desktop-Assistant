import { api } from "@/lib/api";
import type { AutomationResult, ValidatedAction } from "@/types";

/**
 * Three of Chu Chu's actions (create_note, set_reminder, search_web) are pure
 * backend data operations with no OS involvement — they go straight to the
 * REST API. Everything else touches the user's actual machine and can only
 * run through the Electron bridge exposed by preload.js. If that bridge
 * isn't present (e.g. running the renderer in a plain browser tab during
 * development), those actions fail gracefully instead of throwing.
 */
export async function runAutomationAction(action: ValidatedAction): Promise<AutomationResult> {
  const { action: name, params } = action;

  try {
    switch (name) {
      case "create_note": {
        await api.notes.create({ title: params.title, content: params.content ?? "" });
        return { ok: true, message: `Saved note "${params.title}".` };
      }
      case "set_reminder": {
        await api.reminders.create({ title: params.title, due_at: params.due_at });
        return { ok: true, message: `Reminder set: "${params.title}".` };
      }
      case "search_web": {
        const result = await api.browser.search(params.query);
        const summary = result.answer ?? result.results[0]?.snippet ?? "No results found.";
        return { ok: true, message: summary };
      }

      case "open_app":
        return await callBridge((b) => b.automation.openApp({ name: params.name }));
      case "open_url":
        return await callBridge((b) => b.automation.openUrl({ url: params.url }));
      case "take_screenshot":
        return await callBridge((b) => b.automation.takeScreenshot());
      case "get_system_info": {
        const result = await callBridge((b) => b.automation.getSystemInfo());
        if (result.ok && result.data) {
          const d = result.data as {
            platform: string;
            cpuModel: string;
            totalMemoryGB: number;
            memoryUsedPercent: number;
          };
          return {
            ok: true,
            message: `${d.platform} · ${d.cpuModel} · ${d.memoryUsedPercent}% of ${d.totalMemoryGB}GB memory in use`,
          };
        }
        return result;
      }
      case "copy_to_clipboard":
        return await callBridge((b) => b.automation.copyToClipboard({ text: params.text }));
      case "open_workspace":
        return await callBridge((b) => b.automation.openWorkspace());

      default:
        return { ok: false, message: `Unknown action "${name}".` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong running that action.";
    return { ok: false, message };
  }
}

async function callBridge(
  fn: (bridge: NonNullable<typeof window.chuchu>) => Promise<AutomationResult>
): Promise<AutomationResult> {
  if (typeof window === "undefined" || !window.chuchu) {
    return {
      ok: false,
      message: "This action needs the Chu Chu desktop app (not available in a plain browser tab).",
    };
  }
  return fn(window.chuchu);
}
