import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Component } from "react";
import { describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-09 (the Archive-owned deleted-content recovery
// screen). Every bridge/supporting type below comes from the public "./ui"
// entry point, mirroring the TASK-02–08 test discipline. No jsdom/Testing
// Library/react-dom is used anywhere in this file — see
// `recovery-screen.tsx`'s file-top HOOK-CALL CONSTRAINT comment for why
// `ArchiveRecoveryScreen` is a class component, and `attachSyncUpdater`
// below (duplicated locally per the established TASK-04–08 precedent) for
// how this file exercises its real setState/lifecycle/render methods
// without a DOM renderer.
//
// This screen never calls `bridge.identity` or `bridge.transport` — both
// fakes below are throwing spies so any accidental call fails loudly.
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchiveRecoveryScreen } from "../index.js";
import type { ArchiveRecoveryScreenProps } from "../index.js";
import {
  archiveUiLoadRecoveryListing,
  archiveUiRemoveRestoredRecoveryTarget,
  archiveUiSubmitRecoveryRestore,
} from "../recovery-screen.js";
import type {
  ArchiveContextInput,
  ArchiveHostAdapterError,
  ArchiveHostAdapterResult,
  ArchiveRecoverableFolder,
  ArchiveRecoverableItem,
  ArchiveRecoveryListing,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fixtureContext: ArchiveContextInput = {
  userId: "user-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  archiveModuleAccess: true,
};

function fixtureFolder(overrides: Partial<ArchiveRecoverableFolder> = {}): ArchiveRecoverableFolder {
  return {
    id: "folder-aaaa-1111",
    parentFolderId: "parent-bbbb-2222",
    name: "Contracts",
    deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function fixtureItem(overrides: Partial<ArchiveRecoverableItem> = {}): ArchiveRecoverableItem {
  return {
    id: "item-cccc-3333",
    folderId: "folder-dddd-4444",
    name: "Budget Report",
    deletedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

const SAFE_TITLES_BY_CATEGORY: Record<ArchiveHostAdapterError["category"], string> = {
  unauthorized: "Access denied",
  not_found: "Not found",
  validation: "Check your input",
  server_error: "Something went wrong",
};

const safeTranslateError: ArchiveUiErrorTranslator = (error: ArchiveHostAdapterError) => ({
  category: error.category,
  title: SAFE_TITLES_BY_CATEGORY[error.category],
  description: `Safe description for ${error.category}.`,
});

function okResult<T>(value: T): ArchiveHostAdapterResult<T> {
  return { ok: true, value };
}

function errResult<T = unknown>(
  category: ArchiveHostAdapterError["category"],
  message: string,
): ArchiveHostAdapterResult<T> {
  return { ok: false, error: { category, message } };
}

// The exact, closed 37-method `ArchiveUiServicePort` allow-list (see
// `bridge.tsx`'s `ArchiveUiServiceMethodName`). Iterating this list lets the
// "zero unrelated calls" proofs below assert non-invocation across every
// OTHER method automatically instead of naming each one by hand.
const ARCHIVE_UI_SERVICE_METHOD_NAMES = [
  "assignArchiveRole",
  "createArchiveRole",
  "createFolder",
  "createItem",
  "deleteArchiveRole",
  "explainPermissions",
  "getEffectiveCapabilities",
  "getFolderPath",
  "listArchiveRoleAssignmentsForRole",
  "listArchiveRoles",
  "listChildFolders",
  "listFilesForItem",
  "listItemsInFolder",
  "listPermissionHistory",
  "listPermissionRules",
  "listRecoverableContent",
  "listRecoverableFilesForItem",
  "listResourceHistory",
  "listRootFolders",
  "readFolder",
  "readItem",
  "renameArchiveRole",
  "restoreFile",
  "restoreFolder",
  "restoreItem",
  "revokePermissionRule",
  "searchFolders",
  "searchItems",
  "setFolderDates",
  "setFolderStatus",
  "setItemDates",
  "setItemStatus",
  "setPermissionRule",
  "softDeleteFile",
  "softDeleteFolder",
  "softDeleteItem",
  "unassignArchiveRole",
] as const;

function createStubServicePort(overrides: Record<string, unknown> = {}): ArchiveUiServicePort {
  const base: Record<string, unknown> = {};
  for (const name of ARCHIVE_UI_SERVICE_METHOD_NAMES) {
    base[name] = vi.fn(async () => {
      throw new Error(`archive-ui-recovery-screen fixture: ${name} must not be called`);
    });
  }
  return { ...base, ...overrides } as unknown as ArchiveUiServicePort;
}

function createStubTransport(): ArchiveUiFileTransport {
  return {
    uploadFile: vi.fn(async () => {
      throw new Error("archive-ui-recovery-screen fixture: transport.uploadFile must not be called");
    }),
    downloadFile: vi.fn(async () => {
      throw new Error("archive-ui-recovery-screen fixture: transport.downloadFile must not be called");
    }),
  } as unknown as ArchiveUiFileTransport;
}

function createStubIdentity(): ArchiveUiIdentityPort {
  return {
    resolvePlatformUsers: vi.fn(async () => {
      throw new Error("archive-ui-recovery-screen fixture: identity.resolvePlatformUsers must not be called");
    }),
    listAssignableCompanyMembers: vi.fn(async () => {
      throw new Error(
        "archive-ui-recovery-screen fixture: identity.listAssignableCompanyMembers must not be called",
      );
    }),
  } as unknown as ArchiveUiIdentityPort;
}

interface FakeBridgeOptions {
  readonly context?: ArchiveContextInput;
  readonly serviceOverrides?: Record<string, unknown>;
  readonly translateError?: ArchiveUiErrorTranslator;
  readonly navigate?: (intent: ArchiveUiNavigationIntent) => void;
}

function createFakeBridge(options: FakeBridgeOptions = {}): ArchiveUiBridge {
  return {
    getContext: vi.fn(() => options.context ?? fixtureContext),
    getCurrentUserDisplay: () => undefined,
    navigate: vi.fn(options.navigate ?? (() => {})),
    service: createStubServicePort(options.serviceOverrides ?? {}),
    transport: createStubTransport(),
    translateError: options.translateError ?? safeTranslateError,
    identity: createStubIdentity(),
  };
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

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolveFn!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolveFn = res;
  });
  return { promise, resolve: resolveFn };
}

function mountedScreen(bridge: ArchiveUiBridge): ArchiveRecoveryScreen {
  const instance = new ArchiveRecoveryScreen({ bridge });
  attachSyncUpdater(instance);
  instance.componentDidMount();
  return instance;
}

// Narrows the current view state to `ready` or throws — every restore/order
// assertion below reads through this helper so a wrong status fails loudly
// with a clear message instead of a confusing `undefined` property error.
function readyListing(instance: ArchiveRecoveryScreen): ArchiveRecoveryListing {
  const viewState = instance.state.viewState;
  if (viewState.status !== "ready") {
    throw new Error(`expected ready view state, got "${viewState.status}"`);
  }
  return viewState.data;
}

function flattenElements(node: unknown, out: any[] = []): any[] {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) flattenElements(child, out);
    return out;
  }
  const el = node as { type?: unknown; props?: any };
  if (!("type" in el) || !("props" in el)) return out;
  out.push(el);
  if (typeof el.type === "function") {
    const output = (el.type as (props: any) => unknown)(el.props);
    flattenElements(output, out);
  } else if (el.props && "children" in el.props) {
    flattenElements(el.props.children, out);
  }
  return out;
}

function elementText(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) elementText(child, out);
    return out;
  }
  if (node !== null && typeof node === "object") {
    const el = node as { type?: unknown; props?: any };
    if ("type" in el && "props" in el) {
      if (typeof el.type === "function") {
        const output = (el.type as (props: any) => unknown)(el.props);
        elementText(output, out);
        return out;
      }
      elementText(el.props?.children, out);
      for (const key of ["aria-label", "aria-labelledby", "aria-describedby"]) {
        if (typeof el.props?.[key] === "string") out.push(el.props[key]);
      }
      return out;
    }
  }
  return out;
}

