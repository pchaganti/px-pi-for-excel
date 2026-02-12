/**
 * Keyboard shortcuts + key-driven UX.
 *
 * Extracted from taskpane.ts to keep the entrypoint thin.
 */

import type { Agent, AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import { supportsXhigh } from "@mariozechner/pi-ai";

import type { PiSidebar } from "../ui/pi-sidebar.js";
import { moveCursorToEnd } from "../ui/input-focus.js";
import { showToast } from "../ui/toast.js";

import { doesOverlayClaimEscape } from "../utils/escape-guard.js";
import { blurTextEntryTarget, isTextEntryTarget } from "../utils/text-entry.js";
import { commandRegistry } from "../commands/types.js";
import {
  handleCommandMenuKey,
  hideCommandMenu,
  isCommandMenuVisible,
} from "../commands/command-menu.js";

import { flashThinkingLevel, updateStatusBarForAgent } from "./status-bar.js";

type QueueDisplay = {
  add: (type: "steer" | "follow-up", text: string) => void;
};

type ActionQueue = {
  enqueueCommand: (name: string, args: string) => void;
  isBusy: () => boolean;
};

interface ReopenShortcutEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface FocusInputShortcutEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface AdjacentTabShortcutEventLike {
  key: string;
  code?: string;
  keyCode?: number;
  repeat: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const THINKING_COLORS: Record<ThinkingLevel, string> = {
  off: "#a0a0a0",
  minimal: "#767676",
  low: "#4488cc",
  medium: "#22998a",
  high: "#875f87",
  xhigh: "#8b008b",
};

const BUSY_ALLOWED_COMMANDS = new Set(["compact", "new", "resume", "reopen"]);

function setExcelToolCardsExpanded(expanded: boolean): void {
  const toolMessages = document.querySelectorAll("tool-message");

  for (const toolMessage of toolMessages) {
    const body = toolMessage.querySelector<HTMLElement>(".pi-tool-card__body");
    if (!body) continue;

    if (expanded) {
      body.classList.remove("max-h-0");
      body.classList.add("max-h-[2000px]", "mt-3");
    } else {
      body.classList.remove("max-h-[2000px]", "mt-3");
      body.classList.add("max-h-0");
    }

    const up = toolMessage.querySelector<HTMLElement>(".chevron-up");
    const down = toolMessage.querySelector<HTMLElement>(".chevrons-up-down");
    if (!up || !down) continue;

    if (expanded) {
      up.classList.remove("hidden");
      down.classList.add("hidden");
    } else {
      up.classList.add("hidden");
      down.classList.remove("hidden");
    }
  }
}

function collapseThinkingBlocks(): void {
  const blocks = document.querySelectorAll("thinking-block");
  for (const block of blocks) {
    // When expanded, ThinkingBlock renders a markdown-block for its body.
    const isExpanded = Boolean(block.querySelector("markdown-block"));
    if (!isExpanded) continue;

    const header = block.querySelector<HTMLElement>(".thinking-header");
    header?.click();
  }
}

function expandThinkingBlocks(): void {
  const blocks = document.querySelectorAll("thinking-block");
  for (const block of blocks) {
    const isExpanded = Boolean(block.querySelector("markdown-block"));
    if (isExpanded) continue;

    const header = block.querySelector<HTMLElement>(".thinking-header");
    header?.click();
  }
}

export function getThinkingLevels(agent: Agent): ThinkingLevel[] {
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

export function cycleThinkingLevel(agent: Agent): ThinkingLevel {
  const levels = getThinkingLevels(agent);
  const current = agent.state.thinkingLevel;
  const idx = levels.indexOf(current);
  const next = levels[(idx >= 0 ? idx + 1 : 0) % levels.length];

  agent.setThinkingLevel(next);
  updateStatusBarForAgent(agent);
  flashThinkingLevel(next, THINKING_COLORS[next] || "#a0a0a0");

  return next;
}

export function isReopenLastClosedShortcut(event: ReopenShortcutEventLike): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (!event.shiftKey || event.altKey) return false;

  return event.key.toLowerCase() === "t";
}

export function isFocusInputShortcut(event: FocusInputShortcutEventLike): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  return event.key === "F2";
}

export function getAdjacentTabDirectionFromShortcut(
  event: AdjacentTabShortcutEventLike,
): -1 | 1 | null {
  if (event.repeat) return null;

  const key = event.key;
  const code = event.code;
  const keyCode = event.keyCode;

  // Fallback chords for hosts that swallow plain arrow keys.
  if (event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey) {
    if (key === "[") return -1;
    if (key === "]") return 1;
    return null;
  }

  if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    if (key === "PageUp") return -1;
    if (key === "PageDown") return 1;
  }

  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;

  if (key === "ArrowLeft" || key === "Left" || code === "ArrowLeft" || keyCode === 37) {
    return -1;
  }

  if (key === "ArrowRight" || key === "Right" || code === "ArrowRight" || keyCode === 39) {
    return 1;
  }

  return null;
}

