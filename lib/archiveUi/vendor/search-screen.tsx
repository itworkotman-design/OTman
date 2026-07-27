// Archive UI folder/item search screen — Correction Phase 6 TASK-07 (§7 item
// 4, A-SEARCH-002, A-UI-SEARCH-001). Exposes the already-public
// `searchFolders`/`searchItems` UI service-port methods through one
// deliberately curated, product-language filter model (name-contains
// text, one of the four closed business statuses, one of five mutually
// exclusive condition choices) plus real opaque forward/backward keyset
// cursor navigation — never a raw dump of every backend search parameter,
// never a client-invented total/count, never a synthesized cursor.
// Host-neutral: depends only on the TASK-02 bridge contract (`./bridge.js`),
// the TASK-03 shared primitives (`./view-state.js`, `./validation.js`), and
// the public Archive root package surface
// (`@customprojects/custom-archive`) — no Shell/Next.js/router/window/
// document-global/Prisma/repository/service/internal-Archive import
// anywhere in this file.
//
// HOOK-CALL CONSTRAINT: identical reasoning to `root-screen.tsx`'s file-top
// comment — this repository's test toolchain has no `react-dom`/renderer,
// and React's hook dispatcher is `null` outside an active render performed
// by a real renderer, so `ArchiveSearchScreen` is a `React.Component`
// SUBCLASS — the same accepted no-renderer pattern TASK-04/05/06 already
// establish, not a parallel/competing rendering system.
//
// A real (not type-only) value import of `React` is required (see
// `view-state.tsx`'s matching file-top comment): this repository's
// vitest/esbuild test transform falls back to the CLASSIC JSX transform at
// test-execution time, emitting bare `React.createElement(...)` calls that
// expect `React` to be an in-scope value, even though `tsconfig.ui.json`'s
// `jsx: "react-jsx"` setting is what TypeScript itself uses for
// type-checking.
import * as React from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactElement } from "react";