function findByAttr(node: unknown, attr: string, value: string): any {
  return flattenElements(node).find((el) => el.props?.[attr] === value);
}

// ---------------------------------------------------------------------------
// Pure controller-logic unit tests (direct calls, no class instance).
// ---------------------------------------------------------------------------

describe("archiveUiLoadRecoveryListing", () => {
  it("maps an unauthorized failure to the denied state via bridge.translateError", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => errResult("unauthorized", "raw") },
    });
    const viewState = await archiveUiLoadRecoveryListing(bridge, fixtureContext);
    expect(viewState.status).toBe("denied");
    if (viewState.status === "denied") {
      expect(viewState.presentation.title).toBe(SAFE_TITLES_BY_CATEGORY.unauthorized);
    }
  });

  it("maps every other failure category to the translated error state", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => errResult("server_error", "raw") },
    });
    const viewState = await archiveUiLoadRecoveryListing(bridge, fixtureContext);
    expect(viewState.status).toBe("error");
  });

  it("maps a both-empty listing to the empty state", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult({ folders: [], items: [] }) },
    });
    const viewState = await archiveUiLoadRecoveryListing(bridge, fixtureContext);
    expect(viewState.status).toBe("empty");
  });

  it("maps a non-empty listing to the ready state with the exact listing", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder()], items: [] };
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing) },
    });
    const viewState = await archiveUiLoadRecoveryListing(bridge, fixtureContext);
    expect(viewState).toEqual({ status: "ready", data: listing });
  });
});

