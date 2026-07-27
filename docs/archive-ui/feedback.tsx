// Archive UI success/failure feedback primitives — Correction Phase 6 TASK-03
// (A-UI-FEEDBACK-001). Explicit feedback state with deterministic
// dismiss/reset behavior and an accessibility-oriented live-region contract
// (status vs alert intent) — no toast infrastructure tied to a host
// framework; a host/screen renders `ArchiveUiFeedbackBanner` (or its own
// presentation) wherever it wants.
// A real (not type-only) value import of `React` is required for the same
// test-runtime-transform reason documented at the top of `view-state.tsx`
// (classic JSX transform fallback in this repository's vitest/esbuild
// pipeline) — not a `react-dom`/router/host-framework dependency.
import * as React from "react";
import type { ReactElement } from "react";

export type ArchiveUiFeedbackIntent = "success" | "failure";

export interface ArchiveUiFeedback {
  readonly intent: ArchiveUiFeedbackIntent;
  readonly title: string;
  readonly description?: string;
}

export type ArchiveUiFeedbackState =
  | { readonly kind: "idle" }
  | { readonly kind: "visible"; readonly feedback: ArchiveUiFeedback };

export function archiveUiFeedbackIdle(): ArchiveUiFeedbackState {
  return { kind: "idle" };
}

export function archiveUiFeedbackShow(
  feedback: ArchiveUiFeedback,
): ArchiveUiFeedbackState {
  return { kind: "visible", feedback };
}

// Dismiss and reset are both explicit, deterministic, and total: dismissing
// an already-idle state (or resetting a visible one) always yields exactly
// `{ kind: "idle" }`, never throws, never depends on prior state shape.
export function archiveUiFeedbackDismiss(
  _state: ArchiveUiFeedbackState,
): ArchiveUiFeedbackState {
  return archiveUiFeedbackIdle();
}

export function archiveUiFeedbackReset(): ArchiveUiFeedbackState {
  return archiveUiFeedbackIdle();
}

export type ArchiveUiFeedbackAction =
  | { readonly type: "show"; readonly feedback: ArchiveUiFeedback }
  | { readonly type: "dismiss" }
  | { readonly type: "reset" };

// A pure reducer suitable for `useReducer` (or manual driving in tests) —
// deterministic and free of any host/database/network dependency.
export function archiveUiFeedbackReducer(
  state: ArchiveUiFeedbackState,
  action: ArchiveUiFeedbackAction,
): ArchiveUiFeedbackState {
  switch (action.type) {
    case "show":
      return archiveUiFeedbackShow(action.feedback);
    case "dismiss":
      return archiveUiFeedbackDismiss(state);
    case "reset":
      return archiveUiFeedbackReset();
  }
}

export interface ArchiveUiFeedbackLiveRegion {
  readonly role: "status" | "alert";
  readonly ariaLive: "polite" | "assertive";
}

// Success feedback is a passive announcement (`status`/`polite`); failure
// feedback is urgent (`alert`/`assertive`) — the same status-vs-alert
// distinction the shared view-state primitive uses for denied/error.
export function archiveUiFeedbackLiveRegion(
  feedback: ArchiveUiFeedback,
): ArchiveUiFeedbackLiveRegion {
  return feedback.intent === "success"
    ? { role: "status", ariaLive: "polite" }
    : { role: "alert", ariaLive: "assertive" };
}

export interface ArchiveUiFeedbackBannerProps {
  readonly state: ArchiveUiFeedbackState;
  readonly dismissLabel: string;
  readonly onDismiss: () => void;
}

// A small React component: renders nothing while idle; renders the feedback
// with correct live-region semantics and an explicit dismiss control while
// visible. Behavior-testable by invoking as a plain function and inspecting
// the returned element tree — no DOM emulation required.
export function ArchiveUiFeedbackBanner(
  props: ArchiveUiFeedbackBannerProps,
): ReactElement | null {
  if (props.state.kind === "idle") return null;
  const { feedback } = props.state;
  const region = archiveUiFeedbackLiveRegion(feedback);
  return (
    <div
      role={region.role}
      aria-live={region.ariaLive}
      data-archive-ui-feedback-intent={feedback.intent}
    >
      <p>{feedback.title}</p>
      {feedback.description !== undefined ? <p>{feedback.description}</p> : null}
      <button type="button" onClick={props.onDismiss}>
        {props.dismissLabel}
      </button>
    </div>
  );
}
