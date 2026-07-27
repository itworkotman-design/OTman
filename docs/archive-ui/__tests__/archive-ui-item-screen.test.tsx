import type { ChangeEvent, Component, FormEvent, ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-06 Part A (the Archive item/details and
// file-operations screen). Every bridge/supporting type below comes from the
// public "./ui" entry point, mirroring the TASK-02/TASK-03/TASK-04/TASK-05
// test discipline. No jsdom/Testing Library/react-dom is used anywhere in
// this file — see `item-screen.tsx`'s file-top HOOK-CALL CONSTRAINT comment
// for why `ArchiveItemScreen` is a class component, and `attachSyncUpdater`
// below (duplicated locally per the established TASK-05 precedent) for how
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
import { ArchiveItemScreen } from "../index.js";
import {
  archiveUiApplyFileSoftDelete,
  archiveUiApplyRestoredFile,
  archiveUiApplyUpdatedItem,
  archiveUiApplyUploadedFile,
  archiveUiFileDeleteConfirmationLabels,
  archiveUiFormatByteSize,
  archiveUiItemDateToInputValue,
  archiveUiItemDeleteConfirmationLabels,
  archiveUiItemScreenCapabilities,
  archiveUiItemScreenContentState,
  archiveUiLoadItemScreenData,
  archiveUiRequestItemFileDownload,
  archiveUiSubmitItemDates,
  archiveUiSubmitItemFileUpload,
  archiveUiSubmitItemStatus,
  archiveUiSubmitRestoreFile,
  archiveUiSubmitSoftDeleteFile,
  archiveUiSubmitSoftDeleteItem,
  archiveUiToRecoverableFileProjection,
  type ArchiveItemScreenData,
  type ArchiveUiUploadFileLike,
} from "../item-screen.js";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveContextInput,
  type ArchiveEffectiveCapabilityMap,
  type ArchiveFile,
  type ArchiveHostAdapterError,
  type ArchiveHostAdapterResult,
  type ArchiveItem,
  type ArchivePermissionAction,
  type ArchiveRecoverableFile,
  type UploadArchiveFileInput,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const now = new Date("2026-01-01T00:00:00.000Z");

// Pin the ambient timezone to UTC for this whole file (except the dedicated
// non-UTC describe block far below), mirroring the TASK-05 REPAIR-R1
// precedent exactly.
let ARCHIVE_UI_ORIGINAL_TZ: string | undefined;
beforeAll(() => {
  ARCHIVE_UI_ORIGINAL_TZ = process.env.TZ;
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (ARCHIVE_UI_ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ARCHIVE_UI_ORIGINAL_TZ;
  }
});

const fixtureContext: ArchiveContextInput = {
  userId: "user-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  archiveModuleAccess: true,
};

function fixtureItem(overrides: Partial<ArchiveItem> = {}): ArchiveItem {
  return {
    id: "item-current",
    companyId: "company-1",
    tenantId: "tenant-1",
    folderId: "folder-1",
    name: "Fixture item",
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

function fixtureFile(overrides: Partial<ArchiveFile> = {}): ArchiveFile {
  return {
    id: "file-1",
    companyId: "company-1",
    tenantId: "tenant-1",
    archiveItemId: "item-current",
    originalFileName: "report.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    sizeBytes: 2048,
    uploadedByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedByUserId: null,
    purgedAt: null,
    ...overrides,
  };
}

function fixtureRecoverableFile(overrides: Partial<ArchiveRecoverableFile> = {}): ArchiveRecoverableFile {
  return {
    id: "file-deleted-1",
    archiveItemId: "item-current",
    originalFileName: "old.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    sizeBytes: 512,
    deletedAt: now,
    ...overrides,
  };
}

function denyAllCapabilities(): ArchiveEffectiveCapabilityMap {
  return Object.fromEntries(
    ARCHIVE_PERMISSION_ACTIONS.map((action) => [action, { allowed: false, source: "none" as const }]),
  ) as ArchiveEffectiveCapabilityMap;
}

function allowCapabilities(actions: readonly ArchivePermissionAction[]): ArchiveEffectiveCapabilityMap {
  const map = { ...denyAllCapabilities() };
  for (const action of actions) {
    map[action] = { allowed: true, source: "direct_user" as const };
  }
  return map;
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
    throw new Error("archive-ui-item-screen fixture: method not implemented");
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

function createStubTransport(overrides: Partial<ArchiveUiFileTransport> = {}): ArchiveUiFileTransport {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-item-screen fixture: transport method not implemented");
  };
  return {
    uploadFile: notImplemented,
    downloadFile: notImplemented,
    ...overrides,
  } as unknown as ArchiveUiFileTransport;
}

// Correction Phase 6 TASK-08A: the item screen does not use the identity
// port in this task (no screen production file changes) — a throwing stub
// satisfies `ArchiveUiBridge`'s now-required `identity` property.
function createStubIdentity(): ArchiveUiIdentityPort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-item-screen fixture: identity method not implemented");
  };
  return {
    resolvePlatformUsers: notImplemented,
    listAssignableCompanyMembers: notImplemented,
  };
}

interface FakeBridgeOptions {
  readonly context?: ArchiveContextInput;
  readonly serviceOverrides?: Partial<ArchiveUiServicePort>;
  readonly transportOverrides?: Partial<ArchiveUiFileTransport>;
  readonly translateError?: ArchiveUiErrorTranslator;
  readonly navigate?: (intent: ArchiveUiNavigationIntent) => void;
  readonly currentUserDisplay?: { displayName?: string; email?: string } | undefined;
}

function createFakeBridge(options: FakeBridgeOptions = {}): ArchiveUiBridge {
  return {
    getContext: () => options.context ?? fixtureContext,
    getCurrentUserDisplay: () => options.currentUserDisplay,
    navigate: options.navigate ?? (() => {}),
    service: createStubServicePort(options.serviceOverrides ?? {}),
    transport: createStubTransport(options.transportOverrides ?? {}),
    translateError: options.translateError ?? safeTranslateError,
    identity: createStubIdentity(),
  };
}

// A "ready" load's reads all succeed with the supplied (or default) fixtures.
function readyServiceOverrides(
  opts: {
    item?: ArchiveItem;
    files?: ArchiveFile[];
    recoverableFiles?: ArchiveRecoverableFile[];
    capabilities?: ArchiveEffectiveCapabilityMap;
  } = {},
): Partial<ArchiveUiServicePort> {
  const item = opts.item ?? fixtureItem();
  // `listRecoverableFilesForItem` is ALWAYS safely stubbed here (defaulting
  // to an empty list) — regardless of whether the caller's supplied
  // `capabilities` happen to allow `restore` — so a test that grants
  // `restore` for some OTHER reason (e.g. exercising the delete/restore
  // capability together) never trips the "not implemented" fixture default
  // merely because it forgot to pass `recoverableFiles` explicitly.
  return {
    getEffectiveCapabilities: async () => okResult(opts.capabilities ?? denyAllCapabilities()),
    readItem: async () => okResult(item),
    listFilesForItem: async () => okResult(opts.files ?? []),
    listRecoverableFilesForItem: async () => okResult(opts.recoverableFiles ?? []),
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

function fakeSelectChangeEvent(value: string): ChangeEvent<HTMLSelectElement> {
  return { target: { value } } as unknown as ChangeEvent<HTMLSelectElement>;
}

function fakeInputChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>;
}

function fakeSubmitEvent(): FormEvent<HTMLFormElement> {
  return { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
}

function fakeUploadFile(
  name: string,
  type: string,
  bytes: number[],
  options: { failRead?: boolean } = {},
): ArchiveUiUploadFileLike {
  return {
    name,
    type,
    arrayBuffer: async () => {
      if (options.failRead === true) {
        throw new Error("raw byte-read exception message that must not leak");
      }
      return new Uint8Array(bytes).buffer;
    },
  };
}

async function loadedInstance(bridge: ArchiveUiBridge, itemId = "item-current") {
  const instance = new ArchiveItemScreen({ bridge, itemId });
  attachSyncUpdater(instance);
  await instance.loadItemScreen();
  return instance;
}

// A minimal fake object URL registry — non-vacuous stub/observation of
// `URL.createObjectURL`/`URL.revokeObjectURL` with no jsdom/new dependency
// (card scope "Download flow" requirement).
function stubObjectUrls(): { created: string[]; revoked: string[]; restore: () => void } {
  const created: string[] = [];
  const revoked: string[] = [];
  const originalCreate = (URL as any).createObjectURL;
  const originalRevoke = (URL as any).revokeObjectURL;
  let counter = 0;
  (URL as any).createObjectURL = (_blob: unknown) => {
    counter += 1;
    const url = `blob:fake-${counter}`;
    created.push(url);
    return url;
  };
  (URL as any).revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  return {
    created,
    revoked,
    restore: () => {
      (URL as any).createObjectURL = originalCreate;
      (URL as any).revokeObjectURL = originalRevoke;
    },
  };
}

// ---------------------------------------------------------------------------
// Proof 1/2/3: capability preflight + post-capability load calls + failure
// precedence.
// ---------------------------------------------------------------------------

describe("archiveUiLoadItemScreenData — capability preflight", () => {
  it("calls getEffectiveCapabilities with the exact item target, before any other read", async () => {
    const calls: unknown[] = [];
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async (context, target) => {
          calls.push({ context, target });
          return okResult(denyAllCapabilities());
        },
        readItem: async () => {
          throw new Error("readItem must not be called when view is denied");
        },
        listFilesForItem: async () => {
          throw new Error("listFilesForItem must not be called when view is denied");
        },
        listRecoverableFilesForItem: async () => {
          throw new Error("listRecoverableFilesForItem must not be called when view is denied");
        },
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");

    expect(calls).toEqual([
      { context: fixtureContext, target: { targetType: "item", targetId: "item-current" } },
    ]);
    expect(result.viewState.status).toBe("denied");
  });

  it("an unauthorized getEffectiveCapabilities failure becomes denied, without leaking the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => errResult("unauthorized", "RAW-CAP-1"),
      },
    });
    const result = await archiveUiLoadItemScreenData(bridge, "item-current");
    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-CAP-1");
    }
  });

  it("a non-unauthorized getEffectiveCapabilities failure becomes a translated error", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => errResult("server_error", "RAW-CAP-2"),
      },
    });
    const result = await archiveUiLoadItemScreenData(bridge, "item-current");
    expect(result.viewState.status).toBe("error");
    if (result.viewState.status === "error") {
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-CAP-2");
    }
  });
});

