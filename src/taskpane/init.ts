/**
 * Taskpane initialization.
 *
 * Contains the bulk of app wiring (storage, auth restore, agent creation,
 * sidebar mount, slash commands, session persistence, keyboard shortcuts).
 */

import { html, render } from "lit";
import { Agent } from "@mariozechner/pi-agent-core";
import { ApiKeyPromptDialog } from "@mariozechner/pi-web-ui/dist/dialogs/ApiKeyPromptDialog.js";
import { ModelSelector } from "@mariozechner/pi-web-ui/dist/dialogs/ModelSelector.js";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import { createOfficeStreamFn, resetPayloadStats } from "../auth/stream-proxy.js";
import { restoreCredentials } from "../auth/restore.js";
import { getBlueprint } from "../context/blueprint.js";
import { ChangeTracker } from "../context/change-tracker.js";
import { convertToLlm } from "../messages/convert-to-llm.js";
import { createAllTools } from "../tools/index.js";
import { loadExtension, createExtensionAPI } from "../commands/extension-api.js";
import { registerBuiltins } from "../commands/builtins.js";
import { wireCommandMenu } from "../commands/command-menu.js";
import { commandRegistry } from "../commands/types.js";
import { buildSystemPrompt } from "../prompt/system-prompt.js";
import { initAppStorage } from "../storage/init-app-storage.js";
import { renderError } from "../ui/loading.js";
import { showToast } from "../ui/toast.js";
import { PiSidebar } from "../ui/pi-sidebar.js";
import { setActiveProviders } from "../compat/model-selector-patch.js";

import { createContextInjector } from "./context-injection.js";
import { pickDefaultModel } from "./default-model.js";
import { installKeyboardShortcuts, cycleThinkingLevel } from "./keyboard-shortcuts.js";
import { createQueueDisplay } from "./queue-display.js";
import { createActionQueue } from "./action-queue.js";
import { setupSessionPersistence } from "./sessions.js";
import { injectStatusBar, updateStatusBar } from "./status-bar.js";
import { showWelcomeLogin } from "./welcome-login.js";

function showErrorBanner(errorRoot: HTMLElement, message: string): void {
  render(renderError(message), errorRoot);
}

function clearErrorBanner(errorRoot: HTMLElement): void {
  render(html``, errorRoot);
}

function isLikelyCorsErrorMessage(msg: string): boolean {
  const m = msg.toLowerCase();

  // Browser/network errors
  if (m.includes("failed to fetch")) return true;
  if (m.includes("load failed")) return true; // WebKit/Safari
  if (m.includes("networkerror")) return true;

  // Explicit CORS wording
  if (m.includes("cors") || m.includes("cross-origin")) return true;

  // Anthropic sometimes returns a JSON 401 with a CORS-specific message when direct browser access is disabled.
  if (m.includes("cors requests are not allowed")) return true;

  return false;
}

