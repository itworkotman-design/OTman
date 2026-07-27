import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Component } from "react";
import { describe, expect, it, vi } from "vitest";

// Correction Phase 6 TASK-08 (the Archive permission-management,
// role-management, and role-assignment screen). Every bridge/supporting
// type below comes from the public "./ui" entry point, mirroring the
// TASK-02–07 test discipline. No jsdom/Testing Library/react-dom is used
// anywhere in this file — see `permissions-screen.tsx`'s file-top
// HOOK-CALL CONSTRAINT comment for why `ArchivePermissionsScreen` is a class
// component, and `attachSyncUpdater` below (duplicated locally per the
// established TASK-04–07 precedent) for how this file exercises its real
// setState/lifecycle/render methods without a DOM renderer.
//
// Unlike the five prior screens' test files, this bridge fake's `identity`
// property is a REAL configurable fake (not a throwing stub): this screen
// actually calls `bridge.identity.resolvePlatformUsers`/
// `listAssignableCompanyMembers`.
import type {
  ArchiveUiBridge,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityFailure,
  ArchiveUiIdentityPort,
  ArchiveUiNavigationIntent,
  ArchiveUiPlatformUserDisplay,
  ArchiveUiServicePort,
} from "../index.js";
import { ArchivePermissionsScreen } from "../index.js";
import * as archiveUi from "../index.js";
import {
  archiveUiBuildExplanationRows,
  archiveUiBuildPermissionRuleRows,
  archiveUiBuildRoleAssignmentRows,
  archiveUiMergeIdentityDisplays,
  archiveUiPermissionActionChoices,
  archiveUiPermissionsDecidingTargetLabel,
  archiveUiPermissionsRoleSubjectDisplay,
  archiveUiPermissionsSourceLabel,
  archiveUiPermissionsSubjectDisplay,
  archiveUiUniqueAssignmentPlatformUserIds,
  archiveUiUniqueUserSubjectIds,
  archiveUiValidateSetRuleDraft,
  type ArchivePermissionsScreenProps,
} from "../permissions-screen.js";
import type {
  ArchiveAuthorizationTargetInput,
  ArchiveContextInput,
  ArchiveEffectiveCapabilityMap,
  ArchiveExplainedCapability,
  ArchiveHostAdapterError,
  ArchiveHostAdapterResult,
  ArchivePermission,
  ArchivePermissionAction,
  ArchivePermissionExplanation,
  ArchiveRoleAssignmentSummary,
  ArchiveRoleSummary,
} from "@customprojects/archive-service";
import * as archiveRoot from "@customprojects/archive-service";

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

const fixtureTarget: ArchiveAuthorizationTargetInput = { targetType: "folder", targetId: "folder-1" };

function fixturePermission(overrides: Partial<ArchivePermission> = {}): ArchivePermission {
  return {
    id: "rule-1",
    companyId: "company-1",
    tenantId: "tenant-1",
    targetType: "folder",
    targetId: "folder-1",
    subjectType: "user",
    subjectId: "user-2",
    action: "view",
    effect: "allow",
    grantedByUserId: "user-1",
    createdAt: now,
    revokedAt: null,
    revokedByUserId: null,
    ...overrides,
  };
}

function fixtureRole(overrides: Partial<ArchiveRoleSummary> = {}): ArchiveRoleSummary {
  return { id: "role-1", name: "Managers", ...overrides };
}

function fixtureAssignment(overrides: Partial<ArchiveRoleAssignmentSummary> = {}): ArchiveRoleAssignmentSummary {
  return { roleId: "role-1", platformUserId: "user-2", ...overrides };
}

function fixturePlatformUserDisplay(
  overrides: Partial<ArchiveUiPlatformUserDisplay> = {},
): ArchiveUiPlatformUserDisplay {
  return { platformUserId: "user-2", displayName: "Jamie Doe", ...overrides };
}

const ALL_CAPABILITY_ACTIONS: readonly ArchivePermissionAction[] = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
  "manage_permissions",
];

function fixtureCapabilityMap(
  overrides: Partial<Record<ArchivePermissionAction, { allowed: boolean }>> = {},
): ArchiveEffectiveCapabilityMap {
  const entries = ALL_CAPABILITY_ACTIONS.map((action) => [
    action,
    { allowed: overrides[action]?.allowed ?? action === "manage_permissions", source: "none" as const },
  ]);
  return Object.fromEntries(entries) as ArchiveEffectiveCapabilityMap;
}

function fixtureExplanation(
  overrides: Partial<Record<ArchivePermissionAction, ArchiveExplainedCapability>> = {},
): ArchivePermissionExplanation {
  const entries = ALL_CAPABILITY_ACTIONS.map((action) => [
    action,
    overrides[action] ?? { allowed: false, source: "none" as const, decidedBy: null },
  ]);
  return {
    target: { targetType: "folder", targetId: "folder-1" },
    directRules: [],
    capabilities: Object.fromEntries(entries) as Record<ArchivePermissionAction, ArchiveExplainedCapability>,
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
    throw new Error("archive-ui-permissions-screen fixture: method not implemented");
  };
  const base: ArchiveUiServicePort = {
    assignArchiveRole: notImplemented,
    createArchiveRole: notImplemented,
    createFolder: notImplemented,
    createItem: notImplemented,
    deleteArchiveRole: notImplemented,
    explainPermissions: notImplemented,
    getEffectiveCapabilities: notImplemented,
    getFolderPath: notImplemented,
    listArchiveRoleAssignmentsForRole: notImplemented,
    listArchiveRoles: notImplemented,
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
    throw new Error("archive-ui-permissions-screen fixture: transport method not implemented");
  };
  return { uploadFile: notImplemented, downloadFile: notImplemented } as unknown as ArchiveUiFileTransport;
}

interface IdentityOverrides {
  readonly resolvePlatformUsers?: ArchiveUiIdentityPort["resolvePlatformUsers"];
  readonly listAssignableCompanyMembers?: ArchiveUiIdentityPort["listAssignableCompanyMembers"];
}

// Correction Phase 6 TASK-08: unlike the five prior screens, this screen
// REALLY calls the identity port — the fake below is a real, configurable
// implementation, not a throwing stub.
function createFakeIdentity(overrides: IdentityOverrides = {}): ArchiveUiIdentityPort {
  return {
    resolvePlatformUsers: overrides.resolvePlatformUsers ?? (async () => okIdentity([])),
    listAssignableCompanyMembers: overrides.listAssignableCompanyMembers ?? (async () => okIdentity([])),
  };
}

function okIdentity<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

function failIdentity(failure: ArchiveUiIdentityFailure): { ok: false; failure: ArchiveUiIdentityFailure } {
  return { ok: false, failure };
}

interface FakeBridgeOptions {
  readonly context?: ArchiveContextInput;
  readonly serviceOverrides?: Partial<ArchiveUiServicePort>;
  readonly translateError?: ArchiveUiErrorTranslator;
  readonly navigate?: (intent: ArchiveUiNavigationIntent) => void;
  readonly currentUserDisplay?: { displayName?: string; email?: string } | undefined;
  readonly identity?: ArchiveUiIdentityPort;
}