describe("archiveUiLoadItemScreenData — post-capability reads", () => {
  it("view allowed, restore denied: readItem + listFilesForItem called, listRecoverableFilesForItem NOT called", async () => {
    const item = fixtureItem();
    const file = fixtureFile();
    const readItemSpy = vi.fn(async () => okResult(item));
    const listFilesSpy = vi.fn(async () => okResult([file]));
    const listRecoverableSpy = vi.fn(async () => okResult([]));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view"])),
        readItem: readItemSpy,
        listFilesForItem: listFilesSpy,
        listRecoverableFilesForItem: listRecoverableSpy,
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");

    expect(readItemSpy).toHaveBeenCalledWith(fixtureContext, "item-current");
    expect(listFilesSpy).toHaveBeenCalledWith(fixtureContext, "item-current");
    expect(listRecoverableSpy).not.toHaveBeenCalled();
    expect(result.viewState.status).toBe("ready");
    if (result.viewState.status === "ready") {
      expect(result.viewState.data.recoverableFiles).toEqual([]);
    }
  });

  it("view + restore allowed: all three reads called with the exact item id/context", async () => {
    const item = fixtureItem();
    const recoverable = fixtureRecoverableFile();
    const listRecoverableSpy = vi.fn(async () => okResult([recoverable]));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view", "restore"])),
        readItem: async () => okResult(item),
        listFilesForItem: async () => okResult([]),
        listRecoverableFilesForItem: listRecoverableSpy,
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");

    expect(listRecoverableSpy).toHaveBeenCalledWith(fixtureContext, "item-current");
    expect(result.viewState.status).toBe("ready");
    if (result.viewState.status === "ready") {
      expect(result.viewState.data.recoverableFiles).toEqual([recoverable]);
    }
  });
});

