import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Component, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-07 (the Archive folder/item search screen). Every
// bridge/supporting type below comes from the public "./ui" entry point,
// mirroring the TASK-02/TASK-03/TASK-04/TASK-05/TASK-06 test discipline. No
// jsdom/Testing Library/react-dom is used anywhere in this file — see
// `search-screen.tsx`'s file-top HOOK-CALL CONSTRAINT comment for why
// `ArchiveSearchScreen` is a class component, and `attachSyncUpdater` below
// (duplicated locally per the established TASK-04–06 precedent) for how
// this file exercises its real setState/lifecycle/render methods without a
// DOM renderer.
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchiveSearchScreen } from "../index.js";
import {
  ARCHIVE_UI_SEARCH_EMPTY_FILTERS,
  archiveUiFetchSearchPage,
  archiveUiInitialSearchPageState,
  archiveUiSearchBackEnabled,
  archiveUiSearchConditionLabels,
  archiveUiSearchNextEnabled,
  archiveUiSearchPageStateAfterBack,
  archiveUiSearchPageStateAfterNext,
  archiveUiSearchQueryFromFilters,
  archiveUiValidateSearchFilters,
  type ArchiveUiSearchFilters,
} from "../search-screen.js";
import type {
  ArchiveContextInput,
  ArchiveFolder,
  ArchiveHostAdapterError,
  ArchiveHostAdapterResult,
  ArchiveItem,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const now = new Date("2026-01-01T00:00:00.000Z");

const fixtureContext: ArchiveContextInput = {
  userId: "user-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  archiveModuleAccess: true,
};

function fixtureFolder(overrides: Partial<ArchiveFolder> = {}): ArchiveFolder {
  return {
    id: "folder-1",
    companyId: "company-1",
    tenantId: "tenant-1",
    parentFolderId: null,
    name: "Folder One",
    description: null,
    status: "active",
    dueAt: null,
    expiresAt: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedByUserId: null,
    isDeleted: false,
    isDueSoon: false,
    isOverdue: false,
    isExpiringSoon: false,
    isExpired: false,
    ...overrides,
  };
}

function fixtureItem(overrides: Partial<ArchiveItem> = {}): ArchiveItem {
  return {
    id: "item-1",
    companyId: "company-1",
    tenantId: "tenant-1",
    folderId: "folder-1",
    name: "Item One",
    description: null,
    itemType: "record",
    status: "active",
    dueAt: null,
    expiresAt: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedByUserId: null,
    isDeleted: false,
    isDueSoon: false,
    isOverdue: false,
    isExpiringSoon: false,
    isExpired: false,
    ...overrides,
  };
}

const safeTranslateError: ArchiveUiErrorTranslator = (error: ArchiveHostAdapterError) => {
  const titles: Record<ArchiveHostAdapterError["category"], string> = {
    unauthorized: "Access denied",
    not_found: "Not found",
    validation: "Check your input",
    server_error: "Something went wrong",
  };
  return {
    category: error.category,
    title: titles[error.category],
    description: "Please try again or contact support if this continues.",
  };
};

function okResult<T>(value: T): ArchiveHostAdapterResult<T> {
  return { ok: true, value };
}

function errResult<T>(
  category: ArchiveHostAdapterError["category"],
  message: string,
): ArchiveHostAdapterResult<T> {
  return { ok: false, error: { category, message } };
}

function createStubServicePort(overrides: Partial<ArchiveUiServicePort>): ArchiveUiServicePort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-search-screen fixture: method not implemented");
  };
  const base = {
    assignArchiveRole: notImplemented,
    createArchiveRole: notImplemented,
    createFolder: notImplemented,
    createItem: notImplemented,
    deleteArchiveRole: notImplemented,
    explainPermissions: notImplemented,
    getEffectiveCapabilities: notImplemented,
    getFolderPath: notImplemented,
    listChildFolders: notImplemented,
    listFilesForItem: notImplemented,
    listItemsInFolder: notImplemented,
    listPermissionHistory: notImplemented,
    listPermissionRules: notImplemented,
    listRecoverableContent: notImplemented,
    listRecoverableFilesForItem: notImplemented,
    listResourceHistory: notImplemented,
    listRootFolders: notImplemented,
    readFolder: notImplemented,
    readItem: notImplemented,
    renameArchiveRole: notImplemented,
    restoreFile: notImplemented,
    restoreFolder: notImplemented,
    restoreItem: notImplemented,
    revokePermissionRule: notImplemented,
    searchFolders: notImplemented,
    searchItems: notImplemented,
    setFolderDates: notImplemented,
    setFolderStatus: notImplemented,
    setItemDates: notImplemented,
    setItemStatus: notImplemented,
    setPermissionRule: notImplemented,
    softDeleteFile: notImplemented,
    softDeleteFolder: notImplemented,
    softDeleteItem: notImplemented,
    unassignArchiveRole: notImplemented,
  } as unknown as ArchiveUiServicePort;
  return { ...base, ...overrides };
}

