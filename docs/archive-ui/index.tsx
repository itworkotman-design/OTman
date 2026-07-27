// Archive UI package export — Correction Phase 6 TASK-01 (package/export
// foundation) + TASK-02 (host-neutral UI bridge type contract) + TASK-03
// (shared Archive UI behavior/state primitives) + TASK-04 (the Archive
// root/home screen) + TASK-05 (the Archive folder/content screen). This
// directory is the ONLY source root the isolated UI compile graph
// (tsconfig.ui.json) reads. The service root tsconfig.json's `include` is
// `src/**/*.ts` (plain `.ts` only), so this `.tsx` file is never absorbed
// into the service build/typecheck graph without editing tsconfig.json —
// which no task does (see
// `docs/plans/correction-phase-6-archive-ui-ownership-and-rebuild.md` §9
// TASK-01/TASK-02/TASK-03/TASK-04/TASK-05 evidence for the recorded
// isolation-shape decisions).
//
// TASK-02's bridge contract stays TYPE-ONLY (unchanged from TASK-02). TASK-03
// added the first RUNTIME value exports the `"./ui"` surface has ever had:
// deliberate, exact shared behavior/state primitives (async view-state,
// state presentation, capability-aware action helpers, field validation,
// feedback, destructive confirmation) — never a business screen, route,
// host-chrome signal, identity resolver, or role-listing surface. TASK-04
// added the FIRST business-screen export, `ArchiveRootScreen` (the Archive
// module root/home screen). TASK-05 adds the SECOND — and, per this card,
// ONLY additional — business-screen export: `ArchiveFolderScreen`, the
// Archive module folder/content screen with its real permission-safe full
// breadcrumb. Both are consciously, narrowly allow-listed exceptions to the
// "no screen/route" discipline above (see
// `archive-ui-package-surface.test.tsx`'s explicit allow-list for the
// forbidden-name check). No item/search/permission/recovery/history screen
// is exported by this task.
export type {
  ArchiveUiBridge,
  ArchiveUiContextProvider,
  ArchiveUiCurrentUserDisplay,
  ArchiveUiErrorPresentation,
  ArchiveUiErrorTranslator,
  ArchiveUiFileTransport,
  ArchiveUiIdentityFailure,
  ArchiveUiIdentityPort,
  ArchiveUiIdentityResult,
  ArchiveUiNavigationIntent,
  ArchiveUiPlatformUserDisplay,
  ArchiveUiServiceMethodName,
  ArchiveUiServicePort,
} from "./bridge.js";

// -----------------------------------------------------------------------
// TASK-03 — shared async/view-state model + state-presentation primitive.
// -----------------------------------------------------------------------
export type {
  ArchiveUiLiveRegionIntent,
  ArchiveUiLiveRegionRole,
  ArchiveUiStateCopy,
  ArchiveUiStatePresentationCopySource,
  ArchiveUiStatePresentationDescriptor,
  ArchiveUiStatePresentationProps,
  ArchiveUiViewState,
  ArchiveUiViewStateDenied,
  ArchiveUiViewStateEmpty,
  ArchiveUiViewStateError,
  ArchiveUiViewStateLoading,
  ArchiveUiViewStateReady,
  ArchiveUiViewStateStatus,
} from "./view-state.js";
export {
  ArchiveUiStatePresentation,
  archiveUiViewStateDenied,
  archiveUiViewStateEmpty,
  archiveUiViewStateError,
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  describeArchiveUiViewState,
} from "./view-state.js";

// -----------------------------------------------------------------------
// TASK-03 — capability-aware action helpers (presentation guards only;
// backend authorization remains authoritative).
// -----------------------------------------------------------------------
export type {
  ArchiveUiCapabilityActionDescriptor,
  ArchiveUiCapabilityActionOptions,
  ArchiveUiCapabilityPresentation,
} from "./capabilities.js";
export {
  describeArchiveUiCapabilityAction,
  describeArchiveUiCapabilityActions,
} from "./capabilities.js";

// -----------------------------------------------------------------------
// TASK-03 — field-level validation primitives (types/helpers only; no form).
// -----------------------------------------------------------------------
export type {
  ArchiveUiFieldAccessibility,
  ArchiveUiFieldErrorEntry,
  ArchiveUiFieldErrorMap,
} from "./validation.js";
export {
  ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  archiveUiHasAnyFieldError,
} from "./validation.js";

// -----------------------------------------------------------------------
// TASK-03 — success/failure feedback primitives (explicit dismiss/reset;
// no host-framework toast infrastructure).
// -----------------------------------------------------------------------
export type {
  ArchiveUiFeedback,
  ArchiveUiFeedbackAction,
  ArchiveUiFeedbackBannerProps,
  ArchiveUiFeedbackIntent,
  ArchiveUiFeedbackLiveRegion,
  ArchiveUiFeedbackState,
} from "./feedback.js";
export {
  ArchiveUiFeedbackBanner,
  archiveUiFeedbackDismiss,
  archiveUiFeedbackIdle,
  archiveUiFeedbackLiveRegion,
  archiveUiFeedbackReducer,
  archiveUiFeedbackReset,
  archiveUiFeedbackShow,
} from "./feedback.js";

