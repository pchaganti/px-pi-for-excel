/**
 * Shared toast helper used across taskpane and commands.
 */

interface ToastElements {
  root: HTMLDivElement;
  message: HTMLSpanElement;
  action: HTMLButtonElement;
}

interface ActionToastOptions {
  message: string;
  actionLabel: string;
  onAction: () => void;
  duration?: number;
}

let toastElements: ToastElements | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function clearHideTimer(): void {
  if (hideTimer === null) return;
  clearTimeout(hideTimer);
  hideTimer = null;
}

function ensureToastElements(): ToastElements {
  if (toastElements) {
    return toastElements;
  }

  const root = document.createElement("div");
  root.id = "pi-toast";
  root.className = "pi-toast";

  const content = document.createElement("div");
  content.className = "pi-toast__content";

  const message = document.createElement("span");
  message.className = "pi-toast__message";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "pi-toast__action";
  action.hidden = true;

  content.append(message, action);
  root.appendChild(content);
  document.body.appendChild(root);

  toastElements = { root, message, action };
  return toastElements;
}

function scheduleHide(duration: number): void {
  clearHideTimer();
  hideTimer = setTimeout(() => {
    const elements = toastElements;
    if (!elements) return;
    elements.root.classList.remove("visible");
    elements.root.classList.remove("pi-toast--action");
    elements.action.hidden = true;
    elements.action.onclick = null;
  }, Math.max(0, duration));
}

function renderToast(opts: {
  message: string;
  duration: number;
  action?: {
    label: string;
    onAction: () => void;
  };
}): void {
  const elements = ensureToastElements();
  elements.message.textContent = opts.message;

  if (opts.action) {
    elements.root.classList.add("pi-toast--action");
    elements.action.hidden = false;
    elements.action.textContent = opts.action.label;
    elements.action.onclick = () => {
      opts.action?.onAction();
      elements.root.classList.remove("visible");
      elements.root.classList.remove("pi-toast--action");
      elements.action.hidden = true;
      elements.action.onclick = null;
      clearHideTimer();
    };
  } else {
    elements.root.classList.remove("pi-toast--action");
    elements.action.hidden = true;
    elements.action.onclick = null;
  }

  elements.root.classList.add("visible");
  scheduleHide(opts.duration);
}

export function showToast(message: string, duration = 2000): void {
  renderToast({ message, duration });
}

export function showActionToast(opts: ActionToastOptions): void {
  renderToast({
    message: opts.message,
    duration: opts.duration ?? 9000,
    action: {
      label: opts.actionLabel,
      onAction: opts.onAction,
    },
  });
}
