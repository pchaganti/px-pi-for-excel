/**
 * Custom message renderers.
 *
 * We render compaction as a tool-style collapsible card instead of an assistant
 * text blob.
 */

import { html } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { Archive } from "lucide";
import { registerMessageRenderer } from "@mariozechner/pi-web-ui/dist/components/message-renderer-registry.js";
import { renderCollapsibleHeader } from "@mariozechner/pi-web-ui/dist/tools/renderer-registry.js";

import type { CompactionSummaryMessage } from "../messages/compaction.js";

// Ensure <markdown-block> is registered.
import "@mariozechner/mini-lit/dist/MarkdownBlock.js";

registerMessageRenderer("compactionSummary", {
  render(message: CompactionSummaryMessage) {
    const contentRef = createRef<HTMLDivElement>();
    const chevronRef = createRef<HTMLElement>();

    const title = html`
      <span class="pi-tool-card__title">
        <strong>Summarized ${message.messageCountBefore} messages</strong>
      </span>
    `;

    return html`
      <div class="px-4">
        <div class="pi-tool-card" data-state="complete" data-tool-name="compact">
          <div class="pi-tool-card__header">
            ${renderCollapsibleHeader("complete", Archive, title, contentRef, chevronRef, false)}
          </div>

          <div
            ${ref(contentRef)}
            class="pi-tool-card__body overflow-hidden transition-all duration-300 max-h-0"
          >
            <div class="pi-tool-card__inner">
              <div class="pi-tool-card__detail">
                <span class="pi-tool-card__tool-id">compact</span>
              </div>

              <div class="pi-tool-card__section">
                <div class="pi-tool-card__section-label">Summary</div>
                <div class="pi-tool-card__markdown">
                  <markdown-block .content=${message.summary || "(no summary)"}></markdown-block>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
