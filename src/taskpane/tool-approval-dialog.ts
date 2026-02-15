import {
  closeOverlayById,
  createOverlayButton,
  createOverlayDialog,
  createOverlayHeader,
} from "../ui/overlay-dialog.js";
import { TOOL_APPROVAL_OVERLAY_ID } from "../ui/overlay-ids.js";

const CONFIRMATION_UI_UNAVAILABLE_ERROR =
  "Tool execution requires explicit user approval, but confirmation UI is unavailable.";

type ConfirmButtonTone = "primary" | "danger";

export interface ToolApprovalDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonTone?: ConfirmButtonTone;
}

function tryWindowConfirm(message: string): boolean | null {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return null;
  }

  try {
    return window.confirm(message);
  } catch {
    return null;
  }
}

function canRenderToolApprovalDialog(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.body instanceof HTMLElement;
}

function getConfirmButtonClassName(tone: ConfirmButtonTone | undefined): string {
  return tone === "danger" ? "pi-overlay-btn--danger" : "pi-overlay-btn--primary";
}

export function requestToolApprovalDialog(options: ToolApprovalDialogOptions): Promise<boolean> {
  if (!canRenderToolApprovalDialog()) {
    const fallbackResult = tryWindowConfirm(options.message);
    if (fallbackResult === null) {
      return Promise.reject(new Error(CONFIRMATION_UI_UNAVAILABLE_ERROR));
    }

    return Promise.resolve(fallbackResult);
  }

  closeOverlayById(TOOL_APPROVAL_OVERLAY_ID);

  return new Promise((resolve) => {
    const dialog = createOverlayDialog({
      overlayId: TOOL_APPROVAL_OVERLAY_ID,
      cardClassName: "pi-welcome-card pi-overlay-card pi-overlay-card--s",
    });

    let settled = false;

    const settle = (approved: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(approved);
    };

    const cancel = (): void => {
      settle(false);
      dialog.close();
    };

    const approve = (): void => {
      settle(true);
      dialog.close();
    };

    const { header } = createOverlayHeader({
      onClose: cancel,
      closeLabel: options.cancelLabel ?? "Cancel approval",
      title: options.title,
    });

    const body = document.createElement("div");
    body.className = "pi-overlay-body";

    const message = document.createElement("p");
    message.className = "pi-overlay-subtitle";
    message.textContent = options.message;
    message.style.marginBottom = "0";
    message.style.whiteSpace = "pre-wrap";

    const actions = document.createElement("div");
    actions.className = "pi-overlay-actions";

    const cancelButton = createOverlayButton({
      text: options.cancelLabel ?? "Cancel",
    });

    const approveButton = createOverlayButton({
      text: options.confirmLabel ?? "Allow",
      className: getConfirmButtonClassName(options.confirmButtonTone),
    });

    cancelButton.addEventListener("click", cancel);
    approveButton.addEventListener("click", approve);

    dialog.addCleanup(() => {
      cancelButton.removeEventListener("click", cancel);
      approveButton.removeEventListener("click", approve);

      settle(false);
    });

    actions.append(cancelButton, approveButton);
    body.appendChild(message);
    dialog.card.append(header, body, actions);
    dialog.mount();
  });
}
