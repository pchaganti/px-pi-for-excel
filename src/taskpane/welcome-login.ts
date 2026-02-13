/**
 * Welcome/login overlay shown when no providers are configured.
 */

import type { ProviderKeysStore } from "@mariozechner/pi-web-ui/dist/storage/stores/provider-keys-store.js";
import { getAppStorage } from "@mariozechner/pi-web-ui/dist/storage/app-storage.js";

import { closeOverlayById, createOverlayDialog } from "../ui/overlay-dialog.js";
import { WELCOME_LOGIN_OVERLAY_ID } from "../ui/overlay-ids.js";
import { showToast } from "../ui/toast.js";
import { setActiveProviders } from "../compat/model-selector-patch.js";
import {
  DEFAULT_LOCAL_PROXY_URL,
  PROXY_HELPER_DOCS_URL,
} from "../auth/proxy-validation.js";

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

  // Make OAuth flows usable even before the user can access /settings.
  try {
    const storage = getAppStorage();
    const enabled = await storage.settings.get("proxy.enabled");
    const url = await storage.settings.get("proxy.url");

    const currentUrl = typeof url === "string" && url.trim().length > 0 ? url.trim() : DEFAULT_LOCAL_PROXY_URL;

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

  closeOverlayById(WELCOME_LOGIN_OVERLAY_ID);

  return new Promise<void>((resolve) => {
    const dialog = createOverlayDialog({
      overlayId: WELCOME_LOGIN_OVERLAY_ID,
      cardClassName: "pi-welcome-card",
    });

    let settled = false;
    dialog.addCleanup(() => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    });

    const closeOverlay = dialog.close;

    dialog.card.style.textAlign = "left";
    dialog.card.innerHTML = `
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
        <div class="pi-welcome-proxy__hint">
          Needed only when OAuth login is blocked by CORS.
          Keep this URL at <code>${DEFAULT_LOCAL_PROXY_URL}</code>, run a local HTTPS proxy helper, then enable this toggle.
          <a href="${PROXY_HELPER_DOCS_URL}" target="_blank" rel="noopener noreferrer">Step-by-step guide</a>.
        </div>
      </div>

      <div class="pi-welcome-providers"></div>
    `;

    const providerList = dialog.card.querySelector<HTMLDivElement>(".pi-welcome-providers");
    if (!providerList) {
      throw new Error("Welcome provider list not found");
    }

    const proxyEnabledEl = dialog.card.querySelector<HTMLInputElement>(".pi-welcome-proxy__enabled");
    const proxyUrlEl = dialog.card.querySelector<HTMLInputElement>(".pi-welcome-proxy__url");
    const proxySaveEl = dialog.card.querySelector<HTMLButtonElement>(".pi-welcome-proxy__save");

    const hydrateProxyUi = async () => {
      if (!proxyEnabledEl || !proxyUrlEl || !proxySaveEl) return;
      try {
        const storage = getAppStorage();
        const enabled = await storage.settings.get("proxy.enabled");
        const url = await storage.settings.get("proxy.url");
        proxyEnabledEl.checked = Boolean(enabled);
        proxyUrlEl.value = typeof url === "string" && url.trim().length > 0 ? url.trim() : DEFAULT_LOCAL_PROXY_URL;
      } catch {
        proxyEnabledEl.checked = false;
        proxyUrlEl.value = DEFAULT_LOCAL_PROXY_URL;
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

    dialog.mount();
  });
}
