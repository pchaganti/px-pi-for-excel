import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_RECOVERY_CELLS,
  WorkbookRecoveryLog,
  type WorkbookRecoverySnapshot,
} from "../src/workbook/recovery-log.ts";
import type { WorkbookContext } from "../src/workbook/context.ts";
import {
  estimateFormatCaptureCellCount,
  firstCellAddress,
  type RecoveryCommentThreadState,
  type RecoveryConditionalFormatRule,
  type RecoveryFormatRangeState,
  type RecoveryModifyStructureState,
} from "../src/workbook/recovery-states.ts";

const RECOVERY_SETTING_KEY = "workbook.recovery-snapshots.v1";

interface InMemorySettingsStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

function createInMemorySettingsStore(): InMemorySettingsStore {
  const values = new Map<string, unknown>();

  return {
    get: <T>(key: string): Promise<T | null> => {
      const value = values.get(key);
      return Promise.resolve(value === undefined ? null : value as T);
    },
    set: (key: string, value: unknown): Promise<void> => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

function findSnapshotById(snapshots: WorkbookRecoverySnapshot[], id: string): WorkbookRecoverySnapshot | null {
  for (const snapshot of snapshots) {
    if (snapshot.id === id) {
      return snapshot;
    }
  }

  return null;
}

function withoutUndefined(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

void test("firstCellAddress handles quoted sheet names that include !", () => {
  assert.equal(firstCellAddress("'Q1!Ops'!A1"), "A1");
  assert.equal(firstCellAddress("'Q1!Ops'!$B$2:$D$9"), "$B$2");
  assert.equal(firstCellAddress("Sheet1!C5:D7"), "C5");
});

void test("estimateFormatCaptureCellCount scales by serialized checkpoint shape", () => {
  const largeArea = [{ rowCount: 1_048_576, columnCount: 3 }];

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { columnWidth: true }),
    3,
  );

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { rowHeight: true }),
    1_048_576,
  );

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { columnWidth: true, rowHeight: true }),
    1_048_579,
  );

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { columnWidth: true, fillColor: true }),
    4,
  );

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { mergedAreas: true }),
    1_572_864,
  );

  assert.equal(
    estimateFormatCaptureCellCount(largeArea, { mergedAreas: true, rowHeight: true }),
    2_621_440,
  );
});

void test("recovery log appends and reloads workbook-scoped snapshots", async () => {
  const settingsStore = createInMemorySettingsStore();

  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: "url_sha256:workbook-a",
    workbookName: "Ops.xlsx",
    source: "document.url",
  });

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-${idCounter}`;
  };

  const logA = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    now: () => 1700000000000,
    createId,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const appended = await logA.append({
    toolName: "write_cells",
    toolCallId: "call-1",
    address: "Sheet1!A1",
    changedCount: 1,
    beforeValues: [["before"]],
    beforeFormulas: [["before"]],
  });

  assert.ok(appended);
  assert.equal(appended?.id, "snap-1");

  const entriesA = await logA.listForCurrentWorkbook();
  assert.equal(entriesA.length, 1);
  assert.equal(entriesA[0]?.workbookId, "url_sha256:workbook-a");

  const logB = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const entriesB = await logB.listForCurrentWorkbook();
  assert.equal(entriesB.length, 1);
  assert.equal(entriesB[0]?.toolCallId, "call-1");
});

void test("persisted format checkpoints retain dimension state", async () => {
  const settingsStore = createInMemorySettingsStore();

  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: "url_sha256:workbook-format-persist",
    workbookName: "Ops.xlsx",
    source: "document.url",
  });

  const formatState: RecoveryFormatRangeState = {
    selection: {
      columnWidth: true,
      rowHeight: true,
      mergedAreas: true,
    },
    areas: [
      {
        address: "Sheet1!A1:B2",
        rowCount: 2,
        columnCount: 2,
        columnWidths: [64, 80],
        rowHeights: [18, 22],
        mergedAreas: ["Sheet1!A1:B1"],
      },
    ],
    cellCount: 4,
  };

  const logA = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    now: () => 1700000000100,
    createId: () => "snap-format-persist-1",
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const appended = await logA.appendFormatCells({
    toolName: "format_cells",
    toolCallId: "call-format-persist",
    address: "Sheet1!A1:B2",
    changedCount: 4,
    formatRangeState: formatState,
  });

  assert.ok(appended);

  const logB = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const entries = await logB.listForCurrentWorkbook(10);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.snapshotKind, "format_cells_state");
  assert.deepEqual(withoutUndefined(entries[0]?.formatRangeState), withoutUndefined(formatState));
});

void test("persisted modify-structure checkpoints retain extended state kinds", async () => {
  const settingsStore = createInMemorySettingsStore();

  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: "url_sha256:workbook-structure-persist",
    workbookName: "Ops.xlsx",
    source: "document.url",
  });

  const states: readonly RecoveryModifyStructureState[] = [
    {
      kind: "sheet_absent",
      sheetId: "sheet-added-1",
      sheetName: "Draft",
    },
    {
      kind: "sheet_present",
      sheetId: "sheet-added-2",
      sheetName: "Roadmap",
      position: 2,
      visibility: "Visible",
    },
    {
      kind: "rows_absent",
      sheetId: "sheet-grid-1",
      sheetName: "Data",
      position: 4,
      count: 2,
    },
    {
      kind: "rows_present",
      sheetId: "sheet-grid-1",
      sheetName: "Data",
      position: 4,
      count: 2,
    },
    {
      kind: "columns_absent",
      sheetId: "sheet-grid-1",
      sheetName: "Data",
      position: 3,
      count: 1,
    },
    {
      kind: "columns_present",
      sheetId: "sheet-grid-1",
      sheetName: "Data",
      position: 3,
      count: 1,
    },
  ];

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-structure-persist-${idCounter}`;
  };

  const logA = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    now: () => 1700000000150,
    createId,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    if (!state) {
      throw new Error("Expected structure checkpoint state.");
    }

    const appended = await logA.appendModifyStructure({
      toolName: "modify_structure",
      toolCallId: `call-structure-persist-${index + 1}`,
      address: "Sheet1",
      changedCount: 1,
      modifyStructureState: state,
    });

    assert.ok(appended);
  }

  const logB = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const entries = await logB.listForCurrentWorkbook(20);
  assert.equal(entries.length, states.length);

  for (let index = 0; index < states.length; index += 1) {
    const expectedState = states[index];
    if (!expectedState) {
      throw new Error("Expected structure checkpoint state.");
    }

    const toolCallId = `call-structure-persist-${index + 1}`;
    const entry = entries.find((snapshot) => snapshot.toolCallId === toolCallId);
    if (!entry) {
      throw new Error(`Expected checkpoint entry for ${toolCallId}.`);
    }

    assert.equal(entry.snapshotKind, "modify_structure_state");
    assert.deepEqual(withoutUndefined(entry.modifyStructureState), withoutUndefined(expectedState));
  }
});

