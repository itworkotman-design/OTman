import type { Component, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-06 Part B (the Archive resource/permission history
// screen). Every bridge/supporting type below comes from the public "./ui"
// entry point, mirroring the TASK-02/TASK-03/TASK-04/TASK-05/TASK-06 Part A
// test discipline. No jsdom/Testing Library/react-dom is used anywhere in
// this file — see `history-screen.tsx`'s file-top HOOK-CALL CONSTRAINT
// comment for why `ArchiveHistoryScreen` is a class component, and
// `attachSyncUpdater` below (duplicated locally per the established
// precedent) for how this file exercises its real setState/lifecycle/render
// methods without a DOM renderer.
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchiveHistoryScreen } from "../index.js";
import {
  archiveUiFetchHistoryPage,
  archiveUiHistoryActorDisplay,
  archiveUiHistoryBackEnabled,
  archiveUiHistoryEventLabel,
  archiveUiHistoryModeStateAfterBack,
  archiveUiHistoryModeStateAfterNext,
  archiveUiHistoryNextEnabled,
  archiveUiInitialHistoryModeState,
  archiveUiSafeHistorySummaryFields,
  type ArchiveHistoryScreenTarget,
} from "../history-screen.js";
import type {
  ArchiveContextInput,
  ArchiveHistoryEntry,
  ArchiveHistoryPage,
  ArchiveHostAdapterError,
  ArchiveHostAdapterResult,
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

function fixtureEntry(overrides: Partial<ArchiveHistoryEntry> = {}): ArchiveHistoryEntry {
  return {
    eventId: "event-1",
    eventType: "archive.item.status_changed",
    occurredAt: now,
    actorUserId: "user-1",
    targetType: "item",
    targetId: "item-1",
    summary: {},
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

function fixturePage(entries: ArchiveHistoryEntry[], nextCursor: string | null): ArchiveHistoryPage {
  return { entries, nextCursor };
}

function createStubServicePort(overrides: Partial<ArchiveUiServicePort>): ArchiveUiServicePort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-history-screen fixture: method not implemented");
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
    throw new Error("archive-ui-history-screen fixture: transport method not implemented");
  };
  return { uploadFile: notImplemented, downloadFile: notImplemented } as unknown as ArchiveUiFileTransport;
}

// Correction Phase 6 TASK-08A: the history screen does not use the identity
// port in this task (no screen production file changes) — a throwing stub
// satisfies `ArchiveUiBridge`'s now-required `identity` property.
function createStubIdentity(): ArchiveUiIdentityPort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-history-screen fixture: identity method not implemented");
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
  readonly currentUserDisplay?: { displayName?: string; email?: string } | undefined;
}

function createFakeBridge(options: FakeBridgeOptions = {}): ArchiveUiBridge {
  return {
    getContext: () => options.context ?? fixtureContext,
    getCurrentUserDisplay: () => options.currentUserDisplay,
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

// ---------------------------------------------------------------------------
// Proof 17: exact resource/permission service calls with folder/item
// targets only.
// ---------------------------------------------------------------------------

describe("archiveUiFetchHistoryPage — exact calls", () => {
  it("resource mode calls listResourceHistory with the exact folder target, omitting cursor/limit on first page", async () => {
    const spy = vi.fn(async (_context: ArchiveContextInput, _query: unknown) => okResult(fixturePage([], null)));
    const bridge = createFakeBridge({ serviceOverrides: { listResourceHistory: spy } });
    const target: ArchiveHistoryScreenTarget = { targetType: "folder", targetId: "folder-1" };

    await archiveUiFetchHistoryPage(bridge, fixtureContext, "resource", target, undefined);

    expect(spy).toHaveBeenCalledTimes(1);
    const [, query] = spy.mock.calls[0];
    expect(query).toEqual({ targetType: "folder", targetId: "folder-1" });
    expect(Object.prototype.hasOwnProperty.call(query, "cursor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(query, "limit")).toBe(false);
  });

  it("permission mode calls listPermissionHistory with the exact item target", async () => {
    const spy = vi.fn(async (_context: ArchiveContextInput, _query: unknown) => okResult(fixturePage([], null)));
    const bridge = createFakeBridge({ serviceOverrides: { listPermissionHistory: spy } });
    const target: ArchiveHistoryScreenTarget = { targetType: "item", targetId: "item-1" };

    await archiveUiFetchHistoryPage(bridge, fixtureContext, "permission", target, undefined);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toEqual({ targetType: "item", targetId: "item-1" });
  });

  it("a non-first page includes exactly the supplied opaque cursor, never a limit", async () => {
    const spy = vi.fn(async (_context: ArchiveContextInput, _query: unknown) => okResult(fixturePage([], null)));
    const bridge = createFakeBridge({ serviceOverrides: { listResourceHistory: spy } });
    const target: ArchiveHistoryScreenTarget = { targetType: "folder", targetId: "folder-1" };

    await archiveUiFetchHistoryPage(bridge, fixtureContext, "resource", target, "opaque-cursor-1");

    expect(spy.mock.calls[0][1]).toEqual({
      targetType: "folder",
      targetId: "folder-1",
      cursor: "opaque-cursor-1",
    });
  });
});

// ---------------------------------------------------------------------------
// Proof 18: first-page/no-cursor, nextCursor pass-through, Back
// cursor-stack behavior, no decoding/fabrication.
// ---------------------------------------------------------------------------

describe("cursor stack transitions", () => {
  it("the initial mode state's cursor stack is exactly [undefined] at page 0", () => {
    const state = archiveUiInitialHistoryModeState();
    expect(state.cursorStack).toEqual([undefined]);
    expect(state.pageIndex).toBe(0);
  });

  it("Next appends the EXACT returned nextCursor and never fabricates one", () => {
    const state = { ...archiveUiInitialHistoryModeState(), pageIndex: 0, cursorStack: [undefined] as const };
    const after = archiveUiHistoryModeStateAfterNext(state, "cursor-page-2");
    expect(after.cursorStack).toEqual([undefined, "cursor-page-2"]);
    expect(after.pageIndex).toBe(1);
  });

  it("Back reuses the exact previously requested cursor at the prior stack position", () => {
    const afterNext = archiveUiHistoryModeStateAfterNext(archiveUiInitialHistoryModeState(), "cursor-page-2");
    const afterNext2 = archiveUiHistoryModeStateAfterNext(afterNext, "cursor-page-3");
    const back = archiveUiHistoryModeStateAfterBack(afterNext2);
    expect(back.pageIndex).toBe(1);
    expect(back.cursorStack).toEqual([undefined, "cursor-page-2", "cursor-page-3"]);
    expect(back.cursorStack[back.pageIndex]).toBe("cursor-page-2");
  });

  it("Next after a Back truncates any stale forward branch before appending", () => {
    const afterNext = archiveUiHistoryModeStateAfterNext(archiveUiInitialHistoryModeState(), "stale-branch");
    const back = archiveUiHistoryModeStateAfterBack(afterNext);
    const afterNextAgain = archiveUiHistoryModeStateAfterNext(back, "fresh-branch");
    expect(afterNextAgain.cursorStack).toEqual([undefined, "fresh-branch"]);
  });

  it("Next is disabled when nextCursor is null; Back is disabled on the first page", () => {
    const readyState = {
      viewState: { status: "ready" as const, data: fixturePage([], null) },
      cursorStack: [undefined] as const,
      pageIndex: 0,
    };
    expect(archiveUiHistoryNextEnabled(readyState)).toBe(false);
    expect(archiveUiHistoryBackEnabled(readyState)).toBe(false);

    const readyWithNext = {
      ...readyState,
      viewState: { status: "ready" as const, data: fixturePage([], "more") },
    };
    expect(archiveUiHistoryNextEnabled(readyWithNext)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proof 19: stale response/mode guard.
// ---------------------------------------------------------------------------

describe("ArchiveHistoryScreen — stale response guard", () => {
  it("a stale in-flight resource fetch does not overwrite state after a mode switch completes first", async () => {
    let resolveStaleFetch: ((value: ArchiveHostAdapterResult<ArchiveHistoryPage>) => void) | undefined;
    const listResourceHistory = vi.fn(
      () =>
        new Promise<ArchiveHostAdapterResult<ArchiveHistoryPage>>((resolveFetch) => {
          resolveStaleFetch = resolveFetch;
        }),
    );
    const listPermissionHistory = vi.fn(async () =>
      okResult(fixturePage([fixtureEntry({ eventId: "permission-event" })], null)),
    );
    const bridge = createFakeBridge({ serviceOverrides: { listResourceHistory, listPermissionHistory } });

    const instance = new ArchiveHistoryScreen({
      bridge,
      target: { targetType: "item", targetId: "item-1" },
    });
    attachSyncUpdater(instance);
    instance.componentDidMount(); // starts the stale resource fetch, left pending

    instance.handleSelectPermissionMode(); // issues a NEWER request
    await flushMicrotasks();
    await flushMicrotasks();

    // The newer permission fetch has resolved and applied.
    expect(instance.state.permission.viewState.status).toBe("ready");

    // Now resolve the STALE resource fetch — it must NOT overwrite anything
    // the current mode/page depends on being able to observe.
    resolveStaleFetch?.(okResult(fixturePage([fixtureEntry({ eventId: "stale-event" })], null)));
    await flushMicrotasks();

    expect(instance.state.mode).toBe("permission");
    expect(instance.state.permission.viewState.status).toBe("ready");
    if (instance.state.permission.viewState.status === "ready") {
      expect(instance.state.permission.viewState.data.entries.map((e) => e.eventId)).toEqual([
        "permission-event",
      ]);
    }
    // The stale resource fetch's response was genuinely DISCARDED (not just
    // irrelevant to the assertions above): resource state never advanced
    // past "loading" to the stale "stale-event" data.
    expect(instance.state.resource.viewState.status).toBe("loading");
  });
});

// ---------------------------------------------------------------------------
// Proof 20: loading/ready/denied/error for both modes (empty is represented
// inline within `ready`, see history-screen.tsx's own documented reasoning).
// ---------------------------------------------------------------------------

describe("ArchiveHistoryScreen — per-mode states", () => {
  it("loading: before the initial fetch resolves, resource mode is loading", () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listResourceHistory: () => new Promise(() => {}) },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    expect(instance.state.resource.viewState.status).toBe("loading");
  });

  it("ready with entries renders them; ready with zero entries renders inline empty copy (pagination controls still present)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listResourceHistory: async () => okResult(fixturePage([], null)) },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    expect(instance.state.resource.viewState.status).toBe("ready");
    const tree = expandElementTree(instance.render());
    expect(findElement(tree, (el) => elementProps(el)["data-archive-ui-history-empty"] === "true")).toBeDefined();
    expect(findElement(tree, (el) => el.type === "button" && elementProps(el).children === "Next page")).toBeDefined();
  });

  it("denied: an unauthorized failure renders the calm denied state, never a raw reason", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listResourceHistory: async () => errResult("unauthorized", "RAW-DENY") },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    expect(instance.state.resource.viewState.status).toBe("denied");
    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree);
    expect(texts.join(" ")).not.toContain("RAW-DENY");
  });

  it("error: a not_found failure renders the calm translated error state, never a raw reason", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: { listResourceHistory: async () => errResult("not_found", "RAW-NOTFOUND") },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    expect(instance.state.resource.viewState.status).toBe("error");
    const texts = collectRenderedText(expandElementTree(instance.render()));
    expect(texts.join(" ")).not.toContain("RAW-NOTFOUND");
  });

  it("permission mode loads lazily only when selected, not on mount", async () => {
    const listPermissionHistory = vi.fn(async () => okResult(fixturePage([], null)));
    const bridge = createFakeBridge({
      serviceOverrides: {
        listResourceHistory: async () => okResult(fixturePage([], null)),
        listPermissionHistory,
      },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();
    expect(listPermissionHistory).not.toHaveBeenCalled();

    instance.handleSelectPermissionMode();
    await flushMicrotasks();
    expect(listPermissionHistory).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Proof 21/22: identity presentation.
// ---------------------------------------------------------------------------

describe("archiveUiHistoryActorDisplay", () => {
  it("the current user prefers displayName, then email, then the safe fallback 'You'", () => {
    const bridgeWithName = createFakeBridge({ currentUserDisplay: { displayName: "Ada", email: "ada@example.test" } });
    expect(archiveUiHistoryActorDisplay(bridgeWithName, fixtureContext, "user-1")).toBe("Ada");

    const bridgeWithEmailOnly = createFakeBridge({ currentUserDisplay: { email: "ada@example.test" } });
    expect(archiveUiHistoryActorDisplay(bridgeWithEmailOnly, fixtureContext, "user-1")).toBe("ada@example.test");

    const bridgeWithNoDisplay = createFakeBridge({ currentUserDisplay: undefined });
    expect(archiveUiHistoryActorDisplay(bridgeWithNoDisplay, fixtureContext, "user-1")).toBe("You");
  });

  it("every other actor renders the honest 'Unresolved user' placeholder, never the raw id", () => {
    const bridge = createFakeBridge({ currentUserDisplay: { displayName: "Ada" } });
    const display = archiveUiHistoryActorDisplay(bridge, fixtureContext, "user-OTHER-raw-id");
    expect(display).toBe("Unresolved user");
    expect(display).not.toContain("user-OTHER-raw-id");
  });
});

// ---------------------------------------------------------------------------
// Proof 23/24/25: safe-summary allow-list rendering.
// ---------------------------------------------------------------------------

describe("archiveUiSafeHistorySummaryFields", () => {
  it("emits only allow-listed human fields for a status-change summary", () => {
    const fields = archiveUiSafeHistorySummaryFields({ previousStatus: "active", newStatus: "archived" });
    expect(fields).toEqual([
      { label: "Previous status", value: "active" },
      { label: "New status", value: "archived" },
    ]);
  });

  it("permission subjects render honest unresolved user/role placeholders without the raw subjectId/permissionId", () => {
    const userFields = archiveUiSafeHistorySummaryFields({
      permissionId: "perm-raw-id",
      subjectType: "user",
      subjectId: "subject-raw-id",
      permissionAction: "view",
      permissionEffect: "allow",
    });
    expect(userFields).toEqual([
      { label: "Permission action", value: "view" },
      { label: "Permission effect", value: "allow" },
      { label: "Subject", value: "Unresolved user subject" },
    ]);
    expect(JSON.stringify(userFields)).not.toContain("perm-raw-id");
    expect(JSON.stringify(userFields)).not.toContain("subject-raw-id");

    const roleFields = archiveUiSafeHistorySummaryFields({ subjectType: "role", subjectId: "role-raw-id" });
    expect(roleFields).toEqual([{ label: "Subject", value: "Unresolved role subject" }]);
  });

  it("ignores unknown, id, storage, and non-scalar/object fields entirely — no JSON.stringify(summary) passthrough", () => {
    const poisoned = {
      name: "Visible name",
      folderId: "folder-raw-id",
      parentFolderId: "parent-raw-id",
      targetId: "target-raw-id",
      fileId: "file-raw-id",
      archiveItemId: "item-raw-id",
      storageKey: "storage-raw-key",
      storedFileName: "stored-raw-name",
      storageProvider: "s3",
      actorUserId: "actor-raw-id",
      unknownField: "should never appear",
      nestedObject: { a: 1 },
      arrayField: [1, 2, 3],
    };
    const fields = archiveUiSafeHistorySummaryFields(poisoned);
    expect(fields).toEqual([{ label: "Name", value: "Visible name" }]);
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toContain("folder-raw-id");
    expect(serialized).not.toContain("parent-raw-id");
    expect(serialized).not.toContain("target-raw-id");
    expect(serialized).not.toContain("file-raw-id");
    expect(serialized).not.toContain("item-raw-id");
    expect(serialized).not.toContain("storage-raw-key");
    expect(serialized).not.toContain("stored-raw-name");
    expect(serialized).not.toContain("actor-raw-id");
    expect(serialized).not.toContain("should never appear");
    expect(serialized).not.toContain("nestedObject");
  });

  it("null date fields render as 'Not set', never as a raw null passthrough", () => {
    const fields = archiveUiSafeHistorySummaryFields({ previousDueAt: null, newDueAt: "2026-05-01T00:00:00.000Z" });
    expect(fields).toEqual([
      { label: "Previous due", value: "Not set" },
      { label: "New due", value: "2026-05-01T00:00:00.000Z" },
    ]);
  });
});

describe("archiveUiHistoryEventLabel", () => {
  it("maps known action families to closed human-readable labels", () => {
    expect(archiveUiHistoryEventLabel("archive.item.status_changed")).toBe("Item status changed");
    expect(archiveUiHistoryEventLabel("archive.permission.granted")).toBe("Permission granted");
  });

  it("unknown/unsupported action families get the calm generic label, never a raw payload dump", () => {
    expect(archiveUiHistoryEventLabel("archive.namespace.bootstrap_completed" as any)).toBe("Archive event");
  });
});

describe("rendered history entries never leak raw ids or unfiltered payloads", () => {
  it("entry rendering uses only the safe actor display + allow-listed summary fields, never entry.summary directly stringified", async () => {
    const poisonedEntry = fixtureEntry({
      eventId: "event-poisoned",
      actorUserId: "user-OTHER",
      summary: { name: "Safe Name", subjectId: "subject-raw", storageKey: "storage-raw" },
    });
    const bridge = createFakeBridge({
      serviceOverrides: { listResourceHistory: async () => okResult(fixturePage([poisonedEntry], null)) },
      currentUserDisplay: { displayName: "Current User" },
    });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    const tree = expandElementTree(instance.render());
    const texts = collectRenderedText(tree).join(" ");
    expect(texts).not.toContain("user-OTHER");
    expect(texts).not.toContain("subject-raw");
    expect(texts).not.toContain("storage-raw");
    expect(texts).toContain("Unresolved user");
    expect(texts).toContain("Safe Name");
  });
});

// ---------------------------------------------------------------------------
// Proof 26: back navigation intent exact and host-neutral.
// ---------------------------------------------------------------------------

describe("ArchiveHistoryScreen back navigation", () => {
  it("folder target navigates to exactly { screen: 'folder', folderId }", () => {
    const navigateSpy = vi.fn();
    const bridge = createFakeBridge({ navigate: navigateSpy });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "folder-9" } });
    attachSyncUpdater(instance);
    instance.handleBackNavigate();
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "folder", folderId: "folder-9" });
    expect(Object.keys(navigateSpy.mock.calls[0][0]).sort()).toEqual(["folderId", "screen"]);
  });

  it("item target navigates to exactly { screen: 'item', itemId }", () => {
    const navigateSpy = vi.fn();
    const bridge = createFakeBridge({ navigate: navigateSpy });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "item", targetId: "item-9" } });
    attachSyncUpdater(instance);
    instance.handleBackNavigate();
    expect(navigateSpy).toHaveBeenCalledWith({ screen: "item", itemId: "item-9" });
    expect(Object.keys(navigateSpy.mock.calls[0][0]).sort()).toEqual(["itemId", "screen"]);
  });
});

// ---------------------------------------------------------------------------
// Real mountable lifecycle/pagination wiring (Next/Back through the actual
// component instance, not detached helpers only).
// ---------------------------------------------------------------------------

describe("ArchiveHistoryScreen — real Next/Back wiring", () => {
  it("Next requests the exact returned nextCursor; Back re-requests the exact prior cursor", async () => {
    const calls: (string | undefined)[] = [];
    const listResourceHistory = vi.fn(async (_context: unknown, query: { cursor?: string }) => {
      calls.push(query.cursor);
      if (query.cursor === undefined) {
        return okResult(fixturePage([fixtureEntry({ eventId: "page-0" })], "cursor-1"));
      }
      if (query.cursor === "cursor-1") {
        return okResult(fixturePage([fixtureEntry({ eventId: "page-1" })], null));
      }
      throw new Error(`unexpected cursor ${String(query.cursor)}`);
    });
    const bridge = createFakeBridge({ serviceOverrides: { listResourceHistory } });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.resource.pageIndex).toBe(1);
    if (instance.state.resource.viewState.status === "ready") {
      expect(instance.state.resource.viewState.data.entries[0]?.eventId).toBe("page-1");
    }

    instance.handleBack();
    await flushMicrotasks();
    expect(instance.state.resource.pageIndex).toBe(0);
    if (instance.state.resource.viewState.status === "ready") {
      expect(instance.state.resource.viewState.data.entries[0]?.eventId).toBe("page-0");
    }

    expect(calls).toEqual([undefined, "cursor-1", undefined]);
  });

  it("mode switch resets to that mode's own first page", async () => {
    const listResourceHistory = vi.fn(async () => okResult(fixturePage([fixtureEntry()], "resource-next")));
    const listPermissionHistory = vi.fn(async () => okResult(fixturePage([], null)));
    const bridge = createFakeBridge({ serviceOverrides: { listResourceHistory, listPermissionHistory } });
    const instance = new ArchiveHistoryScreen({ bridge, target: { targetType: "folder", targetId: "f-1" } });
    attachSyncUpdater(instance);
    instance.componentDidMount();
    await flushMicrotasks();

    instance.handleNext();
    await flushMicrotasks();
    expect(instance.state.resource.pageIndex).toBe(1);

    instance.handleSelectPermissionMode();
    await flushMicrotasks();
    expect(instance.state.permission.pageIndex).toBe(0);

    instance.handleSelectResourceMode();
    await flushMicrotasks();
    expect(instance.state.resource.pageIndex).toBe(0);
  });
});
