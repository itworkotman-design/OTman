// Archive UI folder/content screen — Correction Phase 6 TASK-05 (§7 item 2,
// A-UI-BREADCRUMB-001, A-UI-STATE-001, A-UI-ACTION-001, A-UI-FORM-001,
// A-UI-FEEDBACK-001, A-UI-DESTRUCT-001, A-UI-RESP-001). The Archive module's
// folder/content screen: shows one folder's header, its real permission-safe
// full breadcrumb (`getFolderPath`), its child folders and items as separate
// lists, and — capability permitting — lets the caller create a child
// folder/item, edit the folder's status/dates, or soft-delete the folder.
// Host-neutral: depends only on the TASK-02 bridge contract (`./bridge.js`),
// the TASK-03 shared primitives (`./view-state.js`, `./capabilities.js`,
// `./validation.js`, `./feedback.js`, `./confirmation.js`), and the public
// Archive root package surface (`@customprojects/archive-service`) — no
// Shell/Next.js/router/window/document-global/Prisma/repository/service/
// internal-Archive import anywhere in this file. Item details, file
// operations, search, permissions/roles, and recovery are explicitly out of
// scope for this screen (TASK-06/07/08/09).
//
// HOOK-CALL CONSTRAINT: identical reasoning to `root-screen.tsx`'s file-top
// comment (this repository's test toolchain has no `react-dom`/renderer, and
// React's hook dispatcher is `null` outside an active render performed by a
// real renderer), so `ArchiveFolderScreen` is a `React.Component` SUBCLASS —
// the same standard, first-class React component form TASK-04 already
// establishes as this repository's accepted no-renderer pattern — not a
// parallel/competing rendering system.
import * as React from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactElement } from "react";

