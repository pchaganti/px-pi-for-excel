/**
 * Security policy for extension module sources.
 *
 * Keep this intentionally small:
 * - local module specifiers are allowed by default
 * - remote http(s) URLs are blocked by default
 * - an explicit localStorage opt-in can temporarily re-enable remote URLs
 */

const LOCAL_SPECIFIER_PREFIXES = ["./", "../", "/"];
const REMOTE_PROTOCOLS = new Set(["http:", "https:"]);

export const ALLOW_REMOTE_EXTENSION_URLS_STORAGE_KEY = "pi.allowRemoteExtensionUrls";

export type ExtensionSourceKind = "local-module" | "remote-url" | "unsupported";

/**
 * Classify a string extension source into local/remote/unsupported.
 */
export function classifyExtensionSource(source: string): ExtensionSourceKind {
  const specifier = source.trim();
  if (specifier.length === 0) return "unsupported";

  for (const prefix of LOCAL_SPECIFIER_PREFIXES) {
    if (specifier.startsWith(prefix)) return "local-module";
  }

  let parsed: URL;
  try {
    parsed = new URL(specifier);
  } catch {
    return "unsupported";
  }

  return REMOTE_PROTOCOLS.has(parsed.protocol) ? "remote-url" : "unsupported";
}

/**
 * Parse an explicit unsafe opt-in flag for remote extension URLs.
 */
export function isRemoteExtensionOptIn(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}