import type { ArchiveUiBridge } from "./bridge";
import {
  archiveUiViewStateFromResult,
  archiveUiViewStateLoading,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state";
import {
  ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  type ArchiveUiFieldErrorEntry,
  type ArchiveUiFieldErrorMap,
} from "./validation";
import type {
  ArchiveBusinessStatus,
  ArchiveContextInput,
  ArchiveFolder,
  ArchiveFolderSearchQuery,
  ArchiveItem,
} from "@customprojects/custom-archive";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchiveSearchScreen`'s methods call — not a
// duplicated stand-in.
// ---------------------------------------------------------------------------

// Card scope "Search modes": exactly two, one backend method each.
export type ArchiveUiSearchMode = "folder" | "item";

// Card scope "Curated filters": the exact closed status set, reusing the
// public `ArchiveBusinessStatus` union — never a second/invented status
// vocabulary. `""` means "no status filter" (the field is optional).
export const ARCHIVE_UI_SEARCH_STATUSES: readonly ArchiveBusinessStatus[] = [
  "active",
  "inactive",
  "draft",
  "archived",
];
export type ArchiveUiSearchStatusOption = "" | ArchiveBusinessStatus;

// Card scope "Curated filters": the exact one-of-five condition selector.
// `""` means "no condition" (at most one true backend flag is ever set —
// never a contradictory combination such as `isDueSoon` + `isOverdue`).
export type ArchiveUiSearchConditionOption =
  | ""
  | "dueSoon"
  | "overdue"
  | "expiringSoon"
  | "expired";
export const ARCHIVE_UI_SEARCH_CONDITIONS: readonly Exclude<
  ArchiveUiSearchConditionOption,
  ""
>[] = ["dueSoon", "overdue", "expiringSoon", "expired"];

const ARCHIVE_UI_SEARCH_CONDITION_LABELS: Readonly<
  Record<Exclude<ArchiveUiSearchConditionOption, "">, string>
> = {
  dueSoon: "Due soon",
  overdue: "Overdue",
  expiringSoon: "Expiring soon",
  expired: "Expired",
};

// The raw, unvalidated draft-form field values (`<input>`/`<select>` control
// values are always plain strings) — separate from the normalized,
// closed-set-checked `ArchiveUiSearchFilters` below.
export interface ArchiveUiSearchDraftFilters {
  readonly name: string;
  readonly status: string;
  readonly condition: string;
}

// The normalized, closed-set-verified filter snapshot: a trimmed name (`""`
// meaning "omit"), a verified status, and a verified condition. This is the
// ONLY shape the query builder below ever consumes — an invalid draft value
// never reaches it.
export interface ArchiveUiSearchFilters {
  readonly name: string;
  readonly status: ArchiveUiSearchStatusOption;
  readonly condition: ArchiveUiSearchConditionOption;
}

export const ARCHIVE_UI_SEARCH_EMPTY_FILTERS: ArchiveUiSearchFilters = {
  name: "",
  status: "",
  condition: "",
};

export type ArchiveUiValidateSearchFiltersOutcome =
  | { readonly kind: "invalid"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "valid"; readonly filters: ArchiveUiSearchFilters };

// Card scope "Filter form behavior": trims the name, validates status and
// condition against their exact closed sets, and produces field-specific
// errors for a tampered/impossible value — never a service call when
// invalid. A normal `<select>` cannot itself produce an out-of-set value,
// but this function is exercised directly (and via a forcibly-corrupted
// draft state) so the guarantee holds even for a tampered value.
export function archiveUiValidateSearchFilters(
  draft: ArchiveUiSearchDraftFilters,
): ArchiveUiValidateSearchFiltersOutcome {
  const entries: ArchiveUiFieldErrorEntry[] = [];

  const statusValid =
    draft.status === "" ||
    (ARCHIVE_UI_SEARCH_STATUSES as readonly string[]).includes(draft.status);
  if (!statusValid) {
    entries.push({ field: "status", message: "Choose a valid status." });
  }

  const conditionValid =
    draft.condition === "" ||
    (ARCHIVE_UI_SEARCH_CONDITIONS as readonly string[]).includes(draft.condition);
  if (!conditionValid) {
    entries.push({ field: "condition", message: "Choose a valid condition." });
  }

  if (entries.length > 0) {
    return { kind: "invalid", fieldErrors: archiveUiFieldErrorMapFromEntries(entries) };
  }

  return {
    kind: "valid",
    filters: {
      name: draft.name.trim(),
      status: draft.status as ArchiveUiSearchStatusOption,
      condition: draft.condition as ArchiveUiSearchConditionOption,
    },
  };
}

// Card scope "Real opaque cursor behavior" + "Explicitly excluded backend
// parameters": builds the EXACT query object structurally — a blank name is
// OMITTED (never sent as `""`), no status/condition key when unset, at most
// ONE condition flag, the first page OMITS `cursor` entirely, and `limit`
// is NEVER set. `ArchiveFolderSearchQuery` is reused directly for BOTH
// modes: `ArchiveItemSearchQuery` only ADDS optional `itemType`/`folderId`
// fields this screen never sets, so a bare `ArchiveFolderSearchQuery` value
// is structurally valid for `searchItems` too — no second query shape.
export function archiveUiSearchQueryFromFilters(
  filters: ArchiveUiSearchFilters,
  cursor: string | undefined,
): ArchiveFolderSearchQuery {
  const query: ArchiveFolderSearchQuery = {};
  if (filters.name.length > 0) {
    query.nameContains = filters.name;
  }
  if (filters.status !== "") {
    query.status = filters.status;
  }
  if (filters.condition === "dueSoon") {
    query.isDueSoon = true;
  } else if (filters.condition === "overdue") {
    query.isOverdue = true;
  } else if (filters.condition === "expiringSoon") {
    query.isExpiringSoon = true;
  } else if (filters.condition === "expired") {
    query.isExpired = true;
  }
  if (cursor !== undefined) {
    query.cursor = cursor;
  }
  return query;
}

// One page of search results, mode-agnostic: `items` holds either
// `ArchiveFolder[]` or `ArchiveItem[]` depending on the CURRENT mode (never
// mixed) — the caller always knows which via the screen's own `mode` state.
export interface ArchiveUiSearchResultData {
  readonly items: readonly (ArchiveFolder | ArchiveItem)[];
  readonly nextCursor: string | null;
}

export async function archiveUiFetchSearchPage(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  mode: ArchiveUiSearchMode,
  filters: ArchiveUiSearchFilters,
  cursor: string | undefined,
): Promise<ArchiveUiViewState<ArchiveUiSearchResultData>> {
  const query = archiveUiSearchQueryFromFilters(filters, cursor);
  // Deliberately NO `isEmpty` predicate (card scope item 10): a page with
  // zero rows must still preserve working Back/Next pagination — emptiness
  // is handled INSIDE the `ready` render below as inline content, never by
  // discarding the page/cursor data via the outer `empty` state.
  if (mode === "folder") {
    const result = await bridge.service.searchFolders(context, query);
    return archiveUiViewStateFromResult<ArchiveUiSearchResultData>(result, bridge.translateError);
  }
  const result = await bridge.service.searchItems(context, query);
  return archiveUiViewStateFromResult<ArchiveUiSearchResultData>(result, bridge.translateError);
}

// Card scope "Real opaque cursor behavior": ONE current-mode page state
// (never per-mode parallel stacks) — visible page, cursor stack starting
// `[undefined]`, page index, and the applied filter snapshot used for the
// page.
export interface ArchiveUiSearchPageState {
  readonly viewState: ArchiveUiViewState<ArchiveUiSearchResultData>;
  readonly cursorStack: readonly (string | undefined)[];
  readonly pageIndex: number;
  readonly appliedFilters: ArchiveUiSearchFilters;
}

export function archiveUiInitialSearchPageState(
  appliedFilters: ArchiveUiSearchFilters,
): ArchiveUiSearchPageState {
  return {
    viewState: archiveUiViewStateLoading(),
    cursorStack: [undefined],
    pageIndex: 0,
    appliedFilters,
  };
}

// Next: truncates any stale forward branch beyond the current page (so a
// Next after a Back never resurrects a stale forward branch) and appends
// the EXACT `nextCursor` the current page returned — never fabricated,
// never inspected/decoded.
export function archiveUiSearchPageStateAfterNext(
  state: ArchiveUiSearchPageState,
  nextCursor: string,
): ArchiveUiSearchPageState {
  const truncated = state.cursorStack.slice(0, state.pageIndex + 1);
  return {
    viewState: archiveUiViewStateLoading(),
    cursorStack: [...truncated, nextCursor],
    pageIndex: state.pageIndex + 1,
    appliedFilters: state.appliedFilters,
  };
}

// Back: reuses the EXACT previously requested cursor already recorded at
// the prior stack position; never synthesizes one.
export function archiveUiSearchPageStateAfterBack(
  state: ArchiveUiSearchPageState,
): ArchiveUiSearchPageState {
  const pageIndex = Math.max(0, state.pageIndex - 1);
  return {
    viewState: archiveUiViewStateLoading(),
    cursorStack: state.cursorStack,
    pageIndex,
    appliedFilters: state.appliedFilters,
  };
}

export function archiveUiSearchNextEnabled(state: ArchiveUiSearchPageState): boolean {
  return state.viewState.status === "ready" && state.viewState.data.nextCursor !== null;
}

export function archiveUiSearchBackEnabled(state: ArchiveUiSearchPageState): boolean {
  return state.pageIndex > 0;
}

// ---------------------------------------------------------------------------
// Safe-summary rendering: an explicit, narrow structural projection over
// EITHER `ArchiveFolder` or `ArchiveItem` (both share these exact field
// shapes — `status`/`ArchiveItemStatus` is the SAME closed
// `ArchiveBusinessStatus` union as `ArchiveFolderStatus`). Only safe public
// fields; never a folder id, user id, or other internal identifier as
// rendered text — ids are used only as React keys / bridge-call arguments /
// `data-*` test hooks below.
// ---------------------------------------------------------------------------

interface ArchiveUiSearchResultEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ArchiveBusinessStatus;
  readonly dueAt: Date | null;
  readonly expiresAt: Date | null;
  readonly isDueSoon: boolean;
  readonly isOverdue: boolean;
  readonly isExpiringSoon: boolean;
  readonly isExpired: boolean;
}

export function archiveUiSearchConditionLabels(entry: ArchiveUiSearchResultEntry): string[] {
  const labels: string[] = [];
  if (entry.isDueSoon) labels.push(ARCHIVE_UI_SEARCH_CONDITION_LABELS.dueSoon);
  if (entry.isOverdue) labels.push(ARCHIVE_UI_SEARCH_CONDITION_LABELS.overdue);
  if (entry.isExpiringSoon) labels.push(ARCHIVE_UI_SEARCH_CONDITION_LABELS.expiringSoon);
  if (entry.isExpired) labels.push(ARCHIVE_UI_SEARCH_CONDITION_LABELS.expired);
  return labels;
}

// ---------------------------------------------------------------------------
// Approved Shell semantic tokens only (component-local style objects — no
// global stylesheet/CSS-module/CSS-framework pipeline; A-UI-RESP-001).
// ---------------------------------------------------------------------------

const ARCHIVE_SEARCH_SCREEN_CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  padding: "var(--space-6)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_SEARCH_SCREEN_HEADING_STYLE: CSSProperties = {
  fontSize: "var(--text-display)",
  color: "var(--color-text)",
  margin: 0,
};

const ARCHIVE_SEARCH_SCREEN_MODE_GROUP_STYLE: CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
};

const ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
};

const ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_SELECTED_STYLE: CSSProperties = {
  ...ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_STYLE,
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  borderColor: "var(--color-accent)",
};

const ARCHIVE_SEARCH_SCREEN_FORM_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  alignItems: "flex-end",
};

const ARCHIVE_SEARCH_SCREEN_FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const ARCHIVE_SEARCH_SCREEN_INPUT_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2)",
  fontSize: "var(--text-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
};

const ARCHIVE_SEARCH_SCREEN_BUTTON_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-accent)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-accent-contrast)",
  padding: "var(--space-2) var(--space-4)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ARCHIVE_SEARCH_SCREEN_SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...ARCHIVE_SEARCH_SCREEN_BUTTON_STYLE,
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
};

const ARCHIVE_SEARCH_SCREEN_ERROR_TEXT_STYLE: CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--text-small)",
  margin: 0,
};

const ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

// A-UI-RESP-001: `auto-fit`/`minmax` gives narrow single-column and wide
// multi-column layout from ONE style object — no separate breakpoint build.
const ARCHIVE_SEARCH_SCREEN_GRID_STYLE: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "var(--space-4)",
  padding: 0,
  margin: 0,
};

const ARCHIVE_SEARCH_SCREEN_CARD_BUTTON_STYLE: CSSProperties = {
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

const ARCHIVE_SEARCH_SCREEN_PAGINATION_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
};

const ARCHIVE_SEARCH_SCREEN_HEADING_ID = "archive-search-screen-heading";
const ARCHIVE_SEARCH_SCREEN_MODE_GROUP_LABEL_ID = "archive-search-screen-mode-label";
const ARCHIVE_SEARCH_SCREEN_FORM_ID = "archive-search-screen-filters";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly) — the exact function
// `ArchiveSearchScreen.render()` calls.
// ---------------------------------------------------------------------------

function renderArchiveSearchResultEntry(
  mode: ArchiveUiSearchMode,
  entry: ArchiveUiSearchResultEntry,
  onSelect: (id: string) => void,
): ReactElement {
  const conditionLabels = archiveUiSearchConditionLabels(entry);
  return (
    <li key={entry.id}>
      <button
        type="button"
        {...(mode === "folder"
          ? { "data-archive-ui-folder-id": entry.id }
          : { "data-archive-ui-item-id": entry.id })}
        onClick={() => onSelect(entry.id)}
        style={ARCHIVE_SEARCH_SCREEN_CARD_BUTTON_STYLE}
      >
        <span>{entry.name}</span>
        {entry.description !== null && entry.description !== "" ? (
          <span style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>{entry.description}</span>
        ) : null}
        <span style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>Status: {entry.status}</span>
        {entry.dueAt !== null ? (
          <span style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>
            Due <time dateTime={entry.dueAt.toISOString()}>{entry.dueAt.toISOString()}</time>
          </span>
        ) : null}
        {entry.expiresAt !== null ? (
          <span style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>
            Expires <time dateTime={entry.expiresAt.toISOString()}>{entry.expiresAt.toISOString()}</time>
          </span>
        ) : null}
        {conditionLabels.length > 0 ? (
          <span style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>{conditionLabels.join(", ")}</span>
        ) : null}
      </button>
    </li>
  );
}

interface ArchiveSearchScreenRenderHandlers {
  readonly onSelectFolderMode: () => void;
  readonly onSelectItemMode: () => void;
  readonly onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onStatusChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onConditionChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onClear: () => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onFolderSelect: (folderId: string) => void;
  readonly onItemSelect: (itemId: string) => void;
}

interface ArchiveSearchScreenRenderState {
  readonly mode: ArchiveUiSearchMode;
  readonly draftName: string;
  readonly draftStatus: string;
  readonly draftCondition: string;
  readonly fieldErrors: ArchiveUiFieldErrorMap;
  readonly page: ArchiveUiSearchPageState;
}

function renderArchiveSearchFilterForm(
  state: ArchiveSearchScreenRenderState,
  handlers: ArchiveSearchScreenRenderHandlers,
): ReactElement {
  const nameFieldId = `${ARCHIVE_SEARCH_SCREEN_FORM_ID}-name`;
  const statusAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_SEARCH_SCREEN_FORM_ID,
    "status",
    state.fieldErrors,
  );
  const conditionAccessibility = archiveUiFieldAccessibility(
    ARCHIVE_SEARCH_SCREEN_FORM_ID,
    "condition",
    state.fieldErrors,
  );

  return (
    <form
      aria-label="Search filters"
      onSubmit={handlers.onSearchSubmit}
      style={ARCHIVE_SEARCH_SCREEN_FORM_STYLE}
    >
      <div style={ARCHIVE_SEARCH_SCREEN_FIELD_STYLE}>
        <label htmlFor={nameFieldId}>Name contains</label>
        <input
          id={nameFieldId}
          type="text"
          value={state.draftName}
          onChange={handlers.onNameChange}
          style={ARCHIVE_SEARCH_SCREEN_INPUT_STYLE}
        />
      </div>
      <div style={ARCHIVE_SEARCH_SCREEN_FIELD_STYLE}>
        <label id={statusAccessibility.labelId} htmlFor={statusAccessibility.fieldId}>
          Status
        </label>
        <select
          id={statusAccessibility.fieldId}
          value={state.draftStatus}
          aria-describedby={statusAccessibility.describedBy}
          aria-invalid={statusAccessibility.invalid}
          onChange={handlers.onStatusChange}
          style={ARCHIVE_SEARCH_SCREEN_INPUT_STYLE}
        >
          <option value="">Any status</option>
          {ARCHIVE_UI_SEARCH_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {archiveUiFieldHasError(state.fieldErrors, "status") ? (
          <p id={statusAccessibility.errorId} role="alert" style={ARCHIVE_SEARCH_SCREEN_ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.fieldErrors, "status").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={ARCHIVE_SEARCH_SCREEN_FIELD_STYLE}>
        <label id={conditionAccessibility.labelId} htmlFor={conditionAccessibility.fieldId}>
          Condition
        </label>
        <select
          id={conditionAccessibility.fieldId}
          value={state.draftCondition}
          aria-describedby={conditionAccessibility.describedBy}
          aria-invalid={conditionAccessibility.invalid}
          onChange={handlers.onConditionChange}
          style={ARCHIVE_SEARCH_SCREEN_INPUT_STYLE}
        >
          <option value="">No condition</option>
          {ARCHIVE_UI_SEARCH_CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {ARCHIVE_UI_SEARCH_CONDITION_LABELS[condition]}
            </option>
          ))}
        </select>
        {archiveUiFieldHasError(state.fieldErrors, "condition") ? (
          <p
            id={conditionAccessibility.errorId}
            role="alert"
            style={ARCHIVE_SEARCH_SCREEN_ERROR_TEXT_STYLE}
          >
            {archiveUiFieldMessages(state.fieldErrors, "condition").join(" ")}
          </p>
        ) : null}
      </div>
      <button type="submit" style={ARCHIVE_SEARCH_SCREEN_BUTTON_STYLE}>
        Search
      </button>
      <button
        type="button"
        onClick={handlers.onClear}
        style={ARCHIVE_SEARCH_SCREEN_SECONDARY_BUTTON_STYLE}
      >
        Clear
      </button>
    </form>
  );
}

function renderArchiveSearchResultsRegion(
  state: ArchiveSearchScreenRenderState,
  handlers: ArchiveSearchScreenRenderHandlers,
): ReactElement {
  const nextEnabled = archiveUiSearchNextEnabled(state.page);
  const backEnabled = archiveUiSearchBackEnabled(state.page);
  const emptyCopy =
    state.mode === "folder"
      ? { title: "No folders match your search." }
      : { title: "No items match your search." };

  return (
    <div aria-busy={state.page.viewState.status === "loading"}>
      <ArchiveUiStatePresentation
        state={state.page.viewState}
        loadingCopy={{ title: "Searching…" }}
        emptyCopy={emptyCopy}
        renderReady={(data) => (
          <>
            {data.items.length === 0 ? (
              <p data-archive-ui-search-empty="true" style={ARCHIVE_SEARCH_SCREEN_MUTED_TEXT_STYLE}>
                {emptyCopy.title}
              </p>
            ) : state.mode === "folder" ? (
              <ul role="list" aria-label="Folder results" style={ARCHIVE_SEARCH_SCREEN_GRID_STYLE}>
                {(data.items as ArchiveFolder[]).map((folder) =>
                  renderArchiveSearchResultEntry("folder", folder, handlers.onFolderSelect),
                )}
              </ul>
            ) : (
              <ul role="list" aria-label="Item results" style={ARCHIVE_SEARCH_SCREEN_GRID_STYLE}>
                {(data.items as ArchiveItem[]).map((item) =>
                  renderArchiveSearchResultEntry("item", item, handlers.onItemSelect),
                )}
              </ul>
            )}
            <div style={ARCHIVE_SEARCH_SCREEN_PAGINATION_STYLE}>
              <button
                type="button"
                disabled={!backEnabled}
                onClick={handlers.onBack}
                style={ARCHIVE_SEARCH_SCREEN_SECONDARY_BUTTON_STYLE}
                aria-label="Back page"
              >
                Back page
              </button>
              <span data-archive-ui-search-page-index={state.page.pageIndex}>
                Page {state.page.pageIndex + 1}
              </span>
              <button
                type="button"
                disabled={!nextEnabled}
                onClick={handlers.onNext}
                style={ARCHIVE_SEARCH_SCREEN_SECONDARY_BUTTON_STYLE}
                aria-label="Next page"
              >
                Next page
              </button>
            </div>
          </>
        )}
      />
    </div>
  );
}

function renderArchiveSearchScreen(
  state: ArchiveSearchScreenRenderState,
  handlers: ArchiveSearchScreenRenderHandlers,
): ReactElement {
  return (
    <section
      data-archive-ui-screen="search"
      aria-labelledby={ARCHIVE_SEARCH_SCREEN_HEADING_ID}
      style={ARCHIVE_SEARCH_SCREEN_CONTAINER_STYLE}
    >
      <h1 id={ARCHIVE_SEARCH_SCREEN_HEADING_ID} style={ARCHIVE_SEARCH_SCREEN_HEADING_STYLE}>
        Search
      </h1>
      <div
        role="group"
        aria-labelledby={ARCHIVE_SEARCH_SCREEN_MODE_GROUP_LABEL_ID}
        style={ARCHIVE_SEARCH_SCREEN_MODE_GROUP_STYLE}
      >
        <span id={ARCHIVE_SEARCH_SCREEN_MODE_GROUP_LABEL_ID} style={{ display: "none" }}>
          Search mode
        </span>
        <button
          type="button"
          aria-pressed={state.mode === "folder"}
          data-archive-ui-search-mode="folder"
          onClick={handlers.onSelectFolderMode}
          style={
            state.mode === "folder"
              ? ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_SELECTED_STYLE
              : ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_STYLE
          }
        >
          Folders
        </button>
        <button
          type="button"
          aria-pressed={state.mode === "item"}
          data-archive-ui-search-mode="item"
          onClick={handlers.onSelectItemMode}
          style={
            state.mode === "item"
              ? ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_SELECTED_STYLE
              : ARCHIVE_SEARCH_SCREEN_MODE_CONTROL_STYLE
          }
        >
          Items
        </button>
      </div>
      {renderArchiveSearchFilterForm(state, handlers)}
      {renderArchiveSearchResultsRegion(state, handlers)}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The public mountable screen.
// ---------------------------------------------------------------------------

export interface ArchiveSearchScreenProps {
  readonly bridge: ArchiveUiBridge;
}

interface ArchiveSearchScreenState {
  readonly context: ArchiveContextInput | null;
  readonly mode: ArchiveUiSearchMode;
  readonly draftName: string;
  readonly draftStatus: string;
  readonly draftCondition: string;
  readonly fieldErrors: ArchiveUiFieldErrorMap;
  readonly page: ArchiveUiSearchPageState;
}

function archiveUiInitialSearchScreenState(): ArchiveSearchScreenState {
  return {
    context: null,
    mode: "folder",
    draftName: "",
    draftStatus: "",
    draftCondition: "",
    fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    page: archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS),
  };
}

// The Archive module folder/item search screen (Correction Phase 6
// TASK-07). A host mounts this with the real `ArchiveUiBridge`
// implementation; it owns its own dual-mode cursor-paginated search
// lifecycle end to end.
export class ArchiveSearchScreen extends React.Component<
  ArchiveSearchScreenProps,
  ArchiveSearchScreenState
> {
  // Card scope "Real opaque cursor behavior": a PRIVATE monotonically
  // increasing instance-field request counter — deliberately NOT derived
  // from `this.state.requestSeq + 1`, which is unsafe under batched React
  // `setState` — so a response from an older mode/filter/page request can
  // never overwrite the newest selected mode/page, independent of any
  // state-update batching behavior.
  private requestCounter = 0;

  constructor(props: ArchiveSearchScreenProps) {
    super(props);
    this.state = archiveUiInitialSearchScreenState();
    this.handleSelectFolderMode = this.handleSelectFolderMode.bind(this);
    this.handleSelectItemMode = this.handleSelectItemMode.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleStatusChange = this.handleStatusChange.bind(this);
    this.handleConditionChange = this.handleConditionChange.bind(this);
    this.handleSearchSubmit = this.handleSearchSubmit.bind(this);
    this.handleClear = this.handleClear.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleBack = this.handleBack.bind(this);
    this.handleFolderSelect = this.handleFolderSelect.bind(this);
    this.handleItemSelect = this.handleItemSelect.bind(this);
  }

  componentDidMount(): void {
    // Card scope "Search modes": initial mount starts in folder mode with
    // an empty applied filter set — exactly `searchFolders(context, {})`.
    void this.runSearch("folder", archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS));
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method mount/mode-select/filter/pagination handlers below
  // call), so the real wiring is provable without a DOM renderer.
  async runSearch(mode: ArchiveUiSearchMode, nextPageState: ArchiveUiSearchPageState): Promise<void> {
    const context = this.props.bridge.getContext();
    const seq = ++this.requestCounter;
    this.setState({ context, mode, page: nextPageState });

    const cursor = nextPageState.cursorStack[nextPageState.pageIndex];
    const viewState = await archiveUiFetchSearchPage(
      this.props.bridge,
      context,
      mode,
      nextPageState.appliedFilters,
      cursor,
    );

    // Stale-response guard: a NEWER request (another mode switch, filter
    // submission, Clear, or page navigation) may have started and completed
    // while this one was in flight — only apply this result if this
    // request is still the latest issued.
    if (seq !== this.requestCounter) return;
    this.setState((prev) => ({ page: { ...prev.page, viewState } }));
  }

  handleSelectFolderMode(): void {
    if (this.state.mode === "folder") return;
    // Card scope "Switching modes": keeps the last-applied filters, resets
    // cursor history to the first page, never reuses the other mode's
    // cursor.
    void this.runSearch("folder", archiveUiInitialSearchPageState(this.state.page.appliedFilters));
  }

  handleSelectItemMode(): void {
    if (this.state.mode === "item") return;
    void this.runSearch("item", archiveUiInitialSearchPageState(this.state.page.appliedFilters));
  }

  handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ draftName: event.target.value });
  }

  handleStatusChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ draftStatus: event.target.value });
  }

  handleConditionChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ draftCondition: event.target.value });
  }

  handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const outcome = archiveUiValidateSearchFilters({
      name: this.state.draftName,
      status: this.state.draftStatus,
      condition: this.state.draftCondition,
    });
    if (outcome.kind === "invalid") {
      this.setState({ fieldErrors: outcome.fieldErrors });
      return;
    }
    this.setState({ fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP });
    void this.runSearch(this.state.mode, archiveUiInitialSearchPageState(outcome.filters));
  }

  handleClear(): void {
    this.setState({
      draftName: "",
      draftStatus: "",
      draftCondition: "",
      fieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    });
    void this.runSearch(this.state.mode, archiveUiInitialSearchPageState(ARCHIVE_UI_SEARCH_EMPTY_FILTERS));
  }

  handleNext(): void {
    const page = this.state.page;
    if (!archiveUiSearchNextEnabled(page)) return;
    if (page.viewState.status !== "ready") return;
    const { nextCursor } = page.viewState.data;
    if (nextCursor === null) return;
    void this.runSearch(this.state.mode, archiveUiSearchPageStateAfterNext(page, nextCursor));
  }

  handleBack(): void {
    const page = this.state.page;
    if (!archiveUiSearchBackEnabled(page)) return;
    void this.runSearch(this.state.mode, archiveUiSearchPageStateAfterBack(page));
  }

  handleFolderSelect(folderId: string): void {
    this.props.bridge.navigate({ screen: "folder", folderId });
  }

  handleItemSelect(itemId: string): void {
    this.props.bridge.navigate({ screen: "item", itemId });
  }

  render(): ReactElement {
    return renderArchiveSearchScreen(this.state, {
      onSelectFolderMode: this.handleSelectFolderMode,
      onSelectItemMode: this.handleSelectItemMode,
      onNameChange: this.handleNameChange,
      onStatusChange: this.handleStatusChange,
      onConditionChange: this.handleConditionChange,
      onSearchSubmit: this.handleSearchSubmit,
      onClear: this.handleClear,
      onNext: this.handleNext,
      onBack: this.handleBack,
      onFolderSelect: this.handleFolderSelect,
      onItemSelect: this.handleItemSelect,
    });
  }
}