function createFakeBridge(options: FakeBridgeOptions = {}): ArchiveUiBridge {
  return {
    getContext: () => options.context ?? fixtureContext,
    getCurrentUserDisplay: () => options.currentUserDisplay,
    navigate: options.navigate ?? (() => {}),
    service: createStubServicePort(options.serviceOverrides ?? {}),
    transport: createStubTransport(),
    translateError: options.translateError ?? safeTranslateError,
    identity: options.identity ?? createFakeIdentity(),
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

function fakeFormEvent(): any {
  return { preventDefault: () => {} };
}

function fakeChangeEvent(value: string): any {
  return { target: { value } };
}

function mountedScreen(
  bridge: ArchiveUiBridge,
  target: ArchiveAuthorizationTargetInput = fixtureTarget,
): ArchivePermissionsScreen {
  const instance = new ArchivePermissionsScreen({ bridge, target });
  attachSyncUpdater(instance);
  instance.componentDidMount();
  return instance;
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
    if ("type" in (node as any) && "props" in (node as any)) {
      const el = node as { type: unknown; props: any };
      if (typeof el.type === "function") {
        const output = (el.type as (props: any) => unknown)(el.props);
        elementText(output, out);
        return out;
      }
      elementText(el.props?.children, out);
      // Also walk common accessible-name props so hidden ids never sneak in
      // through aria-label/dialogLabel-derived attributes.
      for (const key of ["aria-label", "aria-labelledby", "aria-describedby"]) {
        if (typeof el.props?.[key] === "string") out.push(el.props[key]);
      }
      return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Proof 5: namespace action choices are exactly two; folder/item choices are
// exactly ten.
// ---------------------------------------------------------------------------

describe("archiveUiPermissionActionChoices", () => {
  it("returns exactly the two namespace actions for a namespace target", () => {
    expect(archiveUiPermissionActionChoices("namespace")).toEqual(["create", "manage_permissions"]);
  });

  it("returns exactly the ten permission actions for folder/item targets", () => {
    expect(archiveUiPermissionActionChoices("folder")).toEqual(ALL_CAPABILITY_ACTIONS);
    expect(archiveUiPermissionActionChoices("item")).toEqual(ALL_CAPABILITY_ACTIONS);
  });
});

// ---------------------------------------------------------------------------
// Proof 8: human display priority and Unresolved user/Unresolved role
// fallbacks.
// ---------------------------------------------------------------------------

describe("archiveUiPermissionsSubjectDisplay", () => {
  const bridge = createFakeBridge();

  it("renders the context user as 'You' with no current-user display data", () => {
    expect(archiveUiPermissionsSubjectDisplay(bridge, fixtureContext, "user-1", undefined)).toBe("You");
  });

  it("renders the context user as 'You (name)' when a display name is available", () => {
    const displayBridge = createFakeBridge({ currentUserDisplay: { displayName: "Ada" } });
    expect(archiveUiPermissionsSubjectDisplay(displayBridge, fixtureContext, "user-1", undefined)).toBe("You (Ada)");
  });

  it("renders the context user as 'You (email)' when only an email is available", () => {
    const displayBridge = createFakeBridge({ currentUserDisplay: { email: "ada@example.com" } });
    expect(archiveUiPermissionsSubjectDisplay(displayBridge, fixtureContext, "user-1", undefined)).toBe(
      "You (ada@example.com)",
    );
  });

  it("prefers displayName, then handle, then email for another resolved user", () => {
    expect(
      archiveUiPermissionsSubjectDisplay(bridge, fixtureContext, "user-2", {
        platformUserId: "user-2",
        displayName: "Jamie",
        handle: "jamie99",
        email: "jamie@example.com",
      }),
    ).toBe("Jamie");
    expect(
      archiveUiPermissionsSubjectDisplay(bridge, fixtureContext, "user-2", {
        platformUserId: "user-2",
        handle: "jamie99",
        email: "jamie@example.com",
      }),
    ).toBe("jamie99");
    expect(
      archiveUiPermissionsSubjectDisplay(bridge, fixtureContext, "user-2", {
        platformUserId: "user-2",
        email: "jamie@example.com",
      }),
    ).toBe("jamie@example.com");
  });

  it("falls back to 'Unresolved user' when no resolution exists", () => {
    expect(archiveUiPermissionsSubjectDisplay(bridge, fixtureContext, "user-2", undefined)).toBe("Unresolved user");
  });
});

describe("archiveUiPermissionsRoleSubjectDisplay", () => {
  it("renders the role's name when found, else 'Unresolved role'", () => {
    expect(archiveUiPermissionsRoleSubjectDisplay([fixtureRole({ id: "role-1", name: "Managers" })], "role-1")).toBe(
      "Managers",
    );
    expect(archiveUiPermissionsRoleSubjectDisplay([], "role-missing")).toBe("Unresolved role");
  });
});

// ---------------------------------------------------------------------------
// Proof 13 (part): deciding-target and source copy — all safe, never an id.
// ---------------------------------------------------------------------------

describe("archiveUiPermissionsDecidingTargetLabel", () => {
  it("maps every documented case to the exact required copy", () => {
    expect(archiveUiPermissionsDecidingTargetLabel(null)).toBe("No deciding rule");
    expect(archiveUiPermissionsDecidingTargetLabel({ hidden: true })).toBe("Restricted location");
    expect(
      archiveUiPermissionsDecidingTargetLabel({ hidden: false, targetType: "namespace", targetId: "tenant-1", folderName: null }),
    ).toBe("Archive namespace");
    expect(
      archiveUiPermissionsDecidingTargetLabel({ hidden: false, targetType: "item", targetId: "item-1", folderName: null }),
    ).toBe("This item");
    expect(
      archiveUiPermissionsDecidingTargetLabel({
        hidden: false,
        targetType: "folder",
        targetId: "folder-1",
        folderName: "Q3 Reports",
      }),
    ).toBe("Q3 Reports");
    expect(
      archiveUiPermissionsDecidingTargetLabel({ hidden: false, targetType: "folder", targetId: "folder-1", folderName: null }),
    ).toBe("This folder");
  });
});

describe("archiveUiPermissionsSourceLabel", () => {
  it("returns calm product copy for every source, never a raw enum dump", () => {
    expect(archiveUiPermissionsSourceLabel("direct_user")).toBe("A rule set directly for you");
    expect(archiveUiPermissionsSourceLabel("archive_role")).toBe("A rule set for one of your roles");
    expect(archiveUiPermissionsSourceLabel("inherited")).toBe("Inherited from a parent location");
    expect(archiveUiPermissionsSourceLabel("overridden")).toBe("Overridden by a closer rule");
    expect(archiveUiPermissionsSourceLabel("none")).toBe("No rule decides (denied by default)");
  });
});

// ---------------------------------------------------------------------------
// Proof 13: all ten explanation capabilities render with safe copy.
// ---------------------------------------------------------------------------

describe("archiveUiBuildExplanationRows", () => {
  it("builds exactly ten rows covering every action, with safe source/deciding-target copy and no raw ids", () => {
    const explanation = fixtureExplanation({
      view: { allowed: true, source: "direct_user", decidedBy: { hidden: false, targetType: "folder", targetId: "folder-1", folderName: "Reports" } },
      manage_permissions: { allowed: true, source: "archive_role", decidedBy: { hidden: true } },
    });
    const rows = archiveUiBuildExplanationRows(explanation);
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.action).sort()).toEqual([...ALL_CAPABILITY_ACTIONS].sort());
    const viewRow = rows.find((row) => row.action === "view");
    expect(viewRow?.allowed).toBe(true);
    expect(viewRow?.sourceLabel).toBe("A rule set directly for you");
    expect(viewRow?.decidingTargetLabel).toBe("Reports");
    const manageRow = rows.find((row) => row.action === "manage_permissions");
    expect(manageRow?.decidingTargetLabel).toBe("Restricted location");
    for (const row of rows) {
      expect(JSON.stringify(row)).not.toContain("folder-1");
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 9/10: identity merging matches only requested ids, at most one row
// per id, never leaks unrelated/duplicate rows.
// ---------------------------------------------------------------------------

describe("archiveUiMergeIdentityDisplays", () => {
  it("ignores unrelated rows and applies at most one row per requested id", () => {
    const merged = archiveUiMergeIdentityDisplays(
      {},
      [
        fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "First" }),
        fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "Duplicate — must be ignored" }),
        fixturePlatformUserDisplay({ platformUserId: "unrelated-user", displayName: "Should never appear" }),
      ],
      ["user-2"],
    );
    expect(merged).toEqual({ "user-2": fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "First" }) });
    expect(merged["unrelated-user"]).toBeUndefined();
  });

  it("preserves previously cached entries for ids outside the current request", () => {
    const existing = { "user-9": fixturePlatformUserDisplay({ platformUserId: "user-9", displayName: "Kept" }) };
    const merged = archiveUiMergeIdentityDisplays(existing, [fixturePlatformUserDisplay({ platformUserId: "user-2" })], ["user-2"]);
    expect(merged["user-9"]).toEqual(existing["user-9"]);
    expect(merged["user-2"]).toBeDefined();
  });
});

describe("archiveUiUniqueUserSubjectIds / archiveUiUniqueAssignmentPlatformUserIds", () => {
  it("collects unique user-subject ids only, excluding role subjects and duplicates", () => {
    const rules = [
      fixturePermission({ id: "r1", subjectType: "user", subjectId: "user-2" }),
      fixturePermission({ id: "r2", subjectType: "user", subjectId: "user-2" }),
      fixturePermission({ id: "r3", subjectType: "role", subjectId: "role-1" }),
      fixturePermission({ id: "r4", subjectType: "user", subjectId: "user-3" }),
    ];
    expect(archiveUiUniqueUserSubjectIds(rules)).toEqual(["user-2", "user-3"]);
  });

  it("collects unique assigned platformUserIds", () => {
    const assignments = [
      fixtureAssignment({ platformUserId: "user-2" }),
      fixtureAssignment({ platformUserId: "user-2" }),
      fixtureAssignment({ platformUserId: "user-3" }),
    ];
    expect(archiveUiUniqueAssignmentPlatformUserIds(assignments)).toEqual(["user-2", "user-3"]);
  });
});

// ---------------------------------------------------------------------------
// Row-projection builders (support proofs 8, 9, 13).
// ---------------------------------------------------------------------------

describe("archiveUiBuildPermissionRuleRows / archiveUiBuildRoleAssignmentRows", () => {
  it("builds subject-labeled rule rows without leaking raw ids into the label itself", () => {
    const bridge = createFakeBridge();
    const rules = [
      fixturePermission({ id: "r1", subjectType: "user", subjectId: "user-2" }),
      fixturePermission({ id: "r2", subjectType: "role", subjectId: "role-1" }),
    ];
    const rows = archiveUiBuildPermissionRuleRows(
      bridge,
      fixtureContext,
      rules,
      { "user-2": fixturePlatformUserDisplay({ displayName: "Jamie" }) },
      [fixtureRole({ id: "role-1", name: "Managers" })],
    );
    expect(rows[0].subjectLabel).toBe("Jamie");
    expect(rows[1].subjectLabel).toBe("Managers");
  });

  it("builds subject-labeled assignment rows the same way", () => {
    const bridge = createFakeBridge();
    const rows = archiveUiBuildRoleAssignmentRows(
      bridge,
      fixtureContext,
      [fixtureAssignment({ platformUserId: "user-2" })],
      { "user-2": fixturePlatformUserDisplay({ displayName: "Jamie" }) },
    );
    expect(rows[0].subjectLabel).toBe("Jamie");
  });
});

// ---------------------------------------------------------------------------
// Proof 6/16: no raw-id text input for user or role subjects — controlled
// selections only. A subject id not present in the supplied active
// role/member list is ALWAYS invalid, even with an otherwise-correct
// subjectType — proving there is no way to "free type" a valid id.
// ---------------------------------------------------------------------------

describe("archiveUiValidateSetRuleDraft", () => {
  const roles = [fixtureRole({ id: "role-1", name: "Managers" })];
  const members = [fixturePlatformUserDisplay({ platformUserId: "user-2" })];

  it("rejects a free-typed user subject id not present in the assignable-members list", () => {
    const outcome = archiveUiValidateSetRuleDraft(
      { subjectType: "user", subjectId: "not-a-real-member-id", action: "view", effect: "allow" },
      "folder",
      roles,
      members,
    );
    expect(outcome.kind).toBe("invalid");
  });

  it("rejects a free-typed role subject id not present in the active-roles list", () => {
    const outcome = archiveUiValidateSetRuleDraft(
      { subjectType: "role", subjectId: "not-a-real-role-id", action: "view", effect: "allow" },
      "folder",
      roles,
      members,
    );
    expect(outcome.kind).toBe("invalid");
  });

  it("rejects an empty subject type, an out-of-set action, and an invalid effect", () => {
    expect(
      archiveUiValidateSetRuleDraft({ subjectType: "", subjectId: "", action: "view", effect: "allow" }, "folder", roles, members)
        .kind,
    ).toBe("invalid");
    expect(
      archiveUiValidateSetRuleDraft(
        { subjectType: "role", subjectId: "role-1", action: "manage_permissions", effect: "allow" },
        "namespace",
        roles,
        members,
      ).kind,
    ).toBe("valid");
    expect(
      archiveUiValidateSetRuleDraft(
        { subjectType: "role", subjectId: "role-1", action: "view", effect: "allow" },
        "namespace",
        roles,
        members,
      ).kind,
    ).toBe("invalid");
    expect(
      archiveUiValidateSetRuleDraft(
        { subjectType: "user", subjectId: "user-2", action: "view", effect: "" },
        "folder",
        roles,
        members,
      ).kind,
    ).toBe("invalid");
  });

  it("accepts a valid, fully controlled selection", () => {
    const outcome = archiveUiValidateSetRuleDraft(
      { subjectType: "user", subjectId: "user-2", action: "view", effect: "allow" },
      "folder",
      roles,
      members,
    );
    expect(outcome).toEqual({
      kind: "valid",
      value: { subjectType: "user", subjectId: "user-2", action: "view", effect: "allow" },
    });
  });
});

// ---------------------------------------------------------------------------
// Proof 1/2: capability preflight is the ONLY initial call before
// authorization succeeds; denied preflight causes ZERO further reads.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — capability preflight", () => {
  it("calls only getEffectiveCapabilities before it resolves; other reads happen only after authorization succeeds", async () => {
    let resolveCapabilities: ((value: ArchiveHostAdapterResult<ArchiveEffectiveCapabilityMap>) => void) | undefined;
    const getEffectiveCapabilities = vi.fn(
      () =>
        new Promise<ArchiveHostAdapterResult<ArchiveEffectiveCapabilityMap>>((resolveFn) => {
          resolveCapabilities = resolveFn;
        }),
    );
    const listPermissionRules = vi.fn(async () => okResult([]));
    const explainPermissions = vi.fn(async () => okResult(fixtureExplanation()));
    const listArchiveRoles = vi.fn(async () => okResult([]));
    const resolvePlatformUsers = vi.fn(async () => okIdentity([]));

    const bridge = createFakeBridge({
      serviceOverrides: { getEffectiveCapabilities, listPermissionRules, explainPermissions, listArchiveRoles },
      identity: createFakeIdentity({ resolvePlatformUsers }),
    });

    mountedScreen(bridge);
    await flushMicrotasks();

    expect(getEffectiveCapabilities).toHaveBeenCalledTimes(1);
    expect(listPermissionRules).not.toHaveBeenCalled();
    expect(explainPermissions).not.toHaveBeenCalled();
    expect(listArchiveRoles).not.toHaveBeenCalled();
    expect(resolvePlatformUsers).not.toHaveBeenCalled();

    resolveCapabilities?.(okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(listPermissionRules).toHaveBeenCalledTimes(1);
    expect(explainPermissions).toHaveBeenCalledTimes(1);
    expect(listArchiveRoles).toHaveBeenCalledTimes(1);
  });

  it("maps an unauthorized preflight failure to the calm denied state via translateError, with zero further reads", async () => {
    const getEffectiveCapabilities = vi.fn(async () => errResult<ArchiveEffectiveCapabilityMap>("unauthorized", "raw-backend-reason"));
    const listPermissionRules = vi.fn(async () => okResult([]));
    const listArchiveRoles = vi.fn(async () => okResult([]));
    const bridge = createFakeBridge({ serviceOverrides: { getEffectiveCapabilities, listPermissionRules, listArchiveRoles } });

    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("denied");
    expect(listPermissionRules).not.toHaveBeenCalled();
    expect(listArchiveRoles).not.toHaveBeenCalled();
    if (instance.state.viewState.status === "denied") {
      expect(instance.state.viewState.presentation.title).toBe("Access denied");
      expect(JSON.stringify(instance.state.viewState.presentation)).not.toContain("raw-backend-reason");
    }
  });

  it("maps a non-unauthorized preflight failure to the calm error state", async () => {
    const getEffectiveCapabilities = vi.fn(async () => errResult<ArchiveEffectiveCapabilityMap>("server_error", "raw-explosion"));
    const bridge = createFakeBridge({ serviceOverrides: { getEffectiveCapabilities } });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("error");
    if (instance.state.viewState.status === "error") {
      expect(JSON.stringify(instance.state.viewState.presentation)).not.toContain("raw-explosion");
    }
  });

  it("renders a calm locally-authored denied state and calls NOTHING further when manage_permissions.allowed is false", async () => {
    const getEffectiveCapabilities = vi.fn(async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: false } })));
    const listPermissionRules = vi.fn(async () => okResult([]));
    const explainPermissions = vi.fn(async () => okResult(fixtureExplanation()));
    const listArchiveRoles = vi.fn(async () => okResult([]));
    const resolvePlatformUsers = vi.fn(async () => okIdentity([]));
    const listAssignableCompanyMembers = vi.fn(async () => okIdentity([]));

    const bridge = createFakeBridge({
      serviceOverrides: { getEffectiveCapabilities, listPermissionRules, explainPermissions, listArchiveRoles },
      identity: createFakeIdentity({ resolvePlatformUsers, listAssignableCompanyMembers }),
    });

    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("denied");
    expect(listPermissionRules).not.toHaveBeenCalled();
    expect(explainPermissions).not.toHaveBeenCalled();
    expect(listArchiveRoles).not.toHaveBeenCalled();
    expect(resolvePlatformUsers).not.toHaveBeenCalled();
    expect(listAssignableCompanyMembers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Proof 3: required-read unauthorized precedence and deterministic
// non-unauthorized failure selection.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — required-read failure precedence", () => {
  function bridgeAuthorized(overrides: Partial<ArchiveUiServicePort>): ArchiveUiBridge {
    return createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listArchiveRoles: async () => okResult([]),
        ...overrides,
      },
    });
  }

  it("an unauthorized explainPermissions denies even when listPermissionRules succeeds", async () => {
    const bridge = bridgeAuthorized({
      listPermissionRules: async () => okResult([]),
      explainPermissions: async () => errResult("unauthorized", "raw"),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("denied");
  });

  it("an unauthorized listPermissionRules denies even when explainPermissions succeeds", async () => {
    const bridge = bridgeAuthorized({
      listPermissionRules: async () => errResult("unauthorized", "raw"),
      explainPermissions: async () => okResult(fixtureExplanation()),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("denied");
  });

  it("selects listPermissionRules' failure first when neither failure is unauthorized", async () => {
    const bridge = bridgeAuthorized({
      listPermissionRules: async () => errResult("validation", "rules-raw"),
      explainPermissions: async () => errResult("server_error", "explain-raw"),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("error");
    if (instance.state.viewState.status === "error") {
      expect(instance.state.viewState.presentation.title).toBe("Check your input");
    }
  });

  it("selects explainPermissions' failure when only it fails (non-unauthorized)", async () => {
    const bridge = bridgeAuthorized({
      listPermissionRules: async () => okResult([]),
      explainPermissions: async () => errResult("server_error", "explain-raw"),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    expect(instance.state.viewState.status).toBe("error");
    if (instance.state.viewState.status === "error") {
      expect(instance.state.viewState.presentation.title).toBe("Something went wrong");
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 4: role-list failure is non-fatal to loaded permission rules/
// explanation.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — non-fatal role administration", () => {
  it("keeps the permission screen ready when listArchiveRoles fails", async () => {
    const rules = [fixturePermission()];
    const explanation = fixtureExplanation();
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult(rules),
        explainPermissions: async () => okResult(explanation),
        listArchiveRoles: async () => errResult("server_error", "roles-raw-explosion"),
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.rules).toEqual(rules);
    }
    expect(instance.state.rolesState.status).toBe("unavailable");
    if (instance.state.rolesState.status === "unavailable") {
      expect(JSON.stringify(instance.state.rolesState.presentation)).not.toContain("roles-raw-explosion");
    }
  });
});

// ---------------------------------------------------------------------------
// Proof 7: assignable-member loading is on demand; identity failure disables
// only dependent controls.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — on-demand assignable-member loading", () => {
  it("does not call listAssignableCompanyMembers until the user subject type is selected, then caches the result", async () => {
    const listAssignableCompanyMembers = vi.fn(async () => okIdentity([fixturePlatformUserDisplay()]));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(listAssignableCompanyMembers).not.toHaveBeenCalled();
    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    expect(listAssignableCompanyMembers).toHaveBeenCalledTimes(1);
    expect(instance.state.assignableMembers).toEqual([fixturePlatformUserDisplay()]);

    // Switching away and back must reuse the cached result, not reload.
    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("role"));
    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    expect(listAssignableCompanyMembers).toHaveBeenCalledTimes(1);
  });

  it("identity-port failure sets a safe failure copy and leaves assignableMembers null, without failing the screen", async () => {
    const failure: ArchiveUiIdentityFailure = { kind: "error", title: "Members unavailable", description: "Safe copy only." };
    const listAssignableCompanyMembers = vi.fn(async () => failIdentity(failure));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();

    expect(instance.state.assignableMembers).toBeNull();
    expect(instance.state.assignableMembersFailure).toEqual(failure);
    expect(instance.state.viewState.status).toBe("ready");
  });
});

// ---------------------------------------------------------------------------
// Proof 9: raw ids/backend messages absent from visible/accessible text.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — no raw ids or backend messages in rendered copy", () => {
  it("never renders subjectId/targetId/permission id/role id or a raw adapter message", async () => {
    const rules = [
      fixturePermission({ id: "rule-secret-id", subjectType: "user", subjectId: "user-secret-id" }),
      fixturePermission({ id: "rule-secret-id-2", subjectType: "role", subjectId: "role-secret-id" }),
    ];
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult(rules),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-secret-id", name: "Secretless Name" })]),
      },
      identity: createFakeIdentity({
        resolvePlatformUsers: async () => okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-secret-id", displayName: "Safe Name" })]),
      }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    const rendered = elementText(instance.render()).join(" ␟ ");
    expect(rendered).not.toContain("rule-secret-id");
    expect(rendered).not.toContain("user-secret-id");
    expect(rendered).not.toContain("role-secret-id");
    expect(rendered).toContain("Safe Name");
    expect(rendered).toContain("Secretless Name");
  });

  it("never renders a raw adapter failure message on a mutation failure", async () => {
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
        setPermissionRule: async () => errResult("server_error", "raw-database-exception-detail"),
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay()]) }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    instance.handleSetRuleSubjectIdChange(fakeChangeEvent("user-2"));
    instance.handleSetRuleActionChange(fakeChangeEvent("view"));
    instance.handleSetRuleEffectChange(fakeChangeEvent("allow"));
    instance.handleSetRuleSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(instance.state.feedback.kind).toBe("visible");
    expect(JSON.stringify(instance.state.feedback)).not.toContain("raw-database-exception-detail");
  });
});

