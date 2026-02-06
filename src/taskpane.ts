/**
 * Pi for Excel — main entry point.
 *
 * Initializes Office.js, mounts the PiSidebar,
 * wires up tools and context injection.
 */

// MUST be first — Lit fix + CSS (theme.css loaded after pi-web-ui/app.css)
import "./boot.js";

import { html, render } from "lit";
import { Agent, type AgentMessage, type ThinkingLevel } from "@mariozechner/pi-agent-core";
import { supportsXhigh } from "@mariozechner/pi-ai";
import {
  ApiKeyPromptDialog,
  ModelSelector,
  type ProviderKeysStore,
  getAppStorage,
} from "@mariozechner/pi-web-ui";

import { installFetchInterceptor } from "./auth/cors-proxy.js";
import { createOfficeStreamFn } from "./auth/stream-proxy.js";
import { restoreCredentials } from "./auth/restore.js";
import { createAllTools } from "./tools/index.js";
import { buildSystemPrompt } from "./prompt/system-prompt.js";
import { getBlueprint } from "./context/blueprint.js";
import { ChangeTracker } from "./context/change-tracker.js";
import { initAppStorage } from "./storage/init-app-storage.js";
import { getErrorMessage } from "./utils/errors.js";
import { extractTextFromContent } from "./utils/content.js";

// UI components
import { headerStyles } from "./ui/header.js";
import { renderLoading, renderError, loadingStyles } from "./ui/loading.js";
import { showToast } from "./ui/toast.js";
import { PiSidebar } from "./ui/pi-sidebar.js";

// Slash commands + extensions
import { registerBuiltins } from "./commands/builtins.js";
import { commandRegistry } from "./commands/types.js";
import { wireCommandMenu, handleCommandMenuKey, isCommandMenuVisible, hideCommandMenu } from "./commands/command-menu.js";
import { createExtensionAPI, loadExtension } from "./commands/extension-api.js";

import {
  installModelSelectorPatch,
  setActiveProviders,
} from "./taskpane/model-selector-patch.js";
import { setupSessionPersistence } from "./taskpane/sessions.js";
import { createQueueDisplay } from "./taskpane/queue-display.js";
import {
  flashThinkingLevel,
  injectStatusBar,
  updateStatusBar,
} from "./taskpane/status-bar.js";
import { showWelcomeLogin } from "./taskpane/welcome-login.js";
import { pickDefaultModel } from "./taskpane/default-model.js";
import { createContextInjector } from "./taskpane/context-injection.js";

// ============================================================================
// ModelSelector patch
// ============================================================================

installModelSelectorPatch();


// ============================================================================
// Globals
// ============================================================================

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`[pi] Missing required element #${id}`);
  }
  return el as T;
}

const appEl = getRequiredElement<HTMLElement>("app");
const loadingRoot = getRequiredElement<HTMLElement>("loading-root");
const errorRoot = getRequiredElement<HTMLElement>("error-root");

const changeTracker = new ChangeTracker();


// ============================================================================
// Inject component styles + render initial UI
// ============================================================================

const styleSheet = document.createElement("style");
styleSheet.textContent = headerStyles + loadingStyles;
document.head.appendChild(styleSheet);

let _agent: Agent | null = null;
let _sidebar: PiSidebar | null = null;

function openModelSelector(): void {
  const agent = _agent;
  if (!agent) return;
  ModelSelector.open(agent.state.model, (model) => {
    agent.setModel(model);
    updateStatusBar(agent);
    requestAnimationFrame(() => _sidebar?.requestUpdate());
  });
}

function showErrorBanner(message: string): void {
  render(renderError(message), errorRoot);
}