describe("archiveUiSubmitRecoveryRestore", () => {
  it("calls restoreFolder for a folder target and never restoreItem", async () => {
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const restoreItem = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({ serviceOverrides: { restoreFolder, restoreItem } });
    const outcome = await archiveUiSubmitRecoveryRestore(bridge, fixtureContext, {
      resourceType: "folder",
      id: "folder-a",
    });
    expect(outcome.kind).toBe("success");
    expect(restoreFolder).toHaveBeenCalledTimes(1);
    expect(restoreFolder).toHaveBeenCalledWith(fixtureContext, "folder-a");
    expect(restoreItem).not.toHaveBeenCalled();
  });

  it("calls restoreItem for an item target and never restoreFolder", async () => {
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const restoreItem = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({ serviceOverrides: { restoreFolder, restoreItem } });
    const outcome = await archiveUiSubmitRecoveryRestore(bridge, fixtureContext, {
      resourceType: "item",
      id: "item-a",
    });
    expect(outcome.kind).toBe("success");
    expect(restoreItem).toHaveBeenCalledTimes(1);
    expect(restoreItem).toHaveBeenCalledWith(fixtureContext, "item-a");
    expect(restoreFolder).not.toHaveBeenCalled();
  });

  it("returns a translated failure outcome, never a raw message, on adapter failure", async () => {
    const restoreFolder = vi.fn(async () => errResult("validation", "raw-detail"));
    const bridge = createFakeBridge({ serviceOverrides: { restoreFolder } });
    const outcome = await archiveUiSubmitRecoveryRestore(bridge, fixtureContext, {
      resourceType: "folder",
      id: "folder-a",
    });
    expect(outcome).toEqual({
      kind: "failure",
      presentation: { category: "validation", title: "Check your input", description: "Safe description for validation." },
    });
  });
});

describe("archiveUiRemoveRestoredRecoveryTarget", () => {
  it("removes only the exact folder id, preserving the items array and remaining folder order", () => {
    const folderA = fixtureFolder({ id: "folder-a" });
    const folderB = fixtureFolder({ id: "folder-b" });
    const item = fixtureItem({ id: "item-a" });
    const listing: ArchiveRecoveryListing = { folders: [folderA, folderB], items: [item] };
    const next = archiveUiRemoveRestoredRecoveryTarget(listing, { resourceType: "folder", id: "folder-a" });
    expect(next.folders).toEqual([folderB]);
    expect(next.items).toBe(listing.items);
  });

  it("removes only the exact item id, preserving the folders array and remaining item order", () => {
    const folder = fixtureFolder({ id: "folder-a" });
    const itemA = fixtureItem({ id: "item-a" });
    const itemB = fixtureItem({ id: "item-b" });
    const listing: ArchiveRecoveryListing = { folders: [folder], items: [itemA, itemB] };
    const next = archiveUiRemoveRestoredRecoveryTarget(listing, { resourceType: "item", id: "item-a" });
    expect(next.items).toEqual([itemB]);
    expect(next.folders).toBe(listing.folders);
  });
});

// ---------------------------------------------------------------------------
// Proof 20: `ArchiveRecoveryScreenProps` is exactly one readonly property.
// ---------------------------------------------------------------------------

describe("ArchiveRecoveryScreenProps", () => {
  it("proof 20: is exactly one readonly bridge property", () => {
    const bridge = createFakeBridge();
    const props: ArchiveRecoveryScreenProps = { bridge };
    expect(Object.keys(props)).toEqual(["bridge"]);
  });

  it("proof 20b: rejects an extra property at compile time", () => {
    const bridge = createFakeBridge();
    // @ts-expect-error - ArchiveRecoveryScreenProps has exactly one property
    const invalid: ArchiveRecoveryScreenProps = { bridge, extra: true };
    void invalid;
  });
});

// ---------------------------------------------------------------------------
// Proof 24 support: import-surface scan (redundant with, but independent of,
// `archive-ui-package-surface.test.tsx`'s repo-wide Shell-specifier scan).
// ---------------------------------------------------------------------------

describe("recovery-screen.tsx import surface", () => {
  it("proof 24: imports only react, the local bridge/view-state/feedback modules, and the public Archive package", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "..", "recovery-screen.tsx"), "utf8");
    // Matches multi-line `import { ... } from "specifier";` statements by
    // capturing every `from "specifier"` clause, not per physical line.
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    const allowedSpecifiers = [
      "react",
      "./bridge.js",
      "./view-state.js",
      "./feedback.js",
      "@customprojects/archive-service",
    ];
    for (const specifier of specifiers) {
      expect(allowedSpecifiers, `unexpected import specifier: ${specifier}`).toContain(specifier);
    }
  });
});

// ---------------------------------------------------------------------------
// ArchiveRecoveryScreen — initial load (proofs 1, 2, 3, 4, 9, 14, 16a).
// ---------------------------------------------------------------------------

