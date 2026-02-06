/**
 * Proxy URL validation for Office taskpanes.
 *
 * Office add-ins are served over HTTPS. Some Office webviews (notably WKWebView on macOS)
 * will block calls to an HTTP proxy from an HTTPS taskpane (mixed content), surfacing as
 * "Load failed" / "Connection error".
 */

export function normalizeProxyUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function validateOfficeProxyUrl(url: string): string {
  const normalized = normalizeProxyUrl(url);

  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error(
      `Invalid Proxy URL: "${url}". Expected a full URL like https://localhost:3003`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      `Invalid Proxy URL: "${url}". Expected a full URL like https://localhost:3003`,
    );
  }

  // Mixed content guardrail: HTTPS taskpane -> HTTP proxy.
  // This tends to fail in Office webviews (macOS), so fail fast with guidance.
  if (typeof window !== "undefined" && window.location?.protocol === "https:" && parsed.protocol === "http:") {
    throw new Error(
      `Proxy URL is HTTP (${normalized}) but the add-in is served over HTTPS. Office webviews may block this as mixed content. ` +
        `Use https://localhost:<port> and start the proxy with \"npm run proxy:https\".`,
    );
  }

  return normalized;
}
