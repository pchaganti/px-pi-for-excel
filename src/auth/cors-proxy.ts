/**
 * Fetch interceptor — rewrites external API URLs to local Vite proxy paths
 * and strips browser-identifying headers that trigger CORS rejections.
 *
 * Install once at boot time. All subsequent fetch() calls are intercepted.
 */

const PROXY_REWRITES: [string, string][] = [
  // OAuth token endpoints
  ["https://console.anthropic.com/", "/oauth-proxy/anthropic/"],
  ["https://github.com/", "/oauth-proxy/github/"],
  ["https://auth.openai.com/", "/api-proxy/openai-auth/"],
  ["https://oauth2.googleapis.com/", "/api-proxy/google-oauth/"],
  // API endpoints
  ["https://api.anthropic.com/", "/api-proxy/anthropic/"],
  ["https://api.openai.com/", "/api-proxy/openai/"],
  ["https://chatgpt.com/", "/api-proxy/chatgpt/"],
  ["https://generativelanguage.googleapis.com/", "/api-proxy/google/"],
];

/** The original, un-patched fetch — use for requests that should bypass the proxy */
export let originalFetch: typeof window.fetch;

/**
 * Install the fetch interceptor. Call once at boot.
 * Rewrites matching URLs to local proxy paths and strips
 * the anthropic-dangerous-direct-browser-access header.
 */
export function installFetchInterceptor(): void {
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    let proxied = false;
    for (const [prefix, proxy] of PROXY_REWRITES) {
      if (url.startsWith(prefix)) {
        url = url.replace(prefix, proxy);
        proxied = true;
        break;
      }
    }

    if (proxied) {
      const headers = new Headers(init?.headers);
      headers.delete("anthropic-dangerous-direct-browser-access");
      const newInit = { ...init, headers };

      if (typeof input !== "string" && !(input instanceof URL) && input instanceof Request) {
        const newHeaders = new Headers(input.headers);
        newHeaders.delete("anthropic-dangerous-direct-browser-access");
        input = new Request(url, { ...input, headers: newHeaders });
      } else {
        input = url;
      }
      return originalFetch(input, newInit);
    }

    return originalFetch(input, init);
  };
}