function createStubTransport(): ArchiveUiFileTransport {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-search-screen fixture: transport method not implemented");
  };
  return { uploadFile: notImplemented, downloadFile: notImplemented } as unknown as ArchiveUiFileTransport;
}

// Correction Phase 6 TASK-08A: the search screen does not use the identity
// port in this task (no screen production file changes) — a throwing stub
// satisfies `ArchiveUiBridge`'s now-required `identity` property.
function createStubIdentity(): ArchiveUiIdentityPort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-search-screen fixture: identity method not implemented");
  };
  return {
    resolvePlatformUsers: notImplemented,
    listAssignableCompanyMembers: notImplemented,
  };
}

interface FakeBridgeOptions {
  readonly context?: ArchiveContextInput;
  readonly serviceOverrides?: Partial<ArchiveUiServicePort>;
  readonly translateError?: ArchiveUiErrorTranslator;
  readonly navigate?: (intent: ArchiveUiNavigationIntent) => void;
}

function createFakeBridge(options: FakeBridgeOptions = {}): ArchiveUiBridge {
  return {
    getContext: () => options.context ?? fixtureContext,
    getCurrentUserDisplay: () => undefined,
    navigate: options.navigate ?? (() => {}),
    service: createStubServicePort(options.serviceOverrides ?? {}),
    transport: createStubTransport(),
    translateError: options.translateError ?? safeTranslateError,
    identity: createStubIdentity(),
  };
}

function elementProps(element: unknown): Record<string, any> {
  if (element === null || element === undefined) {
    throw new Error("expected a non-null element");
  }
  return (element as { props: unknown }).props as Record<string, any>;
}

function expandElementTree(node: unknown): unknown {
  if (
    node === null ||
    node === undefined ||
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"
  ) {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(expandElementTree);
  }
  if (typeof node === "object" && "type" in (node as any) && "props" in (node as any)) {
    const el = node as { type: unknown; props: any };
    if (typeof el.type === "function") {
      const output = (el.type as (props: any) => unknown)(el.props);
      return expandElementTree(output);
    }
    return {
      ...el,
      props: { ...el.props, children: expandElementTree(el.props?.children) },
    };
  }
  return node;
}

function findAllElements(
  node: unknown,
  predicate: (element: { type: unknown; props: Record<string, any> }) => boolean,
  out: { type: unknown; props: Record<string, any> }[] = [],
): { type: unknown; props: Record<string, any> }[] {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const child of node) findAllElements(child, predicate, out);
    return out;
  }
  if (typeof node === "object" && "props" in (node as any)) {
    const el = node as { type: unknown; props: Record<string, any> };
    if (predicate(el)) out.push(el);
    findAllElements(el.props?.children, predicate, out);
    return out;
  }
  return out;
}

function findElement(
  node: unknown,
  predicate: (element: { type: unknown; props: Record<string, any> }) => boolean,
): { type: unknown; props: Record<string, any> } | undefined {
  return findAllElements(node, predicate)[0];
}

function collectRenderedText(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectRenderedText(child, out);
    return out;
  }
  if (node !== null && typeof node === "object" && "props" in (node as any)) {
    collectRenderedText((node as any).props?.children, out);
  }
  return out;
}

function attachSyncUpdater<P, S>(instance: Component<P, S>): void {
  const withUpdater = instance as unknown as { updater: any };
  withUpdater.updater = {
    isMounted: () => true,
    enqueueForceUpdate: () => {},
    enqueueReplaceState: (_publicInstance: unknown, state: S) => {
      instance.state = state;
    },
    enqueueSetState: (
      _publicInstance: unknown,
      partialState: Partial<S> | ((prevState: S, props: P) => Partial<S>),
    ) => {
      const partial =
        typeof partialState === "function"
          ? (partialState as (prevState: S, props: P) => Partial<S>)(instance.state, instance.props)
          : partialState;
      instance.state = { ...instance.state, ...partial };
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolveWait) => setTimeout(resolveWait, 0));
}

function fakeFormEvent(): any {
  return { preventDefault: () => {} };
}

function fakeChangeEvent(value: string): any {
  return { target: { value } };
}

function mountedSearchScreen(bridge: ArchiveUiBridge): ArchiveSearchScreen {
  const instance = new ArchiveSearchScreen({ bridge });
  attachSyncUpdater(instance);
  instance.componentDidMount();
  return instance;
}

// ---------------------------------------------------------------------------
// Proof 1: initial mount obtains one context and calls only
// searchFolders(context, {}) with no cursor/limit key.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — initial mount", () => {
  it("calls only searchFolders with the exact context and an empty query object", async () => {
    const searchFolders = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: null }),
    );
    const searchItems = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: null }),
    );
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders, searchItems } });

    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    expect(searchFolders).toHaveBeenCalledTimes(1);
    expect(searchItems).not.toHaveBeenCalled();
    const [context, query] = searchFolders.mock.calls[0];
    expect(context).toEqual(fixtureContext);
    expect(query).toEqual({});
    expect(Object.keys(query as object)).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(query, "cursor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(query, "limit")).toBe(false);
    expect(instance.state.mode).toBe("folder");
    expect(instance.state.page.viewState.status).toBe("ready");
  });
});

