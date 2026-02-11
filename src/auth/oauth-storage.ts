/**
 * OAuth credential persistence for in-browser OAuth flows.
 *
 * Historically we persisted OAuth credentials in localStorage (oauth_<providerId>).
 * We now prefer IndexedDB via SettingsStore to keep persistence in one backend and
 * remove ad-hoc localStorage reads/writes from UI paths.
 *
 * Security note: this is storage hygiene, not an XSS boundary. Same-origin script
 * execution can read both localStorage and IndexedDB.
 */

import type { OAuthCredentials } from "@mariozechner/pi-ai";
import type { SettingsStore } from "@mariozechner/pi-web-ui/dist/storage/stores/settings-store.js";

import { isRecord } from "../utils/type-guards.js";

export function isOAuthCredentials(value: unknown): value is OAuthCredentials {
  return (
    isRecord(value) &&
    typeof value.refresh === "string" &&
    typeof value.access === "string" &&
    typeof value.expires === "number"
  );
}

function oauthSettingsKey(providerId: string): string {
  return `oauth.${providerId}`;
}

function oauthLocalStorageKey(providerId: string): string {
  return `oauth_${providerId}`;
}

/**
 * Load OAuth credentials from IndexedDB settings. If missing, attempt to read the
 * legacy localStorage key and migrate it into settings.
 */
export async function loadOAuthCredentials(
  settings: SettingsStore,
  providerId: string,
): Promise<OAuthCredentials | null> {
  // 1) Preferred: IndexedDB settings
  try {
    const stored: unknown = await settings.get(oauthSettingsKey(providerId));
    if (isOAuthCredentials(stored)) return stored;
  } catch {
    // ignore
  }

  // 2) Legacy: localStorage (migrate if possible)
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(oauthLocalStorageKey(providerId));
  } catch {
    raw = null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isOAuthCredentials(parsed)) return null;

    // Best-effort migration.
    try {
      await settings.set(oauthSettingsKey(providerId), parsed);
      try {
        localStorage.removeItem(oauthLocalStorageKey(providerId));
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function saveOAuthCredentials(
  settings: SettingsStore,
  providerId: string,
  credentials: OAuthCredentials,
): Promise<void> {
  await settings.set(oauthSettingsKey(providerId), credentials);

  // Best-effort cleanup of legacy storage.
  try {
    localStorage.removeItem(oauthLocalStorageKey(providerId));
  } catch {
    // ignore
  }
}

export async function clearOAuthCredentials(
  settings: SettingsStore,
  providerId: string,
): Promise<void> {
  await settings.delete(oauthSettingsKey(providerId));

  try {
    localStorage.removeItem(oauthLocalStorageKey(providerId));
  } catch {
    // ignore
  }
}