describe("archiveUiLoadItemScreenData — unauthorized precedence and failure order", () => {
  it("unauthorized from listFilesForItem wins even when listRecoverableFilesForItem also fails non-unauthorized", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view", "restore"])),
        readItem: async () => okResult(fixtureItem()),
        listFilesForItem: async () => errResult("unauthorized", "RAW-FILES"),
        listRecoverableFilesForItem: async () => errResult("server_error", "RAW-RECOVERABLE"),
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");
    expect(result.viewState.status).toBe("denied");
  });

  it("deterministic non-unauthorized order: readItem failure wins over listFilesForItem failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view"])),
        readItem: async () => errResult("not_found", "RAW-ITEM"),
        listFilesForItem: async () => errResult("validation", "RAW-FILES-2"),
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");
    expect(result.viewState.status).toBe("error");
  });

  it("deterministic non-unauthorized order: listFilesForItem failure wins over listRecoverableFilesForItem failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view", "restore"])),
        readItem: async () => okResult(fixtureItem()),
        listFilesForItem: async () => errResult("validation", "RAW-FILES-3"),
        listRecoverableFilesForItem: async () => errResult("server_error", "RAW-RECOVERABLE-2"),
      },
    });

    const result = await archiveUiLoadItemScreenData(bridge, "item-current");
    expect(result.viewState.status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Proof 4: loading/content-empty/ready/denied/error states; header/actions
// preserved in content-empty.
// ---------------------------------------------------------------------------

describe("archiveUiItemScreenContentState", () => {
  it("empty content: no active files and no visible recoverable files", () => {
    const item = fixtureItem();
    const data: ArchiveItemScreenData = {
      item,
      capabilities: archiveUiItemScreenCapabilities(allowCapabilities(["view", "delete", "upload"])),
      activeFiles: [],
      recoverableFiles: [],
    };
    expect(archiveUiItemScreenContentState(data).status).toBe("empty");
  });

  it("ready content: at least one active or recoverable file", () => {
    const item = fixtureItem();
    const data: ArchiveItemScreenData = {
      item,
      capabilities: archiveUiItemScreenCapabilities(allowCapabilities(["view"])),
      activeFiles: [fixtureFile()],
      recoverableFiles: [],
    };
    expect(archiveUiItemScreenContentState(data).status).toBe("ready");
  });
});

describe("ArchiveItemScreen — mounted lifecycle and rendered states", () => {
  it("loading: before load resolves, the outer state is loading", () => {
    const bridge = createFakeBridge({
      serviceOverrides: { getEffectiveCapabilities: () => new Promise(() => {}) },
    });
    const instance = new ArchiveItemScreen({ bridge, itemId: "item-current" });
    attachSyncUpdater(instance);
    expect(instance.state.viewState.status).toBe("loading");
  });

  it("content-empty state preserves the item heading/actions (status/dates/upload/delete forms remain rendered)", async () => {
    const item = fixtureItem({ name: "Empty Item" });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        item,
        files: [],
        capabilities: allowCapabilities(["view", "manage_status", "manage_metadata", "delete", "upload"]),
      }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());

    expect(findElement(tree, (el) => elementProps(el)["aria-label"] === "Update item status")).toBeDefined();
    expect(
      findElement(tree, (el) => elementProps(el)["aria-label"] === "Update item due and expiry dates"),
    ).toBeDefined();
    expect(findElement(tree, (el) => elementProps(el)["aria-label"] === "Upload a file")).toBeDefined();
    const emptyState = findElement(tree, (el) => elementProps(el)["data-archive-ui-state"] === "empty");
    expect(emptyState).toBeDefined();
  });

  it("ready: active files render", async () => {
    const file = fixtureFile({ originalFileName: "budget.csv" });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree);
    expect(texts).toContain("budget.csv");
  });

  it("denied: view denied renders the calm denied state", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { getEffectiveCapabilities: async () => okResult(denyAllCapabilities()) },
    });
    const instance = await loadedInstance(bridge);
    expect(instance.state.viewState.status).toBe("denied");
    const tree = expandElementTree(instance.render());
    expect(findElement(tree, (el) => elementProps(el)["data-archive-ui-state"] === "denied")).toBeDefined();
  });

  it("error: a non-unauthorized readItem failure renders the calm error state", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view"])),
        readItem: async () => errResult("server_error", "raw internal reason"),
        listFilesForItem: async () => okResult([]),
      },
    });
    const instance = await loadedInstance(bridge);
    expect(instance.state.viewState.status).toBe("error");
    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree);
    expect(texts.join(" ")).not.toContain("raw internal reason");
  });
});

// ---------------------------------------------------------------------------
// Proof 5: no internal ids/raw backend messages in normal rendered copy.
// ---------------------------------------------------------------------------

describe("no raw ids or backend messages in rendered copy", () => {
  it("item id, folder id, and file id never appear as rendered text", async () => {
    const item = fixtureItem({ id: "item-secret-id", folderId: "folder-secret-id", name: "Visible Name" });
    const file = fixtureFile({ id: "file-secret-id", archiveItemId: "item-secret-id" });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ item, files: [file], capabilities: allowCapabilities(["view"]) }),
    });
    const instance = await loadedInstance(bridge, "item-secret-id");
    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree);
    expect(texts).not.toContain("item-secret-id");
    expect(texts).not.toContain("folder-secret-id");
    expect(texts).not.toContain("file-secret-id");
  });
});

// ---------------------------------------------------------------------------
// Proof 6: exact folder/history navigation intents.
// ---------------------------------------------------------------------------

describe("ArchiveItemScreen navigation", () => {
  it("back-to-folder emits exactly { screen: 'folder', folderId }", async () => {
    const navigateSpy = vi.fn();
    const item = fixtureItem({ folderId: "folder-target" });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ item, capabilities: allowCapabilities(["view"]) }),
      navigate: navigateSpy,
    });
    const instance = await loadedInstance(bridge);
    instance.handleBackToFolder();
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "folder", folderId: "folder-target" });
    expect(Object.keys(navigateSpy.mock.calls[0][0]).sort()).toEqual(["folderId", "screen"]);
  });

  it("view-history emits exactly { screen: 'history', target: { targetType: 'item', targetId } }", async () => {
    const navigateSpy = vi.fn();
    const item = fixtureItem({ id: "item-current" });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ item, capabilities: allowCapabilities(["view"]) }),
      navigate: navigateSpy,
    });
    const instance = await loadedInstance(bridge);
    instance.handleViewHistory();
    expect(navigateSpy).toHaveBeenCalledWith({
      screen: "history",
      target: { targetType: "item", targetId: "item-current" },
    });
  });
});

// ---------------------------------------------------------------------------
// Proof 7: capability denial never presented as enabled.
// ---------------------------------------------------------------------------

describe("capability-gated action presentation", () => {
  it("denied manage_status/manage_metadata/delete/upload render disabled controls, never enabled", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ files: [fixtureFile()], capabilities: allowCapabilities(["view"]) }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());

    const statusForm = findElement(tree, (el) => elementProps(el)["aria-label"] === "Update item status");
    expect(statusForm).toBeDefined();
    const statusButton = findElement(statusForm!.props.children, (el) => el.type === "button");
    expect(elementProps(statusButton).disabled).toBe(true);

    const uploadForm = findElement(tree, (el) => elementProps(el)["aria-label"] === "Upload a file");
    const uploadButton = findElement(uploadForm!.props.children, (el) => el.type === "button");
    expect(elementProps(uploadButton).disabled).toBe(true);

    const datesForm = findElement(
      tree,
      (el) => elementProps(el)["aria-label"] === "Update item due and expiry dates",
    );
    const datesButton = findElement(datesForm!.props.children, (el) => el.type === "button");
    expect(elementProps(datesButton).disabled).toBe(true);

    const deleteButton = findElement(
      tree,
      (el) => el.type === "button" && elementProps(el).children === "Delete item",
    );
    expect(deleteButton).toBeDefined();
    expect(elementProps(deleteButton).disabled).toBe(true);
  });

  it("restore denied hides the recoverable-file section entirely (no visible-but-disabled restore control)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ files: [fixtureFile()], capabilities: allowCapabilities(["view"]) }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());
    expect(findElement(tree, (el) => elementProps(el)["aria-label"] === "Deleted files")).toBeUndefined();
    const texts = collectRenderedText(tree);
    expect(texts).not.toContain("Restore");
  });

  it("restore allowed shows the recoverable-file section", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        files: [],
        recoverableFiles: [fixtureRecoverableFile()],
        capabilities: allowCapabilities(["view", "restore"]),
      }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree);
    expect(texts).toContain("Restore");
  });
});

