/**
 * Taskpane initialization.
 *
 * Contains the bulk of app wiring (storage, auth restore, runtime manager,
 * sidebar mount, slash commands, keyboard shortcuts).
 */

import { html, render } from "lit";
import { Agent } from "@mariozechner/pi-agent-core";
import { ApiKeyPromptDialog } from "@mariozechner/pi-web-ui/dist/dialogs/ApiKeyPromptDialog.js";
import { ModelSelector } from "@mariozechner/pi-web-ui/dist/dialogs/ModelSelector.js";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import { createOfficeStreamFn } from "../auth/stream-proxy.js";
import { isLoopbackProxyUrl } from "../auth/proxy-validation.js";
import { restoreCredentials } from "../auth/restore.js";
import { invalidateBlueprint } from "../context/blueprint.js";
import { ChangeTracker } from "../context/change-tracker.js";
import { convertToLlm } from "../messages/convert-to-llm.js";
import { createAllTools } from "../tools/index.js";
import { applyExperimentalToolGates } from "../tools/experimental-tool-gates.js";
import { withWorkbookCoordinator } from "../tools/with-workbook-coordinator.js";
import { loadExtension, createExtensionAPI } from "../commands/extension-api.js";
import { registerBuiltins } from "../commands/builtins.js";
import { showInstructionsDialog, showResumeDialog } from "../commands/builtins/overlays.js";
import { wireCommandMenu } from "../commands/command-menu.js";
import { commandRegistry } from "../commands/types.js";
import {
  getUserInstructions,
  getWorkbookInstructions,
  hasAnyInstructions,
} from "../instructions/store.js";
import { buildSystemPrompt } from "../prompt/system-prompt.js";
import { initAppStorage } from "../storage/init-app-storage.js";
import { renderError } from "../ui/loading.js";
import { showToast } from "../ui/toast.js";
import { PiSidebar } from "../ui/pi-sidebar.js";
import { setActiveProviders } from "../compat/model-selector-patch.js";
import { createWorkbookCoordinator } from "../workbook/coordinator.js";
import { formatWorkbookLabel, getWorkbookContext } from "../workbook/context.js";

import { createContextInjector } from "./context-injection.js";
import { pickDefaultModel } from "./default-model.js";
import { installKeyboardShortcuts, cycleThinkingLevel } from "./keyboard-shortcuts.js";
import { createQueueDisplay } from "./queue-display.js";
import { createActionQueue } from "./action-queue.js";
import { setupSessionPersistence } from "./sessions.js";
import { injectStatusBar } from "./status-bar.js";
import { showWelcomeLogin } from "./welcome-login.js";
import { SessionRuntimeManager, type RuntimeTabSnapshot } from "./session-runtime-manager.js";
import { isRecord } from "../utils/type-guards.js";

const BUSY_ALLOWED_COMMANDS = new Set(["compact", "new", "instructions"]);

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

