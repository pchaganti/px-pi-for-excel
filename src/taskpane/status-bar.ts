/**
 * Status bar rendering + thinking level flash.
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import { showToast } from "../ui/toast.js";
import { escapeHtml } from "../utils/html.js";
import { formatUsageDebug, isDebugEnabled } from "../debug/debug.js";
import { estimateContextTokens } from "../utils/context-tokens.js";
import { getPayloadStats } from "../auth/stream-proxy.js";

export function injectStatusBar(agent: Agent): void {
  agent.subscribe(() => updateStatusBar(agent));
  document.addEventListener("pi:status-update", () => updateStatusBar(agent));
  // Initial render after sidebar mounts
  requestAnimationFrame(() => updateStatusBar(agent));
}

export function updateStatusBar(agent: Agent): void {
  const el = document.getElementById("pi-status-bar");
  if (!el) return;

  const state = agent.state;

  // Model alias
  const model = state.model;
  const modelAlias = model ? (model.name || model.id) : "Select model";
  const modelAliasEscaped = escapeHtml(modelAlias);

  // Context usage
  //
  // For providers with prompt caching (e.g. Anthropic), `usage.input` excludes cached
  // prompt tokens. Cached tokens still count towards the model's context window.
  //
  // The most reliable signal we have in the UI is the last successful assistant
  // turn's usage, which already reflects the prompt size.
  const { totalTokens, lastUsage } = estimateContextTokens(state);

  const contextWindow = state.model?.contextWindow || 200000;
  const pct = contextWindow > 0 ? Math.round((totalTokens / contextWindow) * 100) : 0;
  const ctxLabel = contextWindow >= 1_000_000
    ? `${(contextWindow / 1_000_000).toFixed(0)}M`
    : `${Math.round(contextWindow / 1000)}k`;

  // Thinking level
  const thinkingLabels: Record<string, string> = {
    off: "off", minimal: "min", low: "low", medium: "med", high: "high", xhigh: "max",
  };
  const thinkingLevel = thinkingLabels[state.thinkingLevel] || state.thinkingLevel;

  // Context health: color + tooltip based on usage
  let ctxColor = "";
  const ctxBaseTooltip = `How much of the model's context window has been used (${totalTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens). As it fills up the model may lose track of earlier details — start a new chat if quality drops.`;
  let ctxWarning = "";
  if (pct > 100) {
    ctxColor = "pi-status-ctx--red";
    ctxWarning = `<span class="pi-tooltip__warn pi-tooltip__warn--red">Context window exceeded — the next message will fail. Use /compact to free up some context, or /new to clear the chat.</span>`;
  } else if (pct > 60) {
    ctxColor = "pi-status-ctx--red";
    ctxWarning = `<span class="pi-tooltip__warn pi-tooltip__warn--red">Context ${pct}% used up — quality will degrade. Use /compact to free up some context, or /new to clear the chat.</span>`;
  } else if (pct > 40) {
    ctxColor = "pi-status-ctx--yellow";
    ctxWarning = `<span class="pi-tooltip__warn pi-tooltip__warn--yellow">Context ${pct}% used up. Consider using /compact to free up some context, or /new to clear the chat.</span>`;
  }

  const chevronSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
  const brainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>`;

  const debugOn = isDebugEnabled();

  const usageDebug = debugOn && lastUsage
    ? `<span class="pi-status-ctx__debug">${escapeHtml(formatUsageDebug(lastUsage))}</span>`
    : "";

  let payloadPill = "";
  if (debugOn) {
    const ps = getPayloadStats();
    if (ps.calls > 0) {
      const fmtK = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
      const total = ps.systemChars + ps.toolSchemaChars + ps.messageChars;
      const toolsLine = ps.toolCount > 0
        ? `Tools: ${ps.toolCount} (${ps.toolSchemaChars.toLocaleString()} chars)`
        : `Tools: stripped`;
      const tooltip = [
        `LLM call #${ps.calls}`,
        `System: ${ps.systemChars.toLocaleString()} chars`,
        toolsLine,
        `Messages: ${ps.messageCount} (${ps.messageChars.toLocaleString()} chars)`,
        `Total context: ~${total.toLocaleString()} chars`,
        ``,
        `Click to log full context to console.`,
      ].join("&#10;");
      payloadPill = `<span class="pi-status-payload" data-tooltip="${tooltip}">#${ps.calls} ${fmtK(total)}</span>`;
    }
  }

  el.innerHTML = `
    <span class="pi-status-ctx has-tooltip"><span class="${ctxColor}">${pct}%</span> / ${ctxLabel}${usageDebug}<span class="pi-tooltip pi-tooltip--left">${ctxBaseTooltip}${ctxWarning}</span></span>${payloadPill}
    <button class="pi-status-model" data-tooltip="Switch the AI model powering this session">
      <span class="pi-status-model__mark">π</span>
      <span class="pi-status-model__name">${modelAliasEscaped}</span>
      ${chevronSvg}
    </button>
    <span class="pi-status-thinking" data-tooltip="Controls how long the model &quot;thinks&quot; before answering — higher = slower but better reasoning. Click or ⇧Tab to cycle.">${brainSvg} ${thinkingLevel}</span>
  `;
}

export function flashThinkingLevel(level: string, color: string): void {
  const labels: Record<string, string> = {
    off: "Off",
    minimal: "Min",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Max",
  };
  showToast(`Thinking: ${labels[level] || level} (next turn)`, 1500);

  const el = document.querySelector(".pi-status-thinking") as HTMLElement;
  if (!el) return;

  el.style.color = color;
  el.style.background = `${color}18`;
  el.style.boxShadow = `0 0 8px ${color}40`;
  el.style.transition = "none";

  let flashBar = document.getElementById("pi-thinking-flash");
  if (!flashBar) {
    flashBar = document.createElement("div");
    flashBar.id = "pi-thinking-flash";
    flashBar.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; height: 2px;
      pointer-events: none; z-index: 100; transition: opacity 0.6s ease-out;
    `;
    document.body.appendChild(flashBar);
  }
  flashBar.style.background = `linear-gradient(90deg, transparent, ${color}, transparent)`;
  flashBar.style.opacity = "1";

  const bar = flashBar;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = "color 0.8s ease, background 0.8s ease, box-shadow 0.8s ease";
      el.style.color = "";
      el.style.background = "";
      el.style.boxShadow = "";
      bar.style.opacity = "0";
    });
  });
}
