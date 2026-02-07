/**
 * Shared provider login row builder — used by both welcome screen and /login command.
 *
 * Renders an inline expandable row with:
 * - OAuth button (for providers that support it)
 * - "or enter API key" divider
 * - API key input + Save button
 */

import { getAppStorage, isCorsError } from "@mariozechner/pi-web-ui";
import { getErrorMessage } from "../utils/errors.js";

export interface ProviderDef {
  id: string;
  label: string;
  oauth?: string;
  desc?: string;
}

const isBrowserOfficeHost = (): boolean =>
  typeof window !== "undefined" && typeof (window as unknown as { Office?: unknown }).Office !== "undefined";

export const ALL_PROVIDERS: ProviderDef[] = [
  // OAuth providers first (subscription / device flows)
  { id: "anthropic",       label: "Anthropic",      oauth: "anthropic",      desc: "Claude Pro/Max" },
  { id: "github-copilot",  label: "GitHub Copilot", oauth: "github-copilot" },

  // NOTE: These OAuth providers rely on Node.js-only flows (local callback server, etc.).
  // Hide them in Office taskpanes to avoid confusing runtime errors.
  ...(!isBrowserOfficeHost()
    ? [
        { id: "openai-codex",       label: "ChatGPT Plus/Pro", oauth: "openai-codex",       desc: "Codex Subscription" },
        { id: "google-gemini-cli",  label: "Gemini CLI",       oauth: "google-gemini-cli",  desc: "Google Cloud Code Assist" },
        { id: "google-antigravity", label: "Antigravity",      oauth: "google-antigravity", desc: "Gemini 3, Claude, GPT-OSS" },
      ]
    : []),

  // API key providers
  { id: "openai",             label: "OpenAI",           desc: "API key" },
  { id: "google",             label: "Google Gemini",    desc: "API key" },
  { id: "deepseek",           label: "DeepSeek" },
  { id: "amazon-bedrock",     label: "Amazon Bedrock" },
  { id: "mistral",            label: "Mistral" },
  { id: "groq",               label: "Groq" },
  { id: "xai",                label: "xAI / Grok" },
];

export interface ProviderRowCallbacks {
  onConnected: (row: HTMLElement, id: string, label: string) => void;
}

class PromptCancelledError extends Error {
  constructor() {
    super("Prompt cancelled");
  }
}

function normalizeAnthropicAuthorizationInput(input: string): string {
  const value = input.trim();
  if (!value) return value;

  // Accept full redirect URL (or any URL with code/state query params)
  try {
    const url = new URL(value);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (code) return state ? `${code}#${state}` : code;
  } catch {
    // ignore
  }

  // Accept query-string style pastes (code=...&state=...)
  if (value.includes("code=")) {
    try {
      const params = new URLSearchParams(value.startsWith("?") ? value.slice(1) : value);
      const code = params.get("code");
      const state = params.get("state");
      if (code) return state ? `${code}#${state}` : code;
    } catch {
      // ignore
    }
  }

  // Accept whitespace-separated values (code state)
  if (!value.includes("#")) {
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}#${parts[1]}`;
  }

  return value;
}

function normalizeApiKeyForProvider(
  providerId: string,
  raw: string,
): { ok: true; key: string } | { ok: false; error: string } {
  let key = raw.trim();
  if (!key) return { ok: false, error: "API key is empty" };

  // Common copy/paste format: "Bearer <token>"
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }

  if (providerId === "anthropic") {
    // Prevent saving Anthropic OAuth *authorization code* (code#state) as an API key.
    // OAuth access tokens are sk-ant-oat*, API keys are sk-ant-api*.
    const looksLikeAuthCode = key.includes("#") && !key.includes("sk-ant-");
    if (looksLikeAuthCode) {
      return {
        ok: false,
        error:
          "That looks like an OAuth authorization code (code#state). Use “Login with Anthropic” and paste it when prompted (don’t Save it as an API key).",
      };
    }
  }

  return { ok: true, key };
}

