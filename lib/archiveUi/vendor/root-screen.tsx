// Archive UI root/home screen — Correction Phase 6 TASK-04 (§7 item 1,
// A-UI-STATE-001, A-UI-ACTION-001, A-UI-FORM-001, A-UI-FEEDBACK-001,
// A-UI-RESP-001). The Archive module's root screen: lists root folders,
// lets the caller open one (navigation intent only), and — capability
// permitting — create a new root folder. Host-neutral: depends only on the
// TASK-02 bridge contract (`./bridge.js`), the TASK-03 shared primitives
// (`./view-state.js`, `./capabilities.js`, `./validation.js`,
// `./feedback.js`), and the public Archive root package surface
// (`@customprojects/custom-archive`) — no Shell/Next.js/router/window/
// document-global/Prisma/repository/service/internal-Archive import
// anywhere in this file.
//
// HOOK-CALL CONSTRAINT (recorded honestly, mirroring the classic-JSX-
// transform note at the top of `view-state.tsx`): this repository's test
// toolchain has no `react-dom`/renderer (forbidden by the TASK-04 card), and
// React's hook dispatcher is `null` outside of an active render performed by
// a real renderer — calling a hook (`useState`/`useEffect`/...) through a
// bare function invocation throws "Invalid hook call" (verified directly
// against the installed `react@19.2.7` before writing this file). A
// hooks-based function component is therefore NOT directly invokable in this
// repository's test environment. `ArchiveRootScreen` is instead implemented
// as a `React.Component` SUBCLASS — a fully standard, first-class React
// component form that any real host renderer (react-dom, or otherwise)
// mounts identically to a hooks-based function component — because a class
// component's own methods (`constructor`, `componentDidMount`, `render`, and
// the event-handler methods below) are ordinary methods a test can invoke
// directly on a real instance, with no hook dispatcher involved. This is not
// a parallel/competing rendering system: it is one `React.Component`
// instance, using only the stable, decades-old class-component contract
// `react` itself defines.
import * as React from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactElement } from "react";