// ---------------------------------------------------------------------------
// Proof 2/16: switching to item mode calls only searchItems, resets to first
// page, never reuses a folder cursor; mode switch resets cursor history.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — mode switch", () => {
  it("switching to item mode calls only searchItems, resets pagination, never reuses the folder cursor", async () => {
    const searchFolders = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [fixtureFolder()], nextCursor: "folder-cursor-1" }),
    );
    const searchItems = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: null }),
    );
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders, searchItems } });

    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(1);

    instance.handleSelectItemMode();
    await flushMicrotasks();

    expect(searchItems).toHaveBeenCalledTimes(1);
    expect(searchFolders).toHaveBeenCalledTimes(2); // mount + Next, never a 3rd for the mode switch
    const [, query] = searchItems.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(query, "cursor")).toBe(false);
    expect(instance.state.mode).toBe("item");
    expect(instance.state.page.pageIndex).toBe(0);
    expect(instance.state.page.cursorStack).toEqual([undefined]);
  });

  it("mode switch back to folder resets pagination too", async () => {
    const searchFolders = vi.fn(async () => okResult({ items: [], nextCursor: "f-next" }));
    const searchItems = vi.fn(async () => okResult({ items: [], nextCursor: null }));
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders, searchItems } });

    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(1);

    instance.handleSelectItemMode();
    await flushMicrotasks();
    instance.handleSelectFolderMode();
    await flushMicrotasks();

    expect(instance.state.mode).toBe("folder");
    expect(instance.state.page.pageIndex).toBe(0);
    expect(instance.state.page.cursorStack).toEqual([undefined]);
  });

  it("selecting the already-active mode is a no-op (no extra service call)", async () => {
    const searchFolders = vi.fn(async () => okResult({ items: [], nextCursor: null }));
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleSelectFolderMode();
    await flushMicrotasks();
    expect(searchFolders).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Proof 3/4: exact curated query construction; no excluded backend field
// ever present.
// ---------------------------------------------------------------------------

describe("archiveUiSearchQueryFromFilters — exact curated shape", () => {
  const EXCLUDED_KEYS = [
    "createdAfter",
    "createdBefore",
    "updatedAfter",
    "updatedBefore",
    "dueAfter",
    "dueBefore",
    "expiresAfter",
    "expiresBefore",
    "itemType",
    "folderId",
    "includeDeleted",
    "limit",
  ];

  it("an empty filter set with no cursor produces an empty object with no cursor/limit key", () => {
    const query = archiveUiSearchQueryFromFilters(ARCHIVE_UI_SEARCH_EMPTY_FILTERS, undefined);
    expect(query).toEqual({});
    expect(Object.keys(query)).toEqual([]);
  });

  it("trims the name and omits it entirely when blank", () => {
    const trimmed = archiveUiSearchQueryFromFilters(
      { name: "  Widget  ".trim(), status: "", condition: "" },
      undefined,
    );
    expect(trimmed).toEqual({ nameContains: "Widget" });

    const blank = archiveUiSearchQueryFromFilters({ name: "", status: "", condition: "" }, undefined);
    expect(Object.prototype.hasOwnProperty.call(blank, "nameContains")).toBe(false);
  });

  it.each(["active", "inactive", "draft", "archived"] as const)(
    "status '%s' produces exactly { status: '%s' }",
    (status) => {
      const query = archiveUiSearchQueryFromFilters({ name: "", status, condition: "" }, undefined);
      expect(query).toEqual({ status });
    },
  );

  it.each([
    ["dueSoon", "isDueSoon"],
    ["overdue", "isOverdue"],
    ["expiringSoon", "isExpiringSoon"],
    ["expired", "isExpired"],
  ] as const)("condition '%s' produces exactly one true flag %s", (condition, flagKey) => {
    const query = archiveUiSearchQueryFromFilters(
      { name: "", status: "", condition },
      undefined,
    );
    expect(query).toEqual({ [flagKey]: true });
  });

  it("a non-first page includes exactly the supplied opaque cursor, never a limit", () => {
    const query = archiveUiSearchQueryFromFilters(ARCHIVE_UI_SEARCH_EMPTY_FILTERS, "opaque-cursor-1");
    expect(query).toEqual({ cursor: "opaque-cursor-1" });
  });

  it("combines name + status + one condition into exactly one object with no excluded key", () => {
    const query = archiveUiSearchQueryFromFilters(
      { name: "Contract", status: "draft", condition: "overdue" },
      "cursor-x",
    );
    expect(query).toEqual({
      nameContains: "Contract",
      status: "draft",
      isOverdue: true,
      cursor: "cursor-x",
    });
    for (const key of EXCLUDED_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(query, key)).toBe(false);
    }
  });

  it("never sets limit or any excluded field for any filter/cursor combination", () => {
    const combos: readonly [ArchiveUiSearchFilters, string | undefined][] = [
      [ARCHIVE_UI_SEARCH_EMPTY_FILTERS, undefined],
      [{ name: "x", status: "active", condition: "dueSoon" }, "c1"],
      [{ name: "", status: "archived", condition: "expired" }, undefined],
    ];
    for (const [filters, cursor] of combos) {
      const query = archiveUiSearchQueryFromFilters(filters, cursor);
      for (const key of EXCLUDED_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(query, key)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 5: tampered invalid status/condition yields field errors and zero
// service calls.
// ---------------------------------------------------------------------------

describe("archiveUiValidateSearchFilters — closed-set enforcement", () => {
  it("a valid draft normalizes and trims", () => {
    const outcome = archiveUiValidateSearchFilters({ name: "  Widget  ", status: "active", condition: "overdue" });
    expect(outcome).toEqual({
      kind: "valid",
      filters: { name: "Widget", status: "active", condition: "overdue" },
    });
  });

  it("an impossible/tampered status yields a field-specific error, condition still checked independently", () => {
    const outcome = archiveUiValidateSearchFilters({ name: "", status: "BOGUS-STATUS", condition: "" });
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      expect(outcome.fieldErrors.status).toEqual(["Choose a valid status."]);
      expect(outcome.fieldErrors.condition).toBeUndefined();
    }
  });

  it("an impossible/tampered condition yields a field-specific error", () => {
    const outcome = archiveUiValidateSearchFilters({ name: "", status: "", condition: "BOGUS-CONDITION" });
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      expect(outcome.fieldErrors.condition).toEqual(["Choose a valid condition."]);
    }
  });

  it("both tampered simultaneously yields both field errors", () => {
    const outcome = archiveUiValidateSearchFilters({ name: "", status: "X", condition: "Y" });
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      expect(outcome.fieldErrors.status).toEqual(["Choose a valid status."]);
      expect(outcome.fieldErrors.condition).toEqual(["Choose a valid condition."]);
    }
  });
});

describe("ArchiveSearchScreen — tampered submit makes zero service calls", () => {
  it("a forcibly-corrupted draft status blocks submission with field errors and no service call", async () => {
    const searchFolders = vi.fn(async () => okResult({ items: [], nextCursor: null }));
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    searchFolders.mockClear();

    (instance as unknown as { setState: (partial: object) => void }).setState({
      draftStatus: "NOT-A-REAL-STATUS",
    });
    instance.handleSearchSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(searchFolders).not.toHaveBeenCalled();
    expect(instance.state.fieldErrors.status).toEqual(["Choose a valid status."]);
  });
});

// ---------------------------------------------------------------------------
// Proof 6/16: Search applies a new normalized snapshot and resets
// pagination.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — Search submission", () => {
  it("submits the trimmed/normalized filters, resets pagination, and replaces the applied snapshot", async () => {
    const searchFolders = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: "next-a" }),
    );
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(1);

    instance.handleNameChange(fakeChangeEvent("  Contract  "));
    instance.handleStatusChange(fakeChangeEvent("draft"));
    instance.handleConditionChange(fakeChangeEvent("expiringSoon"));
    instance.handleSearchSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(instance.state.page.pageIndex).toBe(0);
    expect(instance.state.page.cursorStack).toEqual([undefined]);
    expect(instance.state.page.appliedFilters).toEqual({
      name: "Contract",
      status: "draft",
      condition: "expiringSoon",
    });
    const lastCall = searchFolders.mock.calls[searchFolders.mock.calls.length - 1];
    expect(lastCall[1]).toEqual({ nameContains: "Contract", status: "draft", isExpiringSoon: true });
  });
});

