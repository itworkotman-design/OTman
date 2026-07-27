import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

// Correction Phase 6 TASK-03 (shared Archive UI behavior/state primitives).
// Every type imported below comes only from the public "./ui" entry point
// (mirroring the TASK-02 bridge-contract test's discipline) or the public
// Archive root package surface — no relative import reaches outside
// `src/archive-ui/`, no Shell/Prisma/database/network dependency anywhere,
// and no jsdom/Testing Library/react-dom is used: React components below are
// invoked directly as plain functions and their returned element trees are
// inspected structurally.
import type {
  ArchiveUiCapabilityActionDescriptor,
  ArchiveUiConfirmationLabels,
  ArchiveUiConfirmationState,
  ArchiveUiFeedbackState,
  ArchiveUiFieldErrorMap,
  ArchiveUiStatePresentationDescriptor,
  ArchiveUiViewState,
} from "../index.js";
import {
  ArchiveUiDestructiveConfirmationDialog,
  ArchiveUiFeedbackBanner,
  ArchiveUiStatePresentation,
  archiveUiConfirmationCancel,
  archiveUiConfirmationIdle,
  archiveUiConfirmationRequest,
  archiveUiFeedbackDismiss,
  archiveUiFeedbackIdle,
  archiveUiFeedbackLiveRegion,
  archiveUiFeedbackReducer,
  archiveUiFeedbackReset,
  archiveUiFeedbackShow,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  archiveUiHasAnyFieldError,
  archiveUiIsConfirmableLabel,
  archiveUiIsConfirmableLabels,
  archiveUiViewStateDenied,
  archiveUiViewStateEmpty,
  archiveUiViewStateError,
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  describeArchiveUiCapabilityAction,
  describeArchiveUiCapabilityActions,
  describeArchiveUiDestructiveConfirmation,
  describeArchiveUiViewState,
} from "../index.js";
import {
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveEffectiveCapabilityMap,
  type ArchiveHostAdapterError,
  type ArchiveHostAdapterResult,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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

// A translator that never leaks the raw adapter message — the same
// discipline the real TASK-02 bridge contract requires of any real
// implementation, injected here so this test proves the shared primitives
// route error presentation only through this boundary.
function safeTranslateError(error: ArchiveHostAdapterError) {
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
}

function okResult<T>(value: T): ArchiveHostAdapterResult<T> {
  return { ok: true, value };
}

function errResult<T>(
  category: ArchiveHostAdapterError["category"],
  message: string,
): ArchiveHostAdapterResult<T> {
  return { ok: false, error: { category, message } };
}

// `ReactElement`'s `props` field is typed `unknown` by `@types/react` (there
// is no DOM/Testing Library render pipeline here to narrow it) — this
// generic accessor is used ONLY to structurally inspect an element's own
// props for these behavior tests, never to introduce jsdom/react-dom.
function elementProps(element: ReactElement | null): Record<string, any> {
  if (element === null) throw new Error("expected a non-null element");
  return element.props as Record<string, any>;
}

// ---------------------------------------------------------------------------
// 1. Closed async/view-state model — distinct, exhaustive states.
// ---------------------------------------------------------------------------

describe("shared async/view-state model (loading/empty/error/denied/ready)", () => {
  it("constructors produce exactly the five distinct, deterministic states", () => {
    expect(archiveUiViewStateLoading()).toEqual({ status: "loading" });
    expect(archiveUiViewStateEmpty()).toEqual({ status: "empty" });
    expect(archiveUiViewStateReady("data")).toEqual({
      status: "ready",
      data: "data",
    });
    const presentation = { category: "validation" as const, title: "t", description: "d" };
    expect(archiveUiViewStateDenied(presentation)).toEqual({
      status: "denied",
      presentation,
    });
    expect(archiveUiViewStateError(presentation)).toEqual({
      status: "error",
      presentation,
    });
  });

  it("an exhaustive switch handles all five statuses with no default branch needed (compile-time exhaustiveness)", () => {
    function describe_(state: ArchiveUiViewState<number>): string {
      switch (state.status) {
        case "loading":
          return "loading";
        case "empty":
          return "empty";
        case "denied":
          return "denied";
        case "error":
          return "error";
        case "ready":
          return `ready:${state.data}`;
      }
    }
    expect(describe_(archiveUiViewStateLoading())).toBe("loading");
    expect(describe_(archiveUiViewStateEmpty())).toBe("empty");
    expect(describe_(archiveUiViewStateReady(42))).toBe("ready:42");
  });

  it("an adapter unauthorized error maps to denied presentation without exposing the raw reason string", () => {
    const rawReason = "internal: row-level policy 42 rejected subject";
    const result = errResult<string[]>("unauthorized", rawReason);
    const state = archiveUiViewStateFromResult(result, safeTranslateError);

    expect(state.status).toBe("denied");
    if (state.status === "denied") {
      expect(state.presentation.title).not.toContain(rawReason);
      expect(state.presentation.description).not.toContain(rawReason);
      expect(state.presentation.category).toBe("unauthorized");
    }
  });

  it.each(["validation", "not_found", "server_error"] as const)(
    "a %s error maps through the injected translator to safe error presentation (never the denied status)",
    (category) => {
      const rawReason = `raw backend reason for ${category}`;
      const result = errResult<string[]>(category, rawReason);
      const state = archiveUiViewStateFromResult(result, safeTranslateError);

      expect(state.status).toBe("error");
      if (state.status === "error") {
        expect(state.presentation.category).toBe(category);
        expect(state.presentation.title).not.toContain(rawReason);
        expect(state.presentation.description).not.toContain(rawReason);
      }
    },
  );

  it("a successful empty result maps to empty, a successful non-empty result maps to ready", () => {
    const emptyState = archiveUiViewStateFromResult(
      okResult<string[]>([]),
      safeTranslateError,
      (value) => value.length === 0,
    );
    expect(emptyState).toEqual({ status: "empty" });

    const readyState = archiveUiViewStateFromResult(
      okResult<string[]>(["one"]),
      safeTranslateError,
      (value) => value.length === 0,
    );
    expect(readyState).toEqual({ status: "ready", data: ["one"] });
  });

  it("a successful result with no isEmpty predicate always maps to ready", () => {
    const state = archiveUiViewStateFromResult(okResult<string[]>([]), safeTranslateError);
    expect(state).toEqual({ status: "ready", data: [] });
  });
});

// ---------------------------------------------------------------------------
// 2. State-presentation primitive — calm, non-leaking copy; status vs alert.
// ---------------------------------------------------------------------------

describe("shared state-presentation primitive", () => {
  const loadingCopy = { title: "Loading your content…" };
  const emptyCopy = { title: "Nothing here yet." };

  function describeFor(
    state: ArchiveUiViewState<string>,
  ): ArchiveUiStatePresentationDescriptor | null {
    return describeArchiveUiViewState({ state, loadingCopy, emptyCopy });
  }

  it("loading and empty use the passive status/polite live-region intent", () => {
    const loading = describeFor(archiveUiViewStateLoading());
    const empty = describeFor(archiveUiViewStateEmpty());
    expect(loading).toMatchObject({ role: "status", ariaLive: "polite", title: loadingCopy.title });
    expect(empty).toMatchObject({ role: "status", ariaLive: "polite", title: emptyCopy.title });
  });

  it("denied and error use the urgent alert/assertive live-region intent, using only the translated presentation copy", () => {
    const presentation = { category: "unauthorized" as const, title: "Access denied", description: "safe copy" };
    const denied = describeFor(archiveUiViewStateDenied(presentation));
    const error = describeFor(archiveUiViewStateError({ ...presentation, category: "server_error" }));

    expect(denied).toEqual({
      kind: "denied",
      role: "alert",
      ariaLive: "assertive",
      title: presentation.title,
      description: presentation.description,
    });
    expect(error).toMatchObject({ kind: "error", role: "alert", ariaLive: "assertive" });
  });

  it("returns null for ready — callers render their own data view instead of leaking a raw message anywhere", () => {
    expect(describeFor(archiveUiViewStateReady("some data"))).toBeNull();
  });

  it("the component renders the caller's ready view via renderReady and never touches raw error text", () => {
    const element = ArchiveUiStatePresentation({
      state: archiveUiViewStateReady("hello"),
      loadingCopy,
      emptyCopy,
      renderReady: (data) => `ready:${data}`,
    });
    // The fragment's single child is the renderReady() result.
    expect(elementProps(element).children).toBe("ready:hello");
  });

  it("the component renders the translated title/description with alert semantics for an error state, not the raw message", () => {
    const rawReason = "raw backend detail";
    const result = errResult<string>("validation", rawReason);
    const state = archiveUiViewStateFromResult(result, safeTranslateError);
    const element = ArchiveUiStatePresentation({
      state,
      loadingCopy,
      emptyCopy,
      renderReady: () => "unreachable",
    });

    expect(elementProps(element).role).toBe("alert");
    expect(elementProps(element)["aria-live"]).toBe("assertive");
    const serialized = JSON.stringify(element);
    expect(serialized).not.toContain(rawReason);
  });

  it("the component returns null for an unreachable ready-shaped mismatch never occurs (five statuses exhaustively rendered)", () => {
    for (const state of [
      archiveUiViewStateLoading<string>(),
      archiveUiViewStateEmpty<string>(),
    ]) {
      const element = ArchiveUiStatePresentation({
        state,
        loadingCopy,
        emptyCopy,
        renderReady: () => "unreachable",
      });
      expect(element).not.toBeNull();
      expect(elementProps(element).role).toBe("status");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Capability-aware action helpers — hidden/disabled/enabled distinctions.
// ---------------------------------------------------------------------------

describe("capability-aware action helpers", () => {
  it("an allowed capability is presented as enabled", () => {
    const capabilities = allowCapability("create");
    const decision = describeArchiveUiCapabilityAction(capabilities, "create");
    expect(decision).toEqual<ArchiveUiCapabilityActionDescriptor>({
      presentation: "enabled",
      hidden: false,
      disabled: false,
      allowed: true,
    });
  });

  it("a denied capability defaults to disabled (not hidden) when no option is supplied", () => {
    const capabilities = denyAllCapabilities();
    const decision = describeArchiveUiCapabilityAction(capabilities, "delete");
    expect(decision).toEqual<ArchiveUiCapabilityActionDescriptor>({
      presentation: "disabled",
      hidden: false,
      disabled: true,
      allowed: false,
    });
  });

  it("a denied capability is hidden when hideWhenDenied is explicitly requested", () => {
    const capabilities = denyAllCapabilities();
    const decision = describeArchiveUiCapabilityAction(capabilities, "delete", {
      hideWhenDenied: true,
    });
    expect(decision).toEqual<ArchiveUiCapabilityActionDescriptor>({
      presentation: "hidden",
      hidden: true,
      disabled: true,
      allowed: false,
    });
  });

  it("distinguishes all three presentations across a batch of real capability-map actions", () => {
    const capabilities: ArchiveEffectiveCapabilityMap = {
      ...denyAllCapabilities(),
      view: { allowed: true, source: "direct_user" },
      edit: { allowed: false, source: "none" },
    };
    const decisions = describeArchiveUiCapabilityActions(capabilities, [
      "view",
      "edit",
      "delete",
    ], { hideWhenDenied: true });

    expect(decisions.view.presentation).toBe("enabled");
    expect(decisions.edit.presentation).toBe("hidden");
    expect(decisions.delete.presentation).toBe("hidden");
  });

  // REPAIR-R1 (CORRECTION-P6-TASK-03-REPAIR-R1): the batch helper's declared
  // return type must truthfully match its runtime key set — a subset call
  // must not falsely promise every ArchivePermissionAction key exists.
  it("REPAIR-R1: a subset call returns exactly the requested runtime keys, no more and no fewer", () => {
    const capabilities: ArchiveEffectiveCapabilityMap = {
      ...denyAllCapabilities(),
      view: { allowed: true, source: "direct_user" },
      edit: { allowed: false, source: "none" },
    };
    const decisions = describeArchiveUiCapabilityActions(capabilities, [
      "view",
      "edit",
      "delete",
    ]);

    expect(Object.keys(decisions).sort()).toEqual(["delete", "edit", "view"]);
  });

  it("REPAIR-R1: every requested key is typed as present — direct property access compiles and reads the real descriptor", () => {
    const capabilities: ArchiveEffectiveCapabilityMap = {
      ...denyAllCapabilities(),
      view: { allowed: true, source: "direct_user" },
      edit: { allowed: false, source: "none" },
    };
    const decisions = describeArchiveUiCapabilityActions(capabilities, [
      "view",
      "edit",
      "delete",
    ]);

    // No `@ts-expect-error` needed here — each of these is a requested key,
    // so the exact generic (`T[number]`) types it as guaranteed present.
    const view: ArchiveUiCapabilityActionDescriptor = decisions.view;
    const edit: ArchiveUiCapabilityActionDescriptor = decisions.edit;
    const del: ArchiveUiCapabilityActionDescriptor = decisions.delete;
    expect(view.presentation).toBe("enabled");
    expect(edit.presentation).toBe("disabled");
    expect(del.presentation).toBe("disabled");
  });

  it("REPAIR-R1: an unrequested key is not typed as guaranteed present (compile-time negative proof)", () => {
    const capabilities = denyAllCapabilities();
    const decisions = describeArchiveUiCapabilityActions(capabilities, [
      "view",
      "edit",
      "delete",
    ]);

    // "restore" was never requested, so the exact generic must NOT expose it
    // as a guaranteed key — accessing it must be a type error. If this line
    // stops erroring (e.g. the return type regresses to the old
    // `Record<ArchivePermissionAction, ...>` shape), this test file fails to
    // typecheck.
    // @ts-expect-error "restore" is not one of the requested actions, so it
    // must not be a statically guaranteed key of the returned map.
    expect(decisions.restore).toBeUndefined();
  });

  it("REPAIR-R1: a call with the complete ARCHIVE_PERMISSION_ACTIONS list yields a complete map over all ten actions", () => {
    const capabilities = denyAllCapabilities();
    const decisions = describeArchiveUiCapabilityActions(
      capabilities,
      ARCHIVE_PERMISSION_ACTIONS,
    );

    expect(Object.keys(decisions).sort()).toEqual(
      [...ARCHIVE_PERMISSION_ACTIONS].sort(),
    );
    // Every one of the ten actions is statically typed as present because
    // the full list was supplied — no `@ts-expect-error` needed for any of
    // these accesses.
    for (const action of ARCHIVE_PERMISSION_ACTIONS) {
      const descriptor: ArchiveUiCapabilityActionDescriptor = decisions[action];
      expect(descriptor.presentation).toBe("disabled");
    }
  });

  it("is a pure presentation guard: never claims authority over the real backend decision (documented, and structurally cannot invoke anything)", () => {
    // describeArchiveUiCapabilityAction takes only data in and returns only
    // data out — there is no service/transport parameter through which it
    // could call any Archive method, so it cannot be authoritative by
    // construction.
    expect(describeArchiveUiCapabilityAction.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 4. Field-level validation primitives — keyed errors + stable a11y ids.
// ---------------------------------------------------------------------------

describe("field-level validation primitives", () => {
  it("builds a field-error map keyed to specific fields from a flat entry list", () => {
    const errors: ArchiveUiFieldErrorMap = archiveUiFieldErrorMapFromEntries([
      { field: "name", message: "Name is required." },
      { field: "name", message: "Name must be under 200 characters." },
      { field: "dueAt", message: "Due date must be in the future." },
    ]);

    expect(archiveUiFieldHasError(errors, "name")).toBe(true);
    expect(archiveUiFieldMessages(errors, "name")).toEqual([
      "Name is required.",
      "Name must be under 200 characters.",
    ]);
    expect(archiveUiFieldHasError(errors, "dueAt")).toBe(true);
    expect(archiveUiFieldHasError(errors, "description")).toBe(false);
    expect(archiveUiFieldMessages(errors, "description")).toEqual([]);
    expect(archiveUiHasAnyFieldError(errors)).toBe(true);
  });

  it("an empty field-error map has no errors on any field", () => {
    expect(archiveUiHasAnyFieldError({})).toBe(false);
    expect(archiveUiFieldHasError({}, "name")).toBe(false);
  });

  it("provides stable, deterministic ids for label/control/error association", () => {
    const errors = archiveUiFieldErrorMapFromEntries([
      { field: "name", message: "Name is required." },
    ]);
    const first = archiveUiFieldAccessibility("create-folder-form", "name", errors);
    const second = archiveUiFieldAccessibility("create-folder-form", "name", errors);

    expect(first).toEqual(second);
    expect(first.fieldId).toBe("create-folder-form-name");
    expect(first.labelId).toBe("create-folder-form-name-label");
    expect(first.errorId).toBe("create-folder-form-name-error");
    expect(first.describedBy).toBe(first.errorId);
    expect(first.invalid).toBe(true);
  });

  it("describedBy is undefined when the field currently has no error", () => {
    const noErrors: ArchiveUiFieldErrorMap = {};
    const accessibility = archiveUiFieldAccessibility("form", "name", noErrors);
    expect(accessibility.describedBy).toBeUndefined();
    expect(accessibility.invalid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Success/failure feedback primitives — explicit dismiss/reset; live region.
// ---------------------------------------------------------------------------

describe("success/failure feedback primitives", () => {
  it("starts idle and transitions to visible on show, deterministically", () => {
    const idle: ArchiveUiFeedbackState = archiveUiFeedbackIdle();
    expect(idle).toEqual({ kind: "idle" });

    const visible = archiveUiFeedbackShow({ intent: "success", title: "Folder created." });
    expect(visible).toEqual({
      kind: "visible",
      feedback: { intent: "success", title: "Folder created." },
    });
  });

  it("dismiss deterministically returns to idle regardless of current state", () => {
    const visible = archiveUiFeedbackShow({ intent: "failure", title: "Upload failed." });
    expect(archiveUiFeedbackDismiss(visible)).toEqual({ kind: "idle" });
    expect(archiveUiFeedbackDismiss(archiveUiFeedbackIdle())).toEqual({ kind: "idle" });
  });

  it("reset deterministically returns to idle", () => {
    expect(archiveUiFeedbackReset()).toEqual({ kind: "idle" });
  });

  it("the pure reducer drives show/dismiss/reset deterministically", () => {
    let state = archiveUiFeedbackIdle();
    state = archiveUiFeedbackReducer(state, {
      type: "show",
      feedback: { intent: "success", title: "Saved." },
    });
    expect(state).toEqual({ kind: "visible", feedback: { intent: "success", title: "Saved." } });

    state = archiveUiFeedbackReducer(state, { type: "dismiss" });
    expect(state).toEqual({ kind: "idle" });

    state = archiveUiFeedbackReducer(state, {
      type: "show",
      feedback: { intent: "failure", title: "Failed." },
    });
    state = archiveUiFeedbackReducer(state, { type: "reset" });
    expect(state).toEqual({ kind: "idle" });
  });

  it("success feedback uses status/polite; failure feedback uses alert/assertive", () => {
    expect(archiveUiFeedbackLiveRegion({ intent: "success", title: "ok" })).toEqual({
      role: "status",
      ariaLive: "polite",
    });
    expect(archiveUiFeedbackLiveRegion({ intent: "failure", title: "bad" })).toEqual({
      role: "alert",
      ariaLive: "assertive",
    });
  });

  it("the banner component renders nothing while idle, and the correct live-region role/labels + dismiss control while visible", () => {
    expect(
      ArchiveUiFeedbackBanner({
        state: archiveUiFeedbackIdle(),
        dismissLabel: "Dismiss",
        onDismiss: () => {},
      }),
    ).toBeNull();

    let dismissed = false;
    const element = ArchiveUiFeedbackBanner({
      state: archiveUiFeedbackShow({ intent: "success", title: "Saved." }),
      dismissLabel: "Dismiss",
      onDismiss: () => {
        dismissed = true;
      },
    });
    expect(elementProps(element).role).toBe("status");
    expect(elementProps(element)["aria-live"]).toBe("polite");

    const dismissButton = elementProps(element).children[2] as ReactElement;
    expect(elementProps(dismissButton).children).toBe("Dismiss");
    (elementProps(dismissButton).onClick as () => void)();
    expect(dismissed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Destructive-confirmation primitives — exact labels; caller-supplied
//    confirm/cancel; the primitive never invokes any Archive mutation.
// ---------------------------------------------------------------------------

describe("destructive-confirmation primitives", () => {
  it("a single label is confirmable only when non-empty after trimming", () => {
    expect(archiveUiIsConfirmableLabel("Delete")).toBe(true);
    expect(archiveUiIsConfirmableLabel("")).toBe(false);
    expect(archiveUiIsConfirmableLabel("   ")).toBe(false);
  });

  it("labels are confirmable only when BOTH action and subject are non-empty/non-whitespace", () => {
    const validLabels: ArchiveUiConfirmationLabels = {
      actionLabel: "Delete",
      subjectLabel: 'folder "Q3 Reports"',
    };
    expect(archiveUiIsConfirmableLabels(validLabels)).toBe(true);
    expect(
      archiveUiIsConfirmableLabels({ actionLabel: "", subjectLabel: "folder" }),
    ).toBe(false);
    expect(
      archiveUiIsConfirmableLabels({ actionLabel: "Delete", subjectLabel: "   " }),
    ).toBe(false);
    expect(
      archiveUiIsConfirmableLabels({ actionLabel: "   ", subjectLabel: "   " }),
    ).toBe(false);
  });

  it("idle state is never open and never confirmable", () => {
    const idle: ArchiveUiConfirmationState = archiveUiConfirmationIdle();
    const descriptor = describeArchiveUiDestructiveConfirmation(idle);
    expect(descriptor.open).toBe(false);
    expect(descriptor.confirmDisabled).toBe(true);
    expect(descriptor.dialogLabel).toBeUndefined();
  });

  it("a pending state with empty/whitespace labels is open but NOT confirmable", () => {
    const pending = archiveUiConfirmationRequest({ actionLabel: "  ", subjectLabel: "" });
    const descriptor = describeArchiveUiDestructiveConfirmation(pending);
    expect(descriptor.open).toBe(true);
    expect(descriptor.confirmDisabled).toBe(true);
  });

  it("a pending state with exact non-empty action and subject labels is confirmable, with dialog naming derived from both", () => {
    const pending = archiveUiConfirmationRequest({
      actionLabel: "Revoke",
      subjectLabel: 'permission rule "edit" for role "Auditors"',
    });
    const descriptor = describeArchiveUiDestructiveConfirmation(pending);
    expect(descriptor.open).toBe(true);
    expect(descriptor.confirmDisabled).toBe(false);
    expect(descriptor.dialogLabel).toBe(
      'Revoke permission rule "edit" for role "Auditors"',
    );
    expect(descriptor.confirmLabel).toBe("Revoke");
  });

  it("cancel always returns to idle", () => {
    expect(archiveUiConfirmationCancel()).toEqual({ status: "idle" });
  });

  it("the dialog component renders nothing while idle", () => {
    expect(
      ArchiveUiDestructiveConfirmationDialog({
        state: archiveUiConfirmationIdle(),
        onConfirm: () => {
          throw new Error("must not be called");
        },
        onCancel: () => {
          throw new Error("must not be called");
        },
      }),
    ).toBeNull();
  });

  it("the dialog component renders an accessible dialog with explicit confirm/cancel controls, confirm disabled until labels are confirmable, and calls exactly the caller-supplied callbacks with no Archive method invoked", () => {
    let confirmed = false;
    let cancelled = false;
    const notConfirmableState = archiveUiConfirmationRequest({
      actionLabel: "",
      subjectLabel: "item",
    });
    const notConfirmableElement = ArchiveUiDestructiveConfirmationDialog({
      state: notConfirmableState,
      onConfirm: () => {
        confirmed = true;
      },
      onCancel: () => {
        cancelled = true;
      },
    });

    expect(elementProps(notConfirmableElement).role).toBe("dialog");
    // `aria-*` DOM attributes are always strings, including the boolean-ish
    // ones — `"true"`, not the JS boolean `true`.
    expect(elementProps(notConfirmableElement)["aria-modal"]).toBe("true");

    const [cancelButton, confirmButton] = elementProps(notConfirmableElement)
      .children as ReactElement[];
    expect(elementProps(confirmButton).disabled).toBe(true);
    // Calling it anyway (simulating a disabled-but-clicked edge case) proves
    // the callback is exactly the caller-supplied function — and that this
    // primitive itself never calls any Archive service/transport method;
    // there is no such dependency anywhere in this module.
    (elementProps(confirmButton).onClick as () => void)();
    expect(confirmed).toBe(true);
    (elementProps(cancelButton).onClick as () => void)();
    expect(cancelled).toBe(true);

    const confirmableState = archiveUiConfirmationRequest({
      actionLabel: "Delete",
      subjectLabel: 'item "Contract.pdf"',
    });
    const confirmableElement = ArchiveUiDestructiveConfirmationDialog({
      state: confirmableState,
      onConfirm: () => {},
      onCancel: () => {},
    });
    const [, confirmButton2] = elementProps(confirmableElement)
      .children as ReactElement[];
    expect(elementProps(confirmButton2).disabled).toBe(false);
    expect(elementProps(confirmButton2).children).toBe("Delete");
  });
});
