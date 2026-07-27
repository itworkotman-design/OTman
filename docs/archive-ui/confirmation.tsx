// Archive UI destructive-confirmation primitives — Correction Phase 6 TASK-03
// (A-UI-DESTRUCT-001). This primitive NEVER executes any Archive mutation
// itself: `onConfirm`/`onCancel` are caller-supplied callbacks the screen
// wires to its own (bridge-mediated) mutation call — this module imports
// nothing from `./bridge.js` and calls no `ArchiveUiServicePort`/
// `ArchiveUiFileTransport` method anywhere.
// A real (not type-only) value import of `React` is required for the same
// test-runtime-transform reason documented at the top of `view-state.tsx`
// (classic JSX transform fallback in this repository's vitest/esbuild
// pipeline) — not a `react-dom`/router/host-framework dependency.
import * as React from "react";
import type { ReactElement } from "react";

export interface ArchiveUiConfirmationLabels {
  // The exact human-readable action being confirmed, e.g. "Delete", "Revoke".
  readonly actionLabel: string;
  // The exact human-readable subject affected, e.g. "folder \"Q3 Reports\"".
  readonly subjectLabel: string;
}

export type ArchiveUiConfirmationState =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly labels: ArchiveUiConfirmationLabels };

export function archiveUiConfirmationIdle(): ArchiveUiConfirmationState {
  return { status: "idle" };
}

// Requesting confirmation is always represented honestly as `pending`, even
// when the supplied labels are not (yet) confirmable — confirmability is a
// separate, explicit check (`archiveUiIsConfirmableLabel`/
// `describeArchiveUiDestructiveConfirmation`), never silently coerced away.
export function archiveUiConfirmationRequest(
  labels: ArchiveUiConfirmationLabels,
): ArchiveUiConfirmationState {
  return { status: "pending", labels };
}

export function archiveUiConfirmationCancel(): ArchiveUiConfirmationState {
  return archiveUiConfirmationIdle();
}

// A single label is "confirmable" only when it is non-empty after trimming
// whitespace — a whitespace-only string never counts as a real label.
export function archiveUiIsConfirmableLabel(label: string): boolean {
  return label.trim().length > 0;
}

// Both the exact action label AND the exact subject label must be
// confirmable before the primitive is representable as confirmable.
export function archiveUiIsConfirmableLabels(
  labels: ArchiveUiConfirmationLabels,
): boolean {
  return (
    archiveUiIsConfirmableLabel(labels.actionLabel) &&
    archiveUiIsConfirmableLabel(labels.subjectLabel)
  );
}

export interface ArchiveUiDestructiveConfirmationDescriptor {
  readonly open: boolean;
  // Accessible dialog naming (e.g. `aria-label`): combines the action and
  // subject labels; `undefined` while idle (no dialog is open to name).
  readonly dialogLabel: string | undefined;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  // `true` whenever the dialog is not open OR the labels are not (yet)
  // confirmable — confirm can never be enabled without both non-empty
  // labels.
  readonly confirmDisabled: boolean;
}

const DEFAULT_CANCEL_LABEL = "Cancel";
const DEFAULT_CONFIRM_LABEL = "Confirm";

export function describeArchiveUiDestructiveConfirmation(
  state: ArchiveUiConfirmationState,
): ArchiveUiDestructiveConfirmationDescriptor {
  if (state.status === "idle") {
    return {
      open: false,
      dialogLabel: undefined,
      confirmLabel: DEFAULT_CONFIRM_LABEL,
      cancelLabel: DEFAULT_CANCEL_LABEL,
      confirmDisabled: true,
    };
  }
  const confirmable = archiveUiIsConfirmableLabels(state.labels);
  return {
    open: true,
    dialogLabel: `${state.labels.actionLabel} ${state.labels.subjectLabel}`,
    confirmLabel: state.labels.actionLabel,
    cancelLabel: DEFAULT_CANCEL_LABEL,
    confirmDisabled: !confirmable,
  };
}

export interface ArchiveUiDestructiveConfirmationDialogProps {
  readonly state: ArchiveUiConfirmationState;
  // Caller-supplied; the primitive calls neither directly against any
  // Archive service/transport — it only forwards the exact function
  // reference the caller passed in.
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

// A small React component: renders nothing while idle; renders an
// accessible confirmation dialog (named via `dialogLabel`, explicit
// confirm/cancel controls, confirm disabled until both labels are
// confirmable) while pending. Behavior-testable by invoking as a plain
// function and inspecting the returned element tree — no DOM emulation
// required, and no Archive mutation is ever invoked here.
export function ArchiveUiDestructiveConfirmationDialog(
  props: ArchiveUiDestructiveConfirmationDialogProps,
): ReactElement | null {
  const descriptor = describeArchiveUiDestructiveConfirmation(props.state);
  if (!descriptor.open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={descriptor.dialogLabel}>
      <button type="button" onClick={props.onCancel}>
        {descriptor.cancelLabel}
      </button>
      <button
        type="button"
        disabled={descriptor.confirmDisabled}
        onClick={props.onConfirm}
      >
        {descriptor.confirmLabel}
      </button>
    </div>
  );
}
