/**
 * Office taskpanes run in a browser webview.
 *
 * Many LLM providers (and especially subscription / OAuth-based flows) either:
 * - block browser requests via CORS, or
 * - require the "anthropic-dangerous-direct-browser-access" header, which some orgs disable.
 *
 * We route requests through a user-configured local CORS proxy when enabled.
 */

import { streamSimple, type Api, type Context, type Model, type StreamOptions } from "@mariozechner/pi-ai";

import { isDebugEnabled } from "../debug/debug.js";
import { normalizeProxyUrl, validateOfficeProxyUrl } from "./proxy-validation.js";

export type GetProxyUrl = () => Promise<string | undefined>;

function shouldProxyProvider(provider: string, apiKey?: string): boolean {
  const p = provider.toLowerCase();

  switch (p) {
    // Known to require proxy in browser webviews (CORS blocked)
    case "openai-codex":
      return true;

    // Anthropic OAuth tokens are blocked by CORS; some orgs also block direct browser access.
    // We proxy OAuth tokens (sk-ant-oat-*) unconditionally.
    case "anthropic":
      return typeof apiKey === "string" && apiKey.startsWith("sk-ant-oat");

    // Z-AI always requires proxy (matches pi-web-ui default)
    case "zai":
      return true;

    default:
      return false;
  }
}

function applyProxy(model: Model<Api>, proxyUrl: string): Model<Api> {
  if (!model.baseUrl) return model;
  if (!/^https?:\/\//i.test(model.baseUrl)) return model;

  const normalizedProxy = normalizeProxyUrl(proxyUrl);

  // Avoid double-proxying
  if (model.baseUrl.startsWith(`${normalizedProxy}/?url=`)) return model;

  return {
    ...model,
    baseUrl: `${normalizedProxy}/?url=${encodeURIComponent(model.baseUrl)}`,
  };
}

/**
 * Should tool schemas be included in this LLM call?
 *
 * We only send tools on the first call after a user message.
 * Tool-result continuations (the model processing results from a previous
 * round of tool calls) get no tool schemas — the model must respond with
 * text, not chain further tool calls.
 *
 * This keeps tool definitions (~8.7K chars) out of follow-up calls,
 * reducing context pollution. Multi-step tasks still work because the
 * model can issue parallel tool calls in a single response, and the user
 * can confirm between rounds.
 *
 * See: https://github.com/tmustier/pi-for-excel/issues/14
 */
function isToolContinuation(messages: Context["messages"]): boolean {
  if (messages.length === 0) return false;
  const last = messages[messages.length - 1];
  return last.role === "toolResult";
}

// ---------------------------------------------------------------------------
// Payload stats — lightweight counters for debug pill in status bar.
// ---------------------------------------------------------------------------

export interface PayloadStats {
  /** LLM calls since last reset (= turn count within an agent run). */
  calls: number;
  /** Chars of system prompt on last call. */
  systemChars: number;
  /** Chars of tool schemas (compact JSON) on last call, 0 if stripped. */
  toolSchemaChars: number;
  /** Number of tool definitions on last call, 0 if stripped. */
  toolCount: number;
  /** Number of messages on last call. */
  messageCount: number;
  /** Total chars of all messages (JSON-serialized) on last call. */
  messageChars: number;
}

const stats: PayloadStats = {
  calls: 0, systemChars: 0, toolSchemaChars: 0, toolCount: 0, messageCount: 0, messageChars: 0,
};

/** Snapshot of the last LLM context (only kept when debug is on). */
let lastContext: Context | undefined;

export function getPayloadStats(): Readonly<PayloadStats> {
  return stats;
}

export function getLastContext(): Context | undefined {
  return lastContext;
}

export function resetPayloadStats(): void {
  stats.calls = 0;
  stats.systemChars = 0;
  stats.toolSchemaChars = 0;
  stats.toolCount = 0;
  stats.messageCount = 0;
  stats.messageChars = 0;
  lastContext = undefined;
}

function recordCall(context: Context): void {
  stats.calls += 1;
  stats.systemChars = context.systemPrompt?.length ?? 0;
  stats.messageCount = context.messages.length;

  let msgChars = 0;
  for (const m of context.messages) msgChars += JSON.stringify(m).length;
  stats.messageChars = msgChars;

  if (context.tools) {
    stats.toolCount = context.tools.length;
    let chars = 0;
    for (const t of context.tools) chars += JSON.stringify(t).length;
    stats.toolSchemaChars = chars;
  } else {
    stats.toolCount = 0;
    stats.toolSchemaChars = 0;
  }

  if (isDebugEnabled()) {
    lastContext = context;
  }

  document.dispatchEvent(new Event("pi:status-update"));
}

/**
 * Create a StreamFn compatible with Agent that proxies provider base URLs when needed.
 */
export function createOfficeStreamFn(getProxyUrl: GetProxyUrl) {
  return async (model: Model<Api>, context: Context, options?: StreamOptions) => {
    // Strip tools on tool-result continuations (see #14).
    const effectiveContext = isToolContinuation(context.messages)
      ? { ...context, tools: undefined }
      : context;

    recordCall(effectiveContext);

    const proxyUrl = await getProxyUrl();
    if (!proxyUrl) {
      return streamSimple(model, effectiveContext, options);
    }

    if (!shouldProxyProvider(model.provider, options?.apiKey)) {
      return streamSimple(model, effectiveContext, options);
    }

    // Guardrails: fail fast for known-bad proxy configs (e.g., HTTP proxy from HTTPS taskpane).
    const validated = validateOfficeProxyUrl(proxyUrl);

    return streamSimple(applyProxy(model, validated), effectiveContext, options);
  };
}
