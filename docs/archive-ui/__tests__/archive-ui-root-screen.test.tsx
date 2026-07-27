import type { ChangeEvent, Component, FormEvent, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-04 (the Archive root/home screen). Every bridge/
// supporting type below comes from the public "./ui" entry point (the same
// public surface a real host consumes), mirroring the TASK-02/TASK-03 test
// discipline. No jsdom/Testing Library/react-dom is used anywhere in this
// file — see `root-screen.tsx`'s file-top HOOK-CALL CONSTRAINT comment for
// why `ArchiveRootScreen` is a class component, and `attachSyncUpdater`
// below for how this file exercises its real `setState`/lifecycle/render
// methods without a DOM renderer.
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchiveRootScreen } from "../index.js";
// The pure controller functions are internal to `root-screen.tsx` (never
// re-exported through the public "./ui" surface, per the card's "smallest
// necessary export" requirement) — this file imports them directly via the
// same in-tree relative path the production module itself lives at, exactly
// like `archive-ui-bridge-source-boundary.test.tsx` already permits for
// production-source-only relative imports staying inside `src/archive-ui/`.
import {
  archiveUiApplyCreatedRootFolder,
  archiveUiLoadRootScreenData,
  archiveUiSubmitCreateRootFolder,
  archiveUiValidateRootFolderName,
} from "../root-screen.js";
import {
  archiveUiViewStateEmpty,
  archiveUiViewStateReady,
} from "../view-state.js";
import {
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveContextInput,
  type ArchiveEffectiveCapabilityMap,
  type ArchiveFolder,
  type ArchiveHostAdapterError,
  type ArchiveHostAdapterResult,
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

function denyAllCapabilities(): ArchiveEffectiveCapabilityMap {
  return Object.fromEntries(
    ARCHIVE_PERMISSION_ACTIONS.map((action) => [
      action,
      { allowed: false, source: "none" as const },
    ]),
  ) as ArchiveEffectiveCapabilityMap;
}

function allowCapability(
  action: (typeof ARCHIVE_PERMISSION_ACTIONS)[number],
): ArchiveEffectiveCapabilityMap {
  const map = denyAllCapabilities();
  return { ...map, [action]: { allowed: true, source: "direct_user" as const } };
}

// The same never-leak-the-raw-message discipline the TASK-03 shared-
// primitives test uses.
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
// supply only the handful of methods `ArchiveRootScreen` actually calls
// while every other method fails loudly and visibly if the screen ever
// reaches it unexpectedly — never a silently-passing default.
function createStubServicePort(
  overrides: Partial<ArchiveUiServicePort>,
): ArchiveUiServicePort {
  const notImplemented = async (): Promise<never> => {
    throw new Error("archive-ui-root-screen fixture: method not implemented");
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
    throw new Error("archive-ui-root-screen fixture: transport not used by the root screen");
  },
  downloadFile: async () => {
    throw new Error("archive-ui-root-screen fixture: transport not used by the root screen");
  },
} as unknown as ArchiveUiFileTransport;

// Correction Phase 6 TASK-08A: the root screen does not use the identity
// port in this task (no screen production file changes) — a throwing stub
// satisfies `ArchiveUiBridge`'s now-required `identity` property.
const stubIdentity: ArchiveUiIdentityPort = {
  resolvePlatformUsers: async () => {
    throw new Error("archive-ui-root-screen fixture: identity not used by the root screen");
  },
  listAssignableCompanyMembers: async () => {
    throw new Error("archive-ui-root-screen fixture: identity not used by the root screen");
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

// `ReactElement`'s `props` field is typed `unknown` by `@types/react` — this
// generic accessor is used ONLY to structurally inspect an element's own
// props, mirroring the identical helper in
// `archive-ui-shared-primitives.test.tsx`.
function elementProps(element: unknown): Record<string, any> {
  if (element === null || element === undefined) {
    throw new Error("expected a non-null element");
  }
  return (element as { props: unknown }).props as Record<string, any>;
}

function childArray(props: Record<string, any>): any[] {
  const children = props.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? children : [children];
}

// `ArchiveRootScreen.render()` returns a tree containing UNEVALUATED
// elements for the TASK-03 shared sub-components it composes
// (`<ArchiveUiStatePresentation .../>`, `<ArchiveUiFeedbackBanner .../>`) —
// `element.type` for those is the actual function, not yet invoked, exactly
// like `<ArchiveRootScreen bridge={...} />` itself is unevaluated until a
// renderer (or this harness) calls it. Since every one of those
// sub-components is a plain, hook-free function (proven by
// `archive-ui-shared-primitives.test.tsx`), this recursively expands any
// function-typed element by calling it directly — the exact same "invoke as
// a plain function" discipline every other TASK-03 test file already uses —
// so this file can inspect the REAL fully-resolved output tree
// `ArchiveRootScreen` produces, not merely the outermost unexpanded shell.
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

// Depth-first collection of every rendered text-node string in an ALREADY
// fully-expanded (`expandElementTree`) element tree (ignores prop/attribute
// values, e.g. `data-*` ids, which are NOT "rendered copy") — used to prove
// raw ids/backend messages never surface as visible text.
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

// See `root-screen.tsx`'s file-top HOOK-CALL CONSTRAINT note: outside a real
// renderer, `Component.prototype.updater` defaults to a no-op stub that
// WARNS and silently discards every `setState` call (verified directly
// against the installed `react@19.2.7` before writing this harness — a raw
// `new Foo(props)` instance's `setState` call left `instance.state`
// unchanged). Assigning a minimal SYNCHRONOUS updater here implements
// exactly the same `Updater` contract `react-dom` itself supplies when
// actually mounting — nothing more, no new dependency, no parallel
// rendering system — so this file can invoke `ArchiveRootScreen`'s REAL
// `componentDidMount`/`setState`-driven methods/`render()` directly and
// observe their real effect on `instance.state`.
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

function fakeSubmitEvent(): FormEvent<HTMLFormElement> {
  return { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
}

// ---------------------------------------------------------------------------
// 1. Pure controller logic — `archiveUiLoadRootScreenData`.
// ---------------------------------------------------------------------------

describe("archiveUiLoadRootScreenData", () => {
  it("ready: both root reads succeed with a non-empty folder list", async () => {
    const folder = fixtureFolder();
    const capabilitiesArgs: unknown[] = [];
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([folder]),
        getEffectiveCapabilities: async (context, target) => {
          capabilitiesArgs.push({ context, target });
          return okResult(allowCapability("create"));
        },
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);

    expect(result.viewState).toEqual({ status: "ready", data: [folder] });
    expect(result.createCapability).toEqual({
      presentation: "enabled",
      hidden: false,
      disabled: false,
      allowed: true,
    });
    // Exact namespace capability request (card scope item 3/§13).
    expect(capabilitiesArgs).toEqual([
      { context: fixtureContext, target: { targetType: "namespace", targetId: "tenant-1" } },
    ]);
  });

  it("empty: root folders resolve to an empty list", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);
    expect(result.viewState).toEqual({ status: "empty" });
  });

  it("denied: an unauthorized listRootFolders result becomes the calm denied state, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => errResult("unauthorized", "raw backend reason RAW-1"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);
    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-1");
    }
    expect(result.createCapability.allowed).toBe(false);
    expect(result.createCapability.presentation).toBe("disabled");
  });

  it("denied: an unauthorized getEffectiveCapabilities result ALSO becomes the calm denied state (either required root read)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([fixtureFolder()]),
        getEffectiveCapabilities: async () =>
          errResult("unauthorized", "raw backend reason RAW-2"),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);
    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-2");
    }
  });

  it("non-unauthorized failure routes through bridge.translateError, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => errResult("server_error", "raw backend reason RAW-3"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);
    expect(result.viewState.status).toBe("error");
    if (result.viewState.status === "error") {
      expect(result.viewState.presentation.title).toBe("Something went wrong");
      expect(JSON.stringify(result.viewState.presentation)).not.toContain("RAW-3");
    }
  });

  // TASK-04 REPAIR-R1: mixed-error precedence. `unauthorized` from EITHER
  // required root read must deterministically win over a non-unauthorized
  // failure from the OTHER read, regardless of which read is checked first
  // internally. Both orders are covered below, each asserting translated
  // (safe) copy — not merely the `status` discriminator — and that the RAW
  // backend messages of BOTH failing reads are absent from the presentation.

  it("mixed order 1: folders=server_error + capabilities=unauthorized => denied with safe translated copy (both raw messages absent)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () =>
          errResult("server_error", "raw backend reason RAW-FOLDERS-SERVER"),
        getEffectiveCapabilities: async () =>
          errResult("unauthorized", "raw backend reason RAW-CAPS-UNAUTH"),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);

    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      expect(result.viewState.presentation.description).toBe(
        "Please try again or contact support if this continues.",
      );
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-FOLDERS-SERVER");
      expect(serialized).not.toContain("RAW-CAPS-UNAUTH");
    }
    expect(result.createCapability.allowed).toBe(false);
    expect(result.createCapability.presentation).toBe("disabled");
  });

  it("mixed order 2: folders=unauthorized + capabilities=server_error => denied with safe translated copy (both raw messages absent)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () =>
          errResult("unauthorized", "raw backend reason RAW-FOLDERS-UNAUTH"),
        getEffectiveCapabilities: async () =>
          errResult("server_error", "raw backend reason RAW-CAPS-SERVER"),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);

    expect(result.viewState.status).toBe("denied");
    if (result.viewState.status === "denied") {
      expect(result.viewState.presentation.title).toBe("Access denied");
      expect(result.viewState.presentation.description).toBe(
        "Please try again or contact support if this continues.",
      );
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-FOLDERS-UNAUTH");
      expect(serialized).not.toContain("RAW-CAPS-SERVER");
    }
    expect(result.createCapability.allowed).toBe(false);
    expect(result.createCapability.presentation).toBe("disabled");
  });

  it("mixed order 3: folders=validation + capabilities=server_error (neither unauthorized) => error, deterministically selected from the folder read, with safe translated copy (both raw messages absent)", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () =>
          errResult("validation", "raw backend reason RAW-FOLDERS-VALIDATION"),
        getEffectiveCapabilities: async () =>
          errResult("server_error", "raw backend reason RAW-CAPS-SERVER-2"),
      },
    });

    const result = await archiveUiLoadRootScreenData(bridge);

    expect(result.viewState.status).toBe("error");
    if (result.viewState.status === "error") {
      // Selected from the FOLDER read's category ("validation"), not the
      // capabilities read's category ("server_error") — the documented
      // deterministic folder-read-first choice for the non-unauthorized
      // both-fail case.
      expect(result.viewState.presentation.title).toBe("Check your input");
      expect(result.viewState.presentation.description).toBe(
        "Please try again or contact support if this continues.",
      );
      const serialized = JSON.stringify(result.viewState.presentation);
      expect(serialized).not.toContain("RAW-FOLDERS-VALIDATION");
      expect(serialized).not.toContain("RAW-CAPS-SERVER-2");
    }
    expect(result.createCapability.allowed).toBe(false);
    expect(result.createCapability.presentation).toBe("disabled");
  });
});