function clearErrorBanner(): void {
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

render(renderLoading(), loadingRoot);


// ============================================================================
// Bootstrap
// ============================================================================

installFetchInterceptor();

let initialized = false;

Office.onReady(async (info) => {
  console.log(`[pi] Office.js ready: host=${info.host}, platform=${info.platform}`);
  try {
    initialized = true;
    await init();
  } catch (e: unknown) {
    showError(`Failed to initialize: ${getErrorMessage(e)}`);
    console.error("[pi] Init error:", e);
  }
});

setTimeout(() => {
  if (!initialized) {
    console.warn("[pi] Office.js not ready after 3s — initializing without Excel");
    initialized = true;
    init().catch((e: unknown) => {
      showError(`Failed to initialize: ${getErrorMessage(e)}`);
      console.error("[pi] Init error:", e);
    });
  }
}, 3000);


// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
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
    try {
      const storage = getAppStorage();
      const enabled = await storage.settings.get("proxy.enabled");
      if (!enabled) return undefined;
      const url = await storage.settings.get("proxy.url");
      return typeof url === "string" && url.trim().length > 0 ? url.trim().replace(/\/+$/, "") : undefined;
    } catch {
      return undefined;
    }
  });

  const agent = _agent = new Agent({
    initialState: {
      systemPrompt,
      model: defaultModel,
      thinkingLevel: "off",
      messages: [],
      tools: createAllTools({ changeTracker }),
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
      clearErrorBanner();
      return (await getAppStorage().providerKeys.get(provider)) ?? undefined;
    } else {
      showErrorBanner(`API key required for ${provider}.`);
      return undefined;
    }
  };

  // ── Abort tracking (hoisted — used by onAbort + error handler below) ──
  let _userAborted = false;

  // 7. Create and mount PiSidebar
  const sidebar = _sidebar = new PiSidebar();
  sidebar.agent = agent;
  sidebar.emptyHints = ["Summarize this sheet", "Add a VLOOKUP formula", "Format as a table"];
  sidebar.onSend = (text) => {
    clearErrorBanner();
    agent.prompt(text).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (isLikelyCorsErrorMessage(msg)) {
        showErrorBanner("Network error (likely CORS). Start the local HTTPS proxy (npm run proxy:https) and enable it in /settings → Proxy.");
      } else {
        showErrorBanner(`LLM error: ${msg}`);
      }
    });
  };
  sidebar.onAbort = () => {
    _userAborted = true;
    agent.abort();
  };

  appEl.innerHTML = "";
  appEl.appendChild(sidebar);

  // 8. Error tracking
  agent.subscribe((ev) => {
    if (ev.type === "message_start" && ev.message.role === "user") {
      clearErrorBanner();
    }
    if (ev.type === "agent_end") {
      if (agent.state.error) {
        const isAbort = _userAborted ||
          /abort/i.test(agent.state.error) ||
          /cancel/i.test(agent.state.error);
        if (!isAbort) {
          const err = agent.state.error;
          if (isLikelyCorsErrorMessage(err)) {
            showErrorBanner("Network error (likely CORS). Start the local HTTPS proxy (npm run proxy:https) and enable it in /settings → Proxy.");
          } else {
            showErrorBanner(`LLM error: ${err}`);
          }
        }
      } else {
        clearErrorBanner();
      }
      _userAborted = false;
    }
  });

  // ── Session persistence ──
  await setupSessionPersistence({ agent, sidebar, sessions });

  // ── Register slash commands + extensions ──
  registerBuiltins(agent);
  const extensionAPI = createExtensionAPI(agent);
  const { activate: activateSnake } = await import("./extensions/snake.js");
  await loadExtension(extensionAPI, activateSnake);

  document.addEventListener("pi:providers-changed", async () => {
    const updated = await providerKeys.list();
    setActiveProviders(new Set(updated));
  });

  // ── Queue display ──
  const queueDisplay = createQueueDisplay({ agent, sidebar });

  // ── Keyboard shortcuts ──
  const THINKING_COLORS: Record<ThinkingLevel, string> = {
    off: "#a0a0a0",
    minimal: "#767676",
    low: "#4488cc",
    medium: "#22998a",
    high: "#875f87",
    xhigh: "#8b008b",
  };

  function getThinkingLevels(): ThinkingLevel[] {
    const model = agent.state.model;
    if (!model || !model.reasoning) return ["off"];

    const provider = model.provider;
    if (provider === "openai" || provider === "openai-codex") {
      const levels: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];
      if (supportsXhigh(model)) levels.push("xhigh");
      return levels;
    }

    if (provider === "anthropic") {
      const levels: ThinkingLevel[] = ["off", "low", "medium", "high"];
      if (supportsXhigh(model)) levels.push("xhigh");
      return levels;
    }

    return ["off", "low", "medium", "high"];
  }

  document.addEventListener("keydown", (e) => {
    // Command menu takes priority
    if (isCommandMenuVisible()) {
      if (handleCommandMenuKey(e)) return;
    }

    const textarea = sidebar.getTextarea();
    const isInEditor = Boolean(textarea && (e.target === textarea || textarea.contains(e.target as Node)));
    const isStreaming = agent.state.isStreaming;

    // ESC — dismiss command menu
    if (e.key === "Escape" && isCommandMenuVisible()) {
      e.preventDefault();
      hideCommandMenu();
      return;
    }

    // ESC — abort
    if (e.key === "Escape" && isStreaming) {
      e.preventDefault();
      _userAborted = true;
      agent.abort();
      return;
    }

    // Shift+Tab — cycle thinking level
    if (e.shiftKey && e.key === "Tab") {
      e.preventDefault();
      const levels = getThinkingLevels();
      const current = agent.state.thinkingLevel;
      const idx = levels.indexOf(current);
      const next = levels[(idx >= 0 ? idx + 1 : 0) % levels.length];
      agent.setThinkingLevel(next);
      updateStatusBar(agent);
      flashThinkingLevel(next, THINKING_COLORS[next] || "#a0a0a0");
      return;
    }

    // Ctrl+O — toggle thinking/tool visibility
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      const collapsed = document.body.classList.toggle("pi-hide-internals");
      showToast(collapsed ? "Details hidden (⌃O)" : "Details shown (⌃O)", 1500);
      return;
    }

    // Slash command execution
    if (isInEditor && textarea && e.key === "Enter" && !e.shiftKey && textarea.value.startsWith("/") && !isStreaming) {
      const val = textarea.value.trim();
      const spaceIdx = val.indexOf(" ");
      const cmdName = spaceIdx > 0 ? val.slice(1, spaceIdx) : val.slice(1);
      const args = spaceIdx > 0 ? val.slice(spaceIdx + 1) : "";
      const cmd = commandRegistry.get(cmdName);
      if (cmd) {
        e.preventDefault();
        e.stopImmediatePropagation();
        hideCommandMenu();
        const input = sidebar.getInput();
        if (input) input.clear();
        cmd.execute(args);
        return;
      }
    }

    // Enter/Alt+Enter while streaming — steer or follow-up
    if (isInEditor && textarea && e.key === "Enter" && !e.shiftKey && isStreaming) {
      const text = textarea.value.trim();
      if (!text) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const msg = { role: "user" as const, content: [{ type: "text" as const, text }], timestamp: Date.now() };
      if (e.altKey) {
        agent.followUp(msg);
        queueDisplay.add("follow-up", text);
      } else {
        agent.steer(msg);
        queueDisplay.add("steer", text);
      }
      const input = sidebar.getInput();
      if (input) input.clear();
      return;
    }
  }, true);

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
      const levels = getThinkingLevels();
      const current = agent.state.thinkingLevel;
      const idx = levels.indexOf(current);
      const next = levels[(idx >= 0 ? idx + 1 : 0) % levels.length];
      agent.setThinkingLevel(next);
      updateStatusBar(agent);
      flashThinkingLevel(next, THINKING_COLORS[next] || "#a0a0a0");
    }
  });

  console.log("[pi] PiSidebar mounted");
}


// ============================================================================
// Error display
// ============================================================================

function showError(message: string): void {
  render(renderError(message), errorRoot);
}