export function shouldBlurEditorFromEscape(opts: {
  key: string;
  isInEditor: boolean;
  isStreaming: boolean;
}): boolean {
  if (opts.key !== "Escape" && opts.key !== "Esc") return false;
  if (!opts.isInEditor) return false;
  if (opts.isStreaming) return false;
  return true;
}

export function shouldAbortFromEscape(opts: {
  isStreaming: boolean;
  hasAgent: boolean;
  escapeClaimedByOverlay: boolean;
}): boolean {
  if (!opts.isStreaming) return false;
  if (!opts.hasAgent) return false;
  if (opts.escapeClaimedByOverlay) return false;
  return true;
}

export function installKeyboardShortcuts(opts: {
  getActiveAgent: () => Agent | null;
  getActiveQueueDisplay: () => QueueDisplay | null;
  getActiveActionQueue: () => ActionQueue | null;
  sidebar: PiSidebar;
  markUserAborted: (agent: Agent) => void;
  onReopenLastClosed?: () => void;
  onSwitchAdjacentTab?: (direction: -1 | 1) => void;
}): () => void {
  const {
    getActiveAgent,
    getActiveQueueDisplay,
    getActiveActionQueue,
    sidebar,
    markUserAborted,
    onReopenLastClosed,
    onSwitchAdjacentTab,
  } = opts;

  const onKeyDown = (e: KeyboardEvent) => {
    // Command menu takes priority
    if (isCommandMenuVisible()) {
      if (handleCommandMenuKey(e)) return;
    }

    const agent = getActiveAgent();
    const textarea = sidebar.getTextarea();
    const eventTarget = e.target instanceof Node ? e.target : null;
    const keyTarget = eventTarget ?? (document.activeElement instanceof Node ? document.activeElement : null);
    const isInEditor = Boolean(
      textarea && keyTarget && (keyTarget === textarea || textarea.contains(keyTarget)),
    );
    const isStreaming = agent?.state.isStreaming ?? false;

    // F2 — focus chat input
    if (isFocusInputShortcut(e)) {
      const input = sidebar.getInput();
      if (!input) return;

      e.preventDefault();
      e.stopPropagation();
      input.focus();

      const activeTextarea = sidebar.getTextarea();
      if (activeTextarea) {
        moveCursorToEnd(activeTextarea);
      }

      return;
    }

    // ESC — dismiss command menu
    if (e.key === "Escape" && isCommandMenuVisible()) {
      e.preventDefault();
      hideCommandMenu();
      return;
    }

    const isEscapeKey = e.key === "Escape" || e.key === "Esc";
    const escapeClaimedByOverlay = isEscapeKey && doesOverlayClaimEscape(keyTarget);

    // ESC — leave editor focus (when not streaming)
    if (
      shouldBlurEditorFromEscape({
        key: e.key,
        isInEditor,
        isStreaming,
      })
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const blurred = blurTextEntryTarget(keyTarget);
      if (blurred) {
        requestAnimationFrame(() => {
          sidebar.focusTabNavigationAnchor();
        });
      }
      return;
    }

    // ESC — abort (only when no overlay/dialog is claiming Escape)
    if (
      isEscapeKey
      && shouldAbortFromEscape({
        isStreaming,
        hasAgent: agent !== null,
        escapeClaimedByOverlay,
      })
      && agent
    ) {
      e.preventDefault();
      markUserAborted(agent);
      agent.abort();
      return;
    }

    // Cmd/Ctrl+Shift+T — reopen last closed tab/session
    if (isReopenLastClosedShortcut(e)) {
      if (!onReopenLastClosed) return;
      e.preventDefault();
      onReopenLastClosed();
      return;
    }

    // ←/→ — switch tabs when editor is not focused
    const adjacentTabDirection = getAdjacentTabDirectionFromShortcut(e);
    if (
      adjacentTabDirection
      && onSwitchAdjacentTab
      && !isTextEntryTarget(keyTarget)
    ) {
      e.preventDefault();
      onSwitchAdjacentTab(adjacentTabDirection);
      return;
    }

    // Shift+Tab — cycle thinking level
    if (e.shiftKey && e.key === "Tab") {
      if (!agent) return;
      e.preventDefault();
      cycleThinkingLevel(agent);
      return;
    }

    // Ctrl+O — toggle thinking/tool visibility
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      const collapsed = document.body.classList.toggle("pi-hide-internals");

      // Collapse/expand tool cards to match the new mode.
      requestAnimationFrame(() => setExcelToolCardsExpanded(!collapsed));

      // Collapse/expand thinking blocks to match the new mode.
      requestAnimationFrame(() =>
        collapsed ? collapseThinkingBlocks() : expandThinkingBlocks(),
      );

      showToast(collapsed ? "Details hidden (⌃O)" : "Details shown (⌃O)", 1500);
      return;
    }

    // Slash command execution
    if (
      isInEditor &&
      textarea &&
      e.key === "Enter" &&
      !e.shiftKey &&
      textarea.value.startsWith("/")
    ) {
      const val = textarea.value.trim();
      const spaceIdx = val.indexOf(" ");
      const cmdName = spaceIdx > 0 ? val.slice(1, spaceIdx) : val.slice(1);
      const args = spaceIdx > 0 ? val.slice(spaceIdx + 1) : "";
      const cmd = commandRegistry.get(cmdName);
      if (cmd) {
        const actionQueue = getActiveActionQueue();
        const busy = isStreaming || actionQueue?.isBusy() === true;

        if (busy && !BUSY_ALLOWED_COMMANDS.has(cmdName)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showToast(`Can't run /${cmdName} while Pi is busy`);
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();
        hideCommandMenu();
        const input = sidebar.getInput();
        if (input) input.clear();

        if (cmdName === "compact") {
          if (!actionQueue) {
            showToast("No active session");
            return;
          }
          actionQueue.enqueueCommand(cmdName, args);
        } else {
          void cmd.execute(args);
        }

        return;
      }
    }

    // Enter/Alt+Enter while streaming — steer or follow-up
    if (isInEditor && textarea && e.key === "Enter" && !e.shiftKey && isStreaming && agent) {
      const text = textarea.value.trim();
      if (!text) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const msg: AgentMessage = {
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };

      if (e.altKey) {
        agent.followUp(msg);
        getActiveQueueDisplay()?.add("follow-up", text);
      } else {
        agent.steer(msg);
        getActiveQueueDisplay()?.add("steer", text);
      }

      const input = sidebar.getInput();
      if (input) input.clear();
      return;
    }
  };

  document.addEventListener("keydown", onKeyDown, true);
  return () => document.removeEventListener("keydown", onKeyDown, true);
}