import type { ArchiveUiBridge, ArchiveUiErrorPresentation } from "./bridge.js";
import {
  archiveUiViewStateDenied,
  archiveUiViewStateEmpty,
  archiveUiViewStateError,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state.js";
import {
  describeArchiveUiCapabilityActions,
  type ArchiveUiCapabilityActionDescriptor,
} from "./capabilities.js";
import {
  ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  archiveUiHasAnyFieldError,
  type ArchiveUiFieldErrorMap,
} from "./validation.js";
import {
  archiveUiFeedbackDismiss,
  archiveUiFeedbackIdle,
  archiveUiFeedbackShow,
  ArchiveUiFeedbackBanner,
  type ArchiveUiFeedbackState,
} from "./feedback.js";
import {
  archiveUiConfirmationCancel,
  archiveUiConfirmationIdle,
  archiveUiConfirmationRequest,
  ArchiveUiDestructiveConfirmationDialog,
  type ArchiveUiConfirmationState,
} from "./confirmation.js";
import type {
  ArchiveBusinessStatus,
  ArchiveContextInput,
  ArchiveFolder,
  ArchiveFolderPathEntry,
  ArchiveHostAdapterError,
  ArchiveItem,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveFolderScreen`'s methods call — not a
// duplicated stand-in — so testing these functions directly and testing the
// class instance's wiring together cover the real implementation with no
// gap.
// ---------------------------------------------------------------------------

// The exact, closed four-action capability gate this screen needs (card
// scope item 8): `create` (child folder/item), `manage_status`,
// `manage_metadata`, `delete` — all evaluated on the FOLDER target, never a
// second/invented target.
const ARCHIVE_FOLDER_SCREEN_CAPABILITY_ACTIONS = [
  "create",
  "manage_status",
  "manage_metadata",
  "delete",
] as const;

export type ArchiveFolderScreenCapabilities = Readonly<
  Record<
    (typeof ARCHIVE_FOLDER_SCREEN_CAPABILITY_ACTIONS)[number],
    ArchiveUiCapabilityActionDescriptor
  >
>;

export interface ArchiveFolderScreenContent {
  readonly childFolders: ArchiveFolder[];
  readonly items: ArchiveItem[];
}

export interface ArchiveFolderScreenData {
  readonly folder: ArchiveFolder;
  readonly path: ArchiveFolderPathEntry[];
  readonly capabilities: ArchiveFolderScreenCapabilities;
  readonly childFolders: ArchiveFolder[];
  readonly items: ArchiveItem[];
}

export interface ArchiveFolderScreenLoadResult {
  readonly context: ArchiveContextInput;
  readonly viewState: ArchiveUiViewState<ArchiveFolderScreenData>;
}

// Shared failure-path construction for `archiveUiLoadFolderScreenData` below:
// an `unauthorized` error becomes the calm `denied` state; every other
// category routes through the bridge's own `translateError` into `error` —
// neither path ever reads `error.message` directly (card scope item 4).
function archiveUiFolderScreenFailureResult(
  context: ArchiveContextInput,
  bridge: ArchiveUiBridge,
  error: ArchiveHostAdapterError,
): ArchiveFolderScreenLoadResult {
  const presentation = bridge.translateError(error);
  const viewState: ArchiveUiViewState<ArchiveFolderScreenData> =
    error.category === "unauthorized"
      ? archiveUiViewStateDenied(presentation)
      : archiveUiViewStateError(presentation);
  return { context, viewState };
}

// Folder loading (card scope item 3/4): obtains the current context and
// issues the exact five required reads for the requested folder in
// parallel — `readFolder`, `getFolderPath`, `listChildFolders`,
// `listItemsInFolder`, `getEffectiveCapabilities` on the FOLDER target — no
// invented second target/projection.
//
// Deterministic failure precedence (card scope item 4): an `unauthorized`
// result from ANY of the five reads has the highest presentation priority
// and produces the calm `denied` state, independent of which read is
// checked first below — the first pass below checks EVERY read's category
// for `unauthorized` in the documented order before the second pass ever
// runs. If none of the five failures is `unauthorized`, the second pass
// selects the FIRST failure in the exact documented order: `readFolder`,
// `getFolderPath`, `listChildFolders`, `listItemsInFolder`,
// `getEffectiveCapabilities`. Every failure passes only through
// `bridge.translateError` — raw adapter messages never become rendered
// copy.
export async function archiveUiLoadFolderScreenData(
  bridge: ArchiveUiBridge,
  folderId: string,
): Promise<ArchiveFolderScreenLoadResult> {
  const context = bridge.getContext();
  const [folderResult, pathResult, childFoldersResult, itemsResult, capabilitiesResult] =
    await Promise.all([
      bridge.service.readFolder(context, folderId),
      bridge.service.getFolderPath(context, folderId),
      bridge.service.listChildFolders(context, folderId),
      bridge.service.listItemsInFolder(context, folderId),
      bridge.service.getEffectiveCapabilities(context, {
        targetType: "folder",
        targetId: folderId,
      }),
    ]);

  // Pass 1: `unauthorized` from ANY read wins, checked in the documented
  // order (readFolder, getFolderPath, listChildFolders, listItemsInFolder,
  // getEffectiveCapabilities) — this order only matters for WHICH
  // `unauthorized` error's presentation is used when more than one read is
  // unauthorized; the resulting `denied` status itself does not depend on
  // which required read failed, or on any non-unauthorized failure among
  // the others.
  if (!folderResult.ok && folderResult.error.category === "unauthorized") {
    return archiveUiFolderScreenFailureResult(context, bridge, folderResult.error);
  }
  if (!pathResult.ok && pathResult.error.category === "unauthorized") {
    return archiveUiFolderScreenFailureResult(context, bridge, pathResult.error);
  }
  if (!childFoldersResult.ok && childFoldersResult.error.category === "unauthorized") {
    return archiveUiFolderScreenFailureResult(context, bridge, childFoldersResult.error);
  }
  if (!itemsResult.ok && itemsResult.error.category === "unauthorized") {
    return archiveUiFolderScreenFailureResult(context, bridge, itemsResult.error);
  }
  if (!capabilitiesResult.ok && capabilitiesResult.error.category === "unauthorized") {
    return archiveUiFolderScreenFailureResult(context, bridge, capabilitiesResult.error);
  }

  // Pass 2: none of the five failures (if any) is `unauthorized` at this
  // point — select the first failure in the exact same documented order.
  // Five sequential guards (rather than one combined condition) so
  // TypeScript narrows each result to `{ ok: true; ... }` for the success
  // path below with no unreachable branch.
  if (!folderResult.ok) {
    return archiveUiFolderScreenFailureResult(context, bridge, folderResult.error);
  }
  if (!pathResult.ok) {
    return archiveUiFolderScreenFailureResult(context, bridge, pathResult.error);
  }
  if (!childFoldersResult.ok) {
    return archiveUiFolderScreenFailureResult(context, bridge, childFoldersResult.error);
  }
  if (!itemsResult.ok) {
    return archiveUiFolderScreenFailureResult(context, bridge, itemsResult.error);
  }
  if (!capabilitiesResult.ok) {
    return archiveUiFolderScreenFailureResult(context, bridge, capabilitiesResult.error);
  }

  // All five reads succeeded: derive the four-action capability-presentation
  // map from the real `ArchiveEffectiveCapabilityMap` (no second
  // authorization model) and always represent the load as `ready` — this
  // screen's "both collections empty" semantics are a CONTENT-level concern
  // (see `archiveUiFolderScreenContentState` below), never a reason to
  // discard the already-loaded folder header/breadcrumb/capabilities (card
  // scope item 5).
  const capabilities = describeArchiveUiCapabilityActions(
    capabilitiesResult.value,
    ARCHIVE_FOLDER_SCREEN_CAPABILITY_ACTIONS,
  );
  const data: ArchiveFolderScreenData = {
    folder: folderResult.value,
    path: pathResult.value,
    capabilities,
    childFolders: childFoldersResult.value,
    items: itemsResult.value,
  };
  return { context, viewState: archiveUiViewStateReady(data) };
}

// Content-level empty/ready derivation (card scope item 5): "empty" means
// BOTH the child-folder and item collections are empty. This is computed
// separately from the screen-level `viewState` above precisely so the
// folder header, full breadcrumb, and permitted actions never disappear
// merely because content happens to be empty — they are already carried by
// the outer `ready` data regardless of this derived sub-state. Still built
// from the SAME TASK-03 constructors (`archiveUiViewStateEmpty`/
// `archiveUiViewStateReady`) so the shared state-presentation primitive
// renders it identically to every other Archive UI empty/ready case.
export function archiveUiFolderScreenContentState(
  data: ArchiveFolderScreenData,
): ArchiveUiViewState<ArchiveFolderScreenContent> {
  if (data.childFolders.length === 0 && data.items.length === 0) {
    return archiveUiViewStateEmpty();
  }
  return archiveUiViewStateReady({
    childFolders: data.childFolders,
    items: data.items,
  });
}

// ---------------------------------------------------------------------------
// Breadcrumb presentation (card scope item 6, A-UI-BREADCRUMB-001). Pure
// derivation from the real `getFolderPath` result in its exact root-first
// order — never collapses hidden ancestors, never fabricates a parent
// name/id. The ONE Archive-root control is rendered separately by the
// component itself (it is not part of `path`).
// ---------------------------------------------------------------------------

export type ArchiveUiFolderBreadcrumbEntry =
  | { readonly kind: "hidden" }
  | { readonly kind: "ancestor"; readonly folderId: string; readonly label: string }
  | { readonly kind: "current"; readonly folderId: string; readonly label: string };

// The last entry in `getFolderPath`'s root-first result is always the
// requested folder itself (the reader's own chain is nearest-target-first,
// reversed to root-first) — every entry before it is an ancestor. A
// `name === null` visible entry renders the calm non-ID fallback
// "Unnamed folder"; a hidden entry carries no fabricated id/name.
export function archiveUiFolderScreenBreadcrumb(
  path: readonly ArchiveFolderPathEntry[],
): ArchiveUiFolderBreadcrumbEntry[] {
  const lastIndex = path.length - 1;
  return path.map((entry, index) => {
    if (entry.hidden) {
      return { kind: "hidden" };
    }
    const label = entry.name ?? "Unnamed folder";
    return index === lastIndex
      ? { kind: "current", folderId: entry.folderId, label }
      : { kind: "ancestor", folderId: entry.folderId, label };
  });
}

// ---------------------------------------------------------------------------
// Client-side layer over server authority (card scope items 9/10): a
// trimmed-empty name is the only client validation rule for the bounded
// create-child-folder/create-item flows — everything else is left to the
// backend.
// ---------------------------------------------------------------------------

function archiveUiValidateRequiredName(
  name: string,
  message: string,
): ArchiveUiFieldErrorMap {
  if (name.trim().length === 0) {
    return archiveUiFieldErrorMapFromEntries([{ field: "name", message }]);
  }
  return ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP;
}

export function archiveUiValidateChildFolderName(name: string): ArchiveUiFieldErrorMap {
  return archiveUiValidateRequiredName(name, "Enter a folder name.");
}

export function archiveUiValidateItemName(name: string): ArchiveUiFieldErrorMap {
  return archiveUiValidateRequiredName(name, "Enter an item name.");
}

export interface ArchiveUiCreateChildFolderInput {
  readonly name: string;
  readonly description: string;
}

export type ArchiveUiCreateChildFolderOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly folder: ArchiveFolder };

// The bounded create-child-folder flow (card scope item 9): a trimmed-empty
// name never reaches `createFolder`; a valid submit always passes
// `parentFolderId: folderId` (a CHILD of the current screen's folder, never
// a root/second target); a blank description is normalized to `null`.
export async function archiveUiSubmitCreateChildFolder(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  folderId: string,
  input: ArchiveUiCreateChildFolderInput,
): Promise<ArchiveUiCreateChildFolderOutcome> {
  const fieldErrors = archiveUiValidateChildFolderName(input.name);
  if (archiveUiHasAnyFieldError(fieldErrors)) {
    return { kind: "validation", fieldErrors };
  }
  const trimmedDescription = input.description.trim();
  const result = await bridge.service.createFolder(context, {
    name: input.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    parentFolderId: folderId,
  });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", folder: result.value };
}

export interface ArchiveUiCreateItemInput {
  readonly name: string;
  readonly description: string;
}

export type ArchiveUiCreateItemOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly item: ArchiveItem };

// The bounded create-item flow (card scope item 10): `itemType: "record"` is
// passed EXPLICITLY on every call — the public `CreateArchiveItemInput.itemType`
// is optional with no repository-proven documented default, so this screen
// never relies on an implicit default (recorded decision, card scope item
// 10's "(or omit itemType only if the public input's default is proven and
// recorded)" clause: no such proof exists, so it is always supplied).
export async function archiveUiSubmitCreateItem(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  folderId: string,
  input: ArchiveUiCreateItemInput,
): Promise<ArchiveUiCreateItemOutcome> {
  const fieldErrors = archiveUiValidateItemName(input.name);
  if (archiveUiHasAnyFieldError(fieldErrors)) {
    return { kind: "validation", fieldErrors };
  }
  const trimmedDescription = input.description.trim();
  const result = await bridge.service.createItem(context, {
    folderId,
    name: input.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    itemType: "record",
  });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", item: result.value };
}

// Deterministic visible-list updates after a successful create (card scope
// items 9/10: "deterministically update the visible ... collection").
// Appends the newly created resource onto the currently loaded data without
// an extra round trip to `listChildFolders`/`listItemsInFolder`.
export function archiveUiApplyCreatedChildFolder(
  data: ArchiveFolderScreenData,
  folder: ArchiveFolder,
): ArchiveFolderScreenData {
  return { ...data, childFolders: [...data.childFolders, folder] };
}

export function archiveUiApplyCreatedItem(
  data: ArchiveFolderScreenData,
  item: ArchiveItem,
): ArchiveFolderScreenData {
  return { ...data, items: [...data.items, item] };
}

// Applying a returned updated folder (status/date mutations both return the
// full updated `ArchiveFolder`) onto the currently loaded data — the single
// shared visible-projection update both mutations below use.
export function archiveUiApplyUpdatedFolder(
  data: ArchiveFolderScreenData,
  folder: ArchiveFolder,
): ArchiveFolderScreenData {
  return { ...data, folder };
}

// ---------------------------------------------------------------------------
// Status editing (card scope item 11): exact closed four-status set, gated
// by `manage_status`.
// ---------------------------------------------------------------------------

export const ARCHIVE_FOLDER_SCREEN_STATUSES: readonly ArchiveBusinessStatus[] = [
  "active",
  "inactive",
  "draft",
  "archived",
];

export type ArchiveUiSetFolderStatusOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly folder: ArchiveFolder };

export async function archiveUiSubmitFolderStatus(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  folderId: string,
  status: ArchiveBusinessStatus,
): Promise<ArchiveUiSetFolderStatusOutcome> {
  const result = await bridge.service.setFolderStatus(context, folderId, { status });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", folder: result.value };
}

// ---------------------------------------------------------------------------
// Due/expiry editing (card scope item 12): gated by `manage_metadata`. Input
// representation decision (documented and tested — repaired under
// CORRECTION-P6-TASK-05-REPAIR-R1 after a controller finding of a non-UTC
// round-trip defect in the original implementation, see below): each field
// uses an HTML `datetime-local`-shaped control value (`YYYY-MM-DDTHH:mm`,
// optionally `:ss`). ONE coherent representation is used throughout: LOCAL
// wall-clock components, both for display (`archiveUiFolderDateToInputValue`
// formats using `Date.prototype.getFullYear`/`getMonth`/... — the LOCAL
// getters, never `toISOString`) and for parsing a changed value
// (`archiveUiParseFolderDateTimeLocal` constructs `new Date(year, month - 1,
// day, hour, minute, second)` — the LOCAL multi-arg constructor, the exact
// same interpretation a real `datetime-local` control's value receives).
// Formatting and parsing therefore never disagree on which timezone they
// mean, which is what makes an unmodified load-then-save round trip safe
// regardless of the browser's timezone.
//
// A `datetime-local` control (no `step` attribute) cannot represent seconds
// or milliseconds — display necessarily TRUNCATES the stored instant to the
// minute. To avoid silently rounding a stored value that is merely being
// resubmitted unchanged, each field's converter is given both the CURRENT
// visible value and the value/instant it was loaded (or last saved) with. If
// the visible value is unmodified, the original exact instant (including any
// seconds/millis) is preserved verbatim rather than re-derived from the
// truncated display string. Only a genuinely CHANGED value is parsed via
// `archiveUiParseFolderDateTimeLocal`, which validates the input shape
// strictly (a `YYYY-MM-DDTHH:mm[:ss]` regex) and then round-trip-compares
// the constructed `Date`'s own local getters back against the parsed numeric
// components — this rejects both malformed strings AND calendar-normalized/
// impossible values (e.g. `2026-02-30`, which the native `Date` constructor
// silently rolls forward into a different valid date) — it does NOT rely
// only on `Number.isNaN(new Date(...).getTime())`, which accepts those
// impossible values. On submit, a blank field maps to `null`; a valid
// nonblank field converts to a strict RFC 3339 string via
// `Date.prototype.toISOString()` BEFORE the adapter call — an invalid
// nonblank value never reaches `setFolderDates`, producing a field-specific
// error instead. The screen never passes the control's ambiguous
// local-format string directly to the adapter.
// ---------------------------------------------------------------------------

export function archiveUiFolderDateToInputValue(date: Date | null): string {
  if (date === null) return "";
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const ARCHIVE_UI_DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Strictly parses a `datetime-local`-shaped string as LOCAL wall-clock
// components (matching `archiveUiFolderDateToInputValue`'s formatting
// convention above), returning `null` for both malformed shapes and
// calendar-impossible values (round-trip-verified against the constructed
// `Date`'s own local getters — the native constructor otherwise silently
// normalizes e.g. `2026-02-30` into a different valid date instead of
// rejecting it).
function archiveUiParseFolderDateTimeLocal(value: string): Date | null {
  const match = ARCHIVE_UI_DATETIME_LOCAL_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const candidate = new Date(year, month - 1, day, hour, minute, second, 0);
  const isRealCalendarDate =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day &&
    candidate.getHours() === hour &&
    candidate.getMinutes() === minute &&
    candidate.getSeconds() === second;
  return isRealCalendarDate ? candidate : null;
}

// One due/expiry field's current visible control value plus the value (and
// exact original instant, if any) it was loaded or last saved with — see the
// file-top comment above for why this is needed to preserve an unmodified
// field's original exact instant instead of re-deriving a minute-truncated
// one.
export interface ArchiveUiFolderDateFieldValue {
  readonly value: string;
  readonly loadedValue: string;
  readonly loadedIso: string | null;
}

export interface ArchiveUiFolderDatesInput {
  readonly dueAt: ArchiveUiFolderDateFieldValue;
  readonly expiresAt: ArchiveUiFolderDateFieldValue;
}

export type ArchiveUiFolderDatesValidationOutcome =
  | { readonly kind: "invalid"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "valid"; readonly dueAt: string | null; readonly expiresAt: string | null };

function archiveUiConvertFolderDateField(
  field: ArchiveUiFolderDateFieldValue,
): { readonly ok: true; readonly value: string | null } | { readonly ok: false } {
  const trimmed = field.value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed === field.loadedValue) {
    // Unmodified since load/last-save: preserve the ORIGINAL exact instant
    // (including seconds/millis the display value cannot represent) rather
    // than re-deriving a minute-truncated one from `trimmed`.
    return { ok: true, value: field.loadedIso };
  }
  const parsed = archiveUiParseFolderDateTimeLocal(trimmed);
  if (parsed === null) {
    return { ok: false };
  }
  return { ok: true, value: parsed.toISOString() };
}

export function archiveUiValidateFolderDatesInput(
  input: ArchiveUiFolderDatesInput,
): ArchiveUiFolderDatesValidationOutcome {
  const dueAtResult = archiveUiConvertFolderDateField(input.dueAt);
  const expiresAtResult = archiveUiConvertFolderDateField(input.expiresAt);
  const entries: { field: string; message: string }[] = [];
  if (!dueAtResult.ok) {
    entries.push({ field: "dueAt", message: "Enter a valid due date and time." });
  }
  if (!expiresAtResult.ok) {
    entries.push({ field: "expiresAt", message: "Enter a valid expiry date and time." });
  }
  if (entries.length > 0) {
    return { kind: "invalid", fieldErrors: archiveUiFieldErrorMapFromEntries(entries) };
  }
  return {
    kind: "valid",
    dueAt: (dueAtResult as { ok: true; value: string | null }).value,
    expiresAt: (expiresAtResult as { ok: true; value: string | null }).value,
  };
}

export type ArchiveUiSetFolderDatesOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly folder: ArchiveFolder };

export async function archiveUiSubmitFolderDates(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  folderId: string,
  input: ArchiveUiFolderDatesInput,
): Promise<ArchiveUiSetFolderDatesOutcome> {
  const validated = archiveUiValidateFolderDatesInput(input);
  if (validated.kind === "invalid") {
    return { kind: "validation", fieldErrors: validated.fieldErrors };
  }
  const result = await bridge.service.setFolderDates(context, folderId, {
    dueAt: validated.dueAt,
    expiresAt: validated.expiresAt,
  });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", folder: result.value };
}

// ---------------------------------------------------------------------------
// Soft deletion (card scope item 13): gated by `delete`, requires the TASK-03
// destructive-confirmation primitive naming the exact action and a
// human-readable folder subject. No restore is implemented here.
// ---------------------------------------------------------------------------

export function archiveUiFolderDeleteConfirmationLabels(folder: ArchiveFolder): {
  readonly actionLabel: string;
  readonly subjectLabel: string;
} {
  return { actionLabel: "Delete folder", subjectLabel: `folder "${folder.name}"` };
}

export type ArchiveUiSoftDeleteFolderOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly folder: ArchiveFolder };

export async function archiveUiSubmitSoftDeleteFolder(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  folderId: string,
): Promise<ArchiveUiSoftDeleteFolderOutcome> {
  const result = await bridge.service.softDeleteFolder(context, folderId);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", folder: result.value };
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects — no
// global stylesheet/CSS-module/CSS-framework pipeline; card scope item 16).
// Both list panels use `repeat(auto-fit, minmax(...))` so the Archive-owned
// content area stays usable at both narrow and wide widths without a new
// responsive build pipeline (A-UI-RESP-001), mirroring TASK-04's proven
// approach.
// ---------------------------------------------------------------------------

const ARCHIVE_FOLDER_SCREEN_CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_FOLDER_SCREEN_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_FOLDER_SCREEN_SECTION_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-heading)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_FOLDER_SCREEN_BREADCRUMB_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-small)",
  color: "var(--color-text-muted)",
};

const ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LINK_STYLE: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-accent)",
  cursor: "pointer",
  padding: 0,
  fontSize: "var(--text-small)",
};

const ARCHIVE_FOLDER_SCREEN_BREADCRUMB_CURRENT_STYLE: CSSProperties = {
  color: "var(--color-text)",
  fontSize: "var(--text-small)",
};

const ARCHIVE_FOLDER_SCREEN_BREADCRUMB_HIDDEN_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontStyle: "italic",
  fontSize: "var(--text-small)",
};

const ARCHIVE_FOLDER_SCREEN_PANEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
};

const ARCHIVE_FOLDER_SCREEN_FORM_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  alignItems: "flex-end",
};

const ARCHIVE_FOLDER_SCREEN_FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const ARCHIVE_FOLDER_SCREEN_INPUT_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2)",
  fontSize: "var(--text-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ARCHIVE_FOLDER_SCREEN_DANGER_BUTTON_STYLE: CSSProperties = {
  ...ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE,
  border: "1px solid var(--color-danger)",
  backgroundColor: "var(--color-danger)",
};

const ARCHIVE_FOLDER_SCREEN_ERROR_TEXT_STYLE: CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--text-small)",
  margin: 0,
};

// A-UI-RESP-001: `auto-fit`/`minmax` gives narrow single-column and wide
// multi-column layout from ONE style object per list — no separate
// breakpoint build.
const ARCHIVE_FOLDER_SCREEN_GRID_STYLE: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
};

