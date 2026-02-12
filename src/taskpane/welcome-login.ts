/**
 * Welcome/login overlay shown when no providers are configured.
 */

import type { ProviderKeysStore } from "@mariozechner/pi-web-ui/dist/storage/stores/provider-keys-store.js";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import { installOverlayEscapeClose } from "../ui/overlay-escape.js";
import { showToast } from "../ui/toast.js";
import { setActiveProviders } from "../compat/model-selector-patch.js";

async function testLocalHttpsProxy(proxyUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const url = `${proxyUrl.replace(/\/+$/, "")}/?url=${encodeURIComponent("https://example.com")}`;
    const resp = await fetch(url, { signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function showWelcomeLogin(providerKeys: ProviderKeysStore): Promise<void> {
  const { ALL_PROVIDERS, buildProviderRow } = await import("../ui/provider-login.js");

  // Make Anthropic OAuth usable even before the user can access /settings.
  // Prefer 3003 (3001 is commonly occupied by other local services).
  try {
    const storage = getAppStorage();
    const enabled = await storage.settings.get("proxy.enabled");
    const url = await storage.settings.get("proxy.url");

    const preferred = "https://localhost:3003";
    const currentUrl = typeof url === "string" && url.trim().length > 0 ? url.trim() : preferred;

    if (url === null) {
      await storage.settings.set("proxy.url", currentUrl);
    }

    // Auto-enable if a local HTTPS proxy is actually reachable.
    if (!enabled) {
      const ok = await testLocalHttpsProxy(currentUrl);
      if (ok) {
        await storage.settings.set("proxy.enabled", true);
      }
    }
  } catch {
    // ignore — welcome overlay should still show
  }

  return new Promise<void>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pi-welcome-overlay";

    let closed = false;
    const closeOverlay = () => {
      if (closed) {
        return;
      }

      closed = true;
      cleanupEscape();
      overlay.remove();
      resolve();
    };
    const cleanupEscape = installOverlayEscapeClose(overlay, closeOverlay);
    overlay.innerHTML = `
      <div class="pi-welcome-card" style="text-align: left;">
        <div class="pi-welcome-logo" style="text-align: center;">π</div>
        <h2 class="pi-welcome-title" style="text-align: center;">Pi for Excel</h2>
        <p class="pi-welcome-subtitle" style="text-align: center;">Connect a provider to get started</p>

        <div class="pi-welcome-proxy">
          <div class="pi-welcome-proxy__row">
            <div class="pi-welcome-proxy__title">Local HTTPS proxy</div>
            <label class="pi-welcome-proxy__toggle">
              <input type="checkbox" class="pi-welcome-proxy__enabled" />
              <span>Enabled</span>
            </label>
          </div>
          <div class="pi-welcome-proxy__row" style="gap: 8px;">
            <input class="pi-welcome-proxy__url" type="text" spellcheck="false" />
            <button class="pi-welcome-proxy__save" type="button">Save</button>
          </div>
          <div class="pi-welcome-proxy__hint">Required for Anthropic OAuth in Excel. Start the proxy with <code>npm run proxy:https</code>.</div>
        </div>

        <div class="pi-welcome-providers"></div>
      </div>
    `;

    const providerList = overlay.querySelector<HTMLDivElement>(".pi-welcome-providers");
    if (!providerList) {
      throw new Error("Welcome provider list not found");
    }

    const proxyEnabledEl = overlay.querySelector<HTMLInputElement>(".pi-welcome-proxy__enabled");
    const proxyUrlEl = overlay.querySelector<HTMLInputElement>(".pi-welcome-proxy__url");
    const proxySaveEl = overlay.querySelector<HTMLButtonElement>(".pi-welcome-proxy__save");

    const hydrateProxyUi = async () => {
      if (!proxyEnabledEl || !proxyUrlEl || !proxySaveEl) return;
      try {
        const storage = getAppStorage();
        const enabled = await storage.settings.get("proxy.enabled");
        const url = await storage.settings.get("proxy.url");
        proxyEnabledEl.checked = Boolean(enabled);
        proxyUrlEl.value = typeof url === "string" && url.trim().length > 0 ? url.trim() : "https://localhost:3003";
      } catch {
        proxyEnabledEl.checked = false;
        proxyUrlEl.value = "https://localhost:3003";
      }
    };

    const saveProxyUi = async () => {
      if (!proxyEnabledEl || !proxyUrlEl || !proxySaveEl) return;
      try {
        const storage = getAppStorage();
        await storage.settings.set("proxy.enabled", proxyEnabledEl.checked);
        await storage.settings.set("proxy.url", proxyUrlEl.value.trim());
        showToast("Proxy settings saved");
      } catch {
        showToast("Failed to save proxy settings");
      }
    };

    proxyEnabledEl?.addEventListener("change", () => void saveProxyUi());
    proxySaveEl?.addEventListener("click", () => void saveProxyUi());

    hydrateProxyUi().catch(() => {});

    const expandedRef = { current: null as HTMLElement | null };

    for (const provider of ALL_PROVIDERS) {
      const row = buildProviderRow(provider, {
        isActive: false,
        expandedRef,
        onConnected: (_row, _id, label) => {
          void (async () => {
            const updated = await providerKeys.list();
            setActiveProviders(new Set(updated));
            document.dispatchEvent(new CustomEvent("pi:providers-changed"));
            showToast(`${label} connected`);
            closeOverlay();
          })();
        },
        onDisconnected: (_row, _id, label) => {
          void (async () => {
            const updated = await providerKeys.list();
            setActiveProviders(new Set(updated));
            document.dispatchEvent(new CustomEvent("pi:providers-changed"));
            showToast(`${label} disconnected`);
          })();
        },
      });
      providerList.appendChild(row);
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });

    document.body.appendChild(overlay);
  });
}