function getActiveLockNotice(tabs: RuntimeTabSnapshot[]): string | null {
  const activeTab = tabs.find((tab) => tab.isActive);
  if (!activeTab) return null;

  if (activeTab.lockState === "waiting_for_lock") {
    return "Waiting for workbook lock…";
  }

  if (activeTab.lockState === "holding_lock") {
    return "Applying workbook changes…";
  }

  return null;
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

  // 1c. Security warning: remote proxies can see your prompts + credentials.
  try {
    const proxyEnabled = await settings.get<boolean>("proxy.enabled");
    const proxyUrl = await settings.get<string>("proxy.url");
    if (
      proxyEnabled === true &&
      typeof proxyUrl === "string" &&
      proxyUrl.trim().length > 0 &&
      !isLoopbackProxyUrl(proxyUrl)
    ) {
      showToast("Security warning: proxy URL is not localhost — it can see your tokens and prompts.");
    }
  } catch {
    // ignore
  }

  // 2. Restore auth
  await restoreCredentials(providerKeys, settings);

  // 2b. Welcome/login if no providers
  const configuredProviders = await providerKeys.list();
  if (configuredProviders.length === 0) {
    await showWelcomeLogin(providerKeys);
  }

  // 3. Change tracker
  changeTracker.start().catch(() => {});

  // 4. Shared runtime dependencies
  // Workbook structure context is injected separately by transformContext.
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

  const workbookCoordinator = createWorkbookCoordinator();

  // 5. Create and mount PiSidebar
  const sidebar = new PiSidebar();
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

  appEl.innerHTML = "";
  appEl.appendChild(sidebar);

  let instructionsActive = false;

  const setInstructionsActive = (next: boolean) => {
    if (instructionsActive === next) return;
    instructionsActive = next;
    document.dispatchEvent(new CustomEvent("pi:status-update"));
  };

  const resolveWorkbookContext = async (): Promise<Awaited<ReturnType<typeof getWorkbookContext>>> => {
    try {
      return await getWorkbookContext();
    } catch {
      return {
        workbookId: null,
        workbookName: null,
        source: "unknown",
      };
    }
  };

  const resolveWorkbookId = async (): Promise<string | null> => {
    const workbookContext = await resolveWorkbookContext();
    return workbookContext.workbookId;
  };

  const buildRuntimeSystemPrompt = async (workbookId: string | null): Promise<string> => {
    try {
      const userInstructions = await getUserInstructions(settings);
      const workbookInstructions = await getWorkbookInstructions(settings, workbookId);
      setInstructionsActive(hasAnyInstructions({ userInstructions, workbookInstructions }));
      return buildSystemPrompt({ userInstructions, workbookInstructions });
    } catch {
      setInstructionsActive(false);
      return buildSystemPrompt();
    }
  };

  const runtimeManager = new SessionRuntimeManager(sidebar);
  const abortedAgents = new WeakSet<Agent>();

  const getActiveRuntime = () => runtimeManager.getActiveRuntime();
  const getActiveAgent = () => getActiveRuntime()?.agent ?? null;
  const getActiveQueueDisplay = () => getActiveRuntime()?.queueDisplay ?? null;
  const getActiveActionQueue = () => getActiveRuntime()?.actionQueue ?? null;
  const getActiveLockState = () => getActiveRuntime()?.lockState ?? "idle";

  let previousActiveRuntimeId: string | null = null;

  runtimeManager.subscribe((tabs) => {
    sidebar.sessionTabs = tabs;
    sidebar.lockNotice = getActiveLockNotice(tabs);
    sidebar.requestUpdate();

    const activeRuntimeId = tabs.find((tab) => tab.isActive)?.runtimeId ?? null;
    if (activeRuntimeId !== previousActiveRuntimeId) {
      previousActiveRuntimeId = activeRuntimeId;
      document.dispatchEvent(new CustomEvent("pi:active-runtime-changed"));
    }

    document.dispatchEvent(new CustomEvent("pi:status-update"));
  });

  const refreshSystemPromptForAllRuntimes = async (workbookId: string | null) => {
    const prompt = await buildRuntimeSystemPrompt(workbookId);

    for (const runtime of runtimeManager.listRuntimes()) {
      runtime.agent.setSystemPrompt(prompt);
    }

    document.dispatchEvent(new CustomEvent("pi:status-update"));
  };

  const refreshWorkbookState = async () => {
    const workbookContext = await resolveWorkbookContext();
    sidebar.workbookLabel = formatWorkbookLabel(workbookContext);
    sidebar.requestUpdate();

    await refreshSystemPromptForAllRuntimes(workbookContext.workbookId);
  };

  void refreshWorkbookState();

  window.addEventListener("focus", () => {
    void refreshWorkbookState();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshWorkbookState();
    }
  });

  document.addEventListener("pi:instructions-updated", () => {
    void refreshWorkbookState();
  });

  const createRuntime = async (optsForRuntime: {
    activate: boolean;
    autoRestoreLatest: boolean;
  }) => {
    const runtimeId = crypto.randomUUID();
    const workbookId = await resolveWorkbookId();
    const runtimeSystemPrompt = await buildRuntimeSystemPrompt(workbookId);

    let runtimeAgent: Agent | null = null;

    const gatedTools = await applyExperimentalToolGates(createAllTools());

    const tools = withWorkbookCoordinator(
      gatedTools,
      workbookCoordinator,
      {
        getWorkbookId: resolveWorkbookId,
        getSessionId: () => runtimeAgent?.sessionId ?? runtimeId,
      },
      {
        onWriteCommitted: (event) => {
          if (event.impact !== "structure") return;
          invalidateBlueprint(event.workbookId);
        },
      },
    );

    const agent = new Agent({
      initialState: {
        systemPrompt: runtimeSystemPrompt,
        model: defaultModel,
        thinkingLevel: "off",
        messages: [],
        tools,
      },
      convertToLlm,
      transformContext: createContextInjector(changeTracker),
      streamFn,
    });

    runtimeAgent = agent;

    // API key resolution
    agent.getApiKey = async (provider: string) => {
      const key = await getAppStorage().providerKeys.get(provider);
      if (key) return key;

      const success = await ApiKeyPromptDialog.prompt(provider);
      const updated = await providerKeys.list();
      setActiveProviders(new Set(updated));
      if (success) {
        clearErrorBanner(errorRoot);
        return (await getAppStorage().providerKeys.get(provider)) ?? undefined;
      }

      showErrorBanner(errorRoot, `API key required for ${provider}.`);
      return undefined;
    };

    const queueDisplay = createQueueDisplay({ agent });
    const actionQueue = createActionQueue({
      agent,
      sidebar,
      queueDisplay,
      autoCompactEnabled,
    });

    const persistence = await setupSessionPersistence({
      agent,
      sessions,
      settings,
      autoRestoreLatest: optsForRuntime.autoRestoreLatest,
    });

    const unsubscribeErrorTracking = agent.subscribe((ev) => {
      const isActiveRuntime = runtimeManager.getActiveRuntime()?.runtimeId === runtimeId;

      if (ev.type === "message_start" && ev.message.role === "user" && isActiveRuntime) {
        clearErrorBanner(errorRoot);
      }

      if (ev.type !== "agent_end") return;

      const wasUserAbort = abortedAgents.has(agent);
      abortedAgents.delete(agent);

      if (!isActiveRuntime) return;

      if (agent.state.error) {
        const isAbort = wasUserAbort || /abort/i.test(agent.state.error) || /cancel/i.test(agent.state.error);
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
    });

    const runtime = runtimeManager.createRuntime(
      {
        runtimeId,
        agent,
        actionQueue,
        queueDisplay,
        persistence,
        lockState: "idle",
        dispose: () => {
          unsubscribeErrorTracking();
          actionQueue.shutdown();
          agent.abort();
          persistence.dispose();
        },
      },
      { activate: optsForRuntime.activate },
    );

    return runtime;
  };

  workbookCoordinator.subscribe((event) => {
    if (event.operationType !== "write") return;

    const runtime = runtimeManager.findRuntimeBySessionId(event.context.sessionId);
    if (!runtime) return;

    if (event.type === "queued") {
      runtimeManager.setRuntimeLockState(runtime.runtimeId, "waiting_for_lock");
      return;
    }

    if (event.type === "started") {
      runtimeManager.setRuntimeLockState(runtime.runtimeId, "holding_lock");
      return;
    }

    if (event.type === "completed" || event.type === "failed") {
      runtimeManager.setRuntimeLockState(runtime.runtimeId, "idle");
    }
  });

  registerBuiltins({
    getActiveAgent,
    renameActiveSession: async (title: string) => {
      const activeRuntime = getActiveRuntime();
      if (!activeRuntime) {
        showToast("No active session");
        return;
      }

      await activeRuntime.persistence.renameSession(title);
    },
    createRuntime: async () => {
      await createRuntime({ activate: true, autoRestoreLatest: false });
    },
    resumeIntoActiveRuntime: async () => {
      await showResumeDialog({
        onResumeSession: async (sessionData) => {
          const activeRuntime = getActiveRuntime();
          if (!activeRuntime) {
            showToast("No active session");
            return;
          }

          await activeRuntime.persistence.applyLoadedSession(sessionData);
          activeRuntime.queueDisplay.clear();
          activeRuntime.queueDisplay.setActionQueue([]);
          sidebar.syncFromAgent();
          sidebar.requestUpdate();
          document.dispatchEvent(new CustomEvent("pi:model-changed"));
          document.dispatchEvent(new CustomEvent("pi:status-update"));
        },
      });
    },
    openInstructionsEditor: async () => {
      await showInstructionsDialog({
        onSaved: async () => {
          await refreshWorkbookState();
        },
      });
    },
  });

  // Slash commands chosen from the popup menu dispatch this event.
  const onCommandRun: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (!isRecord(event.detail)) return;

    const name = typeof event.detail.name === "string" ? event.detail.name : "";
    const args = typeof event.detail.args === "string" ? event.detail.args : "";
    if (!name) return;

    const activeRuntime = getActiveRuntime();
    if (!activeRuntime) {
      showToast("No active session");
      return;
    }

    const busy = activeRuntime.agent.state.isStreaming || activeRuntime.actionQueue.isBusy();
    if (busy && !BUSY_ALLOWED_COMMANDS.has(name)) {
      showToast(`Can't run /${name} while Pi is busy`);
      return;
    }

    if (name === "compact") {
      activeRuntime.actionQueue.enqueueCommand(name, args);
      return;
    }

    const cmd = commandRegistry.get(name);
    if (cmd) void cmd.execute(args);
  };
  document.addEventListener("pi:command-run", onCommandRun);

  sidebar.onSend = (text) => {
    clearErrorBanner(errorRoot);
    const activeRuntime = getActiveRuntime();
    if (!activeRuntime) {
      showToast("No active session");
      return;
    }
    activeRuntime.actionQueue.enqueuePrompt(text);
  };

  sidebar.onAbort = () => {
    const activeRuntime = getActiveRuntime();
    if (!activeRuntime) return;
    abortedAgents.add(activeRuntime.agent);
    activeRuntime.agent.abort();
  };

  sidebar.onCreateTab = () => {
    void createRuntime({ activate: true, autoRestoreLatest: false });
  };

  sidebar.onSelectTab = (runtimeId: string) => {
    runtimeManager.switchRuntime(runtimeId);
  };

  sidebar.onCloseTab = (runtimeId: string) => {
    if (runtimeManager.listRuntimes().length <= 1) {
      showToast("Can't close the last tab");
      return;
    }
    runtimeManager.closeRuntime(runtimeId);
  };

  // Bootstrap first runtime (auto-restores latest session when available)
  const initialRuntime = await createRuntime({ activate: true, autoRestoreLatest: true });

  // ── Register extensions ──
  const extensionAPI = createExtensionAPI(initialRuntime.agent);
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
    getActiveAgent,
    getActiveQueueDisplay,
    getActiveActionQueue,
    sidebar,
    markUserAborted: (agent: Agent) => {
      abortedAgents.add(agent);
    },
  });

  // ── Status bar ──
  injectStatusBar({
    getActiveAgent,
    getLockState: getActiveLockState,
    getInstructionsActive: () => instructionsActive,
  });

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

  const openModelSelector = (): void => {
    const activeAgent = getActiveAgent();
    if (!activeAgent) {
      showToast("No active session");
      return;
    }

    void ModelSelector.open(activeAgent.state.model, (model) => {
      activeAgent.setModel(model);
      document.dispatchEvent(new CustomEvent("pi:status-update"));
      requestAnimationFrame(() => sidebar.requestUpdate());
    });
  };

  // ── Status bar click handlers ──
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const el = target;

    // Model picker
    if (el.closest?.(".pi-status-model")) {
      openModelSelector();
      return;
    }

    // Instructions editor
    if (el.closest?.(".pi-status-instructions")) {
      void showInstructionsDialog({
        onSaved: async () => {
          await refreshWorkbookState();
        },
      });
      return;
    }

    // Thinking level toggle
    if (el.closest?.(".pi-status-thinking")) {
      const activeAgent = getActiveAgent();
      if (!activeAgent) return;
      cycleThinkingLevel(activeAgent);
    }
  });

  console.log("[pi] PiSidebar mounted");
}