void test("persisted conditional-format checkpoints retain extended rule types", async () => {
  const settingsStore = createInMemorySettingsStore();

  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: "url_sha256:workbook-conditional-format-persist",
    workbookName: "Ops.xlsx",
    source: "document.url",
  });

  const rules = [
    {
      type: "custom",
      formula: "=A1>10",
      fillColor: "#FF0000",
      appliesToAddress: "Sheet1!A1:A2",
    },
    {
      type: "cell_value",
      operator: "GreaterThan",
      formula1: "10",
      fillColor: "#0000FF",
      appliesToAddress: "Sheet1!B1:B2",
    },
    {
      type: "text_comparison",
      textOperator: "Contains",
      text: "urgent",
      fillColor: "#FFE599",
      appliesToAddress: "Sheet1!C1:C2",
    },
    {
      type: "top_bottom",
      topBottomType: "TopItems",
      rank: 3,
      fillColor: "#E2EFDA",
      appliesToAddress: "Sheet1!D1:D10",
    },
    {
      type: "preset_criteria",
      presetCriterion: "DuplicateValues",
      fillColor: "#FCE4D6",
      appliesToAddress: "Sheet1!E1:E10",
    },
    {
      type: "data_bar",
      stopIfTrue: true,
      appliesToAddress: "Sheet1!F1:F10",
      dataBar: {
        axisColor: "#000000",
        axisFormat: "Automatic",
        barDirection: "Context",
        showDataBarOnly: false,
        lowerBoundRule: { type: "LowestValue" },
        upperBoundRule: { type: "HighestValue" },
        positiveFillColor: "#63C384",
        positiveBorderColor: "#2E8540",
        positiveGradientFill: true,
        negativeFillColor: "#D13438",
        negativeBorderColor: "#A4262C",
        negativeMatchPositiveFillColor: false,
        negativeMatchPositiveBorderColor: false,
      },
    },
    {
      type: "color_scale",
      stopIfTrue: false,
      appliesToAddress: "Sheet1!G1:G10",
      colorScale: {
        minimum: { type: "LowestValue", color: "#F8696B" },
        midpoint: { type: "Percentile", formula: "50", color: "#FFEB84" },
        maximum: { type: "HighestValue", color: "#63BE7B" },
      },
    },
    {
      type: "icon_set",
      stopIfTrue: true,
      appliesToAddress: "Sheet1!H1:H10",
      iconSet: {
        style: "ThreeTrafficLights1",
        reverseIconOrder: false,
        showIconOnly: false,
        criteria: [
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "0" },
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "33" },
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "67" },
        ],
      },
    },
  ] as const;

  const logA = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    now: () => 1700000000150,
    createId: () => "snap-conditional-format-persist-1",
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const appended = await logA.appendConditionalFormat({
    toolName: "conditional_format",
    toolCallId: "call-conditional-format-persist",
    address: "Sheet1!A1:E10",
    changedCount: 50,
    cellCount: 50,
    conditionalFormatRules: [...rules],
  });

  assert.ok(appended);

  const logB = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const entries = await logB.listForCurrentWorkbook(10);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.snapshotKind, "conditional_format_rules");
  assert.deepEqual(withoutUndefined(entries[0]?.conditionalFormatRules), withoutUndefined(rules));
});

void test("append is skipped when workbook identity is unavailable", async () => {
  const settingsStore = createInMemorySettingsStore();

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: (): Promise<WorkbookContext> => Promise.resolve({
      workbookId: null,
      workbookName: null,
      source: "unknown",
    }),
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  const appended = await log.append({
    toolName: "write_cells",
    toolCallId: "call-null-id",
    address: "Sheet1!A1",
    beforeValues: [["before"]],
    beforeFormulas: [["before"]],
  });

  assert.equal(appended, null);
  assert.equal((await log.list({ limit: 10 })).length, 0);
  assert.equal((await log.listForCurrentWorkbook(10)).length, 0);
});

