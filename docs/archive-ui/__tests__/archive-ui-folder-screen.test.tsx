import type { ChangeEvent, Component, FormEvent, ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-05 (the Archive folder/content screen). Every
// bridge/supporting type below comes from the public "./ui" entry point (the
// same public surface a real host consumes), mirroring the TASK-02/TASK-03/
// TASK-04 test discipline. No jsdom/Testing Library/react-dom is used
// anywhere in this file — see `folder-screen.tsx`'s file-top HOOK-CALL
// CONSTRAINT comment for why `ArchiveFolderScreen` is a class component, and
// `attachSyncUpdater` below for how this file exercises its real
// `setState`/lifecycle/render methods without a DOM renderer. Per the card's
// "duplicate the small harness locally" allowance, this file duplicates the
// small `attachSyncUpdater`/fake-bridge/tree-inspection harness from
// `archive-ui-root-screen.test.tsx` locally rather than extracting a shared
// module — the harness is small, and duplicating it keeps TASK-04's test
// file completely untouched (zero semantic or mechanical change to it).
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchiveFolderScreen } from "../index.js";
// The pure controller functions are internal to `folder-screen.tsx` (never
// re-exported through the public "./ui" surface, per the card's "smallest
// necessary export" requirement) — this file imports them directly via the
// same in-tree relative path the production module itself lives at.
import {
  archiveUiApplyCreatedChildFolder,
  archiveUiApplyCreatedItem,
  archiveUiApplyUpdatedFolder,
  archiveUiFolderDateToInputValue,
  archiveUiFolderDeleteConfirmationLabels,
  archiveUiFolderScreenBreadcrumb,
  archiveUiFolderScreenContentState,
  archiveUiLoadFolderScreenData,
  archiveUiSubmitCreateChildFolder,
  archiveUiSubmitCreateItem,
  archiveUiSubmitFolderDates,
  archiveUiSubmitFolderStatus,
  archiveUiSubmitSoftDeleteFolder,
  archiveUiValidateChildFolderName,
  archiveUiValidateFolderDatesInput,
  archiveUiValidateItemName,
  type ArchiveFolderScreenCapabilities,
  type ArchiveFolderScreenData,
  type ArchiveUiFolderDateFieldValue,
} from "../folder-screen.js";
import {
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveContextInput,
  type ArchiveEffectiveCapabilityMap,
  type ArchiveFolder,
  type ArchiveFolderPathEntry,
  type ArchiveHostAdapterError,
  type ArchiveHostAdapterResult,
  type ArchiveItem,
  type ArchivePermissionAction,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const now = new Date("2026-01-01T00:00:00.000Z");

// REPAIR-R1 (CORRECTION-P6-TASK-05-REPAIR-R1): pin the ambient timezone to
// UTC for this whole file so every pre-existing test written against
// UTC-shaped fixtures/expectations stays deterministic regardless of the
// host OS's actual local timezone (this repository's test host is NOT UTC —
// see the dedicated "non-UTC round-trip proof" describe block far below,
// which intentionally overrides this default to a different, non-UTC zone
// for its own scope only, then restores it). Restored to whatever the
// process actually had beforehand once this file's tests finish.
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

function fixtureFolder(overrides: Partial<ArchiveFolder> = {}): ArchiveFolder {
  return {
    id: "folder-current",
    companyId: "company-1",
    tenantId: "tenant-1",
    parentFolderId: null,
    name: "Fixture folder",
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
    folderId: "folder-current",
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

// REPAIR-R1: a due/expiry field with no prior loaded value (`loadedValue:
// ""`, `loadedIso: null`) — every nonblank `value` therefore always
// exercises the CHANGED/parse path (`archiveUiParseFolderDateTimeLocal`
// inside `archiveUiConvertFolderDateField`), which is what these
// pre-existing pure-function tests intend to exercise.
function changedDateField(value: string): ArchiveUiFolderDateFieldValue {
  return { value, loadedValue: "", loadedIso: null };
}

// REPAIR-R1: a due/expiry field whose CURRENT visible value is identical to
// what it was loaded/last-saved with, carrying the original exact ISO
// instant — exercises the UNCHANGED/preservation path.
function unchangedDateField(loadedValue: string, loadedIso: string | null): ArchiveUiFolderDateFieldValue {
  return { value: loadedValue, loadedValue, loadedIso };
}

function denyAllCapabilities(): ArchiveEffectiveCapabilityMap {
  return Object.fromEntries(
    ARCHIVE_PERMISSION_ACTIONS.map((action) => [
      action,
      { allowed: false, source: "none" as const },
    ]),
  ) as ArchiveEffectiveCapabilityMap;
}

function allowCapabilities(
  actions: readonly ArchivePermissionAction[],
): ArchiveEffectiveCapabilityMap {
  const map = { ...denyAllCapabilities() };
  for (const action of actions) {
    map[action] = { allowed: true, source: "direct_user" as const };
  }
  return map;
}

// A properly-typed (not `as any`) `ArchiveFolderScreenCapabilities`
// fixture for pure-function tests that need a well-formed
// `ArchiveFolderScreenData` but do not exercise capability semantics
// themselves (the capability descriptor shape is the same
// `ArchiveUiCapabilityActionDescriptor` `describeArchiveUiCapabilityAction`
// itself produces, duplicated here only as a literal fixture value).
const ARCHIVE_FOLDER_SCREEN_TEST_DENIED_DESCRIPTOR = {
  presentation: "disabled" as const,
  hidden: false,
  disabled: true,
  allowed: false,
};
const ARCHIVE_FOLDER_SCREEN_TEST_ALLOWED_DESCRIPTOR = {
  presentation: "enabled" as const,
  hidden: false,
  disabled: false,
  allowed: true,
};

function fixtureFolderScreenCapabilities(
  allowedActions: readonly ("create" | "manage_status" | "manage_metadata" | "delete")[] = [],
): ArchiveFolderScreenCapabilities {
  const pick = (action: "create" | "manage_status" | "manage_metadata" | "delete") =>
    allowedActions.includes(action)
      ? ARCHIVE_FOLDER_SCREEN_TEST_ALLOWED_DESCRIPTOR
      : ARCHIVE_FOLDER_SCREEN_TEST_DENIED_DESCRIPTOR;
  return {
    create: pick("create"),
    manage_status: pick("manage_status"),
    manage_metadata: pick("manage_metadata"),
    delete: pick("delete"),
  };
}

const safeTranslateError: ArchiveUiErrorTranslator = (
  error: ArchiveHostAdapterError,
) => {
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

// A complete, honestly-typed stub of the full 34-method `ArchiveUiServicePort`
// (every method the real bridge type requires), so `overrides` below can
// supply only the handful of methods `ArchiveFolderScreen` actually calls
// while every other method fails loudly and visibly if the screen ever
// reaches it unexpectedly — never a silently-passing default (same
// discipline as `archive-ui-root-screen.test.tsx`).
function createStubServicePort(
  overrides: Partial<ArchiveUiServicePort>,
): ArchiveUiServicePort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-folder-screen fixture: method not implemented");
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

const stubTransport: ArchiveUiFileTransport = {
  uploadFile: async () => {
    throw new Error("archive-ui-folder-screen fixture: transport not used by the folder screen");
  },
  downloadFile: async () => {
    throw new Error("archive-ui-folder-screen fixture: transport not used by the folder screen");
  },
} as unknown as ArchiveUiFileTransport;

// Correction Phase 6 TASK-08A: the folder screen does not use the identity
// port (no screen production file changes in this task) — a throwing stub
// satisfies `ArchiveUiBridge`'s now-required `identity` property.
const stubIdentity: ArchiveUiIdentityPort = {
  resolvePlatformUsers: async () => {
    throw new Error("archive-ui-folder-screen fixture: identity not used by the folder screen");
  },
  listAssignableCompanyMembers: async () => {
    throw new Error("archive-ui-folder-screen fixture: identity not used by the folder screen");
  },
};

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
    transport: stubTransport,
    translateError: options.translateError ?? safeTranslateError,
    identity: stubIdentity,
  };
}

// A "ready" load's five reads all succeed with the supplied (or default)
// fixtures — the shared shape most component-level tests below start from.
function readyServiceOverrides(
  opts: {
    folder?: ArchiveFolder;
    path?: ArchiveFolderPathEntry[];
    childFolders?: ArchiveFolder[];
    items?: ArchiveItem[];
    capabilities?: ArchiveEffectiveCapabilityMap;
  } = {},
): Partial<ArchiveUiServicePort> {
  const folder = opts.folder ?? fixtureFolder();
  return {
    readFolder: async () => okResult(folder),
    getFolderPath: async () =>
      okResult(opts.path ?? [{ hidden: false, folderId: folder.id, name: folder.name }]),
    listChildFolders: async () => okResult(opts.childFolders ?? []),
    listItemsInFolder: async () => okResult(opts.items ?? []),
    getEffectiveCapabilities: async () => okResult(opts.capabilities ?? denyAllCapabilities()),
  };
}

function elementProps(element: unknown): Record<string, any> {
  if (element === null || element === undefined) {
    throw new Error("expected a non-null element");
  }
  return (element as { props: unknown }).props as Record<string, any>;
}

// `ArchiveFolderScreen.render()` returns a tree containing UNEVALUATED
// elements for the TASK-03 shared sub-components it composes and nested
// `<>...</>` fragments this screen itself returns — `element.type` for a
// function component is the actual function, not yet invoked. This
// recursively expands any function-typed element by calling it directly
// (the same "invoke as a plain function" discipline every other TASK-03/
// TASK-04 test file already uses) so this file can inspect the REAL
// fully-resolved output tree `ArchiveFolderScreen` produces.
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

// Depth-first search over an ALREADY fully-expanded (`expandElementTree`)
// element tree for every element whose props satisfy `predicate` — used
// throughout below instead of assuming any fixed children-array position,
// since this screen nests several fragments/sub-presentations.
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

// Depth-first collection of every rendered text-node string (ignores
// prop/attribute values, e.g. `data-*` ids, which are NOT "rendered copy") —
// used to prove raw ids/backend messages never surface as visible text.
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

// See `folder-screen.tsx`'s (and `root-screen.tsx`'s) file-top HOOK-CALL
// CONSTRAINT note: outside a real renderer, `Component.prototype.updater`
// defaults to a no-op stub that WARNS and silently discards every
// `setState` call. Assigning a minimal SYNCHRONOUS updater here implements
// exactly the same `Updater` contract `react-dom` itself supplies when
// actually mounting — nothing more, no new dependency, no parallel
// rendering system.
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
          ? (partialState as (prevState: S, props: P) => Partial<S>)(
              instance.state,
              instance.props,
            )
          : partialState;
      instance.state = { ...instance.state, ...partial };
    },
  };
}

function fakeChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>;
}

function fakeSelectChangeEvent(value: string): ChangeEvent<HTMLSelectElement> {
  return { target: { value } } as unknown as ChangeEvent<HTMLSelectElement>;
}

function fakeSubmitEvent(): FormEvent<HTMLFormElement> {
  return { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
}

async function loadedInstance(bridge: ArchiveUiBridge, folderId = "folder-current") {
  const instance = new ArchiveFolderScreen({ bridge, folderId });
  attachSyncUpdater(instance);
  await instance.loadFolderScreen();
  return instance;
}

// ---------------------------------------------------------------------------
// 1. Pure controller logic — `archiveUiLoadFolderScreenData`.
// ---------------------------------------------------------------------------

describe("archiveUiLoadFolderScreenData", () => {
  it("ready: all five reads succeed — exact calls/targets, non-empty content", async () => {
    const folder = fixtureFolder();
    const childFolder = fixtureFolder({ id: "folder-child", name: "Child" });
    const item = fixtureItem();
    const path: ArchiveFolderPathEntry[] = [{ hidden: false, folderId: folder.id, name: folder.name }];
    const calls: Record<string, unknown[]> = {
      readFolder: [],
      getFolderPath: [],
      listChildFolders: [],
      listItemsInFolder: [],
      getEffectiveCapabilities: [],
    };
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async (context, folderId) => {
          calls.readFolder.push({ context, folderId });
          return okResult(folder);
        },
        getFolderPath: async (context, folderId) => {
          calls.getFolderPath.push({ context, folderId });
          return okResult(path);
        },
        listChildFolders: async (context, folderId) => {
          calls.listChildFolders.push({ context, folderId });
          return okResult([childFolder]);
        },
        listItemsInFolder: async (context, folderId) => {
          calls.listItemsInFolder.push({ context, folderId });
          return okResult([item]);
        },
        getEffectiveCapabilities: async (context, target) => {
          calls.getEffectiveCapabilities.push({ context, target });
          return okResult(allowCapabilities(["create"]));
        },
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, folder.id);

    expect(result.viewState.status).toBe("ready");
    if (result.viewState.status === "ready") {
      expect(result.viewState.data.folder).toEqual(folder);
      expect(result.viewState.data.path).toEqual(path);
      expect(result.viewState.data.childFolders).toEqual([childFolder]);
      expect(result.viewState.data.items).toEqual([item]);
      expect(result.viewState.data.capabilities.create).toEqual({
        presentation: "enabled",
        hidden: false,
        disabled: false,
        allowed: true,
      });
      expect(result.viewState.data.capabilities.manage_status.allowed).toBe(false);
    }
    // Exact real methods and the exact FOLDER target — no invented second
    // target/projection.
    expect(calls.readFolder).toEqual([{ context: fixtureContext, folderId: folder.id }]);
    expect(calls.getFolderPath).toEqual([{ context: fixtureContext, folderId: folder.id }]);
    expect(calls.listChildFolders).toEqual([{ context: fixtureContext, folderId: folder.id }]);
    expect(calls.listItemsInFolder).toEqual([{ context: fixtureContext, folderId: folder.id }]);
    expect(calls.getEffectiveCapabilities).toEqual([
      { context: fixtureContext, target: { targetType: "folder", targetId: folder.id } },
    ]);
  });

  it("empty content (both collections empty) is still represented as a `ready` load — header/path/capabilities are not discarded", async () => {
    const folder = fixtureFolder();
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ folder, childFolders: [], items: [] }),
    });

    const result = await archiveUiLoadFolderScreenData(bridge, folder.id);

    expect(result.viewState.status).toBe("ready");
    if (result.viewState.status === "ready") {
      expect(result.viewState.data.folder).toEqual(folder);
      expect(result.viewState.data.childFolders).toEqual([]);
      expect(result.viewState.data.items).toEqual([]);
    }
  });

  it("denied: an unauthorized readFolder result becomes the calm denied state, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("unauthorized", "raw backend reason RAW-1"),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-1");
    }
  });

  it("error: a non-unauthorized readFolder failure routes through bridge.translateError, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("server_error", "raw backend reason RAW-2"),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("error");
    if (result.viewState.status === "error") {
      expect(result.viewState.presentation.title).toBe("Something went wrong");
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-2");
    }
  });

  // Unauthorized-precedence combinations (card scope item 4/18): the
  // `denied` state must win regardless of which required read is
  // unauthorized, INCLUDING a LATER read (in the documented order
  // readFolder, getFolderPath, listChildFolders, listItemsInFolder,
  // getEffectiveCapabilities) being unauthorized while an EARLIER read
  // failed non-unauthorized.

  it("mixed 1: readFolder=server_error (earlier) + getEffectiveCapabilities=unauthorized (LATER) => denied — later-read unauthorized beats an earlier non-unauthorized failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("server_error", "RAW-FOLDER-SERVER"),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => errResult("unauthorized", "RAW-CAPS-UNAUTH"),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-FOLDER-SERVER");
      expect(serialized).not.toContain("RAW-CAPS-UNAUTH");
    }
  });

  it("mixed 2: getFolderPath=not_found (earlier) + listItemsInFolder=unauthorized (LATER) => denied — later-read unauthorized beats an earlier non-unauthorized failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => okResult(fixtureFolder()),
        getFolderPath: async () => errResult("not_found", "RAW-PATH-NOTFOUND"),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => errResult("unauthorized", "RAW-ITEMS-UNAUTH"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-PATH-NOTFOUND");
      expect(serialized).not.toContain("RAW-ITEMS-UNAUTH");
    }
  });

  it("mixed 3: listChildFolders=unauthorized (earlier) + listItemsInFolder=validation (later) => denied — an earlier unauthorized still beats a later non-unauthorized failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => okResult(fixtureFolder()),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => errResult("unauthorized", "RAW-CHILD-UNAUTH"),
        listItemsInFolder: async () => errResult("validation", "RAW-ITEMS-VALIDATION"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("denied");
  });

  it("neither-unauthorized both-fail case: readFolder=validation + getFolderPath=server_error => error, deterministically selected from readFolder (documented first-in-order fallback)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("validation", "RAW-FOLDER-VALIDATION"),
        getFolderPath: async () => errResult("server_error", "RAW-PATH-SERVER"),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadFolderScreenData(bridge, "folder-current");

    expect(result.viewState.status).toBe("error");
    if (result.viewState.status === "error") {
      expect(result.viewState.presentation.title).toBe("Check your input");
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-FOLDER-VALIDATION");
      expect(serialized).not.toContain("RAW-PATH-SERVER");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Pure controller logic — content-level empty/ready derivation.
// ---------------------------------------------------------------------------

describe("archiveUiFolderScreenContentState", () => {
  it("both collections empty => the TASK-03 empty constructor", () => {
    const data: ArchiveFolderScreenData = {
      folder: fixtureFolder(),
      path: [],
      capabilities: fixtureFolderScreenCapabilities(["create"]),
      childFolders: [],
      items: [],
    };
    expect(archiveUiFolderScreenContentState(data)).toEqual({ status: "empty" });
  });

  it("either collection non-empty => ready with both collections", () => {
    const childFolder = fixtureFolder({ id: "folder-child" });
    const data: ArchiveFolderScreenData = {
      folder: fixtureFolder(),
      path: [],
      capabilities: fixtureFolderScreenCapabilities(["create"]),
      childFolders: [childFolder],
      items: [],
    };
    expect(archiveUiFolderScreenContentState(data)).toEqual({
      status: "ready",
      data: { childFolders: [childFolder], items: [] },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Pure controller logic — breadcrumb presentation.
// ---------------------------------------------------------------------------

describe("archiveUiFolderScreenBreadcrumb", () => {
  it("root-first multi-level path: hidden ancestor, visible ancestor with null name, current entry — no fabricated id/name", () => {
    const path: ArchiveFolderPathEntry[] = [
      { hidden: true },
      { hidden: false, folderId: "folder-mid", name: null },
      { hidden: false, folderId: "folder-current", name: "Current Folder" },
    ];

    const entries = archiveUiFolderScreenBreadcrumb(path);

    expect(entries).toEqual([
      { kind: "hidden" },
      { kind: "ancestor", folderId: "folder-mid", label: "Unnamed folder" },
      { kind: "current", folderId: "folder-current", label: "Current Folder" },
    ]);
  });

  it("a single-entry path (root folder with no ancestors) marks that one entry as current", () => {
    const path: ArchiveFolderPathEntry[] = [
      { hidden: false, folderId: "folder-root", name: "Root Folder" },
    ];
    expect(archiveUiFolderScreenBreadcrumb(path)).toEqual([
      { kind: "current", folderId: "folder-root", label: "Root Folder" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 4. Pure controller logic — validation + create submission (child folder).
// ---------------------------------------------------------------------------

describe("archiveUiValidateChildFolderName / archiveUiSubmitCreateChildFolder", () => {
  it("a trimmed-empty name yields a field-level error", () => {
    expect(archiveUiValidateChildFolderName("   ")).toEqual({
      name: ["Enter a folder name."],
    });
  });

  it("trimmed-empty name: submit returns a validation outcome and NEVER calls createFolder", async () => {
    const createFolderSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { createFolder: createFolderSpy } });

    const outcome = await archiveUiSubmitCreateChildFolder(bridge, fixtureContext, "folder-current", {
      name: "  ",
      description: "",
    });

    expect(outcome).toEqual({ kind: "validation", fieldErrors: { name: ["Enter a folder name."] } });
    expect(createFolderSpy).not.toHaveBeenCalled();
  });

  it("valid submit calls createFolder with parentFolderId set to the CURRENT folder id, trimmed name, null description when blank", async () => {
    const createFolderSpy = vi.fn(async () =>
      okResult(fixtureFolder({ id: "folder-child", name: "Q3 Reports" })),
    );
    const bridge = createFakeBridge({ serviceOverrides: { createFolder: createFolderSpy } });

    const outcome = await archiveUiSubmitCreateChildFolder(bridge, fixtureContext, "folder-current", {
      name: "  Q3 Reports  ",
      description: "   ",
    });

    expect(createFolderSpy).toHaveBeenCalledWith(fixtureContext, {
      name: "Q3 Reports",
      description: null,
      parentFolderId: "folder-current",
    });
    expect(outcome.kind).toBe("success");
  });

  it("a failed createFolder call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        createFolder: async () => errResult("validation", "RAW-CREATE-FOLDER"),
      },
    });

    const outcome = await archiveUiSubmitCreateChildFolder(bridge, fixtureContext, "folder-current", {
      name: "Q3 Reports",
      description: "",
    });

    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-CREATE-FOLDER");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Pure controller logic — validation + create submission (item).
// ---------------------------------------------------------------------------

describe("archiveUiValidateItemName / archiveUiSubmitCreateItem", () => {
  it("a trimmed-empty name yields a field-level error", () => {
    expect(archiveUiValidateItemName("")).toEqual({ name: ["Enter an item name."] });
  });

  it("trimmed-empty name: submit returns a validation outcome and NEVER calls createItem", async () => {
    const createItemSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { createItem: createItemSpy } });

    const outcome = await archiveUiSubmitCreateItem(bridge, fixtureContext, "folder-current", {
      name: "",
      description: "",
    });

    expect(outcome.kind).toBe("validation");
    expect(createItemSpy).not.toHaveBeenCalled();
  });

  it("valid submit calls createItem with folderId, trimmed name, null description, and itemType explicitly 'record'", async () => {
    const createItemSpy = vi.fn(async () => okResult(fixtureItem({ id: "item-new" })));
    const bridge = createFakeBridge({ serviceOverrides: { createItem: createItemSpy } });

    const outcome = await archiveUiSubmitCreateItem(bridge, fixtureContext, "folder-current", {
      name: "  Invoice  ",
      description: "  Q3 invoice  ",
    });

    expect(createItemSpy).toHaveBeenCalledWith(fixtureContext, {
      folderId: "folder-current",
      name: "Invoice",
      description: "Q3 invoice",
      itemType: "record",
    });
    expect(outcome.kind).toBe("success");
  });

  it("a failed createItem call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { createItem: async () => errResult("server_error", "RAW-CREATE-ITEM") },
    });

    const outcome = await archiveUiSubmitCreateItem(bridge, fixtureContext, "folder-current", {
      name: "Invoice",
      description: "",
    });

    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-CREATE-ITEM");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Pure controller logic — deterministic visible-list/projection updates.
// ---------------------------------------------------------------------------

describe("archiveUiApplyCreatedChildFolder / archiveUiApplyCreatedItem / archiveUiApplyUpdatedFolder", () => {
  const baseData: ArchiveFolderScreenData = {
    folder: fixtureFolder(),
    path: [{ hidden: false, folderId: "folder-current", name: "Fixture folder" }],
    capabilities: fixtureFolderScreenCapabilities(["create"]),
    childFolders: [],
    items: [],
  };

  it("appends a created child folder onto the existing list", () => {
    const created = fixtureFolder({ id: "folder-child", name: "Child" });
    const next = archiveUiApplyCreatedChildFolder(baseData, created);
    expect(next.childFolders).toEqual([created]);
    expect(next.items).toEqual(baseData.items);
    expect(next.folder).toEqual(baseData.folder);
  });

  it("appends a created item onto the existing list", () => {
    const created = fixtureItem({ id: "item-new" });
    const next = archiveUiApplyCreatedItem(baseData, created);
    expect(next.items).toEqual([created]);
    expect(next.childFolders).toEqual(baseData.childFolders);
  });

  it("replaces the folder projection with the returned updated folder", () => {
    const updated = fixtureFolder({ status: "archived" });
    const next = archiveUiApplyUpdatedFolder(baseData, updated);
    expect(next.folder).toEqual(updated);
    expect(next.path).toEqual(baseData.path);
  });
});

// ---------------------------------------------------------------------------
// 7. Pure controller logic — status editing.
// ---------------------------------------------------------------------------

describe("archiveUiSubmitFolderStatus", () => {
  it("calls setFolderStatus with the exact closed status input shape", async () => {
    const setFolderStatusSpy = vi.fn(async () => okResult(fixtureFolder({ status: "archived" })));
    const bridge = createFakeBridge({ serviceOverrides: { setFolderStatus: setFolderStatusSpy } });

    const outcome = await archiveUiSubmitFolderStatus(bridge, fixtureContext, "folder-current", "archived");

    expect(setFolderStatusSpy).toHaveBeenCalledWith(fixtureContext, "folder-current", {
      status: "archived",
    });
    expect(outcome).toEqual({ kind: "success", folder: fixtureFolder({ status: "archived" }) });
  });

  it("a failed call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { setFolderStatus: async () => errResult("validation", "RAW-STATUS") },
    });
    const outcome = await archiveUiSubmitFolderStatus(bridge, fixtureContext, "folder-current", "draft");
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-STATUS");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Pure controller logic — due/expiry editing (validation + submission).
// ---------------------------------------------------------------------------

describe("archiveUiValidateFolderDatesInput / archiveUiSubmitFolderDates", () => {
  it("blank values map to null on both fields", () => {
    const result = archiveUiValidateFolderDatesInput({
      dueAt: changedDateField("  "),
      expiresAt: changedDateField(""),
    });
    expect(result).toEqual({ kind: "valid", dueAt: null, expiresAt: null });
  });

  it("a valid, changed nonblank value converts to a strict RFC 3339 string", () => {
    const result = archiveUiValidateFolderDatesInput({
      dueAt: changedDateField("2026-03-01T10:00"),
      expiresAt: changedDateField(""),
    });
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.dueAt).not.toBeNull();
      expect(result.dueAt!).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.expiresAt).toBeNull();
    }
  });

  it("an invalid nonblank value produces a field-specific error on that field only", () => {
    const result = archiveUiValidateFolderDatesInput({
      dueAt: changedDateField("not-a-date"),
      expiresAt: changedDateField("2026-03-01T10:00"),
    });
    expect(result).toEqual({
      kind: "invalid",
      fieldErrors: { dueAt: ["Enter a valid due date and time."] },
    });
  });

  // REPAIR-R1: proof point (c) — a calendar-IMPOSSIBLE value (native `Date`
  // silently normalizes `2026-02-30` forward into `2026-03-02`) must be
  // rejected, not silently accepted the way `Number.isNaN(new
  // Date(...).getTime())` alone would accept it.
  it("REPAIR-R1: a calendar-impossible value (2026-02-30) is rejected, not silently normalized", () => {
    const result = archiveUiValidateFolderDatesInput({
      dueAt: changedDateField("2026-02-30T10:00"),
      expiresAt: changedDateField(""),
    });
    expect(result).toEqual({
      kind: "invalid",
      fieldErrors: { dueAt: ["Enter a valid due date and time."] },
    });
  });

  it("invalid date input never calls setFolderDates", async () => {
    const setFolderDatesSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { setFolderDates: setFolderDatesSpy } });

    const outcome = await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: changedDateField("not-a-date"),
      expiresAt: changedDateField(""),
    });

    expect(outcome.kind).toBe("validation");
    expect(setFolderDatesSpy).not.toHaveBeenCalled();
  });

  // REPAIR-R1: proof point (c) at the submit level — no `setFolderDates`
  // call for a calendar-impossible value either.
  it("REPAIR-R1: a calendar-impossible value never calls setFolderDates", async () => {
    const setFolderDatesSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { setFolderDates: setFolderDatesSpy } });

    const outcome = await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: changedDateField("2026-02-30T10:00"),
      expiresAt: changedDateField(""),
    });

    expect(outcome.kind).toBe("validation");
    expect(setFolderDatesSpy).not.toHaveBeenCalled();
  });

  it("valid, changed input reaches setFolderDates only as RFC 3339 strings/null, never the raw control value", async () => {
    const setFolderDatesSpy = vi.fn(
      async (
        _context: ArchiveContextInput,
        _folderId: string,
        _input: { dueAt?: string | null; expiresAt?: string | null },
      ) => okResult(fixtureFolder()),
    );
    const bridge = createFakeBridge({ serviceOverrides: { setFolderDates: setFolderDatesSpy } });

    await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: changedDateField("2026-03-01T10:00"),
      expiresAt: changedDateField("  "),
    });

    expect(setFolderDatesSpy).toHaveBeenCalledTimes(1);
    const [, , input] = setFolderDatesSpy.mock.calls[0]!;
    expect(input.expiresAt).toBeNull();
    expect(typeof input.dueAt).toBe("string");
    expect(input.dueAt).not.toBe("2026-03-01T10:00");
    expect(input.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  // REPAIR-R1: proof point (b) — an unmodified field (visible value equals
  // the loaded value) must reach `setFolderDates` with the ORIGINAL exact
  // ISO instant, including seconds a minute-precision display truncates —
  // not a re-derived, rounded value.
  it("REPAIR-R1: an unmodified field preserves the original exact instant (incl. seconds) on submit", async () => {
    const originalIso = "2026-03-01T10:00:45.123Z";
    const loadedValue = archiveUiFolderDateToInputValue(new Date(originalIso));
    const setFolderDatesSpy = vi.fn(
      async (
        _context: ArchiveContextInput,
        _folderId: string,
        _input: { dueAt?: string | null; expiresAt?: string | null },
      ) => okResult(fixtureFolder()),
    );
    const bridge = createFakeBridge({ serviceOverrides: { setFolderDates: setFolderDatesSpy } });

    await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: unchangedDateField(loadedValue, originalIso),
      expiresAt: changedDateField(""),
    });

    expect(setFolderDatesSpy).toHaveBeenCalledTimes(1);
    const [, , input] = setFolderDatesSpy.mock.calls[0]!;
    expect(input.dueAt).toBe(originalIso);
  });

  it("a failed call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { setFolderDates: async () => errResult("server_error", "RAW-DATES") },
    });
    const outcome = await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: changedDateField(""),
      expiresAt: changedDateField(""),
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-DATES");
    }
  });
});

