/**
 * Session title helpers for tab labels and close/reopen toasts.
 */

export interface ResolveTabTitleArgs {
  hasExplicitTitle: boolean;
  sessionTitle: string;
  /** Zero-based tab index in current runtime order. */
  tabIndex: number;
}

function normalizeTabNumber(tabIndex: number): number {
  if (!Number.isFinite(tabIndex) || tabIndex < 0) {
    return 1;
  }

  return Math.floor(tabIndex) + 1;
}

export function resolveTabTitle(args: ResolveTabTitleArgs): string {
  if (args.hasExplicitTitle) {
    const trimmed = args.sessionTitle.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return `Chat ${normalizeTabNumber(args.tabIndex)}`;
}