void test("delete is scoped to the active workbook", async () => {
  const settingsStore = createInMemorySettingsStore();

  let currentWorkbookId: string | null = "url_sha256:workbook-a";
  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: currentWorkbookId,
    workbookName: "Workbook",
    source: currentWorkbookId ? "document.url" : "unknown",
  });

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-${idCounter}`;
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
  });

  const snapshotA = await log.append({
    toolName: "write_cells",
    toolCallId: "call-a",
    address: "Sheet1!A1",
    beforeValues: [["a"]],
    beforeFormulas: [["a"]],
  });

  currentWorkbookId = "url_sha256:workbook-b";

  const snapshotB = await log.append({
    toolName: "write_cells",
    toolCallId: "call-b",
    address: "Sheet1!A2",
    beforeValues: [["b"]],
    beforeFormulas: [["b"]],
  });

  assert.ok(snapshotA);
  assert.ok(snapshotB);

  currentWorkbookId = "url_sha256:workbook-a";

  const deletedOtherWorkbook = await log.delete(snapshotB?.id ?? "");
  assert.equal(deletedOtherWorkbook, false);

  const deletedCurrentWorkbook = await log.delete(snapshotA?.id ?? "");
  assert.equal(deletedCurrentWorkbook, true);

  currentWorkbookId = null;
  const deletedWithoutIdentity = await log.delete(snapshotB?.id ?? "");
  assert.equal(deletedWithoutIdentity, false);

  currentWorkbookId = "url_sha256:workbook-b";
  const remainingCurrent = await log.listForCurrentWorkbook(10);
  assert.equal(remainingCurrent.length, 1);
  assert.equal(remainingCurrent[0]?.id, snapshotB?.id);
});

void test("restore rejects legacy snapshots without workbook identity", async () => {
  const settingsStore = createInMemorySettingsStore();

  await settingsStore.set(RECOVERY_SETTING_KEY, {
    version: 1,
    snapshots: [
      {
        id: "legacy-1",
        at: 1700000000000,
        toolName: "write_cells",
        toolCallId: "call-legacy",
        address: "Sheet1!A1",
        changedCount: 1,
        cellCount: 1,
        beforeValues: [["before"]],
        beforeFormulas: [["before"]],
      },
    ],
  });

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: (): Promise<WorkbookContext> => Promise.resolve({
      workbookId: "url_sha256:target",
      workbookName: "Target.xlsx",
      source: "document.url",
    }),
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  await assert.rejects(
    () => log.restore("legacy-1"),
    /missing workbook identity/i,
  );
});

void test("restore rejects when current workbook identity is unavailable", async () => {
  const settingsStore = createInMemorySettingsStore();

  await settingsStore.set(RECOVERY_SETTING_KEY, {
    version: 1,
    snapshots: [
      {
        id: "snap-1",
        at: 1700000000000,
        toolName: "write_cells",
        toolCallId: "call-1",
        address: "Sheet1!A1",
        changedCount: 1,
        cellCount: 1,
        beforeValues: [["before"]],
        beforeFormulas: [["before"]],
        workbookId: "url_sha256:origin",
      },
    ],
  });

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: (): Promise<WorkbookContext> => Promise.resolve({
      workbookId: null,
      workbookName: null,
      source: "unknown",
    }),
    applySnapshot: () => Promise.resolve({ values: [["old"]], formulas: [["old"]] }),
  });

  await assert.rejects(
    () => log.restore("snap-1"),
    /identity is unavailable/i,
  );
});

void test("restore applies checkpoint values and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-b",
    workbookName: "Model.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-${idCounter}`;
  };

  let appliedAddress = "";
  let appliedValues: unknown[][] = [];

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000001000,
    createId,
    applySnapshot: (address: string, values: unknown[][]) => {
      appliedAddress = address;
      appliedValues = values;
      return Promise.resolve({
        values: [[42]],
        formulas: [[42]],
      });
    },
  });

  const appended = await log.append({
    toolName: "fill_formula",
    toolCallId: "call-2",
    address: "Sheet2!B4",
    changedCount: 1,
    beforeValues: [[10]],
    beforeFormulas: [["=A1+A2"]],
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Sheet2!B4");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Sheet2!B4");
  assert.deepEqual(appliedValues, [["=A1+A2"]]);

  const snapshots = await log.listForCurrentWorkbook(10);
  assert.equal(snapshots.length, 2);

  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
});

