// Archive UI shared async/view-state primitives — Correction Phase 6 TASK-03
// (shared Archive UI behavior/primitives layer). Host-neutral, screen-agnostic:
// no Shell/Next.js/router/window/document-global dependency, no URL contract,
// no host-chrome signal, no direct network/database access, no CSS-token
// invention. Consumes only the TASK-02 bridge error-presentation types
// (`../bridge.js`) and the public Archive root result type
// (`ArchiveHostAdapterResult`) — never constructs a bridge, host adapter,
// Prisma client, repository, service, transport, or host implementation.
//
// A-UI-STATE-001: every screen must exhaustively handle loading/empty/error/
// denied/ready. This module defines the CLOSED state union all screens share
// plus deterministic, pure constructors/derivations so the state machinery is
// fully testable without a host, database, router, or network.
// A real (not type-only) value import of `React` is required here: this
// repository's vitest/esbuild test transform has no project-wide JSX
// pragma/automatic-runtime configuration (the root `tsconfig.json` that
// `tsconfck` resolves first carries no `jsx` compiler option at all), so it
// falls back to the CLASSIC JSX transform at test-execution time, which
// emits bare `React.createElement(...)` calls expecting `React` to be an
// in-scope value — even though `tsconfig.ui.json`'s `jsx: "react-jsx"`
// setting is what TypeScript itself uses for type-checking. Importing the
// value keeps both the type-check path and the actual test-runtime
// transform working; this does not add `react-dom`, a router, or a host
// framework dependency.
import * as React from "react";
import type { ReactElement, ReactNode } from "react";

import type {
  ArchiveUiErrorPresentation,
  ArchiveUiErrorTranslator,
} from "./bridge";
import type { ArchiveHostAdapterResult } from "@customprojects/custom-archive";

// -----------------------------------------------------------------------
// The closed view-state union.
// -----------------------------------------------------------------------

export type ArchiveUiViewStateStatus =
  | "loading"
  | "empty"
  | "denied"
  | "error"
  | "ready";

export interface ArchiveUiViewStateLoading {
  readonly status: "loading";
}

export interface ArchiveUiViewStateEmpty {
  readonly status: "empty";
}

export interface ArchiveUiViewStateDenied {
  readonly status: "denied";
  readonly presentation: ArchiveUiErrorPresentation;
}

export interface ArchiveUiViewStateError {
  readonly status: "error";
  readonly presentation: ArchiveUiErrorPresentation;
}

export interface ArchiveUiViewStateReady<T> {
  readonly status: "ready";
  readonly data: T;
}

// Exactly five variants (A-UI-STATE-001) — no sixth status exists anywhere
// in this union, so an exhaustive `switch` over `.status` is a compile-time
// guarantee, not a convention.
export type ArchiveUiViewState<T> =
  | ArchiveUiViewStateLoading
  | ArchiveUiViewStateEmpty
  | ArchiveUiViewStateDenied
  | ArchiveUiViewStateError
  | ArchiveUiViewStateReady<T>;

// -----------------------------------------------------------------------
// Deterministic constructors — no host/database/router/network dependency.
// -----------------------------------------------------------------------

export function archiveUiViewStateLoading<T>(): ArchiveUiViewState<T> {
  return { status: "loading" };
}

export function archiveUiViewStateEmpty<T>(): ArchiveUiViewState<T> {
  return { status: "empty" };
}

export function archiveUiViewStateReady<T>(data: T): ArchiveUiViewState<T> {
  return { status: "ready", data };
}

export function archiveUiViewStateDenied<T>(
  presentation: ArchiveUiErrorPresentation,
): ArchiveUiViewState<T> {
  return { status: "denied", presentation };
}

export function archiveUiViewStateError<T>(
  presentation: ArchiveUiErrorPresentation,
): ArchiveUiViewState<T> {
  return { status: "error", presentation };
}

// -----------------------------------------------------------------------
// Deriving a view state from a real `ArchiveHostAdapterResult`, through the
// caller-injected TASK-02 `ArchiveUiErrorTranslator` — never reading
// `error.message` directly here. The four-category closed set maps as:
// `unauthorized` -> denied (never exposing the raw reason string); every
// other category (`validation`/`not_found`/`server_error`) -> error, via the
// SAME injected translator, so the safe-presentation boundary is the only
// path from an adapter error to UI copy.
// -----------------------------------------------------------------------

