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
import { showToast } from "../../ui/toast.js";
import { formatWorkbookLabel, getWorkbookContext } from "../../workbook/context.js";

type InstructionsTab = "user" | "workbook";

function setActiveInstructionsTab(
  tabButtons: Record<InstructionsTab, HTMLButtonElement>,
  activeTab: InstructionsTab,
): void {
  const tabs: InstructionsTab[] = ["user", "workbook"];

  for (const tab of tabs) {
    const button = tabButtons[tab];
    if (!button) continue;

    if (tab === activeTab) {
      button.style.background = "oklch(0.45 0.12 160 / 0.12)";
      button.style.color = "var(--foreground)";
      button.style.borderColor = "oklch(0.45 0.12 160 / 0.28)";
    } else {
      button.style.background = "oklch(0 0 0 / 0.04)";
      button.style.color = "var(--muted-foreground)";
      button.style.borderColor = "oklch(0 0 0 / 0.08)";
    }
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
    existing.remove();
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
  card.className = "pi-welcome-card";
  card.style.cssText = "text-align: left; width: min(520px, 92vw); max-height: 82vh;";

  const title = document.createElement("h2");
  title.style.cssText = "font-size: 16px; font-weight: 600; margin: 0 0 12px; font-family: var(--font-sans);";
  title.textContent = "Instructions";

  const tabs = document.createElement("div");
  tabs.style.cssText = "display: flex; gap: 8px; margin-bottom: 10px;";

  const userTab = document.createElement("button");
  userTab.type = "button";
  userTab.textContent = "My Instructions";
  userTab.style.cssText =
    "padding: 6px 10px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.04); cursor: pointer; font-size: 12px; font-family: var(--font-sans);";

  const workbookTab = document.createElement("button");
  workbookTab.type = "button";
  workbookTab.textContent = "Workbook";
  workbookTab.style.cssText =
    "padding: 6px 10px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.04); cursor: pointer; font-size: 12px; font-family: var(--font-sans);";

  tabs.append(userTab, workbookTab);

  const workbookTag = document.createElement("div");
  workbookTag.style.cssText =
    "font-size: 11px; color: var(--muted-foreground); margin: -4px 0 8px; font-family: var(--font-mono);";
  workbookTag.textContent = `Workbook: ${workbookLabel}`;

  const textarea = document.createElement("textarea");
  textarea.style.cssText =
    "width: 100%; min-height: 220px; max-height: 42vh; resize: vertical; border: 1px solid oklch(0 0 0 / 0.12); border-radius: 10px; padding: 10px 12px; font-family: var(--font-sans); font-size: 13px; line-height: 1.45; background: oklch(1 0 0 / 0.70); color: var(--foreground); outline: none;";
  textarea.placeholder = "Your preferences and habits, e.g.\n• Always use EUR for currencies\n• Format dates as dd-mmm-yyyy\n• Check circular references after writes";

  const footer = document.createElement("div");
  footer.style.cssText = "margin-top: 10px; display: flex; flex-direction: column; gap: 6px;";

  const counter = document.createElement("div");
  counter.style.cssText = "font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono);";

  const hint = document.createElement("div");
  hint.style.cssText = "font-size: 11px; color: var(--muted-foreground); line-height: 1.4;";

  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText =
    "padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.12); background: oklch(0 0 0 / 0.04); cursor: pointer; font-size: 12px;";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.style.cssText =
    "padding: 7px 12px; border-radius: 8px; border: none; background: var(--pi-green); color: white; cursor: pointer; font-size: 12px; font-weight: 600;";

  actions.append(cancelBtn, saveBtn);
  footer.append(counter, hint, actions);
  card.append(title, tabs, workbookTag, textarea, footer);
  overlay.appendChild(card);

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
      counter.style.color = count > USER_INSTRUCTIONS_SOFT_LIMIT
        ? "var(--destructive, #e5484d)"
        : "var(--muted-foreground)";

      hint.textContent =
        "Private to your machine. These apply to all workbooks and can be updated automatically when you express preferences.";
      workbookTag.style.display = "none";
      return;
    }

    textarea.value = workbookDraft;
    textarea.placeholder =
      "Notes about this workbook's structure, e.g.\n• DCF model for Acme Corp, FY2025\n• Revenue assumptions in Inputs!B5:B15\n• Don't modify the Summary sheet";

    const count = workbookDraft.length;
    counter.textContent = formatCounterLabel(count, WORKBOOK_INSTRUCTIONS_SOFT_LIMIT);
    counter.style.color = count > WORKBOOK_INSTRUCTIONS_SOFT_LIMIT
      ? "var(--destructive, #e5484d)"
      : "var(--muted-foreground)";

    if (!workbookId) {
      hint.textContent =
        "Workbook identity is unavailable right now, so workbook instructions can't be saved for this file.";
    } else {
      hint.textContent =
        "Saved for this workbook on this machine. The assistant should ask before adding workbook-level notes.";
    }

    workbookTag.style.display = "block";
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
    overlay.remove();
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

      showToast("Instructions saved");
      overlay.remove();
    })();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  refreshTabUi();
  document.body.appendChild(overlay);
  textarea.focus();
}