// -----------------------------------------------------------------------
// TASK-03 — destructive-confirmation primitives (caller-supplied
// confirm/cancel; the primitive never executes any Archive mutation).
// -----------------------------------------------------------------------
export type {
  ArchiveUiConfirmationLabels,
  ArchiveUiConfirmationState,
  ArchiveUiDestructiveConfirmationDescriptor,
  ArchiveUiDestructiveConfirmationDialogProps,
} from "./confirmation.js";
export {
  ArchiveUiDestructiveConfirmationDialog,
  archiveUiConfirmationCancel,
  archiveUiConfirmationIdle,
  archiveUiConfirmationRequest,
  archiveUiIsConfirmableLabel,
  archiveUiIsConfirmableLabels,
  describeArchiveUiDestructiveConfirmation,
} from "./confirmation.js";

// -----------------------------------------------------------------------
// TASK-04 — the Archive module root/home screen (§7 item 1). The ONLY new
// runtime export is the mountable screen component itself; its supporting
// controller/render helpers, state shape, and load/create outcome types stay
// internal to `root-screen.tsx` (imported directly by that file's own tests
// via a relative path, never re-exported here) — the smallest possible
// public surface. `ArchiveRootScreenProps` is the one supporting type export
// a host needs to type its own usage.
// -----------------------------------------------------------------------
export type { ArchiveRootScreenProps } from "./root-screen.js";
export { ArchiveRootScreen } from "./root-screen.js";

// -----------------------------------------------------------------------
// TASK-05 — the Archive module folder/content screen (§7 item 2). The ONLY
// new runtime export is the mountable screen component itself; its
// supporting controller/render helpers, state shape, and mutation-outcome
// types stay internal to `folder-screen.tsx` (imported directly by that
// file's own tests via a relative path, never re-exported here) — the
// smallest possible public surface. `ArchiveFolderScreenProps` is the one
// supporting type export a host needs to type its own usage.
// -----------------------------------------------------------------------
export type { ArchiveFolderScreenProps } from "./folder-screen.js";
export { ArchiveFolderScreen } from "./folder-screen.js";

// -----------------------------------------------------------------------
// TASK-06 Part A — the Archive module item/details and file-operations
// screen (§7 item 3). The ONLY new runtime export is the mountable screen
// component itself; its supporting controller/render helpers, state shape,
// and mutation-outcome types stay internal to `item-screen.tsx` (imported
// directly by that file's own tests via a relative path, never re-exported
// here) — the smallest possible public surface. `ArchiveItemScreenProps` is
// the one supporting type export a host needs to type its own usage.
// -----------------------------------------------------------------------
export type { ArchiveItemScreenProps } from "./item-screen.js";
export { ArchiveItemScreen } from "./item-screen.js";

// -----------------------------------------------------------------------
// TASK-06 Part B — the Archive module resource/permission history screen
// (§7 item 7). The ONLY new runtime export is the mountable screen
// component itself; its supporting controller/render helpers, state shape,
// and cursor-pagination internals stay internal to `history-screen.tsx`
// (imported directly by that file's own tests via a relative path, never
// re-exported here). `ArchiveHistoryScreenProps` and
// `ArchiveHistoryScreenTarget` are the smallest supporting type exports a
// host needs to type its own usage (a folder|item target narrowed to
// `ArchiveHistoryTargetType` — never namespace, never file history).
// -----------------------------------------------------------------------
export type {
  ArchiveHistoryScreenProps,
  ArchiveHistoryScreenTarget,
} from "./history-screen.js";
export { ArchiveHistoryScreen } from "./history-screen.js";

// -----------------------------------------------------------------------
// TASK-07 — the Archive module folder/item search screen (§7 item 4,
// A-SEARCH-002, A-UI-SEARCH-001). The ONLY new runtime export is the
// mountable screen component itself; its supporting mode/filter/query/
// page-state/cursor internals stay internal to `search-screen.tsx`
// (imported directly by that file's own tests via a relative path, never
// re-exported here) — the smallest possible public surface.
// `ArchiveSearchScreenProps` is the one supporting type export a host needs
// to type its own usage.
// -----------------------------------------------------------------------
export type { ArchiveSearchScreenProps } from "./search-screen.js";
export { ArchiveSearchScreen } from "./search-screen.js";

// -----------------------------------------------------------------------
// TASK-08 — the Archive module permission-management, role-management, and
// role-assignment screen (§7 item 5, A-UI-PERM-001, A-UI-DESTRUCT-001). The
// ONLY new runtime export is the mountable screen component itself; its
// supporting controller/render helpers, state shape, row-projection
// helpers, and role-admin/assignment internals stay internal to
// `permissions-screen.tsx` (imported directly by that file's own tests via
// a relative path, never re-exported here) — the smallest possible public
// surface. `ArchivePermissionsScreenProps` is the one supporting type export
// a host needs to type its own usage.
// -----------------------------------------------------------------------
export type { ArchivePermissionsScreenProps } from "./permissions-screen.js";
export { ArchivePermissionsScreen } from "./permissions-screen.js";

// -----------------------------------------------------------------------
// TASK-09 — the Archive module deleted-content recovery screen. The ONLY
// new runtime export is the mountable screen component itself; its
// supporting controller/render helpers, state shape, frozen-target-capture
// helpers, generation/disposal internals, and date formatting stay internal
// to `recovery-screen.tsx` (imported directly by that file's own tests via a
// relative path, never re-exported here) — the smallest possible public
// surface. `ArchiveRecoveryScreenProps` is the one supporting type export a
// host needs to type its own usage.
// -----------------------------------------------------------------------
export type { ArchiveRecoveryScreenProps } from "./recovery-screen.js";
export { ArchiveRecoveryScreen } from "./recovery-screen.js";