const ARCHIVE_FOLDER_SCREEN_CARD_BUTTON_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  width: "100%",
  textAlign: "left",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-panel)",
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text)",
  padding: "var(--space-4)",
  cursor: "pointer",
};

const ARCHIVE_FOLDER_SCREEN_CARD_DESCRIPTION_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

const ARCHIVE_FOLDER_SCREEN_HEADING_ID = "archive-folder-screen-heading";
const ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LABEL_ID = "archive-folder-screen-breadcrumb-label";
const ARCHIVE_FOLDER_SCREEN_CHILD_FOLDER_FORM_ID = "archive-folder-screen-create-child-folder";
const ARCHIVE_FOLDER_SCREEN_ITEM_FORM_ID = "archive-folder-screen-create-item";
const ARCHIVE_FOLDER_SCREEN_DATES_FORM_ID = "archive-folder-screen-dates";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly). This is the exact
// function `ArchiveFolderScreen.render()` below calls — not a
// parallel/duplicated presentation.
// ---------------------------------------------------------------------------

interface ArchiveFolderScreenRenderState {
  readonly viewState: ArchiveUiViewState<ArchiveFolderScreenData>;
  readonly feedback: ArchiveUiFeedbackState;
  readonly childFolderNameField: string;
  readonly childFolderDescriptionField: string;
  readonly childFolderFieldErrors: ArchiveUiFieldErrorMap;
  readonly creatingChildFolder: boolean;
  readonly itemNameField: string;
  readonly itemDescriptionField: string;
  readonly itemFieldErrors: ArchiveUiFieldErrorMap;
  readonly creatingItem: boolean;
  readonly statusField: ArchiveBusinessStatus;
  readonly updatingStatus: boolean;
  readonly dueAtField: string;
  readonly expiresAtField: string;
  readonly dateFieldErrors: ArchiveUiFieldErrorMap;
  readonly updatingDates: boolean;
  readonly deleteConfirmation: ArchiveUiConfirmationState;
  readonly deletingFolder: boolean;
}