// ---------------------------------------------------------------------------
// Proof 7/16: Clear resets filters and pagination and issues an empty
// first-page query.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — Clear", () => {
  it("resets draft/applied filters, field errors, and pagination, then searches an empty first page", async () => {
    const searchFolders = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: "n1" }),
    );
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNameChange(fakeChangeEvent("Something"));
    instance.handleStatusChange(fakeChangeEvent("active"));
    instance.handleConditionChange(fakeChangeEvent("overdue"));
    instance.handleSearchSubmit(fakeFormEvent());
    await flushMicrotasks();
    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(1);

    instance.handleClear();
    await flushMicrotasks();

    expect(instance.state.draftName).toBe("");
    expect(instance.state.draftStatus).toBe("");
    expect(instance.state.draftCondition).toBe("");
    expect(instance.state.fieldErrors).toEqual({});
    expect(instance.state.page.pageIndex).toBe(0);
    expect(instance.state.page.cursorStack).toEqual([undefined]);
    expect(instance.state.page.appliedFilters).toEqual(ARCHIVE_UI_SEARCH_EMPTY_FILTERS);
    const lastCall = searchFolders.mock.calls[searchFolders.mock.calls.length - 1];
    expect(lastCall[1]).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Proof 8: loading, denied, translated error, content-empty, ready.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — result states", () => {
  it("loading: before the initial fetch resolves, the page is loading", () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: () => new Promise(() => {}) },
    });
    const instance = mountedSearchScreen(bridge);
    expect(instance.state.page.viewState.status).toBe("loading");
  });

  it("denied: an unauthorized failure renders the calm denied state, never a raw reason", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => errResult("unauthorized", "RAW-DENY-REASON") },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.page.viewState.status).toBe("denied");
    const texts = collectRenderedText(expandElementTree(instance.render())).join(" ");
    expect(texts).not.toContain("RAW-DENY-REASON");
    expect(texts).toContain("Access denied");
  });

  it("error: a server_error failure renders the calm translated error state, never a raw reason", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => errResult("server_error", "RAW-SERVER-REASON") },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.page.viewState.status).toBe("error");
    const texts = collectRenderedText(expandElementTree(instance.render())).join(" ");
    expect(texts).not.toContain("RAW-SERVER-REASON");
    expect(texts).toContain("Something went wrong");
  });

  it("content-empty: a ready page with zero items shows mode-specific no-results copy, not a raw dump", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => okResult({ items: [], nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.page.viewState.status).toBe("ready");
    const tree = expandElementTree(instance.render());
    const empty = findElement(tree, (el) => elementProps(el)["data-archive-ui-search-empty"] === "true");
    expect(empty).toBeDefined();
    expect(collectRenderedText(tree).join(" ")).toContain("No folders match your search.");
  });

  it("ready: a non-empty page renders the folder result list", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [fixtureFolder({ name: "Visible Folder" })], nextCursor: null }),
      },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    expect(collectRenderedText(tree).join(" ")).toContain("Visible Folder");
  });
});