function promptForText(opts: {
  title: string;
  message: string;
  placeholder?: string;
  helperText?: string;
  submitLabel?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("pi-prompt-overlay");
    existing?.remove();

    const overlay = document.createElement("div");
    overlay.id = "pi-prompt-overlay";
    overlay.className = "pi-welcome-overlay";
    overlay.innerHTML = `
      <div class="pi-welcome-card" style="text-align: left; max-width: 420px;">
        <h2 class="pi-prompt-title" style="font-size: 16px; font-weight: 600; margin: 0 0 6px; font-family: var(--font-sans);"></h2>
        <p class="pi-prompt-message" style="font-size: 12px; color: var(--muted-foreground); margin: 0 0 10px; font-family: var(--font-sans);"></p>
        <p class="pi-prompt-helper" style="display:none; font-size: 11px; color: var(--muted-foreground); margin: 0 0 10px; font-family: var(--font-sans);"></p>
        <input class="pi-prompt-input" type="text"
          style="width: 100%; padding: 8px 10px; border: 1px solid oklch(0 0 0 / 0.10);
          border-radius: 8px; font-family: var(--font-mono); font-size: 12px;
          background: oklch(1 0 0 / 0.6); outline: none;"
        />
        <div style="display:flex; gap: 8px; margin-top: 12px;">
          <button class="pi-prompt-cancel" style="flex:1; padding: 8px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.03); cursor: pointer; font-family: var(--font-sans); font-size: 13px;">Cancel</button>
          <button class="pi-prompt-ok" style="flex:1; padding: 8px; border-radius: 8px; border: none; background: var(--pi-green); color: white; cursor: pointer; font-family: var(--font-sans); font-size: 13px; font-weight: 600;">Continue</button>
        </div>
      </div>
    `;

    const titleEl = overlay.querySelector<HTMLElement>(".pi-prompt-title");
    const msgEl = overlay.querySelector<HTMLElement>(".pi-prompt-message");
    const helperEl = overlay.querySelector<HTMLElement>(".pi-prompt-helper");
    const input = overlay.querySelector<HTMLInputElement>(".pi-prompt-input");
    const cancelBtn = overlay.querySelector<HTMLButtonElement>(".pi-prompt-cancel");
    const okBtn = overlay.querySelector<HTMLButtonElement>(".pi-prompt-ok");

    if (!titleEl || !msgEl || !helperEl || !input || !cancelBtn || !okBtn) {
      overlay.remove();
      reject(new Error("Prompt UI failed to render"));
      return;
    }

    titleEl.textContent = opts.title;
    msgEl.textContent = opts.message;
    if (opts.helperText) {
      helperEl.textContent = opts.helperText;
      helperEl.style.display = "block";
    }
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.submitLabel) okBtn.textContent = opts.submitLabel;

    const cleanup = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown, true);
    };

    const submit = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value);
    };

    const cancel = () => {
      cleanup();
      reject(new PromptCancelledError());
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cancel();
    });

    cancelBtn.addEventListener("click", cancel);
    okBtn.addEventListener("click", submit);

    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => input.focus());
  });
}

/**
 * Build a provider login row with inline OAuth + API key.
 * Manages expand/collapse via the shared expandedRef.
 */
