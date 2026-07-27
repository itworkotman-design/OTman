// Archive UI host-neutral bridge type contract — Correction Phase 6 TASK-02
// (host-neutral Archive UI bridge and authorized read projections). Type-only
// production source: no runtime value is defined or exported anywhere in this
// file, matching TASK-01's "./ui" empty-runtime-surface discipline (see
// `src/archive-ui/index.tsx`).
//
// Every domain/input/result type this file references comes from the public
// Archive ROOT package surface via the package's own self-referenced name
// (`@customprojects/custom-archive`, resolved through this package's own
// `package.json` `exports["."]`), never via a relative import that reaches
// outside `src/archive-ui/` — a relative import crossing that boundary would
// both violate `tsconfig.ui.build.json`'s `rootDir: "src/archive-ui"` and is
// independently forbidden by the Phase 6 TASK-02 controller task card, which
// requires production type imports to come only "from the public Archive
// package/root surface or local Archive UI files". Self-reference resolution
// was verified directly against this repository's compiler (`tsc -p
// tsconfig.ui.json --noEmit`) before being adopted here — see the TASK-02
// implementation record in
// `docs/plans/correction-phase-6-archive-ui-ownership-and-rebuild.md` §9 for
// the compiler evidence.
import type {
  ArchiveAuthorizationTargetInput,
  ArchiveContextInput,
  ArchiveHostAdapter,
  ArchiveHostAdapterError,
  ArchiveHostAdapterErrorCategory,
} from "@customprojects/custom-archive";

// Correction Phase 6 plan §7: the exact, independently derived set of
// `ArchiveHostAdapter` methods the seven planned Phase 6 screens actually
// need, expressed transparently as a named string-literal union (the plan
// §9 TASK-02 "named union of method-name literals + Pick<ArchiveHostAdapter,
// ...>" guidance), sorted alphabetically. Every one of the 44 TASK-02-era
// methods on `ArchiveHostAdapter` is EITHER in this union OR in the excluded
// set documented in the plan's TASK-02 evidence — see that record for the
// exact per-method §7 screen justification and the full exclusion list with
// reasons (namespace admin, storage reconciliation/purge, deprecated legacy
// permission wrappers, upload/download — covered instead by
// `ArchiveUiFileTransport` below — and `readFile`, not named by any §7
// screen). Correction Phase 6 TASK-06A (controller-approved architecture
// prerequisite before Phase 6 TASK-06) adds exactly one further, additive
// entry, `listRecoverableFilesForItem` — 44/34 -> 45/35 — the deleted-file
// discovery projection a future TASK-06 screen needs to truthfully offer
// `restoreFile`. Correction Phase 6 TASK-08A (controller-approved
// architecture prerequisite before Phase 6 TASK-08) adds exactly two further
// additive entries, `listArchiveRoles` and
// `listArchiveRoleAssignmentsForRole` — 45/35 -> 47/37 — the permission-safe
// role/assignment read projections a future TASK-08 permission screen needs;
// see the archive-ui-bridge-contract.test.tsx partition proof for the exact
// updated 47-method allow/forbidden split.
export type ArchiveUiServiceMethodName =
  | "assignArchiveRole"
  | "createArchiveRole"
  | "createFolder"
  | "createItem"
  | "deleteArchiveRole"
  | "explainPermissions"
  | "getEffectiveCapabilities"
  | "getFolderPath"
  | "listArchiveRoleAssignmentsForRole"
  | "listArchiveRoles"
  | "listChildFolders"
  | "listFilesForItem"
  | "listItemsInFolder"
  | "listPermissionHistory"
  | "listPermissionRules"
  | "listRecoverableContent"
  | "listRecoverableFilesForItem"
  | "listResourceHistory"
  | "listRootFolders"
  | "readFolder"
  | "readItem"
  | "renameArchiveRole"
  | "restoreFile"
  | "restoreFolder"
  | "restoreItem"
  | "revokePermissionRule"
  | "searchFolders"
  | "searchItems"
  | "setFolderDates"
  | "setFolderStatus"
  | "setItemDates"
  | "setItemStatus"
  | "setPermissionRule"
  | "softDeleteFile"
  | "softDeleteFolder"
  | "softDeleteItem"
  | "unassignArchiveRole";

