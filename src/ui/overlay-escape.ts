/**
 * Helper to make overlay dialogs Esc-dismissible and mark them as
 * Escape owners so streaming Esc abort is suppressed while open.
 */
export function installOverlayEscapeClose(
  overlay: HTMLElement,
  closeOverlay: () => void,
): () => void {
  overlay.dataset.claimsEscape = "true";

  if (typeof document === "undefined") {
    return () => {
      delete overlay.dataset.claimsEscape;
    };
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!overlay.isConnected) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeOverlay();
  };

  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    delete overlay.dataset.claimsEscape;
    document.removeEventListener("keydown", onKeyDown, true);
  };
}
