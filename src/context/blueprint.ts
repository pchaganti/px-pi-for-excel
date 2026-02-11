/**
 * Workbook blueprint — structural overview injected into model context.
 *
 * Re-uses buildOverview() from the get_workbook_overview tool but
 * wraps it with workbook-aware caching and invalidation signals.
 */

import { getWorkbookContext } from "../workbook/context.js";
import { buildOverview } from "../tools/get-workbook-overview.js";

interface BlueprintCacheEntry {
  workbookId: string | null;
  blueprint: string;
}

let cachedBlueprint: BlueprintCacheEntry | null = null;
let blueprintRevision = 0;

function bumpBlueprintRevision(): void {
  blueprintRevision += 1;
}

async function resolveWorkbookId(): Promise<string | null> {
  try {
    const ctx = await getWorkbookContext();
    return ctx.workbookId;
  } catch {
    return null;
  }
}

/**
 * Monotonic revision token for blueprint cache changes.
 *
 * Intended for context injection logic: if this value changes, workbook
 * structure context should be considered stale and re-evaluated.
 */
export function getBlueprintRevision(): number {
  return blueprintRevision;
}

/** Get the workbook blueprint (cached per workbook identity when available). */
export async function getBlueprint(): Promise<string> {
  const workbookId = await resolveWorkbookId();

  if (cachedBlueprint && cachedBlueprint.workbookId === workbookId) {
    return cachedBlueprint.blueprint;
  }

  const blueprint = await buildOverview();
  cachedBlueprint = {
    workbookId,
    blueprint,
  };
  bumpBlueprintRevision();
  return blueprint;
}

/** Force a fresh blueprint rebuild (e.g. after structural changes). */
export async function refreshBlueprint(): Promise<string> {
  // Keep invalidate behavior centralized so revision signaling stays consistent.
  invalidateBlueprint();
  return getBlueprint();
}

/** Invalidate the cached blueprint. */
export function invalidateBlueprint(): void {
  cachedBlueprint = null;
  bumpBlueprintRevision();
}
