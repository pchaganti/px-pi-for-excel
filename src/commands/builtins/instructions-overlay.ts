/**
 * Instructions editor overlay.
 */

import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import {
  getUserInstructions,
  getWorkbookInstructions,
  setUserInstructions,
  setWorkbookInstructions,
  USER_INSTRUCTIONS_SOFT_LIMIT,
  WORKBOOK_INSTRUCTIONS_SOFT_LIMIT,
} from "../../instructions/store.js";
import { requestChatInputFocus } from "../../ui/input-focus.js";
import { installOverlayEscapeClose } from "../../ui/overlay-escape.js";
import { showToast } from "../../ui/toast.js";
import { formatWorkbookLabel, getWorkbookContext } from "../../workbook/context.js";

type InstructionsTab = "user" | "workbook";

const overlayClosers = new WeakMap<HTMLElement, () => void>();

function setActiveInstructionsTab(
  tabButtons: Record<InstructionsTab, HTMLButtonElement>,
  activeTab: InstructionsTab,
): void {
  const tabs: InstructionsTab[] = ["user", "workbook"];

  for (const tab of tabs) {
    const button = tabButtons[tab];
    if (!button) continue;

    const isActive = tab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  }
}

function formatCounterLabel(chars: number, limit: number): string {
  return `${chars.toLocaleString()} / ${limit.toLocaleString()} chars`;
}

export async function showInstructionsDialog(opts?: {
  onSaved?: () => void | Promise<void>;
}): Promise<void> {
  const existing = document.getElementById("pi-instructions-overlay");
  if (existing) {
    const closeExisting = overlayClosers.get(existing);
    if (closeExisting) {
      closeExisting();
    } else {
      existing.remove();
    }

    return;
  }

  const storage = getAppStorage();
  const workbookContext = await getWorkbookContext();
  const workbookId = workbookContext.workbookId;
  const workbookLabel = formatWorkbookLabel(workbookContext);

  let userDraft = (await getUserInstructions(storage.settings)) ?? "";
  let workbookDraft = (await getWorkbookInstructions(storage.settings, workbookId)) ?? "";
  let activeTab: InstructionsTab = "user";

  const overlay = document.createElement("div");
  overlay.id = "pi-instructions-overlay";
  overlay.className = "pi-welcome-overlay";

  const card = document.createElement("div");
  card.className = "pi-welcome-card pi-overlay-card";

  const title = document.createElement("h2");
  title.className = "pi-overlay-title";
  title.textContent = "Rules";

  const tabs = document.createElement("div");
  tabs.className = "pi-overlay-tabs";
  tabs.setAttribute("role", "tablist");

  const userTab = document.createElement("button");
  userTab.type = "button";
  userTab.textContent = "All my files";
  userTab.className = "pi-overlay-tab";
  userTab.setAttribute("role", "tab");

  const workbookTab = document.createElement("button");
  workbookTab.type = "button";
  workbookTab.textContent = "This file";
  workbookTab.className = "pi-overlay-tab";
  workbookTab.setAttribute("role", "tab");

  tabs.append(userTab, workbookTab);

  const workbookTag = document.createElement("div");
  workbookTag.className = "pi-overlay-workbook-tag";
  workbookTag.textContent = `Workbook: ${workbookLabel}`;

  const textarea = document.createElement("textarea");
  textarea.className = "pi-overlay-textarea";
  textarea.placeholder = "Your preferences and habits, e.g.\n• Always use EUR for currencies\n• Format dates as dd-mmm-yyyy\n• Check circular references after writes";

  const footer = document.createElement("div");
  footer.className = "pi-overlay-footer";

  const counter = document.createElement("div");
  counter.className = "pi-overlay-counter";

  const hint = document.createElement("div");
  hint.className = "pi-overlay-hint";

  const actions = document.createElement("div");
  actions.className = "pi-overlay-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "pi-overlay-btn pi-overlay-btn--ghost";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.className = "pi-overlay-btn pi-overlay-btn--primary";

  actions.append(cancelBtn, saveBtn);
  footer.append(counter, actions);
  card.append(title, tabs, workbookTag, hint, textarea, footer);
  overlay.appendChild(card);

  let closed = false;
  const closeOverlay = () => {
    if (closed) {
      return;
    }

    closed = true;
    overlayClosers.delete(overlay);
    cleanupEscape();
    overlay.remove();
    requestChatInputFocus();
  };
  const cleanupEscape = installOverlayEscapeClose(overlay, closeOverlay);
  overlayClosers.set(overlay, closeOverlay);

  const tabButtons: Record<InstructionsTab, HTMLButtonElement> = {
    user: userTab,
    workbook: workbookTab,
  };

  const refreshTabUi = () => {
    setActiveInstructionsTab(tabButtons, activeTab);

    if (activeTab === "user") {
      textarea.value = userDraft;
      textarea.placeholder =
        "Your preferences and habits, e.g.\n• Always use EUR for currencies\n• Format dates as dd-mmm-yyyy\n• Check circular references after writes";

      const count = userDraft.length;
      counter.textContent = formatCounterLabel(count, USER_INSTRUCTIONS_SOFT_LIMIT);
      counter.classList.toggle("is-warning", count > USER_INSTRUCTIONS_SOFT_LIMIT);

      hint.textContent =
        "Guidance given to Pi in all your conversations. Pi can also update these when you tell it your preferences — e.g. \"always use EUR\".";
      workbookTag.hidden = true;
      return;
    }

    textarea.value = workbookDraft;
    textarea.placeholder =
      "Notes about this workbook's structure, e.g.\n• DCF model for Acme Corp, FY2025\n• Revenue assumptions in Inputs!B5:B15\n• Don't modify the Summary sheet";

    const count = workbookDraft.length;
    counter.textContent = formatCounterLabel(count, WORKBOOK_INSTRUCTIONS_SOFT_LIMIT);
    counter.classList.toggle("is-warning", count > WORKBOOK_INSTRUCTIONS_SOFT_LIMIT);

    if (!workbookId) {
      hint.textContent =
        "Can't identify this workbook right now — try saving the file first.";
    } else {
      hint.textContent =
        "Guidance given to Pi only when it reads this file.";
    }

    workbookTag.hidden = false;
  };

  const saveActiveDraft = () => {
    if (activeTab === "user") {
      userDraft = textarea.value;
      return;
    }

    workbookDraft = textarea.value;
  };

  userTab.addEventListener("click", () => {
    saveActiveDraft();
    activeTab = "user";
    refreshTabUi();
  });

  workbookTab.addEventListener("click", () => {
    saveActiveDraft();
    activeTab = "workbook";
    refreshTabUi();
  });

  textarea.addEventListener("input", () => {
    saveActiveDraft();
    refreshTabUi();
  });

  cancelBtn.addEventListener("click", () => {
    closeOverlay();
  });

  saveBtn.addEventListener("click", () => {
    void (async () => {
      saveActiveDraft();

      await setUserInstructions(storage.settings, userDraft);
      if (workbookId) {
        await setWorkbookInstructions(storage.settings, workbookId, workbookDraft);
      }

      document.dispatchEvent(new CustomEvent("pi:instructions-updated"));
      document.dispatchEvent(new CustomEvent("pi:status-update"));

      if (opts?.onSaved) {
        await opts.onSaved();
      }

      showToast("Rules saved");
      closeOverlay();
    })();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  refreshTabUi();
  document.body.appendChild(overlay);
  textarea.focus();
}