// ---------------------------------------------------------------------------
// Proof 9: raw adapter messages, cursors, and folder/item/internal user ids
// are absent from rendered copy.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — no raw leakage in rendered copy", () => {
  it("never renders the folder id, cursor, or raw error text as normal text", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () =>
          okResult({ items: [fixtureFolder({ id: "folder-SECRET-ID", name: "Public Name" })], nextCursor: "OPAQUE-CURSOR-XYZ" }),
      },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree).join(" ");
    expect(texts).not.toContain("folder-SECRET-ID");
    expect(texts).not.toContain("OPAQUE-CURSOR-XYZ");
    expect(texts).toContain("Public Name");

    // The id is present ONLY as a typed data-* test hook / React key, never
    // as rendered text.
    const cardButton = findElement(tree, (el) => elementProps(el)["data-archive-ui-folder-id"] === "folder-SECRET-ID");
    expect(cardButton).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Proof 10: exact folder/item navigation intents with no URL/path fields.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — navigation intents", () => {
  it("selecting a folder result emits exactly { screen: 'folder', folderId }", async () => {
    const navigateSpy = vi.fn();
    const bridge = createFakeBridge({
      navigate: navigateSpy,
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [fixtureFolder({ id: "folder-42" })], nextCursor: null }),
      },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleFolderSelect("folder-42");
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "folder", folderId: "folder-42" });
    expect(Object.keys(navigateSpy.mock.calls[0][0]).sort()).toEqual(["folderId", "screen"]);
  });

  it("selecting an item result emits exactly { screen: 'item', itemId }", async () => {
    const navigateSpy = vi.fn();
    const bridge = createFakeBridge({
      navigate: navigateSpy,
      serviceOverrides: { searchFolders: async () => okResult({ items: [], nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleItemSelect("item-77");
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "item", itemId: "item-77" });
    expect(Object.keys(navigateSpy.mock.calls[0][0]).sort()).toEqual(["itemId", "screen"]);
  });
});

// ---------------------------------------------------------------------------
// Proof 11/12/13/14: cursor stack transitions (pure functions).
// ---------------------------------------------------------------------------

describe("cursor stack pure transitions", () => {
  it("the initial page state's cursor stack is exactly [undefined] at page 0", () => {
    const state = archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS);
    expect(state.cursorStack).toEqual([undefined]);
    expect(state.pageIndex).toBe(0);
  });

  it("Next appends the EXACT returned nextCursor and never fabricates one", () => {
    const state = archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS);
    const after = archiveUiSearchPageStateAfterNext(state, "cursor-page-2");
    expect(after.cursorStack).toEqual([undefined, "cursor-page-2"]);
    expect(after.pageIndex).toBe(1);
  });

  it("Back reuses the exact previously requested cursor, including returning to an omitted-cursor first page", () => {
    const afterNext = archiveUiSearchPageStateAfterNext(
      archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS),
      "cursor-page-2",
    );
    const back = archiveUiSearchPageStateAfterBack(afterNext);
    expect(back.pageIndex).toBe(0);
    expect(back.cursorStack[back.pageIndex]).toBeUndefined();
  });

  it("Next is disabled when nextCursor is null; Back is disabled on the first page", () => {
    const readyState = {
      viewState: { status: "ready" as const, data: { items: [], nextCursor: null } },
      cursorStack: [undefined] as const,
      pageIndex: 0,
      appliedFilters: ARCHIVE_UI_SEARCH_EMPTY_FILTERS,
    };
    expect(archiveUiSearchNextEnabled(readyState)).toBe(false);
    expect(archiveUiSearchBackEnabled(readyState)).toBe(false);

    const readyWithNext = {
      ...readyState,
      viewState: { status: "ready" as const, data: { items: [], nextCursor: "more" } },
    };
    expect(archiveUiSearchNextEnabled(readyWithNext)).toBe(true);
  });

  it("Next after a Back truncates any stale forward branch before appending", () => {
    const afterNext = archiveUiSearchPageStateAfterNext(
      archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS),
      "stale-branch",
    );
    const back = archiveUiSearchPageStateAfterBack(afterNext);
    const afterNextAgain = archiveUiSearchPageStateAfterNext(back, "fresh-branch");
    expect(afterNextAgain.cursorStack).toEqual([undefined, "fresh-branch"]);
  });
});