export async function initTaskpane(opts: {
  appEl: HTMLElement;
  errorRoot: HTMLElement;
}): Promise<void> {
  const { appEl, errorRoot } = opts;

  const changeTracker = new ChangeTracker();

  // 1. Storage
  const { providerKeys, sessions, settings } = initAppStorage();

  // 1b. Auto-compaction (Pi defaults to enabled)
  let autoCompactEnabled = true;
  try {
    autoCompactEnabled = (await settings.get<boolean>("compaction.enabled")) ?? true;
  } catch {
    autoCompactEnabled = true;
  }

  // 2. Restore auth
  await restoreCredentials(providerKeys);

  // 2b. Welcome/login if no providers
  const configuredProviders = await providerKeys.list();
  if (configuredProviders.length === 0) {
    await showWelcomeLogin(providerKeys);
  }

  // 3. Workbook blueprint
  let blueprint: string | undefined;
  try {
    blueprint = await getBlueprint();
    console.log("[pi] Workbook blueprint built");
  } catch {
    console.warn("[pi] Could not build blueprint (not in Excel?)");
  }

  // 4. Change tracker
  changeTracker.start().catch(() => {});

  // 5. Create agent
  const systemPrompt = buildSystemPrompt(blueprint);
  const availableProviders = await providerKeys.list();
  setActiveProviders(new Set(availableProviders));
  const defaultModel = pickDefaultModel(availableProviders);

  const streamFn = createOfficeStreamFn(async () => {
    // In dev mode, Vite's reverse proxy handles CORS — don't double-proxy.
    if (import.meta.env.DEV) return undefined;

    try {
      const storage = getAppStorage();
      const enabled = await storage.settings.get("proxy.enabled");
      if (!enabled) return undefined;
      const url = await storage.settings.get("proxy.url");
      return typeof url === "string" && url.trim().length > 0
        ? url.trim().replace(/\/+$/, "")
        : undefined;
    } catch {
      return undefined;
    }
  });

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: defaultModel,
      thinkingLevel: "off",
      messages: [],
      tools: createAllTools(),
    },
    convertToLlm,
    transformContext: createContextInjector(changeTracker),
    streamFn,
  });

  // 6. Set up API key resolution
  agent.getApiKey = async (provider: string) => {
    const key = await getAppStorage().providerKeys.get(provider);
    if (key) return key;

    // Prompt for key
    const success = await ApiKeyPromptDialog.prompt(provider);
    const updated = await providerKeys.list();
    setActiveProviders(new Set(updated));
    if (success) {
      clearErrorBanner(errorRoot);
      return (await getAppStorage().providerKeys.get(provider)) ?? undefined;
    } else {
      showErrorBanner(errorRoot, `API key required for ${provider}.`);
      return undefined;
    }
  };

  // 6b. Register builtin slash commands early so the UI can queue/execute
  // `/compact` even before the rest of init finishes.
  registerBuiltins(agent);

  // ── Abort tracking (hoisted — used by onAbort + error handler below) ──
  let userAborted = false;

  // 7. Create and mount PiSidebar
  const sidebar = new PiSidebar();
  sidebar.agent = agent;
  sidebar.emptyHints = [
    {
      label: "Analyze this data",
      prompt: "Look at the data on the active sheet. Summarize the key trends, flag any outliers or blanks, and add a short analysis in a new column to the right.",
    },
    {
      label: "Format as a report",
      prompt: "Format the active sheet as a clean report: bold the header row, add alternating row colors, auto-fit column widths, and freeze the top row.",
    },
    {
      label: "Build a formula",
      prompt: "Look at the column headers on this sheet and suggest a useful formula — for example a SUMIFS, VLOOKUP, or conditional — then write it into the first empty column with a header explaining what it calculates.",
    },
  ];

  const openModelSelector = (): void => {
    void ModelSelector.open(agent.state.model, (model) => {
      agent.setModel(model);
      updateStatusBar(agent);
      requestAnimationFrame(() => sidebar.requestUpdate());
    });
  };

  // ── Queue display + ordered action queue ──
  const queueDisplay = createQueueDisplay({ agent, sidebar });
  const actionQueue = createActionQueue({
    agent,
    sidebar,
    queueDisplay,
    autoCompactEnabled,
  });

  // Slash commands chosen from the popup menu dispatch this event.
  document.addEventListener(
    "pi:command-run",
    ((e: CustomEvent<{ name?: string; args?: string }>) => {
      const name = e.detail?.name;
      if (!name) return;

      if (name === "compact") {
        actionQueue.enqueueCommand(name, e.detail?.args ?? "");
        return;
      }

      // Other commands: execute immediately if we're idle; otherwise block.
      if (agent.state.isStreaming || actionQueue.isBusy()) {
        showToast(`Can't run /${name} while Pi is busy`);
        return;
      }

      const cmd = commandRegistry.get(name);
      if (cmd) void cmd.execute(e.detail?.args ?? "");
    }) as EventListener,
  );

  sidebar.onSend = (text) => {
    clearErrorBanner(errorRoot);
    actionQueue.enqueuePrompt(text);
  };

  sidebar.onAbort = () => {
    userAborted = true;
    agent.abort();
  };

  appEl.innerHTML = "";
  appEl.appendChild(sidebar);

  // 8. Error tracking + payload stats reset
  agent.subscribe((ev) => {
    if (ev.type === "agent_start") {
      resetPayloadStats();
    }
    if (ev.type === "message_start" && ev.message.role === "user") {
      clearErrorBanner(errorRoot);
    }
    if (ev.type === "agent_end") {
      if (agent.state.error) {
        const isAbort =
          userAborted ||
          /abort/i.test(agent.state.error) ||
          /cancel/i.test(agent.state.error);
        if (!isAbort) {
          const err = agent.state.error;
          if (isLikelyCorsErrorMessage(err)) {
            showErrorBanner(
              errorRoot,
              "Network error (likely CORS). Start the local HTTPS proxy (npm run proxy:https) and enable it in /settings → Proxy.",
            );
          } else {
            showErrorBanner(errorRoot, `LLM error: ${err}`);
          }
        }
      } else {
        clearErrorBanner(errorRoot);
      }
      userAborted = false;
    }
  });

  // ── Session persistence ──
  await setupSessionPersistence({ agent, sidebar, sessions, settings });

  // ── Register extensions ──
  const extensionAPI = createExtensionAPI(agent);
  const { activate: activateSnake } = await import("../extensions/snake.js");
  await loadExtension(extensionAPI, activateSnake);

  document.addEventListener("pi:providers-changed", () => {
    void (async () => {
      const updated = await providerKeys.list();
      setActiveProviders(new Set(updated));
    })();
  });

  // ── Keyboard shortcuts ──
  installKeyboardShortcuts({
    agent,
    sidebar,
    queueDisplay,
    actionQueue,
    markUserAborted: () => {
      userAborted = true;
    },
  });

  // ── Status bar ──
  injectStatusBar(agent);

  // ── Wire command menu to textarea ──
  const wireTextarea = () => {
    const ta = sidebar.getTextarea();
    if (ta) {
      wireCommandMenu(ta);
    } else {
      requestAnimationFrame(wireTextarea);
    }
  };
  requestAnimationFrame(wireTextarea);

  // ── Status bar click handlers ──
  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;

    // Model picker
    if (el.closest?.(".pi-status-model")) {
      openModelSelector();
      return;
    }

    // Thinking level toggle
    if (el.closest?.(".pi-status-thinking")) {
      cycleThinkingLevel(agent);
    }
  });

  console.log("[pi] PiSidebar mounted");
}