void test("restore applies format-cells checkpoints and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-format",
    workbookName: "Formatting.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-format-${idCounter}`;
  };

  let appliedAddress = "";
  let appliedState: RecoveryFormatRangeState | null = null;

  const restoredTargetState: RecoveryFormatRangeState = {
    selection: {
      numberFormat: true,
      fillColor: true,
      bold: true,
      columnWidth: true,
      rowHeight: true,
      mergedAreas: true,
      borderTop: true,
    },
    areas: [
      {
        address: "Sheet1!A1:B1",
        rowCount: 1,
        columnCount: 2,
        numberFormat: [["0.00", "0.00"]],
        fillColor: "#FFFF00",
        bold: true,
        columnWidths: [64, 80],
        rowHeights: [24],
        mergedAreas: ["Sheet1!A1:B1"],
        borderTop: {
          style: "Continuous",
          weight: "Thin",
          color: "#000000",
        },
      },
    ],
    cellCount: 2,
  };

  const currentFormatState: RecoveryFormatRangeState = {
    selection: {
      numberFormat: true,
      fillColor: true,
      bold: true,
      columnWidth: true,
      rowHeight: true,
      mergedAreas: true,
      borderTop: true,
    },
    areas: [
      {
        address: "Sheet1!A1:B1",
        rowCount: 1,
        columnCount: 2,
        numberFormat: [["General", "General"]],
        fillColor: "#FFFFFF",
        bold: false,
        columnWidths: [72, 72],
        rowHeights: [20],
        mergedAreas: [],
        borderTop: {
          style: "None",
        },
      },
    ],
    cellCount: 2,
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000001800,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyFormatCellsSnapshot: (address, state) => {
      appliedAddress = address;
      appliedState = state;
      return Promise.resolve(currentFormatState);
    },
  });

  const appended = await log.appendFormatCells({
    toolName: "format_cells",
    toolCallId: "call-format",
    address: "Sheet1!A1:B1",
    changedCount: 2,
    formatRangeState: restoredTargetState,
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Sheet1!A1:B1");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Sheet1!A1:B1");
  assert.deepEqual(withoutUndefined(appliedState), withoutUndefined(restoredTargetState));

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.snapshotKind, "format_cells_state");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
  assert.deepEqual(withoutUndefined(inverse?.formatRangeState), withoutUndefined(currentFormatState));
});

void test("restore applies modify-structure checkpoints and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-structure",
    workbookName: "Structure.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-structure-${idCounter}`;
  };

  let appliedAddress = "";
  let appliedState: RecoveryModifyStructureState | null = null;

  const restoredState: RecoveryModifyStructureState = {
    kind: "sheet_name",
    sheetId: "sheet-id-1",
    name: "Revenue",
  };

  const currentState: RecoveryModifyStructureState = {
    kind: "sheet_name",
    sheetId: "sheet-id-1",
    name: "Revenue (draft)",
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000001900,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyModifyStructureSnapshot: (address, state) => {
      appliedAddress = address;
      appliedState = state;
      return Promise.resolve(currentState);
    },
  });

  const appended = await log.appendModifyStructure({
    toolName: "modify_structure",
    toolCallId: "call-structure",
    address: "Revenue (draft)",
    changedCount: 1,
    modifyStructureState: restoredState,
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Revenue (draft)");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Revenue (draft)");
  assert.deepEqual(appliedState, restoredState);

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.snapshotKind, "modify_structure_state");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
  assert.deepEqual(inverse?.modifyStructureState, currentState);
});

void test("restore applies row-structure checkpoints and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-structure-rows",
    workbookName: "StructureRows.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-structure-rows-${idCounter}`;
  };

  let appliedAddress = "";
  let appliedState: RecoveryModifyStructureState | null = null;

  const restoredState: RecoveryModifyStructureState = {
    kind: "rows_absent",
    sheetId: "sheet-id-rows",
    sheetName: "Data",
    position: 4,
    count: 2,
  };

  const currentState: RecoveryModifyStructureState = {
    kind: "rows_present",
    sheetId: "sheet-id-rows",
    sheetName: "Data",
    position: 4,
    count: 2,
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000001950,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyModifyStructureSnapshot: (address, state) => {
      appliedAddress = address;
      appliedState = state;
      return Promise.resolve(currentState);
    },
  });

  const appended = await log.appendModifyStructure({
    toolName: "modify_structure",
    toolCallId: "call-structure-rows",
    address: "Data!4:5",
    changedCount: 2,
    modifyStructureState: restoredState,
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Data!4:5");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Data!4:5");
  assert.deepEqual(appliedState, restoredState);

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.snapshotKind, "modify_structure_state");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
  assert.deepEqual(inverse?.modifyStructureState, currentState);
});