// ---------------------------------------------------------------------------
// 2. Pure controller logic — validation + create submission.
// ---------------------------------------------------------------------------

describe("archiveUiValidateRootFolderName / archiveUiSubmitCreateRootFolder", () => {
  it("a trimmed-empty (including whitespace-only) name yields a field-level error", () => {
    expect(archiveUiValidateRootFolderName("")).toEqual({
      name: ["Enter a folder name."],
    });
    expect(archiveUiValidateRootFolderName("   ")).toEqual({
      name: ["Enter a folder name."],
    });
  });

  it("a non-blank name yields no field error", () => {
    expect(archiveUiValidateRootFolderName("Q3 Reports")).toEqual({});
  });

  it("trimmed-empty name: archiveUiSubmitCreateRootFolder returns a validation outcome and NEVER calls createFolder", async () => {
    const createFolderSpy = vi.fn();
    const bridge = createFakeBridge({ serviceOverrides: { createFolder: createFolderSpy } });

    const outcome = await archiveUiSubmitCreateRootFolder(bridge, fixtureContext, {
      name: "   ",
      description: "",
    });

    expect(outcome).toEqual({
      kind: "validation",
      fieldErrors: { name: ["Enter a folder name."] },
    });
    expect(createFolderSpy).not.toHaveBeenCalled();
  });

  it("valid submit calls createFolder with parentFolderId: null, trimmed name, and a null (not empty-string) description", async () => {
    const createFolderSpy = vi.fn(
      async (_context: ArchiveContextInput, input: unknown) =>
        okResult(fixtureFolder({ id: "folder-new", name: "Q3 Reports" })),
    );
    const bridge = createFakeBridge({ serviceOverrides: { createFolder: createFolderSpy } });

    const outcome = await archiveUiSubmitCreateRootFolder(bridge, fixtureContext, {
      name: "  Q3 Reports  ",
      description: "   ",
    });

    expect(createFolderSpy).toHaveBeenCalledTimes(1);
    expect(createFolderSpy).toHaveBeenCalledWith(fixtureContext, {
      name: "Q3 Reports",
      description: null,
      parentFolderId: null,
    });
    expect(outcome.kind).toBe("success");
  });

  it("a small justified description is trimmed and passed through", async () => {
    const createFolderSpy = vi.fn(async () => okResult(fixtureFolder()));
    const bridge = createFakeBridge({ serviceOverrides: { createFolder: createFolderSpy } });

    await archiveUiSubmitCreateRootFolder(bridge, fixtureContext, {
      name: "Q3 Reports",
      description: "  Quarterly filings  ",
    });

    expect(createFolderSpy).toHaveBeenCalledWith(fixtureContext, {
      name: "Q3 Reports",
      description: "Quarterly filings",
      parentFolderId: null,
    });
  });

  it("a failed createFolder call yields a safe translated failure, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        createFolder: async () => errResult("validation", "raw backend reason RAW-4"),
      },
    });

    const outcome = await archiveUiSubmitCreateRootFolder(bridge, fixtureContext, {
      name: "Q3 Reports",
      description: "",
    });

    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.presentation.title).toBe("Check your input");
      expect(JSON.stringify(outcome.presentation)).not.toContain("RAW-4");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Pure controller logic — deterministic visible-list update.