// ---------------------------------------------------------------------------
// Proof 8: item status editing.
// ---------------------------------------------------------------------------

describe("item status editing", () => {
  it("calls setItemStatus with the exact status and updates the visible item + feedback on success", async () => {
    const setItemStatusSpy = vi.fn(async () => okResult(fixtureItem({ status: "archived" })));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ capabilities: allowCapabilities(["view", "manage_status"]) }),
        setItemStatus: setItemStatusSpy,
      },
    });
    const instance = await loadedInstance(bridge);
    instance.setState({ statusField: "archived" } as any);
    await instance.handleStatusSubmit(fakeSubmitEvent());

    expect(setItemStatusSpy).toHaveBeenCalledWith(fixtureContext, "item-current", { status: "archived" });
    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.item.status).toBe("archived");
    }
    expect(instance.state.feedback).toEqual({ kind: "visible", feedback: { intent: "success", title: "Status updated" } });
  });

  it("failure uses translated safe feedback", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ capabilities: allowCapabilities(["view", "manage_status"]) }),
        setItemStatus: async () => errResult("validation", "RAW-STATUS"),
      },
    });
    const instance = await loadedInstance(bridge);
    await instance.handleStatusSubmit(fakeSubmitEvent());
    expect(instance.state.feedback.kind).toBe("visible");
    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-STATUS");
  });

  it("duplicate submission is blocked", async () => {
    let callCount = 0;
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ capabilities: allowCapabilities(["view", "manage_status"]) }),
        setItemStatus: async () => {
          callCount += 1;
          return okResult(fixtureItem());
        },
      },
    });
    const instance = await loadedInstance(bridge);
    const first = instance.handleStatusSubmit(fakeSubmitEvent());
    const second = instance.handleStatusSubmit(fakeSubmitEvent());
    await Promise.all([first, second]);
    expect(callCount).toBe(1);
  });

  it("exact closed status vocabulary is rendered as the status <select>'s options", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ capabilities: allowCapabilities(["view", "manage_status"]) }),
    });
    const instance = await loadedInstance(bridge);
    const tree = expandElementTree(instance.render());
    const statusForm = findElement(tree, (el) => elementProps(el)["aria-label"] === "Update item status");
    const select = findElement(statusForm!.props.children, (el) => el.type === "select");
    const optionValues = findAllElements(select!.props.children, (el) => el.type === "option").map(
      (option) => elementProps(option).value,
    );
    expect(optionValues).toEqual(["active", "inactive", "draft", "archived"]);
  });
});

// ---------------------------------------------------------------------------
// Proof 9: item date editing — UTC-pinned base cases, plus a dedicated
// non-UTC round-trip + impossible-date-rejection describe block below.
// ---------------------------------------------------------------------------

describe("item due/expiry date editing (archiveUiSubmitItemDates)", () => {
  it("blank maps to null", async () => {
    const setItemDatesSpy = vi.fn(async () => okResult(fixtureItem()));
    const bridge = createFakeBridge({ serviceOverrides: { setItemDates: setItemDatesSpy } });
    const outcome = await archiveUiSubmitItemDates(bridge, fixtureContext, "item-current", {
      dueAt: { value: "", loadedValue: "", loadedIso: null },
      expiresAt: { value: "", loadedValue: "", loadedIso: null },
    });
    expect(outcome.kind).toBe("success");
    expect(setItemDatesSpy).toHaveBeenCalledWith(fixtureContext, "item-current", {
      dueAt: null,
      expiresAt: null,
    });
  });

  it("invalid input never reaches setItemDates", async () => {
    const setItemDatesSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { setItemDates: setItemDatesSpy } });
    const outcome = await archiveUiSubmitItemDates(bridge, fixtureContext, "item-current", {
      dueAt: { value: "not-a-date", loadedValue: "", loadedIso: null },
      expiresAt: { value: "", loadedValue: "", loadedIso: null },
    });
    expect(outcome.kind).toBe("validation");
    expect(setItemDatesSpy).not.toHaveBeenCalled();
  });

  it("archiveUiItemDateToInputValue formats using LOCAL wall-clock components", () => {
    expect(archiveUiItemDateToInputValue(new Date("2026-03-01T10:15:30.000Z"))).toBe("2026-03-01T10:15");
    expect(archiveUiItemDateToInputValue(null)).toBe("");
  });
});