void test("restore round-trips extended modify-structure kinds", async () => {
  const scenarios: ReadonlyArray<{
    name: string;
    address: string;
    changedCount: number;
    targetState: RecoveryModifyStructureState;
    currentState: RecoveryModifyStructureState;
  }> = [
    {
      name: "sheet_absent",
      address: "Draft",
      changedCount: 1,
      targetState: {
        kind: "sheet_absent",
        sheetId: "sheet-draft",
        sheetName: "Draft",
      },
      currentState: {
        kind: "sheet_present",
        sheetId: "sheet-draft",
        sheetName: "Draft",
        position: 1,
        visibility: "Visible",
      },
    },
    {
      name: "sheet_present",
      address: "Backlog",
      changedCount: 1,
      targetState: {
        kind: "sheet_present",
        sheetId: "sheet-backlog",
        sheetName: "Backlog",
        position: 3,
        visibility: "Hidden",
      },
      currentState: {
        kind: "sheet_absent",
        sheetId: "sheet-backlog",
        sheetName: "Backlog",
      },
    },
    {
      name: "rows_absent",
      address: "Data!8:9",
      changedCount: 2,
      targetState: {
        kind: "rows_absent",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 8,
        count: 2,
      },
      currentState: {
        kind: "rows_present",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 8,
        count: 2,
      },
    },
    {
      name: "rows_present",
      address: "Data!15:16",
      changedCount: 2,
      targetState: {
        kind: "rows_present",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 15,
        count: 2,
      },
      currentState: {
        kind: "rows_absent",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 15,
        count: 2,
      },
    },
    {
      name: "columns_absent",
      address: "Data!C:D",
      changedCount: 2,
      targetState: {
        kind: "columns_absent",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 3,
        count: 2,
      },
      currentState: {
        kind: "columns_present",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 3,
        count: 2,
      },
    },
    {
      name: "columns_present",
      address: "Data!F:G",
      changedCount: 2,
      targetState: {
        kind: "columns_present",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 6,
        count: 2,
      },
      currentState: {
        kind: "columns_absent",
        sheetId: "sheet-grid",
        sheetName: "Data",
        position: 6,
        count: 2,
      },
    },
  ];

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    if (!scenario) {
      throw new Error("Expected structure scenario.");
    }

    const settingsStore = createInMemorySettingsStore();

    const workbookContext: WorkbookContext = {
      workbookId: `url_sha256:workbook-structure-roundtrip-${index}`,
      workbookName: "StructureRoundtrip.xlsx",
      source: "document.url",
    };

    let idCounter = 0;
    const createId = (): string => {
      idCounter += 1;
      return `snap-structure-roundtrip-${index}-${idCounter}`;
    };

    let appliedAddress = "";
    let appliedState: RecoveryModifyStructureState | null = null;

    const log = new WorkbookRecoveryLog({
      getSettingsStore: () => Promise.resolve(settingsStore),
      getWorkbookContext: () => Promise.resolve(workbookContext),
      now: () => 1700000001960 + index,
      createId,
      applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
      applyModifyStructureSnapshot: (address, state) => {
        appliedAddress = address;
        appliedState = state;
        return Promise.resolve(scenario.currentState);
      },
    });

    const appended = await log.appendModifyStructure({
      toolName: "modify_structure",
      toolCallId: `call-structure-roundtrip-${scenario.name}`,
      address: scenario.address,
      changedCount: scenario.changedCount,
      modifyStructureState: scenario.targetState,
    });

    assert.ok(appended, `Expected appended checkpoint for ${scenario.name}.`);
    if (!appended) {
      throw new Error(`Expected appended checkpoint for ${scenario.name}.`);
    }

    const restored = await log.restore(appended.id);

    assert.equal(restored.address, scenario.address, `Expected restored address for ${scenario.name}.`);
    assert.equal(
      restored.restoredSnapshotId,
      appended.id,
      `Expected restored snapshot id for ${scenario.name}.`,
    );
    assert.equal(appliedAddress, scenario.address, `Expected apply address for ${scenario.name}.`);
    assert.deepEqual(appliedState, scenario.targetState, `Expected target state for ${scenario.name}.`);

    const snapshots = await log.listForCurrentWorkbook(10);
    const inverse = restored.inverseSnapshotId
      ? findSnapshotById(snapshots, restored.inverseSnapshotId)
      : null;

    assert.ok(inverse, `Expected inverse snapshot for ${scenario.name}.`);
    assert.equal(inverse?.snapshotKind, "modify_structure_state", `Expected structure kind for ${scenario.name}.`);
    assert.equal(inverse?.restoredFromSnapshotId, appended.id, `Expected inverse source for ${scenario.name}.`);
    assert.deepEqual(
      inverse?.modifyStructureState,
      scenario.currentState,
      `Expected inverse state for ${scenario.name}.`,
    );
  }
});