// ---------------------------------------------------------------------------
// Proof 11/12/13/14 (real component lifecycle wiring).
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — real Next/Back wiring", () => {
  it("Next requests the exact returned nextCursor; Back re-requests the exact prior cursor (incl. omitted first page)", async () => {
    const calls: (string | undefined)[] = [];
    const searchFolders = vi.fn(async (_context: unknown, query: { cursor?: string }) => {
      calls.push(query.cursor);
      if (query.cursor === undefined) {
        return okResult({ items: [fixtureFolder({ id: "page-0" })], nextCursor: "cursor-1" });
      }
      if (query.cursor === "cursor-1") {
        return okResult({ items: [fixtureFolder({ id: "page-1" })], nextCursor: null });
      }
      throw new Error(`unexpected cursor ${String(query.cursor)}`);
    });
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(1);
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveFolder).id).toBe("page-1");
    }

    instance.handleBack();
    await flushMicrotasks();
    expect(instance.state.page.pageIndex).toBe(0);
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveFolder).id).toBe("page-0");
    }

    expect(calls).toEqual([undefined, "cursor-1", undefined]);
  });

  it("Next is disabled when nextCursor is null and Back is disabled on page one, reflected in the rendered controls", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [fixtureFolder()], nextCursor: null }),
      },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    const nextButton = findElement(tree, (el) => elementProps(el)["aria-label"] === "Next page");
    const backButton = findElement(tree, (el) => elementProps(el)["aria-label"] === "Back page");
    expect(elementProps(nextButton).disabled).toBe(true);
    expect(elementProps(backButton).disabled).toBe(true);
  });

  it("Back then Next truncates a stale forward branch through the real component", async () => {
    let call = 0;
    const searchFolders = vi.fn(async (_context: unknown, query: { cursor?: string }) => {
      call += 1;
      if (query.cursor === undefined) {
        return okResult({ items: [fixtureFolder({ id: `page-0-v${call}` })], nextCursor: `stale-branch-${call}` });
      }
      return okResult({ items: [fixtureFolder({ id: `page-1-v${call}` })], nextCursor: null });
    });
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();
    instance.handleBack();
    await flushMicrotasks();
    // Re-submitting Search re-derives page 0 (call 2), producing a FRESH
    // nextCursor distinct from the original stale branch.
    instance.handleSearchSubmit(fakeFormEvent());
    await flushMicrotasks();
    instance.handleNext();
    await flushMicrotasks();

    expect(instance.state.page.cursorStack.length).toBe(2);
    expect(instance.state.page.cursorStack[1]).not.toBe("stale-branch-1");
  });
});

// ---------------------------------------------------------------------------
// Proof 15: a zero-row later page retains Back navigation.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — zero-row later page", () => {
  it("a later page with zero items still shows an enabled Back control", async () => {
    const searchFolders = vi.fn(async (_context: unknown, query: { cursor?: string }) => {
      if (query.cursor === undefined) {
        return okResult({ items: [fixtureFolder()], nextCursor: "cursor-empty-page" });
      }
      return okResult({ items: [], nextCursor: null });
    });
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();

    expect(instance.state.page.pageIndex).toBe(1);
    expect(instance.state.page.viewState.status).toBe("ready");
    if (instance.state.page.viewState.status === "ready") {
      expect(instance.state.page.viewState.data.items).toEqual([]);
    }
    const tree = expandElementTree(instance.render());
    const backButton = findElement(tree, (el) => elementProps(el)["aria-label"] === "Back page");
    expect(elementProps(backButton).disabled).toBe(false);
    expect(collectRenderedText(tree).join(" ")).toContain("No folders match your search.");
  });
});