describe("item due/expiry date editing — non-UTC round-trip proof", () => {
  const NON_UTC_TZ = "America/Chicago";
  let previousTz: string | undefined;

  beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = NON_UTC_TZ;
    expect(new Date("2026-01-15T12:00").getTimezoneOffset()).not.toBe(0);
  });

  afterAll(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("an UNMODIFIED value preserves the exact original instant (incl. seconds) under a non-UTC TZ", async () => {
    const originalIso = "2026-01-15T18:30:45.123Z";
    const loadedValue = archiveUiItemDateToInputValue(new Date(originalIso));
    const setItemDatesSpy = vi.fn(async () => okResult(fixtureItem()));
    const bridge = createFakeBridge({ serviceOverrides: { setItemDates: setItemDatesSpy } });

    const outcome = await archiveUiSubmitItemDates(bridge, fixtureContext, "item-current", {
      dueAt: { value: loadedValue, loadedValue, loadedIso: originalIso },
      expiresAt: { value: "", loadedValue: "", loadedIso: null },
    });

    expect(outcome.kind).toBe("success");
    expect(setItemDatesSpy).toHaveBeenCalledWith(fixtureContext, "item-current", {
      dueAt: originalIso,
      expiresAt: null,
    });
  });

  it("a CHANGED value round-trips through local format+parse back to the exact original instant", async () => {
    const originalInstant = new Date("2026-01-15T18:30:00.000Z");
    const formatted = archiveUiItemDateToInputValue(originalInstant);
    const setItemDatesSpy = vi.fn(async () => okResult(fixtureItem()));
    const bridge = createFakeBridge({ serviceOverrides: { setItemDates: setItemDatesSpy } });

    const outcome = await archiveUiSubmitItemDates(bridge, fixtureContext, "item-current", {
      dueAt: { value: formatted, loadedValue: "DIFFERENT", loadedIso: null },
      expiresAt: { value: "", loadedValue: "", loadedIso: null },
    });

    expect(outcome.kind).toBe("success");
    expect(setItemDatesSpy).toHaveBeenCalledWith(fixtureContext, "item-current", {
      dueAt: originalInstant.toISOString(),
      expiresAt: null,
    });
  });

  it("a calendar-impossible value is rejected under a non-UTC TZ, with no setItemDates call", async () => {
    const setItemDatesSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { setItemDates: setItemDatesSpy } });

    const outcome = await archiveUiSubmitItemDates(bridge, fixtureContext, "item-current", {
      dueAt: { value: "2026-04-31T10:00", loadedValue: "", loadedIso: null }, // April has 30 days.
      expiresAt: { value: "", loadedValue: "", loadedIso: null },
    });

    expect(outcome.kind).toBe("validation");
    expect(setItemDatesSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Proof 10: item destructive confirmation + navigation on success.
// ---------------------------------------------------------------------------

describe("item soft deletion", () => {
  it("archiveUiItemDeleteConfirmationLabels names the exact action and subject", () => {
    expect(archiveUiItemDeleteConfirmationLabels(fixtureItem({ name: "Q3 Report" }))).toEqual({
      actionLabel: "Delete item",
      subjectLabel: 'item "Q3 Report"',
    });
  });

  it("the confirmation dialog is absent until requested, then present with correct labels", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        item: fixtureItem({ name: "Q3 Report" }),
        capabilities: allowCapabilities(["view", "delete"]),
      }),
    });
    const instance = await loadedInstance(bridge);
    let tree = expandElementTree(instance.render());
    expect(findElement(tree, (el) => elementProps(el).role === "dialog")).toBeUndefined();

    instance.handleRequestItemDelete();
    tree = expandElementTree(instance.render());
    const dialog = findElement(tree, (el) => elementProps(el).role === "dialog");
    expect(dialog).toBeDefined();
    expect(elementProps(dialog)["aria-label"]).toBe('Delete item item "Q3 Report"');
  });

  it("confirming calls softDeleteItem and navigates to the containing folder only after success", async () => {
    const navigateSpy = vi.fn();
    const softDeleteItemSpy = vi.fn(async () => okResult(fixtureItem({ folderId: "folder-target", isDeleted: true })));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ capabilities: allowCapabilities(["view", "delete"]) }),
        softDeleteItem: softDeleteItemSpy,
      },
      navigate: navigateSpy,
    });
    const instance = await loadedInstance(bridge);
    instance.handleRequestItemDelete();
    await instance.handleConfirmItemDelete();

    expect(softDeleteItemSpy).toHaveBeenCalledWith(fixtureContext, "item-current");
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "folder", folderId: "folder-target" });
  });

  it("failure stays on screen with safe translated feedback, no navigation", async () => {
    const navigateSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ capabilities: allowCapabilities(["view", "delete"]) }),
        softDeleteItem: async () => errResult("server_error", "RAW-ITEM-DELETE"),
      },
      navigate: navigateSpy,
    });
    const instance = await loadedInstance(bridge);
    instance.handleRequestItemDelete();
    await instance.handleConfirmItemDelete();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-ITEM-DELETE");
  });
});

// ---------------------------------------------------------------------------
// Proof 11/12: upload flow.
// ---------------------------------------------------------------------------

describe("upload flow", () => {
  it("a missing selection produces a field error and no transport call", async () => {
    const uploadFileSpy = vi.fn();
    const outcome = await archiveUiSubmitItemFileUpload(
      createFakeBridge({ transportOverrides: { uploadFile: uploadFileSpy } }),
      fixtureContext,
      "item-current",
      null,
    );
    expect(outcome.kind).toBe("validation");
    expect(uploadFileSpy).not.toHaveBeenCalled();
  });

  it("snapshots bytes into a new Uint8Array and uses the exact selected filename/mime", async () => {
    const uploadFileSpy = vi.fn(async (_context: ArchiveContextInput, _input: UploadArchiveFileInput) =>
      okResult(fixtureFile()),
    );
    const bridge = createFakeBridge({ transportOverrides: { uploadFile: uploadFileSpy } });
    const file = fakeUploadFile("photo.png", "image/png", [1, 2, 3, 4]);

    const outcome = await archiveUiSubmitItemFileUpload(bridge, fixtureContext, "item-current", file);

    expect(outcome.kind).toBe("success");
    expect(uploadFileSpy).toHaveBeenCalledTimes(1);
    const [, input] = uploadFileSpy.mock.calls[0];
    expect(input.archiveItemId).toBe("item-current");
    expect(input.originalFileName).toBe("photo.png");
    expect(input.mimeType).toBe("image/png");
    expect(input.content).toBeInstanceOf(Uint8Array);
    expect(Array.from(input.content)).toEqual([1, 2, 3, 4]);
  });

  it("MIME fallback applies ONLY when the browser supplies an empty type", async () => {
    const uploadFileSpy = vi.fn(async (_context: ArchiveContextInput, _input: UploadArchiveFileInput) =>
      okResult(fixtureFile()),
    );
    const bridge = createFakeBridge({ transportOverrides: { uploadFile: uploadFileSpy } });
    await archiveUiSubmitItemFileUpload(bridge, fixtureContext, "item-current", fakeUploadFile("a", "", [1]));
    expect(uploadFileSpy.mock.calls[0][1].mimeType).toBe("application/octet-stream");

    await archiveUiSubmitItemFileUpload(
      bridge,
      fixtureContext,
      "item-current",
      fakeUploadFile("b", "text/csv", [1]),
    );
    expect(uploadFileSpy.mock.calls[1][1].mimeType).toBe("text/csv");
  });

  it("byte-read failures produce calm safe feedback only, never the raw exception message", async () => {
    const uploadFileSpy = vi.fn();
    const bridge = createFakeBridge({ transportOverrides: { uploadFile: uploadFileSpy } });
    const outcome = await archiveUiSubmitItemFileUpload(
      bridge,
      fixtureContext,
      "item-current",
      fakeUploadFile("bad.bin", "application/octet-stream", [], { failRead: true }),
    );
    expect(outcome.kind).toBe("failure");
    expect(uploadFileSpy).not.toHaveBeenCalled();
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("raw byte-read exception message");
    }
  });

  it("adapter failures produce calm safe feedback only", async () => {
    const bridge = createFakeBridge({
      transportOverrides: { uploadFile: async () => errResult("validation", "RAW-UPLOAD") },
    });
    const outcome = await archiveUiSubmitItemFileUpload(
      bridge,
      fixtureContext,
      "item-current",
      fakeUploadFile("a.bin", "application/octet-stream", [1]),
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-UPLOAD");
    }
  });

  it("success updates the active file list deterministically", () => {
    const item = fixtureItem();
    const data: ArchiveItemScreenData = {
      item,
      capabilities: archiveUiItemScreenCapabilities(allowCapabilities(["view", "upload"])),
      activeFiles: [fixtureFile({ id: "existing" })],
      recoverableFiles: [],
    };
    const newFile = fixtureFile({ id: "new-file" });
    const updated = archiveUiApplyUploadedFile(data, newFile);
    expect(updated.activeFiles.map((f) => f.id)).toEqual(["existing", "new-file"]);
  });

  it("no client-side max-upload-size constant exists in the production source", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sourcePath = resolve(here, "..", "item-screen.tsx");
    const source = readFileSync(sourcePath, "utf8");
    expect(/max.?upload.?size/i.test(source)).toBe(false);
    expect(/maxSizeBytes/i.test(source)).toBe(false);
  });

  it("duplicate submission is blocked (component-level guard)", async () => {
    let callCount = 0;
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ capabilities: allowCapabilities(["view", "upload"]) }),
      transportOverrides: {
        uploadFile: async () => {
          callCount += 1;
          return okResult(fixtureFile());
        },
      },
    });
    const instance = await loadedInstance(bridge);
    instance.handleUploadSelectionChange({
      target: { files: [fakeUploadFile("a.bin", "application/octet-stream", [1])] },
    } as unknown as ChangeEvent<HTMLInputElement>);
    const first = instance.handleUploadSubmit(fakeSubmitEvent());
    const second = instance.handleUploadSubmit(fakeSubmitEvent());
    await Promise.all([first, second]);
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Proof 13: download flow.
// ---------------------------------------------------------------------------