void test("restore applies conditional-format checkpoints and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-cf",
    workbookName: "Formatting.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-cf-${idCounter}`;
  };

  let appliedAddress = "";
  const appliedRules: unknown[] = [];

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000002000,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyConditionalFormatSnapshot: (address, rules) => {
      appliedAddress = address;
      appliedRules.push(...rules);
      return Promise.resolve({
        supported: true,
        rules: [{
          type: "custom",
          formula: "=A1>0",
          fillColor: "#00FF00",
          appliesToAddress: "Sheet1!A1:A2",
        }],
      });
    },
  });

  const appended = await log.appendConditionalFormat({
    toolName: "conditional_format",
    toolCallId: "call-cf",
    address: "Sheet1!A1:B2",
    changedCount: 4,
    cellCount: 4,
    conditionalFormatRules: [
      {
        type: "custom",
        formula: "=A1>10",
        fillColor: "#FF0000",
        appliesToAddress: "Sheet1!A1:A2",
      },
      {
        type: "cell_value",
        operator: "GreaterThan",
        formula1: "10",
        fillColor: "#0000FF",
        appliesToAddress: "Sheet1!B1:B2",
      },
      {
        type: "text_comparison",
        textOperator: "Contains",
        text: "urgent",
        fillColor: "#FFE599",
        appliesToAddress: "Sheet1!C1:C2",
      },
      {
        type: "top_bottom",
        topBottomType: "TopItems",
        rank: 3,
        fillColor: "#E2EFDA",
        appliesToAddress: "Sheet1!D1:D10",
      },
      {
        type: "preset_criteria",
        presetCriterion: "DuplicateValues",
        fillColor: "#FCE4D6",
        appliesToAddress: "Sheet1!E1:E10",
      },
      {
        type: "data_bar",
        stopIfTrue: true,
        appliesToAddress: "Sheet1!F1:F10",
        dataBar: {
          axisColor: "#000000",
          axisFormat: "Automatic",
          barDirection: "Context",
          showDataBarOnly: false,
          lowerBoundRule: { type: "LowestValue" },
          upperBoundRule: { type: "HighestValue" },
          positiveFillColor: "#63C384",
          positiveBorderColor: "#2E8540",
          positiveGradientFill: true,
          negativeFillColor: "#D13438",
          negativeBorderColor: "#A4262C",
          negativeMatchPositiveFillColor: false,
          negativeMatchPositiveBorderColor: false,
        },
      },
      {
        type: "color_scale",
        stopIfTrue: false,
        appliesToAddress: "Sheet1!G1:G10",
        colorScale: {
          minimum: { type: "LowestValue", color: "#F8696B" },
          midpoint: { type: "Percentile", formula: "50", color: "#FFEB84" },
          maximum: { type: "HighestValue", color: "#63BE7B" },
        },
      },
      {
        type: "icon_set",
        stopIfTrue: true,
        appliesToAddress: "Sheet1!H1:H10",
        iconSet: {
          style: "ThreeTrafficLights1",
          reverseIconOrder: false,
          showIconOnly: false,
          criteria: [
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "0" },
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "33" },
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "67" },
          ],
        },
      },
    ],
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Sheet1!A1:B2");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Sheet1!A1:B2");
  assert.equal(appliedRules.length, 8);
  assert.deepEqual(
    withoutUndefined(appliedRules),
    withoutUndefined([
      {
        type: "custom",
        formula: "=A1>10",
        fillColor: "#FF0000",
        appliesToAddress: "Sheet1!A1:A2",
      },
      {
        type: "cell_value",
        operator: "GreaterThan",
        formula1: "10",
        fillColor: "#0000FF",
        appliesToAddress: "Sheet1!B1:B2",
      },
      {
        type: "text_comparison",
        textOperator: "Contains",
        text: "urgent",
        fillColor: "#FFE599",
        appliesToAddress: "Sheet1!C1:C2",
      },
      {
        type: "top_bottom",
        topBottomType: "TopItems",
        rank: 3,
        fillColor: "#E2EFDA",
        appliesToAddress: "Sheet1!D1:D10",
      },
      {
        type: "preset_criteria",
        presetCriterion: "DuplicateValues",
        fillColor: "#FCE4D6",
        appliesToAddress: "Sheet1!E1:E10",
      },
      {
        type: "data_bar",
        stopIfTrue: true,
        appliesToAddress: "Sheet1!F1:F10",
        dataBar: {
          axisColor: "#000000",
          axisFormat: "Automatic",
          barDirection: "Context",
          showDataBarOnly: false,
          lowerBoundRule: { type: "LowestValue" },
          upperBoundRule: { type: "HighestValue" },
          positiveFillColor: "#63C384",
          positiveBorderColor: "#2E8540",
          positiveGradientFill: true,
          negativeFillColor: "#D13438",
          negativeBorderColor: "#A4262C",
          negativeMatchPositiveFillColor: false,
          negativeMatchPositiveBorderColor: false,
        },
      },
      {
        type: "color_scale",
        stopIfTrue: false,
        appliesToAddress: "Sheet1!G1:G10",
        colorScale: {
          minimum: { type: "LowestValue", color: "#F8696B" },
          midpoint: { type: "Percentile", formula: "50", color: "#FFEB84" },
          maximum: { type: "HighestValue", color: "#63BE7B" },
        },
      },
      {
        type: "icon_set",
        stopIfTrue: true,
        appliesToAddress: "Sheet1!H1:H10",
        iconSet: {
          style: "ThreeTrafficLights1",
          reverseIconOrder: false,
          showIconOnly: false,
          criteria: [
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "0" },
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "33" },
            { type: "Percent", operator: "GreaterThanOrEqual", formula: "67" },
          ],
        },
      },
    ]),
  );

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.snapshotKind, "conditional_format_rules");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
  assert.deepEqual(
    (inverse?.conditionalFormatRules ?? []).map((rule) => ({
      type: rule.type,
      formula: rule.formula,
      fillColor: rule.fillColor,
      appliesToAddress: rule.appliesToAddress,
    })),
    [{
      type: "custom",
      formula: "=A1>0",
      fillColor: "#00FF00",
      appliesToAddress: "Sheet1!A1:A2",
    }],
  );
});

void test("restore round-trips conditional-format rules in target and inverse snapshots", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-cf-roundtrip",
    workbookName: "ConditionalRoundtrip.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-cf-roundtrip-${idCounter}`;
  };

  const targetRules: RecoveryConditionalFormatRule[] = [
    {
      type: "custom",
      formula: "=A1>5",
      fillColor: "#F4CCCC",
      appliesToAddress: "Sheet1!A1:A3",
    },
    {
      type: "data_bar",
      appliesToAddress: "Sheet1!B1:B10",
      dataBar: {
        axisColor: "#000000",
        axisFormat: "Automatic",
        barDirection: "Context",
        showDataBarOnly: false,
        lowerBoundRule: { type: "LowestValue" },
        upperBoundRule: { type: "HighestValue" },
      },
    },
    {
      type: "icon_set",
      appliesToAddress: "Sheet1!C1:C6",
      iconSet: {
        style: "ThreeSymbols",
        reverseIconOrder: false,
        showIconOnly: false,
        criteria: [
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "0" },
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "33" },
          { type: "Percent", operator: "GreaterThanOrEqual", formula: "67" },
        ],
      },
    },
  ];

  const currentRules: RecoveryConditionalFormatRule[] = [
    {
      type: "text_comparison",
      textOperator: "Contains",
      text: "priority",
      fillColor: "#FFF2CC",
      appliesToAddress: "Sheet1!D1:D10",
    },
    {
      type: "color_scale",
      appliesToAddress: "Sheet1!E1:E10",
      colorScale: {
        minimum: { type: "LowestValue", color: "#F8696B" },
        midpoint: { type: "Percentile", formula: "50", color: "#FFEB84" },
        maximum: { type: "HighestValue", color: "#63BE7B" },
      },
    },
  ];

  let appliedAddress = "";
  let appliedRules: RecoveryConditionalFormatRule[] = [];

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000002500,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyConditionalFormatSnapshot: (address, rules) => {
      appliedAddress = address;
      appliedRules = [...rules];
      return Promise.resolve({
        supported: true,
        rules: currentRules,
      });
    },
  });

  const appended = await log.appendConditionalFormat({
    toolName: "conditional_format",
    toolCallId: "call-cf-roundtrip",
    address: "Sheet1!A1:E10",
    changedCount: 10,
    cellCount: 10,
    conditionalFormatRules: targetRules,
  });

  assert.ok(appended);
  if (!appended) {
    throw new Error("Expected appended conditional format checkpoint.");
  }

  const restored = await log.restore(appended.id);

  assert.equal(restored.address, "Sheet1!A1:E10");
  assert.equal(restored.restoredSnapshotId, appended.id);
  assert.equal(appliedAddress, "Sheet1!A1:E10");
  assert.deepEqual(withoutUndefined(appliedRules), withoutUndefined(targetRules));

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.snapshotKind, "conditional_format_rules");
  assert.equal(inverse?.restoredFromSnapshotId, appended.id);
  assert.deepEqual(withoutUndefined(inverse?.conditionalFormatRules), withoutUndefined(currentRules));
});