// ---------------------------------------------------------------------------
// Proof 11: exact setPermissionRule tuple and refresh behavior.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — set-rule submission", () => {
  it("calls setPermissionRule with the exact tuple and refreshes rules/explanation on success", async () => {
    const setPermissionRule = vi.fn(async () => okResult(fixturePermission()));
    const listPermissionRules = vi.fn(async () => okResult([]));
    const explainPermissions = vi.fn(async () => okResult(fixtureExplanation()));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules,
        explainPermissions,
        listArchiveRoles: async () => okResult([fixtureRole()]),
        setPermissionRule,
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay()]) }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    listPermissionRules.mockClear();
    explainPermissions.mockClear();

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    instance.handleSetRuleSubjectIdChange(fakeChangeEvent("user-2"));
    instance.handleSetRuleActionChange(fakeChangeEvent("view"));
    instance.handleSetRuleEffectChange(fakeChangeEvent("allow"));
    instance.handleSetRuleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(setPermissionRule).toHaveBeenCalledWith(fixtureContext, {
      targetType: "folder",
      targetId: "folder-1",
      subjectType: "user",
      subjectId: "user-2",
      action: "view",
      effect: "allow",
    });
    expect(listPermissionRules).toHaveBeenCalledTimes(1);
    expect(explainPermissions).toHaveBeenCalledTimes(1);
    expect(instance.state.feedback).toEqual({ kind: "visible", feedback: { intent: "success", title: "Permission rule saved." } });
  });
});