describe("download flow", () => {
  it("calls only transport.downloadFile and creates a Blob/object URL from the returned bytes", async () => {
    const stub = stubObjectUrls();
    try {
      const downloadFileSpy = vi.fn(async () =>
        okResult({ file: fixtureFile({ originalFileName: "final.pdf" }), content: new Uint8Array([9, 9]) }),
      );
      const bridge = createFakeBridge({ transportOverrides: { downloadFile: downloadFileSpy } });
      const outcome = await archiveUiRequestItemFileDownload(bridge, fixtureContext, "file-1");
      expect(downloadFileSpy).toHaveBeenCalledWith(fixtureContext, "file-1");
      expect(outcome.kind).toBe("success");
      if (outcome.kind === "success") {
        expect(outcome.filename).toBe("final.pdf");
        expect(stub.created).toContain(outcome.url);
      }
    } finally {
      stub.restore();
    }
  });

  it("renders an accessible 'Download ready' link with the returned filename, never raw bytes", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () =>
            okResult({ file: fixtureFile({ id: "file-9", originalFileName: "ready.pdf" }), content: new Uint8Array([1, 2]) }),
        },
      });
      const instance = await loadedInstance(bridge);
      await instance.handleDownloadFile("file-9");
      const tree = expandElementTree(instance.render());
      const link = findElement(tree, (el) => elementProps(el)["data-archive-ui-download-ready"] === "file-9");
      expect(link).toBeDefined();
      expect(elementProps(link).href).toMatch(/^blob:/);
      const texts = collectRenderedText(tree);
      expect(texts.join(" ")).toContain("ready.pdf");
      expect(texts.join(" ")).not.toContain("1,2");
    } finally {
      stub.restore();
    }
  });

  it("revokes a previously created object URL when replaced by a new download for the same file", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      let callCount = 0;
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () => {
            callCount += 1;
            return okResult({
              file: fixtureFile({ id: "file-9", originalFileName: `v${callCount}.pdf` }),
              content: new Uint8Array([callCount]),
            });
          },
        },
      });
      const instance = await loadedInstance(bridge);
      await instance.handleDownloadFile("file-9");
      const firstUrl = (instance.state.downloads["file-9"] as any).url;
      await instance.handleDownloadFile("file-9");
      expect(stub.revoked).toContain(firstUrl);
    } finally {
      stub.restore();
    }
  });

  it("revokes a previously created object URL even when the replacement download FAILS", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      let callCount = 0;
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () => {
            callCount += 1;
            if (callCount === 1) {
              return okResult({
                file: fixtureFile({ id: "file-9", originalFileName: "v1.pdf" }),
                content: new Uint8Array([1]),
              });
            }
            return errResult("server_error", "RAW-REPLACEMENT-FAILURE");
          },
        },
      });
      const instance = await loadedInstance(bridge);
      await instance.handleDownloadFile("file-9");
      const firstUrl = (instance.state.downloads["file-9"] as any).url;
      expect(stub.created).toContain(firstUrl);
      await instance.handleDownloadFile("file-9");

      // The old ready URL is revoked exactly once — its cleanup ownership was
      // never lost just because the replacement request went on to fail.
      expect(stub.revoked).toContain(firstUrl);
      expect(stub.revoked.filter((url) => url === firstUrl)).toHaveLength(1);

      // The replacement failure leaves an error state with translated safe
      // feedback only — never the raw adapter message.
      expect(instance.state.downloads["file-9"]).toEqual({ status: "error" });
      expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-REPLACEMENT-FAILURE");
    } finally {
      stub.restore();
    }
  });

  it("translates a thrown Blob/URL.createObjectURL failure into safe failure feedback and clears pending to error", async () => {
    const originalCreate = (URL as any).createObjectURL;
    (URL as any).createObjectURL = () => {
      throw new Error("raw browser exception message that must never leak");
    };
    try {
      const file = fixtureFile({ id: "file-9" });
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () =>
            okResult({ file: fixtureFile({ id: "file-9" }), content: new Uint8Array([1, 2]) }),
        },
      });
      const instance = await loadedInstance(bridge);
      await instance.handleDownloadFile("file-9");

      // Never stuck in "pending"; the thrown browser exception is caught,
      // translated, and never escapes the handler.
      expect(instance.state.downloads["file-9"]).toEqual({ status: "error" });
      expect(JSON.stringify(instance.state.feedback)).not.toContain(
        "raw browser exception message that must never leak",
      );

      // Directly on the adapter-level helper too: the failure outcome carries
      // the existing shape, never a thrown exception.
      const outcome = await archiveUiRequestItemFileDownload(bridge, fixtureContext, "file-9");
      expect(outcome.kind).toBe("failure");
      if (outcome.kind === "failure") {
        expect(JSON.stringify(outcome.presentation)).not.toContain(
          "raw browser exception message that must never leak",
        );
      }
    } finally {
      (URL as any).createObjectURL = originalCreate;
    }
  });

  it("unmounting while a download is pending, followed by a late success, revokes the new URL and applies no state/feedback", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      let resolveDownload:
        | ((value: ArchiveHostAdapterResult<{ file: ArchiveFile; content: Uint8Array }>) => void)
        | undefined;
      const downloadFile = vi.fn(
        () =>
          new Promise<ArchiveHostAdapterResult<{ file: ArchiveFile; content: Uint8Array }>>((resolve) => {
            resolveDownload = resolve;
          }),
      );
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: { downloadFile },
      });
      const instance = await loadedInstance(bridge);

      const pending = instance.handleDownloadFile("file-9");
      expect(instance.state.downloads["file-9"]).toEqual({ status: "pending" });

      instance.componentWillUnmount();

      resolveDownload?.(
        okResult({ file: fixtureFile({ id: "file-9", originalFileName: "late.pdf" }), content: new Uint8Array([7]) }),
      );
      await pending;

      // The late success created exactly one new object URL, and it was
      // revoked immediately — never leaked, never left dangling in state.
      expect(stub.created).toHaveLength(1);
      expect(stub.revoked).toContain(stub.created[0]);
      expect(stub.revoked.filter((url) => url === stub.created[0])).toHaveLength(1);

      // No ready state or success feedback applied after unmount.
      expect(instance.state.downloads["file-9"]).toEqual({ status: "pending" });
    } finally {
      stub.restore();
    }
  });

  it("unmounting while a download is pending, followed by a late failure, applies no state/feedback", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      let resolveDownload:
        | ((value: ArchiveHostAdapterResult<{ file: ArchiveFile; content: Uint8Array }>) => void)
        | undefined;
      const downloadFile = vi.fn(
        () =>
          new Promise<ArchiveHostAdapterResult<{ file: ArchiveFile; content: Uint8Array }>>((resolve) => {
            resolveDownload = resolve;
          }),
      );
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: { downloadFile },
      });
      const instance = await loadedInstance(bridge);

      const pending = instance.handleDownloadFile("file-9");
      instance.componentWillUnmount();
      resolveDownload?.({ ok: false, error: { category: "server_error", message: "RAW-LATE-FAILURE" } });
      await pending;

      expect(instance.state.downloads["file-9"]).toEqual({ status: "pending" });
      expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-LATE-FAILURE");
      expect(stub.created).toHaveLength(0);
      expect(stub.revoked).toHaveLength(0);
    } finally {
      stub.restore();
    }
  });

  it("revokes remaining object URLs on unmount", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () =>
            okResult({ file: fixtureFile({ id: "file-9" }), content: new Uint8Array([1]) }),
        },
      });
      const instance = await loadedInstance(bridge);
      await instance.handleDownloadFile("file-9");
      const url = (instance.state.downloads["file-9"] as any).url;
      instance.componentWillUnmount();
      expect(stub.revoked).toContain(url);
    } finally {
      stub.restore();
    }
  });

  it("duplicate pending download for the same file is blocked", async () => {
    const stub = stubObjectUrls();
    try {
      let callCount = 0;
      const file = fixtureFile({ id: "file-9" });
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () => {
            callCount += 1;
            return okResult({ file: fixtureFile({ id: "file-9" }), content: new Uint8Array([1]) });
          },
        },
      });
      const instance = await loadedInstance(bridge);
      const first = instance.handleDownloadFile("file-9");
      const second = instance.handleDownloadFile("file-9");
      await Promise.all([first, second]);
      expect(callCount).toBe(1);
    } finally {
      stub.restore();
    }
  });

  it("failure produces safe feedback only, never the raw adapter message", async () => {
    const bridge = createFakeBridge({
      transportOverrides: { downloadFile: async () => errResult("server_error", "RAW-DOWNLOAD") },
    });
    const outcome = await archiveUiRequestItemFileDownload(bridge, fixtureContext, "file-1");
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-DOWNLOAD");
    }
  });

  it("never revokes the same object URL twice across a success-then-failure replacement followed by unmount", async () => {
    const stub = stubObjectUrls();
    try {
      const file = fixtureFile({ id: "file-9" });
      let callCount = 0;
      const bridge = createFakeBridge({
        serviceOverrides: readyServiceOverrides({ files: [file], capabilities: allowCapabilities(["view"]) }),
        transportOverrides: {
          downloadFile: async () => {
            callCount += 1;
            if (callCount === 1) {
              return okResult({ file: fixtureFile({ id: "file-9" }), content: new Uint8Array([1]) });
            }
            return errResult("server_error", "RAW-SECOND-FAILURE");
          },
        },
      });
      const instance = await loadedInstance(bridge);

      await instance.handleDownloadFile("file-9"); // ready
      const firstUrl = (instance.state.downloads["file-9"] as any).url;
      await instance.handleDownloadFile("file-9"); // replacement fails; firstUrl revoked exactly once
      instance.componentWillUnmount(); // no ready entry left to revoke again

      const revocationsOfFirstUrl = stub.revoked.filter((url) => url === firstUrl);
      expect(revocationsOfFirstUrl).toHaveLength(1);
      // Every recorded revocation across this whole scenario is distinct —
      // no URL was ever revoked twice.
      expect(new Set(stub.revoked).size).toBe(stub.revoked.length);
    } finally {
      stub.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 14: file soft deletion.
// ---------------------------------------------------------------------------

describe("active-file soft deletion", () => {
  it("archiveUiFileDeleteConfirmationLabels names the exact file and action", () => {
    expect(archiveUiFileDeleteConfirmationLabels(fixtureFile({ originalFileName: "a.pdf" }))).toEqual({
      actionLabel: "Delete file",
      subjectLabel: 'file "a.pdf"',
    });
  });

  it("archiveUiToRecoverableFileProjection builds a field-by-field projection, never a spread of ArchiveFile", () => {
    const deletedAt = new Date("2026-02-01T00:00:00.000Z");
    const file = fixtureFile({ deletedAt, sizeBytes: 99 });
    const projection = archiveUiToRecoverableFileProjection(file);
    expect(projection).not.toBeNull();
    expect(Object.keys(projection!).sort()).toEqual(
      ["archiveItemId", "deletedAt", "extension", "id", "mimeType", "originalFileName", "sizeBytes"].sort(),
    );
    expect((projection as any).companyId).toBeUndefined();
    expect((projection as any).uploadedByUserId).toBeUndefined();
  });

  it("archiveUiToRecoverableFileProjection returns null when deletedAt is still null", () => {
    expect(archiveUiToRecoverableFileProjection(fixtureFile({ deletedAt: null }))).toBeNull();
  });

  it("success removes the file from the active list and (restore allowed) adds a recoverable projection", () => {
    const item = fixtureItem();
    const deletedFile = fixtureFile({ id: "f-1", deletedAt: now });
    const data: ArchiveItemScreenData = {
      item,
      capabilities: archiveUiItemScreenCapabilities(allowCapabilities(["view", "delete", "restore"])),
      activeFiles: [deletedFile, fixtureFile({ id: "f-2" })],
      recoverableFiles: [],
    };
    const updated = archiveUiApplyFileSoftDelete(data, deletedFile);
    expect(updated.activeFiles.map((f) => f.id)).toEqual(["f-2"]);
    expect(updated.recoverableFiles).toEqual([archiveUiToRecoverableFileProjection(deletedFile)]);
  });

  it("when restore is denied, no recoverable projection is added", () => {
    const item = fixtureItem();
    const deletedFile = fixtureFile({ id: "f-1", deletedAt: now });
    const data: ArchiveItemScreenData = {
      item,
      capabilities: archiveUiItemScreenCapabilities(allowCapabilities(["view", "delete"])),
      activeFiles: [deletedFile],
      recoverableFiles: [],
    };
    const updated = archiveUiApplyFileSoftDelete(data, deletedFile);
    expect(updated.recoverableFiles).toEqual([]);
  });

  it("confirms, calls softDeleteFile with the exact fileId, and updates lists", async () => {
    const deletedFile = fixtureFile({ id: "f-1", deletedAt: now });
    const softDeleteFileSpy = vi.fn(async () => okResult(deletedFile));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [fixtureFile({ id: "f-1" })],
          capabilities: allowCapabilities(["view", "delete", "restore"]),
        }),
        softDeleteFile: softDeleteFileSpy,
      },
    });
    const instance = await loadedInstance(bridge);
    instance.handleRequestFileDelete(fixtureFile({ id: "f-1" }));
    await instance.handleConfirmFileDelete();

    expect(softDeleteFileSpy).toHaveBeenCalledWith(fixtureContext, "f-1");
    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.activeFiles).toEqual([]);
      expect(instance.state.viewState.data.recoverableFiles.map((f) => f.id)).toEqual(["f-1"]);
    }
  });

  it("duplicate submission for the same file is blocked", async () => {
    let callCount = 0;
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [fixtureFile({ id: "f-1" })],
          capabilities: allowCapabilities(["view", "delete"]),
        }),
        softDeleteFile: async () => {
          callCount += 1;
          return okResult(fixtureFile({ id: "f-1", deletedAt: now }));
        },
      },
    });
    const instance = await loadedInstance(bridge);
    instance.handleRequestFileDelete(fixtureFile({ id: "f-1" }));
    const first = instance.handleConfirmFileDelete();
    const second = instance.handleConfirmFileDelete();
    await Promise.all([first, second]);
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Proof 15: deleted-file restore.
// ---------------------------------------------------------------------------