void test("restore applies comment-thread checkpoints and creates inverse checkpoint", async () => {
  const settingsStore = createInMemorySettingsStore();

  const workbookContext: WorkbookContext = {
    workbookId: "url_sha256:workbook-comments",
    workbookName: "Comments.xlsx",
    source: "document.url",
  };

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-comment-${idCounter}`;
  };

  let appliedAddress = "";
  let appliedState: unknown = null;

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve(workbookContext),
    now: () => 1700000003000,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
    applyCommentThreadSnapshot: (address, state) => {
      appliedAddress = address;
      appliedState = state;
      return Promise.resolve({
        exists: true,
        content: "Current comment",
        resolved: false,
        replies: ["Current reply"],
      });
    },
  });

  const appended = await log.appendCommentThread({
    toolName: "comments",
    toolCallId: "call-comment",
    address: "Sheet1!C3",
    changedCount: 1,
    commentThreadState: {
      exists: true,
      content: "Original comment",
      resolved: true,
      replies: ["Original reply"],
    },
  });

  assert.ok(appended);

  const restored = await log.restore(appended?.id ?? "");

  assert.equal(restored.address, "Sheet1!C3");
  assert.equal(restored.restoredSnapshotId, appended?.id);
  assert.equal(appliedAddress, "Sheet1!C3");
  assert.deepEqual(appliedState, {
    exists: true,
    content: "Original comment",
    resolved: true,
    replies: ["Original reply"],
  });

  const snapshots = await log.listForCurrentWorkbook(10);
  const inverse = restored.inverseSnapshotId
    ? findSnapshotById(snapshots, restored.inverseSnapshotId)
    : null;

  assert.ok(inverse);
  assert.equal(inverse?.toolName, "restore_snapshot");
  assert.equal(inverse?.snapshotKind, "comment_thread");
  assert.equal(inverse?.restoredFromSnapshotId, appended?.id);
});

void test("restore round-trips comment-thread states for present and absent threads", async () => {
  const scenarios: ReadonlyArray<{
    name: string;
    targetState: RecoveryCommentThreadState;
    currentState: RecoveryCommentThreadState;
  }> = [
    {
      name: "present",
      targetState: {
        exists: true,
        content: "Original thread",
        resolved: false,
        replies: ["Reply A", "Reply B"],
      },
      currentState: {
        exists: true,
        content: "Current thread",
        resolved: true,
        replies: ["Current reply"],
      },
    },
    {
      name: "absent",
      targetState: {
        exists: false,
        content: "",
        resolved: false,
        replies: [],
      },
      currentState: {
        exists: true,
        content: "Current thread before delete",
        resolved: false,
        replies: ["Keep me"],
      },
    },
  ];

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    if (!scenario) {
      throw new Error("Expected comment scenario.");
    }

    const settingsStore = createInMemorySettingsStore();

    const workbookContext: WorkbookContext = {
      workbookId: `url_sha256:workbook-comment-roundtrip-${index}`,
      workbookName: "CommentsRoundtrip.xlsx",
      source: "document.url",
    };

    let idCounter = 0;
    const createId = (): string => {
      idCounter += 1;
      return `snap-comment-roundtrip-${index}-${idCounter}`;
    };

    let appliedAddress = "";
    let appliedState: RecoveryCommentThreadState | null = null;

    const log = new WorkbookRecoveryLog({
      getSettingsStore: () => Promise.resolve(settingsStore),
      getWorkbookContext: () => Promise.resolve(workbookContext),
      now: () => 1700000003200 + index,
      createId,
      applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
      applyCommentThreadSnapshot: (address, state) => {
        appliedAddress = address;
        appliedState = state;
        return Promise.resolve(scenario.currentState);
      },
    });

    const address = `Sheet1!C${index + 10}`;
    const appended = await log.appendCommentThread({
      toolName: "comments",
      toolCallId: `call-comment-roundtrip-${scenario.name}`,
      address,
      changedCount: 1,
      commentThreadState: scenario.targetState,
    });

    assert.ok(appended, `Expected appended comment checkpoint for ${scenario.name}.`);
    if (!appended) {
      throw new Error(`Expected appended comment checkpoint for ${scenario.name}.`);
    }

    const restored = await log.restore(appended.id);

    assert.equal(restored.address, address, `Expected restored address for ${scenario.name}.`);
    assert.equal(
      restored.restoredSnapshotId,
      appended.id,
      `Expected restored snapshot id for ${scenario.name}.`,
    );
    assert.equal(appliedAddress, address, `Expected apply address for ${scenario.name}.`);
    assert.deepEqual(appliedState, scenario.targetState, `Expected applied state for ${scenario.name}.`);

    const snapshots = await log.listForCurrentWorkbook(10);
    const inverse = restored.inverseSnapshotId
      ? findSnapshotById(snapshots, restored.inverseSnapshotId)
      : null;

    assert.ok(inverse, `Expected inverse snapshot for ${scenario.name}.`);
    assert.equal(inverse?.snapshotKind, "comment_thread", `Expected comment kind for ${scenario.name}.`);
    assert.equal(inverse?.restoredFromSnapshotId, appended.id, `Expected inverse source for ${scenario.name}.`);
    assert.deepEqual(
      inverse?.commentThreadState,
      scenario.currentState,
      `Expected inverse state for ${scenario.name}.`,
    );
  }
});

void test("clearForCurrentWorkbook removes only matching workbook checkpoints", async () => {
  const settingsStore = createInMemorySettingsStore();

  let currentWorkbookId: string | null = "url_sha256:workbook-c";
  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: currentWorkbookId,
    workbookName: "Workbook",
    source: currentWorkbookId ? "document.url" : "unknown",
  });

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-${idCounter}`;
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
  });

  await log.append({
    toolName: "write_cells",
    toolCallId: "call-3",
    address: "Sheet1!A1",
    beforeValues: [["a"]],
    beforeFormulas: [["a"]],
  });

  currentWorkbookId = "url_sha256:workbook-d";

  await log.append({
    toolName: "write_cells",
    toolCallId: "call-4",
    address: "Sheet1!A2",
    beforeValues: [["b"]],
    beforeFormulas: [["b"]],
  });

  currentWorkbookId = "url_sha256:workbook-c";
  const removed = await log.clearForCurrentWorkbook();
  assert.equal(removed, 1);

  const remainingCurrent = await log.listForCurrentWorkbook(10);
  assert.equal(remainingCurrent.length, 0);

  const remainingAll = await log.list({ limit: 10 });
  assert.equal(remainingAll.length, 1);
  assert.equal(remainingAll[0]?.toolCallId, "call-4");
});