describe("ArchiveRecoveryScreen — initial load", () => {
  it("proof 1: captures exactly one context and calls listRecoverableContent exactly once", async () => {
    const listRecoverableContent = vi.fn(async () => okResult({ folders: [], items: [] }));
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent } });
    mountedScreen(bridge);
    await flushMicrotasks();

    expect(bridge.getContext).toHaveBeenCalledTimes(1);
    expect(listRecoverableContent).toHaveBeenCalledTimes(1);
    expect(listRecoverableContent).toHaveBeenCalledWith(fixtureContext);
  });

  it("proof 2: makes zero capability, identity, transport, history, file-discovery, normal-read, or mutation calls during initial load", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder()], items: [fixtureItem()] };
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing) },
    });
    mountedScreen(bridge);
    await flushMicrotasks();

    const service = bridge.service as unknown as Record<string, ReturnType<typeof vi.fn>>;
    for (const name of ARCHIVE_UI_SERVICE_METHOD_NAMES) {
      if (name === "listRecoverableContent") continue;
      expect(service[name], `${name} must not be called during initial load`).not.toHaveBeenCalled();
    }
    const identity = bridge.identity as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(identity.resolvePlatformUsers).not.toHaveBeenCalled();
    expect(identity.listAssignableCompanyMembers).not.toHaveBeenCalled();
    const transport = bridge.transport as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(transport.uploadFile).not.toHaveBeenCalled();
    expect(transport.downloadFile).not.toHaveBeenCalled();
    expect(bridge.navigate).not.toHaveBeenCalled();
  });

  it("proof 3a: renders loading before the load resolves", async () => {
    const deferred = createDeferred<ArchiveHostAdapterResult<ArchiveRecoveryListing>>();
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: () => deferred.promise } });
    const instance = mountedScreen(bridge);
    expect(instance.state.viewState.status).toBe("loading");
    deferred.resolve(okResult({ folders: [], items: [] }));
    await flushMicrotasks();
  });

  it("proof 3b: renders denied on an unauthorized failure using bridge.translateError", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => errResult("unauthorized", "raw") },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("denied");
    if (instance.state.viewState.status === "denied") {
      expect(instance.state.viewState.presentation.title).toBe(SAFE_TITLES_BY_CATEGORY.unauthorized);
    }
  });

  it("proof 3c: renders a translated error on every other failure category", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => errResult("server_error", "raw") },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("error");
  });

  it("proof 3d: renders the explicit empty state when both arrays are empty", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult({ folders: [], items: [] }) },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("empty");
    const tree = instance.render();
    expect(elementText(tree).join(" ")).toContain("No deleted content is available to restore.");
  });

  it("proof 3e: renders a folders-only ready state with an explicit items-empty message", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder()], items: [] };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(readyListing(instance).folders.length).toBe(1);
    expect(readyListing(instance).items.length).toBe(0);
    const tree = instance.render();
    expect(findByAttr(tree, "data-archive-ui-recovery-items-empty", "true")).toBeDefined();
    expect(findByAttr(tree, "data-archive-ui-recovery-folders-empty", "true")).toBeUndefined();
  });

  it("proof 3f: renders an items-only ready state with an explicit folders-empty message", async () => {
    const listing: ArchiveRecoveryListing = { folders: [], items: [fixtureItem()] };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(readyListing(instance).items.length).toBe(1);
    expect(readyListing(instance).folders.length).toBe(0);
    const tree = instance.render();
    expect(findByAttr(tree, "data-archive-ui-recovery-folders-empty", "true")).toBeDefined();
    expect(findByAttr(tree, "data-archive-ui-recovery-items-empty", "true")).toBeUndefined();
  });

  it("proof 3g: renders a mixed ready state with both sections populated", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder()], items: [fixtureItem()] };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(readyListing(instance).folders.length).toBe(1);
    expect(readyListing(instance).items.length).toBe(1);
    const tree = instance.render();
    expect(findByAttr(tree, "data-archive-ui-recovery-folders-empty", "true")).toBeUndefined();
    expect(findByAttr(tree, "data-archive-ui-recovery-items-empty", "true")).toBeUndefined();
  });

  it("proof 4: preserves backend order within each array separately, with no sort or merge", async () => {
    const folders = [fixtureFolder({ id: "f-3", name: "Zed" }), fixtureFolder({ id: "f-1", name: "Alpha" })];
    const items = [fixtureItem({ id: "i-2", name: "Beta" }), fixtureItem({ id: "i-1", name: "Yankee" })];
    const listing: ArchiveRecoveryListing = { folders, items };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["f-3", "f-1"]);
    expect(readyListing(instance).items.map((i) => i.id)).toEqual(["i-2", "i-1"]);
  });

  it("proof 14: an older initial load completing after a newer one cannot overwrite it", async () => {
    const deferredFirst = createDeferred<ArchiveHostAdapterResult<ArchiveRecoveryListing>>();
    let call = 0;
    const listRecoverableContent = vi.fn(() => {
      call += 1;
      if (call === 1) return deferredFirst.promise;
      return Promise.resolve(okResult({ folders: [fixtureFolder({ id: "folder-new" })], items: [] }));
    });
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await instance.runInitialLoad();
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-new"]);

    deferredFirst.resolve(okResult({ folders: [fixtureFolder({ id: "folder-old" })], items: [] }));
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-new"]);
  });

  it("proof 16a: disposal prevents a late initial-load completion from setting state or feedback", async () => {
    const deferred = createDeferred<ArchiveHostAdapterResult<ArchiveRecoveryListing>>();
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: () => deferred.promise } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("loading");

    const stateBeforeDisposal = instance.state;
    instance.componentWillUnmount();
    deferred.resolve(okResult({ folders: [], items: [] }));
    await flushMicrotasks();

    expect(instance.state).toBe(stateBeforeDisposal);
  });
});