interface ArchiveFolderScreenRenderHandlers {
  readonly onRootNavigate: () => void;
  readonly onBreadcrumbFolderSelect: (folderId: string) => void;
  readonly onChildFolderSelect: (folderId: string) => void;
  readonly onItemSelect: (itemId: string) => void;
  readonly onChildFolderNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onChildFolderDescriptionChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onCreateChildFolderSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onItemNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onItemDescriptionChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onCreateItemSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onStatusFieldChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onStatusSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDueAtChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onExpiresAtChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDatesSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onRequestDelete: () => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
  readonly onDismissFeedback: () => void;
}

function renderArchiveFolderScreenBreadcrumb(
  data: ArchiveFolderScreenData,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement {
  const entries = archiveUiFolderScreenBreadcrumb(data.path);
  return (
    <nav
      aria-labelledby={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LABEL_ID}
      data-archive-ui-breadcrumb="folder"
      style={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_STYLE}
    >
      <span id={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LABEL_ID} style={{ display: "none" }}>
        Folder breadcrumb
      </span>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-2)",
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        <li>
          <button
            type="button"
            data-archive-ui-breadcrumb-root="true"
            onClick={handlers.onRootNavigate}
            style={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LINK_STYLE}
          >
            Archive
          </button>
        </li>
        {entries.map((entry, index) => {
          if (entry.kind === "hidden") {
            return (
              <li key={`hidden-${index}`}>
                <span
                  data-archive-ui-breadcrumb-hidden="true"
                  style={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_HIDDEN_STYLE}
                >
                  Restricted
                </span>
              </li>
            );
          }
          if (entry.kind === "current") {
            return (
              <li key={entry.folderId}>
                <span
                  aria-current="page"
                  data-archive-ui-breadcrumb-current={entry.folderId}
                  style={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_CURRENT_STYLE}
                >
                  {entry.label}
                </span>
              </li>
            );
          }
          return (
            <li key={entry.folderId}>
              <button
                type="button"
                data-archive-ui-breadcrumb-ancestor={entry.folderId}
                onClick={() => handlers.onBreadcrumbFolderSelect(entry.folderId)}
                style={ARCHIVE_FOLDER_SCREEN_BREADCRUMB_LINK_STYLE}
              >
                {entry.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function renderArchiveFolderScreenCreateChildFolderForm(
  data: ArchiveFolderScreenData,
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.create;
  if (capability.hidden) return null;
  const nameAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_FOLDER_SCREEN_CHILD_FOLDER_FORM_ID,
    "name",
    state.childFolderFieldErrors,
  );
  const descriptionFieldId = `${ARCHIVE_FOLDER_SCREEN_CHILD_FOLDER_FORM_ID}-description`;
  const disabled = !capability.allowed || state.creatingChildFolder;
  return (
    <form
      aria-label="Create a child folder"
      onSubmit={handlers.onCreateChildFolderSubmit}
      style={ARCHIVE_FOLDER_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label id={nameAccessibility.labelId} htmlFor={nameAccessibility.fieldId}>
          Folder name
        </label>
        <input
          id={nameAccessibility.fieldId}
          type="text"
          value={state.childFolderNameField}
          aria-describedby={nameAccessibility.describedBy}
          aria-invalid={nameAccessibility.invalid}
          disabled={disabled}
          onChange={handlers.onChildFolderNameChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.childFolderFieldErrors, "name") ? (
          <p id={nameAccessibility.errorId} role="alert" style={ARCHIVE_FOLDER_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.childFolderFieldErrors, "name").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label htmlFor={descriptionFieldId}>Description (optional)</label>
        <input
          id={descriptionFieldId}
          type="text"
          value={state.childFolderDescriptionField}
          disabled={disabled}
          onChange={handlers.onChildFolderDescriptionChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE}>
        {state.creatingChildFolder ? "Creating…" : "Create folder"}
      </button>
    </form>
  );
}

function renderArchiveFolderScreenCreateItemForm(
  data: ArchiveFolderScreenData,
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.create;
  if (capability.hidden) return null;
  const nameAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_FOLDER_SCREEN_ITEM_FORM_ID,
    "name",
    state.itemFieldErrors,
  );
  const descriptionFieldId = `${ARCHIVE_FOLDER_SCREEN_ITEM_FORM_ID}-description`;
  const disabled = !capability.allowed || state.creatingItem;
  return (
    <form
      aria-label="Create an item"
      onSubmit={handlers.onCreateItemSubmit}
      style={ARCHIVE_FOLDER_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label id={nameAccessibility.labelId} htmlFor={nameAccessibility.fieldId}>
          Item name
        </label>
        <input
          id={nameAccessibility.fieldId}
          type="text"
          value={state.itemNameField}
          aria-describedby={nameAccessibility.describedBy}
          aria-invalid={nameAccessibility.invalid}
          disabled={disabled}
          onChange={handlers.onItemNameChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.itemFieldErrors, "name") ? (
          <p id={nameAccessibility.errorId} role="alert" style={ARCHIVE_FOLDER_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.itemFieldErrors, "name").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label htmlFor={descriptionFieldId}>Description (optional)</label>
        <input
          id={descriptionFieldId}
          type="text"
          value={state.itemDescriptionField}
          disabled={disabled}
          onChange={handlers.onItemDescriptionChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE}>
        {state.creatingItem ? "Creating…" : "Create item"}
      </button>
    </form>
  );
}

function renderArchiveFolderScreenStatusForm(
  data: ArchiveFolderScreenData,
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.manage_status;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.updatingStatus;
  const fieldId = `${ARCHIVE_FOLDER_SCREEN_HEADING_ID}-status`;
  return (
    <form
      aria-label="Update folder status"
      onSubmit={handlers.onStatusSubmit}
      style={ARCHIVE_FOLDER_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label htmlFor={fieldId}>Status</label>
        <select
          id={fieldId}
          value={state.statusField}
          disabled={disabled}
          onChange={handlers.onStatusFieldChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        >
          {ARCHIVE_FOLDER_SCREEN_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE}>
        {state.updatingStatus ? "Saving…" : "Save status"}
      </button>
    </form>
  );
}

function renderArchiveFolderScreenDatesForm(
  data: ArchiveFolderScreenData,
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.manage_metadata;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.updatingDates;
  const dueAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_FOLDER_SCREEN_DATES_FORM_ID,
    "dueAt",
    state.dateFieldErrors,
  );
  const expiresAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_FOLDER_SCREEN_DATES_FORM_ID,
    "expiresAt",
    state.dateFieldErrors,
  );
  return (
    <form
      aria-label="Update folder due and expiry dates"
      onSubmit={handlers.onDatesSubmit}
      style={ARCHIVE_FOLDER_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label id={dueAccessibility.labelId} htmlFor={dueAccessibility.fieldId}>
          Due at
        </label>
        <input
          id={dueAccessibility.fieldId}
          type="datetime-local"
          value={state.dueAtField}
          aria-describedby={dueAccessibility.describedBy}
          aria-invalid={dueAccessibility.invalid}
          disabled={disabled}
          onChange={handlers.onDueAtChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.dateFieldErrors, "dueAt") ? (
          <p id={dueAccessibility.errorId} role="alert" style={ARCHIVE_FOLDER_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.dateFieldErrors, "dueAt").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
        <label id={expiresAccessibility.labelId} htmlFor={expiresAccessibility.fieldId}>
          Expires at
        </label>
        <input
          id={expiresAccessibility.fieldId}
          type="datetime-local"
          value={state.expiresAtField}
          aria-describedby={expiresAccessibility.describedBy}
          aria-invalid={expiresAccessibility.invalid}
          disabled={disabled}
          onChange={handlers.onExpiresAtChange}
          style={ARCHIVE_FOLDER_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.dateFieldErrors, "expiresAt") ? (
          <p id={expiresAccessibility.errorId} role="alert" style={ARCHIVE_FOLDER_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.dateFieldErrors, "expiresAt").join(" ")}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_FOLDER_SCREEN_BUTTON_STYLE}>
        {state.updatingDates ? "Saving…" : "Save dates"}
      </button>
    </form>
  );
}

function renderArchiveFolderScreenDeleteControl(
  data: ArchiveFolderScreenData,
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.delete;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.deletingFolder;
  return (
    <div style={ARCHIVE_FOLDER_SCREEN_FIELD_STYLE}>
      <button
        type="button"
        disabled={disabled}
        onClick={handlers.onRequestDelete}
        style={ARCHIVE_FOLDER_SCREEN_DANGER_BUTTON_STYLE}
      >
        {state.deletingFolder ? "Deleting…" : "Delete folder"}
      </button>
      <ArchiveUiDestructiveConfirmationDialog
        state={state.deleteConfirmation}
        onConfirm={handlers.onConfirmDelete}
        onCancel={handlers.onCancelDelete}
      />
    </div>
  );
}

function renderArchiveFolderScreen(
  state: ArchiveFolderScreenRenderState,
  handlers: ArchiveFolderScreenRenderHandlers,
): ReactElement {
  const headingText =
    state.viewState.status === "ready" ? state.viewState.data.folder.name : "Folder";

  return (
    <section
      data-archive-ui-screen="folder"
      aria-labelledby={ARCHIVE_FOLDER_SCREEN_HEADING_ID}
      style={ARCHIVE_FOLDER_SCREEN_CONTAINER_STYLE}
    >
      <h1 id={ARCHIVE_FOLDER_SCREEN_HEADING_ID} style={ARCHIVE_FOLDER_SCREEN_HEADING_STYLE}>
        {headingText}
      </h1>
      <ArchiveUiFeedbackBanner
        state={state.feedback}
        dismissLabel="Dismiss"
        onDismiss={handlers.onDismissFeedback}
      />
      <ArchiveUiStatePresentation
        state={state.viewState}
        loadingCopy={{ title: "Loading folder…" }}
        emptyCopy={{ title: "This folder has no content yet." }}
        renderReady={(data) => {
          const contentState = archiveUiFolderScreenContentState(data);
          return (
            <>
              {renderArchiveFolderScreenBreadcrumb(data, handlers)}
              <div style={ARCHIVE_FOLDER_SCREEN_PANEL_STYLE}>
                <h2 style={ARCHIVE_FOLDER_SCREEN_SECTION_HEADING_STYLE}>Actions</h2>
                {renderArchiveFolderScreenCreateChildFolderForm(data, state, handlers)}
                {renderArchiveFolderScreenCreateItemForm(data, state, handlers)}
                {renderArchiveFolderScreenStatusForm(data, state, handlers)}
                {renderArchiveFolderScreenDatesForm(data, state, handlers)}
                {renderArchiveFolderScreenDeleteControl(data, state, handlers)}
              </div>
              <ArchiveUiStatePresentation
                state={contentState}
                loadingCopy={{ title: "Loading folder…" }}
                emptyCopy={{
                  title: "No child folders or items yet",
                  description: "Create a child folder or item to get started.",
                }}
                renderReady={(content) => (
                  <>
                    <div>
                      <h2 style={ARCHIVE_FOLDER_SCREEN_SECTION_HEADING_STYLE}>Child folders</h2>
                      <ul
                        role="list"
                        aria-label="Child folders"
                        style={ARCHIVE_FOLDER_SCREEN_GRID_STYLE}
                      >
                        {content.childFolders.map((folder) => (
                          <li key={folder.id}>
                            <button
                              type="button"
                              data-archive-ui-child-folder-id={folder.id}
                              onClick={() => handlers.onChildFolderSelect(folder.id)}
                              style={ARCHIVE_FOLDER_SCREEN_CARD_BUTTON_STYLE}
                            >
                              <span>{folder.name}</span>
                              {folder.description !== null && folder.description !== "" ? (
                                <span style={ARCHIVE_FOLDER_SCREEN_CARD_DESCRIPTION_STYLE}>
                                  {folder.description}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h2 style={ARCHIVE_FOLDER_SCREEN_SECTION_HEADING_STYLE}>Items</h2>
                      <ul role="list" aria-label="Items" style={ARCHIVE_FOLDER_SCREEN_GRID_STYLE}>
                        {content.items.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              data-archive-ui-item-id={item.id}
                              onClick={() => handlers.onItemSelect(item.id)}
                              style={ARCHIVE_FOLDER_SCREEN_CARD_BUTTON_STYLE}
                            >
                              <span>{item.name}</span>
                              {item.description !== null && item.description !== "" ? (
                                <span style={ARCHIVE_FOLDER_SCREEN_CARD_DESCRIPTION_STYLE}>
                                  {item.description}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              />
            </>
          );
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// The public mountable screen.
// ---------------------------------------------------------------------------

export interface ArchiveFolderScreenProps {
  readonly bridge: ArchiveUiBridge;
  readonly folderId: string;
}

interface ArchiveFolderScreenState {
  readonly context: ArchiveContextInput | null;
  readonly viewState: ArchiveUiViewState<ArchiveFolderScreenData>;
  readonly feedback: ArchiveUiFeedbackState;
  readonly childFolderNameField: string;
  readonly childFolderDescriptionField: string;
  readonly childFolderFieldErrors: ArchiveUiFieldErrorMap;
  readonly creatingChildFolder: boolean;
  readonly itemNameField: string;
  readonly itemDescriptionField: string;
  readonly itemFieldErrors: ArchiveUiFieldErrorMap;
  readonly creatingItem: boolean;
  readonly statusField: ArchiveBusinessStatus;
  readonly updatingStatus: boolean;
  readonly dueAtField: string;
  readonly expiresAtField: string;
  // The input-value string and exact ISO instant (or `null`) the due/expiry
  // fields were last loaded or successfully saved with — see the file-top
  // due/expiry comment. Compared against the live `*Field` value on submit
  // to detect "unmodified" and preserve the original exact instant.
  readonly dueAtLoadedValue: string;
  readonly dueAtLoadedIso: string | null;
  readonly expiresAtLoadedValue: string;
  readonly expiresAtLoadedIso: string | null;
  readonly dateFieldErrors: ArchiveUiFieldErrorMap;
  readonly updatingDates: boolean;
  readonly deleteConfirmation: ArchiveUiConfirmationState;
  readonly deletingFolder: boolean;
}

function archiveUiInitialFolderScreenState(): ArchiveFolderScreenState {
  return {
    context: null,
    viewState: archiveUiViewStateLoading(),
    feedback: archiveUiFeedbackIdle(),
    childFolderNameField: "",
    childFolderDescriptionField: "",
    childFolderFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    creatingChildFolder: false,
    itemNameField: "",
    itemDescriptionField: "",
    itemFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    creatingItem: false,
    statusField: "active",
    updatingStatus: false,
    dueAtField: "",
    expiresAtField: "",
    dueAtLoadedValue: "",
    dueAtLoadedIso: null,
    expiresAtLoadedValue: "",
    expiresAtLoadedIso: null,
    dateFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    updatingDates: false,
    deleteConfirmation: archiveUiConfirmationIdle(),
    deletingFolder: false,
  };
}

// The Archive module folder/content screen (Correction Phase 6 TASK-05). A
// host mounts this with the real `ArchiveUiBridge` implementation and the
// target `folderId`; it owns its own load/create/status/date/delete
// lifecycle end to end. See the file-top HOOK-CALL CONSTRAINT note for why
// this is a class component rather than a hooks-based function component
// (the same TASK-04-established, accepted pattern).
export class ArchiveFolderScreen extends React.Component<
  ArchiveFolderScreenProps,
  ArchiveFolderScreenState
> {
  constructor(props: ArchiveFolderScreenProps) {
    super(props);
    this.state = archiveUiInitialFolderScreenState();
    this.handleRootNavigate = this.handleRootNavigate.bind(this);
    this.handleBreadcrumbFolderSelect = this.handleBreadcrumbFolderSelect.bind(this);
    this.handleChildFolderSelect = this.handleChildFolderSelect.bind(this);
    this.handleItemSelect = this.handleItemSelect.bind(this);
    this.handleChildFolderNameChange = this.handleChildFolderNameChange.bind(this);
    this.handleChildFolderDescriptionChange =
      this.handleChildFolderDescriptionChange.bind(this);
    this.handleCreateChildFolderSubmit = this.handleCreateChildFolderSubmit.bind(this);
    this.handleItemNameChange = this.handleItemNameChange.bind(this);
    this.handleItemDescriptionChange = this.handleItemDescriptionChange.bind(this);
    this.handleCreateItemSubmit = this.handleCreateItemSubmit.bind(this);
    this.handleStatusFieldChange = this.handleStatusFieldChange.bind(this);
    this.handleStatusSubmit = this.handleStatusSubmit.bind(this);
    this.handleDueAtChange = this.handleDueAtChange.bind(this);
    this.handleExpiresAtChange = this.handleExpiresAtChange.bind(this);
    this.handleDatesSubmit = this.handleDatesSubmit.bind(this);
    this.handleRequestDelete = this.handleRequestDelete.bind(this);
    this.handleCancelDelete = this.handleCancelDelete.bind(this);
    this.handleConfirmDelete = this.handleConfirmDelete.bind(this);
    this.handleDismissFeedback = this.handleDismissFeedback.bind(this);
  }

  componentDidMount(): void {
    void this.loadFolderScreen();
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method `componentDidMount` calls above — not a duplicate), so
  // the real mount-time bridge wiring is provable without a DOM renderer.
  async loadFolderScreen(): Promise<void> {
    const result = await archiveUiLoadFolderScreenData(this.props.bridge, this.props.folderId);
    if (result.viewState.status === "ready") {
      const { folder } = result.viewState.data;
      const dueAtValue = archiveUiFolderDateToInputValue(folder.dueAt);
      const expiresAtValue = archiveUiFolderDateToInputValue(folder.expiresAt);
      this.setState({
        context: result.context,
        viewState: result.viewState,
        statusField: folder.status,
        dueAtField: dueAtValue,
        dueAtLoadedValue: dueAtValue,
        dueAtLoadedIso: folder.dueAt === null ? null : folder.dueAt.toISOString(),
        expiresAtField: expiresAtValue,
        expiresAtLoadedValue: expiresAtValue,
        expiresAtLoadedIso: folder.expiresAt === null ? null : folder.expiresAt.toISOString(),
      });
      return;
    }
    this.setState({ context: result.context, viewState: result.viewState });
  }

  handleRootNavigate(): void {
    // Card scope item 6: the ONE Archive-root control emits ONLY
    // `{ screen: "root" }` — no folderId, no URL/path field.
    this.props.bridge.navigate({ screen: "root" });
  }

  handleBreadcrumbFolderSelect(folderId: string): void {
    this.props.bridge.navigate({ screen: "folder", folderId });
  }

  handleChildFolderSelect(folderId: string): void {
    this.props.bridge.navigate({ screen: "folder", folderId });
  }

  handleItemSelect(itemId: string): void {
    this.props.bridge.navigate({ screen: "item", itemId });
  }

  handleChildFolderNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ childFolderNameField: event.target.value });
  }

  handleChildFolderDescriptionChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ childFolderDescriptionField: event.target.value });
  }

  async handleCreateChildFolderSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const { context, childFolderNameField, childFolderDescriptionField, creatingChildFolder } =
      this.state;
    if (context === null || creatingChildFolder) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.create;
    if (!capability.allowed) return;

    this.setState({
      creatingChildFolder: true,
      childFolderFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    });

    const outcome = await archiveUiSubmitCreateChildFolder(
      this.props.bridge,
      context,
      this.props.folderId,
      { name: childFolderNameField, description: childFolderDescriptionField },
    );

    if (outcome.kind === "validation") {
      this.setState({ creatingChildFolder: false, childFolderFieldErrors: outcome.fieldErrors });
      return;
    }
    if (outcome.kind === "failure") {
      this.setState({
        creatingChildFolder: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => {
      if (previous.viewState.status !== "ready") return { ...previous, creatingChildFolder: false };
      return {
        ...previous,
        creatingChildFolder: false,
        childFolderNameField: "",
        childFolderDescriptionField: "",
        childFolderFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
        viewState: archiveUiViewStateReady(
          archiveUiApplyCreatedChildFolder(previous.viewState.data, outcome.folder),
        ),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: "Folder created",
          description: outcome.folder.name,
        }),
      };
    });
  }

  handleItemNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ itemNameField: event.target.value });
  }

  handleItemDescriptionChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ itemDescriptionField: event.target.value });
  }

  async handleCreateItemSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const { context, itemNameField, itemDescriptionField, creatingItem } = this.state;
    if (context === null || creatingItem) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.create;
    if (!capability.allowed) return;

    this.setState({ creatingItem: true, itemFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP });

    const outcome = await archiveUiSubmitCreateItem(
      this.props.bridge,
      context,
      this.props.folderId,
      { name: itemNameField, description: itemDescriptionField },
    );

    if (outcome.kind === "validation") {
      this.setState({ creatingItem: false, itemFieldErrors: outcome.fieldErrors });
      return;
    }
    if (outcome.kind === "failure") {
      this.setState({
        creatingItem: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => {
      if (previous.viewState.status !== "ready") return { ...previous, creatingItem: false };
      return {
        ...previous,
        creatingItem: false,
        itemNameField: "",
        itemDescriptionField: "",
        itemFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
        viewState: archiveUiViewStateReady(
          archiveUiApplyCreatedItem(previous.viewState.data, outcome.item),
        ),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: "Item created",
          description: outcome.item.name,
        }),
      };
    });
  }

  handleStatusFieldChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ statusField: event.target.value as ArchiveBusinessStatus });
  }

  async handleStatusSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const { context, statusField, updatingStatus } = this.state;
    if (context === null || updatingStatus) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.manage_status;
    if (!capability.allowed) return;

    this.setState({ updatingStatus: true });

    const outcome = await archiveUiSubmitFolderStatus(
      this.props.bridge,
      context,
      this.props.folderId,
      statusField,
    );

    if (outcome.kind === "failure") {
      this.setState({
        updatingStatus: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => {
      if (previous.viewState.status !== "ready") return { ...previous, updatingStatus: false };
      return {
        ...previous,
        updatingStatus: false,
        statusField: outcome.folder.status,
        viewState: archiveUiViewStateReady(
          archiveUiApplyUpdatedFolder(previous.viewState.data, outcome.folder),
        ),
        feedback: archiveUiFeedbackShow({ intent: "success", title: "Status updated" }),
      };
    });
  }

  handleDueAtChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ dueAtField: event.target.value });
  }

  handleExpiresAtChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ expiresAtField: event.target.value });
  }

  async handleDatesSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const {
      context,
      dueAtField,
      dueAtLoadedValue,
      dueAtLoadedIso,
      expiresAtField,
      expiresAtLoadedValue,
      expiresAtLoadedIso,
      updatingDates,
    } = this.state;
    if (context === null || updatingDates) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.manage_metadata;
    if (!capability.allowed) return;

    this.setState({ updatingDates: true, dateFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP });

    const outcome = await archiveUiSubmitFolderDates(
      this.props.bridge,
      context,
      this.props.folderId,
      {
        dueAt: { value: dueAtField, loadedValue: dueAtLoadedValue, loadedIso: dueAtLoadedIso },
        expiresAt: {
          value: expiresAtField,
          loadedValue: expiresAtLoadedValue,
          loadedIso: expiresAtLoadedIso,
        },
      },
    );

    if (outcome.kind === "validation") {
      this.setState({ updatingDates: false, dateFieldErrors: outcome.fieldErrors });
      return;
    }
    if (outcome.kind === "failure") {
      this.setState({
        updatingDates: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => {
      if (previous.viewState.status !== "ready") return { ...previous, updatingDates: false };
      const updatedDueAtValue = archiveUiFolderDateToInputValue(outcome.folder.dueAt);
      const updatedExpiresAtValue = archiveUiFolderDateToInputValue(outcome.folder.expiresAt);
      return {
        ...previous,
        updatingDates: false,
        dueAtField: updatedDueAtValue,
        dueAtLoadedValue: updatedDueAtValue,
        dueAtLoadedIso: outcome.folder.dueAt === null ? null : outcome.folder.dueAt.toISOString(),
        expiresAtField: updatedExpiresAtValue,
        expiresAtLoadedValue: updatedExpiresAtValue,
        expiresAtLoadedIso:
          outcome.folder.expiresAt === null ? null : outcome.folder.expiresAt.toISOString(),
        dateFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
        viewState: archiveUiViewStateReady(
          archiveUiApplyUpdatedFolder(previous.viewState.data, outcome.folder),
        ),
        feedback: archiveUiFeedbackShow({ intent: "success", title: "Dates updated" }),
      };
    });
  }

  handleRequestDelete(): void {
    if (this.state.viewState.status !== "ready") return;
    const labels = archiveUiFolderDeleteConfirmationLabels(this.state.viewState.data.folder);
    this.setState({ deleteConfirmation: archiveUiConfirmationRequest(labels) });
  }

  handleCancelDelete(): void {
    this.setState({ deleteConfirmation: archiveUiConfirmationCancel() });
  }

  async handleConfirmDelete(): Promise<void> {
    const { context, deletingFolder } = this.state;
    if (context === null || deletingFolder) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.delete;
    if (!capability.allowed) return;

    this.setState({ deletingFolder: true });

    const outcome = await archiveUiSubmitSoftDeleteFolder(
      this.props.bridge,
      context,
      this.props.folderId,
    );

    if (outcome.kind === "failure") {
      this.setState({
        deletingFolder: false,
        deleteConfirmation: archiveUiConfirmationCancel(),
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState({
      deletingFolder: false,
      deleteConfirmation: archiveUiConfirmationCancel(),
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Folder deleted" }),
    });
    // Card scope item 13: success leaves the screen through
    // `bridge.navigate({ screen: "root" })` ONLY — no URL/router.
    this.props.bridge.navigate({ screen: "root" });
  }

  handleDismissFeedback(): void {
    this.setState((previous) => ({
      ...previous,
      feedback: archiveUiFeedbackDismiss(previous.feedback),
    }));
  }

  render(): ReactElement {
    return renderArchiveFolderScreen(this.state, {
      onRootNavigate: this.handleRootNavigate,
      onBreadcrumbFolderSelect: this.handleBreadcrumbFolderSelect,
      onChildFolderSelect: this.handleChildFolderSelect,
      onItemSelect: this.handleItemSelect,
      onChildFolderNameChange: this.handleChildFolderNameChange,
      onChildFolderDescriptionChange: this.handleChildFolderDescriptionChange,
      onCreateChildFolderSubmit: this.handleCreateChildFolderSubmit,
      onItemNameChange: this.handleItemNameChange,
      onItemDescriptionChange: this.handleItemDescriptionChange,
      onCreateItemSubmit: this.handleCreateItemSubmit,
      onStatusFieldChange: this.handleStatusFieldChange,
      onStatusSubmit: this.handleStatusSubmit,
      onDueAtChange: this.handleDueAtChange,
      onExpiresAtChange: this.handleExpiresAtChange,
      onDatesSubmit: this.handleDatesSubmit,
      onRequestDelete: this.handleRequestDelete,
      onCancelDelete: this.handleCancelDelete,
      onConfirmDelete: this.handleConfirmDelete,
      onDismissFeedback: this.handleDismissFeedback,
    });
  }
}
