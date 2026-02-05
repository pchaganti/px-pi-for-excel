/**
 * Built-in slash commands for Pi for Excel.
 */

import { commandRegistry, type SlashCommand } from "./types.js";
import type { Agent } from "@mariozechner/pi-agent-core";
import { ModelSelector, getAppStorage } from "@mariozechner/pi-web-ui";

/** Register all built-in commands. Call once after agent is created. */
export function registerBuiltins(agent: Agent): void {
  const builtins: SlashCommand[] = [
    {
      name: "model",
      description: "Change the AI model",
      source: "builtin",
      execute: () => {
        ModelSelector.open(agent.state.model, (model) => {
          agent.setModel(model);
          // Header update is handled by the agent subscriber in taskpane.ts
          document.dispatchEvent(new CustomEvent("pi:model-changed"));
        });
      },
    },
    {
      name: "default-models",
      description: "Cycle models with Ctrl+P",
      source: "builtin",
      execute: () => {
        // TODO: implement scoped models dialog
        // For now, open model selector as a placeholder
        ModelSelector.open(agent.state.model, (model) => {
          agent.setModel(model);
          document.dispatchEvent(new CustomEvent("pi:model-changed"));
        });
      },
    },
    {
      name: "settings",
      description: "Manage API key for current provider",
      source: "builtin",
      execute: () => {
        import("@mariozechner/pi-web-ui").then(({ ApiKeyPromptDialog }) => {
          const provider = agent.state.model?.provider || "anthropic";
          ApiKeyPromptDialog.prompt(provider);
        });
      },
    },
    {
      name: "login",
      description: "Add or change provider API keys",
      source: "builtin",
      execute: async () => {
        await showProviderPicker(agent);
      },
    },
    {
      name: "copy",
      description: "Copy last agent message to clipboard",
      source: "builtin",
      execute: () => {
        const msgs = agent.state.messages;
        // Find last assistant message
        for (let i = msgs.length - 1; i >= 0; i--) {
          const msg = msgs[i] as any;
          if (msg.role === "assistant") {
            const text = msg.content
              ?.filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n") || "";
            if (text) {
              navigator.clipboard.writeText(text).then(() => {
                showToast("Copied to clipboard");
              });
            }
            return;
          }
        }
        showToast("No agent message to copy");
      },
    },
    {
      name: "name",
      description: "Name the current chat session",
      source: "builtin",
      execute: (args: string) => {
        if (!args.trim()) {
          showToast("Usage: /name My Session Name");
          return;
        }
        // Session naming would be handled through SessionsStore
        // For now, store in a simple way
        document.title = args.trim();
        showToast(`Session named: ${args.trim()}`);
      },
    },
    {
      name: "share-session",
      description: "Share session as a link",
      source: "builtin",
      execute: () => {
        showToast("Session sharing coming soon");
      },
    },
    {
      name: "shortcuts",
      description: "Show keyboard shortcuts",
      source: "builtin",
      execute: () => {
        showShortcutsDialog();
      },
    },
    {
      name: "new",
      description: "Start a new chat session",
      source: "builtin",
      execute: () => {
        agent.clearMessages();
        document.dispatchEvent(new CustomEvent("pi:session-new"));
        showToast("New session started");
      },
    },
    {
      name: "resume",
      description: "Resume a previous session",
      source: "builtin",
      execute: async () => {
        await showResumeDialog(agent);
      },
    },
    {
      name: "compact",
      description: "Summarize conversation to free context",
      source: "builtin",
      execute: async () => {
        const msgs = agent.state.messages;
        if (msgs.length < 4) {
          showToast("Too few messages to compact");
          return;
        }
        showToast("Compacting…");
        try {
          const { completeSimple } = await import("@mariozechner/pi-ai");
          // Serialize conversation for summarization
          const convo = msgs.map((m: any) => {
            const role = m.role === "user" ? "User" : "Assistant";
            const text = m.content
              ?.filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n") || "";
            return `${role}: ${text}`;
          }).join("\n\n");

          const result = await completeSimple(agent.state.model!, {
            systemPrompt: "You are a conversation summarizer. Summarize the following conversation concisely, preserving key decisions, facts, and context. Output ONLY the summary, no preamble.",
            messages: [{
              role: "user",
              content: [{ type: "text", text: `Summarize this conversation:\n\n${convo}` }],
              timestamp: Date.now(),
            }],
          });
          const summary = result.content
            ?.filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("\n") || "Summary unavailable";

          // Replace messages with a single summary + marker
          agent.replaceMessages([{
            role: "user",
            content: [{ type: "text", text: "[This conversation was compacted]" }],
            timestamp: Date.now(),
          } as any, {
            role: "assistant",
            content: [{ type: "text", text: `**Session Summary (compacted)**\n\n${summary}` }],
            timestamp: Date.now(),
            stopReason: "end_turn",
          } as any]);

          const iface = document.querySelector("agent-interface") as any;
          if (iface) iface.requestUpdate();
          showToast(`Compacted ${msgs.length} messages → summary`);
        } catch (e: any) {
          showToast(`Compact failed: ${e.message}`);
        }
      },
    },
  ];

  for (const cmd of builtins) {
    commandRegistry.register(cmd);
  }
}

