/**
 * Builtin command overlays (provider picker, resume, shortcuts).
 */

import type { SessionData, SessionMetadata } from "@mariozechner/pi-web-ui/dist/storage/types.js";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import {
  getCrossWorkbookResumeConfirmMessage,
  getResumeTargetLabel,
  type ResumeDialogTarget,
} from "./resume-target.js";
import { showToast } from "../../ui/toast.js";
import { formatWorkbookLabel, getWorkbookContext } from "../../workbook/context.js";
import {
  getSessionWorkbookId,
  partitionSessionIdsByWorkbook,
} from "../../workbook/session-association.js";

export { showInstructionsDialog } from "./instructions-overlay.js";

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.round(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export async function showProviderPicker(): Promise<void> {
  const existing = document.getElementById("pi-login-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const { ALL_PROVIDERS, buildProviderRow } = await import("../../ui/provider-login.js");
  const storage = getAppStorage();
  const configuredKeys = await storage.providerKeys.list();
  const configuredSet = new Set(configuredKeys);

  const overlay = document.createElement("div");
  overlay.id = "pi-login-overlay";
  overlay.className = "pi-welcome-overlay";

  overlay.innerHTML = `
    <div class="pi-welcome-card" style="text-align: left; max-width: 340px;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 4px; font-family: var(--font-sans);">Providers</h2>
      <p style="font-size: 12px; color: var(--muted-foreground); margin: 0 0 12px; font-family: var(--font-sans);">Connect providers to use their models.</p>
      <div class="pi-login-providers" style="display: flex; flex-direction: column; gap: 4px;"></div>
    </div>
  `;

  const list = overlay.querySelector<HTMLDivElement>(".pi-login-providers");
  if (!list) {
    throw new Error("Provider list container not found");
  }

  const expandedRef: { current: HTMLElement | null } = { current: null };

  for (const provider of ALL_PROVIDERS) {
    const isActive = configuredSet.has(provider.id);
    const row = buildProviderRow(provider, {
      isActive,
      expandedRef,
      onConnected: (_row: HTMLElement, _id: string, label: string) => {
        document.dispatchEvent(new CustomEvent("pi:providers-changed"));
        showToast(`${label} connected`);
      },
      onDisconnected: (_row: HTMLElement, _id: string, label: string) => {
        document.dispatchEvent(new CustomEvent("pi:providers-changed"));
        showToast(`${label} disconnected`);
      },
    });
    list.appendChild(row);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

function buildResumeListItem(session: SessionMetadata): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "pi-welcome-provider pi-resume-item";
  btn.dataset.id = session.id;
  btn.style.cssText = "display: flex; flex-direction: column; align-items: flex-start; gap: 2px;";

  const title = document.createElement("span");
  title.style.cssText = "font-size: 13px; font-weight: 500;";
  title.textContent = session.title || "Untitled";

  const meta = document.createElement("span");
  meta.style.cssText = "font-size: 11px; color: var(--muted-foreground);";
  meta.textContent = `${session.messageCount || 0} messages · ${formatRelativeDate(session.lastModified)}`;

  btn.append(title, meta);
  return btn;
}

function buildWorkbookFilterRow(opts: {
  workbookLabel: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}): HTMLElement {
  const row = document.createElement("label");
  row.style.cssText =
    "display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted-foreground); margin: 0 0 10px; user-select: none;";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = opts.checked;

  const labelText = document.createElement("span");
  labelText.textContent = "Show sessions from all workbooks";

  const workbookHint = document.createElement("span");
  workbookHint.style.cssText = "font-family: var(--font-mono); opacity: 0.7; margin-left: auto;";
  workbookHint.textContent = opts.workbookLabel;

  checkbox.addEventListener("change", () => {
    opts.onToggle(checkbox.checked);
  });

  row.append(checkbox, labelText, workbookHint);
  return row;
}

export async function showResumeDialog(opts: {
  defaultTarget?: ResumeDialogTarget;
  onOpenInNewTab: (sessionData: SessionData) => Promise<void>;
  onReplaceCurrent: (sessionData: SessionData) => Promise<void>;
}): Promise<void> {
  const storage = getAppStorage();
  const allSessions = await storage.sessions.getAllMetadata();

  if (allSessions.length === 0) {
    showToast("No previous sessions");
    return;
  }

  const existing = document.getElementById("pi-resume-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const workbookCtx = await getWorkbookContext();
  const workbookId = workbookCtx.workbookId;
  const workbookLabel = formatWorkbookLabel(workbookCtx);
  const metadataById = new Map(allSessions.map((s) => [s.id, s]));

  let defaultSessionIds = allSessions.map((s) => s.id);
  if (workbookId) {
    const partition = await partitionSessionIdsByWorkbook(
      storage.settings,
      allSessions.map((s) => s.id),
      workbookId,
    );
    defaultSessionIds = [...partition.matchingSessionIds, ...partition.unlinkedSessionIds];
  }

  let showAllWorkbooks = workbookId === null;
  let selectedTarget: ResumeDialogTarget = opts.defaultTarget ?? "new_tab";

  const overlay = document.createElement("div");
  overlay.id = "pi-resume-overlay";
  overlay.className = "pi-welcome-overlay";

  const card = document.createElement("div");
  card.className = "pi-welcome-card";
  card.style.cssText =
    "text-align: left; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;";

  const title = document.createElement("h2");
  title.style.cssText =
    "font-size: 16px; font-weight: 600; margin: 0 0 12px; font-family: var(--font-sans); flex-shrink: 0;";
  title.textContent = "Resume Session";

  card.appendChild(title);

  const targetControls = document.createElement("div");
  targetControls.style.cssText = "display: flex; gap: 6px; margin: 0 0 8px;";

  const openInNewTabButton = document.createElement("button");
  openInNewTabButton.type = "button";
  openInNewTabButton.style.cssText =
    "padding: 6px 10px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.02); cursor: pointer; font-size: 12px; font-family: var(--font-sans);";
  openInNewTabButton.textContent = "Open in new tab";

  const replaceCurrentButton = document.createElement("button");
  replaceCurrentButton.type = "button";
  replaceCurrentButton.style.cssText =
    "padding: 6px 10px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.02); cursor: pointer; font-size: 12px; font-family: var(--font-sans);";
  replaceCurrentButton.textContent = "Replace current";

  const targetHint = document.createElement("div");
  targetHint.style.cssText = "font-size: 11px; color: var(--muted-foreground); margin: 0 0 10px;";

  const syncTargetButtons = () => {
    const isNewTab = selectedTarget === "new_tab";

    openInNewTabButton.style.background = isNewTab
      ? "oklch(0.57 0.15 165 / 0.16)"
      : "oklch(0 0 0 / 0.02)";
    openInNewTabButton.style.borderColor = isNewTab
      ? "oklch(0.57 0.15 165 / 0.45)"
      : "oklch(0 0 0 / 0.08)";

    replaceCurrentButton.style.background = !isNewTab
      ? "oklch(0.57 0.15 165 / 0.16)"
      : "oklch(0 0 0 / 0.02)";
    replaceCurrentButton.style.borderColor = !isNewTab
      ? "oklch(0.57 0.15 165 / 0.45)"
      : "oklch(0 0 0 / 0.08)";

    openInNewTabButton.setAttribute("aria-pressed", String(isNewTab));
    replaceCurrentButton.setAttribute("aria-pressed", String(!isNewTab));
    targetHint.textContent = `Default action: ${getResumeTargetLabel(selectedTarget)}`;
  };

  openInNewTabButton.addEventListener("click", () => {
    selectedTarget = "new_tab";
    syncTargetButtons();
  });

  replaceCurrentButton.addEventListener("click", () => {
    selectedTarget = "replace_current";
    syncTargetButtons();
  });

  targetControls.append(openInNewTabButton, replaceCurrentButton);
  card.append(targetControls, targetHint);
  syncTargetButtons();

  const list = document.createElement("div");
  list.className = "pi-resume-list";
  list.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 4px;";

  if (workbookId) {
    card.appendChild(
      buildWorkbookFilterRow({
        workbookLabel,
        checked: showAllWorkbooks,
        onToggle(checked) {
          showAllWorkbooks = checked;
          renderList();
        },
      }),
    );
  }

  card.appendChild(list);
  overlay.appendChild(card);

  function getVisibleSessions(): SessionMetadata[] {
    if (showAllWorkbooks || workbookId === null) {
      return allSessions;
    }

    const visible: SessionMetadata[] = [];
    for (const sessionId of defaultSessionIds) {
      const metadata = metadataById.get(sessionId);
      if (metadata) visible.push(metadata);
    }
    return visible;
  }

  function renderList(): void {
    const sessions = getVisibleSessions().slice(0, 30);

    list.replaceChildren();

    if (sessions.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "font-size: 12px; color: var(--muted-foreground); padding: 10px 2px;";
      empty.textContent = "No sessions available for this workbook.";
      list.appendChild(empty);
      return;
    }

    for (const session of sessions) {
      list.appendChild(buildResumeListItem(session));
    }
  }

  renderList();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      return;
    }

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const item = target.closest<HTMLElement>(".pi-resume-item");
    if (!item) return;

    const id = item.dataset.id;
    if (!id) return;

    void (async () => {
      const targetMode = selectedTarget;

      if (workbookId) {
        const linkedWorkbookId = await getSessionWorkbookId(storage.settings, id);
        if (linkedWorkbookId && linkedWorkbookId !== workbookId) {
          const proceed = window.confirm(getCrossWorkbookResumeConfirmMessage(targetMode));
          if (!proceed) return;
        }
      }

      const sessionData = await storage.sessions.loadSession(id);
      if (!sessionData) {
        showToast("Session not found");
        overlay.remove();
        return;
      }

      if (targetMode === "replace_current") {
        await opts.onReplaceCurrent(sessionData);
      } else {
        await opts.onOpenInNewTab(sessionData);
      }

      overlay.remove();
      const resumedMode = targetMode === "replace_current" ? "current tab" : "new tab";
      showToast(`Resumed in ${resumedMode}: ${sessionData.title || "Untitled"}`);
    })();
  });

  document.body.appendChild(overlay);
}

export function showShortcutsDialog(): void {
  const shortcuts = [
    ["Enter", "Send message"],
    ["Shift+Tab", "Cycle thinking level"],
    ["Esc", "Dismiss menu/dialog (or abort if none open)"],
    ["Enter (streaming)", "Steer — redirect agent"],
    ["⌥Enter", "Queue follow-up message"],
    ["/", "Open command menu"],
    ["↑↓", "Navigate command menu"],
    ["⌘/Ctrl+⇧T", "Reopen last closed tab"],
    ["F6", "Focus: Sheet ↔ Sidebar"],
    ["⇧F6", "Focus: reverse direction"],
  ];

  const existing = document.getElementById("pi-shortcuts-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "pi-shortcuts-overlay";
  overlay.className = "pi-welcome-overlay";
  overlay.innerHTML = `
    <div class="pi-welcome-card" style="text-align: left;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; font-family: var(--font-sans);">Keyboard Shortcuts</h2>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${shortcuts
          .map(
            ([key, desc]) => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <kbd style="font-family: var(--font-mono); font-size: 11px; padding: 2px 6px; background: oklch(0 0 0 / 0.05); border-radius: 4px; white-space: nowrap;">${key}</kbd>
            <span style="font-size: 12.5px; color: var(--muted-foreground); font-family: var(--font-sans);">${desc}</span>
          </div>
        `,
          )
          .join("")}
      </div>
      <button onclick="this.closest('.pi-welcome-overlay').remove()" style="margin-top: 16px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.03); cursor: pointer; font-family: var(--font-sans); font-size: 13px;">Close</button>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}
