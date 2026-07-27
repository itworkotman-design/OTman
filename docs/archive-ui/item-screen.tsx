// Archive UI item/details and file-operations screen — Correction Phase 6
// TASK-06 Part A (§7 item 3, A-UI-STATE-001, A-UI-ACTION-001, A-UI-FORM-001,
// A-UI-FEEDBACK-001, A-UI-DESTRUCT-001, A-UI-RESP-001). The Archive module's
// item screen: shows one item's header/details, its active files
// (`listFilesForItem`), lets the caller upload/download files through the
// bridge's transport hooks, soft-delete/restore files, edit the item's
// status/dates, and soft-delete the item itself — all capability-gated.
// Host-neutral: depends only on the TASK-02 bridge contract (`./bridge.js`),
// the TASK-03 shared primitives (`./view-state.js`, `./capabilities.js`,
// `./validation.js`, `./feedback.js`, `./confirmation.js`), the accepted
// TASK-05 pure date helpers (`./folder-screen.js`, DIRECT REUSE per this
// card's option (a) — folder-screen.tsx and its tests are untouched), and
// the public Archive root package surface (`@customprojects/archive-service`)
// — no Shell/Next.js/router/window/document-global (other than the DOM
// `Blob`/`URL` globals the upload/download flows below require, already
// covered by `tsconfig.ui.json`'s existing `lib: ["ES2022","DOM"]`, no new
// dependency)/Prisma/repository/service/internal-Archive import anywhere in
// this file. Search, permissions/roles, recovery (folder/item restore), and
// file history are explicitly out of scope for this screen (TASK-07/08/09).
//
// HOOK-CALL CONSTRAINT: identical reasoning to `root-screen.tsx`'s file-top
// comment (this repository's test toolchain has no `react-dom`/renderer, and
// React's hook dispatcher is `null` outside an active render performed by a
// real renderer), so `ArchiveItemScreen` is a `React.Component` SUBCLASS —
// the same standard, first-class React component form TASK-04/TASK-05
// already establish as this repository's accepted no-renderer pattern.
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
  describeArchiveUiCapabilityAction,
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
// DIRECT REUSE (card option (a)) of the accepted TASK-05 pure date helpers —
// zero new files, `folder-screen.tsx` and its tests stay byte-identical.
// These names are folder-flavored only because they originate there; they
// are the exact same LOCAL wall-clock `datetime-local` convention (strict
// parse, impossible-date rejection, blank -> null, unchanged-value exact
// instant preservation) this screen's due/expiry editing requires.
import {
  archiveUiFolderDateToInputValue as archiveUiItemDateToInputValue,
  archiveUiValidateFolderDatesInput as archiveUiValidateItemDatesInput,
  type ArchiveUiFolderDatesInput as ArchiveUiItemDatesInput,
} from "./folder-screen.js";
import type {
  ArchiveBusinessStatus,
  ArchiveContextInput,
  ArchiveEffectiveCapabilityMap,
  ArchiveFile,
  ArchiveHostAdapterError,
  ArchiveItem,
  ArchiveRecoverableFile,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveItemScreen`'s methods call — not a duplicated
// stand-in — so testing these functions directly and testing the class
// instance's wiring together cover the real implementation with no gap.
// ---------------------------------------------------------------------------

// The exact, closed four-action capability gate this screen's ACTIONS need
// (card scope "Capability-aware item actions"): `manage_status`,
// `manage_metadata`, `delete` (item AND file soft deletion), `upload`. The
// fifth action, `restore`, is derived SEPARATELY below with a different
// (hide-when-denied) presentation policy — see `ArchiveItemScreenCapabilities`
// and `archiveUiItemScreenCapabilities`. `view` is used only as a one-shot
// preflight gate (never rendered as a control), so it is read directly off
// the raw `ArchiveEffectiveCapabilityMap`, not turned into a descriptor.
const ARCHIVE_ITEM_SCREEN_DEFAULT_POLICY_ACTIONS = [
  "manage_status",
  "manage_metadata",
  "delete",
  "upload",
] as const;

export type ArchiveItemScreenDefaultPolicyCapabilities = Readonly<
  Record<
    (typeof ARCHIVE_ITEM_SCREEN_DEFAULT_POLICY_ACTIONS)[number],
    ArchiveUiCapabilityActionDescriptor
  >
>;

// Documented hidden/disabled policy (card scope item 7 / proof 7): every
// action below except `restore` renders DISABLED (never hidden) when denied
// — the same default `describeArchiveUiCapabilityAction` policy TASK-04/05
// already use, honest about the action's existence without implying it is
// currently usable. `restore` renders HIDDEN entirely when denied: the whole
// deleted-file discovery/restore section (including its per-file buttons)
// never appears, matching the card's "no restore button appears enabled"
// AND "discovery never called when restore denied" requirements together —
// there is no denied-but-visible restore affordance to disable.
export interface ArchiveItemScreenCapabilities
  extends ArchiveItemScreenDefaultPolicyCapabilities {
  readonly restore: ArchiveUiCapabilityActionDescriptor;
}

export function archiveUiItemScreenCapabilities(
  capabilities: ArchiveEffectiveCapabilityMap,
): ArchiveItemScreenCapabilities {
  const defaultPolicy = describeArchiveUiCapabilityActions(
    capabilities,
    ARCHIVE_ITEM_SCREEN_DEFAULT_POLICY_ACTIONS,
  );
  return {
    ...defaultPolicy,
    restore: describeArchiveUiCapabilityAction(capabilities, "restore", {
      hideWhenDenied: true,
    }),
  };
}

export interface ArchiveItemScreenData {
  readonly item: ArchiveItem;
  readonly capabilities: ArchiveItemScreenCapabilities;
  readonly activeFiles: ArchiveFile[];
  readonly recoverableFiles: ArchiveRecoverableFile[];
}

export interface ArchiveItemScreenContent {
  readonly activeFiles: ArchiveFile[];
  readonly recoverableFiles: ArchiveRecoverableFile[];
}

export interface ArchiveItemScreenLoadResult {
  readonly context: ArchiveContextInput;
  readonly viewState: ArchiveUiViewState<ArchiveItemScreenData>;
}

// The calm, non-leaking presentation used when the capability MAP itself
// (not an adapter error) reports `view` denied (card scope "Deterministic
// load protocol" step 3) — there is no `ArchiveHostAdapterError` to
// translate in this branch, so this is a locally-authored, honest,
// non-leaking presentation, never a raw backend string.
const ARCHIVE_ITEM_SCREEN_VIEW_DENIED_PRESENTATION: ArchiveUiErrorPresentation = {
  category: "unauthorized",
  title: "You don't have access to this item.",
  description: "Ask an item manager for access if you believe this is a mistake.",
};

function archiveUiItemScreenFailureResult(
  context: ArchiveContextInput,
  bridge: ArchiveUiBridge,
  error: ArchiveHostAdapterError,
): ArchiveItemScreenLoadResult {
  const presentation = bridge.translateError(error);
  const viewState: ArchiveUiViewState<ArchiveItemScreenData> =
    error.category === "unauthorized"
      ? archiveUiViewStateDenied(presentation)
      : archiveUiViewStateError(presentation);
  return { context, viewState };
}

// Item loading (card scope "Deterministic load protocol"): ONE
// `bridge.getContext()` result drives the whole load. Step 1: capability
// preflight on the exact item target — `unauthorized` from THAT call becomes
// denied, every other failure becomes a translated error, and NEITHER
// branch calls `readItem`/`listFilesForItem`/`listRecoverableFilesForItem`.
// Step 3: when the capability map itself denies `view`, denied — again
// with NO further read. Step 4: when `view` is allowed, `readItem` and
// `listFilesForItem` always run; `listRecoverableFilesForItem` runs ONLY
// when the capability map allows `restore` — the capability map is the
// presentation gate, the backend remains authoritative (never called merely
// to discover whether restore is allowed).
export async function archiveUiLoadItemScreenData(
  bridge: ArchiveUiBridge,
  itemId: string,
): Promise<ArchiveItemScreenLoadResult> {
  const context = bridge.getContext();

  const capabilitiesResult = await bridge.service.getEffectiveCapabilities(context, {
    targetType: "item",
    targetId: itemId,
  });
  if (!capabilitiesResult.ok) {
    return archiveUiItemScreenFailureResult(context, bridge, capabilitiesResult.error);
  }

  if (!capabilitiesResult.value.view.allowed) {
    return {
      context,
      viewState: archiveUiViewStateDenied(ARCHIVE_ITEM_SCREEN_VIEW_DENIED_PRESENTATION),
    };
  }

  const capabilities = archiveUiItemScreenCapabilities(capabilitiesResult.value);
  const restoreAllowed = capabilities.restore.allowed;

  const [itemResult, filesResult, recoverableResult] = await Promise.all([
    bridge.service.readItem(context, itemId),
    bridge.service.listFilesForItem(context, itemId),
    restoreAllowed ? bridge.service.listRecoverableFilesForItem(context, itemId) : null,
  ]);

  // Pass 1: `unauthorized` from ANY EXECUTED read has highest presentation
  // priority, independent of method/check order — checked in the exact
  // documented order (readItem, listFilesForItem,
  // listRecoverableFilesForItem).
  if (!itemResult.ok && itemResult.error.category === "unauthorized") {
    return archiveUiItemScreenFailureResult(context, bridge, itemResult.error);
  }
  if (!filesResult.ok && filesResult.error.category === "unauthorized") {
    return archiveUiItemScreenFailureResult(context, bridge, filesResult.error);
  }
  if (
    recoverableResult !== null &&
    !recoverableResult.ok &&
    recoverableResult.error.category === "unauthorized"
  ) {
    return archiveUiItemScreenFailureResult(context, bridge, recoverableResult.error);
  }

  // Pass 2: none of the executed reads' failures (if any) is `unauthorized`
  // at this point — select the first failure in the exact same documented
  // order.
  if (!itemResult.ok) {
    return archiveUiItemScreenFailureResult(context, bridge, itemResult.error);
  }
  if (!filesResult.ok) {
    return archiveUiItemScreenFailureResult(context, bridge, filesResult.error);
  }
  if (recoverableResult !== null && !recoverableResult.ok) {
    return archiveUiItemScreenFailureResult(context, bridge, recoverableResult.error);
  }

  const data: ArchiveItemScreenData = {
    item: itemResult.value,
    capabilities,
    activeFiles: filesResult.value,
    recoverableFiles: recoverableResult !== null && recoverableResult.ok ? recoverableResult.value : [],
  };
  return { context, viewState: archiveUiViewStateReady(data) };
}

// Content-level empty/ready derivation (card scope "Deterministic load
// protocol": "`empty-content` means the item loaded successfully but has no
// active files and no visible recoverable files"). Computed separately from
// the screen-level `viewState` above precisely so the item header/details/
// actions never disappear merely because content happens to be empty — they
// are already carried by the outer `ready` data regardless of this derived
// sub-state (the exact TASK-05 folder-screen precedent).
export function archiveUiItemScreenContentState(
  data: ArchiveItemScreenData,
): ArchiveUiViewState<ArchiveItemScreenContent> {
  if (data.activeFiles.length === 0 && data.recoverableFiles.length === 0) {
    return archiveUiViewStateEmpty();
  }
  return archiveUiViewStateReady({
    activeFiles: data.activeFiles,
    recoverableFiles: data.recoverableFiles,
  });
}

export function archiveUiApplyUpdatedItem(
  data: ArchiveItemScreenData,
  item: ArchiveItem,
): ArchiveItemScreenData {
  return { ...data, item };
}

// ---------------------------------------------------------------------------
// Status editing (card scope "Item status editing"): exact closed
// four-status set, gated by `manage_status`.
// ---------------------------------------------------------------------------

export const ARCHIVE_ITEM_SCREEN_STATUSES: readonly ArchiveBusinessStatus[] = [
  "active",
  "inactive",
  "draft",
  "archived",
];

export type ArchiveUiSetItemStatusOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly item: ArchiveItem };

export async function archiveUiSubmitItemStatus(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  itemId: string,
  status: ArchiveBusinessStatus,
): Promise<ArchiveUiSetItemStatusOutcome> {
  const result = await bridge.service.setItemStatus(context, itemId, { status });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", item: result.value };
}

// ---------------------------------------------------------------------------
// Due/expiry editing (card scope "Item due/expiry editing"): gated by
// `manage_metadata`, reusing the accepted TASK-05 LOCAL wall-clock
// `datetime-local` semantics DIRECTLY (see the file-top import comment) —
// no independent duplicate date logic.
// ---------------------------------------------------------------------------

// Re-exported under this file's own item-flavored name so this file's own
// tests (and any host consuming `item-screen.tsx` internals directly, e.g.
// `../item-screen.js`) can reference the exact SAME reused TASK-05 formatter
// this screen's own `loadItemScreen`/`handleDatesSubmit` call, without a
// second import path pointing at `folder-screen.tsx` in the test file too —
// still zero duplicate logic, `folder-screen.tsx` remains the single source.
export { archiveUiItemDateToInputValue };

export type ArchiveUiSetItemDatesOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly item: ArchiveItem };

export async function archiveUiSubmitItemDates(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  itemId: string,
  input: ArchiveUiItemDatesInput,
): Promise<ArchiveUiSetItemDatesOutcome> {
  const validated = archiveUiValidateItemDatesInput(input);
  if (validated.kind === "invalid") {
    return { kind: "validation", fieldErrors: validated.fieldErrors };
  }
  const result = await bridge.service.setItemDates(context, itemId, {
    dueAt: validated.dueAt,
    expiresAt: validated.expiresAt,
  });
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", item: result.value };
}

// ---------------------------------------------------------------------------
// Item soft deletion (card scope "Item soft deletion"): gated by `delete`,
// requires the TASK-03 destructive-confirmation primitive naming the exact
// action and a human-readable item subject. No item restore here (TASK-09).
// ---------------------------------------------------------------------------

export function archiveUiItemDeleteConfirmationLabels(item: ArchiveItem): {
  readonly actionLabel: string;
  readonly subjectLabel: string;
} {
  return { actionLabel: "Delete item", subjectLabel: `item "${item.name}"` };
}

export type ArchiveUiSoftDeleteItemOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly item: ArchiveItem };

export async function archiveUiSubmitSoftDeleteItem(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  itemId: string,
): Promise<ArchiveUiSoftDeleteItemOutcome> {
  const result = await bridge.service.softDeleteItem(context, itemId);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", item: result.value };
}

// ---------------------------------------------------------------------------
// Active file list — safe public metadata only (card scope "Active file
// list").
// ---------------------------------------------------------------------------

export function archiveUiFormatByteSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = sizeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// ---------------------------------------------------------------------------
// Upload flow (card scope "Upload flow"): one bounded browser file-upload
// flow through `bridge.transport.uploadFile`. `ArchiveUiUploadFileLike` is a
// deliberately NARROW structural subset of the real DOM `File`/`Blob`
// contract (name, MIME type, `arrayBuffer()`) — a real browser `File` is
// assignable to it, and a focused test can supply a minimal fake with no
// jsdom/DOM dependency.
// ---------------------------------------------------------------------------

export interface ArchiveUiUploadFileLike {
  readonly name: string;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const ARCHIVE_ITEM_SCREEN_UPLOAD_MIME_FALLBACK = "application/octet-stream";

export type ArchiveUiUploadItemFileOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly file: ArchiveFile };

// Card scope requirements 1–6: a missing selection is a field error with NO
// transport call; bytes are read via `File.arrayBuffer()` into a NEW
// `Uint8Array` snapshot (never the caller's own buffer reference); the MIME
// fallback applies ONLY when the browser supplies an empty type; no
// client-side max-size constant exists anywhere in this file; byte-read and
// adapter failures both produce calm safe feedback only, never a raw
// exception/adapter message.
export async function archiveUiSubmitItemFileUpload(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  itemId: string,
  selection: ArchiveUiUploadFileLike | null,
): Promise<ArchiveUiUploadItemFileOutcome> {
  if (selection === null) {
    return {
      kind: "validation",
      fieldErrors: archiveUiFieldErrorMapFromEntries([
        { field: "file", message: "Choose a file to upload." },
      ]),
    };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await selection.arrayBuffer();
  } catch {
    return {
      kind: "failure",
      presentation: bridge.translateError({
        category: "server_error",
        message: "archive-ui item-screen: selected file bytes could not be read.",
      }),
    };
  }

  const content = new Uint8Array(buffer);
  const mimeType =
    selection.type.length === 0 ? ARCHIVE_ITEM_SCREEN_UPLOAD_MIME_FALLBACK : selection.type;

  const result = await bridge.transport.uploadFile(context, {
    archiveItemId: itemId,
    originalFileName: selection.name,
    mimeType,
    content,
  });

  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", file: result.value };
}

export function archiveUiApplyUploadedFile(
  data: ArchiveItemScreenData,
  file: ArchiveFile,
): ArchiveItemScreenData {
  return { ...data, activeFiles: [...data.activeFiles, file] };
}

// ---------------------------------------------------------------------------
// Download flow (card scope "Download flow"): `bridge.transport.downloadFile`
// only; a `Blob`/object URL from the returned bytes; the caller (component)
// renders an explicit accessible "Download ready" link and owns object-URL
// lifecycle (revoke-on-replace, revoke-on-unmount, duplicate-pending guard).
// ---------------------------------------------------------------------------

export type ArchiveUiDownloadItemFileOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly filename: string; readonly url: string };

export async function archiveUiRequestItemFileDownload(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  fileId: string,
): Promise<ArchiveUiDownloadItemFileOutcome> {
  const result = await bridge.transport.downloadFile(context, fileId);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  try {
    // `ArchiveFileDownload.content` is typed as a bare `Uint8Array`
    // (`ArrayBufferLike`-backed under this TypeScript version's DOM lib);
    // `new Uint8Array(content)` copies it into a definite `ArrayBuffer`-backed
    // view, which is what `BlobPart` (and `URL.createObjectURL`) require.
    const blob = new Blob([new Uint8Array(result.value.content)]);
    const url = URL.createObjectURL(blob);
    return { kind: "success", filename: result.value.file.originalFileName, url };
  } catch {
    return {
      kind: "failure",
      presentation: bridge.translateError({
        category: "server_error",
        message: "archive-ui item-screen: downloaded file content could not be prepared for download.",
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Active-file soft deletion (card scope "Active-file soft deletion"): gated
// by the item's `delete` capability. On success, the recoverable projection
// is built FIELD BY FIELD from the exact seven-field `ArchiveRecoverableFile`
// shape — never a spread of the returned `ArchiveFile`, so no extra field
// (storage identity, user ids, ...) can leak through.
// ---------------------------------------------------------------------------

export function archiveUiFileDeleteConfirmationLabels(file: ArchiveFile): {
  readonly actionLabel: string;
  readonly subjectLabel: string;
} {
  return { actionLabel: "Delete file", subjectLabel: `file "${file.originalFileName}"` };
}

export type ArchiveUiSoftDeleteFileOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly file: ArchiveFile };

export async function archiveUiSubmitSoftDeleteFile(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  fileId: string,
): Promise<ArchiveUiSoftDeleteFileOutcome> {
  const result = await bridge.service.softDeleteFile(context, fileId);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", file: result.value };
}

// Structural (named field-by-field) construction only — see the section
// comment above. Returns `null` in the (should-be-unreachable-after-a-real
// delete) case where the file's `deletedAt` is still `null`, so a caller
// never fabricates a `deletedAt` value.
export function archiveUiToRecoverableFileProjection(
  file: ArchiveFile,
): ArchiveRecoverableFile | null {
  if (file.deletedAt === null) return null;
  return {
    id: file.id,
    archiveItemId: file.archiveItemId,
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    deletedAt: file.deletedAt,
  };
}

// Removes the deleted file from the active list and — ONLY when restore is
// allowed AND a valid projection could be built — additively appends the
// field-by-field recoverable projection, so the caller can restore
// immediately without a reload (card scope requirement).
export function archiveUiApplyFileSoftDelete(
  data: ArchiveItemScreenData,
  file: ArchiveFile,
): ArchiveItemScreenData {
  const activeFiles = data.activeFiles.filter((existing) => existing.id !== file.id);
  const projection = archiveUiToRecoverableFileProjection(file);
  const recoverableFiles =
    data.capabilities.restore.allowed && projection !== null
      ? [...data.recoverableFiles, projection]
      : data.recoverableFiles;
  return { ...data, activeFiles, recoverableFiles };
}

// ---------------------------------------------------------------------------
// Deleted-file restore (card scope "Deleted-file restore"): additive, no
// destructive confirmation. Physical-verification failures are safe
// translated failures that never mutate the lists as though restore
// succeeded.
// ---------------------------------------------------------------------------

export type ArchiveUiRestoreFileOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly file: ArchiveFile };

export async function archiveUiSubmitRestoreFile(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  fileId: string,
): Promise<ArchiveUiRestoreFileOutcome> {
  const result = await bridge.service.restoreFile(context, fileId);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", file: result.value };
}

export function archiveUiApplyRestoredFile(
  data: ArchiveItemScreenData,
  file: ArchiveFile,
): ArchiveItemScreenData {
  const recoverableFiles = data.recoverableFiles.filter((entry) => entry.id !== file.id);
  const activeFiles = data.activeFiles.some((existing) => existing.id === file.id)
    ? data.activeFiles
    : [...data.activeFiles, file];
  return { ...data, activeFiles, recoverableFiles };
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects — no
// global stylesheet/CSS-module/CSS-framework pipeline), mirroring TASK-04/
// TASK-05's proven `repeat(auto-fit, minmax(...))` responsive approach.
// ---------------------------------------------------------------------------

const ARCHIVE_ITEM_SCREEN_CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_ITEM_SCREEN_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_ITEM_SCREEN_SECTION_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-heading)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_ITEM_SCREEN_PANEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
};

const ARCHIVE_ITEM_SCREEN_FORM_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  alignItems: "flex-end",
};

const ARCHIVE_ITEM_SCREEN_FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const ARCHIVE_ITEM_SCREEN_INPUT_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2)",
  fontSize: "var(--text-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_ITEM_SCREEN_BUTTON_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ARCHIVE_ITEM_SCREEN_LINK_BUTTON_STYLE: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-accent)",
  cursor: "pointer",
  padding: 0,
  fontSize: "var(--text-body)",
};

const ARCHIVE_ITEM_SCREEN_DANGER_BUTTON_STYLE: CSSProperties = {
  ...ARCHIVE_ITEM_SCREEN_BUTTON_STYLE,
  border: "1px solid var(--color-danger)",
  backgroundColor: "var(--color-danger)",
};

const ARCHIVE_ITEM_SCREEN_ERROR_TEXT_STYLE: CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--text-small)",
  margin: 0,
};

const ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

const ARCHIVE_ITEM_SCREEN_BADGE_STYLE: CSSProperties = {
  display: "inline-block",
  borderRadius: "var(--radius)",
  padding: "var(--space-1) var(--space-2)",
  fontSize: "var(--text-small)",
  backgroundColor: "var(--color-warning)",
  color: "var(--color-text)",
};

// A-UI-RESP-001: `auto-fit`/`minmax` gives narrow single-column and wide
// multi-column layout from ONE style object — no separate breakpoint build.
const ARCHIVE_ITEM_SCREEN_GRID_STYLE: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
};

const ARCHIVE_ITEM_SCREEN_CARD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-panel)",
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text)",
  padding: "var(--space-4)",
};

const ARCHIVE_ITEM_SCREEN_HEADING_ID = "archive-item-screen-heading";
const ARCHIVE_ITEM_SCREEN_STATUS_FORM_ID = "archive-item-screen-status";
const ARCHIVE_ITEM_SCREEN_DATES_FORM_ID = "archive-item-screen-dates";
const ARCHIVE_ITEM_SCREEN_UPLOAD_FORM_ID = "archive-item-screen-upload";

// ---------------------------------------------------------------------------
// Per-file download presentation state (component-owned; NOT part of the
// public surface).
// ---------------------------------------------------------------------------

type ArchiveItemScreenDownloadState =
  | { readonly status: "pending" }
  | { readonly status: "ready"; readonly url: string; readonly filename: string }
  | { readonly status: "error" };

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly). This is the exact
// function `ArchiveItemScreen.render()` below calls — not a parallel/
// duplicated presentation.
// ---------------------------------------------------------------------------

interface ArchiveItemScreenRenderState {
  readonly viewState: ArchiveUiViewState<ArchiveItemScreenData>;
  readonly feedback: ArchiveUiFeedbackState;

  readonly statusField: ArchiveBusinessStatus;
  readonly updatingStatus: boolean;

  readonly dueAtField: string;
  readonly expiresAtField: string;
  readonly dateFieldErrors: ArchiveUiFieldErrorMap;
  readonly updatingDates: boolean;

  readonly itemDeleteConfirmation: ArchiveUiConfirmationState;
  readonly deletingItem: boolean;

  readonly uploadSelectionName: string | null;
  readonly uploadFieldErrors: ArchiveUiFieldErrorMap;
  readonly uploading: boolean;
  readonly uploadInputKey: number;

  readonly fileDeleteConfirmation: ArchiveUiConfirmationState;
  readonly deletingFileIds: ReadonlySet<string>;

  readonly downloads: Readonly<Record<string, ArchiveItemScreenDownloadState>>;

  readonly restoringFileIds: ReadonlySet<string>;
}

interface ArchiveItemScreenRenderHandlers {
  readonly onBackToFolder: () => void;
  readonly onViewHistory: () => void;
  readonly onStatusFieldChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onStatusSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDueAtChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onExpiresAtChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDatesSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onRequestItemDelete: () => void;
  readonly onCancelItemDelete: () => void;
  readonly onConfirmItemDelete: () => void;
  readonly onUploadSelectionChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onUploadSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDownloadFile: (fileId: string) => void;
  readonly onRequestFileDelete: (file: ArchiveFile) => void;
  readonly onCancelFileDelete: () => void;
  readonly onConfirmFileDelete: () => void;
  readonly onRestoreFile: (fileId: string) => void;
  readonly onDismissFeedback: () => void;
}

function renderArchiveItemScreenHeader(
  data: ArchiveItemScreenData,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement {
  const { item } = data;
  return (
    <div style={ARCHIVE_ITEM_SCREEN_PANEL_STYLE}>
      {item.description !== null && item.description !== "" ? <p>{item.description}</p> : null}
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{item.itemType}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{item.status}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>
            {item.dueAt !== null ? (
              <time dateTime={item.dueAt.toISOString()}>{item.dueAt.toISOString()}</time>
            ) : (
              "Not set"
            )}
          </dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>
            {item.expiresAt !== null ? (
              <time dateTime={item.expiresAt.toISOString()}>{item.expiresAt.toISOString()}</time>
            ) : (
              "Not set"
            )}
          </dd>
        </div>
      </dl>
      <ul aria-label="Condition flags" style={{ display: "flex", gap: "var(--space-2)", padding: 0, margin: 0, listStyle: "none" }}>
        {item.isOverdue ? (
          <li data-archive-ui-condition="overdue" style={ARCHIVE_ITEM_SCREEN_BADGE_STYLE}>
            Overdue
          </li>
        ) : null}
        {item.isDueSoon ? (
          <li data-archive-ui-condition="due-soon" style={ARCHIVE_ITEM_SCREEN_BADGE_STYLE}>
            Due soon
          </li>
        ) : null}
        {item.isExpired ? (
          <li data-archive-ui-condition="expired" style={ARCHIVE_ITEM_SCREEN_BADGE_STYLE}>
            Expired
          </li>
        ) : null}
        {item.isExpiringSoon ? (
          <li data-archive-ui-condition="expiring-soon" style={ARCHIVE_ITEM_SCREEN_BADGE_STYLE}>
            Expiring soon
          </li>
        ) : null}
      </ul>
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <button
          type="button"
          data-archive-ui-back-to-folder="true"
          onClick={handlers.onBackToFolder}
          style={ARCHIVE_ITEM_SCREEN_LINK_BUTTON_STYLE}
        >
          Back to folder
        </button>
        <button
          type="button"
          data-archive-ui-view-history="true"
          onClick={handlers.onViewHistory}
          style={ARCHIVE_ITEM_SCREEN_LINK_BUTTON_STYLE}
        >
          View history
        </button>
      </div>
    </div>
  );
}

function renderArchiveItemScreenStatusForm(
  data: ArchiveItemScreenData,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.manage_status;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.updatingStatus;
  const fieldId = `${ARCHIVE_ITEM_SCREEN_STATUS_FORM_ID}-status`;
  return (
    <form
      aria-label="Update item status"
      onSubmit={handlers.onStatusSubmit}
      style={ARCHIVE_ITEM_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_ITEM_SCREEN_FIELD_STYLE}>
        <label htmlFor={fieldId}>Status</label>
        <select
          id={fieldId}
          value={state.statusField}
          disabled={disabled}
          onChange={handlers.onStatusFieldChange}
          style={ARCHIVE_ITEM_SCREEN_INPUT_STYLE}
        >
          {ARCHIVE_ITEM_SCREEN_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_ITEM_SCREEN_BUTTON_STYLE}>
        {state.updatingStatus ? "Saving…" : "Save status"}
      </button>
    </form>
  );
}

function renderArchiveItemScreenDatesForm(
  data: ArchiveItemScreenData,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.manage_metadata;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.updatingDates;
  const dueAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_ITEM_SCREEN_DATES_FORM_ID,
    "dueAt",
    state.dateFieldErrors,
  );
  const expiresAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_ITEM_SCREEN_DATES_FORM_ID,
    "expiresAt",
    state.dateFieldErrors,
  );
  return (
    <form
      aria-label="Update item due and expiry dates"
      onSubmit={handlers.onDatesSubmit}
      style={ARCHIVE_ITEM_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_ITEM_SCREEN_FIELD_STYLE}>
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
          style={ARCHIVE_ITEM_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.dateFieldErrors, "dueAt") ? (
          <p id={dueAccessibility.errorId} role="alert" style={ARCHIVE_ITEM_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.dateFieldErrors, "dueAt").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={ARCHIVE_ITEM_SCREEN_FIELD_STYLE}>
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
          style={ARCHIVE_ITEM_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.dateFieldErrors, "expiresAt") ? (
          <p id={expiresAccessibility.errorId} role="alert" style={ARCHIVE_ITEM_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.dateFieldErrors, "expiresAt").join(" ")}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_ITEM_SCREEN_BUTTON_STYLE}>
        {state.updatingDates ? "Saving…" : "Save dates"}
      </button>
    </form>
  );
}

function renderArchiveItemScreenUploadForm(
  data: ArchiveItemScreenData,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.upload;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.uploading;
  const fieldId = `${ARCHIVE_ITEM_SCREEN_UPLOAD_FORM_ID}-file`;
  return (
    <form
      aria-label="Upload a file"
      onSubmit={handlers.onUploadSubmit}
      style={ARCHIVE_ITEM_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_ITEM_SCREEN_FIELD_STYLE}>
        <label htmlFor={fieldId}>File</label>
        <input
          key={state.uploadInputKey}
          id={fieldId}
          type="file"
          disabled={disabled}
          onChange={handlers.onUploadSelectionChange}
          style={ARCHIVE_ITEM_SCREEN_INPUT_STYLE}
        />
        {archiveUiFieldHasError(state.uploadFieldErrors, "file") ? (
          <p role="alert" style={ARCHIVE_ITEM_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.uploadFieldErrors, "file").join(" ")}
          </p>
        ) : null}
        {state.uploadSelectionName !== null ? (
          <p style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>Selected: {state.uploadSelectionName}</p>
        ) : null}
      </div>
      <button type="submit" disabled={disabled} style={ARCHIVE_ITEM_SCREEN_BUTTON_STYLE}>
        {state.uploading ? "Uploading…" : "Upload file"}
      </button>
    </form>
  );
}

function renderArchiveItemScreenDeleteControl(
  data: ArchiveItemScreenData,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement | null {
  const capability = data.capabilities.delete;
  if (capability.hidden) return null;
  const disabled = !capability.allowed || state.deletingItem;
  return (
    <div style={ARCHIVE_ITEM_SCREEN_FIELD_STYLE}>
      <button
        type="button"
        disabled={disabled}
        onClick={handlers.onRequestItemDelete}
        style={ARCHIVE_ITEM_SCREEN_DANGER_BUTTON_STYLE}
      >
        {state.deletingItem ? "Deleting…" : "Delete item"}
      </button>
      <ArchiveUiDestructiveConfirmationDialog
        state={state.itemDeleteConfirmation}
        onConfirm={handlers.onConfirmItemDelete}
        onCancel={handlers.onCancelItemDelete}
      />
    </div>
  );
}

function renderArchiveItemScreenActiveFileRow(
  file: ArchiveFile,
  data: ArchiveItemScreenData,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement {
  const download = state.downloads[file.id];
  const deleteCapability = data.capabilities.delete;
  const deleteDisabled = !deleteCapability.allowed || state.deletingFileIds.has(file.id);
  const downloadPending = download?.status === "pending";
  return (
    <li key={file.id}>
      <div data-archive-ui-file-id={file.id} style={ARCHIVE_ITEM_SCREEN_CARD_STYLE}>
        <span>{file.originalFileName}</span>
        <span style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>
          {file.mimeType} · {file.extension} · {archiveUiFormatByteSize(file.sizeBytes)}
        </span>
        <span style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>
          Uploaded <time dateTime={file.createdAt.toISOString()}>{file.createdAt.toISOString()}</time>
        </span>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button
            type="button"
            disabled={downloadPending}
            onClick={() => handlers.onDownloadFile(file.id)}
            style={ARCHIVE_ITEM_SCREEN_LINK_BUTTON_STYLE}
          >
            {downloadPending ? "Preparing download…" : "Download"}
          </button>
          {!deleteCapability.hidden ? (
            <button
              type="button"
              disabled={deleteDisabled}
              onClick={() => handlers.onRequestFileDelete(file)}
              style={ARCHIVE_ITEM_SCREEN_LINK_BUTTON_STYLE}
            >
              Delete
            </button>
          ) : null}
        </div>
        {download?.status === "ready" ? (
          <a href={download.url} download={download.filename} data-archive-ui-download-ready={file.id}>
            Download ready: {download.filename}
          </a>
        ) : null}
        {download?.status === "error" ? (
          <p role="alert" style={ARCHIVE_ITEM_SCREEN_ERROR_TEXT_STYLE}>
            Download failed. Please try again.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function renderArchiveItemScreenRecoverableFileRow(
  file: ArchiveRecoverableFile,
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement {
  const restoring = state.restoringFileIds.has(file.id);
  return (
    <li key={file.id}>
      <div data-archive-ui-recoverable-file-id={file.id} style={ARCHIVE_ITEM_SCREEN_CARD_STYLE}>
        <span>{file.originalFileName}</span>
        <span style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>
          {file.mimeType} · {file.extension} · {archiveUiFormatByteSize(file.sizeBytes)}
        </span>
        <span style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>
          Deleted <time dateTime={file.deletedAt.toISOString()}>{file.deletedAt.toISOString()}</time>
        </span>
        <button
          type="button"
          disabled={restoring}
          onClick={() => handlers.onRestoreFile(file.id)}
          style={ARCHIVE_ITEM_SCREEN_BUTTON_STYLE}
        >
          {restoring ? "Restoring…" : "Restore"}
        </button>
      </div>
    </li>
  );
}

function renderArchiveItemScreen(
  state: ArchiveItemScreenRenderState,
  handlers: ArchiveItemScreenRenderHandlers,
): ReactElement {
  const headingText = state.viewState.status === "ready" ? state.viewState.data.item.name : "Item";

  return (
    <section
      data-archive-ui-screen="item"
      aria-labelledby={ARCHIVE_ITEM_SCREEN_HEADING_ID}
      style={ARCHIVE_ITEM_SCREEN_CONTAINER_STYLE}
    >
      <h1 id={ARCHIVE_ITEM_SCREEN_HEADING_ID} style={ARCHIVE_ITEM_SCREEN_HEADING_STYLE}>
        {headingText}
      </h1>
      <ArchiveUiFeedbackBanner
        state={state.feedback}
        dismissLabel="Dismiss"
        onDismiss={handlers.onDismissFeedback}
      />
      <ArchiveUiStatePresentation
        state={state.viewState}
        loadingCopy={{ title: "Loading item…" }}
        emptyCopy={{ title: "This item is unavailable." }}
        renderReady={(data) => {
          const contentState = archiveUiItemScreenContentState(data);
          return (
            <>
              {renderArchiveItemScreenHeader(data, handlers)}
              <div style={ARCHIVE_ITEM_SCREEN_PANEL_STYLE}>
                <h2 style={ARCHIVE_ITEM_SCREEN_SECTION_HEADING_STYLE}>Actions</h2>
                {renderArchiveItemScreenStatusForm(data, state, handlers)}
                {renderArchiveItemScreenDatesForm(data, state, handlers)}
                {renderArchiveItemScreenUploadForm(data, state, handlers)}
                {renderArchiveItemScreenDeleteControl(data, state, handlers)}
              </div>
              <ArchiveUiStatePresentation
                state={contentState}
                loadingCopy={{ title: "Loading files…" }}
                emptyCopy={{
                  title: "No files yet",
                  description: "Upload a file to get started.",
                }}
                renderReady={(content) => (
                  <>
                    <div>
                      <h2 style={ARCHIVE_ITEM_SCREEN_SECTION_HEADING_STYLE}>Files</h2>
                      <ul role="list" aria-label="Active files" style={ARCHIVE_ITEM_SCREEN_GRID_STYLE}>
                        {content.activeFiles.map((file) =>
                          renderArchiveItemScreenActiveFileRow(file, data, state, handlers),
                        )}
                      </ul>
                    </div>
                    {!data.capabilities.restore.hidden ? (
                      <div>
                        <h2 style={ARCHIVE_ITEM_SCREEN_SECTION_HEADING_STYLE}>Deleted files</h2>
                        {content.recoverableFiles.length === 0 ? (
                          <p style={ARCHIVE_ITEM_SCREEN_MUTED_TEXT_STYLE}>
                            No deleted files available to restore.
                          </p>
                        ) : (
                          <ul
                            role="list"
                            aria-label="Deleted files"
                            style={ARCHIVE_ITEM_SCREEN_GRID_STYLE}
                          >
                            {content.recoverableFiles.map((file) =>
                              renderArchiveItemScreenRecoverableFileRow(file, state, handlers),
                            )}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              />
              <ArchiveUiDestructiveConfirmationDialog
                state={state.fileDeleteConfirmation}
                onConfirm={handlers.onConfirmFileDelete}
                onCancel={handlers.onCancelFileDelete}
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

export interface ArchiveItemScreenProps {
  readonly bridge: ArchiveUiBridge;
  readonly itemId: string;
}

interface ArchiveItemScreenState {
  readonly context: ArchiveContextInput | null;
  readonly viewState: ArchiveUiViewState<ArchiveItemScreenData>;
  readonly feedback: ArchiveUiFeedbackState;

  readonly statusField: ArchiveBusinessStatus;
  readonly updatingStatus: boolean;

  readonly dueAtField: string;
  readonly expiresAtField: string;
  readonly dueAtLoadedValue: string;
  readonly dueAtLoadedIso: string | null;
  readonly expiresAtLoadedValue: string;
  readonly expiresAtLoadedIso: string | null;
  readonly dateFieldErrors: ArchiveUiFieldErrorMap;
  readonly updatingDates: boolean;

  readonly itemDeleteConfirmation: ArchiveUiConfirmationState;
  readonly deletingItem: boolean;

  readonly uploadSelection: ArchiveUiUploadFileLike | null;
  readonly uploadSelectionName: string | null;
  readonly uploadFieldErrors: ArchiveUiFieldErrorMap;
  readonly uploading: boolean;
  readonly uploadInputKey: number;

  readonly fileDeleteConfirmation: ArchiveUiConfirmationState;
  readonly fileDeleteTargetId: string | null;
  readonly deletingFileIds: ReadonlySet<string>;

  readonly downloads: Readonly<Record<string, ArchiveItemScreenDownloadState>>;

  readonly restoringFileIds: ReadonlySet<string>;
}

function archiveUiInitialItemScreenState(): ArchiveItemScreenState {
  return {
    context: null,
    viewState: archiveUiViewStateLoading(),
    feedback: archiveUiFeedbackIdle(),
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
    itemDeleteConfirmation: archiveUiConfirmationIdle(),
    deletingItem: false,
    uploadSelection: null,
    uploadSelectionName: null,
    uploadFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    uploading: false,
    uploadInputKey: 0,
    fileDeleteConfirmation: archiveUiConfirmationIdle(),
    fileDeleteTargetId: null,
    deletingFileIds: new Set(),
    downloads: {},
    restoringFileIds: new Set(),
  };
}

// The Archive module item/details and file-operations screen (Correction
// Phase 6 TASK-06 Part A). A host mounts this with the real
// `ArchiveUiBridge` implementation and the target `itemId`; it owns its own
// load/status/date/delete/upload/download/restore lifecycle end to end. See
// the file-top HOOK-CALL CONSTRAINT note for why this is a class component.
export class ArchiveItemScreen extends React.Component<
  ArchiveItemScreenProps,
  ArchiveItemScreenState
> {
  // Card scope "Download flow": narrow disposal flag (not a general
  // lifecycle framework) so an in-flight download that resolves AFTER
  // unmount can revoke its own newly created object URL immediately and
  // apply no further state/feedback, instead of leaking the URL or calling
  // `setState` on an unmounted component.
  private downloadLifecycleDisposed = false;

  constructor(props: ArchiveItemScreenProps) {
    super(props);
    this.state = archiveUiInitialItemScreenState();
    this.handleBackToFolder = this.handleBackToFolder.bind(this);
    this.handleViewHistory = this.handleViewHistory.bind(this);
    this.handleStatusFieldChange = this.handleStatusFieldChange.bind(this);
    this.handleStatusSubmit = this.handleStatusSubmit.bind(this);
    this.handleDueAtChange = this.handleDueAtChange.bind(this);
    this.handleExpiresAtChange = this.handleExpiresAtChange.bind(this);
    this.handleDatesSubmit = this.handleDatesSubmit.bind(this);
    this.handleRequestItemDelete = this.handleRequestItemDelete.bind(this);
    this.handleCancelItemDelete = this.handleCancelItemDelete.bind(this);
    this.handleConfirmItemDelete = this.handleConfirmItemDelete.bind(this);
    this.handleUploadSelectionChange = this.handleUploadSelectionChange.bind(this);
    this.handleUploadSubmit = this.handleUploadSubmit.bind(this);
    this.handleDownloadFile = this.handleDownloadFile.bind(this);
    this.handleRequestFileDelete = this.handleRequestFileDelete.bind(this);
    this.handleCancelFileDelete = this.handleCancelFileDelete.bind(this);
    this.handleConfirmFileDelete = this.handleConfirmFileDelete.bind(this);
    this.handleRestoreFile = this.handleRestoreFile.bind(this);
    this.handleDismissFeedback = this.handleDismissFeedback.bind(this);
  }

  componentDidMount(): void {
    void this.loadItemScreen();
  }

  // Card scope "Download flow": revoke every remaining object URL on
  // unmount — no leaked blob URLs beyond the component's own lifetime. Also
  // marks the component disposed so any download still in flight can settle
  // safely afterward (see `handleDownloadFile`).
  componentWillUnmount(): void {
    this.downloadLifecycleDisposed = true;
    for (const entry of Object.values(this.state.downloads)) {
      if (entry.status === "ready") {
        URL.revokeObjectURL(entry.url);
      }
    }
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method `componentDidMount` calls above), so the real
  // mount-time bridge wiring is provable without a DOM renderer.
  async loadItemScreen(): Promise<void> {
    const result = await archiveUiLoadItemScreenData(this.props.bridge, this.props.itemId);
    if (result.viewState.status === "ready") {
      const { item } = result.viewState.data;
      const dueAtValue = archiveUiItemDateToInputValue(item.dueAt);
      const expiresAtValue = archiveUiItemDateToInputValue(item.expiresAt);
      this.setState({
        context: result.context,
        viewState: result.viewState,
        statusField: item.status,
        dueAtField: dueAtValue,
        dueAtLoadedValue: dueAtValue,
        dueAtLoadedIso: item.dueAt === null ? null : item.dueAt.toISOString(),
        expiresAtField: expiresAtValue,
        expiresAtLoadedValue: expiresAtValue,
        expiresAtLoadedIso: item.expiresAt === null ? null : item.expiresAt.toISOString(),
      });
      return;
    }
    this.setState({ context: result.context, viewState: result.viewState });
  }

  handleBackToFolder(): void {
    if (this.state.viewState.status !== "ready") return;
    // Card scope "Item presentation and navigation": exactly this intent,
    // no URL/path field.
    this.props.bridge.navigate({
      screen: "folder",
      folderId: this.state.viewState.data.item.folderId,
    });
  }

  handleViewHistory(): void {
    if (this.state.viewState.status !== "ready") return;
    this.props.bridge.navigate({
      screen: "history",
      target: { targetType: "item", targetId: this.state.viewState.data.item.id },
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

    const outcome = await archiveUiSubmitItemStatus(
      this.props.bridge,
      context,
      this.props.itemId,
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
        statusField: outcome.item.status,
        viewState: archiveUiViewStateReady(
          archiveUiApplyUpdatedItem(previous.viewState.data, outcome.item),
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

    const outcome = await archiveUiSubmitItemDates(this.props.bridge, context, this.props.itemId, {
      dueAt: { value: dueAtField, loadedValue: dueAtLoadedValue, loadedIso: dueAtLoadedIso },
      expiresAt: {
        value: expiresAtField,
        loadedValue: expiresAtLoadedValue,
        loadedIso: expiresAtLoadedIso,
      },
    });

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
      const updatedDueAtValue = archiveUiItemDateToInputValue(outcome.item.dueAt);
      const updatedExpiresAtValue = archiveUiItemDateToInputValue(outcome.item.expiresAt);
      return {
        ...previous,
        updatingDates: false,
        dueAtField: updatedDueAtValue,
        dueAtLoadedValue: updatedDueAtValue,
        dueAtLoadedIso: outcome.item.dueAt === null ? null : outcome.item.dueAt.toISOString(),
        expiresAtField: updatedExpiresAtValue,
        expiresAtLoadedValue: updatedExpiresAtValue,
        expiresAtLoadedIso:
          outcome.item.expiresAt === null ? null : outcome.item.expiresAt.toISOString(),
        dateFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
        viewState: archiveUiViewStateReady(
          archiveUiApplyUpdatedItem(previous.viewState.data, outcome.item),
        ),
        feedback: archiveUiFeedbackShow({ intent: "success", title: "Dates updated" }),
      };
    });
  }

  handleRequestItemDelete(): void {
    if (this.state.viewState.status !== "ready") return;
    const labels = archiveUiItemDeleteConfirmationLabels(this.state.viewState.data.item);
    this.setState({ itemDeleteConfirmation: archiveUiConfirmationRequest(labels) });
  }

  handleCancelItemDelete(): void {
    this.setState({ itemDeleteConfirmation: archiveUiConfirmationCancel() });
  }

  async handleConfirmItemDelete(): Promise<void> {
    const { context, deletingItem } = this.state;
    if (context === null || deletingItem) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.delete;
    if (!capability.allowed) return;

    this.setState({ deletingItem: true });

    const outcome = await archiveUiSubmitSoftDeleteItem(this.props.bridge, context, this.props.itemId);

    if (outcome.kind === "failure") {
      this.setState({
        deletingItem: false,
        itemDeleteConfirmation: archiveUiConfirmationCancel(),
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState({
      deletingItem: false,
      itemDeleteConfirmation: archiveUiConfirmationCancel(),
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Item deleted" }),
    });
    // Card scope "Item soft deletion": success navigates ONLY to the
    // containing folder.
    this.props.bridge.navigate({ screen: "folder", folderId: outcome.item.folderId });
  }

  handleUploadSelectionChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files !== null && event.target.files.length > 0 ? event.target.files[0] : null;
    this.setState({
      uploadSelection: file,
      uploadSelectionName: file !== null ? file.name : null,
      uploadFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    });
  }

  async handleUploadSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const { context, uploadSelection, uploading } = this.state;
    if (context === null || uploading) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.upload;
    if (!capability.allowed) return;

    this.setState({ uploading: true, uploadFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP });

    const outcome = await archiveUiSubmitItemFileUpload(
      this.props.bridge,
      context,
      this.props.itemId,
      uploadSelection,
    );

    if (outcome.kind === "validation") {
      this.setState({ uploading: false, uploadFieldErrors: outcome.fieldErrors });
      return;
    }
    if (outcome.kind === "failure") {
      this.setState({
        uploading: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => {
      if (previous.viewState.status !== "ready") return { ...previous, uploading: false };
      return {
        ...previous,
        uploading: false,
        uploadSelection: null,
        uploadSelectionName: null,
        uploadFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
        uploadInputKey: previous.uploadInputKey + 1,
        viewState: archiveUiViewStateReady(
          archiveUiApplyUploadedFile(previous.viewState.data, outcome.file),
        ),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: "File uploaded",
          description: outcome.file.originalFileName,
        }),
      };
    });
  }

  async handleDownloadFile(fileId: string): Promise<void> {
    const { context } = this.state;
    if (context === null) return;
    const existingBeforeRequest = this.state.downloads[fileId];
    if (existingBeforeRequest?.status === "pending") return;
    // Captured BEFORE marking pending below (which would otherwise overwrite
    // this same entry). The moment this request replaces it with "pending",
    // the previous ready URL is no longer reachable from state or from
    // `componentWillUnmount`'s cleanup — so it is revoked right here,
    // synchronously, exactly once, independent of whether this new request
    // goes on to succeed or fail.
    if (existingBeforeRequest?.status === "ready") {
      URL.revokeObjectURL(existingBeforeRequest.url);
    }

    this.setState((previous) => ({
      ...previous,
      downloads: { ...previous.downloads, [fileId]: { status: "pending" } },
    }));

    const outcome = await archiveUiRequestItemFileDownload(this.props.bridge, context, fileId);

    // Card scope "Download flow": if this component unmounted while the
    // request was in flight, never apply state/feedback to an unmounted
    // component. A successful outcome still owns a freshly created object
    // URL that nothing else will ever reference, so it is revoked
    // immediately here instead of being leaked.
    if (this.downloadLifecycleDisposed) {
      if (outcome.kind === "success") {
        URL.revokeObjectURL(outcome.url);
      }
      return;
    }

    if (outcome.kind === "failure") {
      this.setState((previous) => ({
        ...previous,
        downloads: { ...previous.downloads, [fileId]: { status: "error" } },
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      }));
      return;
    }

    this.setState((previous) => ({
      ...previous,
      downloads: {
        ...previous.downloads,
        [fileId]: { status: "ready", url: outcome.url, filename: outcome.filename },
      },
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Download ready" }),
    }));
  }

  handleRequestFileDelete(file: ArchiveFile): void {
    const labels = archiveUiFileDeleteConfirmationLabels(file);
    this.setState({
      fileDeleteTargetId: file.id,
      fileDeleteConfirmation: archiveUiConfirmationRequest(labels),
    });
  }

  handleCancelFileDelete(): void {
    this.setState({ fileDeleteTargetId: null, fileDeleteConfirmation: archiveUiConfirmationCancel() });
  }

  async handleConfirmFileDelete(): Promise<void> {
    const { context, fileDeleteTargetId, deletingFileIds } = this.state;
    if (context === null || fileDeleteTargetId === null) return;
    if (deletingFileIds.has(fileDeleteTargetId)) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.delete;
    if (!capability.allowed) return;

    const targetId = fileDeleteTargetId;
    this.setState((previous) => ({
      ...previous,
      deletingFileIds: new Set(previous.deletingFileIds).add(targetId),
    }));

    const outcome = await archiveUiSubmitSoftDeleteFile(this.props.bridge, context, targetId);

    if (outcome.kind === "failure") {
      this.setState((previous) => {
        const deletingFileIds = new Set(previous.deletingFileIds);
        deletingFileIds.delete(targetId);
        return {
          ...previous,
          deletingFileIds,
          fileDeleteTargetId: null,
          fileDeleteConfirmation: archiveUiConfirmationCancel(),
          feedback: archiveUiFeedbackShow({
            intent: "failure",
            title: outcome.presentation.title,
            description: outcome.presentation.description,
          }),
        };
      });
      return;
    }

    this.setState((previous) => {
      const deletingFileIds = new Set(previous.deletingFileIds);
      deletingFileIds.delete(targetId);
      if (previous.viewState.status !== "ready") {
        return {
          ...previous,
          deletingFileIds,
          fileDeleteTargetId: null,
          fileDeleteConfirmation: archiveUiConfirmationCancel(),
        };
      }
      return {
        ...previous,
        deletingFileIds,
        fileDeleteTargetId: null,
        fileDeleteConfirmation: archiveUiConfirmationCancel(),
        viewState: archiveUiViewStateReady(
          archiveUiApplyFileSoftDelete(previous.viewState.data, outcome.file),
        ),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: "File deleted",
          description: outcome.file.originalFileName,
        }),
      };
    });
  }

  async handleRestoreFile(fileId: string): Promise<void> {
    const { context, restoringFileIds } = this.state;
    if (context === null || restoringFileIds.has(fileId)) return;
    if (this.state.viewState.status !== "ready") return;
    const capability = this.state.viewState.data.capabilities.restore;
    if (!capability.allowed) return;

    this.setState((previous) => ({
      ...previous,
      restoringFileIds: new Set(previous.restoringFileIds).add(fileId),
    }));

    const outcome = await archiveUiSubmitRestoreFile(this.props.bridge, context, fileId);

    if (outcome.kind === "failure") {
      this.setState((previous) => {
        const restoringFileIds = new Set(previous.restoringFileIds);
        restoringFileIds.delete(fileId);
        return {
          ...previous,
          restoringFileIds,
          feedback: archiveUiFeedbackShow({
            intent: "failure",
            title: outcome.presentation.title,
            description: outcome.presentation.description,
          }),
        };
      });
      return;
    }

    this.setState((previous) => {
      const restoringFileIds = new Set(previous.restoringFileIds);
      restoringFileIds.delete(fileId);
      if (previous.viewState.status !== "ready") {
        return { ...previous, restoringFileIds };
      }
      return {
        ...previous,
        restoringFileIds,
        viewState: archiveUiViewStateReady(
          archiveUiApplyRestoredFile(previous.viewState.data, outcome.file),
        ),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: "File restored",
          description: outcome.file.originalFileName,
        }),
      };
    });
  }

  handleDismissFeedback(): void {
    this.setState((previous) => ({
      ...previous,
      feedback: archiveUiFeedbackDismiss(previous.feedback),
    }));
  }

  render(): ReactElement {
    return renderArchiveItemScreen(this.state, {
      onBackToFolder: this.handleBackToFolder,
      onViewHistory: this.handleViewHistory,
      onStatusFieldChange: this.handleStatusFieldChange,
      onStatusSubmit: this.handleStatusSubmit,
      onDueAtChange: this.handleDueAtChange,
      onExpiresAtChange: this.handleExpiresAtChange,
      onDatesSubmit: this.handleDatesSubmit,
      onRequestItemDelete: this.handleRequestItemDelete,
      onCancelItemDelete: this.handleCancelItemDelete,
      onConfirmItemDelete: this.handleConfirmItemDelete,
      onUploadSelectionChange: this.handleUploadSelectionChange,
      onUploadSubmit: this.handleUploadSubmit,
      onDownloadFile: this.handleDownloadFile,
      onRequestFileDelete: this.handleRequestFileDelete,
      onCancelFileDelete: this.handleCancelFileDelete,
      onConfirmFileDelete: this.handleConfirmFileDelete,
      onRestoreFile: this.handleRestoreFile,
      onDismissFeedback: this.handleDismissFeedback,
    });
  }
}
