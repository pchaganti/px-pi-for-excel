import assert from "node:assert/strict";
import { test } from "node:test";

import { getWorkbookContext } from "../src/workbook/context.ts";

function setOfficeDocumentUrl(url: string | null): () => void {
  const hadOffice = Reflect.has(globalThis, "Office");
  const previousOffice = Reflect.get(globalThis, "Office");

  if (url === null) {
    Reflect.deleteProperty(globalThis, "Office");
  } else {
    Reflect.set(globalThis, "Office", {
      context: {
        document: {
          url,
        },
      },
    });
  }

  return () => {
    if (hadOffice) {
      Reflect.set(globalThis, "Office", previousOffice);
      return;
    }

    Reflect.deleteProperty(globalThis, "Office");
  };
}

void test("extracts workbook basename from Windows local-path URLs", async () => {
  const restore = setOfficeDocumentUrl("C:\\Users\\alice\\Budget.xlsx");

  try {
    const context = await getWorkbookContext();
    assert.equal(context.workbookName, "Budget.xlsx");
  } finally {
    restore();
  }
});

void test("extracts workbook basename from document URL path", async () => {
  const restore = setOfficeDocumentUrl("https://example.com/reports/Forecast%20Q1.xlsx?x=1");

  try {
    const context = await getWorkbookContext();
    assert.equal(context.workbookName, "Forecast Q1.xlsx");
  } finally {
    restore();
  }
});

void test("returns null workbook name when Office document URL is unavailable", async () => {
  const restore = setOfficeDocumentUrl(null);

  try {
    const context = await getWorkbookContext();
    assert.equal(context.workbookName, null);
    assert.equal(context.source, "unknown");
  } finally {
    restore();
  }
});
