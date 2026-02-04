/**
 * Workbook blueprint — structural overview injected at session start.
 *
 * Re-uses buildOverview() from the get_workbook_overview tool but
 * wraps it for context injection.
 */

import { buildOverview } from "../tools/get-workbook-overview.js";

let cachedBlueprint: string | null = null;

/** Get the workbook blueprint (cached after first build). */
export async function getBlueprint(): Promise<string> {
  if (!cachedBlueprint) {
    cachedBlueprint = await buildOverview();
  }
  return cachedBlueprint;
}

/** Force a fresh blueprint rebuild (e.g. after structural changes). */
export async function refreshBlueprint(): Promise<string> {
  cachedBlueprint = null;
  return getBlueprint();
}

/** Invalidate the cached blueprint. */
export function invalidateBlueprint(): void {
  cachedBlueprint = null;
}