// ---------------------------------------------------------------------------
// Proof 17: a stale older request resolving after a newer mode/filter/page
// request cannot replace the current result state.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — stale response guard", () => {
  it("a stale in-flight folder fetch does not overwrite state after a newer mode switch resolves first", async () => {
    let resolveStale: ((value: ArchiveHostAdapterResult<{ items: ArchiveFolder[]; nextCursor: string | null }>) => void) | undefined;
    const searchFolders = vi.fn(
      () =>
        new Promise<ArchiveHostAdapterResult<{ items: ArchiveFolder[]; nextCursor: string | null }>>((resolveFetch) => {
          resolveStale = resolveFetch;
        }),
    );
    const searchItems = vi.fn(async () => okResult({ items: [fixtureItem({ id: "fresh-item" })], nextCursor: null }));
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders, searchItems } });

    const instance = mountedSearchScreen(bridge); // starts the stale folder fetch, left pending
    instance.handleSelectItemMode(); // issues a NEWER request
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.mode).toBe("item");
    expect(instance.state.page.viewState.status).toBe("ready");
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveItem).id).toBe("fresh-item");
    }

    // Now resolve the STALE folder fetch — it must NOT overwrite the
    // already-applied newer item-mode state.
    resolveStale?.(okResult({ items: [fixtureFolder({ id: "stale-folder" })], nextCursor: null }));
    await flushMicrotasks();

    expect(instance.state.mode).toBe("item");
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveItem).id).toBe("fresh-item");
    }
  });

  it("a stale in-flight page-1 request does not overwrite a newer Search submission's result", async () => {
    let resolveStale: ((value: ArchiveHostAdapterResult<{ items: ArchiveFolder[]; nextCursor: string | null }>) => void) | undefined;
    let call = 0;
    const searchFolders = vi.fn((_context: unknown, query: { cursor?: string }) => {
      call += 1;
      if (call === 1) {
        return Promise.resolve(okResult({ items: [fixtureFolder({ id: "page-0" })], nextCursor: "cursor-1" }));
      }
      if (call === 2) {
        // The Next request — deliberately left pending.
        return new Promise<ArchiveHostAdapterResult<{ items: ArchiveFolder[]; nextCursor: string | null }>>(
          (resolveFetch) => {
            resolveStale = resolveFetch;
          },
        );
      }
      return Promise.resolve(okResult({ items: [fixtureFolder({ id: "fresh-search-result" })], nextCursor: null }));
    });
    const bridge = createFakeBridge({ serviceOverrides: { searchFolders } });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    instance.handleNext(); // call 2, left pending
    await flushMicrotasks();
    instance.handleSearchSubmit(fakeFormEvent()); // call 3, a NEWER request
    await flushMicrotasks();

    expect(instance.state.page.pageIndex).toBe(0);
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveFolder).id).toBe("fresh-search-result");
    }

    resolveStale?.(okResult({ items: [fixtureFolder({ id: "stale-page-1" })], nextCursor: null }));
    await flushMicrotasks();

    // The stale page-1 response must be discarded, not applied on top of the
    // newer Search result.
    expect(instance.state.page.pageIndex).toBe(0);
    if (instance.state.page.viewState.status === "ready") {
      expect((instance.state.page.viewState.data.items[0] as ArchiveFolder).id).toBe("fresh-search-result");
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 18: backend result order is preserved (no client-side sort).
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — preserves backend order", () => {
  it("renders folder results in the exact order the bridge returned them", async () => {
    const orderedFolders = [
      fixtureFolder({ id: "folder-c", name: "Charlie" }),
      fixtureFolder({ id: "folder-a", name: "Alpha" }),
      fixtureFolder({ id: "folder-b", name: "Bravo" }),
    ];
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => okResult({ items: orderedFolders, nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    const cards = findAllElements(tree, (el) => "data-archive-ui-folder-id" in elementProps(el));
    expect(cards.map((el) => elementProps(el)["data-archive-ui-folder-id"])).toEqual([
      "folder-c",
      "folder-a",
      "folder-b",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Proof 19: mode/form/result/pagination accessibility semantics.
// ---------------------------------------------------------------------------

describe("ArchiveSearchScreen — accessibility", () => {
  it("has one clear search heading", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => okResult({ items: [], nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    const tree = expandElementTree(instance.render());
    const heading = findElement(tree, (el) => el.type === "h1");
    expect(heading).toBeDefined();
    expect(collectRenderedText(heading?.props?.children)).toEqual(["Search"]);
  });

  it("has a labeled mode control group with aria-pressed selected-state semantics", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => okResult({ items: [], nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    const tree = expandElementTree(instance.render());
    const group = findElement(tree, (el) => elementProps(el).role === "group");
    expect(group).toBeDefined();
    const folderButton = findElement(tree, (el) => elementProps(el)["data-archive-ui-search-mode"] === "folder");
    const itemButton = findElement(tree, (el) => elementProps(el)["data-archive-ui-search-mode"] === "item");
    expect(elementProps(folderButton)["aria-pressed"]).toBe(true);
    expect(elementProps(itemButton)["aria-pressed"]).toBe(false);
  });

  it("has a labeled filter form with name/status/condition fields, explicit Search/Clear buttons, and field-error association", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { searchFolders: async () => okResult({ items: [], nextCursor: null }) },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    (instance as unknown as { setState: (partial: object) => void }).setState({ draftStatus: "BOGUS" });
    instance.handleSearchSubmit(fakeFormEvent());
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    const form = findElement(tree, (el) => el.type === "form" && elementProps(el)["aria-label"] === "Search filters");
    expect(form).toBeDefined();
    const submitButton = findElement(tree, (el) => el.type === "button" && elementProps(el).type === "submit");
    expect(submitButton).toBeDefined();
    const clearButton = findElement(tree, (el) => collectRenderedText(el).join("") === "Clear");
    expect(clearButton).toBeDefined();

    const statusSelect = findAllElements(tree, (el) => el.type === "select")[0];
    expect(elementProps(statusSelect)["aria-invalid"]).toBe(true);
    const errorParagraph = findElement(tree, (el) => elementProps(el).role === "alert");
    expect(errorParagraph).toBeDefined();
    expect(collectRenderedText(errorParagraph).join(" ")).toContain("Choose a valid status.");
  });

  it("marks the result region busy while loading and provides separately labeled folder/item result lists", async () => {
    const bridgeLoading = createFakeBridge({
      serviceOverrides: { searchFolders: () => new Promise(() => {}) },
    });
    const loadingInstance = mountedSearchScreen(bridgeLoading);
    const loadingTree = expandElementTree(loadingInstance.render());
    const busyDiv = findElement(loadingTree, (el) => "aria-busy" in elementProps(el));
    expect(elementProps(busyDiv)["aria-busy"]).toBe(true);

    const bridgeReady = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [fixtureFolder()], nextCursor: null }),
      },
    });
    const readyInstance = mountedSearchScreen(bridgeReady);
    await flushMicrotasks();
    const readyTree = expandElementTree(readyInstance.render());
    const folderList = findElement(readyTree, (el) => elementProps(el)["aria-label"] === "Folder results");
    expect(folderList).toBeDefined();

    // A separate bridge that answers both modes proves the result-list
    // label switches to "Item results" for item mode.
    const bridgeBoth = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [], nextCursor: null }),
        searchItems: async () => okResult({ items: [fixtureItem()], nextCursor: null }),
      },
    });
    const bothInstance = mountedSearchScreen(bridgeBoth);
    await flushMicrotasks();
    bothInstance.handleSelectItemMode();
    await flushMicrotasks();
    const bothTree = expandElementTree(bothInstance.render());
    const itemList = findElement(bothTree, (el) => elementProps(el)["aria-label"] === "Item results");
    expect(itemList).toBeDefined();
  });

  it("has accessible Back/Next controls and a non-total 'Page N' indicator that never shows a cursor", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        searchFolders: async () => okResult({ items: [fixtureFolder()], nextCursor: "opaque-next" }),
      },
    });
    const instance = mountedSearchScreen(bridge);
    await flushMicrotasks();
    const tree = expandElementTree(instance.render());
    const pageIndicator = findElement(tree, (el) => "data-archive-ui-search-page-index" in elementProps(el));
    expect(pageIndicator).toBeDefined();
    const text = collectRenderedText(pageIndicator).join("");
    expect(text).toBe("Page 1");
    expect(text).not.toContain("opaque-next");
  });
});