export function archiveUiViewStateFromResult<T>(
  result: ArchiveHostAdapterResult<T>,
  translateError: ArchiveUiErrorTranslator,
  isEmpty?: (value: T) => boolean,
): ArchiveUiViewState<T> {
  if (!result.ok) {
    const presentation = translateError(result.error);
    return result.error.category === "unauthorized"
      ? archiveUiViewStateDenied(presentation)
      : archiveUiViewStateError(presentation);
  }
  if (isEmpty !== undefined && isEmpty(result.value)) {
    return archiveUiViewStateEmpty();
  }
  return archiveUiViewStateReady(result.value);
}

// -----------------------------------------------------------------------
// Shared state-presentation primitive (A-UI-STATE-001). Calm, non-leaking
// copy is always supplied through safe presentation data: `loadingCopy`/
// `emptyCopy` are host/screen-supplied (there is no adapter error to
// translate for those two states), and `error`/`denied` copy comes only from
// the state's own already-translated `presentation` — never from a raw
// `ArchiveHostAdapterError.message`. `intent` distinguishes a passive
// announcement (`status`, `aria-live="polite"`) from an urgent one (`alert`,
// `aria-live="assertive"`) for accessible live-region semantics.
// -----------------------------------------------------------------------

export interface ArchiveUiStateCopy {
  readonly title: string;
  readonly description?: string;
}

export type ArchiveUiLiveRegionRole = "status" | "alert";
export type ArchiveUiLiveRegionIntent = "polite" | "assertive";

export interface ArchiveUiStatePresentationDescriptor {
  readonly kind: "loading" | "empty" | "denied" | "error";
  readonly role: ArchiveUiLiveRegionRole;
  readonly ariaLive: ArchiveUiLiveRegionIntent;
  readonly title: string;
  readonly description?: string;
}

export interface ArchiveUiStatePresentationCopySource<T> {
  readonly state: ArchiveUiViewState<T>;
  readonly loadingCopy: ArchiveUiStateCopy;
  readonly emptyCopy: ArchiveUiStateCopy;
}

// Returns `null` for the `ready` status: there is no non-leaking-copy
// descriptor for ready data — the caller renders its own data view instead
// (see `ArchiveUiStatePresentation` below).
export function describeArchiveUiViewState<T>(
  source: ArchiveUiStatePresentationCopySource<T>,
): ArchiveUiStatePresentationDescriptor | null {
  const { state } = source;
  switch (state.status) {
    case "loading":
      return {
        kind: "loading",
        role: "status",
        ariaLive: "polite",
        title: source.loadingCopy.title,
        description: source.loadingCopy.description,
      };
    case "empty":
      return {
        kind: "empty",
        role: "status",
        ariaLive: "polite",
        title: source.emptyCopy.title,
        description: source.emptyCopy.description,
      };
    case "denied":
      return {
        kind: "denied",
        role: "alert",
        ariaLive: "assertive",
        title: state.presentation.title,
        description: state.presentation.description,
      };
    case "error":
      return {
        kind: "error",
        role: "alert",
        ariaLive: "assertive",
        title: state.presentation.title,
        description: state.presentation.description,
      };
    case "ready":
      return null;
  }
}

export interface ArchiveUiStatePresentationProps<T>
  extends ArchiveUiStatePresentationCopySource<T> {
  readonly renderReady: (data: T) => ReactNode;
}

// A small React component: renders the calm state descriptor for
// loading/empty/denied/error, or delegates to the caller's own ready-data
// renderer. No DOM/browser API is used — this is behavior-testable by
// invoking the component as a plain function and inspecting the returned
// element tree, with no jsdom/Testing Library/react-dom required.
export function ArchiveUiStatePresentation<T>(
  props: ArchiveUiStatePresentationProps<T>,
): ReactElement | null {
  if (props.state.status === "ready") {
    return <>{props.renderReady(props.state.data)}</>;
  }
  const descriptor = describeArchiveUiViewState(props);
  if (descriptor === null) return null;
  return (
    <div
      role={descriptor.role}
      aria-live={descriptor.ariaLive}
      data-archive-ui-state={descriptor.kind}
    >
      <p>{descriptor.title}</p>
      {descriptor.description !== undefined ? (
        <p>{descriptor.description}</p>
      ) : null}
    </div>
  );
}