import type { ArchiveUiBridge, ArchiveUiErrorPresentation } from "./bridge";
import {
  archiveUiViewStateDenied,
  archiveUiViewStateError,
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state";
import {
  describeArchiveUiCapabilityAction,
  type ArchiveUiCapabilityActionDescriptor,
} from "./capabilities";
import {
  ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  archiveUiHasAnyFieldError,
  type ArchiveUiFieldErrorMap,
} from "./validation";
import {
  archiveUiFeedbackDismiss,
  archiveUiFeedbackIdle,
  archiveUiFeedbackShow,
  ArchiveUiFeedbackBanner,
  type ArchiveUiFeedbackState,
} from "./feedback";
import type {
  ArchiveContextInput,
  ArchiveFolder,
  ArchiveHostAdapterError,
} from "@customprojects/custom-archive";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveRootScreen`'s methods call — not a duplicated
// stand-in — so testing these functions directly and testing the class
// instance's wiring together cover the real implementation with no gap.
// ---------------------------------------------------------------------------

export interface ArchiveRootScreenLoadResult {
  readonly context: ArchiveContextInput;
  readonly viewState: ArchiveUiViewState<ArchiveFolder[]>;
  readonly createCapability: ArchiveUiCapabilityActionDescriptor;
}

// The capability-presentation choice documented for TASK-04 (card scope item
// 7): denied `create` renders DISABLED, not hidden — the same default
// `describeArchiveUiCapabilityAction` itself uses (`hideWhenDenied` defaults
// to `false`). A disabled control is honest about the action's existence
// without implying it is currently usable, and is more discoverable than
// silently hiding it; backend authorization on the real `createFolder` call
// remains the sole authoritative boundary regardless of this presentation.
function archiveUiRootScreenDeniedCreateCapability(): ArchiveUiCapabilityActionDescriptor {
  return { presentation: "disabled", hidden: false, disabled: true, allowed: false };
}

// Shared failure-path construction for `archiveUiLoadRootScreenData` below:
// an `unauthorized` root-read error becomes the calm `denied` state; every
// other category routes through the bridge's own `translateError` into
// `error` — neither path ever reads `error.message` directly.
function archiveUiRootScreenFailureResult(
  context: ArchiveContextInput,
  bridge: ArchiveUiBridge,
  error: ArchiveHostAdapterError,
): ArchiveRootScreenLoadResult {
  const presentation = bridge.translateError(error);
  const viewState: ArchiveUiViewState<ArchiveFolder[]> =
    error.category === "unauthorized"
      ? archiveUiViewStateDenied(presentation)
      : archiveUiViewStateError(presentation);
  return {
    context,
    viewState,
    createCapability: archiveUiRootScreenDeniedCreateCapability(),
  };
}

// Root loading (card scope item 3/4): obtains the current context, loads
// root folders and the exact namespace-scoped `create` capability in
// parallel, and derives the closed five-status view state. An `unauthorized`
// result from EITHER required root read becomes the calm `denied` state
// (never leaking `error.message`); every other failure routes through the
// bridge's own `translateError`. On success, the `create` capability is
// derived from the real `ArchiveEffectiveCapabilityMap` — no second
// authorization model.
export async function archiveUiLoadRootScreenData(
  bridge: ArchiveUiBridge,
): Promise<ArchiveRootScreenLoadResult> {
  const context = bridge.getContext();
  const [foldersResult, capabilitiesResult] = await Promise.all([
    bridge.service.listRootFolders(context),
    bridge.service.getEffectiveCapabilities(context, {
      targetType: "namespace",
      targetId: context.tenantId,
    }),
  ]);

  // TASK-04 REPAIR-R1: `unauthorized` from EITHER required read has
  // deterministic highest presentation priority, independent of which read
  // is checked first below — an `unauthorized` folder read yields `denied`
  // even when capabilities also failed non-unauthorized, and an
  // `unauthorized` capabilities read yields `denied` even when folders also
  // failed non-unauthorized (previously, checking `foldersResult` first
  // meant a non-unauthorized folder failure paired with an unauthorized
  // capabilities failure incorrectly rendered `error` instead of `denied`).
  if (!foldersResult.ok && foldersResult.error.category === "unauthorized") {
    return archiveUiRootScreenFailureResult(context, bridge, foldersResult.error);
  }
  if (!capabilitiesResult.ok && capabilitiesResult.error.category === "unauthorized") {
    return archiveUiRootScreenFailureResult(context, bridge, capabilitiesResult.error);
  }

  // Neither failure (if any) is `unauthorized` at this point. Two sequential
  // guards (rather than a single combined condition) so TypeScript narrows
  // each result to `{ ok: true; ... }` for the success path below without an
  // unreachable branch. When BOTH reads fail non-unauthorized, the folder
  // read's error is deterministically selected (documented, non-taxonomy
  // choice per the REPAIR-R1 card: the smallest acceptable selection is the
  // existing folder-read-first behavior) — no aggregate/combined error type
  // is introduced.
  if (!foldersResult.ok) {
    return archiveUiRootScreenFailureResult(context, bridge, foldersResult.error);
  }
  if (!capabilitiesResult.ok) {
    return archiveUiRootScreenFailureResult(context, bridge, capabilitiesResult.error);
  }

  const viewState = archiveUiViewStateFromResult(
    foldersResult,
    bridge.translateError,
    (folders) => folders.length === 0,
  );
  const createCapability = describeArchiveUiCapabilityAction(
    capabilitiesResult.value,
    "create",
  );
  return { context, viewState, createCapability };
}

// Client-side layer over server authority (card scope item 8): a
// trimmed-empty name is the only client validation rule for this bounded
// flow — everything else is left to the backend.
export function archiveUiValidateRootFolderName(
  name: string,
): ArchiveUiFieldErrorMap {
  if (name.trim().length === 0) {
    return archiveUiFieldErrorMapFromEntries([
      { field: "name", message: "Enter a folder name." },
    ]);
  }
  return ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP;
}

export interface ArchiveUiCreateRootFolderInput {
  readonly name: string;
  readonly description: string;
}

export type ArchiveUiCreateRootFolderOutcome =
  | { readonly kind: "validation"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success"; readonly folder: ArchiveFolder };

// The bounded create-root-folder flow (card scope item 8): a trimmed-empty
// name never reaches `createFolder` — it returns a field-specific validation
// outcome instead. A valid submit always passes `parentFolderId: null` (a
// ROOT folder, never a second namespace/parent target); a blank description
// is normalized to `null` rather than an empty string.
export async function archiveUiSubmitCreateRootFolder(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  input: ArchiveUiCreateRootFolderInput,
): Promise<ArchiveUiCreateRootFolderOutcome> {
  const fieldErrors = archiveUiValidateRootFolderName(input.name);
  if (archiveUiHasAnyFieldError(fieldErrors)) {
    return { kind: "validation", fieldErrors };
  }

  const trimmedDescription = input.description.trim();
  const result = await bridge.service.createFolder(context, {
    name: input.name.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    parentFolderId: null,
  });

  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success", folder: result.value };
}

// Deterministic visible-list update after a successful create (card scope
// item 8: "deterministically refresh or update the visible root-folder
// result"). Appends the newly created folder to whatever is currently
// visible (an `empty`/`ready` state both become `ready` with the new folder
// present) without an extra round trip to `listRootFolders`.
export function archiveUiApplyCreatedRootFolder(
  viewState: ArchiveUiViewState<ArchiveFolder[]>,
  folder: ArchiveFolder,
): ArchiveUiViewState<ArchiveFolder[]> {
  const existing = viewState.status === "ready" ? viewState.data : [];
  return archiveUiViewStateReady([...existing, folder]);
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects — no
// global stylesheet/CSS-module/CSS-framework pipeline; card scope item 10).
// The folder grid uses `repeat(auto-fit, minmax(...))` so the Archive-owned
// content area stays usable at both narrow and wide widths without a new
// responsive build pipeline (A-UI-RESP-001).
// ---------------------------------------------------------------------------

const ARCHIVE_ROOT_SCREEN_CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_ROOT_SCREEN_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_ROOT_SCREEN_FORM_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  alignItems: "flex-end",
  padding: "var(--space-4)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
};

const ARCHIVE_ROOT_SCREEN_FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const ARCHIVE_ROOT_SCREEN_INPUT_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2)",
  fontSize: "var(--text-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_ROOT_SCREEN_BUTTON_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ARCHIVE_ROOT_SCREEN_ERROR_TEXT_STYLE: CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--text-small)",
  margin: 0,
};

// A-UI-RESP-001: `auto-fit`/`minmax` gives narrow single-column and wide
// multi-column layout from ONE style object — no separate breakpoint build.
const ARCHIVE_ROOT_SCREEN_GRID_STYLE: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
};

const ARCHIVE_ROOT_SCREEN_CARD_BUTTON_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  width: "100%",
  textAlign: "left",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-panel)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  padding: "var(--space-4)",
  cursor: "pointer",
};

const ARCHIVE_ROOT_SCREEN_CARD_DESCRIPTION_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

const ARCHIVE_ROOT_SCREEN_FORM_ID = "archive-root-screen-create-folder";
const ARCHIVE_ROOT_SCREEN_HEADING_ID = "archive-root-screen-heading";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly). This is the exact
// function `ArchiveRootScreen.render()` below calls — not a parallel/
// duplicated presentation.
// ---------------------------------------------------------------------------

interface ArchiveRootScreenRenderState {
  readonly viewState: ArchiveUiViewState<ArchiveFolder[]>;
  readonly createCapability: ArchiveUiCapabilityActionDescriptor;
  readonly nameField: string;
  readonly descriptionField: string;
  readonly fieldErrors: ArchiveUiFieldErrorMap;
  readonly submitting: boolean;
  readonly feedback: ArchiveUiFeedbackState;
}

interface ArchiveRootScreenRenderHandlers {
  readonly onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDescriptionChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDismissFeedback: () => void;
  readonly onFolderSelect: (folderId: string) => void;
}

function renderArchiveRootScreen(
  state: ArchiveRootScreenRenderState,
  handlers: ArchiveRootScreenRenderHandlers,
): ReactElement {
  const nameAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_ROOT_SCREEN_FORM_ID,
    "name",
    state.fieldErrors,
  );
  const descriptionFieldId = `${ARCHIVE_ROOT_SCREEN_FORM_ID}-description`;

  // Empty state stays useful (card scope item 9): the create form's
  // visibility depends only on the `create` capability and a successfully
  // loaded root read (`ready`/`empty`), never on whether the list happens to
  // be empty.
  const rootLoaded =
    state.viewState.status === "ready" || state.viewState.status === "empty";
  const showCreateForm = rootLoaded && !state.createCapability.hidden;
  const createDisabled =
    !state.createCapability.allowed || state.submitting;

  return (
    <section
      data-archive-ui-screen="root"
      aria-labelledby={ARCHIVE_ROOT_SCREEN_HEADING_ID}
      style={ARCHIVE_ROOT_SCREEN_CONTAINER_STYLE}
    >
      <h1 id={ARCHIVE_ROOT_SCREEN_HEADING_ID} style={ARCHIVE_ROOT_SCREEN_HEADING_STYLE}>
        Archive
      </h1>
      <ArchiveUiFeedbackBanner
        state={state.feedback}
        dismissLabel="Dismiss"
        onDismiss={handlers.onDismissFeedback}
      />
      {showCreateForm ? (
        <form
          aria-label="Create a root folder"
          onSubmit={handlers.onSubmit}
          style={ARCHIVE_ROOT_SCREEN_FORM_STYLE}
        >
          <div style={ARCHIVE_ROOT_SCREEN_FIELD_STYLE}>
            <label id={nameAccessibility.labelId} htmlFor={nameAccessibility.fieldId}>
              Folder name
            </label>
            <input
              id={nameAccessibility.fieldId}
              type="text"
              value={state.nameField}
              aria-describedby={nameAccessibility.describedBy}
              aria-invalid={nameAccessibility.invalid}
              disabled={createDisabled}
              onChange={handlers.onNameChange}
              style={ARCHIVE_ROOT_SCREEN_INPUT_STYLE}
            />
            {archiveUiFieldHasError(state.fieldErrors, "name") ? (
              <p id={nameAccessibility.errorId} role="alert" style={ARCHIVE_ROOT_SCREEN_ERROR_TEXT_STYLE}>
                {archiveUiFieldMessages(state.fieldErrors, "name").join(" ")}
              </p>
            ) : null}
          </div>
          <div style={ARCHIVE_ROOT_SCREEN_FIELD_STYLE}>
            <label htmlFor={descriptionFieldId}>Description (optional)</label>
            <input
              id={descriptionFieldId}
              type="text"
              value={state.descriptionField}
              disabled={createDisabled}
              onChange={handlers.onDescriptionChange}
              style={ARCHIVE_ROOT_SCREEN_INPUT_STYLE}
            />
          </div>
          <button
            type="submit"
            disabled={createDisabled}
            style={ARCHIVE_ROOT_SCREEN_BUTTON_STYLE}
          >
            {state.submitting ? "Creating…" : "Create folder"}
          </button>
        </form>
      ) : null}
      <ArchiveUiStatePresentation
        state={state.viewState}
        loadingCopy={{ title: "Loading folders…" }}
        emptyCopy={{
          title: "No folders yet",
          description: "Create your first folder to get started.",
        }}
        renderReady={(folders) => (
          <ul
            role="list"
            aria-label="Root folders"
            style={ARCHIVE_ROOT_SCREEN_GRID_STYLE}
          >
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  data-archive-ui-folder-id={folder.id}
                  onClick={() => handlers.onFolderSelect(folder.id)}
                  style={ARCHIVE_ROOT_SCREEN_CARD_BUTTON_STYLE}
                >
                  <span>{folder.name}</span>
                  {folder.description !== null && folder.description !== "" ? (
                    <span style={ARCHIVE_ROOT_SCREEN_CARD_DESCRIPTION_STYLE}>
                      {folder.description}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// The public mountable screen.
// ---------------------------------------------------------------------------

export interface ArchiveRootScreenProps {
  readonly bridge: ArchiveUiBridge;
}

interface ArchiveRootScreenState {
  readonly context: ArchiveContextInput | null;
  readonly viewState: ArchiveUiViewState<ArchiveFolder[]>;
  readonly createCapability: ArchiveUiCapabilityActionDescriptor;
  readonly nameField: string;
  readonly descriptionField: string;
  readonly fieldErrors: ArchiveUiFieldErrorMap;
  readonly submitting: boolean;
  readonly feedback: ArchiveUiFeedbackState;
}

function archiveUiInitialRootScreenState(): ArchiveRootScreenState {
  return {
    context: null,
    viewState: archiveUiViewStateLoading(),
    createCapability: archiveUiRootScreenDeniedCreateCapability(),
    nameField: "",
    descriptionField: "",
    fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    submitting: false,
    feedback: archiveUiFeedbackIdle(),
  };
}

// The Archive module root/home screen (Correction Phase 6 TASK-04). A host
// mounts this with the real `ArchiveUiBridge` implementation; it owns its
// own root-load/create lifecycle end to end. See the file-top HOOK-CALL
// CONSTRAINT note for why this is a class component rather than a
// hooks-based function component.
export class ArchiveRootScreen extends React.Component<
  ArchiveRootScreenProps,
  ArchiveRootScreenState
> {
  constructor(props: ArchiveRootScreenProps) {
    super(props);
    this.state = archiveUiInitialRootScreenState();
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleDismissFeedback = this.handleDismissFeedback.bind(this);
    this.handleFolderSelect = this.handleFolderSelect.bind(this);
  }

  componentDidMount(): void {
    void this.loadRootScreen();
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method `componentDidMount` calls above — not a duplicate), so
  // the real mount-time bridge wiring is provable without a DOM renderer.
  async loadRootScreen(): Promise<void> {
    const result = await archiveUiLoadRootScreenData(this.props.bridge);
    this.setState({
      context: result.context,
      viewState: result.viewState,
      createCapability: result.createCapability,
    });
  }

  handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ nameField: event.target.value });
  }

  handleDescriptionChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ descriptionField: event.target.value });
  }

  handleFolderSelect(folderId: string): void {
    // Card scope item 6: navigation is EXCLUSIVELY the bridge intent — no
    // URL/path string, no `window.location`, no router import.
    this.props.bridge.navigate({ screen: "folder", folderId });
  }

  handleDismissFeedback(): void {
    this.setState((previous) => ({
      ...previous,
      feedback: archiveUiFeedbackDismiss(previous.feedback),
    }));
  }

  async handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const { context, nameField, descriptionField, createCapability, submitting } =
      this.state;
    if (context === null || !createCapability.allowed || submitting) return;

    this.setState({ submitting: true, fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP });

    const outcome = await archiveUiSubmitCreateRootFolder(this.props.bridge, context, {
      name: nameField,
      description: descriptionField,
    });

    if (outcome.kind === "validation") {
      this.setState({ submitting: false, fieldErrors: outcome.fieldErrors });
      return;
    }
    if (outcome.kind === "failure") {
      this.setState({
        submitting: false,
        feedback: archiveUiFeedbackShow({
          intent: "failure",
          title: outcome.presentation.title,
          description: outcome.presentation.description,
        }),
      });
      return;
    }
    this.setState((previous) => ({
      ...previous,
      submitting: false,
      nameField: "",
      descriptionField: "",
      fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
      viewState: archiveUiApplyCreatedRootFolder(previous.viewState, outcome.folder),
      feedback: archiveUiFeedbackShow({
        intent: "success",
        title: "Folder created",
        description: outcome.folder.name,
      }),
    }));
  }

  render(): ReactElement {
    return renderArchiveRootScreen(this.state, {
      onNameChange: this.handleNameChange,
      onDescriptionChange: this.handleDescriptionChange,
      onSubmit: this.handleSubmit,
      onDismissFeedback: this.handleDismissFeedback,
      onFolderSelect: this.handleFolderSelect,
    });
  }
}
