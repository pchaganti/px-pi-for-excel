import type { Context, Tool } from "@mariozechner/pi-ai";

import { type CoreToolName, CORE_TOOL_NAMES } from "../tools/names.js";
import {
  TOOL_DISCLOSURE_BUNDLES,
  TOOL_DISCLOSURE_FULL_ACCESS_PATTERNS,
  TOOL_DISCLOSURE_TRIGGER_BUNDLE_ORDER,
  TOOL_DISCLOSURE_TRIGGER_PATTERNS,
  type ToolDisclosureBundleId,
} from "../tools/capabilities.js";

export type ToolBundleId = ToolDisclosureBundleId;

type ActiveToolBundleId = Exclude<ToolBundleId, "none">;
type TriggeredToolBundleId = Exclude<ToolBundleId, "none" | "core" | "full">;
type UserMessage = Extract<Context["messages"][number], { role: "user" }>;

const CORE_TOOL_NAME_SET = new Set<string>(CORE_TOOL_NAMES);

function isCoreToolName(name: string): name is CoreToolName {
  return CORE_TOOL_NAME_SET.has(name);
}

function hasOnlyCoreTools(tools: readonly Tool[]): boolean {
  for (const tool of tools) {
    if (!isCoreToolName(tool.name)) return false;
  }
  return true;
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractUserText(content: UserMessage["content"]): string {
  if (typeof content === "string") return content;

  const textParts: string[] = [];
  for (const item of content) {
    if (item.type === "text") {
      textParts.push(item.text);
    }
  }

  return textParts.join(" ");
}

function getLastUserPrompt(messages: Context["messages"]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;

    const text = extractUserText(message.content).trim();
    if (text.length === 0) continue;

    if (text.startsWith("[Auto-context]")) continue;
    return text.toLowerCase();
  }

  return null;
}

function chooseBundle(prompt: string): ActiveToolBundleId {
  if (matchesAny(prompt, TOOL_DISCLOSURE_FULL_ACCESS_PATTERNS)) return "full";

  const matchedBundles: TriggeredToolBundleId[] = [];

  for (const bundleId of TOOL_DISCLOSURE_TRIGGER_BUNDLE_ORDER) {
    if (matchesAny(prompt, TOOL_DISCLOSURE_TRIGGER_PATTERNS[bundleId])) {
      matchedBundles.push(bundleId);
    }
  }

  // Mixed-intent requests (e.g. "insert a row and highlight it") need tools
  // across categories. Fall back to full for the first call so continuation
  // stripping doesn't block capabilities in the same turn.
  if (matchedBundles.length > 1) return "full";
  if (matchedBundles.length === 1) return matchedBundles[0];
  return "core";
}

function filterToolsByBundle(tools: readonly Tool[], bundleId: ActiveToolBundleId): Tool[] {
  if (bundleId === "full") return [...tools];

  const allowed = new Set<string>(TOOL_DISCLOSURE_BUNDLES[bundleId]);
  const filtered = tools.filter((tool) => allowed.has(tool.name));
  return filtered.length > 0 ? filtered : [...tools];
}

export interface ToolDisclosureResult {
  tools: Context["tools"];
  bundleId: ToolBundleId;
}

/**
 * Select a deterministic tool bundle for the current call.
 *
 * Rules:
 * - Only applies to the core built-in tool set.
 * - If extension/non-core tools are present, keep full tool visibility.
 * - Selection is based on the latest non-auto user prompt.
 */
export function selectToolBundle(context: Context): ToolDisclosureResult {
  if (!context.tools || context.tools.length === 0) {
    return { tools: context.tools, bundleId: "none" };
  }

  if (!hasOnlyCoreTools(context.tools)) {
    return { tools: context.tools, bundleId: "full" };
  }

  const prompt = getLastUserPrompt(context.messages);
  const bundleId = prompt ? chooseBundle(prompt) : "core";
  const tools = filterToolsByBundle(context.tools, bundleId);
  return { tools, bundleId };
}
