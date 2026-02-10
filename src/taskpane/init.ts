/**
 * Taskpane initialization.
 *
 * Contains the bulk of app wiring (storage, auth restore, agent creation,
 * sidebar mount, slash commands, session persistence, keyboard shortcuts).
 */

import { html, render } from "lit";
import { Agent } from "@mariozechner/pi-agent-core";
import { ApiKeyPromptDialog, ModelSelector, getAppStorage } from "@mariozechner/pi-web-ui";

import { createOfficeStreamFn } from "../auth/stream-proxy.js";
import { restoreCredentials } from "../auth/restore.js";
import { getBlueprint } from "../context/blueprint.js";
import { ChangeTracker } from "../context/change-tracker.js";
import { createAllTools } from "../tools/index.js";
import { loadExtension, createExtensionAPI } from "../commands/extension-api.js";
import { registerBuiltins } from "../commands/builtins.js";
import { wireCommandMenu } from "../commands/command-menu.js";
import { buildSystemPrompt } from "../prompt/system-prompt.js";
import { initAppStorage } from "../storage/init-app-storage.js";
import { renderError } from "../ui/loading.js";
import { PiSidebar } from "../ui/pi-sidebar.js";
import { setActiveProviders } from "../compat/model-selector-patch.js";

import { createContextInjector } from "./context-injection.js";
import { pickDefaultModel } from "./default-model.js";
import { installKeyboardShortcuts, cycleThinkingLevel } from "./keyboard-shortcuts.js";
import { createQueueDisplay } from "./queue-display.js";
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
  const { providerKeys, sessions } = initAppStorage();

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

  sidebar.onSend = (text) => {
    clearErrorBanner(errorRoot);
    agent.prompt(text).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (isLikelyCorsErrorMessage(msg)) {
        showErrorBanner(
          errorRoot,
          "Network error (likely CORS). Start the local HTTPS proxy (npm run proxy:https) and enable it in /settings → Proxy.",
        );
      } else {
        showErrorBanner(errorRoot, `LLM error: ${msg}`);
      }
    });
  };

  sidebar.onAbort = () => {
    userAborted = true;
    agent.abort();
  };

  appEl.innerHTML = "";
  appEl.appendChild(sidebar);

  // 8. Error tracking
  agent.subscribe((ev) => {
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
  await setupSessionPersistence({ agent, sidebar, sessions });

  // ── Register slash commands + extensions ──
  registerBuiltins(agent);
  const extensionAPI = createExtensionAPI(agent);
  const { activate: activateSnake } = await import("../extensions/snake.js");
  await loadExtension(extensionAPI, activateSnake);

  document.addEventListener("pi:providers-changed", () => {
    void (async () => {
      const updated = await providerKeys.list();
      setActiveProviders(new Set(updated));
    })();
  });

  // ── Queue display ──
  const queueDisplay = createQueueDisplay({ agent, sidebar });

  // ── Keyboard shortcuts ──
  installKeyboardShortcuts({
    agent,
    sidebar,
    queueDisplay,
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