// The narrowed Archive service port: an exact, transparent `Pick` over the
// public `ArchiveHostAdapter` type restricted to `ArchiveUiServiceMethodName`
// above. Every method keeps its real `ArchiveHostAdapter` signature (context
// input, domain input, `ArchiveHostAdapterResult<T>` output) unchanged — this
// is a direct typed pass-through, never a duplicated/rewritten DTO.
export type ArchiveUiServicePort = Pick<
  ArchiveHostAdapter,
  ArchiveUiServiceMethodName
>;

// Upload/download transport hooks (Phase 6 plan §5/§7 item 3), deliberately
// EXCLUDED from `ArchiveUiServicePort` above (plan §9 TASK-02 requirement 5:
// "upload/download methods if those operations are represented by the
// separate transport hooks, to avoid duplicate competing paths") and
// expressed here instead as their own narrow `Pick`, reusing the exact same
// public `uploadFile`/`downloadFile` signatures (and therefore the exact
// same public byte/domain types — `UploadArchiveFileInput`,
// `ArchiveFileDownload`, `ArchiveFile`, `ArchiveHostAdapterResult`) without
// duplicating them. Host-neutral by construction: nothing here assumes
// in-process invocation vs. an HTTP round trip — a host may implement this
// interface either way.
export type ArchiveUiFileTransport = Pick<
  ArchiveHostAdapter,
  "uploadFile" | "downloadFile"
>;

// Current-user-only, optional/minimal human display projection (Phase 6 plan
// §5 "Additive, safely plannable" row; §6 controller stop on *other*-user
// identity explicitly NOT addressed here). Deliberately a zero-argument
// accessor: it can only ever describe the CURRENT caller (there is no
// parameter through which any other user's id could be supplied), so it
// cannot become an other-user resolver, a batch/list lookup, or any kind of
// identity-directory contract.
export interface ArchiveUiCurrentUserDisplay {
  readonly displayName?: string;
  readonly email?: string;
}

// Archive module navigation intent (Phase 6 plan §5 "Frozen-spec-dictated"
// row; §7's seven-screen inventory). Intent only: no URL/path string, no
// Next.js/router type, no `window.location` usage, no Shell import, no page
// title, no breadcrumb-registration signal, and no module presentation
// descriptor (the plan's explicit §5/§9 TASK-02 chrome-signal exclusion —
// that stop remains open and untouched by this contract). `target` reuses
// the existing public `ArchiveAuthorizationTargetInput` shape
// (`getEffectiveCapabilities`/`explainPermissions` already use it) rather
// than inventing a parallel target descriptor.
export type ArchiveUiNavigationIntent =
  | { readonly screen: "root" }
  | { readonly screen: "folder"; readonly folderId: string }
  | { readonly screen: "item"; readonly itemId: string }
  | { readonly screen: "search" }
  | {
      readonly screen: "permissions";
      readonly target: ArchiveAuthorizationTargetInput;
    }
  | { readonly screen: "recovery" }
  | {
      readonly screen: "history";
      readonly target: ArchiveAuthorizationTargetInput;
    };

// Safe, closed error-presentation result (Phase 6 plan §5 "Additive, safely
// plannable" row; A-UI-STATE-001). `category` stays the SAME closed
// four-value `ArchiveHostAdapterErrorCategory` the host adapter already
// defines — this is a translation BOUNDARY, not a second error taxonomy.
// `title`/`description` are calm, host-supplied presentation copy; the
// adapter's raw `message` string is deliberately not part of this shape, so
// nothing requires a raw backend reason string to reach UI copy.
export interface ArchiveUiErrorPresentation {
  readonly category: ArchiveHostAdapterErrorCategory;
  readonly title: string;
  readonly description: string;
}

export type ArchiveUiErrorTranslator = (
  error: ArchiveHostAdapterError,
) => ArchiveUiErrorPresentation;

// Current tenant/company/platform-user context supply (Phase 6 plan §5
// "Frozen-spec-dictated" row): a zero-argument accessor returning the exact
// public `ArchiveContextInput` shape every `ArchiveHostAdapter` method
// already requires, so the bridge never invents a parallel context shape.
export type ArchiveUiContextProvider = () => ArchiveContextInput;