describe("deleted-file restore", () => {
  it("calls restoreFile with the exact fileId and moves the entry recoverable -> active on success", async () => {
    const restored = fixtureFile({ id: "r-1", deletedAt: null });
    const restoreFileSpy = vi.fn(async () => okResult(restored));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [],
          recoverableFiles: [fixtureRecoverableFile({ id: "r-1" })],
          capabilities: allowCapabilities(["view", "restore"]),
        }),
        restoreFile: restoreFileSpy,
      },
    });
    const instance = await loadedInstance(bridge);
    await instance.handleRestoreFile("r-1");

    expect(restoreFileSpy).toHaveBeenCalledWith(fixtureContext, "r-1");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.recoverableFiles).toEqual([]);
      expect(instance.state.viewState.data.activeFiles.map((f) => f.id)).toEqual(["r-1"]);
    }
  });

  it("physical-verification failure does not mutate lists as though restore succeeded", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [],
          recoverableFiles: [fixtureRecoverableFile({ id: "r-1" })],
          capabilities: allowCapabilities(["view", "restore"]),
        }),
        restoreFile: async () => errResult("server_error", "RAW-RESTORE"),
      },
    });
    const instance = await loadedInstance(bridge);
    await instance.handleRestoreFile("r-1");

    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.recoverableFiles.map((f) => f.id)).toEqual(["r-1"]);
      expect(instance.state.viewState.data.activeFiles).toEqual([]);
    }
    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-RESTORE");
  });

  it("restore is additive, no destructive confirmation is required", async () => {
    const restoreFileSpy = vi.fn(async () => okResult(fixtureFile({ id: "r-1" })));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [],
          recoverableFiles: [fixtureRecoverableFile({ id: "r-1" })],
          capabilities: allowCapabilities(["view", "restore"]),
        }),
        restoreFile: restoreFileSpy,
      },
    });
    const instance = await loadedInstance(bridge);
    // No confirmation-request call anywhere before invoking restore directly.
    await instance.handleRestoreFile("r-1");
    expect(restoreFileSpy).toHaveBeenCalledTimes(1);
  });

  it("duplicate submission for the same file is blocked", async () => {
    let callCount = 0;
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({
          files: [],
          recoverableFiles: [fixtureRecoverableFile({ id: "r-1" })],
          capabilities: allowCapabilities(["view", "restore"]),
        }),
        restoreFile: async () => {
          callCount += 1;
          return okResult(fixtureFile({ id: "r-1" }));
        },
      },
    });
    const instance = await loadedInstance(bridge);
    const first = instance.handleRestoreFile("r-1");
    const second = instance.handleRestoreFile("r-1");
    await Promise.all([first, second]);
    expect(callCount).toBe(1);
  });

  it("when restore is denied, listRecoverableFilesForItem is never called and no restore call is possible", async () => {
    const listRecoverableSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view"])),
        readItem: async () => okResult(fixtureItem()),
        listFilesForItem: async () => okResult([]),
        listRecoverableFilesForItem: listRecoverableSpy,
      },
    });
    await loadedInstance(bridge);
    expect(listRecoverableSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Proof 16: actual mountable lifecycle/state/render wiring.
// ---------------------------------------------------------------------------

describe("ArchiveItemScreen — real componentDidMount wiring", () => {
  it("componentDidMount triggers the real load and populates state (not a detached helper only)", async () => {
    const readItemSpy = vi.fn(async () => okResult(fixtureItem({ name: "Mounted Item" })));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(allowCapabilities(["view"])),
        readItem: readItemSpy,
        listFilesForItem: async () => okResult([]),
      },
    });
    const instance = new ArchiveItemScreen({ bridge, itemId: "item-current" });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    // Allow the in-flight promise chain kicked off by componentDidMount to
    // resolve.
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));

    expect(readItemSpy).toHaveBeenCalled();
    expect(instance.state.viewState.status).toBe("ready");
    const rendered = instance.render();
    expect(rendered).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// archiveUiFormatByteSize / archiveUiApplyUpdatedItem — small pure-helper
// proofs supporting the above.
// ---------------------------------------------------------------------------

describe("archiveUiFormatByteSize", () => {
  it("formats bytes/KB/MB", () => {
    expect(archiveUiFormatByteSize(500)).toBe("500 B");
    expect(archiveUiFormatByteSize(2048)).toBe("2.0 KB");
    expect(archiveUiFormatByteSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("archiveUiApplyUpdatedItem", () => {
  it("replaces only the item field", () => {
    const data: ArchiveItemScreenData = {
      item: fixtureItem({ status: "active" }),
      capabilities: archiveUiItemScreenCapabilities(denyAllCapabilities()),
      activeFiles: [],
      recoverableFiles: [],
    };
    const updated = archiveUiApplyUpdatedItem(data, fixtureItem({ status: "archived" }));
    expect(updated.item.status).toBe("archived");
    expect(updated.capabilities).toBe(data.capabilities);
  });
});
