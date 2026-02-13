import assert from "node:assert/strict";
import { test } from "node:test";

import { createExtensionAPI } from "../src/commands/extension-api.ts";
import { EXTENSION_OVERLAY_ID } from "../src/ui/overlay-ids.ts";
import { installFakeDom } from "./fake-dom.test.ts";

void test("extension overlay show/dismiss mounts and tears down shared overlay", () => {
  const { document, restore } = installFakeDom();

  try {
    const api = createExtensionAPI({
      getAgent: () => {
        throw new Error("agent should not be requested in overlay test");
      },
    });

    const first = document.createElement("div") as HTMLElement;
    first.id = "first-content";

    api.overlay.show(first);

    const mounted = document.getElementById(EXTENSION_OVERLAY_ID);
    assert.notEqual(mounted, null);
    assert.equal((mounted as Element).contains(first as unknown as Element), true);

    const second = document.createElement("div") as HTMLElement;
    second.id = "second-content";

    api.overlay.show(second);

    const remounted = document.getElementById(EXTENSION_OVERLAY_ID);
    assert.notEqual(remounted, null);
    assert.equal((remounted as Element).contains(second as unknown as Element), true);
    assert.equal((remounted as Element).contains(first as unknown as Element), false);

    api.overlay.dismiss();
    assert.equal(document.getElementById(EXTENSION_OVERLAY_ID), null);
  } finally {
    restore();
  }
});