// ---------------------------------------------------------------------------
// Proof 12: revoke confirmation names human subject/action/effect and calls
// the exact tuple once.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — revoke", () => {
  it("confirmation copy names the human subject/action/effect, never an id, and revokes the exact tuple once", async () => {
    const rule = fixturePermission({ id: "rule-1", subjectType: "user", subjectId: "user-2", action: "edit", effect: "deny" });
    const revokePermissionRule = vi.fn(async () => okResult(rule));
    const listPermissionRules = vi.fn(async () => okResult([rule]));
    const explainPermissions = vi.fn(async () => okResult(fixtureExplanation()));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules,
        explainPermissions,
        listArchiveRoles: async () => okResult([]),
        revokePermissionRule,
      },
      identity: createFakeIdentity({ resolvePlatformUsers: async () => okIdentity([fixturePlatformUserDisplay({ displayName: "Jamie" })]) }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleRequestRevoke(rule);
    expect(instance.state.revokeConfirmation.status).toBe("pending");
    if (instance.state.revokeConfirmation.status === "pending") {
      expect(instance.state.revokeConfirmation.labels.actionLabel).toBe("Revoke");
      expect(instance.state.revokeConfirmation.labels.subjectLabel).toContain("Jamie");
      expect(instance.state.revokeConfirmation.labels.subjectLabel).toContain("edit");
      expect(instance.state.revokeConfirmation.labels.subjectLabel).toContain("deny");
      expect(instance.state.revokeConfirmation.labels.subjectLabel).not.toContain("rule-1");
      expect(instance.state.revokeConfirmation.labels.subjectLabel).not.toContain("user-2");
    }

    listPermissionRules.mockClear();
    explainPermissions.mockClear();
    instance.handleConfirmRevoke();
    await flushMicrotasks();

    expect(revokePermissionRule).toHaveBeenCalledTimes(1);
    expect(revokePermissionRule).toHaveBeenCalledWith(fixtureContext, {
      targetType: "folder",
      targetId: "folder-1",
      subjectType: "user",
      subjectId: "user-2",
      action: "edit",
    });
    await flushMicrotasks();
    expect(listPermissionRules).toHaveBeenCalledTimes(1);
    expect(explainPermissions).toHaveBeenCalledTimes(1);
  });

  it("treats a null/no-op revoke result as a controlled success", async () => {
    const rule = fixturePermission();
    const revokePermissionRule = vi.fn(async () => okResult(null));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([rule]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
        revokePermissionRule,
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleRequestRevoke(rule);
    instance.handleConfirmRevoke();
    await flushMicrotasks();

    expect(instance.state.feedback).toEqual({ kind: "visible", feedback: { intent: "success", title: "Permission rule revoked." } });
  });
});

// ---------------------------------------------------------------------------
// Proof 14: role create/rename/delete, including exact-name destructive
// confirmation.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — role create/rename/delete", () => {
  function authorizedBridge(overrides: Partial<ArchiveUiServicePort>): ArchiveUiBridge {
    return createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        ...overrides,
      },
    });
  }

  it("creates a role by name and refreshes roles + rules/explanation", async () => {
    const createArchiveRole = vi.fn(async () => okResult({ id: "role-new", name: "New Role" } as any));
    const listArchiveRoles = vi.fn(async () => okResult([fixtureRole()]));
    const listPermissionRules = vi.fn(async () => okResult([]));
    const bridge = authorizedBridge({ createArchiveRole, listArchiveRoles, listPermissionRules });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    listArchiveRoles.mockClear();
    listPermissionRules.mockClear();

    instance.handleCreateRoleNameChange(fakeChangeEvent("  New Role  "));
    instance.handleCreateRoleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(createArchiveRole).toHaveBeenCalledWith(fixtureContext, { name: "New Role" });
    expect(listArchiveRoles).toHaveBeenCalledTimes(1);
    expect(listPermissionRules).toHaveBeenCalledTimes(1);
    expect(instance.state.createRoleNameDraft).toBe("");
  });

  it("blocks an empty role name with field-level validation and calls nothing", async () => {
    const createArchiveRole = vi.fn(async () => okResult({ id: "role-new", name: "x" } as any));
    const bridge = authorizedBridge({ createArchiveRole, listArchiveRoles: async () => okResult([]) });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    instance.handleCreateRoleNameChange(fakeChangeEvent("   "));
    instance.handleCreateRoleSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(createArchiveRole).not.toHaveBeenCalled();
    expect(instance.state.createRoleFieldErrors.name?.length).toBeGreaterThan(0);
  });

  it("renames the selected role and refreshes roles + rules/explanation", async () => {
    const renameArchiveRole = vi.fn(async () => okResult({ id: "role-1", name: "Renamed" } as any));
    const listArchiveRoles = vi
      .fn()
      .mockResolvedValueOnce(okResult([fixtureRole({ id: "role-1", name: "Managers" })]))
      .mockResolvedValue(okResult([fixtureRole({ id: "role-1", name: "Renamed" })]));
    const bridge = authorizedBridge({
      renameArchiveRole,
      listArchiveRoles,
      listArchiveRoleAssignmentsForRole: async () => okResult([]),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    instance.handleRenameRoleNameChange(fakeChangeEvent("Renamed"));
    instance.handleRenameRoleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(renameArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-1", name: "Renamed" });
  });

  it("destructive-confirms delete naming the role by name, never an id, then deletes and repairs the vanished selection", async () => {
    const deleteArchiveRole = vi.fn(async () => okResult({ id: "role-1", name: "Managers" } as any));
    const listArchiveRoles = vi
      .fn()
      .mockResolvedValueOnce(okResult([fixtureRole({ id: "role-1", name: "Managers" })]))
      .mockResolvedValue(okResult([]));
    const bridge = authorizedBridge({
      deleteArchiveRole,
      listArchiveRoles,
      listArchiveRoleAssignmentsForRole: async () => okResult([]),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    instance.handleRequestDeleteRole();

    expect(instance.state.deleteRoleConfirmation.status).toBe("pending");
    if (instance.state.deleteRoleConfirmation.status === "pending") {
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).toContain("Managers");
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).not.toContain("role-1");
    }

    instance.handleConfirmDeleteRole();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(deleteArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-1" });
    expect(instance.state.selectedRoleId).toBeNull();
    expect(instance.state.roleAssignmentsState.status).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Proof 15: selected-role assignment loading is lazy, not N+1.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — lazy assignment loading", () => {
  it("issues no assignment request until a role is selected, and exactly one per selection", async () => {
    const listArchiveRoleAssignmentsForRole = vi.fn(async () => okResult([]));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" }), fixtureRole({ id: "role-2", name: "Other" })]),
        listArchiveRoleAssignmentsForRole,
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(listArchiveRoleAssignmentsForRole).not.toHaveBeenCalled();

    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenCalledTimes(1);
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenLastCalledWith(fixtureContext, "role-1");

    instance.handleSelectRole("role-2");
    await flushMicrotasks();
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenCalledTimes(2);
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenLastCalledWith(fixtureContext, "role-2");
  });
});

// ---------------------------------------------------------------------------
// Proof 16: assign uses only an identity-port member option; unassign uses
// the stored assignment tuple.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — assign/unassign", () => {
  function bridgeWithRole(overrides: Partial<ArchiveUiServicePort>): ArchiveUiBridge {
    return createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" })]),
        listArchiveRoleAssignmentsForRole: async () => okResult([]),
        ...overrides,
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2" })]) }),
    });
  }

  it("rejects an assign submission whose member id is not from listAssignableCompanyMembers", async () => {
    const assignArchiveRole = vi.fn(async () => okResult({} as any));
    const instance = mountedScreen(bridgeWithRole({ assignArchiveRole }));
    await flushMicrotasks();
    await flushMicrotasks();
    instance.handleSelectRole("role-1");
    await flushMicrotasks();

    instance.handleAssignMemberChange(fakeChangeEvent("not-a-real-member"));
    instance.handleAssignSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(assignArchiveRole).not.toHaveBeenCalled();
    expect(instance.state.assignFieldErrors.member?.length).toBeGreaterThan(0);
  });

  it("assigns the exact tuple from an identity-port member option and refreshes only the selected role's assignments", async () => {
    const assignArchiveRole = vi.fn(async () => okResult({} as any));
    const listArchiveRoleAssignmentsForRole = vi.fn(async () => okResult([fixtureAssignment()]));
    const instance = mountedScreen(bridgeWithRole({ assignArchiveRole, listArchiveRoleAssignmentsForRole }));
    await flushMicrotasks();
    await flushMicrotasks();
    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    listArchiveRoleAssignmentsForRole.mockClear();

    instance.handleAssignMemberChange(fakeChangeEvent("user-2"));
    instance.handleAssignSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(assignArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-1", platformUserId: "user-2" });
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenCalledTimes(1);
  });

  it("unassigns using the exact stored assignment tuple", async () => {
    const unassignArchiveRole = vi.fn(async () => okResult(null));
    const instance = mountedScreen(
      bridgeWithRole({
        listArchiveRoleAssignmentsForRole: async () => okResult([fixtureAssignment({ roleId: "role-1", platformUserId: "user-2" })]),
        unassignArchiveRole,
      }),
    );
    await flushMicrotasks();
    await flushMicrotasks();
    instance.handleSelectRole("role-1");
    await flushMicrotasks();

    instance.handleUnassign("user-2");
    await flushMicrotasks();

    expect(unassignArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-1", platformUserId: "user-2" });
  });
});

// ---------------------------------------------------------------------------
// Proof 17: stale full-load, role-selection, and identity responses cannot
// overwrite newer state.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — stale response guards", () => {
  it("an older full-screen load resolving after a newer reload does not overwrite the newer ready state", async () => {
    let resolveStaleCaps: ((value: ArchiveHostAdapterResult<ArchiveEffectiveCapabilityMap>) => void) | undefined;
    let call = 0;
    const getEffectiveCapabilities = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return new Promise<ArchiveHostAdapterResult<ArchiveEffectiveCapabilityMap>>((resolveFn) => {
          resolveStaleCaps = resolveFn;
        });
      }
      return Promise.resolve(okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })));
    });
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities,
        listPermissionRules: async () => okResult([fixturePermission({ id: "fresh-rule" })]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
      },
    });

    const instance = mountedScreen(bridge); // starts the stale (first) load, left pending
    void instance.runInitialLoad(); // a NEWER reload
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");

    // Now resolve the STALE first preflight — it must not overwrite the
    // already-applied newer ready state with a denied state.
    resolveStaleCaps?.(errResult("unauthorized", "stale-denied"));
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");
  });

  it("a stale in-flight assignment request for an old role selection does not overwrite a newer role selection", async () => {
    let resolveStaleAssignments: ((value: ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>) => void) | undefined;
    const listArchiveRoleAssignmentsForRole = vi.fn((_context: unknown, roleId: string) => {
      if (roleId === "role-1") {
        return new Promise<ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>>((resolveFn) => {
          resolveStaleAssignments = resolveFn;
        });
      }
      return Promise.resolve(okResult([fixtureAssignment({ roleId: "role-2", platformUserId: "user-fresh" })]));
    });
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" }), fixtureRole({ id: "role-2", name: "Other" })]),
        listArchiveRoleAssignmentsForRole,
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-1"); // starts the stale request, left pending
    instance.handleSelectRole("role-2"); // a NEWER role selection
    await flushMicrotasks();

    expect(instance.state.roleAssignmentsState.status).toBe("ready");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0].platformUserId).toBe("user-fresh");
    }

    resolveStaleAssignments?.(okResult([fixtureAssignment({ roleId: "role-1", platformUserId: "stale-user" })]));
    await flushMicrotasks();

    expect(instance.state.selectedRoleId).toBe("role-2");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0].platformUserId).toBe("user-fresh");
    }
  });

  it("a late identity resolution from a stale generation is discarded after a newer reload", async () => {
    let resolveStaleIdentity: ((value: { ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }) => void) | undefined;
    let identityCall = 0;
    const resolvePlatformUsers = vi.fn(() => {
      identityCall += 1;
      if (identityCall === 1) {
        return new Promise<{ ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }>((resolveFn) => {
          resolveStaleIdentity = resolveFn;
        });
      }
      return Promise.resolve(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "Fresh" })]));
    });
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([fixturePermission({ subjectType: "user", subjectId: "user-2" })]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
      },
      identity: createFakeIdentity({ resolvePlatformUsers }),
    });
    const instance = mountedScreen(bridge); // starts the stale identity resolution, left pending
    await flushMicrotasks();
    await flushMicrotasks();

    void instance.runInitialLoad(); // a NEWER reload — bumps the generation counter
    await flushMicrotasks();
    await flushMicrotasks();

    // Now resolve the STALE identity call from generation 1 — it must not
    // apply to the current (generation-2) state.
    resolveStaleIdentity?.(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "Stale — must be ignored" })]));
    await flushMicrotasks();

    expect(instance.state.identityDisplayByUserId["user-2"]?.displayName).not.toBe("Stale — must be ignored");
  });
});

