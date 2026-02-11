/**
 * Extension API for Pi for Excel.
 *
 * Extensions are ES modules that export an `activate(api)` function.
 * They run in the same webview sandbox — no Node.js APIs.
 *
 * Extensions can:
 * - Register slash commands
 * - Add custom tools for the agent
 * - Show overlay UIs (via the overlay API)
 * - Subscribe to agent events
 *
 * Example extension:
 * ```ts
 * export function activate(api: ExcelExtensionAPI) {
 *   api.registerCommand("snake", {
 *     description: "Play Snake!",
 *     handler: (args) => {
 *       api.overlay.show(createSnakeGame(api.overlay));
 *     },
 *   });
 * }
 * ```
 */

import type { Agent, AgentEvent } from "@mariozechner/pi-agent-core";

import {
  ALLOW_REMOTE_EXTENSION_URLS_STORAGE_KEY,
  classifyExtensionSource,
  isRemoteExtensionOptIn,
} from "./extension-source-policy.js";
import { commandRegistry } from "./types.js";
import { isRecord } from "../utils/type-guards.js";

export interface ExtensionCommand {
  description: string;
  handler: (args: string) => void | Promise<void>;
}

export interface OverlayAPI {
  /** Show an HTML element as a full-screen overlay */
  show(el: HTMLElement): void;
  /** Remove the overlay */
  dismiss(): void;
}

export interface WidgetAPI {
  /** Show an HTML element as an inline widget above the input area */
  show(el: HTMLElement): void;
  /** Remove the widget */
  dismiss(): void;
}

export interface ExcelExtensionAPI {
  /** Register a slash command */
  registerCommand(name: string, cmd: ExtensionCommand): void;
  /** Access the agent */
  agent: Agent;
  /** Show/dismiss full-screen overlay UI */
  overlay: OverlayAPI;
  /** Show/dismiss inline widget above input (messages still visible above) */
  widget: WidgetAPI;
  /** Show a toast notification */
  toast(message: string): void;
  /** Subscribe to agent events */
  onAgentEvent(handler: (ev: AgentEvent) => void): () => void;
}

/** Create the extension API for a given agent instance */
export function createExtensionAPI(agent: Agent): ExcelExtensionAPI {
  return {
    registerCommand(name: string, cmd: ExtensionCommand) {
      commandRegistry.register({
        name,
        description: cmd.description,
        source: "extension",
        execute: cmd.handler,
      });
    },

    agent,

    overlay: {
      show(el: HTMLElement) {
        let container = document.getElementById("pi-ext-overlay");
        if (!container) {
          container = document.createElement("div");
          container.id = "pi-ext-overlay";
          container.className = "pi-welcome-overlay";
          container.style.zIndex = "250";
          document.body.appendChild(container);
        }
        container.innerHTML = "";
        container.appendChild(el);
        container.style.display = "flex";

        // ESC to dismiss
        const handler = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            this.dismiss();
            document.removeEventListener("keydown", handler);
          }
        };
        document.addEventListener("keydown", handler);
      },

      dismiss() {
        const container = document.getElementById("pi-ext-overlay");
        if (container) {
          container.style.display = "none";
          container.innerHTML = "";
        }
      },
    },

    widget: {
      show(el: HTMLElement) {
        let slot = document.getElementById("pi-widget-slot");
        if (!slot) {
          // Fallback: insert before .pi-input-area inside the sidebar
          const inputArea = document.querySelector(".pi-input-area");
          if (inputArea) {
            slot = document.createElement("div");
            slot.id = "pi-widget-slot";
            slot.className = "pi-widget-slot";
            const parent = inputArea.parentElement;
            if (!parent) {
              console.warn("[pi] No widget slot parent found");
              return;
            }
            parent.insertBefore(slot, inputArea);
          } else {
            console.warn("[pi] No widget slot or input area found");
            return;
          }
        }
        slot.innerHTML = "";
        slot.appendChild(el);
        slot.style.display = "block";
      },

      dismiss() {
        const slot = document.getElementById("pi-widget-slot");
        if (slot) {
          slot.style.display = "none";
          slot.innerHTML = "";
        }
      },
    },

    toast(message: string) {
      let toast = document.getElementById("pi-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "pi-toast";
        toast.className = "pi-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("visible");
      const toastEl = toast;
      setTimeout(() => toastEl.classList.remove("visible"), 2000);
    },

    onAgentEvent(handler: (ev: AgentEvent) => void) {
      return agent.subscribe(handler);
    },
  };
}

type ExtensionActivator = (api: ExcelExtensionAPI) => void | Promise<void>;

function isExtensionActivator(value: unknown): value is ExtensionActivator {
  return typeof value === "function";
}

function getRemoteExtensionOptInFromStorage(): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    const raw = localStorage.getItem(ALLOW_REMOTE_EXTENSION_URLS_STORAGE_KEY);
    return isRemoteExtensionOptIn(raw);
  } catch {
    return false;
  }
}

function getExtensionActivator(mod: unknown): ExtensionActivator | null {
  if (!isRecord(mod)) return null;

  const activate = mod.activate;
  if (isExtensionActivator(activate)) {
    return activate;
  }

  const fallback = mod.default;
  if (isExtensionActivator(fallback)) {
    return fallback;
  }

  return null;
}

/**
 * Load and activate an extension from an inline function or module specifier.
 *
 * Security default: remote http(s) module URLs are blocked unless the user
 * explicitly opts in by setting localStorage key
 * `pi.allowRemoteExtensionUrls` to `1` or `true`.
 */
export async function loadExtension(
  api: ExcelExtensionAPI,
  source: string | ((api: ExcelExtensionAPI) => void | Promise<void>),
): Promise<void> {
  if (typeof source === "function") {
    await source(api);
    return;
  }

  const specifier = source.trim();
  const sourceKind = classifyExtensionSource(specifier);

  if (sourceKind === "unsupported") {
    throw new Error(
      `Unsupported extension source "${specifier}". Only local module specifiers (./, ../, /) are allowed by default.`,
    );
  }

  if (sourceKind === "remote-url" && !getRemoteExtensionOptInFromStorage()) {
    throw new Error(
      "Remote extension URL imports are disabled by default. " +
      `Set localStorage['${ALLOW_REMOTE_EXTENSION_URLS_STORAGE_KEY}']='1' to opt in (unsafe).`,
    );
  }

  if (sourceKind === "remote-url") {
    console.warn(`[pi] WARNING: loading remote extension URL due to explicit opt-in: ${specifier}`);
  }

  const activate = getExtensionActivator(await import(/* @vite-ignore */ specifier));
  if (!activate) {
    throw new Error(`Extension module "${specifier}" must export an activate(api) function`);
  }

  await activate(api);
}
