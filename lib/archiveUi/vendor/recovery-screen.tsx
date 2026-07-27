// Archive UI deleted-content recovery screen — Correction Phase 6 TASK-09
// (§7 recovery, A-UI-STATE-001). Exposes the already-public
// `listRecoverableContent`/`restoreFolder`/`restoreItem` UI service-port
// methods as one mountable screen that lists exactly the deleted folders and
// items the permission-safe recovery projection already returned and
// restores them one at a time — never a second authorization model, never a
// global deleted-file listing, never `restoreFile`. Host-neutral: depends
// only on the TASK-02 bridge contract (`./bridge.js`), the TASK-03 shared
// primitives (`./view-state.js`, `./feedback.js`), and the public Archive
// root package surface (`@customprojects/custom-archive`) — no
// Shell/Next.js/router/window/document-global/Prisma/repository/service/
// internal-Archive import anywhere in this file. Resource/permission history
// remains TASK-06's; deleted-FILE discovery/restoration remains the accepted
// item-screen (TASK-06/TASK-06A) behavior — this screen never calls
// `listRecoverableFilesForItem`/`restoreFile`.
//
// HOOK-CALL CONSTRAINT: identical reasoning to `search-screen.tsx`'s file-top
// comment — this repository's test toolchain has no `react-dom`/renderer, and
// React's hook dispatcher is `null` outside an active render performed by a
// real renderer, so `ArchiveRecoveryScreen` is a `React.Component` SUBCLASS —
// the same accepted no-renderer pattern TASK-04–08 already establish, not a
// parallel/competing rendering system.
//
// A real (not type-only) value import of `React` is required (see
// `view-state.tsx`'s matching file-top comment): this repository's
// vitest/esbuild test transform falls back to the CLASSIC JSX transform at
// test-execution time, emitting bare `React.createElement(...)` calls that
// expect `React` to be an in-scope value, even though `tsconfig.ui.json`'s
// `jsx: "react-jsx"` setting is what TypeScript itself uses for
// type-checking.
import * as React from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ArchiveUiBridge, ArchiveUiErrorPresentation } from "./bridge";
import {
  archiveUiViewStateEmpty,
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state";
import {
  archiveUiFeedbackDismiss,
  archiveUiFeedbackIdle,
  archiveUiFeedbackShow,
  ArchiveUiFeedbackBanner,
  type ArchiveUiFeedbackState,
} from "./feedback";
import type {
  ArchiveContextInput,
  ArchiveRecoverableFolder,
  ArchiveRecoverableItem,
  ArchiveRecoveryListing,
} from "@customprojects/custom-archive";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveRecoveryScreen`'s methods call — not a
// duplicated stand-in.
// ---------------------------------------------------------------------------

// Card scope "Frozen target": the closed two-value resource-type
// discriminant deciding which backend method a captured target routes to.
export type ArchiveUiRecoveryResourceType = "folder" | "item";

// Card scope "Frozen target": the exact immutable shape captured at click
// time — `loadGeneration` is the exact generation active when the caller
// clicked, so a later reload can be detected and a stale completion can be
// discarded without ever redirecting THIS call's backend target. Kept
// internal (not part of the public "./ui" surface) per the card's "Keep
// internal: ... target-key/capture helpers" instruction.
interface ArchiveUiRecoveryTarget {
  readonly resourceType: ArchiveUiRecoveryResourceType;
  readonly id: string;
  readonly name: string;
  readonly loadGeneration: number;
}

// Card scope "Pending and overlap semantics": "The pending key includes
// resource type and id so a folder and item sharing an id remain
// independent." A plain string key over a `Set` is sufficient — no shared
// counter, no cross-target cancellation.
function archiveUiRecoveryTargetKey(
  resourceType: ArchiveUiRecoveryResourceType,
  id: string,
): string {
  return `${resourceType}:${id}`;
}

// Card scope "Required initial-load behavior" 1–8: exactly one
// `listRecoverableContent` call for the one supplied context, translated
// through the shared TASK-03 view-state primitive so `unauthorized` maps to
// denied and every other failure maps to calm translated error copy — never
// a raw backend message. Both arrays empty is the explicit empty state;
// otherwise ready, preserving the backend's own folder/item ordering
// untouched (no client sort/merge is ever applied here or in the reducer
// helpers below).
export async function archiveUiLoadRecoveryListing(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
): Promise<ArchiveUiViewState<ArchiveRecoveryListing>> {
  const result = await bridge.service.listRecoverableContent(context);
  return archiveUiViewStateFromResult(
    result,
    bridge.translateError,
    (listing) => listing.folders.length === 0 && listing.items.length === 0,
  );
}

// Card scope "Exact calls": folder targets call ONLY `restoreFolder`, item
// targets call ONLY `restoreItem` — never both for one row, never
// `restoreFile`. No value from the returned domain object (`ArchiveFolder`/
// `ArchiveItem`) is surfaced here: the card forbids exposing active
// folder/item business fields absent from the minimal recovery projection,
// and the caller already has the exact human name/type it needs from the
// frozen target captured at click time — a bare success signal is
// sufficient and keeps this outcome type free of any leak surface.
export type ArchiveUiRecoveryRestoreOutcome =
  | { readonly kind: "failure"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly kind: "success" };

export async function archiveUiSubmitRecoveryRestore(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  target: Pick<ArchiveUiRecoveryTarget, "resourceType" | "id">,
): Promise<ArchiveUiRecoveryRestoreOutcome> {
  const result =
    target.resourceType === "folder"
      ? await bridge.service.restoreFolder(context, target.id)
      : await bridge.service.restoreItem(context, target.id);
  if (!result.ok) {
    return { kind: "failure", presentation: bridge.translateError(result.error) };
  }
  return { kind: "success" };
}

// Card scope "Success": removes exactly the restored folder or item from
// its OWN corresponding array, preserving the other array and every
// remaining row's backend order untouched (a plain `Array.prototype.filter`
// is stable and order-preserving by construction) — never a stale captured
// list snapshot, always applied against whatever listing the caller passes
// in (the component always passes the CURRENT `previous` state's listing,
// never a closed-over one — see `runRestore` below).
export function archiveUiRemoveRestoredRecoveryTarget(
  listing: ArchiveRecoveryListing,
  target: Pick<ArchiveUiRecoveryTarget, "resourceType" | "id">,
): ArchiveRecoveryListing {
  if (target.resourceType === "folder") {
    return {
      folders: listing.folders.filter((folder) => folder.id !== target.id),
      items: listing.items,
    };
  }
  return {
    folders: listing.folders,
    items: listing.items.filter((item) => item.id !== target.id),
  };
}

function archiveUiRecoveryListingIsEmpty(listing: ArchiveRecoveryListing): boolean {
  return listing.folders.length === 0 && listing.items.length === 0;
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects — no
// global stylesheet/CSS-module/CSS-framework pipeline; A-UI-RESP-001).
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const SECTION_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-heading)",
  color: "var(--color-text)",
  margin: 0,
};

const PANEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
};

const BUTTON_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const MUTED_TEXT_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

// A-UI-RESP-001: `auto-fit`/`minmax` gives narrow single-column and wide
// multi-column layout from ONE style object — no separate breakpoint build,
// the same accepted TASK-04–08 responsive pattern.
const GRID_STYLE: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
};

const CARD_STYLE: CSSProperties = {
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

const HEADING_ID = "archive-recovery-screen-heading";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly) — the exact functions
// `ArchiveRecoveryScreen.render()` calls.
// ---------------------------------------------------------------------------

interface ArchiveRecoveryScreenRenderHandlers {
  readonly onDismissFeedback: () => void;
  readonly onRestoreFolder: (id: string, name: string) => void;
  readonly onRestoreItem: (id: string, name: string) => void;
}

interface ArchiveRecoveryScreenRenderState {
  readonly viewState: ArchiveUiViewState<ArchiveRecoveryListing>;
  readonly feedback: ArchiveUiFeedbackState;
  readonly pendingKeys: ReadonlySet<string>;
}

// Card scope "Recovery rows and presentation": each row displays ONLY the
// human resource type, the resource `name`, and a stable human-readable
// `deletedAt` presentation — `folder.id`/`folder.parentFolderId` are used
// only for the React `key`, the `data-*` test hook, and the typed restore
// call, NEVER as visible or accessible copy. The restore button's accessible
// name identifies the human resource name and type, never the id.
function renderArchiveRecoveryFolderRow(
  folder: ArchiveRecoverableFolder,
  pending: boolean,
  onRestore: (id: string, name: string) => void,
): ReactElement {
  const deletedAtIso = folder.deletedAt.toISOString();
  return (
    <li key={folder.id} data-archive-ui-recovery-folder-id={folder.id} style={CARD_STYLE}>
      <span>Folder</span>
      <span>{folder.name}</span>
      <span style={MUTED_TEXT_STYLE}>
        Deleted <time dateTime={deletedAtIso}>{deletedAtIso}</time>
      </span>
      <button
        type="button"
        data-archive-ui-restore-folder={folder.id}
        aria-label={`Restore folder "${folder.name}"`}
        disabled={pending}
        onClick={() => onRestore(folder.id, folder.name)}
        style={BUTTON_STYLE}
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}

function renderArchiveRecoveryItemRow(
  item: ArchiveRecoverableItem,
  pending: boolean,
  onRestore: (id: string, name: string) => void,
): ReactElement {
  const deletedAtIso = item.deletedAt.toISOString();
  return (
    <li key={item.id} data-archive-ui-recovery-item-id={item.id} style={CARD_STYLE}>
      <span>Item</span>
      <span>{item.name}</span>
      <span style={MUTED_TEXT_STYLE}>
        Deleted <time dateTime={deletedAtIso}>{deletedAtIso}</time>
      </span>
      <button
        type="button"
        data-archive-ui-restore-item={item.id}
        aria-label={`Restore item "${item.name}"`}
        disabled={pending}
        onClick={() => onRestore(item.id, item.name)}
        style={BUTTON_STYLE}
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}

// Card scope "Responsive and accessibility requirements": separately
// labeled folder and item lists, each with its own explicit empty message
// when that ONE array is empty while the overall listing is ready (the
// "folders-only"/"items-only" ready states) — the outer `empty` view state
// only ever fires when BOTH arrays are empty.
function renderArchiveRecoveryFoldersSection(
  folders: readonly ArchiveRecoverableFolder[],
  pendingKeys: ReadonlySet<string>,
  onRestore: (id: string, name: string) => void,
): ReactElement {
  return (
    <div style={PANEL_STYLE}>
      <h2 style={SECTION_HEADING_STYLE}>Deleted folders</h2>
      {folders.length === 0 ? (
        <p data-archive-ui-recovery-folders-empty="true" style={MUTED_TEXT_STYLE}>
          No deleted folders to restore.
        </p>
      ) : (
        <ul role="list" aria-label="Deleted folders" style={GRID_STYLE}>
          {folders.map((folder) =>
            renderArchiveRecoveryFolderRow(
              folder,
              pendingKeys.has(archiveUiRecoveryTargetKey("folder", folder.id)),
              onRestore,
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function renderArchiveRecoveryItemsSection(
  items: readonly ArchiveRecoverableItem[],
  pendingKeys: ReadonlySet<string>,
  onRestore: (id: string, name: string) => void,
): ReactElement {
  return (
    <div style={PANEL_STYLE}>
      <h2 style={SECTION_HEADING_STYLE}>Deleted items</h2>
      {items.length === 0 ? (
        <p data-archive-ui-recovery-items-empty="true" style={MUTED_TEXT_STYLE}>
          No deleted items to restore.
        </p>
      ) : (
        <ul role="list" aria-label="Deleted items" style={GRID_STYLE}>
          {items.map((item) =>
            renderArchiveRecoveryItemRow(
              item,
              pendingKeys.has(archiveUiRecoveryTargetKey("item", item.id)),
              onRestore,
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function renderArchiveRecoveryScreen(
  state: ArchiveRecoveryScreenRenderState,
  handlers: ArchiveRecoveryScreenRenderHandlers,
): ReactElement {
  return (
    <section
      data-archive-ui-screen="recovery"
      aria-labelledby={HEADING_ID}
      style={CONTAINER_STYLE}
    >
      <h1 id={HEADING_ID} style={HEADING_STYLE}>
        Recovery
      </h1>
      <ArchiveUiFeedbackBanner
        state={state.feedback}
        dismissLabel="Dismiss"
        onDismiss={handlers.onDismissFeedback}
      />
      <ArchiveUiStatePresentation
        state={state.viewState}
        loadingCopy={{ title: "Loading deleted content…" }}
        emptyCopy={{ title: "No deleted content is available to restore." }}
        renderReady={(listing) => (
          <>
            {renderArchiveRecoveryFoldersSection(listing.folders, state.pendingKeys, handlers.onRestoreFolder)}
            {renderArchiveRecoveryItemsSection(listing.items, state.pendingKeys, handlers.onRestoreItem)}
          </>
        )}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// The public mountable screen.
// ---------------------------------------------------------------------------

export interface ArchiveRecoveryScreenProps {
  readonly bridge: ArchiveUiBridge;
}

interface ArchiveRecoveryScreenState {
  readonly context: ArchiveContextInput | null;
  readonly viewState: ArchiveUiViewState<ArchiveRecoveryListing>;
  readonly feedback: ArchiveUiFeedbackState;
  // Card scope "Pending and overlap semantics": typed target keys
  // (`archiveUiRecoveryTargetKey`) currently restoring — a folder and an
  // item sharing the same backend id occupy independent keys, and different
  // targets may be pending concurrently.
  readonly pendingKeys: ReadonlySet<string>;
}

function archiveUiInitialRecoveryScreenState(): ArchiveRecoveryScreenState {
  return {
    context: null,
    viewState: archiveUiViewStateLoading(),
    feedback: archiveUiFeedbackIdle(),
    pendingKeys: new Set(),
  };
}

// The Archive module deleted-content recovery screen (Correction Phase 6
// TASK-09). A host mounts this with the real `ArchiveUiBridge`
// implementation; it owns its own load/restore lifecycle end to end. See the
// file-top HOOK-CALL CONSTRAINT note for why this is a class component.
export class ArchiveRecoveryScreen extends React.Component<
  ArchiveRecoveryScreenProps,
  ArchiveRecoveryScreenState
> {
  // Card scope "Async consistency and adversarial safety": a PRIVATE
  // monotonic instance-field load generation (the exact TASK-07/TASK-08
  // pattern — deliberately NOT derived from `this.state`, which is unsafe
  // under batched `setState`) so an older load can never overwrite a newer
  // one, and a restore captured under an older generation can be detected
  // and discarded on completion (card requirement 10/15).
  private loadGeneration = 0;
  // Card scope "On unmount/disposal, late load or mutation completions must
  // not set state or feedback": the exact TASK-06 `downloadLifecycleDisposed`
  // pattern, narrow to this screen's own load/restore completions.
  private disposed = false;

  constructor(props: ArchiveRecoveryScreenProps) {
    super(props);
    this.state = archiveUiInitialRecoveryScreenState();
    this.handleRestoreFolder = this.handleRestoreFolder.bind(this);
    this.handleRestoreItem = this.handleRestoreItem.bind(this);
    this.handleDismissFeedback = this.handleDismissFeedback.bind(this);
  }

  componentDidMount(): void {
    void this.runInitialLoad();
  }

  componentWillUnmount(): void {
    this.disposed = true;
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method `componentDidMount` calls above), so the real mount-time
  // wiring is provable without a DOM renderer. Card scope requirement 1: one
  // `bridge.getContext()` call per load generation, exactly one
  // `listRecoverableContent` call, no identity/transport/history/
  // file-discovery/normal-read/mutation call.
  async runInitialLoad(): Promise<void> {
    const context = this.props.bridge.getContext();
    const seq = ++this.loadGeneration;
    // Card scope requirement 9/10: a fresh load resets pending state too —
    // any restore captured under an older generation loses its visible
    // pending row here, before its own completion is even reached, and its
    // eventual completion is separately blocked by the generation check in
    // `runRestore` below.
    this.setState({
      context,
      viewState: archiveUiViewStateLoading(),
      feedback: archiveUiFeedbackIdle(),
      pendingKeys: new Set(),
    });

    const viewState = await archiveUiLoadRecoveryListing(this.props.bridge, context);

    // Card scope requirement 11: disposal blocks late state/feedback.
    if (this.disposed) return;
    // Card scope requirement 9: a newer load may have already started and
    // completed (or simply started) while this one was in flight — only the
    // still-current generation may apply.
    if (seq !== this.loadGeneration) return;
    this.setState({ viewState });
  }

  handleRestoreFolder(id: string, name: string): void {
    void this.runRestore("folder", id, name);
  }

  handleRestoreItem(id: string, name: string): void {
    void this.runRestore("item", id, name);
  }

  // Not marked `private`: intentionally callable directly by focused tests,
  // the same method the two thin public handlers above call.
  async runRestore(
    resourceType: ArchiveUiRecoveryResourceType,
    id: string,
    name: string,
  ): Promise<void> {
    const { context } = this.state;
    if (context === null) return;
    if (this.state.viewState.status !== "ready") return;

    // Card scope "Frozen target": captured HERE, synchronously, before any
    // `await` — later list replacement, another restore, or a newer load can
    // never redirect this call's backend target or its own completion
    // handling below.
    const target: ArchiveUiRecoveryTarget = {
      resourceType,
      id,
      name,
      loadGeneration: this.loadGeneration,
    };
    const key = archiveUiRecoveryTargetKey(resourceType, id);

    // Card scope "Block duplicate submission for the exact same typed target
    // while pending."
    if (this.state.pendingKeys.has(key)) return;

    this.setState((previous) => ({
      ...previous,
      pendingKeys: new Set(previous.pendingKeys).add(key),
    }));

    const outcome = await archiveUiSubmitRecoveryRestore(this.props.bridge, context, target);

    // Card scope requirement 11 / "A late success or failure captured under
    // an older load generation, older context, or disposed component must
    // perform no list mutation and show no feedback in the newer state." —
    // checked BEFORE either branch below, so neither success nor failure can
    // ever apply once stale/disposed. No pending-key cleanup is needed here
    // either: a newer load already reset `pendingKeys` to empty in
    // `runInitialLoad`.
    if (this.disposed) return;
    if (target.loadGeneration !== this.loadGeneration) return;

    if (outcome.kind === "failure") {
      this.setState((previous) => {
        const pendingKeys = new Set(previous.pendingKeys);
        pendingKeys.delete(key);
        return {
          ...previous,
          pendingKeys,
          feedback: archiveUiFeedbackShow({
            intent: "failure",
            title: outcome.presentation.title,
            description: outcome.presentation.description,
          }),
        };
      });
      return;
    }

    const typeLabel = resourceType === "folder" ? "Folder" : "Item";
    // Card scope "Success"/"Pending and overlap semantics": a functional
    // `setState` reading `previous` (never a stale closed-over snapshot) so
    // two overlapping restores resolving out of order both apply their own
    // exact row removal without losing each other's update.
    this.setState((previous) => {
      const pendingKeys = new Set(previous.pendingKeys);
      pendingKeys.delete(key);
      if (previous.viewState.status !== "ready") {
        return { ...previous, pendingKeys };
      }
      const nextListing = archiveUiRemoveRestoredRecoveryTarget(previous.viewState.data, target);
      return {
        ...previous,
        pendingKeys,
        viewState: archiveUiRecoveryListingIsEmpty(nextListing)
          ? archiveUiViewStateEmpty()
          : archiveUiViewStateReady(nextListing),
        feedback: archiveUiFeedbackShow({
          intent: "success",
          title: `${typeLabel} restored`,
          description: name,
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
    return renderArchiveRecoveryScreen(this.state, {
      onDismissFeedback: this.handleDismissFeedback,
      onRestoreFolder: this.handleRestoreFolder,
      onRestoreItem: this.handleRestoreItem,
    });
  }
}