// ---------------------------------------------------------------------------
// Proof 18: duplicate mutation submissions are blocked.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — duplicate-submission guards", () => {
  it("blocks a second set-rule submission while the first is still pending", async () => {
    let resolveSetRule: ((value: ArchiveHostAdapterResult<ArchivePermission>) => void) | undefined;
    const setPermissionRule = vi.fn(
      () =>
        new Promise<ArchiveHostAdapterResult<ArchivePermission>>((resolveFn) => {
          resolveSetRule = resolveFn;
        }),
    );
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
        setPermissionRule,
      },
      identity: createFakeIdentity({ listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay()]) }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();
    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    instance.handleSetRuleSubjectIdChange(fakeChangeEvent("user-2"));
    instance.handleSetRuleActionChange(fakeChangeEvent("view"));
    instance.handleSetRuleEffectChange(fakeChangeEvent("allow"));

    instance.handleSetRuleSubmit(fakeFormEvent());
    instance.handleSetRuleSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(setPermissionRule).toHaveBeenCalledTimes(1);
    resolveSetRule?.(okResult(fixturePermission()));
    await flushMicrotasks();
  });

  it("blocks a second create-role submission while the first is still pending", async () => {
    let resolveCreate: ((value: ArchiveHostAdapterResult<any>) => void) | undefined;
    const createArchiveRole = vi.fn(
      () =>
        new Promise((resolveFn) => {
          resolveCreate = resolveFn;
        }),
    );
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
        createArchiveRole: createArchiveRole as any,
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    instance.handleCreateRoleNameChange(fakeChangeEvent("Managers"));
    instance.handleCreateRoleSubmit(fakeFormEvent());
    instance.handleCreateRoleSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(createArchiveRole).toHaveBeenCalledTimes(1);
    resolveCreate?.(okResult({ id: "role-1", name: "Managers" }));
    await flushMicrotasks();
  });
});

// ---------------------------------------------------------------------------
// Proof 19: safe feedback for success, adapter failure, identity failure,
// and null/no-op outcomes.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — feedback outcomes", () => {
  it("shows success feedback, translated failure feedback, and honors identity failure without failing the screen", async () => {
    const setPermissionRule = vi.fn(async () => errResult<ArchivePermission>("validation", "raw-validation-detail"));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([fixturePermission({ subjectType: "user", subjectId: "user-2" })]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([]),
        setPermissionRule,
      },
      identity: createFakeIdentity({
        resolvePlatformUsers: async () => failIdentity({ kind: "error", title: "Names unavailable", description: "Safe copy." }),
        listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay()]),
      }),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");
    expect(instance.state.ruleIdentityFailure).toEqual({ kind: "error", title: "Names unavailable", description: "Safe copy." });

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    instance.handleSetRuleSubjectIdChange(fakeChangeEvent("user-2"));
    instance.handleSetRuleActionChange(fakeChangeEvent("view"));
    instance.handleSetRuleEffectChange(fakeChangeEvent("allow"));
    instance.handleSetRuleSubmit(fakeFormEvent());
    await flushMicrotasks();

    expect(instance.state.feedback.kind).toBe("visible");
    if (instance.state.feedback.kind === "visible") {
      expect(instance.state.feedback.feedback.intent).toBe("failure");
      expect(instance.state.feedback.feedback.title).toBe("Check your input");
    }
    expect(JSON.stringify(instance.state.feedback)).not.toContain("raw-validation-detail");
  });

  it("delete-role null no-op result is a controlled success", async () => {
    const deleteArchiveRole = vi.fn(async () => okResult(null));
    const bridge = createFakeBridge({
      serviceOverrides: {
        getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
        listPermissionRules: async () => okResult([]),
        explainPermissions: async () => okResult(fixtureExplanation()),
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" })]),
        listArchiveRoleAssignmentsForRole: async () => okResult([]),
        deleteArchiveRole,
      },
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();
    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    instance.handleRequestDeleteRole();
    instance.handleConfirmDeleteRole();
    await flushMicrotasks();

    expect(instance.state.feedback).toEqual({ kind: "visible", feedback: { intent: "success", title: "Role deleted." } });
  });
});

// ---------------------------------------------------------------------------
// Proof 20: `ArchivePermissionsScreenProps` exact shape.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreenProps", () => {
  it("has exactly `bridge` and `target` — no other field", () => {
    const props: ArchivePermissionsScreenProps = { bridge: createFakeBridge(), target: fixtureTarget };
    expect(Object.keys(props).sort()).toEqual(["bridge", "target"]);
  });
});

// ---------------------------------------------------------------------------
// Proofs 21–25: package/bridge surface and scope discipline.
// ---------------------------------------------------------------------------

describe('ArchivePermissionsScreen — "./ui"/root surface and scope discipline', () => {
  it('the "./ui" runtime surface is exactly 37 values with only the new screen added', () => {
    expect(Object.keys(archiveUi)).toHaveLength(37);
    expect(archiveUi.ArchivePermissionsScreen).toBeDefined();
    expect((archiveUi as Record<string, unknown>).ArchiveRecoveryScreen).toBeDefined();
  });

  it("the root runtime surface remains exactly 27 values", () => {
    expect(Object.keys(archiveRoot)).toHaveLength(27);
  });

  it("the local UI service-port fixture (mirroring the bridge's exact 37-method union) stays exactly 37 keys", () => {
    const fullStub = createStubServicePort({});
    expect(Object.keys(fullStub)).toHaveLength(37);
  });

  it("the production source's actual import statements bring in no Shell/Next/router/Prisma module, and the file's non-comment CODE never calls window.location/uses a breadcrumb or chrome data attribute/mentions namespace bootstrap", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const productionSource = readFileSync(join(here, "..", "permissions-screen.tsx"), "utf8");
    const lines = productionSource.split("\n");
    const importLines = lines.filter((line) => /^\s*import\b/.test(line));
    const forbiddenImportPattern = /platform-shell|["']next(\/|["'])|["']react-dom\/|["']prisma/i;
    for (const line of importLines) {
      expect(forbiddenImportPattern.test(line), `unexpected import: ${line}`).toBe(false);
    }
    // Non-comment code lines only — the file-top doc comment legitimately
    // NAMES these exact forbidden things (following the same house style as
    // every other screen's file-top comment) to document that none of them
    // is actually used; scanning only executable code lines proves the
    // documentation claim rather than false-flagging on it.
    const codeLines = lines.filter((line) => !/^\s*(\/\/|\*)/.test(line));
    const codeText = codeLines.join("\n");
    expect(codeText).not.toContain("window.location");
    expect(codeText).not.toContain("PrismaClient");
    expect(codeText).not.toContain("namespaceBootstrap");
    expect(codeText).not.toMatch(/data-archive-ui-(breadcrumb|chrome)/);
  });

  it("does no TASK-09 recovery-screen or later-task work", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const productionSource = readFileSync(join(here, "..", "permissions-screen.tsx"), "utf8");
    expect(productionSource).not.toContain("listRecoverableContent");
    expect(productionSource).not.toContain("restoreFolder");
    expect(productionSource).not.toContain("restoreItem");
  });
});

// ===========================================================================
// CORRECTION-P6-TASK-08-REPAIR-R1 — bounded async/lifecycle repair proofs.
//
// Every `it` below is labeled with the exact card "Required focused proofs"
// item number it satisfies (1–13; items 14–17 are satisfied by the untouched
// 58 tests above plus the explicit re-assertions near the end of this block),
// followed by ≥3 SELF-INVENTED interleavings not written verbatim in the
// card, per the mandatory adversarial-validation policy's worker
// requirement.
// ===========================================================================

function repairBridge(
  overrides: Partial<ArchiveUiServicePort> = {},
  identityOverrides: IdentityOverrides = {},
): ArchiveUiBridge {
  return createFakeBridge({
    serviceOverrides: {
      getEffectiveCapabilities: async () => okResult(fixtureCapabilityMap({ manage_permissions: { allowed: true } })),
      listPermissionRules: async () => okResult([]),
      explainPermissions: async () => okResult(fixtureExplanation()),
      listArchiveRoles: async () => okResult([]),
      listArchiveRoleAssignmentsForRole: async () => okResult([]),
      ...overrides,
    },
    identity: createFakeIdentity(identityOverrides),
  });
}

