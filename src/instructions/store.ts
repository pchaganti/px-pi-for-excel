/**
 * Persistent agent instructions storage.
 *
 * We store two scopes:
 * - user-level instructions (global to this install)
 * - workbook-level instructions (scoped by workbook identity)
 */

export const USER_INSTRUCTIONS_SOFT_LIMIT = 2_000;
export const WORKBOOK_INSTRUCTIONS_SOFT_LIMIT = 4_000;

const USER_INSTRUCTIONS_KEY = "user.instructions";
const WORKBOOK_INSTRUCTIONS_PREFIX = "workbook.instructions.v1.";

export type InstructionLevel = "user" | "workbook";
export type InstructionAction = "append" | "replace";

export interface InstructionsStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

function normalizeStoredText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDraftText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function workbookInstructionsKey(workbookId: string): string {
  return `${WORKBOOK_INSTRUCTIONS_PREFIX}${workbookId}`;
}

export async function getUserInstructions(store: InstructionsStore): Promise<string | null> {
  const value = await store.get(USER_INSTRUCTIONS_KEY);
  return normalizeStoredText(value);
}

export async function setUserInstructions(
  store: InstructionsStore,
  nextValue: string | null,
): Promise<string | null> {
  const normalized = nextValue === null ? null : normalizeDraftText(nextValue);
  await store.set(USER_INSTRUCTIONS_KEY, normalized ?? "");
  return normalized;
}

export async function getWorkbookInstructions(
  store: InstructionsStore,
  workbookId: string | null,
): Promise<string | null> {
  if (!workbookId) return null;

  const value = await store.get(workbookInstructionsKey(workbookId));
  return normalizeStoredText(value);
}

export async function setWorkbookInstructions(
  store: InstructionsStore,
  workbookId: string,
  nextValue: string | null,
): Promise<string | null> {
  const normalized = nextValue === null ? null : normalizeDraftText(nextValue);
  await store.set(workbookInstructionsKey(workbookId), normalized ?? "");
  return normalized;
}

export function applyInstructionAction(args: {
  currentValue: string | null;
  action: InstructionAction;
  content: string;
}): string | null {
  const current = normalizeStoredText(args.currentValue);

  if (args.action === "replace") {
    return normalizeDraftText(args.content);
  }

  const addition = normalizeDraftText(args.content);
  if (!addition) {
    throw new Error("content is required for append");
  }

  if (!current) return addition;
  return `${current}\n${addition}`;
}

export function hasAnyInstructions(values: {
  userInstructions: string | null;
  workbookInstructions: string | null;
}): boolean {
  return Boolean(values.userInstructions || values.workbookInstructions);
}