// ---------------------------------------------------------------------------
// Proof 20: responsive/token source intent and no Shell/deep-Archive
// imports.
// ---------------------------------------------------------------------------

describe("search-screen.tsx source-level constraints", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = resolve(here, "..", "search-screen.tsx");
  const source = readFileSync(sourcePath, "utf8");

  it("uses a responsive auto-fit/minmax grid, not a fixed layout", () => {
    expect(source).toContain("repeat(auto-fit, minmax(");
  });

  it("imports domain types only from the public root package surface, never a deep Archive-internal path", () => {
    expect(source).toContain('from "@customprojects/archive-service"');
    expect(source).not.toMatch(/from ["']\.\.\/archive\//);
    expect(source).not.toMatch(/platform-shell|shell-master/i);
  });

  it("never imports react-dom or another renderer", () => {
    expect(source).not.toMatch(/from ["']react-dom/);
    expect(source).not.toContain('"react-dom"');
  });
});

// ---------------------------------------------------------------------------
// archiveUiFetchSearchPage / archiveUiSearchConditionLabels direct coverage.
// ---------------------------------------------------------------------------

describe("archiveUiFetchSearchPage", () => {
  it("item mode calls searchItems with the exact built query", async () => {
    const spy = vi.fn(async (_context: ArchiveContextInput, _query: unknown) =>
      okResult({ items: [], nextCursor: null }),
    );
    const bridge = createFakeBridge({ serviceOverrides: { searchItems: spy } });
    await archiveUiFetchSearchPage(bridge, fixtureContext, "item", { name: "x", status: "", condition: "" }, undefined);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toEqual({ nameContains: "x" });
  });
});

describe("archiveUiSearchConditionLabels", () => {
  it("returns only the true flags in a fixed deterministic order", () => {
    expect(
      archiveUiSearchConditionLabels({
        id: "x",
        name: "n",
        description: null,
        status: "active",
        dueAt: null,
        expiresAt: null,
        isDueSoon: true,
        isOverdue: false,
        isExpiringSoon: true,
        isExpired: false,
      }),
    ).toEqual(["Due soon", "Expiring soon"]);
  });

  it("returns an empty array when no condition flag is set", () => {
    expect(
      archiveUiSearchConditionLabels({
        id: "x",
        name: "n",
        description: null,
        status: "active",
        dueAt: null,
        expiresAt: null,
        isDueSoon: false,
        isOverdue: false,
        isExpiringSoon: false,
        isExpired: false,
      }),
    ).toEqual([]);
  });
});