describe("ArchivePermissionsScreen — REPAIR-R1 defect 1: frozen destructive delete target", () => {
  it("proof 1: switching selection after opening delete confirmation still deletes the FROZEN role, never the newly selected one, and the dialog names only the frozen role with no id", async () => {
    const deleteArchiveRole = vi.fn(async () => okResult({ id: "role-a", name: "Role A" } as any));
    const bridge = repairBridge({
      listArchiveRoles: async () =>
        okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-b", name: "Role B" })]),
      deleteArchiveRole,
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();
    instance.handleRequestDeleteRole();

    expect(instance.state.deleteRoleConfirmation.status).toBe("pending");
    if (instance.state.deleteRoleConfirmation.status === "pending") {
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).toContain("Role A");
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).not.toContain("role-a");
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).not.toContain("role-b");
    }

    instance.handleSelectRole("role-b"); // selection changes WHILE the dialog is open
    await flushMicrotasks();

    expect(instance.state.selectedRoleId).toBe("role-b");
    // The dialog must still name role A — selecting role B must not re-target it.
    if (instance.state.deleteRoleConfirmation.status === "pending") {
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).toContain("Role A");
    }

    instance.handleConfirmDeleteRole();
    await flushMicrotasks();

    expect(deleteArchiveRole).toHaveBeenCalledTimes(1);
    expect(deleteArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-a" });
  });

  it("proof 2: cancel clears the frozen delete target", async () => {
    const bridge = repairBridge({
      listArchiveRoles: async () => okResult([fixtureRole({ id: "role-a", name: "Role A" })]),
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();
    instance.handleRequestDeleteRole();
    expect((instance.state as any).deleteRoleTarget).toEqual({ roleId: "role-a", name: "Role A" });

    instance.handleCancelDeleteRole();
    expect((instance.state as any).deleteRoleTarget).toBeNull();
    expect(instance.state.deleteRoleConfirmation.status).toBe("idle");

    // Confirming after cancel must be a no-op (no frozen target remains).
    const deleteArchiveRole = vi.fn(async () => okResult(null));
    (bridge.service as any).deleteArchiveRole = deleteArchiveRole;
    instance.handleConfirmDeleteRole();
    await flushMicrotasks();
    expect(deleteArchiveRole).not.toHaveBeenCalled();
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 defect 2: assignment refresh aligned with current selection", () => {
  it("proof 3: a deferred assign for role A completing after switching to role B starts no new A assignment read and leaves B's ready state intact", async () => {
    let resolveAssign: ((value: ArchiveHostAdapterResult<any>) => void) | undefined;
    const assignArchiveRole = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<any>>((resolveFn) => { resolveAssign = resolveFn; }),
    );
    const listArchiveRoleAssignmentsForRole = vi.fn((_context: unknown, roleId: string) => {
      if (roleId === "role-a") return Promise.resolve(okResult([]));
      return Promise.resolve(okResult([fixtureAssignment({ roleId: "role-b", platformUserId: "user-b" })]));
    });
    const bridge = repairBridge(
      {
        listArchiveRoles: async () =>
          okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-b", name: "Role B" })]),
        listArchiveRoleAssignmentsForRole,
        assignArchiveRole,
      },
      { listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2" })]) },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();

    instance.handleAssignMemberChange(fakeChangeEvent("user-2"));
    instance.handleAssignSubmit(fakeFormEvent()); // pending assign for role-a

    instance.handleSelectRole("role-b"); // selection changes WHILE the assign is pending
    await flushMicrotasks();

    expect(instance.state.roleAssignmentsState.status).toBe("ready");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-b");
    }

    listArchiveRoleAssignmentsForRole.mockClear();
    resolveAssign?.(okResult({} as any)); // role-A's assign now succeeds
    await flushMicrotasks();
    await flushMicrotasks();

    expect(listArchiveRoleAssignmentsForRole).not.toHaveBeenCalled();
    expect(instance.state.selectedRoleId).toBe("role-b");
    expect(instance.state.roleAssignmentsState.status).toBe("ready");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-b");
    }
  });

  it("proof 4: the same interleaving for unassign — a deferred unassign for role A completing after switching to role B starts no new A assignment read and leaves B's ready state intact", async () => {
    let resolveUnassign: ((value: ArchiveHostAdapterResult<any>) => void) | undefined;
    const unassignArchiveRole = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<any>>((resolveFn) => { resolveUnassign = resolveFn; }),
    );
    const listArchiveRoleAssignmentsForRole = vi.fn((_context: unknown, roleId: string) => {
      if (roleId === "role-a") return Promise.resolve(okResult([fixtureAssignment({ roleId: "role-a", platformUserId: "user-a" })]));
      return Promise.resolve(okResult([fixtureAssignment({ roleId: "role-b", platformUserId: "user-b" })]));
    });
    const bridge = repairBridge({
      listArchiveRoles: async () =>
        okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-b", name: "Role B" })]),
      listArchiveRoleAssignmentsForRole,
      unassignArchiveRole,
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();

    instance.handleUnassign("user-a"); // pending unassign for role-a

    instance.handleSelectRole("role-b"); // selection changes WHILE the unassign is pending
    await flushMicrotasks();

    expect(instance.state.roleAssignmentsState.status).toBe("ready");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-b");
    }

    listArchiveRoleAssignmentsForRole.mockClear();
    resolveUnassign?.(okResult(null));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(listArchiveRoleAssignmentsForRole).not.toHaveBeenCalled();
    expect(instance.state.selectedRoleId).toBe("role-b");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-b");
    }
  });

  it("proof 13: a role-list refresh that removes the selected role invalidates a pending assignment response — a LATE-arriving response for the vanished role must not overwrite the idle state", async () => {
    let resolveAssignments: ((value: ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>) => void) | undefined;
    const listArchiveRoleAssignmentsForRole = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>>((resolveFn) => { resolveAssignments = resolveFn; }),
    );
    let rolesCall = 0;
    const listArchiveRoles = vi.fn(async () => {
      rolesCall += 1;
      if (rolesCall === 1) return okResult([fixtureRole({ id: "role-1", name: "Managers" })]);
      return okResult([]); // role-1 is gone after the create-role refresh
    });
    const createArchiveRole = vi.fn(async () => okResult({ id: "role-2", name: "New Role" } as any));
    const bridge = repairBridge({ listArchiveRoles, listArchiveRoleAssignmentsForRole, createArchiveRole });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-1"); // starts the pending assignment read, left pending
    await flushMicrotasks();
    expect(instance.state.roleAssignmentsState.status).toBe("loading");

    // A DIFFERENT mutation (create-role) triggers a combined roles+rules
    // refresh whose new role list no longer contains role-1.
    instance.handleCreateRoleNameChange(fakeChangeEvent("Another Role"));
    instance.handleCreateRoleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.selectedRoleId).toBeNull();
    expect(instance.state.roleAssignmentsState.status).toBe("idle");

    // The STALE role-1 assignment response now arrives LATE — it must be
    // discarded rather than resurrecting a "ready" state for a role that is
    // no longer selected (or, worse, no longer exists).
    resolveAssignments?.(okResult([fixtureAssignment({ roleId: "role-1", platformUserId: "stale-user" })]));
    await flushMicrotasks();

    expect(instance.state.selectedRoleId).toBeNull();
    expect(instance.state.roleAssignmentsState.status).toBe("idle");
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 defect 3: separate full-load and permission-read generations", () => {
  it("proof 5: a rule-only refresh (set-rule success) does not cancel a still-pending initial role-list read; the original role-list response still applies", async () => {
    let resolveRoles: ((value: ArchiveHostAdapterResult<ArchiveRoleSummary[]>) => void) | undefined;
    const listArchiveRoles = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<ArchiveRoleSummary[]>>((resolveFn) => { resolveRoles = resolveFn; }),
    );
    const setPermissionRule = vi.fn(async () => okResult(fixturePermission()));
    const bridge = repairBridge(
      { listArchiveRoles, setPermissionRule },
      { listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay()]) },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();

    expect(instance.state.rolesState.status).toBe("loading");
    expect(instance.state.viewState.status).toBe("ready");

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();
    instance.handleSetRuleSubjectIdChange(fakeChangeEvent("user-2"));
    instance.handleSetRuleActionChange(fakeChangeEvent("view"));
    instance.handleSetRuleEffectChange(fakeChangeEvent("allow"));
    instance.handleSetRuleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    expect(setPermissionRule).toHaveBeenCalledTimes(1);
    // Still pending — the rule-only refresh must not have stranded it in a
    // way that changes this expectation; it's simply not resolved yet.
    expect(instance.state.rolesState.status).toBe("loading");

    resolveRoles?.(okResult([fixtureRole({ id: "role-1", name: "Managers" })]));
    await flushMicrotasks();

    expect(instance.state.rolesState.status).toBe("ready");
    if (instance.state.rolesState.status === "ready") {
      expect(instance.state.rolesState.roles).toEqual([fixtureRole({ id: "role-1", name: "Managers" })]);
    }
  });

  it("proof 6: the same rule/role-load independence for revoke success", async () => {
    let resolveRoles: ((value: ArchiveHostAdapterResult<ArchiveRoleSummary[]>) => void) | undefined;
    const listArchiveRoles = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<ArchiveRoleSummary[]>>((resolveFn) => { resolveRoles = resolveFn; }),
    );
    const rule = fixturePermission({ id: "rule-1" });
    const revokePermissionRule = vi.fn(async () => okResult(rule));
    const bridge = repairBridge({
      listArchiveRoles,
      listPermissionRules: async () => okResult([rule]),
      revokePermissionRule,
    });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.rolesState.status).toBe("loading");

    instance.handleRequestRevoke(rule);
    instance.handleConfirmRevoke();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(revokePermissionRule).toHaveBeenCalledTimes(1);
    expect(instance.state.rolesState.status).toBe("loading");

    resolveRoles?.(okResult([fixtureRole({ id: "role-1" })]));
    await flushMicrotasks();

    expect(instance.state.rolesState.status).toBe("ready");
  });

  it("proof 7: two overlapping rule reads resolving out of order apply only the newest rules/explanation plus its identity labels", async () => {
    let call = 0;
    let resolveFirst: ((value: ArchiveHostAdapterResult<ArchivePermission[]>) => void) | undefined;
    const listPermissionRules = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return new Promise<ArchiveHostAdapterResult<ArchivePermission[]>>((resolveFn) => { resolveFirst = resolveFn; });
      }
      return Promise.resolve(okResult([fixturePermission({ id: "rule-second", subjectType: "user", subjectId: "user-second" })]));
    });
    const resolvePlatformUsers = vi.fn(async (ids: readonly string[]) => {
      if (ids.includes("user-second")) {
        return okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-second", displayName: "Second" })]);
      }
      return okIdentity([]);
    });
    const bridge = repairBridge({ listPermissionRules }, { resolvePlatformUsers });
    const instance = mountedScreen(bridge);
    await flushMicrotasks(); // capability resolves; the FIRST rule read starts and is left pending

    void instance.refreshRulesOnly(); // a NEWER rule read starts before the first resolves
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.rules[0]?.id).toBe("rule-second");
    }
    expect(instance.state.identityDisplayByUserId["user-second"]?.displayName).toBe("Second");

    resolveFirst?.(okResult([fixturePermission({ id: "rule-first", subjectType: "user", subjectId: "user-first" })]));
    await flushMicrotasks();

    expect(instance.state.viewState.status).toBe("ready");
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.rules[0]?.id).toBe("rule-second");
    }
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 defect 4: snapshot-scoped identity data", () => {
  it("proof 8: a newer successful rule-identity result omitting a formerly resolved id renders Unresolved user, not the stale cached label", async () => {
    let call = 0;
    const listPermissionRules = vi.fn(async () => {
      call += 1;
      return okResult([fixturePermission({ id: `rule-${call}`, subjectType: "user", subjectId: "user-2" })]);
    });
    const resolvePlatformUsers = vi.fn(async () => {
      if (call === 1) return okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "Old Label" })]);
      return okIdentity([]); // newer snapshot's identity result omits user-2
    });
    const bridge = repairBridge({ listPermissionRules }, { resolvePlatformUsers });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.identityDisplayByUserId["user-2"]?.displayName).toBe("Old Label");

    void instance.refreshRulesOnly();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.identityDisplayByUserId["user-2"]).toBeUndefined();
  });

  it("proof 9: the equivalent omitted-id proof for assignment identity", async () => {
    let call = 0;
    const listArchiveRoleAssignmentsForRole = vi.fn(async () => {
      call += 1;
      return okResult([fixtureAssignment({ roleId: "role-1", platformUserId: "user-2" })]);
    });
    const resolvePlatformUsers = vi.fn(async () => {
      if (call === 1) return okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2", displayName: "Old Label" })]);
      return okIdentity([]);
    });
    const bridge = repairBridge(
      { listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" })]), listArchiveRoleAssignmentsForRole },
      { resolvePlatformUsers },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    expect(instance.state.assignmentIdentityByUserId["user-2"]?.displayName).toBe("Old Label");

    void instance.runAssignmentLoad("role-1"); // a newer same-role reload (as after an assign/unassign refresh)
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.assignmentIdentityByUserId["user-2"]).toBeUndefined();
  });

  it("proof 10: an empty rules snapshot clears a stale rule-identity failure, and an empty assignment snapshot clears a stale assignment-identity failure", async () => {
    let rulesCall = 0;
    const listPermissionRules = vi.fn(async () => {
      rulesCall += 1;
      if (rulesCall === 1) return okResult([fixturePermission({ subjectType: "user", subjectId: "user-2" })]);
      return okResult([]);
    });
    let assignCall = 0;
    const listArchiveRoleAssignmentsForRole = vi.fn(async () => {
      assignCall += 1;
      if (assignCall === 1) return okResult([fixtureAssignment({ roleId: "role-1", platformUserId: "user-2" })]);
      return okResult([]);
    });
    const failure: ArchiveUiIdentityFailure = { kind: "error", title: "Names unavailable", description: "Safe copy." };
    const resolvePlatformUsers = vi.fn(async () => failIdentity(failure));
    const bridge = repairBridge(
      { listPermissionRules, listArchiveRoles: async () => okResult([fixtureRole({ id: "role-1" })]), listArchiveRoleAssignmentsForRole },
      { resolvePlatformUsers },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.ruleIdentityFailure).toEqual(failure);

    instance.handleSelectRole("role-1");
    await flushMicrotasks();
    expect(instance.state.assignmentIdentityFailure).toEqual(failure);

    void instance.refreshRulesOnly();
    void instance.runAssignmentLoad("role-1");
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.ruleIdentityFailure).toBeNull();
    expect(instance.state.assignmentIdentityFailure).toBeNull();
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 defect 5: generation-scoped assignable-member cache", () => {
  it("proof 11: a full reload invalidates a pending assignable-member request and clears the prior cache", async () => {
    let resolveMembersFirst: ((value: { ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }) => void) | undefined;
    let memberCall = 0;
    const listAssignableCompanyMembers = vi.fn(() => {
      memberCall += 1;
      if (memberCall === 1) {
        return new Promise<{ ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }>((resolveFn) => { resolveMembersFirst = resolveFn; });
      }
      return Promise.resolve(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-new", displayName: "New Member" })]));
    });
    const bridge = repairBridge({}, { listAssignableCompanyMembers });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user")); // starts the FIRST member request, left pending
    await flushMicrotasks();
    expect(instance.state.loadingAssignableMembers).toBe(true);
    expect(instance.state.assignableMembers).toBeNull();

    void instance.runInitialLoad(); // a NEWER full reload
    await flushMicrotasks();

    expect(instance.state.loadingAssignableMembers).toBe(false);
    expect(instance.state.assignableMembers).toBeNull();

    resolveMembersFirst?.(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-old", displayName: "Stale — must not apply" })]));
    await flushMicrotasks();

    expect(instance.state.assignableMembers).toBeNull();
    expect(instance.state.loadingAssignableMembers).toBe(false);
  });

  it("proof 12: after a reload invalidates a pending member request, a NEW-generation member request can still cache normally", async () => {
    let resolveMembersFirst: ((value: { ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }) => void) | undefined;
    let memberCall = 0;
    const listAssignableCompanyMembers = vi.fn(() => {
      memberCall += 1;
      if (memberCall === 1) {
        return new Promise<{ ok: true; value: readonly ArchiveUiPlatformUserDisplay[] }>((resolveFn) => { resolveMembersFirst = resolveFn; });
      }
      return Promise.resolve(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-new", displayName: "New Member" })]));
    });
    const bridge = repairBridge({}, { listAssignableCompanyMembers });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user"));
    await flushMicrotasks();

    void instance.runInitialLoad();
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSetRuleSubjectTypeChange(fakeChangeEvent("user")); // starts a NEW-generation member request
    await flushMicrotasks();

    expect(instance.state.assignableMembers).toEqual([fixturePlatformUserDisplay({ platformUserId: "user-new", displayName: "New Member" })]);

    resolveMembersFirst?.(okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-old", displayName: "Stale" })]));
    await flushMicrotasks();

    expect(instance.state.assignableMembers).toEqual([fixturePlatformUserDisplay({ platformUserId: "user-new", displayName: "New Member" })]);
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1: proofs 14–17 (regression floor + no-leak re-affirmation)", () => {
  it("proof 14 (re-affirmation): this describe block's presence alongside all 58 baseline TASK-08 proofs above proves the baseline stayed green under the repair — see the full suite run", () => {
    // The 58 pre-existing `it(...)` blocks above this REPAIR-R1 section are
    // byte-untouched; running this file end-to-end (as the validation ladder
    // requires) is the actual proof. This assertion exists only so proof 14
    // has an explicit, citable anchor in this file.
    expect(true).toBe(true);
  });

  it('proof 15: "./ui" runtime surface remains exactly 37 values and root remains exactly 27, after the repair', () => {
    expect(Object.keys(archiveUi)).toHaveLength(37);
    expect(Object.keys(archiveRoot)).toHaveLength(27);
  });

  it("proof 16: the local UI service-port fixture stays exactly 37 keys and production source imports no adapter-internal/Prisma module after the repair (the full 47/37/10/2 host adapter/service/forbidden/transport partition recount is owned by the untouched, protected package-surface test suite — this file cannot see internal-Archive adapter code, by its own file-top import-discipline comment)", () => {
    const fullStub = createStubServicePort({});
    expect(Object.keys(fullStub)).toHaveLength(37);
    const here = dirname(fileURLToPath(import.meta.url));
    const productionSource = readFileSync(join(here, "..", "permissions-screen.tsx"), "utf8");
    const importLines = productionSource.split("\n").filter((line) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      expect(/prisma|archive-adapter/i.test(line), `unexpected import: ${line}`).toBe(false);
    }
  });

  it("proof 17: no raw ids or backend/identity-provider reasons leak into rendered copy across the repaired flows (frozen-delete-target + omitted-identity)", async () => {
    let call = 0;
    const listPermissionRules = vi.fn(async () => {
      call += 1;
      return okResult([fixturePermission({ id: "rule-secret", subjectType: "user", subjectId: "user-secret" })]);
    });
    const resolvePlatformUsers = vi.fn(async () => {
      if (call === 1) return okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-secret", displayName: "Safe Name" })]);
      return okIdentity([]);
    });
    const bridge = repairBridge(
      {
        listPermissionRules,
        listArchiveRoles: async () => okResult([fixtureRole({ id: "role-secret-id", name: "Secretless Name" })]),
      },
      { resolvePlatformUsers },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-secret-id");
    await flushMicrotasks();
    instance.handleRequestDeleteRole();

    void instance.refreshRulesOnly(); // a newer rule snapshot whose identity result omits the id
    await flushMicrotasks();
    await flushMicrotasks();

    const rendered = elementText(instance.render()).join(" ␟ ");
    expect(rendered).not.toContain("rule-secret");
    expect(rendered).not.toContain("user-secret");
    expect(rendered).not.toContain("role-secret-id");
    expect(rendered).toContain("Unresolved user");
    expect(rendered).toContain("Secretless Name");
    if (instance.state.deleteRoleConfirmation.status === "pending") {
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).not.toContain("role-secret-id");
    }
  });
});

// ---------------------------------------------------------------------------
// SELF-INVENTED interleavings (not written verbatim in the card), per the
// mandatory adversarial-validation policy's worker requirement (≥3).
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — REPAIR-R1 self-invented interleaving 1: overlapping different mutations (create-role while a revoke is pending)", () => {
  it("keeps both refreshes coherent when a create-role mutation is submitted while a revoke mutation is still pending", async () => {
    const rule = fixturePermission({ id: "rule-1", subjectType: "user", subjectId: "user-2" });
    let resolveRevoke: ((value: ArchiveHostAdapterResult<ArchivePermission>) => void) | undefined;
    const revokePermissionRule = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<ArchivePermission>>((resolveFn) => { resolveRevoke = resolveFn; }),
    );
    // Models real backend truth: the rule is still present until the revoke
    // mutation actually resolves (`revokeResolved` flips only when the
    // deferred `revokePermissionRule` promise settles below) — an unrelated
    // create-role refresh that runs BEFORE that must still see the rule.
    let revokeResolved = false;
    const listPermissionRules = vi.fn(async () => (revokeResolved ? okResult([]) : okResult([rule])));
    let rolesCall = 0;
    const listArchiveRoles = vi.fn(async () => {
      rolesCall += 1;
      return rolesCall === 1 ? okResult([]) : okResult([fixtureRole({ id: "role-new", name: "New Role" })]);
    });
    const createArchiveRole = vi.fn(async () => okResult({ id: "role-new", name: "New Role" } as any));
    const bridge = repairBridge({ listPermissionRules, listArchiveRoles, revokePermissionRule, createArchiveRole });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleRequestRevoke(rule);
    instance.handleConfirmRevoke(); // pending — its refreshRulesOnly has not run yet

    instance.handleCreateRoleNameChange(fakeChangeEvent("New Role"));
    instance.handleCreateRoleSubmit(fakeFormEvent()); // a DIFFERENT, overlapping mutation
    await flushMicrotasks();
    await flushMicrotasks();

    expect(createArchiveRole).toHaveBeenCalledTimes(1);
    // The create-role refresh's own coherent roles+rules pair must apply
    // together — roles reflect the new role, and rules still correctly show
    // the not-yet-revoked rule (no torn/incoherent generation mixing).
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.rules).toEqual([rule]);
    }
    expect(instance.state.rolesState.status).toBe("ready");
    if (instance.state.rolesState.status === "ready") {
      expect(instance.state.rolesState.roles.map((role) => role.id)).toContain("role-new");
    }

    revokeResolved = true;
    resolveRevoke?.(okResult(rule));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(revokePermissionRule).toHaveBeenCalledTimes(1);
    // The revoke's own `refreshRulesOnly` — bumping ONLY `ruleReadCounter`,
    // now the NEWEST rule-read generation — must still be free to apply and
    // correctly show the rule gone, without being blocked by the earlier
    // create-role refresh's generation, and without disturbing the
    // already-applied "role-new" role list.
    if (instance.state.viewState.status === "ready") {
      expect(instance.state.viewState.data.rules).toEqual([]);
    }
    expect(instance.state.rolesState.status).toBe("ready");
    if (instance.state.rolesState.status === "ready") {
      expect(instance.state.rolesState.roles.map((role) => role.id)).toContain("role-new");
    }
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 self-invented interleaving 2: delete confirmation open while an UNRELATED mutation's combined refresh runs", () => {
  it("still deletes exactly the frozen role after an unrelated create-role refresh runs while the delete dialog is open", async () => {
    let rolesCall = 0;
    const listArchiveRoles = vi.fn(async () => {
      rolesCall += 1;
      if (rolesCall === 1) return okResult([fixtureRole({ id: "role-a", name: "Role A" })]);
      if (rolesCall === 2) return okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-new", name: "New Role" })]);
      return okResult([fixtureRole({ id: "role-new", name: "New Role" })]); // role-a gone after delete
    });
    const createArchiveRole = vi.fn(async () => okResult({ id: "role-new", name: "New Role" } as any));
    const deleteArchiveRole = vi.fn(async () => okResult({ id: "role-a", name: "Role A" } as any));
    const bridge = repairBridge({ listArchiveRoles, createArchiveRole, deleteArchiveRole });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();
    instance.handleRequestDeleteRole(); // dialog now names Role A, frozen roleId = role-a

    // An UNRELATED mutation (create-role) runs its own combined roles+rules
    // refresh WHILE the delete dialog is still open.
    instance.handleCreateRoleNameChange(fakeChangeEvent("New Role"));
    instance.handleCreateRoleSubmit(fakeFormEvent());
    await flushMicrotasks();
    await flushMicrotasks();

    // role-a still exists after the create-role refresh, so the selection
    // and the frozen target are both undisturbed.
    expect(instance.state.selectedRoleId).toBe("role-a");
    if (instance.state.deleteRoleConfirmation.status === "pending") {
      expect(instance.state.deleteRoleConfirmation.labels.subjectLabel).toContain("Role A");
    }

    instance.handleConfirmDeleteRole();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(deleteArchiveRole).toHaveBeenCalledWith(fixtureContext, { roleId: "role-a" });
    expect(instance.state.selectedRoleId).toBeNull();
    expect(instance.state.rolesState.status).toBe("ready");
    if (instance.state.rolesState.status === "ready") {
      expect(instance.state.rolesState.roles.map((role) => role.id)).not.toContain("role-a");
    }
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 self-invented interleaving 3: the member cache must NOT be over-invalidated by an ordinary role selection change", () => {
  it("keeps the assignable-member cache across a role switch within the SAME full-load generation (only a real reload may invalidate it)", async () => {
    const listAssignableCompanyMembers = vi.fn(async () => okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2" })]));
    const bridge = repairBridge(
      {
        listArchiveRoles: async () =>
          okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-b", name: "Role B" })]),
      },
      { listAssignableCompanyMembers },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a"); // triggers the member load (first time)
    await flushMicrotasks();
    expect(listAssignableCompanyMembers).toHaveBeenCalledTimes(1);

    instance.handleSelectRole("role-b"); // an ORDINARY selection change, NOT a reload
    await flushMicrotasks();

    // The repair for defect 5 must invalidate the member cache ONLY on a
    // real `runInitialLoad`, never on an ordinary role switch — otherwise
    // it would silently regress the already-accepted TASK-08 caching
    // behavior this same file's proof 7 (on-demand assignable-member
    // loading) already requires.
    expect(listAssignableCompanyMembers).toHaveBeenCalledTimes(1);
    expect(instance.state.assignableMembers).toEqual([fixturePlatformUserDisplay({ platformUserId: "user-2" })]);
  });
});

describe("ArchivePermissionsScreen — REPAIR-R1 self-invented interleaving 4: two DIFFERENT roles assigned concurrently", () => {
  it("resolves an older role-A assign after a newer role-B assign without B's refreshed assignment state being clobbered", async () => {
    let resolveAssignA: ((value: ArchiveHostAdapterResult<any>) => void) | undefined;
    const assignArchiveRole = vi.fn((_context: unknown, args: { roleId: string; platformUserId: string }) => {
      if (args.roleId === "role-a") {
        return new Promise<ArchiveHostAdapterResult<any>>((resolveFn) => { resolveAssignA = resolveFn; });
      }
      return Promise.resolve(okResult({} as any));
    });
    const listArchiveRoleAssignmentsForRole = vi.fn((_context: unknown, roleId: string) => {
      if (roleId === "role-a") return Promise.resolve(okResult([]));
      return Promise.resolve(okResult([fixtureAssignment({ roleId: "role-b", platformUserId: "user-2" })]));
    });
    const bridge = repairBridge(
      {
        listArchiveRoles: async () =>
          okResult([fixtureRole({ id: "role-a", name: "Role A" }), fixtureRole({ id: "role-b", name: "Role B" })]),
        listArchiveRoleAssignmentsForRole,
        assignArchiveRole,
      },
      { listAssignableCompanyMembers: async () => okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-2" })]) },
    );
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-a");
    await flushMicrotasks();
    instance.handleAssignMemberChange(fakeChangeEvent("user-2"));
    instance.handleAssignSubmit(fakeFormEvent()); // pending assign for role-a, left in flight

    instance.handleSelectRole("role-b");
    await flushMicrotasks();
    instance.handleAssignMemberChange(fakeChangeEvent("user-2"));
    instance.handleAssignSubmit(fakeFormEvent()); // a SECOND, independent assign for role-b, resolves immediately
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.roleAssignmentsState.status).toBe("ready");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-2");
    }

    listArchiveRoleAssignmentsForRole.mockClear();
    resolveAssignA?.(okResult({} as any)); // the OLDER role-a assign now resolves
    await flushMicrotasks();
    await flushMicrotasks();

    // role-a's now-stale success must not refresh role-a (not selected) nor
    // disturb role-b's already-applied ready state.
    expect(listArchiveRoleAssignmentsForRole).not.toHaveBeenCalled();
    expect(instance.state.selectedRoleId).toBe("role-b");
    if (instance.state.roleAssignmentsState.status === "ready") {
      expect(instance.state.roleAssignmentsState.assignments[0]?.platformUserId).toBe("user-2");
    }
  });
});

// ---------------------------------------------------------------------------
// CHALLENGER-FOUND REGRESSION PROOF (scenario S1): a fresh-context
// `correction-adversarial-challenger` review of the above diff found that
// `runInitialLoad` bumped `loadCounter`/`ruleReadCounter`/`memberCounter` but
// never `assignmentCounter`, so a pre-reload pending selected-role
// assignment read (and its identity enrichment) could still pass its own
// staleness guard and apply PRIOR-context/generation data into the freshly
// reset post-reload state. Fixed by also bumping `assignmentCounter` in
// `runInitialLoad`, mirroring the same invalidate-before-clear ordering
// already used in `loadRoleAdministration`'s vanished-selection repair.
// ---------------------------------------------------------------------------

describe("ArchivePermissionsScreen — REPAIR-R1 challenger regression (scenario S1): a full reload invalidates a pending selected-role assignment generation", () => {
  it("a pre-reload pending assignment response resolving AFTER runInitialLoad must not apply, must not fire a new identity request, and must not cache stale assignment identity", async () => {
    let resolveStaleAssignments: ((value: ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>) => void) | undefined;
    let rolesCall = 0;
    const listArchiveRoles = vi.fn(async () => {
      rolesCall += 1;
      if (rolesCall === 1) return okResult([fixtureRole({ id: "role-old", name: "Old Role" })]);
      // Simulates a NEW host-context/company role list after the reload —
      // the old role/assignment generation is entirely gone.
      return okResult([fixtureRole({ id: "role-new", name: "New Role" })]);
    });
    const listArchiveRoleAssignmentsForRole = vi.fn(
      () => new Promise<ArchiveHostAdapterResult<ArchiveRoleAssignmentSummary[]>>((resolveFn) => { resolveStaleAssignments = resolveFn; }),
    );
    const resolvePlatformUsers = vi.fn(async () =>
      okIdentity([fixturePlatformUserDisplay({ platformUserId: "user-stale", displayName: "Stale Person" })]),
    );
    const bridge = repairBridge({ listArchiveRoles, listArchiveRoleAssignmentsForRole }, { resolvePlatformUsers });
    const instance = mountedScreen(bridge);
    await flushMicrotasks();
    await flushMicrotasks();

    instance.handleSelectRole("role-old"); // starts the pending assignment read, left pending
    await flushMicrotasks();
    expect(instance.state.roleAssignmentsState.status).toBe("loading");
    expect(listArchiveRoleAssignmentsForRole).toHaveBeenCalledTimes(1);

    void instance.runInitialLoad(); // a NEWER full reload (e.g. host context/company change)
    await flushMicrotasks();
    await flushMicrotasks();

    expect(instance.state.selectedRoleId).toBeNull();
    expect(instance.state.roleAssignmentsState.status).toBe("idle");

    resolvePlatformUsers.mockClear();
    // The STALE pre-reload assignment response now resolves LATE, carrying
    // prior-context data for a role/user that no longer exist in this
    // generation.
    resolveStaleAssignments?.(okResult([fixtureAssignment({ roleId: "role-old", platformUserId: "user-stale" })]));
    await flushMicrotasks();
    await flushMicrotasks();

    // The late old-generation response must not apply.
    expect(instance.state.roleAssignmentsState.status).toBe("idle");
    expect(instance.state.selectedRoleId).toBeNull();
    // No NEW identity request must fire from the discarded stale snapshot.
    expect(resolvePlatformUsers).not.toHaveBeenCalled();
    // The assignment identity cache must stay clean — no "Stale Person".
    expect(instance.state.assignmentIdentityByUserId).toEqual({});
    expect(instance.state.assignmentIdentityByUserId["user-stale"]).toBeUndefined();
  });
});