void test("clearForCurrentWorkbook is a no-op when workbook identity is unavailable", async () => {
  const settingsStore = createInMemorySettingsStore();

  await settingsStore.set(RECOVERY_SETTING_KEY, {
    version: 1,
    snapshots: [
      {
        id: "snap-a",
        at: 1700000000000,
        toolName: "write_cells",
        toolCallId: "call-a",
        address: "Sheet1!A1",
        changedCount: 1,
        cellCount: 1,
        beforeValues: [["a"]],
        beforeFormulas: [["a"]],
        workbookId: "url_sha256:a",
      },
    ],
  });

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: (): Promise<WorkbookContext> => Promise.resolve({
      workbookId: null,
      workbookName: null,
      source: "unknown",
    }),
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
  });

  const removed = await log.clearForCurrentWorkbook();
  assert.equal(removed, 0);
  assert.equal((await log.list({ limit: 10 })).length, 1);
});

void test("restore rejects checkpoints from another workbook", async () => {
  const settingsStore = createInMemorySettingsStore();

  let currentWorkbookId: string | null = "url_sha256:workbook-src";
  const getWorkbookContext = (): Promise<WorkbookContext> => Promise.resolve({
    workbookId: currentWorkbookId,
    workbookName: "Workbook",
    source: currentWorkbookId ? "document.url" : "unknown",
  });

  let idCounter = 0;
  const createId = (): string => {
    idCounter += 1;
    return `snap-${idCounter}`;
  };

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext,
    createId,
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
  });

  const snapshot = await log.append({
    toolName: "write_cells",
    toolCallId: "call-5",
    address: "Sheet1!B2",
    beforeValues: [["before"]],
    beforeFormulas: [["before"]],
  });

  assert.ok(snapshot);

  currentWorkbookId = "url_sha256:workbook-other";

  await assert.rejects(
    async () => log.restore(snapshot?.id ?? ""),
    /different workbook/i,
  );
});

void test("append skips oversized checkpoints", async () => {
  const settingsStore = createInMemorySettingsStore();

  const log = new WorkbookRecoveryLog({
    getSettingsStore: () => Promise.resolve(settingsStore),
    getWorkbookContext: () => Promise.resolve({
      workbookId: "url_sha256:big-workbook",
      workbookName: "Big.xlsx",
      source: "document.url",
    }),
    applySnapshot: () => Promise.resolve({ values: [[1]], formulas: [[1]] }),
  });

  const rows = 201;
  const cols = 101;
  const bigValues = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "v"));
  const bigFormulas = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

  assert.ok(rows * cols > MAX_RECOVERY_CELLS);

  const snapshot = await log.append({
    toolName: "write_cells",
    toolCallId: "call-big",
    address: "Sheet1!A1:CZ201",
    beforeValues: bigValues,
    beforeFormulas: bigFormulas,
  });

  assert.equal(snapshot, null);

  const entries = await log.listForCurrentWorkbook(10);
  assert.equal(entries.length, 0);
});