// ---------------------------------------------------------------------------
// ArchiveRecoveryScreen — presentation (proof 5).
// ---------------------------------------------------------------------------

describe("ArchiveRecoveryScreen — presentation", () => {
  it("proof 5a: renders human type/name while ids, parent/folder ids, and raw backend messages stay out of visible/accessible copy", async () => {
    const folder = fixtureFolder({ id: "folder-secret-id-9f2", parentFolderId: "parent-secret-id-3a1", name: "Contracts" });
    const item = fixtureItem({ id: "item-secret-id-7c4", folderId: "folder-secret-id-9f2", name: "Budget Report" });
    const listing: ArchiveRecoveryListing = { folders: [folder], items: [item] };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    const text = elementText(instance.render()).join(" | ");
    expect(text).toContain("Contracts");
    expect(text).toContain("Budget Report");
    expect(text).toContain("Folder");
    expect(text).toContain("Item");
    expect(text).not.toContain("folder-secret-id-9f2");
    expect(text).not.toContain("parent-secret-id-3a1");
    expect(text).not.toContain("item-secret-id-7c4");
  });

  it("proof 5b: a translated restore failure never exposes the raw backend message", async () => {
    const folder = fixtureFolder({ id: "folder-a", name: "Folder A" });
    const listing: ArchiveRecoveryListing = { folders: [folder], items: [] };
    const RAW_MESSAGE = "raw-backend-secret-detail-should-never-render";
    const restoreFolder = vi.fn(async () => errResult("server_error", RAW_MESSAGE));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    const text = elementText(instance.render()).join(" | ");
    expect(text).not.toContain(RAW_MESSAGE);
    expect(instance.state.feedback.kind).toBe("visible");
    if (instance.state.feedback.kind === "visible") {
      expect(instance.state.feedback.feedback.description).not.toContain(RAW_MESSAGE);
    }
  });

  it("restore-button accessible names identify the human resource name and type, never the id", async () => {
    const folder = fixtureFolder({ id: "folder-xyz", name: "Contracts" });
    const item = fixtureItem({ id: "item-xyz", name: "Budget Report" });
    const listing: ArchiveRecoveryListing = { folders: [folder], items: [item] };
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent: async () => okResult(listing) } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    const tree = instance.render();
    const folderButton = findByAttr(tree, "data-archive-ui-restore-folder", "folder-xyz");
    const itemButton = findByAttr(tree, "data-archive-ui-restore-item", "item-xyz");
    expect(folderButton.props["aria-label"]).toBe('Restore folder "Contracts"');
    expect(itemButton.props["aria-label"]).toBe('Restore item "Budget Report"');
  });
});

// ---------------------------------------------------------------------------
// ArchiveRecoveryScreen — restore behavior (proofs 6–13, 15, 16b, 17, 18).
// ---------------------------------------------------------------------------

