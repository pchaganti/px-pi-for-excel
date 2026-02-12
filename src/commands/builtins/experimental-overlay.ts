/**
 * Experimental features overlay.
 */

import {
  getExperimentalFeatureSnapshots,
  isExperimentalFeatureEnabled,
  setExperimentalFeatureEnabled,
  type ExperimentalFeatureSnapshot,
} from "../../experiments/flags.js";
import { installOverlayEscapeClose } from "../../ui/overlay-escape.js";
import { showToast } from "../../ui/toast.js";

const OVERLAY_ID = "pi-experimental-overlay";
const overlayClosers = new WeakMap<HTMLElement, () => void>();

function applyStatusVisual(statusEl: HTMLSpanElement, enabled: boolean): void {
  statusEl.textContent = enabled ? "Enabled" : "Disabled";
  statusEl.classList.toggle("is-enabled", enabled);
}

function applyToggleButtonVisual(button: HTMLButtonElement, enabled: boolean): void {
  button.textContent = enabled ? "Disable" : "Enable";
  button.classList.toggle("is-enabled", enabled);
}

function buildFeatureRow(feature: ExperimentalFeatureSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "pi-experimental-row";

  const header = document.createElement("div");
  header.className = "pi-experimental-row__header";

  const title = document.createElement("div");
  title.className = "pi-experimental-row__title";
  title.textContent = feature.title;

  const status = document.createElement("span");
  status.className = "pi-experimental-row__status";

  header.append(title, status);

  const description = document.createElement("div");
  description.className = "pi-experimental-row__description";
  description.textContent = feature.description;

  const meta = document.createElement("div");
  meta.className = "pi-experimental-row__meta";

  const commandHint = document.createElement("code");
  commandHint.className = "pi-experimental-row__command";
  commandHint.textContent = `/experimental toggle ${feature.slug}`;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "pi-overlay-btn pi-experimental-row__toggle";

  meta.append(commandHint, toggleBtn);

  const warning = document.createElement("div");
  warning.className = "pi-experimental-row__warning";
  warning.textContent = feature.warning ?? "";
  warning.hidden = !feature.warning;

  const readiness = document.createElement("div");
  readiness.className = "pi-experimental-row__readiness";
  readiness.textContent =
    feature.wiring === "wired"
      ? "Ready now"
      : "Flag only for now — this capability is planned but not wired yet.";

  const applyState = (enabled: boolean): void => {
    applyStatusVisual(status, enabled);
    applyToggleButtonVisual(toggleBtn, enabled);
  };

  toggleBtn.addEventListener("click", () => {
    const next = !isExperimentalFeatureEnabled(feature.id);
    setExperimentalFeatureEnabled(feature.id, next);
    applyState(next);

    const suffix = feature.wiring === "flag-only"
      ? " (flag saved; feature not wired yet)"
      : "";
    showToast(`${feature.title}: ${next ? "enabled" : "disabled"}${suffix}`);
  });

  applyState(feature.enabled);
  row.append(header, description, meta, warning, readiness);
  return row;
}

export function showExperimentalDialog(): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    const closeExisting = overlayClosers.get(existing);
    if (closeExisting) {
      closeExisting();
    } else {
      existing.remove();
    }

    return;
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "pi-welcome-overlay";

  const card = document.createElement("div");
  card.className = "pi-welcome-card pi-overlay-card pi-experimental-card";

  const title = document.createElement("h2");
  title.className = "pi-overlay-title";
  title.textContent = "Experimental Features";

  const subtitle = document.createElement("p");
  subtitle.className = "pi-overlay-subtitle";
  subtitle.textContent =
    "These toggles are local to this browser profile. Use carefully — some are security-sensitive.";

  const list = document.createElement("div");
  list.className = "pi-experimental-list";

  for (const feature of getExperimentalFeatureSnapshots()) {
    list.appendChild(buildFeatureRow(feature));
  }

  const footer = document.createElement("p");
  footer.className = "pi-experimental-footer";
  footer.textContent =
    "Tip: use /experimental on <feature>, /experimental off <feature>, /experimental toggle <feature>, /experimental tmux-bridge-url <url>, /experimental tmux-bridge-token <token>, /experimental tmux-status, /experimental python-bridge-url <url>, or /experimental python-bridge-token <token>.";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "pi-overlay-btn pi-overlay-btn--ghost pi-overlay-btn--full";
  closeBtn.textContent = "Close";

  let closed = false;
  const closeOverlay = () => {
    if (closed) {
      return;
    }

    closed = true;
    overlayClosers.delete(overlay);
    cleanupEscape();
    overlay.remove();
  };
  const cleanupEscape = installOverlayEscapeClose(overlay, closeOverlay);
  overlayClosers.set(overlay, closeOverlay);

  closeBtn.addEventListener("click", () => {
    closeOverlay();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  card.append(title, subtitle, list, footer, closeBtn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