// ---------------------------------------------------------------------------

describe("archiveUiApplyCreatedRootFolder", () => {
  it("appends the created folder onto an existing ready list", () => {
    const existing = fixtureFolder({ id: "folder-1" });
    const created = fixtureFolder({ id: "folder-2", name: "New folder" });
    const next = archiveUiApplyCreatedRootFolder(archiveUiViewStateReady([existing]), created);
    expect(next).toEqual({ status: "ready", data: [existing, created] });
  });

  it("converts an empty state into ready with only the newly created folder", () => {
    const created = fixtureFolder({ id: "folder-2", name: "New folder" });
    const next = archiveUiApplyCreatedRootFolder(archiveUiViewStateEmpty(), created);
    expect(next).toEqual({ status: "ready", data: [created] });
  });
});

// ---------------------------------------------------------------------------
// 4. The actual mountable `ArchiveRootScreen` class component — real
//    `componentDidMount`/`setState`/`render()` wiring, not detached helpers.
// ---------------------------------------------------------------------------

describe("ArchiveRootScreen (the actual mountable screen)", () => {
  it("initial render (before load resolves) shows the loading state and no create form yet", () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);

    const tree = expandElementTree(instance.render());
    const sectionProps = elementProps(tree);
    expect(sectionProps["data-archive-ui-screen"]).toBe("root");
    const children = childArray(sectionProps);
    // heading, feedback banner (null while idle), no create form yet
    // (root not loaded), the state presentation (loading).
    const forms = children.filter((child) => child?.type === "form");
    expect(forms).toEqual([]);
    const stateElement = children[children.length - 1];
    expect(elementProps(stateElement)["data-archive-ui-state"]).toBe("loading");
  });

  it("componentDidMount wires to the real load method", () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    const loadSpy = vi.spyOn(instance, "loadRootScreen").mockResolvedValue(undefined);

    instance.componentDidMount();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    loadSpy.mockRestore();
  });

  it("after a real load: ready state renders folders as human-readable list items with no internal id in rendered copy, and selecting one calls bridge.navigate with the exact folder intent and nothing else", async () => {
    const folder = fixtureFolder({
      id: "folder-secret-id-999",
      name: "Q3 Reports",
      description: "Quarterly filings",
    });
    const navigateCalls: ArchiveUiNavigationIntent[] = [];
    const bridge = createFakeBridge({
      navigate: (intent) => navigateCalls.push(intent),
      serviceOverrides: {
        listRootFolders: async () => okResult([folder]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);

    await instance.loadRootScreen();

    const tree = expandElementTree(instance.render());
    const children = childArray(elementProps(tree));
    const stateElement = children[children.length - 1];
    const renderedText = collectRenderedText(stateElement).join(" | ");
    expect(renderedText).toContain("Q3 Reports");
    expect(renderedText).toContain("Quarterly filings");
    expect(renderedText).not.toContain("folder-secret-id-999");
    expect(renderedText).not.toContain(fixtureContext.tenantId);
    expect(renderedText).not.toContain(fixtureContext.companyId);
    expect(renderedText).not.toContain(fixtureContext.userId);

    // Find the folder's clickable button by its data-* id hook (a data
    // attribute, not rendered copy) and invoke its onClick exactly like a
    // real click would.
    const readyElement = stateElement as ReactElement;
    const listElement = elementProps(readyElement) as Record<string, any>;
    // The state-presentation component renders <ul><li><button/></li></ul>
    // via `renderReady` — walk down to find the button.
    function findButtonById(node: unknown): any {
      if (node === null || node === undefined) return undefined;
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findButtonById(child);
          if (found !== undefined) return found;
        }
        return undefined;
      }
      if (typeof node === "object" && "props" in (node as any)) {
        const props = (node as any).props ?? {};
        if (props["data-archive-ui-folder-id"] === folder.id) return node;
        return findButtonById(props.children);
      }
      return undefined;
    }
    const button = findButtonById(stateElement);
    expect(button).toBeDefined();
    elementProps(button).onClick();

    expect(navigateCalls).toEqual([{ screen: "folder", folderId: folder.id }]);
    // No URL/router contract: the navigation intent carries only screen/
    // folderId, nothing resembling a path/URL.
    expect(Object.keys(navigateCalls[0]!).sort()).toEqual(["folderId", "screen"]);
  });

  it("empty state stays useful: the create action is still presented when allowed", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();

    const tree = expandElementTree(instance.render());
    const children = childArray(elementProps(tree));
    const forms = children.filter((child) => child?.type === "form");
    expect(forms).toHaveLength(1);
    const stateElement = children[children.length - 1];
    expect(elementProps(stateElement)["data-archive-ui-state"]).toBe("empty");
  });

  it("denied (unauthorized): the screen shows the calm denied state and the create form is not presented", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => errResult("unauthorized", "raw backend reason RAW-5"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();

    const tree = expandElementTree(instance.render());
    const renderedText = collectRenderedText(tree).join(" | ");
    expect(renderedText).not.toContain("RAW-5");
    const children = childArray(elementProps(tree));
    const forms = children.filter((child) => child?.type === "form");
    expect(forms).toEqual([]);
    const stateElement = children[children.length - 1];
    expect(elementProps(stateElement)["data-archive-ui-state"]).toBe("denied");
  });

  it("non-unauthorized error: the screen shows the calm error state via the translator, never the raw message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => errResult("server_error", "raw backend reason RAW-6"),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();

    const tree = expandElementTree(instance.render());
    const renderedText = collectRenderedText(tree).join(" | ");
    expect(renderedText).not.toContain("RAW-6");
    const children = childArray(elementProps(tree));
    const stateElement = children[children.length - 1];
    expect(elementProps(stateElement)["data-archive-ui-state"]).toBe("error");
  });

  it("denied create capability is never presented as enabled; an allowed create capability is usable", async () => {
    const deniedBridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([fixtureFolder()]),
        getEffectiveCapabilities: async () => okResult(denyAllCapabilities()),
      },
    });
    const deniedInstance = new ArchiveRootScreen({ bridge: deniedBridge });
    attachSyncUpdater(deniedInstance);
    await deniedInstance.loadRootScreen();
    const deniedChildren = childArray(elementProps(deniedInstance.render()));
    const deniedForm = deniedChildren.find((child) => child?.type === "form");
    expect(deniedForm).toBeDefined();
    const deniedButton = childArray(elementProps(deniedForm)).find(
      (child) => child?.type === "button",
    );
    expect(elementProps(deniedButton).disabled).toBe(true);

    const allowedBridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([fixtureFolder()]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
      },
    });
    const allowedInstance = new ArchiveRootScreen({ bridge: allowedBridge });
    attachSyncUpdater(allowedInstance);
    await allowedInstance.loadRootScreen();
    const allowedChildren = childArray(elementProps(allowedInstance.render()));
    const allowedForm = allowedChildren.find((child) => child?.type === "form");
    const allowedButton = childArray(elementProps(allowedForm)).find(
      (child) => child?.type === "button",
    );
    expect(elementProps(allowedButton).disabled).toBe(false);
  });

  it("handleNameChange/handleDescriptionChange update the live field state", () => {
    const bridge = createFakeBridge();
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);

    instance.handleNameChange(fakeChangeEvent("Q3 Reports"));
    instance.handleDescriptionChange(fakeChangeEvent("Quarterly filings"));

    expect(instance.state.nameField).toBe("Q3 Reports");
    expect(instance.state.descriptionField).toBe("Quarterly filings");
  });

  it("submit with a trimmed-empty name sets a field error and never calls createFolder", async () => {
    const createFolderSpy = vi.fn();
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
        createFolder: createFolderSpy,
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();
    instance.handleNameChange(fakeChangeEvent("   "));

    await instance.handleSubmit(fakeSubmitEvent());

    expect(createFolderSpy).not.toHaveBeenCalled();
    expect(instance.state.fieldErrors).toEqual({ name: ["Enter a folder name."] });
  });

  it("a successful submit uses parentFolderId: null, shows success feedback, and updates the visible list", async () => {
    const created = fixtureFolder({ id: "folder-new", name: "Q3 Reports" });
    const createFolderSpy = vi.fn(async () => okResult(created));
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
        createFolder: createFolderSpy,
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();
    instance.handleNameChange(fakeChangeEvent("  Q3 Reports  "));

    await instance.handleSubmit(fakeSubmitEvent());

    expect(createFolderSpy).toHaveBeenCalledWith(fixtureContext, {
      name: "Q3 Reports",
      description: null,
      parentFolderId: null,
    });
    expect(instance.state.viewState).toEqual({ status: "ready", data: [created] });
    expect(instance.state.feedback).toEqual({
      kind: "visible",
      feedback: { intent: "success", title: "Folder created", description: "Q3 Reports" },
    });
    expect(instance.state.nameField).toBe("");
    expect(instance.state.submitting).toBe(false);
  });

  it("a failed submit shows safe failure feedback, never the raw backend message", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
        createFolder: async () => errResult("validation", "raw backend reason RAW-7"),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();
    instance.handleNameChange(fakeChangeEvent("Q3 Reports"));

    await instance.handleSubmit(fakeSubmitEvent());

    expect(instance.state.feedback.kind).toBe("visible");
    expect(JSON.stringify(instance.state.feedback)).not.toContain("RAW-7");
    expect(instance.state.submitting).toBe(false);
  });

  it("handleDismissFeedback returns feedback to idle", () => {
    const bridge = createFakeBridge();
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    instance.setState({
      feedback: { kind: "visible", feedback: { intent: "success", title: "Done" } },
    } as never);

    instance.handleDismissFeedback();

    expect(instance.state.feedback).toEqual({ kind: "idle" });
  });

  it("structural responsive-layout and approved-token usage is present in the rendered tree", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        listRootFolders: async () => okResult([fixtureFolder()]),
        getEffectiveCapabilities: async () => okResult(allowCapability("create")),
      },
    });
    const instance = new ArchiveRootScreen({ bridge });
    attachSyncUpdater(instance);
    await instance.loadRootScreen();

    const tree = expandElementTree(instance.render());
    const sectionStyle = elementProps(tree).style;
    expect(sectionStyle.backgroundColor).toBe("var(--color-bg)");
    expect(sectionStyle.color).toBe("var(--color-text)");
    expect(sectionStyle.fontFamily).toBe("var(--font-sans)");

    const children = childArray(elementProps(tree));
    const stateElement = children[children.length - 1];

    function findGridStyle(node: unknown): any {
      if (node === null || node === undefined) return undefined;
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findGridStyle(child);
          if (found !== undefined) return found;
        }
        return undefined;
      }
      if (typeof node === "object" && "props" in (node as any)) {
        const props = (node as any).props ?? {};
        if (typeof props.style?.gridTemplateColumns === "string") return props.style;
        return findGridStyle(props.children);
      }
      return undefined;
    }
    const gridStyle = findGridStyle(stateElement);
    expect(gridStyle).toBeDefined();
    expect(gridStyle.gridTemplateColumns).toContain("auto-fit");
    expect(gridStyle.gridTemplateColumns).toContain("minmax(");
    expect(gridStyle.gap).toBe("var(--space-4)");
  });

  it("no Shell/Next.js/router/Prisma/internal-Archive import exists in the root-screen production source", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(new URL("../root-screen.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    // Strip comments first — this file's own doc comments legitimately
    // NAME forbidden specifiers in prose (explaining why they are NOT used),
    // so only actual code (import statements, runtime usage) is scanned.
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