describe("ArchiveRecoveryScreen — restore behavior", () => {
  it("proof 6: a folder row restore calls restoreFolder exactly once and never restoreItem/restoreFile", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const restoreItem = vi.fn(async () => okResult({} as any));
    const restoreFile = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem, restoreFile },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    expect(restoreFolder).toHaveBeenCalledTimes(1);
    expect(restoreFolder).toHaveBeenCalledWith(fixtureContext, "folder-a");
    expect(restoreItem).not.toHaveBeenCalled();
    expect(restoreFile).not.toHaveBeenCalled();
  });

  it("proof 7: an item row restore calls restoreItem exactly once and never restoreFolder/restoreFile", async () => {
    const listing: ArchiveRecoveryListing = { folders: [], items: [fixtureItem({ id: "item-a" })] };
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const restoreItem = vi.fn(async () => okResult({} as any));
    const restoreFile = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem, restoreFile },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreItem("item-a", "Item A");
    await flushMicrotasks();

    expect(restoreItem).toHaveBeenCalledTimes(1);
    expect(restoreItem).toHaveBeenCalledWith(fixtureContext, "item-a");
    expect(restoreFolder).not.toHaveBeenCalled();
    expect(restoreFile).not.toHaveBeenCalled();
  });

  it("proof 8: success removes only the exact typed target, preserves every other row/order, and emits safe feedback naming the human type/name", async () => {
    const folderA = fixtureFolder({ id: "folder-a", name: "Folder A" });
    const folderB = fixtureFolder({ id: "folder-b", name: "Folder B" });
    const itemC = fixtureItem({ id: "item-c", name: "Item C" });
    const listing: ArchiveRecoveryListing = { folders: [folderA, folderB], items: [itemC] };
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-b"]);
    expect(readyListing(instance).items.map((i) => i.id)).toEqual(["item-c"]);
    expect(instance.state.feedback.kind).toBe("visible");
    if (instance.state.feedback.kind === "visible") {
      expect(instance.state.feedback.feedback.title).toBe("Folder restored");
      expect(instance.state.feedback.feedback.description).toBe("Folder A");
    }
    expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(false);
  });

  it("proof 9: restoring the final visible row transitions to the empty state", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-only" })], items: [] };
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-only", "Only Folder");
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("empty");
  });

  it.each(["unauthorized", "not_found", "validation", "server_error"] as const)(
    "proof 10: a %s restore failure keeps the row and emits translated copy only",
    async (category) => {
      const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
      const restoreFolder = vi.fn(async () => errResult(category, "raw-message"));
      const bridge = createFakeBridge({
        serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
      });
      const instance = mountedScreen(bridge);
      await flushMicrotasks();

      instance.handleRestoreFolder("folder-a", "Folder A");
      await flushMicrotasks();

      expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-a"]);
      expect(instance.state.feedback.kind).toBe("visible");
      if (instance.state.feedback.kind === "visible") {
        expect(instance.state.feedback.feedback.intent).toBe("failure");
        expect(instance.state.feedback.feedback.title).toBe(SAFE_TITLES_BY_CATEGORY[category]);
      }
      expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(false);
    },
  );

  it("proof 11: duplicate submission for the exact same typed target is blocked while pending", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const deferred = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferred.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    instance.handleRestoreFolder("folder-a", "Folder A");
    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    expect(restoreFolder).toHaveBeenCalledTimes(1);
    deferred.resolve(okResult({} as any));
    await flushMicrotasks();
  });

  it("proof 12: folder and item sharing an id have independent pending keys and exact routing", async () => {
    const sharedId = "shared-1";
    const listing: ArchiveRecoveryListing = {
      folders: [fixtureFolder({ id: sharedId, name: "Shared Folder" })],
      items: [fixtureItem({ id: sharedId, name: "Shared Item" })],
    };
    const deferredFolder = createDeferred<ArchiveHostAdapterResult<any>>();
    const deferredItem = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredFolder.promise);
    const restoreItem = vi.fn(() => deferredItem.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder(sharedId, "Shared Folder");
    instance.handleRestoreItem(sharedId, "Shared Item");
    await flushMicrotasks();

    expect(instance.state.pendingKeys.has("folder:shared-1")).toBe(true);
    expect(instance.state.pendingKeys.has("item:shared-1")).toBe(true);
    expect(restoreFolder).toHaveBeenCalledTimes(1);
    expect(restoreFolder).toHaveBeenCalledWith(fixtureContext, sharedId);
    expect(restoreItem).toHaveBeenCalledTimes(1);
    expect(restoreItem).toHaveBeenCalledWith(fixtureContext, sharedId);

    // A duplicate folder click while pending must not start a second call,
    // and must not disturb the independent item pending key.
    instance.handleRestoreFolder(sharedId, "Shared Folder");
    await flushMicrotasks();
    expect(restoreFolder).toHaveBeenCalledTimes(1);
    expect(instance.state.pendingKeys.has("item:shared-1")).toBe(true);

    deferredFolder.resolve(okResult({} as any));
    deferredItem.resolve(okResult({} as any));
    await flushMicrotasks();
  });

  it("proof 13: different targets overlap and resolve out of order without lost updates or cross-clearing", async () => {
    const folderA = fixtureFolder({ id: "folder-a", name: "Folder A" });
    const folderC = fixtureFolder({ id: "folder-c", name: "Folder C" });
    const itemB = fixtureItem({ id: "item-b", name: "Item B" });
    const listing: ArchiveRecoveryListing = { folders: [folderA, folderC], items: [itemB] };

    const deferredFolderA = createDeferred<ArchiveHostAdapterResult<any>>();
    const deferredItemB = createDeferred<ArchiveHostAdapterResult<any>>();
    const deferredFolderC = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn((_context: unknown, id: string) =>
      id === "folder-a" ? deferredFolderA.promise : deferredFolderC.promise,
    );
    const restoreItem = vi.fn(() => deferredItemB.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    instance.handleRestoreItem("item-b", "Item B");
    instance.handleRestoreFolder("folder-c", "Folder C");
    await flushMicrotasks();

    expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(true);
    expect(instance.state.pendingKeys.has("item:item-b")).toBe(true);
    expect(instance.state.pendingKeys.has("folder:folder-c")).toBe(true);

    // Resolve OUT OF ORDER relative to click order: item B first, folder A
    // second, folder C stays pending throughout.
    deferredItemB.resolve(okResult({} as any));
    await flushMicrotasks();
    deferredFolderA.resolve(okResult({} as any));
    await flushMicrotasks();

    expect(instance.state.pendingKeys.has("item:item-b")).toBe(false);
    expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(false);
    // Cross-clearing check: folder C's pending key must be untouched by the
    // OTHER two targets' completions.
    expect(instance.state.pendingKeys.has("folder:folder-c")).toBe(true);

    const listingAfterTwo = readyListing(instance);
    expect(listingAfterTwo.items).toEqual([]);
    expect(listingAfterTwo.folders.map((f) => f.id)).toEqual(["folder-c"]);

    deferredFolderC.resolve(okResult({} as any));
    await flushMicrotasks();
    expect(instance.state.pendingKeys.size).toBe(0);
    expect(instance.state.viewState.status).toBe("empty");
  });

  it("proof 15: a restore completion arriving after a newer load/context starts causes no mutation and no feedback", async () => {
    const firstListing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const secondListing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-z" })], items: [] };
    const deferredRestore = createDeferred<ArchiveHostAdapterResult<any>>();
    let loadCall = 0;
    const listRecoverableContent = vi.fn(async () => {
      loadCall += 1;
      return okResult(loadCall === 1 ? firstListing : secondListing);
    });
    const restoreFolder = vi.fn(() => deferredRestore.promise);
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent, restoreFolder } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    await instance.runInitialLoad();
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-z"]);
    expect(instance.state.feedback.kind).toBe("idle");

    deferredRestore.resolve(okResult({} as any));
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-z"]);
    expect(instance.state.feedback.kind).toBe("idle");
    expect(instance.state.pendingKeys.size).toBe(0);
  });

  it("proof 16b: disposal prevents a late restore completion from setting state or feedback", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const deferredRestore = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredRestore.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();
    const stateBeforeDisposal = instance.state;
    instance.componentWillUnmount();

    deferredRestore.resolve(okResult({} as any));
    await flushMicrotasks();

    expect(instance.state).toBe(stateBeforeDisposal);
  });

  it("proof 17: target capture cannot drift when a different successful restore replaces the list mid-flight", async () => {
    const folderA = fixtureFolder({ id: "folder-a", name: "Folder A" });
    const itemB = fixtureItem({ id: "item-b", name: "Item B" });
    const listing: ArchiveRecoveryListing = { folders: [folderA], items: [itemB] };
    const deferredFolderA = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredFolderA.promise);
    const restoreItem = vi.fn(async () => okResult({} as any));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A"); // pending, backend target captured as "folder-a"
    await flushMicrotasks();
    instance.handleRestoreItem("item-b", "Item B"); // resolves immediately, replaces the list
    await flushMicrotasks();

    expect(readyListing(instance).items).toEqual([]); // B removed — list replaced while A is still pending

    deferredFolderA.resolve(okResult({} as any));
    await flushMicrotasks();

    expect(restoreFolder).toHaveBeenCalledTimes(1);
    expect(restoreFolder).toHaveBeenCalledWith(fixtureContext, "folder-a");
    expect(instance.state.viewState.status).toBe("empty");
  });

  it("proof 18: no optimistic row removal happens before backend success", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const deferredRestore = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredRestore.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();

    expect(readyListing(instance).folders.map((f) => f.id)).toEqual(["folder-a"]);
    expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(true);

    deferredRestore.resolve(okResult({} as any));
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("empty");
  });

  it("proof 19: never calls listRecoverableFilesForItem, restoreFile, or any other unrelated service method across a full load + restore lifecycle", async () => {
    const listing: ArchiveRecoveryListing = {
      folders: [fixtureFolder({ id: "folder-a" })],
      items: [fixtureItem({ id: "item-b" })],
    };
    const restoreFolder = vi.fn(async () => okResult({} as any));
    const restoreItem = vi.fn(async () => errResult("server_error", "x"));
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    instance.handleRestoreFolder("folder-a", "Folder A");
    instance.handleRestoreItem("item-b", "Item B");
    await flushMicrotasks();

    const service = bridge.service as unknown as Record<string, ReturnType<typeof vi.fn>>;
    for (const name of ARCHIVE_UI_SERVICE_METHOD_NAMES) {
      if (name === "listRecoverableContent" || name === "restoreFolder" || name === "restoreItem") continue;
      expect(service[name], `${name} must never be called by the recovery screen`).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// SELF-INVENTED interleavings (not written verbatim in the card), per the
// mandatory adversarial-validation policy's worker requirement (≥3).
// ---------------------------------------------------------------------------

describe("Worker interleaving W1: the first-clicked restore completes last — both successes survive", () => {
  it("removes both the folder (clicked first, resolves last) and the item (clicked second, resolves first)", async () => {
    const folderA = fixtureFolder({ id: "folder-a", name: "Folder A" });
    const itemB = fixtureItem({ id: "item-b", name: "Item B" });
    const listing: ArchiveRecoveryListing = { folders: [folderA], items: [itemB] };
    const deferredFolder = createDeferred<ArchiveHostAdapterResult<any>>();
    const deferredItem = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredFolder.promise);
    const restoreItem = vi.fn(() => deferredItem.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A"); // clicked FIRST
    await flushMicrotasks();
    instance.handleRestoreItem("item-b", "Item B"); // clicked SECOND
    await flushMicrotasks();

    // Resolve in the OPPOSITE order of clicking.
    deferredItem.resolve(okResult({} as any));
    await flushMicrotasks();
    deferredFolder.resolve(okResult({} as any));
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("empty");
    expect(instance.state.pendingKeys.size).toBe(0);
  });
});

describe("Worker interleaving W2: a reload replaces the list with a same-id row while a restore for that id is still pending", () => {
  it("a stale completion for the old generation never mutates or removes the NEW load's row with the same id", async () => {
    const originalFolder = fixtureFolder({ id: "folder-a", name: "Original Name" });
    const reloadedFolder = fixtureFolder({ id: "folder-a", name: "Reloaded Name" }); // SAME id, new load
    let loadCall = 0;
    const listRecoverableContent = vi.fn(async () => {
      loadCall += 1;
      return okResult({ folders: [loadCall === 1 ? originalFolder : reloadedFolder], items: [] });
    });
    const deferredRestore = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredRestore.promise);
    const bridge = createFakeBridge({ serviceOverrides: { listRecoverableContent, restoreFolder } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Original Name"); // pending under generation 1
    await flushMicrotasks();
    expect(instance.state.pendingKeys.has("folder:folder-a")).toBe(true);

    await instance.runInitialLoad(); // generation 2 — new row shares the SAME id
    await flushMicrotasks();

    expect(readyListing(instance).folders).toEqual([reloadedFolder]);
    // Reload resets pending, so the NEW row shows no stale "restoring" state.
    expect(instance.state.pendingKeys.size).toBe(0);

    deferredRestore.resolve(okResult({} as any)); // stale completion from generation 1
    await flushMicrotasks();

    expect(readyListing(instance).folders).toEqual([reloadedFolder]);
    expect(instance.state.feedback.kind).toBe("idle");
  });
});

describe("Worker interleaving W3: a failure completion arriving after disposal", () => {
  it("applies zero state/feedback and leaves the pre-disposal state reference untouched", async () => {
    const listing: ArchiveRecoveryListing = { folders: [fixtureFolder({ id: "folder-a" })], items: [] };
    const deferredRestore = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredRestore.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder("folder-a", "Folder A");
    await flushMicrotasks();
    const stateBeforeDisposal = instance.state;
    instance.componentWillUnmount();

    deferredRestore.resolve(errResult("server_error", "late failure"));
    await flushMicrotasks();

    expect(instance.state).toBe(stateBeforeDisposal);
  });
});

describe("Worker interleaving W4: a folder and item sharing the same id — one succeeds, the other fails, out of order", () => {
  it("resolves each independently: the failing one keeps its row and clears its own pending state, the succeeding one is removed, with zero cross-effect", async () => {
    const sharedId = "shared-1";
    const folder = fixtureFolder({ id: sharedId, name: "Shared Folder" });
    const item = fixtureItem({ id: sharedId, name: "Shared Item" });
    const listing: ArchiveRecoveryListing = { folders: [folder], items: [item] };
    const deferredFolder = createDeferred<ArchiveHostAdapterResult<any>>();
    const deferredItem = createDeferred<ArchiveHostAdapterResult<any>>();
    const restoreFolder = vi.fn(() => deferredFolder.promise);
    const restoreItem = vi.fn(() => deferredItem.promise);
    const bridge = createFakeBridge({
      serviceOverrides: { listRecoverableContent: async () => okResult(listing), restoreFolder, restoreItem },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleRestoreFolder(sharedId, "Shared Folder");
    instance.handleRestoreItem(sharedId, "Shared Item");
    await flushMicrotasks();

    // Item FAILS first (out of click order relative to the folder), folder
    // SUCCEEDS second.
    deferredItem.resolve(errResult("validation", "raw"));
    await flushMicrotasks();
    deferredFolder.resolve(okResult({} as any));
    await flushMicrotasks();

    const listingAfter = readyListing(instance);
    expect(listingAfter.folders).toEqual([]); // folder succeeded, removed
    expect(listingAfter.items.map((entry) => entry.id)).toEqual([sharedId]); // item failed, kept
    expect(instance.state.pendingKeys.size).toBe(0);
    expect(restoreFolder).toHaveBeenCalledWith(fixtureContext, sharedId);
    expect(restoreItem).toHaveBeenCalledWith(fixtureContext, sharedId);
  });
});
