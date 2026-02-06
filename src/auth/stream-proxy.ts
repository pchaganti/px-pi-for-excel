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
 * Create a StreamFn compatible with Agent that proxies provider base URLs when needed.
 */
export function createOfficeStreamFn(getProxyUrl: GetProxyUrl) {
  return async (model: Model<Api>, context: Context, options?: StreamOptions) => {
    const proxyUrl = await getProxyUrl();
    if (!proxyUrl) {
      return streamSimple(model, context, options);
    }

    if (!shouldProxyProvider(model.provider, options?.apiKey)) {
      return streamSimple(model, context, options);
    }

    // Guardrails: fail fast for known-bad proxy configs (e.g., HTTP proxy from HTTPS taskpane).
    const validated = validateOfficeProxyUrl(proxyUrl);

    return streamSimple(applyProxy(model, validated), context, options);
  };
}