describe("archiveUiFolderDateToInputValue", () => {
  it("null maps to an empty string", () => {
    expect(archiveUiFolderDateToInputValue(null)).toBe("");
  });

  it("a Date maps to a datetime-local-shaped string using LOCAL wall-clock components (this describe block runs under the file-level UTC TZ pin above)", () => {
    expect(archiveUiFolderDateToInputValue(new Date("2026-03-01T10:15:30.000Z"))).toBe(
      "2026-03-01T10:15",
    );
  });
});

// ---------------------------------------------------------------------------
// REPAIR-R1 (CORRECTION-P6-TASK-05-REPAIR-R1): non-UTC round-trip proof.
//
// Route A per the repair card: `process.env.TZ` is reassigned to a fixed,
// deliberately non-UTC zone for the duration of this describe block only
// (restored afterward), guarded by an assertion that the reassignment
// actually took effect on this runtime/platform — if it silently did not,
// these tests fail loudly instead of vacuously passing.
// ---------------------------------------------------------------------------

describe("date field conversion — non-UTC round-trip proof (REPAIR-R1)", () => {
  const NON_UTC_TZ = "America/Chicago";
  let previousTz: string | undefined;

  beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = NON_UTC_TZ;
    // Guard (mandatory per the repair card): fail loudly, not vacuously, if
    // this platform/runtime did not actually honor the TZ reassignment.
    expect(new Date("2026-01-15T12:00").getTimezoneOffset()).not.toBe(0);
  });

  afterAll(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  // Proof point (a): this exact scenario would FAIL under the pre-repair
  // implementation (UTC-format display + native-`Date`-local-parse submit).
  it("REPAIR-R1: reproduces the pre-repair defect inline, proving this scenario would have shifted the instant", () => {
    const originalInstant = new Date("2026-01-15T18:30:00.000Z");

    // The OLD formatter: `date.toISOString().slice(0, 16)` (UTC components).
    const oldFormatted = originalInstant.toISOString().slice(0, 16);
    // The OLD submit-time parser: `new Date(trimmed)` (LOCAL interpretation
    // of the — here, UTC-labeled-but-unlabeled — string).
    const oldRoundTripped = new Date(oldFormatted).toISOString();

    // Under America/Chicago (UTC-6 in January, no DST), this round trip
    // silently shifts the instant by six hours — the exact defect this
    // repair fixes.
    expect(oldRoundTripped).not.toBe(originalInstant.toISOString());
  });

  it("REPAIR-R1: archiveUiFolderDateToInputValue formats using LOCAL wall-clock components, not UTC", () => {
    const originalInstant = new Date("2026-01-15T18:30:00.000Z");
    // 18:30 UTC on 2026-01-15 is 12:30 local time in America/Chicago (CST,
    // UTC-6) in January — verified directly against this runtime's own
    // local getters, not a hard-coded assumption.
    const expected =
      `${originalInstant.getFullYear()}-` +
      `${String(originalInstant.getMonth() + 1).padStart(2, "0")}-` +
      `${String(originalInstant.getDate()).padStart(2, "0")}T` +
      `${String(originalInstant.getHours()).padStart(2, "0")}:` +
      `${String(originalInstant.getMinutes()).padStart(2, "0")}`;
    expect(expected).toBe("2026-01-15T12:30");
    expect(archiveUiFolderDateToInputValue(originalInstant)).toBe(expected);
    // Distinctly NOT the old UTC-formatted value.
    expect(archiveUiFolderDateToInputValue(originalInstant)).not.toBe(
      originalInstant.toISOString().slice(0, 16),
    );
  });

  it("REPAIR-R1: a CHANGED value round-trips through local format+parse back to the exact original instant", () => {
    const originalInstant = new Date("2026-01-15T18:30:00.000Z");
    const formatted = archiveUiFolderDateToInputValue(originalInstant);

    // Simulate a genuinely edited field: `loadedValue` deliberately differs
    // from `formatted`, forcing the CHANGED/parse path.
    const result = archiveUiValidateFolderDatesInput({
      dueAt: { value: formatted, loadedValue: "DIFFERENT", loadedIso: null },
      expiresAt: changedDateField(""),
    });

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.dueAt).toBe(originalInstant.toISOString());
    }
  });

  // Proof point (b) under a non-UTC TZ specifically: unmodified submission
  // preserves the original exact instant regardless of the browser's
  // timezone, and regardless of the seconds a minute-precision display
  // value cannot represent.
  it("REPAIR-R1: an UNMODIFIED value preserves the original exact instant under a non-UTC TZ", () => {
    const originalIso = "2026-01-15T18:30:45.123Z";
    const loadedValue = archiveUiFolderDateToInputValue(new Date(originalIso));

    const result = archiveUiValidateFolderDatesInput({
      dueAt: unchangedDateField(loadedValue, originalIso),
      expiresAt: changedDateField(""),
    });

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.dueAt).toBe(originalIso);
    }
  });

  // Proof point (c) under a non-UTC TZ: a calendar-impossible value is
  // still rejected (the round-trip local-component check is TZ-independent
  // by construction), and never reaches `setFolderDates`.
  it("REPAIR-R1: a calendar-impossible value is rejected under a non-UTC TZ, with no setFolderDates call", async () => {
    const setFolderDatesSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { setFolderDates: setFolderDatesSpy } });

    const outcome = await archiveUiSubmitFolderDates(bridge, fixtureContext, "folder-current", {
      dueAt: changedDateField("2026-04-31T10:00"), // April has 30 days.
      expiresAt: changedDateField(""),
    });

    expect(outcome.kind).toBe("validation");
    expect(setFolderDatesSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9. Pure controller logic — soft deletion + confirmation labels.
// ---------------------------------------------------------------------------

describe("archiveUiFolderDeleteConfirmationLabels / archiveUiSubmitSoftDeleteFolder", () => {
  it("names the exact action and a human-readable folder subject", () => {
    const labels = archiveUiFolderDeleteConfirmationLabels(fixtureFolder({ name: "Q3 Reports" }));
    expect(labels).toEqual({ actionLabel: "Delete folder", subjectLabel: 'folder "Q3 Reports"' });
  });

  it("calls softDeleteFolder with only the folder id", async () => {
    const softDeleteFolderSpy = vi.fn(async () => okResult(fixtureFolder({ isDeleted: true })));
    const bridge = createFakeBridge({ serviceOverrides: { softDeleteFolder: softDeleteFolderSpy } });

    const outcome = await archiveUiSubmitSoftDeleteFolder(bridge, fixtureContext, "folder-current");

    expect(softDeleteFolderSpy).toHaveBeenCalledWith(fixtureContext, "folder-current");
    expect(outcome.kind).toBe("success");
  });

  it("a failed call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { softDeleteFolder: async () => errResult("unauthorized", "RAW-DELETE") },
    });
    const outcome = await archiveUiSubmitSoftDeleteFolder(bridge, fixtureContext, "folder-current");
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-DELETE");
    }
  });
});