// Correction Phase 6 TASK-08A prerequisite: the host-neutral, type-only
// identity bridge. Archive owns Archive-role/assignment DATA (the two new
// `ArchiveUiServiceMethodName` reads above); the host (Shell) owns human
// Platform-user IDENTITY and company membership — Archive stores only opaque
// `platformUserId` references and never queries Platform tables. This port
// is therefore intentionally NOT part of `ArchiveHostAdapter` or
// `ArchiveUiServicePort`: it is a separate, host-owned bridge capability. No
// Shell/Prisma/platform-schema type is imported here or anywhere else in
// this file — every type below is defined locally from primitives.
//
// `platformUserId` is an opaque key: it exists only for typed calls,
// equality, React keys/test hooks, and host lookup correlation. Future UI
// must never render it as normal or accessible copy.
//
// Human display priority for future UI is `displayName`, then `handle`,
// then `email`, otherwise the honest placeholder "Unresolved user" — the raw
// id is never a fallback.
export interface ArchiveUiPlatformUserDisplay {
  readonly platformUserId: string;
  readonly displayName?: string;
  readonly handle?: string;
  readonly email?: string;
}

// Closed failure shape carrying ONLY safe, host-supplied presentation copy —
// no raw database, auth-provider, route, or exception reason is part of this
// contract (mirroring `ArchiveUiErrorPresentation`'s translation-boundary
// discipline above, but independent of it: this failure has no
// `ArchiveHostAdapterErrorCategory`, since identity resolution is not an
// Archive host-adapter operation).
export interface ArchiveUiIdentityFailure {
  readonly kind: "denied" | "error";
  readonly title: string;
  readonly description: string;
}

export type ArchiveUiIdentityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ArchiveUiIdentityFailure };

// Host-neutral identity resolution/selection capability (Phase 6 TASK-08A
// controller decision):
//
// - `resolvePlatformUsers` is company-scoped and resolves only requested ids
//   the host may reveal within the current company. At most one row per
//   requested id; omitted ids remain unresolved. It may resolve
//   inactive/disabled/historical company members when needed to display an
//   existing rule/assignment/history subject, but it must never return an
//   unrelated global user.
// - `listAssignableCompanyMembers` returns only active Platform users with
//   active membership in the current company. It is the only approved
//   new-user selection source for future permission/assignment forms — no
//   raw UUID textbox is permitted.
// - Display fields are presentation data only and never an authorization
//   input.
// - No search-by-email/handle global directory, pagination protocol,
//   membership mutation, invitation flow, or Shell implementation is
//   introduced by this type-only contract.
export interface ArchiveUiIdentityPort {
  readonly resolvePlatformUsers: (
    platformUserIds: readonly string[],
  ) => Promise<
    ArchiveUiIdentityResult<readonly ArchiveUiPlatformUserDisplay[]>
  >;

  readonly listAssignableCompanyMembers: () => Promise<
    ArchiveUiIdentityResult<readonly ArchiveUiPlatformUserDisplay[]>
  >;
}

// The complete host-neutral Archive UI bridge contract (Phase 6 plan §5,
// card "Public type-shape guidance"). A host (in-process, HTTP-backed, or
// otherwise) implements this interface; Archive UI production code depends
// on nothing beyond it — no Shell import, no direct Prisma/host-adapter
// construction. Every field is read-only: the bridge is a supplied
// dependency, not a mutable UI-owned object.
export interface ArchiveUiBridge {
  readonly getContext: ArchiveUiContextProvider;
  readonly getCurrentUserDisplay: () => ArchiveUiCurrentUserDisplay | undefined;
  readonly navigate: (intent: ArchiveUiNavigationIntent) => void;
  readonly service: ArchiveUiServicePort;
  readonly transport: ArchiveUiFileTransport;
  readonly translateError: ArchiveUiErrorTranslator;
  // Correction Phase 6 TASK-08A prerequisite: the host-owned identity port
  // (see above). Required on every bridge implementation from this task
  // forward — the real Shell implementation remains Phase 7/host
  // integration work; this task defines only the type contract.
  readonly identity: ArchiveUiIdentityPort;
}