export function buildProviderRow(
  provider: ProviderDef,
  opts: {
    isActive: boolean;
    expandedRef: { current: HTMLElement | null };
    onConnected: (row: HTMLElement, id: string, label: string) => void;
  }
): HTMLElement {
  const { id, label, oauth, desc } = provider;
  const { isActive, expandedRef, onConnected } = opts;
  const storage = getAppStorage();

  const keyPlaceholder = id === "anthropic"
    ? "sk-ant-api… or sk-ant-oat…"
    : "Enter API key";

  const row = document.createElement("div");
  row.className = "pi-login-row";
  row.innerHTML = `
    <button class="pi-welcome-provider" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <span style="display: flex; flex-direction: column; align-items: flex-start; gap: 1px;">
        <span style="font-size: 13px;">${label}</span>
        ${desc ? `<span style="font-size: 10px; color: var(--muted-foreground); font-family: var(--font-sans);">${desc}</span>` : ""}
      </span>
      <span class="pi-login-status" style="font-size: 11px; color: ${isActive ? "var(--pi-green)" : "var(--muted-foreground)"}; font-family: var(--font-mono);">
        ${isActive ? "✓ connected" : "set up →"}
      </span>
    </button>
    <div class="pi-login-detail" style="display: none; padding: 8px 14px 12px; border: 1px solid oklch(0 0 0 / 0.05); border-top: none; border-radius: 0 0 10px 10px; margin-top: -1px; background: oklch(1 0 0 / 0.3);">
      ${oauth ? `
        <button class="pi-login-oauth" style="
          width: 100%; padding: 9px 14px; margin-bottom: 8px;
          background: var(--pi-green); color: white; border: none;
          border-radius: 9px; font-family: var(--font-sans);
          font-size: 13px; font-weight: 500; cursor: pointer;
          transition: background 0.15s;
        ">Login with ${label}</button>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="flex: 1; height: 1px; background: oklch(0 0 0 / 0.08);"></div>
          <span style="font-size: 11px; color: var(--muted-foreground); font-family: var(--font-sans);">or enter API key</span>
          <div style="flex: 1; height: 1px; background: oklch(0 0 0 / 0.08);"></div>
        </div>
      ` : ""}
      <div style="display: flex; gap: 6px;">
        <input class="pi-login-key" type="password" placeholder="${keyPlaceholder}"
          style="flex: 1; padding: 7px 10px; border: 1px solid oklch(0 0 0 / 0.10);
          border-radius: 8px; font-family: var(--font-mono); font-size: 12px;
          background: oklch(1 0 0 / 0.6); outline: none;"
        />
        <button class="pi-login-save" style="
          padding: 7px 12px; background: var(--pi-green); color: white;
          border: none; border-radius: 8px; font-family: var(--font-sans);
          font-size: 12px; font-weight: 500; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        ">Save</button>
      </div>
      <p class="pi-login-error" style="display: none; font-size: 11px; color: oklch(0.55 0.22 25); margin: 6px 0 0; font-family: var(--font-sans);"></p>
    </div>
  `;

  const headerBtn = row.querySelector<HTMLButtonElement>(".pi-welcome-provider");
  if (!headerBtn) {
    throw new Error("Provider row header button not found");
  }
  const detail = row.querySelector(".pi-login-detail") as HTMLElement;
  const keyInput = row.querySelector(".pi-login-key") as HTMLInputElement;
  const saveBtn = row.querySelector(".pi-login-save") as HTMLButtonElement;
  const errorEl = row.querySelector(".pi-login-error") as HTMLElement;
  const oauthBtn = row.querySelector(".pi-login-oauth") as HTMLButtonElement | null;

  // Toggle expand
  headerBtn.addEventListener("click", () => {
    if (expandedRef.current === detail) {
      detail.style.display = "none";
      expandedRef.current = null;
    } else {
      if (expandedRef.current) expandedRef.current.style.display = "none";
      detail.style.display = "block";
      expandedRef.current = detail;
      keyInput.focus();
    }
  });

  // OAuth login
  if (oauthBtn) {
    oauthBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      oauthBtn.textContent = "Opening login…";
      oauthBtn.style.opacity = "0.7";
      errorEl.style.display = "none";
      try {
        const { getOAuthProvider } = await import("@mariozechner/pi-ai");
        if (!oauth) {
          throw new Error("OAuth provider id missing");
        }
        const oauthProvider = getOAuthProvider(oauth);
        if (oauthProvider) {
          const cred = await oauthProvider.login({
            onAuth: (info) => { window.open(info.url, "_blank"); },
            onPrompt: async (prompt) => {
              const helperText = id === "anthropic"
                ? "After completing login, copy the authorization string from the browser. You can paste the full URL, or a CODE#STATE value."
                : undefined;

              const value = await promptForText({
                title: `Login with ${label}`,
                message: prompt.message,
                placeholder: prompt.placeholder || "",
                helperText,
                submitLabel: "Continue",
              });

              if (id === "anthropic") {
                return normalizeAnthropicAuthorizationInput(value);
              }

              return value;
            },
            onProgress: (msg) => { oauthBtn.textContent = msg; },
          });
          const apiKey = oauthProvider.getApiKey(cred);
          await storage.providerKeys.set(id, apiKey);
          localStorage.setItem(`oauth_${id}`, JSON.stringify(cred));
          markConnected(row);
          onConnected(row, id, label);
          detail.style.display = "none";
          expandedRef.current = null;
        }
      } catch (err: unknown) {
        if (err instanceof PromptCancelledError) {
          // User cancelled the prompt; leave UI unchanged.
          return;
        }

        const msg = getErrorMessage(err);
        const isLikelyCors =
          isCorsError(err) ||
          (typeof msg === "string" && /load failed|failed to fetch|cors|cross-origin|networkerror/i.test(msg));

        if (isLikelyCors) {
          errorEl.textContent = "Login was blocked by browser CORS. Start the local HTTPS proxy (npm run proxy:https) and enable it in /settings → Proxy.";
        } else {
          errorEl.textContent = msg || "Login failed";
        }
        errorEl.style.display = "block";
      } finally {
        oauthBtn.textContent = `Login with ${label}`;
        oauthBtn.style.opacity = "1";
      }
    });
  }

  // API key save
  saveBtn.addEventListener("click", async () => {
    const rawKey = keyInput.value.trim();
    if (!rawKey) return;

    const normalized = normalizeApiKeyForProvider(id, rawKey);
    if (!normalized.ok) {
      errorEl.textContent = normalized.error;
      errorEl.style.display = "block";
      return;
    }

    const key = normalized.key;
    saveBtn.textContent = "Testing…";
    saveBtn.style.opacity = "0.7";
    errorEl.style.display = "none";
    try {
      await storage.providerKeys.set(id, key);
      markConnected(row);
      onConnected(row, id, label);
      detail.style.display = "none";
      expandedRef.current = null;
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      errorEl.textContent = msg ? `Failed to save key: ${msg}` : "Failed to save key";
      errorEl.style.display = "block";
    } finally {
      saveBtn.textContent = "Save";
      saveBtn.style.opacity = "1";
    }
  });

  // Enter key in input
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
  });

  return row;
}

function markConnected(row: HTMLElement) {
  const status = row.querySelector(".pi-login-status") as HTMLElement;
  if (status) {
    status.textContent = "✓ connected";
    status.style.color = "var(--pi-green)";
  }
}
