// Archive UI resource/permission history screen — Correction Phase 6 TASK-06
// Part B (§7 item 7). Renders `listResourceHistory`/`listPermissionHistory`
// for a folder OR item target (never namespace, never file history — the
// backend history projection remains folder/item-only by recorded decision)
// with real opaque forward-cursor pagination, honest identity placeholders
// under the still-open controller stop (§6), and a closed safe-summary
// allow-list renderer. Host-neutral: depends only on the TASK-02 bridge
// contract (`./bridge.js`), the TASK-03 shared primitives (`./view-state.js`,
// `./feedback.js`), and the public Archive root package surface
// (`@customprojects/custom-archive`) — no Shell/Next.js/router/window/
// document-global/Prisma/repository/service/internal-Archive import
// anywhere in this file.
//
// HOOK-CALL CONSTRAINT: identical reasoning to `root-screen.tsx`'s file-top
// comment — `ArchiveHistoryScreen` is a `React.Component` SUBCLASS, the same
// accepted no-renderer pattern TASK-04/05/06 already establish.
import * as React from "react";
import type { ReactElement } from "react";

import type { ArchiveUiBridge } from "./bridge";
import {
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state";
import type {
  ArchiveContextInput,
  ArchiveEventAction,
  ArchiveHistoryEntry,
  ArchiveHistoryPage,
  ArchiveHistoryQuery,
  ArchiveHistoryTargetType,
} from "@customprojects/custom-archive";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveHistoryScreen`'s methods call — not a
// duplicated stand-in.
// ---------------------------------------------------------------------------

export type ArchiveUiHistoryMode = "resource" | "permission";

// Card scope "Public component and target boundary": folder|item only, never
// namespace, never a file-history target.
export interface ArchiveHistoryScreenTarget {
  readonly targetType: ArchiveHistoryTargetType;
  readonly targetId: string;
}

export interface ArchiveUiHistoryModeState {
  readonly viewState: ArchiveUiViewState<ArchiveHistoryPage>;
  // Card scope "Real cursor behavior": the client-maintained stack of
  // previously requested opaque cursors, index 0 always the initial
  // `undefined` (first-page) cursor. `cursorStack[pageIndex]` is always the
  // exact cursor value already used to fetch the CURRENTLY visible page —
  // never decoded/synthesized/inferred, only ever a value this screen
  // previously received back from `nextCursor` (or the initial `undefined`).
  readonly cursorStack: readonly (string | undefined)[];
  readonly pageIndex: number;
}

export function archiveUiInitialHistoryModeState(): ArchiveUiHistoryModeState {
  return { viewState: archiveUiViewStateLoading(), cursorStack: [undefined], pageIndex: 0 };
}

// One page fetch for one mode (card scope "History modes and calls"): `limit`
// is NEVER passed (the one host-configured history policy stays
// authoritative); the first page OMITS the `cursor` key entirely (not
// `cursor: undefined`) — a real, distinguishable absence, never a
// fabricated value.
export async function archiveUiFetchHistoryPage(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  mode: ArchiveUiHistoryMode,
  target: ArchiveHistoryScreenTarget,
  cursor: string | undefined,
): Promise<ArchiveUiViewState<ArchiveHistoryPage>> {
  const query: ArchiveHistoryQuery =
    cursor === undefined
      ? { targetType: target.targetType, targetId: target.targetId }
      : { targetType: target.targetType, targetId: target.targetId, cursor };
  const method =
    mode === "resource" ? bridge.service.listResourceHistory : bridge.service.listPermissionHistory;
  const result = await method(context, query);
  // Deliberately NO `isEmpty` predicate here (unlike the item/folder
  // screens' outer load): an empty PAGE must still show working Back/Next
  // pagination controls (e.g. Back to a non-empty prior page), so
  // emptiness is handled INSIDE the `ready` render below as inline content
  // — never by discarding the page/pagination data via the outer `empty`
  // state.
  return archiveUiViewStateFromResult(result, bridge.translateError);
}

// Card scope "Real cursor behavior" — Next: truncates any forward history
// beyond the current page (so a Next after a Back never resurrects a stale
// forward branch) and appends the exact `nextCursor` the CURRENT page
// returned — never fabricated, never inspected/decoded.
export function archiveUiHistoryModeStateAfterNext(
  state: ArchiveUiHistoryModeState,
  nextCursor: string,
): ArchiveUiHistoryModeState {
  const truncated = state.cursorStack.slice(0, state.pageIndex + 1);
  return {
    viewState: archiveUiViewStateLoading(),
    cursorStack: [...truncated, nextCursor],
    pageIndex: state.pageIndex + 1,
  };
}

// Card scope "Real cursor behavior" — Back: reuses the EXACT previously
// requested cursor already recorded at the prior stack position; never
// synthesizes one.
export function archiveUiHistoryModeStateAfterBack(
  state: ArchiveUiHistoryModeState,
): ArchiveUiHistoryModeState {
  const pageIndex = Math.max(0, state.pageIndex - 1);
  return { viewState: archiveUiViewStateLoading(), cursorStack: state.cursorStack, pageIndex };
}

export function archiveUiHistoryNextEnabled(state: ArchiveUiHistoryModeState): boolean {
  return state.viewState.status === "ready" && state.viewState.data.nextCursor !== null;
}

export function archiveUiHistoryBackEnabled(state: ArchiveUiHistoryModeState): boolean {
  return state.pageIndex > 0;
}

// ---------------------------------------------------------------------------
// Identity presentation under the still-open controller stop (card scope
// "Identity presentation under the open controller stop"). No lookup, map,
// cache, API, or bridge field is invented — the current user's OWN display
// comes only from `bridge.getCurrentUserDisplay()`; every other actor id
// renders the honest, explicit, non-ID placeholder.
// ---------------------------------------------------------------------------

export function archiveUiHistoryActorDisplay(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  actorUserId: string,
): string {
  if (actorUserId !== context.userId) {
    return "Unresolved user";
  }
  const display = bridge.getCurrentUserDisplay();
  if (display?.displayName !== undefined && display.displayName.trim().length > 0) {
    return display.displayName;
  }
  if (display?.email !== undefined && display.email.trim().length > 0) {
    return display.email;
  }
  return "You";
}

// ---------------------------------------------------------------------------
// Safe-summary rendering (card scope "Safe-summary rendering"): an EXPLICIT
// allow-list only. Never `JSON.stringify(summary)`, never unfiltered
// `Object.entries`. Unknown keys, ids, storage identity, and non-scalar
// values are silently omitted — never rendered.
// ---------------------------------------------------------------------------

export interface ArchiveUiHistorySummaryField {
  readonly label: string;
  readonly value: string;
}

function archiveUiHistoryScalarText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null) return "Not set";
  return null;
}

const ARCHIVE_UI_HISTORY_SUMMARY_ALLOW_LIST: readonly { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "itemType", label: "Item type" },
  { key: "previousStatus", label: "Previous status" },
  { key: "newStatus", label: "New status" },
  { key: "previousDueAt", label: "Previous due" },
  { key: "newDueAt", label: "New due" },
  { key: "previousExpiresAt", label: "Previous expiry" },
  { key: "newExpiresAt", label: "New expiry" },
  { key: "permissionAction", label: "Permission action" },
  { key: "permissionEffect", label: "Permission effect" },
];

export function archiveUiSafeHistorySummaryFields(
  summary: Readonly<Record<string, unknown>>,
): ArchiveUiHistorySummaryField[] {
  const fields: ArchiveUiHistorySummaryField[] = [];

  for (const { key, label } of ARCHIVE_UI_HISTORY_SUMMARY_ALLOW_LIST) {
    if (!(key in summary)) continue;
    const text = archiveUiHistoryScalarText(summary[key]);
    if (text !== null) fields.push({ label, value: text });
  }

  // `folderId`/`parentFolderId`/`targetId`/`fileId`/`archiveItemId`/
  // `permissionId`/`subjectId`/actor ids/storage keys are deliberately never
  // read here — the subject placeholders below name only `subjectType`, and
  // the raw `subjectId` value itself is never rendered, only its PRESENCE is
  // checked to decide whether the placeholder applies.
  if (typeof summary.subjectType === "string" && "subjectId" in summary) {
    if (summary.subjectType === "user") {
      fields.push({ label: "Subject", value: "Unresolved user subject" });
    } else if (summary.subjectType === "role") {
      fields.push({ label: "Subject", value: "Unresolved role subject" });
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Closed human-readable event-label map (card scope "Safe-summary
// rendering": "a closed human-readable event-label map ... unknown event
// types get a calm generic label"). Total over the full `ArchiveEventAction`
// vocabulary at compile time (even though this screen's two queries only
// ever return the folder/item resource-history and permission-history action
// families) so no future caller can fall through to a raw payload dump.
// ---------------------------------------------------------------------------

const ARCHIVE_UI_HISTORY_EVENT_LABELS: Readonly<Record<ArchiveEventAction, string>> = {
  "archive.folder.created": "Folder created",
  "archive.folder.deleted": "Folder deleted",
  "archive.folder.restored": "Folder restored",
  "archive.folder.status_changed": "Folder status changed",
  "archive.folder.dates_changed": "Folder dates changed",
  "archive.item.created": "Item created",
  "archive.item.deleted": "Item deleted",
  "archive.item.restored": "Item restored",
  "archive.item.status_changed": "Item status changed",
  "archive.item.dates_changed": "Item dates changed",
  "archive.permission.granted": "Permission granted",
  "archive.permission.revoked": "Permission revoked",
  "archive.permission.denied": "Permission denied",
  // Present in the vocabulary but never returned by this screen's two safe
  // queries (folder/item resource history + permission history only) — kept
  // here only so the map is total over the closed action union.
  "archive.file.created": "Archive event",
  "archive.file.uploaded": "Archive event",
  "archive.file.deleted": "Archive event",
  "archive.file.restored": "Archive event",
  "archive.file.purged": "Archive event",
  "archive.role.created": "Archive event",
  "archive.role.renamed": "Archive event",
  "archive.role.deleted": "Archive event",
  "archive.role_assignment.added": "Archive event",
  "archive.role_assignment.removed": "Archive event",
  "archive.namespace.bootstrap_completed": "Archive event",
  "archive.namespace.manager_recovered": "Archive event",
};

export function archiveUiHistoryEventLabel(eventType: ArchiveEventAction): string {
  return ARCHIVE_UI_HISTORY_EVENT_LABELS[eventType] ?? "Archive event";
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects).
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const MODE_CONTROL_STYLE: React.CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
};

const MODE_CONTROL_SELECTED_STYLE: React.CSSProperties = {
  ...MODE_CONTROL_STYLE,
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  borderColor: "var(--color-accent)",
};

const ENTRY_LIST_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
  listStyle: "none",
};

const ENTRY_CARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-panel)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  padding: "var(--space-4)",
};

const MUTED_TEXT_STYLE: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

const PAGINATION_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-4)",
};

const BUTTON_STYLE: React.CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const LINK_BUTTON_STYLE: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-accent)",
  cursor: "pointer",
  padding: 0,
  fontSize: "var(--text-body)",
};

const HEADING_ID = "archive-history-screen-heading";
const MODE_GROUP_LABEL_ID = "archive-history-screen-mode-label";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly) — the exact function
// `ArchiveHistoryScreen.render()` calls.
// ---------------------------------------------------------------------------

function renderArchiveHistoryEntry(
  entry: ArchiveHistoryEntry,
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
): ReactElement {
  const actor = archiveUiHistoryActorDisplay(bridge, context, entry.actorUserId);
  const label = archiveUiHistoryEventLabel(entry.eventType);
  const fields = archiveUiSafeHistorySummaryFields(entry.summary);
  return (
    <li key={entry.eventId} data-archive-ui-history-entry="true" style={ENTRY_CARD_STYLE}>
      <p>{label}</p>
      <p style={MUTED_TEXT_STYLE}>
        <time dateTime={entry.occurredAt.toISOString()}>{entry.occurredAt.toISOString()}</time>
      </p>
      <p style={MUTED_TEXT_STYLE}>{actor}</p>
      {fields.length > 0 ? (
        <dl>
          {fields.map((field, index) => (
            <React.Fragment key={`${field.label}-${index}`}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

interface ArchiveHistoryScreenRenderHandlers {
  readonly onBackNavigate: () => void;
  readonly onSelectResourceMode: () => void;
  readonly onSelectPermissionMode: () => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

function renderArchiveHistoryScreen(
  context: ArchiveContextInput | null,
  bridge: ArchiveUiBridge,
  mode: ArchiveUiHistoryMode,
  modeState: ArchiveUiHistoryModeState,
  handlers: ArchiveHistoryScreenRenderHandlers,
): ReactElement {
  const nextEnabled = context !== null && archiveUiHistoryNextEnabled(modeState);
  const backEnabled = archiveUiHistoryBackEnabled(modeState);

  return (
    <section
      data-archive-ui-screen="history"
      aria-labelledby={HEADING_ID}
      style={CONTAINER_STYLE}
    >
      <h1 id={HEADING_ID} style={HEADING_STYLE}>
        History
      </h1>
      <button type="button" onClick={handlers.onBackNavigate} style={LINK_BUTTON_STYLE}>
        Back
      </button>
      <div role="group" aria-labelledby={MODE_GROUP_LABEL_ID} style={{ display: "flex", gap: "var(--space-3)" }}>
        <span id={MODE_GROUP_LABEL_ID} style={{ display: "none" }}>
          History mode
        </span>
        <button
          type="button"
          aria-pressed={mode === "resource"}
          data-archive-ui-history-mode="resource"
          onClick={handlers.onSelectResourceMode}
          style={mode === "resource" ? MODE_CONTROL_SELECTED_STYLE : MODE_CONTROL_STYLE}
        >
          Resource history
        </button>
        <button
          type="button"
          aria-pressed={mode === "permission"}
          data-archive-ui-history-mode="permission"
          onClick={handlers.onSelectPermissionMode}
          style={mode === "permission" ? MODE_CONTROL_SELECTED_STYLE : MODE_CONTROL_STYLE}
        >
          Permission history
        </button>
      </div>
      <ArchiveUiStatePresentation
        state={modeState.viewState}
        loadingCopy={{ title: "Loading history…" }}
        emptyCopy={{ title: "No history yet." }}
        renderReady={(page) => (
          <>
            {page.entries.length === 0 ? (
              <p data-archive-ui-history-empty="true" style={MUTED_TEXT_STYLE}>
                No history entries on this page.
              </p>
            ) : (
              <ol role="list" aria-label="History entries" style={ENTRY_LIST_STYLE}>
                {context !== null
                  ? page.entries.map((entry) => renderArchiveHistoryEntry(entry, bridge, context))
                  : null}
              </ol>
            )}
            <div style={PAGINATION_STYLE}>
              <button
                type="button"
                disabled={!backEnabled}
                onClick={handlers.onBack}
                style={BUTTON_STYLE}
              >
                Back page
              </button>
              <button
                type="button"
                disabled={!nextEnabled}
                onClick={handlers.onNext}
                style={BUTTON_STYLE}
              >
                Next page
              </button>
            </div>
          </>
        )}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// The public mountable screen.
// ---------------------------------------------------------------------------

export interface ArchiveHistoryScreenProps {
  readonly bridge: ArchiveUiBridge;
  readonly target: ArchiveHistoryScreenTarget;
}

interface ArchiveHistoryScreenState {
  readonly context: ArchiveContextInput | null;
  readonly mode: ArchiveUiHistoryMode;
  readonly resource: ArchiveUiHistoryModeState;
  readonly permission: ArchiveUiHistoryModeState;
  // Monotonically increasing per-fetch token (card scope "Real cursor
  // behavior": "stale responses from an earlier request/mode must not
  // overwrite the current mode/page"). Every fetch captures the token at
  // issue time; a response only applies if the token is STILL the latest
  // when it resolves.
  readonly requestSeq: number;
}

function archiveUiInitialHistoryScreenState(): ArchiveHistoryScreenState {
  return {
    context: null,
    mode: "resource",
    resource: archiveUiInitialHistoryModeState(),
    permission: archiveUiInitialHistoryModeState(),
    requestSeq: 0,
  };
}

// The Archive module resource/permission history screen (Correction Phase 6
// TASK-06 Part B). A host mounts this with the real `ArchiveUiBridge`
// implementation and a folder/item `target`; it owns its own dual-mode
// cursor-paginated load lifecycle end to end.
export class ArchiveHistoryScreen extends React.Component<
  ArchiveHistoryScreenProps,
  ArchiveHistoryScreenState
> {
  constructor(props: ArchiveHistoryScreenProps) {
    super(props);
    this.state = archiveUiInitialHistoryScreenState();
    this.handleBackNavigate = this.handleBackNavigate.bind(this);
    this.handleSelectResourceMode = this.handleSelectResourceMode.bind(this);
    this.handleSelectPermissionMode = this.handleSelectPermissionMode.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleBack = this.handleBack.bind(this);
  }

  componentDidMount(): void {
    // Card scope "History modes and calls": resource history loads
    // initially; permission history loads lazily only when selected.
    void this.runHistoryFetch("resource", archiveUiInitialHistoryModeState());
  }

  private getModeState(mode: ArchiveUiHistoryMode): ArchiveUiHistoryModeState {
    return mode === "resource" ? this.state.resource : this.state.permission;
  }

  private setModeState(mode: ArchiveUiHistoryMode, modeState: ArchiveUiHistoryModeState): void {
    if (mode === "resource") {
      this.setState({ resource: modeState });
      return;
    }
    this.setState({ permission: modeState });
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method mount/mode-select/pagination handlers below call), so
  // the real wiring is provable without a DOM renderer.
  async runHistoryFetch(mode: ArchiveUiHistoryMode, nextModeState: ArchiveUiHistoryModeState): Promise<void> {
    const context = this.props.bridge.getContext();
    const seq = this.state.requestSeq + 1;
    this.setState({ context, requestSeq: seq });
    this.setModeState(mode, nextModeState);

    const cursor = nextModeState.cursorStack[nextModeState.pageIndex];
    const viewState = await archiveUiFetchHistoryPage(
      this.props.bridge,
      context,
      mode,
      this.props.target,
      cursor,
    );

    // Stale-response guard: a NEWER fetch (another mode switch or another
    // page navigation) may have started and completed while this one was in
    // flight — only apply this result if it is still the latest issued.
    if (this.state.requestSeq !== seq) return;
    this.setModeState(mode, { ...nextModeState, viewState });
  }

  handleBackNavigate(): void {
    if (this.props.target.targetType === "folder") {
      this.props.bridge.navigate({ screen: "folder", folderId: this.props.target.targetId });
      return;
    }
    this.props.bridge.navigate({ screen: "item", itemId: this.props.target.targetId });
  }

  handleSelectResourceMode(): void {
    if (this.state.mode === "resource") return;
    this.setState({ mode: "resource" });
    void this.runHistoryFetch("resource", archiveUiInitialHistoryModeState());
  }

  handleSelectPermissionMode(): void {
    if (this.state.mode === "permission") return;
    this.setState({ mode: "permission" });
    void this.runHistoryFetch("permission", archiveUiInitialHistoryModeState());
  }

  handleNext(): void {
    const mode = this.state.mode;
    const modeState = this.getModeState(mode);
    if (!archiveUiHistoryNextEnabled(modeState)) return;
    if (modeState.viewState.status !== "ready") return;
    const { nextCursor } = modeState.viewState.data;
    if (nextCursor === null) return;
    void this.runHistoryFetch(mode, archiveUiHistoryModeStateAfterNext(modeState, nextCursor));
  }

  handleBack(): void {
    const mode = this.state.mode;
    const modeState = this.getModeState(mode);
    if (!archiveUiHistoryBackEnabled(modeState)) return;
    void this.runHistoryFetch(mode, archiveUiHistoryModeStateAfterBack(modeState));
  }

  render(): ReactElement {
    return renderArchiveHistoryScreen(
      this.state.context,
      this.props.bridge,
      this.state.mode,
      this.getModeState(this.state.mode),
      {
        onBackNavigate: this.handleBackNavigate,
        onSelectResourceMode: this.handleSelectResourceMode,
        onSelectPermissionMode: this.handleSelectPermissionMode,
        onNext: this.handleNext,
        onBack: this.handleBack,
      },
    );
  }
}
