import { describe, expect, it } from "vitest";

// Correction Phase 6 TASK-02 (host-neutral Archive UI bridge and authorized
// read projections). Every bridge/supporting type below is imported from
// "../index.js" — the same public "./ui" entry point a real host consumes —
// rather than "../bridge.js" directly, so this file's own typecheck (`npm
// run typecheck:ui`) is itself proof that the TypeScript declaration surface
// exposes the approved bridge types through the intended public path.
import type {
  ArchiveUiBridge,
  ArchiveUiCurrentUserDisplay,
  ArchiveUiIdentityFailure,
  ArchiveUiIdentityPort,
  ArchiveUiIdentityResult,
  ArchiveUiNavigationIntent,
  ArchiveUiPlatformUserDisplay,
  ArchiveUiServiceMethodName,
  ArchiveUiServicePort,
} from "../index.js";

// Domain/input/result types come ONLY from the public Archive root package
// surface via this package's own self-referenced name — never a relative
// import reaching into `src/archive/**` (forbidden by the TASK-02 card; also
// a `tsconfig.ui.build.json` `rootDir` violation). `ARCHIVE_PERMISSION_ACTIONS`
// is a genuine VALUE import used to build a realistic effective-capability-map
// fixture generically over the real closed action set — not a runtime
// constant invented merely to make a type testable.
import {
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveContextInput,
  type ArchiveEffectiveCapabilityMap,
  type ArchiveExplainedCapability,
  type ArchiveFile,
  type ArchiveFileDownload,
  type ArchiveFolder,
  type ArchiveFolderPathEntry,
  type ArchiveFolderSearchResult,
  type ArchiveHistoryPage,
  type ArchiveHostAdapter,
  type ArchiveHostAdapterResult,
  type ArchiveItem,
  type ArchiveItemSearchResult,
  type ArchivePermission,
  type ArchivePermissionExplanation,
  type ArchiveRecoverableFile,
  type ArchiveRecoveryListing,
  type ArchiveRole,
  type ArchiveRoleAssignment,
  type ArchiveRoleAssignmentSummary,
  type ArchiveRoleSummary,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures — minimal, valid instances of the real public domain types.
// No Shell, Prisma, database, or network dependency anywhere in this file.
// ---------------------------------------------------------------------------

const now = new Date("2026-01-01T00:00:00.000Z");

const fixtureFolder: ArchiveFolder = {
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
};

const fixtureItem: ArchiveItem = {
  id: "item-1",
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
};

const fixtureFile: ArchiveFile = {
  id: "file-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  archiveItemId: "item-1",
  originalFileName: "fixture.txt",
  mimeType: "text/plain",
  extension: "txt",
  sizeBytes: 3,
  uploadedByUserId: "user-1",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  deletedByUserId: null,
  purgedAt: null,
};

const fixturePermission: ArchivePermission = {
  id: "permission-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  targetType: "folder",
  targetId: "folder-1",
  subjectType: "user",
  subjectId: "user-1",
  action: "view",
  effect: "allow",
  grantedByUserId: "user-1",
  createdAt: now,
  revokedAt: null,
  revokedByUserId: null,
};

const fixtureRole: ArchiveRole = {
  id: "role-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  name: "Fixture role",
  createdByUserId: "user-1",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  deletedByUserId: null,
};

const fixtureRoleAssignment: ArchiveRoleAssignment = {
  id: "assignment-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  roleId: "role-1",
  platformUserId: "user-2",
  assignedByUserId: "user-1",
  createdAt: now,
  removedAt: null,
  removedByUserId: null,
};

// Correction Phase 6 TASK-08A: the minimal UI-safe role/assignment read
// projections — never the full ArchiveRole/ArchiveRoleAssignment row.
const fixtureRoleSummary: ArchiveRoleSummary = {
  id: "role-1",
  name: "Fixture role",
};

const fixtureRoleAssignmentSummary: ArchiveRoleAssignmentSummary = {
  roleId: "role-1",
  platformUserId: "user-2",
};

// Correction Phase 6 TASK-08A: the host-neutral identity display fixture —
// only presentation fields, never an authorization input.
const fixturePlatformUserDisplay: ArchiveUiPlatformUserDisplay = {
  platformUserId: "user-2",
  displayName: "Fixture Person",
  handle: "fixture-person",
  email: "fixture-person@example.test",
};

const fixtureCapabilityMap: ArchiveEffectiveCapabilityMap =
  Object.fromEntries(
    ARCHIVE_PERMISSION_ACTIONS.map((action) => [
      action,
      { allowed: true, source: "direct_user" as const },
    ]),
  ) as ArchiveEffectiveCapabilityMap;

const fixtureExplainedCapabilities = Object.fromEntries(
  ARCHIVE_PERMISSION_ACTIONS.map((action) => [
    action,
    {
      allowed: true,
      source: "direct_user" as const,
      decidedBy: null,
    } satisfies ArchiveExplainedCapability,
  ]),
) as Record<(typeof ARCHIVE_PERMISSION_ACTIONS)[number], ArchiveExplainedCapability>;

const fixturePermissionExplanation: ArchivePermissionExplanation = {
  target: { targetType: "folder", targetId: "folder-1" },
  directRules: [fixturePermission],
  capabilities: fixtureExplainedCapabilities,
};

const fixtureFolderPath: ArchiveFolderPathEntry[] = [
  { hidden: false, folderId: "folder-1", name: "Fixture folder" },
];

const fixtureHistoryPage: ArchiveHistoryPage = {
  entries: [
    {
      eventId: "event-1",
      eventType: "archive.folder.created",
      occurredAt: now,
      actorUserId: "user-1",
      targetType: "folder",
      targetId: "folder-1",
      summary: {},
    },
  ],
  nextCursor: null,
};

const fixtureRecoveryListing: ArchiveRecoveryListing = {
  folders: [{ id: "folder-2", parentFolderId: null, name: "Deleted folder", deletedAt: now }],
  items: [{ id: "item-2", folderId: "folder-1", name: "Deleted item", deletedAt: now }],
};

// Correction Phase 6 TASK-06A (deleted-file discovery prerequisite): the
// one-item-scoped file counterpart to fixtureRecoveryListing above.
const fixtureRecoverableFile: ArchiveRecoverableFile = {
  id: "file-2",
  archiveItemId: "item-1",
  originalFileName: "deleted-fixture.txt",
  mimeType: "text/plain",
  extension: "txt",
  sizeBytes: 3,
  deletedAt: now,
};

const fixtureFolderSearchResult: ArchiveFolderSearchResult = {
  items: [fixtureFolder],
  nextCursor: null,
};

const fixtureItemSearchResult: ArchiveItemSearchResult = {
  items: [fixtureItem],
  nextCursor: null,
};

const fixtureFileDownload: ArchiveFileDownload = {
  file: fixtureFile,
  content: new Uint8Array([1, 2, 3]),
};

function ok<T>(value: T): Promise<ArchiveHostAdapterResult<T>> {
  return Promise.resolve({ ok: true, value });
}

// ---------------------------------------------------------------------------
// The exact, independently derived allowed/forbidden method classification
// (Correction Phase 6 plan §7 screen inventory; see
// docs/plans/correction-phase-6-archive-ui-ownership-and-rebuild.md §9
// TASK-02 for the full per-method justification and exclusion reasons).
// ---------------------------------------------------------------------------

const EXPECTED_SERVICE_METHODS: readonly ArchiveUiServiceMethodName[] = [
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
];

// Forbidden: the card's mandatory exclusions (namespace admin, storage
// reconciliation/purge, the three deprecated legacy permission wrappers,
// upload/download — covered instead by `ArchiveUiFileTransport`) plus this
// task's own recorded decision to exclude `readFile` (not named by any §7
// screen — `listFilesForItem` already supplies full per-file metadata for
// display; no screen performs a standalone single-file detail fetch).
const FORBIDDEN_SERVICE_METHODS = [
  "bootstrapNamespacePermissions",
  "downloadFile",
  "grantFolderPermission",
  "listFolderPermissions",
  "purgeFile",
  "readFile",
  "reconcileStorageOperations",
  "recoverNamespaceManager",
  "revokeFolderPermission",
  "uploadFile",
] as const;

// The complete, directly-verified 47-method `ArchiveHostAdapter` surface
// (`src/archive/host-adapter.ts`), transcribed independently of the two
// lists above so the completeness assertion below is a real cross-check, not
// a tautology. Correction Phase 6 TASK-08A adds exactly two new methods,
// `listArchiveRoles` and `listArchiveRoleAssignmentsForRole` — 45 -> 47.
const ALL_HOST_ADAPTER_METHODS = [
  "assignArchiveRole",
  "bootstrapNamespacePermissions",
  "createArchiveRole",
  "createFolder",
  "createItem",
  "deleteArchiveRole",
  "downloadFile",
  "explainPermissions",
  "getEffectiveCapabilities",
  "getFolderPath",
  "grantFolderPermission",
  "listArchiveRoleAssignmentsForRole",
  "listArchiveRoles",
  "listChildFolders",
  "listFilesForItem",
  "listFolderPermissions",
  "listItemsInFolder",
  "listPermissionHistory",
  "listPermissionRules",
  "listRecoverableContent",
  "listRecoverableFilesForItem",
  "listResourceHistory",
  "listRootFolders",
  "purgeFile",
  "readFile",
  "readFolder",
  "readItem",
  "reconcileStorageOperations",
  "recoverNamespaceManager",
  "renameArchiveRole",
  "restoreFile",
  "restoreFolder",
  "restoreItem",
  "revokeFolderPermission",
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
  "uploadFile",
] as const;

// Compile-time cross-check that the hand-transcribed 47-name list above
// really is the exact key set of the real `ArchiveHostAdapter` interface
// (both directions) — if `host-adapter.ts` ever gains/loses/renames a
// method without this list being updated, `npm run typecheck:ui` fails here.
type AssertExactKeys<Expected extends string, Actual extends string> =
  [Expected] extends [Actual]
    ? [Actual] extends [Expected]
      ? true
      : ["missing from the hand-transcribed list", Exclude<Actual, Expected>]
    : ["stale entry no longer on ArchiveHostAdapter", Exclude<Expected, Actual>];

type _AllHostAdapterMethodsListIsExact = AssertExactKeys<
  (typeof ALL_HOST_ADAPTER_METHODS)[number],
  keyof ArchiveHostAdapter
>;
const _assertAllHostAdapterMethodsListIsExact: _AllHostAdapterMethodsListIsExact = true;

// Compile-time proof that none of the forbidden methods is structurally
// reachable through the narrowed `ArchiveUiServicePort` type.
type _NoForbiddenMethodOnServicePort = Extract<
  keyof ArchiveUiServicePort,
  (typeof FORBIDDEN_SERVICE_METHODS)[number]
> extends never
  ? true
  : ["forbidden method leaked onto ArchiveUiServicePort"];
const _assertNoForbiddenMethodOnServicePort: _NoForbiddenMethodOnServicePort = true;

// Correction Phase 6 TASK-08A: compile-time proof that the identity port's
// two method names are NOT structurally reachable through `ArchiveHostAdapter`
// or the narrowed `ArchiveUiServicePort` — the identity port is a separate,
// host-owned bridge capability, never folded into either.
type _IdentityMethodNamesNotOnHostAdapterOrServicePort = Extract<
  keyof ArchiveHostAdapter | keyof ArchiveUiServicePort,
  "resolvePlatformUsers" | "listAssignableCompanyMembers"
> extends never
  ? true
  : ["identity method leaked onto ArchiveHostAdapter or ArchiveUiServicePort"];
const _assertIdentityMethodNamesNotOnHostAdapterOrServicePort: _IdentityMethodNamesNotOnHostAdapterOrServicePort =
  true;

// ---------------------------------------------------------------------------
// A complete FAKE `ArchiveUiServicePort` implementation (test-local). Typed
// as an object LITERAL against `ArchiveUiServicePort` so TypeScript's excess-
// property AND missing-property checks both apply: adding an undeclared
// method or omitting a required one fails `npm run typecheck:ui`. This is
// therefore a genuine, physically-checked runtime reflection of the type's
// exact key set — not a duplicated hand-maintained runtime constant.
// ---------------------------------------------------------------------------

const fakeServicePort: ArchiveUiServicePort = {
  createFolder: () => ok(fixtureFolder),
  listRootFolders: () => ok([fixtureFolder]),
  listChildFolders: () => ok([fixtureFolder]),
  readFolder: () => ok(fixtureFolder),
  softDeleteFolder: () => ok(fixtureFolder),
  restoreFolder: () => ok(fixtureFolder),
  getFolderPath: () => ok(fixtureFolderPath),
  searchFolders: () => ok(fixtureFolderSearchResult),
  setFolderStatus: () => ok(fixtureFolder),
  setFolderDates: () => ok(fixtureFolder),
  createItem: () => ok(fixtureItem),
  listItemsInFolder: () => ok([fixtureItem]),
  readItem: () => ok(fixtureItem),
  softDeleteItem: () => ok(fixtureItem),
  restoreItem: () => ok(fixtureItem),
  searchItems: () => ok(fixtureItemSearchResult),
  setItemStatus: () => ok(fixtureItem),
  setItemDates: () => ok(fixtureItem),
  listFilesForItem: () => ok([fixtureFile]),
  softDeleteFile: () => ok(fixtureFile),
  restoreFile: () => ok(fixtureFile),
  listRecoverableContent: () => ok(fixtureRecoveryListing),
  listRecoverableFilesForItem: () => ok([fixtureRecoverableFile]),
  listResourceHistory: () => ok(fixtureHistoryPage),
  listPermissionHistory: () => ok(fixtureHistoryPage),
  setPermissionRule: () => ok(fixturePermission),
  revokePermissionRule: () => ok(fixturePermission),
  listPermissionRules: () => ok([fixturePermission]),
  getEffectiveCapabilities: () => ok(fixtureCapabilityMap),
  explainPermissions: () => ok(fixturePermissionExplanation),
  createArchiveRole: () => ok(fixtureRole),
  renameArchiveRole: () => ok(fixtureRole),
  deleteArchiveRole: () => ok(fixtureRole),
  assignArchiveRole: () => ok(fixtureRoleAssignment),
  unassignArchiveRole: () => ok(fixtureRoleAssignment),
  listArchiveRoles: () => ok([fixtureRoleSummary]),
  listArchiveRoleAssignmentsForRole: () => ok([fixtureRoleAssignmentSummary]),
};

const fakeTransport = {
  uploadFile: () => ok(fixtureFile),
  downloadFile: () => ok(fixtureFileDownload),
};

// Correction Phase 6 TASK-08A: a complete FAKE `ArchiveUiIdentityPort`
// implementation (test-local), typed as an object literal so excess-property
// and missing-property checks both apply — the same discipline as
// `fakeServicePort` above. No Shell/Prisma/database/network dependency.
const fakeIdentityPort: ArchiveUiIdentityPort = {
  resolvePlatformUsers: (platformUserIds) =>
    Promise.resolve({
      ok: true,
      value: platformUserIds
        .filter((id) => id === fixturePlatformUserDisplay.platformUserId)
        .map(() => fixturePlatformUserDisplay),
    }),
  listAssignableCompanyMembers: () =>
    Promise.resolve({ ok: true, value: [fixturePlatformUserDisplay] }),
};

const fakeContext: ArchiveContextInput = {
  userId: "user-1",
  companyId: "company-1",
  tenantId: "tenant-1",
  archiveModuleAccess: true,
};

// The complete FAKE bridge (scope item 10, first bullet): implementable with
// no Shell, Prisma, database, or network dependency — every field below is a
// plain in-memory function closing over the fixtures above.
const fakeBridge: ArchiveUiBridge = {
  getContext: () => fakeContext,
  getCurrentUserDisplay: () => ({ displayName: "Fixture User", email: "fixture@example.test" }),
  navigate: () => {
    /* host-supplied navigation intent handling — no-op in the fake */
  },
  service: fakeServicePort,
  transport: fakeTransport,
  translateError: (error) => ({
    category: error.category,
    title: "Archive request failed",
    description: "Something went wrong handling your Archive request.",
  }),
  identity: fakeIdentityPort,
};

// ---------------------------------------------------------------------------
// Compile-time-only probes (checked by `npm run typecheck:ui`, not executed
// at runtime): each `@ts-expect-error` below documents a capability the
// bridge contract must NOT structurally offer. If a future change
// accidentally widens the type to allow one of these, `typecheck:ui` starts
// failing here instead of silently regressing.
// ---------------------------------------------------------------------------

// The current-user display accessor must not accept a target-user argument —
// that would make it an other-user resolver, forbidden by the card.
// @ts-expect-error getCurrentUserDisplay must take no arguments (current-user-only, no other-user lookup)
fakeBridge.getCurrentUserDisplay("some-other-user-id");

// Forbidden service methods must not be assignable positions on the narrowed
// port, even via direct property access.
// @ts-expect-error bootstrapNamespacePermissions is not part of the narrowed service port
void fakeServicePort.bootstrapNamespacePermissions;
// @ts-expect-error recoverNamespaceManager is not part of the narrowed service port
void fakeServicePort.recoverNamespaceManager;
// @ts-expect-error purgeFile is not part of the narrowed service port
void fakeServicePort.purgeFile;
// @ts-expect-error reconcileStorageOperations is not part of the narrowed service port
void fakeServicePort.reconcileStorageOperations;
// @ts-expect-error uploadFile is not part of the narrowed service port (covered by the transport hook instead)
void fakeServicePort.uploadFile;
// @ts-expect-error downloadFile is not part of the narrowed service port (covered by the transport hook instead)
void fakeServicePort.downloadFile;
// @ts-expect-error grantFolderPermission (deprecated legacy wrapper) is not part of the narrowed service port
void fakeServicePort.grantFolderPermission;
// @ts-expect-error listFolderPermissions (deprecated legacy wrapper) is not part of the narrowed service port
void fakeServicePort.listFolderPermissions;
// @ts-expect-error revokeFolderPermission (deprecated legacy wrapper) is not part of the narrowed service port
void fakeServicePort.revokeFolderPermission;
// @ts-expect-error readFile is not part of the narrowed service port (not named by any §7 screen)
void fakeServicePort.readFile;

// Navigation intent must never carry a URL/router/chrome-shaped field.
const _navigationIntentHasNoUrlField: ArchiveUiNavigationIntent = {
  screen: "root",
  // @ts-expect-error navigation intent must not carry a "url" field
  url: "https://example.test/archive",
};
void _navigationIntentHasNoUrlField;

describe("Archive UI bridge contract (Correction Phase 6 TASK-02)", () => {
  it("a complete fake bridge implementation typechecks with no Shell/Prisma/database/network dependency", async () => {
    expect(fakeBridge.getContext()).toEqual(fakeContext);
    const created = await fakeBridge.service.createFolder(fakeContext, { name: "New folder" });
    expect(created).toEqual({ ok: true, value: fixtureFolder });
  });

  it("the exact service-method union equals the independently derived allowed set (sorted-list equality)", () => {
    expect(Object.keys(fakeServicePort).sort()).toEqual(
      [...EXPECTED_SERVICE_METHODS].sort(),
    );
  });

  it("the service port excludes every forbidden method", () => {
    for (const forbidden of FORBIDDEN_SERVICE_METHODS) {
      expect(
        Object.prototype.hasOwnProperty.call(fakeServicePort, forbidden),
        `expected "${forbidden}" to be absent from the narrowed service port`,
      ).toBe(false);
    }
  });

  it("the allowed set plus the forbidden set covers the exact real 47-method ArchiveHostAdapter surface", () => {
    const partitioned = [...EXPECTED_SERVICE_METHODS, ...FORBIDDEN_SERVICE_METHODS].sort();
    expect(partitioned).toEqual([...ALL_HOST_ADAPTER_METHODS].sort());
  });

  // Correction Phase 6 TASK-08A: the two role/assignment read methods exist
  // on the narrowed port with the exact minimal projection shapes — never the
  // full ArchiveRole/ArchiveRoleAssignment row.
  it("listArchiveRoles/listArchiveRoleAssignmentsForRole return the exact minimal {id,name}/{roleId,platformUserId} projections", async () => {
    const roles = await fakeBridge.service.listArchiveRoles(fakeContext);
    expect(roles).toEqual({ ok: true, value: [fixtureRoleSummary] });
    if (roles.ok) {
      expect(Object.keys(roles.value[0]).sort()).toEqual(["id", "name"]);
    }

    const assignments = await fakeBridge.service.listArchiveRoleAssignmentsForRole(
      fakeContext,
      "role-1",
    );
    expect(assignments).toEqual({
      ok: true,
      value: [fixtureRoleAssignmentSummary],
    });
    if (assignments.ok) {
      expect(Object.keys(assignments.value[0]).sort()).toEqual([
        "platformUserId",
        "roleId",
      ]);
    }
  });

  // Correction Phase 6 TASK-08A: the host-neutral identity port. Every
  // assertion below is checked ONLY through the public "./ui" surface
  // (../index.js) — no Shell/Prisma/platform-schema type is imported
  // anywhere in this file, so a type-level leak would fail
  // `npm run typecheck:ui` at the import statement itself, not here.
  describe("host identity bridge (Correction Phase 6 TASK-08A)", () => {
    it("is a required bridge property distinct from the service port and the file transport", () => {
      expect(fakeBridge.identity).toBe(fakeIdentityPort);
      expect(fakeBridge.identity).not.toBe(fakeBridge.service);
      expect(fakeBridge.identity).not.toBe(fakeBridge.transport);
      // Neither identity method is reachable on the host-adapter-derived
      // service port or the transport — it is a genuinely separate bridge
      // capability, not folded into either.
      expect(
        Object.prototype.hasOwnProperty.call(
          fakeServicePort,
          "resolvePlatformUsers",
        ),
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(
          fakeServicePort,
          "listAssignableCompanyMembers",
        ),
      ).toBe(false);
    });

    it("resolvePlatformUsers takes an array of ids and returns an ArchiveUiIdentityResult of an array of display rows, resolving at most one row per requested id and leaving unrequested/unknown ids unresolved", async () => {
      const result = await fakeIdentityPort.resolvePlatformUsers([
        fixturePlatformUserDisplay.platformUserId,
        "user-never-seen",
      ]);

      expect(result).toEqual({
        ok: true,
        value: [fixturePlatformUserDisplay],
      });
      if (result.ok) {
        // At most one row for the one id the fake can resolve; the unknown
        // id is simply absent (never fabricated).
        expect(result.value).toHaveLength(1);
        expect(result.value[0].platformUserId).toBe(
          fixturePlatformUserDisplay.platformUserId,
        );
      }
    });

    it("listAssignableCompanyMembers takes no arguments and returns an ArchiveUiIdentityResult of an array of display rows", async () => {
      expect(fakeIdentityPort.listAssignableCompanyMembers.length).toBe(0);

      const result = await fakeIdentityPort.listAssignableCompanyMembers();

      expect(result).toEqual({ ok: true, value: [fixturePlatformUserDisplay] });
    });

    it("ArchiveUiPlatformUserDisplay exposes platformUserId plus only the optional displayName/handle/email presentation fields", () => {
      const minimal: ArchiveUiPlatformUserDisplay = {
        platformUserId: "user-minimal",
      };
      expect(Object.keys(minimal)).toEqual(["platformUserId"]);

      expect(Object.keys(fixturePlatformUserDisplay).sort()).toEqual(
        ["displayName", "email", "handle", "platformUserId"].sort(),
      );
    });

    it("ArchiveUiIdentityResult is a closed ok/failure union: the success branch carries only ok/value, the failure branch only ok/failure", () => {
      const success: ArchiveUiIdentityResult<readonly ArchiveUiPlatformUserDisplay[]> =
        { ok: true, value: [fixturePlatformUserDisplay] };
      expect(Object.keys(success).sort()).toEqual(["ok", "value"]);

      const failure: ArchiveUiIdentityResult<readonly ArchiveUiPlatformUserDisplay[]> =
        {
          ok: false,
          failure: {
            kind: "denied",
            title: "Access denied",
            description: "You are not allowed to resolve this user.",
          },
        };
      expect(Object.keys(failure).sort()).toEqual(["failure", "ok"]);
    });

    it("ArchiveUiIdentityFailure carries only kind/title/description — no raw error/message/exception field", () => {
      const deniedFailure: ArchiveUiIdentityFailure = {
        kind: "denied",
        title: "Access denied",
        description: "You are not allowed to resolve this user.",
      };
      const errorFailure: ArchiveUiIdentityFailure = {
        kind: "error",
        title: "Something went wrong",
        description: "The user directory could not be reached.",
      };

      expect(Object.keys(deniedFailure).sort()).toEqual([
        "description",
        "kind",
        "title",
      ]);
      expect(Object.keys(errorFailure).sort()).toEqual([
        "description",
        "kind",
        "title",
      ]);

      const _poisoned: ArchiveUiIdentityFailure = {
        kind: "error",
        title: "Something went wrong",
        description: "The user directory could not be reached.",
        // @ts-expect-error ArchiveUiIdentityFailure must not carry a raw message/error/exception/cause field
        message: "raw internal reason that must not become primary UI copy",
      };
      void _poisoned;

      const _invalidKind: ArchiveUiIdentityFailure = {
        // @ts-expect-error kind is closed to "denied" | "error" — no other value
        kind: "forbidden",
        title: "Access denied",
        description: "You are not allowed to resolve this user.",
      };
      void _invalidKind;
    });
  });

  it("current-user display projection takes no arguments (cannot become an other-user resolver)", () => {
    expect(fakeBridge.getCurrentUserDisplay.length).toBe(0);
  });

  it("current-user display projection exposes only name/email display fields", () => {
    const display: ArchiveUiCurrentUserDisplay = { displayName: "Only Name" };
    expect(Object.keys(display).sort()).toEqual(["displayName"]);

    const both: ArchiveUiCurrentUserDisplay = {
      displayName: "Name",
      email: "name@example.test",
    };
    expect(Object.keys(both).sort()).toEqual(["displayName", "email"]);
  });

  it("navigation intent variants expose only intent fields, never a URL/router/chrome field", () => {
    const intents: ArchiveUiNavigationIntent[] = [
      { screen: "root" },
      { screen: "folder", folderId: "folder-1" },
      { screen: "item", itemId: "item-1" },
      { screen: "search" },
      { screen: "permissions", target: { targetType: "folder", targetId: "folder-1" } },
      { screen: "recovery" },
      { screen: "history", target: { targetType: "folder", targetId: "folder-1" } },
    ];

    const observedKeys = new Set<string>();
    for (const intent of intents) {
      for (const key of Object.keys(intent)) observedKeys.add(key);
    }

    expect([...observedKeys].sort()).toEqual(["folderId", "itemId", "screen", "target"]);

    const forbiddenKeywords = [
      "breadcrumb",
      "chrome",
      "href",
      "location",
      "modulePresentation",
      "path",
      "pathname",
      "route",
      "router",
      "title",
      "url",
      "window",
    ];
    for (const key of observedKeys) {
      expect(
        forbiddenKeywords.includes(key.toLowerCase()),
        `navigation intent key "${key}" looks like a forbidden URL/router/chrome field`,
      ).toBe(false);
    }
  });

  it("the error translator maps the closed ArchiveHostAdapterError categories to presentation data without requiring the raw message as copy", () => {
    const presentation = fakeBridge.translateError({
      category: "unauthorized",
      message: "raw internal reason that must not become primary UI copy",
    });

    expect(presentation.category).toBe("unauthorized");
    expect(typeof presentation.title).toBe("string");
    expect(typeof presentation.description).toBe("string");
    expect(presentation.title).not.toContain("raw internal reason");
    expect(presentation.description).not.toContain("raw internal reason");
  });
});