// ── Helpers ────────────────────────────────────────────────

function showToast(message: string): void {
  let toast = document.getElementById("pi-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pi-toast";
    toast.className = "pi-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast!.classList.remove("visible"), 2000);
}

const PROVIDERS: { id: string; label: string; oauth?: boolean }[] = [
  { id: "anthropic",       label: "Anthropic",       oauth: true },
  { id: "openai",          label: "OpenAI" },
  { id: "google",          label: "Google Gemini" },
  { id: "amazon-bedrock",  label: "Amazon Bedrock" },
  { id: "deepseek",        label: "DeepSeek" },
  { id: "mistral",         label: "Mistral" },
  { id: "groq",            label: "Groq" },
  { id: "xai",             label: "xAI / Grok" },
];

async function showProviderPicker(agent: Agent): Promise<void> {
  let overlay = document.getElementById("pi-login-overlay");
  if (overlay) { overlay.remove(); return; }

  const storage = getAppStorage();
  const configuredKeys = await storage.providerKeys.list();
  const configuredSet = new Set(configuredKeys);

  overlay = document.createElement("div");
  overlay.id = "pi-login-overlay";
  overlay.className = "pi-welcome-overlay";

  overlay.innerHTML = `
    <div class="pi-welcome-card" style="text-align: left; max-width: 340px;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 4px; font-family: var(--font-sans);">Providers</h2>
      <p style="font-size: 12px; color: var(--muted-foreground); margin: 0 0 12px; font-family: var(--font-sans);">Connect providers to use their models.</p>
      <div class="pi-login-providers" style="display: flex; flex-direction: column; gap: 4px;"></div>
    </div>
  `;

  const list = overlay.querySelector(".pi-login-providers")!;
  let expandedRow: HTMLElement | null = null;

  for (const provider of PROVIDERS) {
    const { id, label, oauth } = provider;
    const isActive = configuredSet.has(id);

    const row = document.createElement("div");
    row.className = "pi-login-row";
    row.innerHTML = `
      <button class="pi-welcome-provider" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="font-size: 13px;">${label}</span>
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
          <input class="pi-login-key" type="password" placeholder="Enter API key"
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

    const headerBtn = row.querySelector(".pi-welcome-provider")!;
    const detail = row.querySelector(".pi-login-detail") as HTMLElement;
    const keyInput = row.querySelector(".pi-login-key") as HTMLInputElement;
    const saveBtn = row.querySelector(".pi-login-save") as HTMLButtonElement;
    const errorEl = row.querySelector(".pi-login-error") as HTMLElement;
    const oauthBtn = row.querySelector(".pi-login-oauth") as HTMLButtonElement | null;

    // Toggle expand
    headerBtn.addEventListener("click", () => {
      if (expandedRow === detail) {
        detail.style.display = "none";
        expandedRow = null;
      } else {
        if (expandedRow) expandedRow.style.display = "none";
        detail.style.display = "block";
        expandedRow = detail;
        keyInput.focus();
      }
    });

    // OAuth login
    if (oauthBtn) {
      oauthBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        oauthBtn.textContent = "Opening login…";
        oauthBtn.style.opacity = "0.7";
        try {
          const { getOAuthProvider } = await import("@mariozechner/pi-ai");
          const oauthProvider = getOAuthProvider(id as any);
          if (oauthProvider) {
            const cred = await oauthProvider.login({
              onAuth: (info) => {
                window.open(info.url, "_blank");
              },
              onPrompt: async (prompt) => {
                return window.prompt(prompt.message, prompt.placeholder || "") || "";
              },
              onProgress: (msg) => {
                oauthBtn.textContent = msg;
              },
            });
            const apiKey = oauthProvider.getApiKey(cred);
            await storage.providerKeys.set(id, apiKey);
            localStorage.setItem(`oauth_${id}`, JSON.stringify(cred));
            markConnected(row, label);
            detail.style.display = "none";
            expandedRow = null;
          }
        } catch (err: any) {
          errorEl.textContent = err.message || "Login failed";
          errorEl.style.display = "block";
        } finally {
          oauthBtn.textContent = `Login with ${label}`;
          oauthBtn.style.opacity = "1";
        }
      });
    }

    // API key save
    saveBtn.addEventListener("click", async () => {
      const key = keyInput.value.trim();
      if (!key) return;
      saveBtn.textContent = "Testing…";
      saveBtn.style.opacity = "0.7";
      errorEl.style.display = "none";
      try {
        await storage.providerKeys.set(id, key);
        markConnected(row, label);
        detail.style.display = "none";
        expandedRow = null;
      } catch (err: any) {
        errorEl.textContent = "Failed to save key";
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

    list.appendChild(row);
  }

  function markConnected(row: HTMLElement, label: string) {
    const status = row.querySelector(".pi-login-status") as HTMLElement;
    status.textContent = "✓ connected";
    status.style.color = "var(--pi-green)";
    configuredSet.add(label);
    document.dispatchEvent(new CustomEvent("pi:providers-changed"));
    showToast(`${label} connected`);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay!.remove();
  });

  document.body.appendChild(overlay);
}

async function showResumeDialog(agent: Agent): Promise<void> {
  const storage = getAppStorage();
  const sessions = await storage.sessions.getAllMetadata();

  if (sessions.length === 0) {
    showToast("No previous sessions");
    return;
  }

  let overlay = document.getElementById("pi-resume-overlay");
  if (overlay) { overlay.remove(); return; }

  overlay = document.createElement("div");
  overlay.id = "pi-resume-overlay";
  overlay.className = "pi-welcome-overlay";

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.round(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  overlay.innerHTML = `
    <div class="pi-welcome-card" style="text-align: left; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; font-family: var(--font-sans); flex-shrink: 0;">Resume Session</h2>
      <div class="pi-resume-list" style="overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
        ${sessions.slice(0, 20).map((s) => `
          <button class="pi-welcome-provider pi-resume-item" data-id="${s.id}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
            <span style="font-size: 13px; font-weight: 500;">${s.title || "Untitled"}</span>
            <span style="font-size: 11px; color: var(--muted-foreground);">${s.messageCount || 0} messages · ${formatDate(s.lastModified)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay) { overlay!.remove(); return; }
    const item = (e.target as HTMLElement).closest(".pi-resume-item") as HTMLElement;
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;

    const sessionData = await storage.sessions.loadSession(id);
    if (!sessionData) {
      showToast("Session not found");
      overlay!.remove();
      return;
    }

    // Restore messages and model
    agent.replaceMessages(sessionData.messages || []);
    if (sessionData.model) {
      agent.setModel(sessionData.model);
    }
    if (sessionData.thinkingLevel) {
      agent.setThinkingLevel(sessionData.thinkingLevel);
    }

    // Force UI to re-render
    const iface = document.querySelector("agent-interface") as any;
    if (iface) iface.requestUpdate();
    document.dispatchEvent(new CustomEvent("pi:model-changed"));

    overlay!.remove();
    showToast(`Resumed: ${sessionData.title || "Untitled"}`);
  });

  document.body.appendChild(overlay);
}

function showShortcutsDialog(): void {
  const shortcuts = [
    ["Enter", "Send message"],
    ["Shift+Tab", "Cycle thinking level"],
    ["Esc", "Abort agent / dismiss menu"],
    ["Enter (streaming)", "Steer — redirect agent"],
    ["⌥Enter", "Queue follow-up message"],
    ["/", "Open command menu"],
    ["↑↓", "Navigate command menu"],
    ["F6", "Focus: Sheet ↔ Sidebar"],
    ["⇧F6", "Focus: reverse direction"],
  ];

  let overlay = document.getElementById("pi-shortcuts-overlay");
  if (overlay) { overlay.remove(); return; }

  overlay = document.createElement("div");
  overlay.id = "pi-shortcuts-overlay";
  overlay.className = "pi-welcome-overlay";
  overlay.innerHTML = `
    <div class="pi-welcome-card" style="text-align: left;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; font-family: var(--font-sans);">Keyboard Shortcuts</h2>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${shortcuts.map(([key, desc]) => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <kbd style="font-family: var(--font-mono); font-size: 11px; padding: 2px 6px; background: oklch(0 0 0 / 0.05); border-radius: 4px; white-space: nowrap;">${key}</kbd>
            <span style="font-size: 12.5px; color: var(--muted-foreground); font-family: var(--font-sans);">${desc}</span>
          </div>
        `).join("")}
      </div>
      <button onclick="this.closest('.pi-welcome-overlay').remove()" style="margin-top: 16px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid oklch(0 0 0 / 0.08); background: oklch(0 0 0 / 0.03); cursor: pointer; font-family: var(--font-sans); font-size: 13px;">Close</button>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay!.remove();
  });
  document.body.appendChild(overlay);
}