// ---------------------------------------------------------------------------
// 10. The actual mountable `ArchiveFolderScreen` class component — real
//     constructor/componentDidMount/setState/render() wiring.
// ---------------------------------------------------------------------------

describe("ArchiveFolderScreen (the actual mountable screen)", () => {
  it("initial render (before load resolves) shows the loading state and a generic heading", () => {
    const bridge = createFakeBridge({ serviceOverrides: readyServiceOverrides() });
    const instance = new ArchiveFolderScreen({ bridge, folderId: "folder-current" });
    attachSyncUpdater(instance);

    const tree = expandElementTree(instance.render());
    expect(elementProps(tree)["data-archive-ui-screen"]).toBe("folder");
    const loadingMarker = findElement(
      tree,
      (el) => el.props["data-archive-ui-state"] === "loading",
    );
    expect(loadingMarker).toBeDefined();
    const heading = findElement(tree, (el) => el.type === "h1");
    expect(collectRenderedText(heading)).toEqual(["Folder"]);
  });

  it("componentDidMount wires to the real load method", () => {
    const bridge = createFakeBridge({ serviceOverrides: readyServiceOverrides() });
    const instance = new ArchiveFolderScreen({ bridge, folderId: "folder-current" });
    attachSyncUpdater(instance);
    const loadSpy = vi.spyOn(instance, "loadFolderScreen").mockResolvedValue(undefined);

    instance.componentDidMount();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    loadSpy.mockRestore();
  });

  it("after a real load: heading shows the folder name, no internal id/tenant/company/user id in rendered copy", async () => {
    const folder = fixtureFolder({
      id: "folder-secret-999",
      name: "Q3 Reports",
      description: "Quarterly filings",
    });
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        folder,
        childFolders: [fixtureFolder({ id: "folder-child-secret", name: "Child folder" })],
        items: [fixtureItem({ id: "item-secret", name: "Invoice" })],
      }),
    });
    const instance = await loadedInstance(bridge, folder.id);

    const tree = expandElementTree(instance.render());
    const renderedText = collectRenderedText(tree).join(" | ");
    expect(renderedText).toContain("Q3 Reports");
    expect(renderedText).toContain("Child folder");
    expect(renderedText).toContain("Invoice");
    expect(renderedText).not.toContain("folder-secret-999");
    expect(renderedText).not.toContain("folder-child-secret");
    expect(renderedText).not.toContain("item-secret");
    expect(renderedText).not.toContain(fixtureContext.tenantId);
    expect(renderedText).not.toContain(fixtureContext.companyId);
    expect(renderedText).not.toContain(fixtureContext.userId);
  });

  it("empty content state: header/breadcrumb/actions remain available, and the content area shows the empty marker", async () => {
    const folder = fixtureFolder();
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        folder,
        childFolders: [],
        items: [],
        capabilities: allowCapabilities(["create", "manage_status", "manage_metadata", "delete"]),
      }),
    });
    const instance = await loadedInstance(bridge, folder.id);

    const tree = expandElementTree(instance.render());
    const heading = findElement(tree, (el) => el.type === "h1");
    expect(collectRenderedText(heading)).toEqual([folder.name]);
    const breadcrumb = findElement(tree, (el) => el.props["data-archive-ui-breadcrumb"] === "folder");
    expect(breadcrumb).toBeDefined();
    const createForm = findElement(tree, (el) => el.props["aria-label"] === "Create a child folder");
    expect(createForm).toBeDefined();
    const contentEmptyMarker = findElement(
      tree,
      (el) => el.props["data-archive-ui-state"] === "empty",
    );
    expect(contentEmptyMarker).toBeDefined();
  });

  it("ready content: child folders and items render as separate labeled lists; selecting one emits only a folder/item navigation intent", async () => {
    const folder = fixtureFolder();
    const childFolder = fixtureFolder({ id: "folder-child", name: "Child folder" });
    const item = fixtureItem({ id: "item-1", name: "Invoice" });
    const navigateCalls: ArchiveUiNavigationIntent[] = [];
    const bridge = createFakeBridge({
      navigate: (intent) => navigateCalls.push(intent),
      serviceOverrides: readyServiceOverrides({
        folder,
        childFolders: [childFolder],
        items: [item],
      }),
    });
    const instance = await loadedInstance(bridge, folder.id);

    const tree = expandElementTree(instance.render());
    const childFoldersList = findElement(tree, (el) => el.props["aria-label"] === "Child folders");
    const itemsList = findElement(tree, (el) => el.props["aria-label"] === "Items");
    expect(childFoldersList).toBeDefined();
    expect(itemsList).toBeDefined();

    const childFolderButton = findElement(
      tree,
      (el) => el.props["data-archive-ui-child-folder-id"] === childFolder.id,
    );
    const itemButton = findElement(tree, (el) => el.props["data-archive-ui-item-id"] === item.id);
    expect(childFolderButton).toBeDefined();
    expect(itemButton).toBeDefined();

    elementProps(childFolderButton).onClick();
    elementProps(itemButton).onClick();

    expect(navigateCalls).toEqual([
      { screen: "folder", folderId: childFolder.id },
      { screen: "item", itemId: item.id },
    ]);
    expect(Object.keys(navigateCalls[0]!).sort()).toEqual(["folderId", "screen"]);
    expect(Object.keys(navigateCalls[1]!).sort()).toEqual(["itemId", "screen"]);
  });

  it("denied (unauthorized): calm denied state, no breadcrumb/actions, raw message never rendered", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("unauthorized", "RAW-DENIED"),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = await loadedInstance(bridge);

    const tree = expandElementTree(instance.render());
    const renderedText = collectRenderedText(tree).join(" | ");
    expect(renderedText).not.toContain("RAW-DENIED");
    expect(findElement(tree, (el) => el.props["data-archive-ui-state"] === "denied")).toBeDefined();
    expect(findElement(tree, (el) => el.props["data-archive-ui-breadcrumb"] === "folder")).toBeUndefined();
  });

  it("error (non-unauthorized): calm error state via the translator, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        readFolder: async () => errResult("server_error", "RAW-ERROR"),
        getFolderPath: async () => okResult([]),
        listChildFolders: async () => okResult([]),
        listItemsInFolder: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = await loadedInstance(bridge);

    const tree = expandElementTree(instance.render());
    const renderedText = collectRenderedText(tree).join(" | ");
    expect(renderedText).not.toContain("RAW-ERROR");
    expect(findElement(tree, (el) => el.props["data-archive-ui-state"] === "error")).toBeDefined();
  });

  // ---------------------------------------------------------------------
  // Breadcrumb rendering: root control, visible ancestor navigation,
  // current-item semantics, hidden-ancestor placeholder.
  // ---------------------------------------------------------------------

  it("breadcrumb: root control emits ONLY {screen:'root'}, an ancestor navigates via {screen:'folder',folderId}, the current entry is marked current with no self-navigation, and a hidden ancestor renders an honest non-clickable placeholder", async () => {
    const folder = fixtureFolder({ id: "folder-current", name: "Current Folder" });
    const path: ArchiveFolderPathEntry[] = [
      { hidden: false, folderId: "folder-ancestor", name: "Ancestor" },
      { hidden: true },
      { hidden: false, folderId: "folder-current", name: "Current Folder" },
    ];
    const navigateCalls: ArchiveUiNavigationIntent[] = [];
    const bridge = createFakeBridge({
      navigate: (intent) => navigateCalls.push(intent),
      serviceOverrides: readyServiceOverrides({ folder, path }),
    });
    const instance = await loadedInstance(bridge, folder.id);

    const tree = expandElementTree(instance.render());

    const rootControl = findElement(
      tree,
      (el) => el.props["data-archive-ui-breadcrumb-root"] === "true",
    );
    expect(rootControl).toBeDefined();
    elementProps(rootControl).onClick();
    expect(navigateCalls).toEqual([{ screen: "root" }]);
    expect(Object.keys(navigateCalls[0]!)).toEqual(["screen"]);

    const ancestorButton = findElement(
      tree,
      (el) => el.props["data-archive-ui-breadcrumb-ancestor"] === "folder-ancestor",
    );
    expect(ancestorButton).toBeDefined();
    expect(collectRenderedText(ancestorButton)).toEqual(["Ancestor"]);
    elementProps(ancestorButton).onClick();
    expect(navigateCalls[1]).toEqual({ screen: "folder", folderId: "folder-ancestor" });

    const hiddenEntry = findElement(
      tree,
      (el) => el.props["data-archive-ui-breadcrumb-hidden"] === "true",
    );
    expect(hiddenEntry).toBeDefined();
    expect(collectRenderedText(hiddenEntry)).toEqual(["Restricted"]);
    expect(hiddenEntry!.props.onClick).toBeUndefined();
    expect(hiddenEntry!.type).not.toBe("button");

    const currentEntry = findElement(
      tree,
      (el) => el.props["data-archive-ui-breadcrumb-current"] === "folder-current",
    );
    expect(currentEntry).toBeDefined();
    expect(currentEntry!.props["aria-current"]).toBe("page");
    expect(currentEntry!.props.onClick).toBeUndefined();
    expect(currentEntry!.type).not.toBe("button");
    expect(collectRenderedText(currentEntry)).toEqual(["Current Folder"]);

    // Selecting a breadcrumb ancestor navigates ONLY through the exact
    // folder-screen navigation intent — no URL/path field.
    expect(Object.keys(navigateCalls[1]!).sort()).toEqual(["folderId", "screen"]);
  });

  // ---------------------------------------------------------------------
  // Capability gating.
  // ---------------------------------------------------------------------

  it("each capability denial (create/manage_status/manage_metadata/delete) is never presented as enabled; allowing each makes its control usable", async () => {
    const folder = fixtureFolder();
    const deniedBridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({ folder, capabilities: denyAllCapabilities() }),
    });
    const deniedInstance = await loadedInstance(deniedBridge, folder.id);
    const deniedTree = expandElementTree(deniedInstance.render());

    const createButton = findElement(
      deniedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Create folder",
    );
    const statusButton = findElement(
      deniedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Save status",
    );
    const datesButton = findElement(
      deniedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Save dates",
    );
    const deleteButton = findElement(
      deniedTree,
      (el) => el.type === "button" && el.props.children === "Delete folder",
    );
    for (const button of [createButton, statusButton, datesButton, deleteButton]) {
      expect(button).toBeDefined();
      expect(elementProps(button).disabled).toBe(true);
    }

    const allowedBridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        folder,
        capabilities: allowCapabilities(["create", "manage_status", "manage_metadata", "delete"]),
      }),
    });
    const allowedInstance = await loadedInstance(allowedBridge, folder.id);
    const allowedTree = expandElementTree(allowedInstance.render());

    const allowedCreateButton = findElement(
      allowedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Create folder",
    );
    const allowedStatusButton = findElement(
      allowedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Save status",
    );
    const allowedDatesButton = findElement(
      allowedTree,
      (el) => el.type === "button" && el.props.type === "submit" && el.props.children === "Save dates",
    );
    const allowedDeleteButton = findElement(
      allowedTree,
      (el) => el.type === "button" && el.props.children === "Delete folder",
    );
    for (const button of [allowedCreateButton, allowedStatusButton, allowedDatesButton, allowedDeleteButton]) {
      expect(button).toBeDefined();
      expect(elementProps(button).disabled).toBe(false);
    }
  });

  // ---------------------------------------------------------------------
  // Create-child-folder flow.
  // ---------------------------------------------------------------------

  it("create-child-folder: trimmed-empty name sets a field error and never calls createFolder", async () => {
    const createFolderSpy = vi.fn();
    const folder = fixtureFolder();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["create"]) }),
        createFolder: createFolderSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleChildFolderNameChange(fakeChangeEvent("   "));

    await instance.handleCreateChildFolderSubmit(fakeSubmitEvent());

    expect(createFolderSpy).not.toHaveBeenCalled();
    expect(instance.state.childFolderFieldErrors).toEqual({ name: ["Enter a folder name."] });
  });

  it("create-child-folder: a successful submit updates the visible child-folder list and shows success feedback", async () => {
    const folder = fixtureFolder();
    const created = fixtureFolder({ id: "folder-new-child", name: "New Child" });
    const createFolderSpy = vi.fn(async () => okResult(created));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["create"]) }),
        createFolder: createFolderSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleChildFolderNameChange(fakeChangeEvent("  New Child  "));

    await instance.handleCreateChildFolderSubmit(fakeSubmitEvent());

    expect(createFolderSpy).toHaveBeenCalledWith(fixtureContext, {
      name: "New Child",
      description: null,
      parentFolderId: folder.id,
    });
    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.childFolders).toEqual([created]);
    }
    expect(instance.state.feedback).toEqual({
      kind: "visible",
      feedback: { intent: "success", title: "Folder created", description: "New Child" },
    });
    expect(instance.state.creatingChildFolder).toBe(false);
  });

  it("create-child-folder: a failed submit shows safe failure feedback, never the raw backend message, and does not double-submit while already submitting", async () => {
    const folder = fixtureFolder();
    const createFolderSpy = vi.fn(async () =>
      errResult<ArchiveFolder>("validation", "RAW-CHILD-FOLDER-FAIL"),
    );
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["create"]) }),
        createFolder: createFolderSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleChildFolderNameChange(fakeChangeEvent("New Child"));

    await instance.handleCreateChildFolderSubmit(fakeSubmitEvent());

    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-CHILD-FOLDER-FAIL");
    expect(instance.state.creatingChildFolder).toBe(false);

    // Duplicate-submission guard: while `creatingChildFolder` is true, a
    // second submit call is a structural no-op (card scope item 14).
    instance.setState({ creatingChildFolder: true } as never);
    await instance.handleCreateChildFolderSubmit(fakeSubmitEvent());
    expect(createFolderSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------
  // Create-item flow.
  // ---------------------------------------------------------------------

  it("create-item: trimmed-empty name sets a field error and never calls createItem", async () => {
    const createItemSpy = vi.fn();
    const folder = fixtureFolder();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["create"]) }),
        createItem: createItemSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleItemNameChange(fakeChangeEvent(""));

    await instance.handleCreateItemSubmit(fakeSubmitEvent());

    expect(createItemSpy).not.toHaveBeenCalled();
    expect(instance.state.itemFieldErrors).toEqual({ name: ["Enter an item name."] });
  });

  it("create-item: a successful submit calls createItem with itemType 'record' and updates the visible item list", async () => {
    const folder = fixtureFolder();
    const created = fixtureItem({ id: "item-new", name: "New Item" });
    const createItemSpy = vi.fn(async () => okResult(created));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["create"]) }),
        createItem: createItemSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleItemNameChange(fakeChangeEvent("New Item"));

    await instance.handleCreateItemSubmit(fakeSubmitEvent());

    expect(createItemSpy).toHaveBeenCalledWith(fixtureContext, {
      folderId: folder.id,
      name: "New Item",
      description: null,
      itemType: "record",
    });
    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.items).toEqual([created]);
    }
    expect(instance.state.feedback.kind).toBe("visible");
  });

  // ---------------------------------------------------------------------
  // Status editing.
  // ---------------------------------------------------------------------

  it("status editing: submits the exact closed status via setFolderStatus and updates the visible folder projection", async () => {
    const folder = fixtureFolder({ status: "active" });
    const updated = fixtureFolder({ status: "archived" });
    const setFolderStatusSpy = vi.fn(async () => okResult(updated));
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["manage_status"]) }),
        setFolderStatus: setFolderStatusSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleStatusFieldChange(fakeSelectChangeEvent("archived"));

    await instance.handleStatusSubmit(fakeSubmitEvent());

    expect(setFolderStatusSpy).toHaveBeenCalledWith(fixtureContext, folder.id, { status: "archived" });
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.folder.status).toBe("archived");
    }
    expect(instance.state.feedback.kind).toBe("visible");
  });

  it("status editing: never calls setFolderStatus while the capability is denied (the submit handler itself refuses)", async () => {
    const folder = fixtureFolder();
    const setFolderStatusSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: denyAllCapabilities() }),
        setFolderStatus: setFolderStatusSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);

    await instance.handleStatusSubmit(fakeSubmitEvent());

    expect(setFolderStatusSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Due/expiry editing.
  // ---------------------------------------------------------------------

  it("dates editing: invalid input never calls setFolderDates and sets a field error", async () => {
    const folder = fixtureFolder();
    const setFolderDatesSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["manage_metadata"]) }),
        setFolderDates: setFolderDatesSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleDueAtChange(fakeChangeEvent("not-a-date"));

    await instance.handleDatesSubmit(fakeSubmitEvent());

    expect(setFolderDatesSpy).not.toHaveBeenCalled();
    expect(instance.state.dateFieldErrors).toEqual({ dueAt: ["Enter a valid due date and time."] });
  });

  it("dates editing: valid input reaches setFolderDates as RFC 3339/null and updates the visible folder dates", async () => {
    const folder = fixtureFolder({ dueAt: null, expiresAt: null });
    const updated = fixtureFolder({ dueAt: new Date("2026-03-01T10:00:00.000Z"), expiresAt: null });
    const setFolderDatesSpy = vi.fn(
      async (
        _context: ArchiveContextInput,
        _folderId: string,
        _input: { dueAt?: string | null; expiresAt?: string | null },
      ) => okResult(updated),
    );
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["manage_metadata"]) }),
        setFolderDates: setFolderDatesSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleDueAtChange(fakeChangeEvent("2026-03-01T10:00"));

    await instance.handleDatesSubmit(fakeSubmitEvent());

    expect(setFolderDatesSpy).toHaveBeenCalledTimes(1);
    const [, , input] = setFolderDatesSpy.mock.calls[0]!;
    expect(input.expiresAt).toBeNull();
    expect(typeof input.dueAt).toBe("string");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.folder.dueAt).toEqual(updated.dueAt);
    }
    expect(instance.state.dueAtField).toBe("2026-03-01T10:00");
  });

  // REPAIR-R1: proof point (e) — the real, mounted component's
  // `handleDatesSubmit` wiring (not a parallel test-only reimplementation)
  // threads the loaded-value/loaded-instant snapshot from `componentDidMount`
  // -> `loadFolderScreen` through to `archiveUiSubmitFolderDates`. This is
  // observable only because submitting WITHOUT editing either field
  // preserves the original exact instant, including seconds a
  // minute-precision `datetime-local` display value cannot represent —
  // behavior that requires the repaired `dueAtLoadedValue`/`dueAtLoadedIso`
  // state actually reaching the submit call.
  it("REPAIR-R1: submitting UNCHANGED loaded dates preserves the original exact instant (incl. seconds) through the real component", async () => {
    const folder = fixtureFolder({
      dueAt: new Date("2026-03-01T10:00:45.123Z"),
      expiresAt: null,
    });
    const setFolderDatesSpy = vi.fn(
      async (
        _context: ArchiveContextInput,
        _folderId: string,
        _input: { dueAt?: string | null; expiresAt?: string | null },
      ) => okResult(folder),
    );
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["manage_metadata"]) }),
        setFolderDates: setFolderDatesSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    // Deliberately no `handleDueAtChange`/`handleExpiresAtChange` call: the
    // fields stay exactly as loaded.

    await instance.handleDatesSubmit(fakeSubmitEvent());

    expect(setFolderDatesSpy).toHaveBeenCalledTimes(1);
    const [, , input] = setFolderDatesSpy.mock.calls[0]!;
    expect(input.dueAt).toBe("2026-03-01T10:00:45.123Z");
    expect(input.expiresAt).toBeNull();
  });

  // REPAIR-R1: proof point (c) through the real component wiring — a
  // calendar-impossible EDITED value never reaches `setFolderDates` and
  // produces the same field-error path as any other invalid value.
  it("REPAIR-R1: a calendar-impossible edited value never calls setFolderDates through the real component", async () => {
    const folder = fixtureFolder({ dueAt: null, expiresAt: null });
    const setFolderDatesSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["manage_metadata"]) }),
        setFolderDates: setFolderDatesSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);
    instance.handleDueAtChange(fakeChangeEvent("2026-02-30T10:00"));

    await instance.handleDatesSubmit(fakeSubmitEvent());

    expect(setFolderDatesSpy).not.toHaveBeenCalled();
    expect(instance.state.dateFieldErrors).toEqual({ dueAt: ["Enter a valid due date and time."] });
  });

  // ---------------------------------------------------------------------
  // Soft deletion with destructive confirmation.
  // ---------------------------------------------------------------------

  it("delete: requesting confirmation does not call softDeleteFolder; confirming does, then navigates to root only", async () => {
    const folder = fixtureFolder({ name: "Q3 Reports" });
    const softDeleteFolderSpy = vi.fn(async () => okResult(fixtureFolder({ isDeleted: true })));
    const navigateCalls: ArchiveUiNavigationIntent[] = [];
    const bridge = createFakeBridge({
      navigate: (intent) => navigateCalls.push(intent),
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["delete"]) }),
        softDeleteFolder: softDeleteFolderSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);

    instance.handleRequestDelete();
    expect(instance.state.deleteConfirmation).toEqual({
      status: "pending",
      labels: { actionLabel: "Delete folder", subjectLabel: 'folder "Q3 Reports"' },
    });
    expect(softDeleteFolderSpy).not.toHaveBeenCalled();

    await instance.handleConfirmDelete();

    expect(softDeleteFolderSpy).toHaveBeenCalledWith(fixtureContext, folder.id);
    expect(instance.state.deleteConfirmation).toEqual({ status: "idle" });
    expect(instance.state.feedback.kind).toBe("visible");
    expect(navigateCalls).toEqual([{ screen: "root" }]);
    expect(Object.keys(navigateCalls[0]!)).toEqual(["screen"]);
  });

  it("delete: cancel returns confirmation to idle without ever calling softDeleteFolder", async () => {
    const folder = fixtureFolder();
    const softDeleteFolderSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["delete"]) }),
        softDeleteFolder: softDeleteFolderSpy,
      },
    });
    const instance = await loadedInstance(bridge, folder.id);

    instance.handleRequestDelete();
    instance.handleCancelDelete();

    expect(instance.state.deleteConfirmation).toEqual({ status: "idle" });
    expect(softDeleteFolderSpy).not.toHaveBeenCalled();
  });

  it("delete: a failed confirm shows safe failure feedback, never the raw message, and stays on-screen (no navigate)", async () => {
    const folder = fixtureFolder();
    const navigateCalls: ArchiveUiNavigationIntent[] = [];
    const bridge = createFakeBridge({
      navigate: (intent) => navigateCalls.push(intent),
      serviceOverrides: {
        ...readyServiceOverrides({ folder, capabilities: allowCapabilities(["delete"]) }),
        softDeleteFolder: async () => errResult("server_error", "RAW-DELETE-FAIL"),
      },
    });
    const instance = await loadedInstance(bridge, folder.id);

    instance.handleRequestDelete();
    await instance.handleConfirmDelete();

    expect(navigateCalls).toEqual([]);
    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-DELETE-FAIL");
    expect(instance.state.deletingFolder).toBe(false);
  });

  it("handleDismissFeedback returns feedback to idle", () => {
    const bridge = createFakeBridge({ serviceOverrides: readyServiceOverrides() });
    const instance = new ArchiveFolderScreen({ bridge, folderId: "folder-current" });
    attachSyncUpdater(instance);
    instance.setState({
      feedback: { kind: "visible", feedback: { intent: "success", title: "Done" } },
    } as never);

    instance.handleDismissFeedback();

    expect(instance.state.feedback).toEqual({ kind: "idle" });
  });

  // ---------------------------------------------------------------------
  // Styling/responsive structure + import-boundary proof.
  // ---------------------------------------------------------------------

  it("structural responsive-layout and approved-token usage is present in the rendered tree", async () => {
    const folder = fixtureFolder();
    const bridge = createFakeBridge({
      serviceOverrides: readyServiceOverrides({
        folder,
        childFolders: [fixtureFolder({ id: "folder-child" })],
      }),
    });
    const instance = await loadedInstance(bridge, folder.id);

    const tree = expandElementTree(instance.render());
    const sectionStyle = elementProps(tree).style;
    expect(sectionStyle.backgroundColor).toBe("var(--color-bg)");
    expect(sectionStyle.color).toBe("var(--color-text)");
    expect(sectionStyle.fontFamily).toBe("var(--font-sans)");

    const gridStyleElement = findElement(
      tree,
      (el) => typeof el.props.style?.gridTemplateColumns === "string",
    );
    expect(gridStyleElement).toBeDefined();
    expect(elementProps(gridStyleElement).style.gridTemplateColumns).toContain("auto-fit");
    expect(elementProps(gridStyleElement).style.gridTemplateColumns).toContain("minmax(");
  });

  it("no Shell/Next.js/router/Prisma/internal-Archive import exists in the folder-screen production source", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(new URL("../folder-screen.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const importSpecifierPattern = /from\s+["']([^"']+)["']/g;
    const importedSpecifiers = [...codeOnly.matchAll(importSpecifierPattern)].map(
      (match) => match[1],
    );
    expect(importedSpecifiers.sort()).toEqual(
      [
        "./bridge.js",
        "./capabilities.js",
        "./confirmation.js",
        "./feedback.js",
        "./validation.js",
        "./view-state.js",
        "@customprojects/archive-service",
        "react",
        "react",
      ].sort(),
    );
    const forbiddenPattern =
      /platform-shell|shell-master|next\/|next"|react-dom|@prisma|window\.location|\.\.\/archive\//i;
    expect(forbiddenPattern.test(codeOnly)).toBe(false);
  });
});
