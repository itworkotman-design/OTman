// Archive UI permission-management, role-management, and role-assignment
// screen — Correction Phase 6 TASK-08 (§7 item 5, A-UI-PERM-001,
// A-UI-DESTRUCT-001). Exposes the already-public `getEffectiveCapabilities`/
// `listPermissionRules`/`explainPermissions`/`setPermissionRule`/
// `revokePermissionRule` permission surface plus the TASK-08A role-read/
// role-CRUD/role-assignment surface (`listArchiveRoles`,
// `listArchiveRoleAssignmentsForRole`, `createArchiveRole`,
// `renameArchiveRole`, `deleteArchiveRole`, `assignArchiveRole`,
// `unassignArchiveRole`) and the TASK-08A identity bridge
// (`bridge.identity.resolvePlatformUsers`/`listAssignableCompanyMembers`) —
// never a raw Platform-user UUID text field, never a second authorization
// model, never Shell/Next.js/router/window.location/Prisma/internal-Archive
// import anywhere in this file.
//
// HOOK-CALL CONSTRAINT: identical reasoning to `search-screen.tsx`'s file-top
// comment — this repository's test toolchain has no `react-dom`/renderer, and
// React's hook dispatcher is `null` outside an active render performed by a
// real renderer, so `ArchivePermissionsScreen` is a `React.Component`
// SUBCLASS — the same accepted no-renderer pattern TASK-04–07 already
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

import type {
  ArchiveUiBridge,
  ArchiveUiErrorPresentation,
  ArchiveUiIdentityFailure,
  ArchiveUiPlatformUserDisplay,
} from "./bridge.js";
import {
  archiveUiViewStateDenied,
  archiveUiViewStateError,
  archiveUiViewStateLoading,
  archiveUiViewStateReady,
  ArchiveUiStatePresentation,
  type ArchiveUiViewState,
} from "./view-state.js";
import {
  ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
  archiveUiFieldAccessibility,
  archiveUiFieldErrorMapFromEntries,
  archiveUiFieldHasError,
  archiveUiFieldMessages,
  type ArchiveUiFieldErrorEntry,
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
import {
  ARCHIVE_NAMESPACE_PERMISSION_ACTIONS,
  ARCHIVE_PERMISSION_ACTIONS,
  type ArchiveAuthorizationTargetInput,
  type ArchiveContextInput,
  type ArchiveEffectiveCapabilitySource,
  type ArchivePermission,
  type ArchivePermissionAction,
  type ArchivePermissionEffect,
  type ArchivePermissionExplanation,
  type ArchivePermissionExplanationDecidingTarget,
  type ArchivePermissionSubjectType,
  type ArchivePermissionTargetType,
  type ArchiveRoleAssignmentSummary,
  type ArchiveRoleSummary,
} from "@customprojects/archive-service";

// ---------------------------------------------------------------------------
// Pure, host/database/network-free controller logic. Each function below is
// the EXACT code path `ArchivePermissionsScreen`'s methods call — not a
// duplicated stand-in.
// ---------------------------------------------------------------------------

// Card scope "Valid action choices": the exact closed set for the target
// type — never a wildcard/group/owner/implication vocabulary invented here.
export function archiveUiPermissionActionChoices(
  targetType: ArchivePermissionTargetType,
): readonly ArchivePermissionAction[] {
  return targetType === "namespace" ? ARCHIVE_NAMESPACE_PERMISSION_ACTIONS : ARCHIVE_PERMISSION_ACTIONS;
}

// Card scope "Human display priority": current-context-user match renders
// "You" (optionally followed by parenthetical current-user display data);
// otherwise displayName, then handle, then email, then the honest
// "Unresolved user" placeholder — the raw platformUserId is NEVER a
// fallback.
export function archiveUiPermissionsSubjectDisplay(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  subjectId: string,
  resolved: ArchiveUiPlatformUserDisplay | undefined,
): string {
  if (subjectId === context.userId) {
    const display = bridge.getCurrentUserDisplay();
    if (display?.displayName !== undefined && display.displayName.trim().length > 0) {
      return `You (${display.displayName})`;
    }
    if (display?.email !== undefined && display.email.trim().length > 0) {
      return `You (${display.email})`;
    }
    return "You";
  }
  if (resolved?.displayName !== undefined && resolved.displayName.trim().length > 0) {
    return resolved.displayName;
  }
  if (resolved?.handle !== undefined && resolved.handle.trim().length > 0) {
    return resolved.handle;
  }
  if (resolved?.email !== undefined && resolved.email.trim().length > 0) {
    return resolved.email;
  }
  return "Unresolved user";
}

// Card scope "Role-subject display priority": role name from the loaded
// active-role list, else the honest "Unresolved role" placeholder — the raw
// role id is NEVER a fallback.
export function archiveUiPermissionsRoleSubjectDisplay(
  roles: readonly ArchiveRoleSummary[],
  roleId: string,
): string {
  return roles.find((role) => role.id === roleId)?.name ?? "Unresolved role";
}

// Card scope "Deciding-target display": exact copy per case, never an id.
export function archiveUiPermissionsDecidingTargetLabel(
  decidedBy: ArchivePermissionExplanationDecidingTarget | null,
): string {
  if (decidedBy === null) return "No deciding rule";
  if (decidedBy.hidden) return "Restricted location";
  if (decidedBy.targetType === "namespace") return "Archive namespace";
  if (decidedBy.targetType === "item") return "This item";
  return decidedBy.folderName !== null ? decidedBy.folderName : "This folder";
}

const ARCHIVE_UI_PERMISSIONS_SOURCE_LABELS: Readonly<Record<ArchiveEffectiveCapabilitySource, string>> = {
  direct_user: "A rule set directly for you",
  archive_role: "A rule set for one of your roles",
  inherited: "Inherited from a parent location",
  overridden: "Overridden by a closer rule",
  none: "No rule decides (denied by default)",
};

export function archiveUiPermissionsSourceLabel(source: ArchiveEffectiveCapabilitySource): string {
  return ARCHIVE_UI_PERMISSIONS_SOURCE_LABELS[source];
}

// Card scope "Identity enrichment": the unique subjectId values of
// user-subject rules only — role subjects resolve through the roles list,
// never through identity resolution.
export function archiveUiUniqueUserSubjectIds(rules: readonly ArchivePermission[]): readonly string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const rule of rules) {
    if (rule.subjectType !== "user") continue;
    if (seen.has(rule.subjectId)) continue;
    seen.add(rule.subjectId);
    ids.push(rule.subjectId);
  }
  return ids;
}

// Card scope "Assignment identity behavior": the unique assigned
// platformUserId values for the currently selected role's assignments.
export function archiveUiUniqueAssignmentPlatformUserIds(
  assignments: readonly ArchiveRoleAssignmentSummary[],
): readonly string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const assignment of assignments) {
    if (seen.has(assignment.platformUserId)) continue;
    seen.add(assignment.platformUserId);
    ids.push(assignment.platformUserId);
  }
  return ids;
}

// Card scope "Identity enrichment": matches ONLY requested ids (unrelated
// rows are ignored defensively), and applies AT MOST ONE display row per
// requested id (the first occurrence in `resolved` wins over a later
// duplicate) — never overwrites an already-cached id with an unrelated row.
// Previously cached entries for ids outside this request are preserved
// unchanged.
export function archiveUiMergeIdentityDisplays(
  existing: Readonly<Record<string, ArchiveUiPlatformUserDisplay>>,
  resolved: readonly ArchiveUiPlatformUserDisplay[],
  requestedIds: readonly string[],
): Readonly<Record<string, ArchiveUiPlatformUserDisplay>> {
  const requested = new Set(requestedIds);
  const next: Record<string, ArchiveUiPlatformUserDisplay> = { ...existing };
  const applied = new Set<string>();
  for (const entry of resolved) {
    if (!requested.has(entry.platformUserId)) continue;
    if (applied.has(entry.platformUserId)) continue;
    applied.add(entry.platformUserId);
    next[entry.platformUserId] = entry;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Set-rule form draft validation (card scope "Set-rule form"): controlled
// selections only — subject id must come from the supplied active
// role/assignable-member list, never a free-typed id; action must be in the
// exact target-valid closed set; effect must be allow|deny.
// ---------------------------------------------------------------------------

export interface ArchiveUiSetRuleDraft {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly action: string;
  readonly effect: string;
}

export interface ArchiveUiValidatedSetRuleInput {
  readonly subjectType: ArchivePermissionSubjectType;
  readonly subjectId: string;
  readonly action: ArchivePermissionAction;
  readonly effect: ArchivePermissionEffect;
}

export type ArchiveUiValidateSetRuleOutcome =
  | { readonly kind: "invalid"; readonly fieldErrors: ArchiveUiFieldErrorMap }
  | { readonly kind: "valid"; readonly value: ArchiveUiValidatedSetRuleInput };

export function archiveUiValidateSetRuleDraft(
  draft: ArchiveUiSetRuleDraft,
  targetType: ArchivePermissionTargetType,
  availableRoles: readonly ArchiveRoleSummary[],
  availableMembers: readonly ArchiveUiPlatformUserDisplay[],
): ArchiveUiValidateSetRuleOutcome {
  const entries: ArchiveUiFieldErrorEntry[] = [];
  const validActions = archiveUiPermissionActionChoices(targetType);

  if (draft.subjectType === "user") {
    if (!availableMembers.some((member) => member.platformUserId === draft.subjectId)) {
      entries.push({ field: "subjectId", message: "Choose a member." });
    }
  } else if (draft.subjectType === "role") {
    if (!availableRoles.some((role) => role.id === draft.subjectId)) {
      entries.push({ field: "subjectId", message: "Choose a role." });
    }
  } else {
    entries.push({ field: "subjectType", message: "Choose a subject type." });
  }

  if (!(validActions as readonly string[]).includes(draft.action)) {
    entries.push({ field: "action", message: "Choose a valid action." });
  }

  if (draft.effect !== "allow" && draft.effect !== "deny") {
    entries.push({ field: "effect", message: "Choose allow or deny." });
  }

  if (entries.length > 0) {
    return { kind: "invalid", fieldErrors: archiveUiFieldErrorMapFromEntries(entries) };
  }

  return {
    kind: "valid",
    value: {
      subjectType: draft.subjectType as ArchivePermissionSubjectType,
      subjectId: draft.subjectId,
      action: draft.action as ArchivePermissionAction,
      effect: draft.effect as ArchivePermissionEffect,
    },
  };
}

// ---------------------------------------------------------------------------
// Screen data/state shapes.
// ---------------------------------------------------------------------------

export interface ArchivePermissionsScreenData {
  readonly rules: readonly ArchivePermission[];
  readonly explanation: ArchivePermissionExplanation;
}

// Card scope "Stage 3 — optional namespace role administration read": a
// separate, non-fatal section state — its failure never discards a loaded
// `ArchivePermissionsScreenData` ready state.
export type ArchiveUiRoleAdminState =
  | { readonly status: "loading" }
  | { readonly status: "unavailable"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly status: "ready"; readonly roles: readonly ArchiveRoleSummary[] };

// Card scope "selected-role assignment loading": lazy, per-selected-role
// only — never one request per role.
export type ArchiveUiRoleAssignmentsState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "denied"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly status: "error"; readonly presentation: ArchiveUiErrorPresentation }
  | { readonly status: "ready"; readonly assignments: readonly ArchiveRoleAssignmentSummary[] };

// Card scope "Stage 1 — capability preflight": the calm, non-leaking
// presentation used when the capability MAP itself (not an adapter error)
// reports `manage_permissions` denied — there is no `ArchiveHostAdapterError`
// to translate here, so this is a locally-authored, honest, non-leaking
// presentation, never a raw backend string.
const ARCHIVE_PERMISSIONS_SCREEN_DENIED_PRESENTATION: ArchiveUiErrorPresentation = {
  category: "unauthorized",
  title: "You don't have access to manage permissions here.",
  description: "Ask a permissions manager for access if you believe this is a mistake.",
};

// ---------------------------------------------------------------------------
// Row projections consumed by rendering — pure and directly testable without
// a renderer.
// ---------------------------------------------------------------------------

export interface ArchiveUiPermissionRuleRow {
  readonly rule: ArchivePermission;
  readonly subjectLabel: string;
}

export function archiveUiBuildPermissionRuleRows(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  rules: readonly ArchivePermission[],
  identityDisplayByUserId: Readonly<Record<string, ArchiveUiPlatformUserDisplay>>,
  roles: readonly ArchiveRoleSummary[],
): ArchiveUiPermissionRuleRow[] {
  return rules.map((rule) => ({
    rule,
    subjectLabel:
      rule.subjectType === "role"
        ? archiveUiPermissionsRoleSubjectDisplay(roles, rule.subjectId)
        : archiveUiPermissionsSubjectDisplay(bridge, context, rule.subjectId, identityDisplayByUserId[rule.subjectId]),
  }));
}

export interface ArchiveUiRoleAssignmentRow {
  readonly assignment: ArchiveRoleAssignmentSummary;
  readonly subjectLabel: string;
}

export function archiveUiBuildRoleAssignmentRows(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput,
  assignments: readonly ArchiveRoleAssignmentSummary[],
  identityDisplayByUserId: Readonly<Record<string, ArchiveUiPlatformUserDisplay>>,
): ArchiveUiRoleAssignmentRow[] {
  return assignments.map((assignment) => ({
    assignment,
    subjectLabel: archiveUiPermissionsSubjectDisplay(
      bridge,
      context,
      assignment.platformUserId,
      identityDisplayByUserId[assignment.platformUserId],
    ),
  }));
}

export interface ArchiveUiExplainedCapabilityRow {
  readonly action: ArchivePermissionAction;
  readonly allowed: boolean;
  readonly sourceLabel: string;
  readonly decidingTargetLabel: string;
}

// Card scope "Effective-permission explanation section": all ten
// capabilities, always — `explainPermissions.capabilities` is total over
// `ARCHIVE_PERMISSION_ACTIONS` regardless of target type.
export function archiveUiBuildExplanationRows(
  explanation: ArchivePermissionExplanation,
): ArchiveUiExplainedCapabilityRow[] {
  return ARCHIVE_PERMISSION_ACTIONS.map((action) => {
    const capability = explanation.capabilities[action];
    return {
      action,
      allowed: capability.allowed,
      sourceLabel: archiveUiPermissionsSourceLabel(capability.source),
      decidingTargetLabel: archiveUiPermissionsDecidingTargetLabel(capability.decidedBy),
    };
  });
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

const FORM_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  alignItems: "flex-end",
};

const FIELD_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const INPUT_STYLE: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  padding: "var(--space-2)",
  fontSize: "var(--text-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
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

const DANGER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  border: "1px solid var(--color-danger)",
  backgroundColor: "var(--color-danger)",
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
};

const ERROR_TEXT_STYLE: CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--text-small)",
  margin: 0,
};

const MUTED_TEXT_STYLE: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-small)",
};

const LIST_STYLE: CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: 0,
  margin: 0,
};

const ROW_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-3)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  padding: "var(--space-3)",
};

const HEADING_ID = "archive-permissions-screen-heading";
const SET_RULE_FORM_ID = "archive-permissions-screen-set-rule";
const CREATE_ROLE_FORM_ID = "archive-permissions-screen-create-role";
const RENAME_ROLE_FORM_ID = "archive-permissions-screen-rename-role";
const ASSIGN_FORM_ID = "archive-permissions-screen-assign";

// ---------------------------------------------------------------------------
// Pure rendering (no hooks; safe to invoke directly) — the exact functions
// `ArchivePermissionsScreen.render()` calls.
// ---------------------------------------------------------------------------

interface ArchivePermissionsScreenRenderHandlers {
  readonly onDismissFeedback: () => void;
  readonly onSetRuleSubjectTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSetRuleSubjectIdChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSetRuleActionChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSetRuleEffectChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSetRuleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onRequestRevoke: (rule: ArchivePermission) => void;
  readonly onCancelRevoke: () => void;
  readonly onConfirmRevoke: () => void;
  readonly onCreateRoleNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onCreateRoleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onSelectRole: (roleId: string) => void;
  readonly onRenameRoleNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRenameRoleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onRequestDeleteRole: () => void;
  readonly onCancelDeleteRole: () => void;
  readonly onConfirmDeleteRole: () => void;
  readonly onAssignMemberChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onAssignSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onUnassign: (platformUserId: string) => void;
}

function renderPermissionRulesSection(
  rows: readonly ArchiveUiPermissionRuleRow[],
  state: ArchivePermissionsScreenState,
  handlers: ArchivePermissionsScreenRenderHandlers,
): ReactElement {
  return (
    <div style={PANEL_STYLE}>
      <h2 style={SECTION_HEADING_STYLE}>Permission rules</h2>
      {rows.length === 0 ? (
        <p data-archive-ui-permissions-rules-empty="true" style={MUTED_TEXT_STYLE}>
          No permission rules are set on this location yet.
        </p>
      ) : (
        <ul role="list" aria-label="Permission rules" style={LIST_STYLE}>
          {rows.map((row) => {
            const revoking = state.revokingRuleId === row.rule.id;
            return (
              <li key={row.rule.id} data-archive-ui-permission-rule-id={row.rule.id} style={ROW_STYLE}>
                <span>{row.subjectLabel}</span>
                <span>{row.rule.action}</span>
                <span>{row.rule.effect}</span>
                <button
                  type="button"
                  disabled={revoking}
                  onClick={() => handlers.onRequestRevoke(row.rule)}
                  style={SECONDARY_BUTTON_STYLE}
                >
                  {revoking ? "Revoking…" : "Revoke"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ArchiveUiDestructiveConfirmationDialog
        state={state.revokeConfirmation}
        onConfirm={handlers.onConfirmRevoke}
        onCancel={handlers.onCancelRevoke}
      />
    </div>
  );
}

function renderSetRuleForm(
  targetType: ArchivePermissionTargetType,
  state: ArchivePermissionsScreenState,
  handlers: ArchivePermissionsScreenRenderHandlers,
): ReactElement {
  const actionChoices = archiveUiPermissionActionChoices(targetType);
  const subjectTypeAccessibility = archiveUiFieldAccessibility(SET_RULE_FORM_ID, "subjectType", state.setRuleFieldErrors);
  const subjectIdAccessibility = archiveUiFieldAccessibility(SET_RULE_FORM_ID, "subjectId", state.setRuleFieldErrors);
  const actionAccessibility = archiveUiFieldAccessibility(SET_RULE_FORM_ID, "action", state.setRuleFieldErrors);
  const effectAccessibility = archiveUiFieldAccessibility(SET_RULE_FORM_ID, "effect", state.setRuleFieldErrors);

  const rolesReady = state.rolesState.status === "ready" ? state.rolesState.roles : [];
  const userSubjectDisabled =
    state.setRuleSubjectType !== "user" || state.loadingAssignableMembers || state.assignableMembersFailure !== null;
  const roleSubjectDisabled = state.setRuleSubjectType !== "role" || state.rolesState.status !== "ready";

  return (
    <form
      aria-label="Set a permission rule"
      onSubmit={handlers.onSetRuleSubmit}
      style={FORM_STYLE}
    >
      <div style={FIELD_STYLE}>
        <label id={subjectTypeAccessibility.labelId} htmlFor={subjectTypeAccessibility.fieldId}>
          Subject type
        </label>
        <select
          id={subjectTypeAccessibility.fieldId}
          value={state.setRuleSubjectType}
          aria-describedby={subjectTypeAccessibility.describedBy}
          aria-invalid={subjectTypeAccessibility.invalid}
          onChange={handlers.onSetRuleSubjectTypeChange}
          style={INPUT_STYLE}
        >
          <option value="">Choose…</option>
          <option value="user">Member</option>
          <option value="role">Role</option>
        </select>
        {archiveUiFieldHasError(state.setRuleFieldErrors, "subjectType") ? (
          <p id={subjectTypeAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.setRuleFieldErrors, "subjectType").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={FIELD_STYLE}>
        <label id={subjectIdAccessibility.labelId} htmlFor={subjectIdAccessibility.fieldId}>
          Subject
        </label>
        {state.setRuleSubjectType === "role" ? (
          <select
            id={subjectIdAccessibility.fieldId}
            value={state.setRuleSubjectId}
            aria-describedby={subjectIdAccessibility.describedBy}
            aria-invalid={subjectIdAccessibility.invalid}
            disabled={roleSubjectDisabled}
            onChange={handlers.onSetRuleSubjectIdChange}
            style={INPUT_STYLE}
          >
            <option value="">Choose a role…</option>
            {rolesReady.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={subjectIdAccessibility.fieldId}
            value={state.setRuleSubjectId}
            aria-describedby={subjectIdAccessibility.describedBy}
            aria-invalid={subjectIdAccessibility.invalid}
            disabled={userSubjectDisabled}
            onChange={handlers.onSetRuleSubjectIdChange}
            style={INPUT_STYLE}
          >
            <option value="">Choose a member…</option>
            {(state.assignableMembers ?? []).map((member) => (
              <option key={member.platformUserId} value={member.platformUserId}>
                {member.displayName ?? member.handle ?? member.email ?? "Unresolved user"}
              </option>
            ))}
          </select>
        )}
        {archiveUiFieldHasError(state.setRuleFieldErrors, "subjectId") ? (
          <p id={subjectIdAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.setRuleFieldErrors, "subjectId").join(" ")}
          </p>
        ) : null}
        {state.setRuleSubjectType === "user" && state.assignableMembersFailure !== null ? (
          <p style={MUTED_TEXT_STYLE}>{state.assignableMembersFailure.description}</p>
        ) : null}
        {state.setRuleSubjectType === "role" && state.rolesState.status === "unavailable" ? (
          <p style={MUTED_TEXT_STYLE}>Role list unavailable.</p>
        ) : null}
      </div>
      <div style={FIELD_STYLE}>
        <label id={actionAccessibility.labelId} htmlFor={actionAccessibility.fieldId}>
          Action
        </label>
        <select
          id={actionAccessibility.fieldId}
          value={state.setRuleAction}
          aria-describedby={actionAccessibility.describedBy}
          aria-invalid={actionAccessibility.invalid}
          onChange={handlers.onSetRuleActionChange}
          style={INPUT_STYLE}
        >
          <option value="">Choose…</option>
          {actionChoices.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        {archiveUiFieldHasError(state.setRuleFieldErrors, "action") ? (
          <p id={actionAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.setRuleFieldErrors, "action").join(" ")}
          </p>
        ) : null}
      </div>
      <div style={FIELD_STYLE}>
        <label id={effectAccessibility.labelId} htmlFor={effectAccessibility.fieldId}>
          Effect
        </label>
        <select
          id={effectAccessibility.fieldId}
          value={state.setRuleEffect}
          aria-describedby={effectAccessibility.describedBy}
          aria-invalid={effectAccessibility.invalid}
          onChange={handlers.onSetRuleEffectChange}
          style={INPUT_STYLE}
        >
          <option value="">Choose…</option>
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
        </select>
        {archiveUiFieldHasError(state.setRuleFieldErrors, "effect") ? (
          <p id={effectAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
            {archiveUiFieldMessages(state.setRuleFieldErrors, "effect").join(" ")}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={state.submittingSetRule} style={BUTTON_STYLE}>
        {state.submittingSetRule ? "Saving…" : "Set rule"}
      </button>
    </form>
  );
}

function renderExplanationSection(explanation: ArchivePermissionExplanation): ReactElement {
  const rows = archiveUiBuildExplanationRows(explanation);
  return (
    <div style={PANEL_STYLE}>
      <h2 style={SECTION_HEADING_STYLE}>Effective permissions</h2>
      <ul role="list" aria-label="Effective permission explanation" style={LIST_STYLE}>
        {rows.map((row) => (
          <li key={row.action} data-archive-ui-explained-action={row.action} style={ROW_STYLE}>
            <span>{row.action}</span>
            <span>{row.allowed ? "Allowed" : "Denied"}</span>
            <span>{row.sourceLabel}</span>
            <span>{row.decidingTargetLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderRoleManagementSection(
  bridge: ArchiveUiBridge,
  context: ArchiveContextInput | null,
  state: ArchivePermissionsScreenState,
  handlers: ArchivePermissionsScreenRenderHandlers,
): ReactElement {
  if (state.rolesState.status === "loading") {
    return (
      <div style={PANEL_STYLE}>
        <h2 style={SECTION_HEADING_STYLE}>Role management</h2>
        <p style={MUTED_TEXT_STYLE}>Loading roles…</p>
      </div>
    );
  }
  if (state.rolesState.status === "unavailable") {
    return (
      <div style={PANEL_STYLE} data-archive-ui-role-admin="unavailable">
        <h2 style={SECTION_HEADING_STYLE}>Role management</h2>
        <p role="alert" style={ERROR_TEXT_STYLE}>
          {state.rolesState.presentation.title}
        </p>
        <p style={MUTED_TEXT_STYLE}>{state.rolesState.presentation.description}</p>
      </div>
    );
  }

  const { roles } = state.rolesState;
  const createNameAccessibility = archiveUiFieldAccessibility(CREATE_ROLE_FORM_ID, "name", state.createRoleFieldErrors);
  const renameNameAccessibility = archiveUiFieldAccessibility(RENAME_ROLE_FORM_ID, "name", state.renameRoleFieldErrors);
  const assignMemberAccessibility = archiveUiFieldAccessibility(ASSIGN_FORM_ID, "member", state.assignFieldErrors);

  return (
    <div style={PANEL_STYLE} data-archive-ui-role-admin="ready">
      <h2 style={SECTION_HEADING_STYLE}>Role management</h2>
      <form aria-label="Create a role" onSubmit={handlers.onCreateRoleSubmit} style={FORM_STYLE}>
        <div style={FIELD_STYLE}>
          <label id={createNameAccessibility.labelId} htmlFor={createNameAccessibility.fieldId}>
            New role name
          </label>
          <input
            id={createNameAccessibility.fieldId}
            type="text"
            value={state.createRoleNameDraft}
            aria-describedby={createNameAccessibility.describedBy}
            aria-invalid={createNameAccessibility.invalid}
            onChange={handlers.onCreateRoleNameChange}
            style={INPUT_STYLE}
          />
          {archiveUiFieldHasError(state.createRoleFieldErrors, "name") ? (
            <p id={createNameAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
              {archiveUiFieldMessages(state.createRoleFieldErrors, "name").join(" ")}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={state.creatingRole} style={BUTTON_STYLE}>
          {state.creatingRole ? "Creating…" : "Create role"}
        </button>
      </form>

      {roles.length === 0 ? (
        <p data-archive-ui-roles-empty="true" style={MUTED_TEXT_STYLE}>
          No active roles yet.
        </p>
      ) : (
        <ul role="list" aria-label="Active roles" style={LIST_STYLE}>
          {roles.map((role) => (
            <li key={role.id} data-archive-ui-role-id={role.id} style={ROW_STYLE}>
              <button
                type="button"
                aria-pressed={state.selectedRoleId === role.id}
                onClick={() => handlers.onSelectRole(role.id)}
                style={state.selectedRoleId === role.id ? BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
              >
                {role.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.selectedRoleId !== null ? (
        <div style={PANEL_STYLE} data-archive-ui-selected-role-id={state.selectedRoleId}>
          <form aria-label="Rename role" onSubmit={handlers.onRenameRoleSubmit} style={FORM_STYLE}>
            <div style={FIELD_STYLE}>
              <label id={renameNameAccessibility.labelId} htmlFor={renameNameAccessibility.fieldId}>
                Rename role
              </label>
              <input
                id={renameNameAccessibility.fieldId}
                type="text"
                value={state.renameRoleNameDraft}
                aria-describedby={renameNameAccessibility.describedBy}
                aria-invalid={renameNameAccessibility.invalid}
                onChange={handlers.onRenameRoleNameChange}
                style={INPUT_STYLE}
              />
              {archiveUiFieldHasError(state.renameRoleFieldErrors, "name") ? (
                <p id={renameNameAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
                  {archiveUiFieldMessages(state.renameRoleFieldErrors, "name").join(" ")}
                </p>
              ) : null}
            </div>
            <button type="submit" disabled={state.renamingRole} style={BUTTON_STYLE}>
              {state.renamingRole ? "Renaming…" : "Rename"}
            </button>
          </form>
          <button
            type="button"
            disabled={state.deletingRole}
            onClick={handlers.onRequestDeleteRole}
            style={DANGER_BUTTON_STYLE}
          >
            {state.deletingRole ? "Deleting…" : "Delete role"}
          </button>
          <ArchiveUiDestructiveConfirmationDialog
            state={state.deleteRoleConfirmation}
            onConfirm={handlers.onConfirmDeleteRole}
            onCancel={handlers.onCancelDeleteRole}
          />

          <h3 style={SECTION_HEADING_STYLE}>Assignments</h3>
          <ArchiveUiStatePresentation
            state={
              state.roleAssignmentsState.status === "idle" || state.roleAssignmentsState.status === "loading"
                ? archiveUiViewStateLoading<readonly ArchiveRoleAssignmentSummary[]>()
                : state.roleAssignmentsState.status === "denied"
                  ? archiveUiViewStateDenied<readonly ArchiveRoleAssignmentSummary[]>(state.roleAssignmentsState.presentation)
                  : state.roleAssignmentsState.status === "error"
                    ? archiveUiViewStateError<readonly ArchiveRoleAssignmentSummary[]>(state.roleAssignmentsState.presentation)
                    : archiveUiViewStateReady<readonly ArchiveRoleAssignmentSummary[]>(
                        state.roleAssignmentsState.assignments,
                      )
            }
            loadingCopy={{ title: "Loading assignments…" }}
            emptyCopy={{ title: "No members are assigned to this role." }}
            renderReady={(assignments) => {
              const rows =
                context !== null
                  ? archiveUiBuildRoleAssignmentRows(bridge, context, assignments, state.assignmentIdentityByUserId)
                  : [];
              return (
              <>
                {assignments.length === 0 ? (
                  <p data-archive-ui-assignments-empty="true" style={MUTED_TEXT_STYLE}>
                    No members are assigned to this role.
                  </p>
                ) : (
                  <ul role="list" aria-label="Role assignments" style={LIST_STYLE}>
                    {rows.map((row) => {
                      const unassigning = state.unassigningPlatformUserId === row.assignment.platformUserId;
                      return (
                        <li
                          key={row.assignment.platformUserId}
                          data-archive-ui-assignment-platform-user-id={row.assignment.platformUserId}
                          style={ROW_STYLE}
                        >
                          <span>{row.subjectLabel}</span>
                          <button
                            type="button"
                            disabled={unassigning}
                            onClick={() => handlers.onUnassign(row.assignment.platformUserId)}
                            style={SECONDARY_BUTTON_STYLE}
                          >
                            {unassigning ? "Unassigning…" : "Unassign"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {state.assignmentIdentityFailure !== null ? (
                  <p style={MUTED_TEXT_STYLE}>{state.assignmentIdentityFailure.description}</p>
                ) : null}
              </>
              );
            }}
          />

          <form aria-label="Assign a member" onSubmit={handlers.onAssignSubmit} style={FORM_STYLE}>
            <div style={FIELD_STYLE}>
              <label id={assignMemberAccessibility.labelId} htmlFor={assignMemberAccessibility.fieldId}>
                Assign member
              </label>
              <select
                id={assignMemberAccessibility.fieldId}
                value={state.assignMemberDraft}
                aria-describedby={assignMemberAccessibility.describedBy}
                aria-invalid={assignMemberAccessibility.invalid}
                disabled={state.loadingAssignableMembers || state.assignableMembersFailure !== null}
                onChange={handlers.onAssignMemberChange}
                style={INPUT_STYLE}
              >
                <option value="">Choose a member…</option>
                {(state.assignableMembers ?? []).map((member) => (
                  <option key={member.platformUserId} value={member.platformUserId}>
                    {member.displayName ?? member.handle ?? member.email ?? "Unresolved user"}
                  </option>
                ))}
              </select>
              {archiveUiFieldHasError(state.assignFieldErrors, "member") ? (
                <p id={assignMemberAccessibility.errorId} role="alert" style={ERROR_TEXT_STYLE}>
                  {archiveUiFieldMessages(state.assignFieldErrors, "member").join(" ")}
                </p>
              ) : null}
              {state.assignableMembersFailure !== null ? (
                <p style={MUTED_TEXT_STYLE}>{state.assignableMembersFailure.description}</p>
              ) : null}
            </div>
            <button type="submit" disabled={state.assigningRole} style={BUTTON_STYLE}>
              {state.assigningRole ? "Assigning…" : "Assign"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function renderArchivePermissionsScreen(
  bridge: ArchiveUiBridge,
  state: ArchivePermissionsScreenState,
  targetType: ArchivePermissionTargetType,
  handlers: ArchivePermissionsScreenRenderHandlers,
): ReactElement {
  return (
    <section
      data-archive-ui-screen="permissions"
      aria-labelledby={HEADING_ID}
      style={CONTAINER_STYLE}
    >
      <h1 id={HEADING_ID} style={HEADING_STYLE}>
        Permissions
      </h1>
      <ArchiveUiFeedbackBanner
        state={state.feedback}
        dismissLabel="Dismiss"
        onDismiss={handlers.onDismissFeedback}
      />
      <ArchiveUiStatePresentation
        state={state.viewState}
        loadingCopy={{ title: "Loading permissions…" }}
        emptyCopy={{ title: "No permission data is available." }}
        renderReady={(data) => {
          const rows =
            state.context !== null
              ? archiveUiBuildPermissionRuleRows(
                  bridge,
                  state.context,
                  data.rules,
                  state.identityDisplayByUserId,
                  state.rolesState.status === "ready" ? state.rolesState.roles : [],
                )
              : [];
          return (
            <>
              {renderPermissionRulesSection(rows, state, handlers)}
              {state.ruleIdentityFailure !== null ? (
                <p style={MUTED_TEXT_STYLE}>{state.ruleIdentityFailure.description}</p>
              ) : null}
              {renderSetRuleForm(targetType, state, handlers)}
              {renderExplanationSection(data.explanation)}
              {renderRoleManagementSection(bridge, state.context, state, handlers)}
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

export interface ArchivePermissionsScreenProps {
  readonly bridge: ArchiveUiBridge;
  readonly target: ArchiveAuthorizationTargetInput;
}

interface ArchivePermissionsScreenState {
  readonly context: ArchiveContextInput | null;
  readonly viewState: ArchiveUiViewState<ArchivePermissionsScreenData>;
  readonly feedback: ArchiveUiFeedbackState;

  readonly rolesState: ArchiveUiRoleAdminState;

  readonly identityDisplayByUserId: Readonly<Record<string, ArchiveUiPlatformUserDisplay>>;
  readonly ruleIdentityFailure: ArchiveUiIdentityFailure | null;

  readonly setRuleSubjectType: "" | ArchivePermissionSubjectType;
  readonly setRuleSubjectId: string;
  readonly setRuleAction: string;
  readonly setRuleEffect: "" | ArchivePermissionEffect;
  readonly setRuleFieldErrors: ArchiveUiFieldErrorMap;
  readonly submittingSetRule: boolean;

  readonly revokeConfirmation: ArchiveUiConfirmationState;
  readonly revokeTarget: ArchivePermission | null;
  readonly revokingRuleId: string | null;

  readonly assignableMembers: readonly ArchiveUiPlatformUserDisplay[] | null;
  readonly loadingAssignableMembers: boolean;
  readonly assignableMembersFailure: ArchiveUiIdentityFailure | null;

  readonly createRoleNameDraft: string;
  readonly createRoleFieldErrors: ArchiveUiFieldErrorMap;
  readonly creatingRole: boolean;

  readonly selectedRoleId: string | null;
  readonly renameRoleNameDraft: string;
  readonly renameRoleFieldErrors: ArchiveUiFieldErrorMap;
  readonly renamingRole: boolean;

  readonly deleteRoleConfirmation: ArchiveUiConfirmationState;
  // Card scope "Freeze the destructive delete target" (repair 1): the exact
  // role id/human name captured when delete confirmation is REQUESTED —
  // `handleConfirmDeleteRole` deletes THIS id, never `state.selectedRoleId`
  // read at confirm time, so selecting a different role while the dialog is
  // open can never redirect the destructive action.
  readonly deleteRoleTarget: { readonly roleId: string; readonly name: string } | null;
  readonly deletingRole: boolean;

  readonly roleAssignmentsState: ArchiveUiRoleAssignmentsState;
  readonly assignmentIdentityByUserId: Readonly<Record<string, ArchiveUiPlatformUserDisplay>>;
  readonly assignmentIdentityFailure: ArchiveUiIdentityFailure | null;

  readonly assignMemberDraft: string;
  readonly assignFieldErrors: ArchiveUiFieldErrorMap;
  readonly assigningRole: boolean;

  readonly unassigningPlatformUserId: string | null;
}

function archiveUiInitialPermissionsScreenState(): ArchivePermissionsScreenState {
  return {
    context: null,
    viewState: archiveUiViewStateLoading(),
    feedback: archiveUiFeedbackIdle(),
    rolesState: { status: "loading" },
    identityDisplayByUserId: {},
    ruleIdentityFailure: null,
    setRuleSubjectType: "",
    setRuleSubjectId: "",
    setRuleAction: "",
    setRuleEffect: "",
    setRuleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    submittingSetRule: false,
    revokeConfirmation: archiveUiConfirmationIdle(),
    revokeTarget: null,
    revokingRuleId: null,
    assignableMembers: null,
    loadingAssignableMembers: false,
    assignableMembersFailure: null,
    createRoleNameDraft: "",
    createRoleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    creatingRole: false,
    selectedRoleId: null,
    renameRoleNameDraft: "",
    renameRoleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    renamingRole: false,
    deleteRoleConfirmation: archiveUiConfirmationIdle(),
    deleteRoleTarget: null,
    deletingRole: false,
    roleAssignmentsState: { status: "idle" },
    assignmentIdentityByUserId: {},
    assignmentIdentityFailure: null,
    assignMemberDraft: "",
    assignFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    assigningRole: false,
    unassigningPlatformUserId: null,
  };
}

// The Archive module permission-management, role-management, and
// role-assignment screen (Correction Phase 6 TASK-08). A host mounts this
// with the real `ArchiveUiBridge` implementation and one real Archive
// authorization target; it owns its own capability-preflight/rule/
// explanation/role-administration/role-assignment lifecycle end to end. See
// the file-top HOOK-CALL CONSTRAINT note for why this is a class component.
export class ArchivePermissionsScreen extends React.Component<
  ArchivePermissionsScreenProps,
  ArchivePermissionsScreenState
> {
  // Card scope "Async consistency": PRIVATE monotonic instance counters (the
  // TASK-07 search-screen pattern, NOT the history-screen's
  // `state.requestSeq`) — deliberately not derived from state so a response
  // from an older generation can never overwrite newer state, independent of
  // any `setState` batching behavior.
  //
  // TASK-08-REPAIR-R1 (defect 3): `loadCounter` and `ruleReadCounter` are
  // deliberately SEPARATE generations. `loadCounter` guards only the
  // optional role-administration read (`loadRoleAdministration`) and is
  // bumped by every full-load stage (`runInitialLoad`, `refreshRolesAndRules`).
  // `ruleReadCounter` guards the required permission-rule/explanation read
  // (`loadRulesAndExplanation`) and its identity enrichment
  // (`resolveRuleIdentities`); it is bumped by every rule-read stage
  // (`runInitialLoad`, `refreshRolesAndRules`, AND `refreshRulesOnly`). Because
  // `refreshRulesOnly` bumps ONLY `ruleReadCounter`, a rule-only refresh can
  // never cancel an unrelated in-flight `loadRoleAdministration` read guarded
  // by `loadCounter`.
  private loadCounter = 0;
  private ruleReadCounter = 0;
  private assignmentCounter = 0;
  // TASK-08-REPAIR-R1 (defect 5): a narrow, separate generation for the
  // assignable-member directory request, so a newer `runInitialLoad` can
  // invalidate a pending member request/cache without disturbing the
  // unrelated `loadCounter`/`ruleReadCounter`/`assignmentCounter` generations.
  private memberCounter = 0;

  constructor(props: ArchivePermissionsScreenProps) {
    super(props);
    this.state = archiveUiInitialPermissionsScreenState();
    this.handleDismissFeedback = this.handleDismissFeedback.bind(this);
    this.handleSetRuleSubjectTypeChange = this.handleSetRuleSubjectTypeChange.bind(this);
    this.handleSetRuleSubjectIdChange = this.handleSetRuleSubjectIdChange.bind(this);
    this.handleSetRuleActionChange = this.handleSetRuleActionChange.bind(this);
    this.handleSetRuleEffectChange = this.handleSetRuleEffectChange.bind(this);
    this.handleSetRuleSubmit = this.handleSetRuleSubmit.bind(this);
    this.handleRequestRevoke = this.handleRequestRevoke.bind(this);
    this.handleCancelRevoke = this.handleCancelRevoke.bind(this);
    this.handleConfirmRevoke = this.handleConfirmRevoke.bind(this);
    this.handleCreateRoleNameChange = this.handleCreateRoleNameChange.bind(this);
    this.handleCreateRoleSubmit = this.handleCreateRoleSubmit.bind(this);
    this.handleSelectRole = this.handleSelectRole.bind(this);
    this.handleRenameRoleNameChange = this.handleRenameRoleNameChange.bind(this);
    this.handleRenameRoleSubmit = this.handleRenameRoleSubmit.bind(this);
    this.handleRequestDeleteRole = this.handleRequestDeleteRole.bind(this);
    this.handleCancelDeleteRole = this.handleCancelDeleteRole.bind(this);
    this.handleConfirmDeleteRole = this.handleConfirmDeleteRole.bind(this);
    this.handleAssignMemberChange = this.handleAssignMemberChange.bind(this);
    this.handleAssignSubmit = this.handleAssignSubmit.bind(this);
    this.handleUnassign = this.handleUnassign.bind(this);
  }

  componentDidMount(): void {
    void this.runInitialLoad();
  }

  // Not marked `private`: intentionally callable directly by focused tests
  // (the same method `componentDidMount` calls above), so the real mount-time
  // wiring is provable without a DOM renderer.
  async runInitialLoad(): Promise<void> {
    const context = this.props.bridge.getContext();
    const seq = ++this.loadCounter;
    const ruleSeq = ++this.ruleReadCounter;
    // Card scope "generation-scoped assignable-member cache" (repair 5): a
    // fresh full-load generation invalidates any pending member request
    // BEFORE it can apply, and the stale cache/failure/loading state below is
    // cleared in the SAME setState as every other full-load reset.
    ++this.memberCounter;
    // CHALLENGER-FOUND DEFECT FIX (repair 3/5): a full initial load/reload
    // must invalidate EVERY older full-load stage, including a still-pending
    // selected-role assignment read (and its identity enrichment) from the
    // PRIOR context/generation — otherwise a pre-reload `runAssignmentLoad`
    // resolving late can still pass its own `assignmentCounter` guard and
    // apply prior-context assignment/identity data into the freshly reset
    // state below. Bumping here BEFORE the reset `setState` mirrors the same
    // invalidate-before-clear ordering already used in
    // `loadRoleAdministration`'s vanished-selection repair.
    ++this.assignmentCounter;
    this.setState({
      context,
      viewState: archiveUiViewStateLoading(),
      rolesState: { status: "loading" },
      identityDisplayByUserId: {},
      ruleIdentityFailure: null,
      selectedRoleId: null,
      roleAssignmentsState: { status: "idle" },
      assignmentIdentityByUserId: {},
      assignmentIdentityFailure: null,
      assignableMembers: null,
      loadingAssignableMembers: false,
      assignableMembersFailure: null,
    });

    // Card scope "Stage 1 — capability preflight": the ONLY call before
    // authorization succeeds.
    const capabilitiesResult = await this.props.bridge.service.getEffectiveCapabilities(context, this.props.target);
    if (seq !== this.loadCounter) return;

    if (!capabilitiesResult.ok) {
      const presentation = this.props.bridge.translateError(capabilitiesResult.error);
      this.setState({
        viewState:
          capabilitiesResult.error.category === "unauthorized"
            ? archiveUiViewStateDenied(presentation)
            : archiveUiViewStateError(presentation),
      });
      return;
    }

    if (!capabilitiesResult.value.manage_permissions.allowed) {
      // Card scope "denied preflight causes zero rule/explanation/role/
      // identity reads": return here, calling nothing further.
      this.setState({ viewState: archiveUiViewStateDenied(ARCHIVE_PERMISSIONS_SCREEN_DENIED_PRESENTATION) });
      return;
    }

    await Promise.all([this.loadRulesAndExplanation(ruleSeq, context), this.loadRoleAdministration(seq, context)]);
  }

  // Card scope "Stage 2 — required permission reads" + "Stage 4 — identity
  // enrichment". Not marked `private`: callable directly by focused
  // refresh-after-mutation proofs.
  async loadRulesAndExplanation(seq: number, context: ArchiveContextInput): Promise<void> {
    const [rulesResult, explanationResult] = await Promise.all([
      this.props.bridge.service.listPermissionRules(context, this.props.target),
      this.props.bridge.service.explainPermissions(context, this.props.target),
    ]);
    // TASK-08-REPAIR-R1 (defect 3): guarded by `ruleReadCounter`, the
    // permission-read generation — NOT `loadCounter` — so this required read
    // is invalidated only by a newer rule read (full load, combined
    // roles+rules refresh, or a rules-only refresh), never by an unrelated
    // role-list-only guard.
    if (seq !== this.ruleReadCounter) return;

    // Unauthorized-first precedence, independent of which read failed.
    if (!rulesResult.ok && rulesResult.error.category === "unauthorized") {
      this.setState({ viewState: archiveUiViewStateDenied(this.props.bridge.translateError(rulesResult.error)) });
      return;
    }
    if (!explanationResult.ok && explanationResult.error.category === "unauthorized") {
      this.setState({ viewState: archiveUiViewStateDenied(this.props.bridge.translateError(explanationResult.error)) });
      return;
    }
    // Deterministic first-failure-in-order selection for any remaining
    // (non-unauthorized) failure.
    if (!rulesResult.ok) {
      this.setState({ viewState: archiveUiViewStateError(this.props.bridge.translateError(rulesResult.error)) });
      return;
    }
    if (!explanationResult.ok) {
      this.setState({ viewState: archiveUiViewStateError(this.props.bridge.translateError(explanationResult.error)) });
      return;
    }

    const data: ArchivePermissionsScreenData = { rules: rulesResult.value, explanation: explanationResult.value };
    // Card scope "snapshot-scoped identity data" (repair 4): every newly
    // accepted rules snapshot clears the identity map/failure BEFORE
    // enrichment — an empty-id snapshot leaves both cleared with no further
    // write, and a formerly resolved id omitted by THIS snapshot's identity
    // result can never keep rendering its old cached label.
    this.setState({
      viewState: archiveUiViewStateReady(data),
      identityDisplayByUserId: {},
      ruleIdentityFailure: null,
    });
    void this.resolveRuleIdentities(seq, context, rulesResult.value);
  }

  // Card scope "Stage 3 — optional namespace role administration read": a
  // separate, non-fatal call whose failure never discards the permission
  // data loaded above.
  async loadRoleAdministration(seq: number, context: ArchiveContextInput): Promise<void> {
    const result = await this.props.bridge.service.listArchiveRoles(context);
    if (seq !== this.loadCounter) return;

    if (!result.ok) {
      this.setState({ rolesState: { status: "unavailable", presentation: this.props.bridge.translateError(result.error) } });
      return;
    }
    this.setState((prev) => {
      const stillExists = prev.selectedRoleId !== null && result.value.some((role) => role.id === prev.selectedRoleId);
      // Card scope "When a role-list refresh removes the selected role,
      // invalidate any pending assignment generation BEFORE clearing the
      // selected-role state" (repair 2, last paragraph): bumping
      // `assignmentCounter` here — before this same update clears
      // `selectedRoleId` — guarantees a still-in-flight `runAssignmentLoad`
      // for the vanished role can never apply once it later resolves.
      if (!stillExists && prev.selectedRoleId !== null) {
        ++this.assignmentCounter;
      }
      return {
        rolesState: { status: "ready", roles: result.value },
        selectedRoleId: stillExists ? prev.selectedRoleId : null,
        roleAssignmentsState: stillExists ? prev.roleAssignmentsState : { status: "idle" },
        assignmentIdentityByUserId: stillExists ? prev.assignmentIdentityByUserId : {},
        assignmentIdentityFailure: stillExists ? prev.assignmentIdentityFailure : null,
      };
    });
  }

  async resolveRuleIdentities(
    seq: number,
    context: ArchiveContextInput,
    rules: readonly ArchivePermission[],
  ): Promise<void> {
    const ids = archiveUiUniqueUserSubjectIds(rules);
    // The caller already cleared `identityDisplayByUserId`/`ruleIdentityFailure`
    // for this snapshot; an empty-id snapshot needs no further write.
    if (ids.length === 0) return;
    const result = await this.props.bridge.identity.resolvePlatformUsers(ids);
    // Guarded by `ruleReadCounter` (the same generation `loadRulesAndExplanation`
    // used to accept this exact rules snapshot) — never `loadCounter` — so an
    // older rule-identity response can never attach to a newer rules snapshot.
    if (seq !== this.ruleReadCounter) return;
    if (!result.ok) {
      this.setState({ ruleIdentityFailure: result.failure });
      return;
    }
    this.setState((prev) => ({
      identityDisplayByUserId: archiveUiMergeIdentityDisplays(prev.identityDisplayByUserId, result.value, ids),
      ruleIdentityFailure: null,
    }));
  }

  // Card scope "refresh rules and explanation after success" (set-rule /
  // revoke). TASK-08-REPAIR-R1 (defect 3): bumps ONLY `ruleReadCounter` —
  // deliberately NOT `loadCounter` — so this rule-only refresh invalidates
  // any still-running older rule read/identity enrichment WITHOUT cancelling
  // the unrelated, currently-optional in-flight `loadRoleAdministration` read.
  async refreshRulesOnly(): Promise<void> {
    const context = this.state.context;
    if (context === null) return;
    const seq = ++this.ruleReadCounter;
    await this.loadRulesAndExplanation(seq, context);
  }

  // Card scope "After create/rename/delete: refresh the active role list;
  // refresh permission rules/explanation". Bumps BOTH generations so this
  // combined refresh stays coherent and invalidates older full-load work on
  // both the role-list and rule-read sides.
  async refreshRolesAndRules(): Promise<void> {
    const context = this.state.context;
    if (context === null) return;
    const seq = ++this.loadCounter;
    const ruleSeq = ++this.ruleReadCounter;
    await Promise.all([this.loadRoleAdministration(seq, context), this.loadRulesAndExplanation(ruleSeq, context)]);
  }

  ensureAssignableMembersLoaded(): void {
    if (this.state.assignableMembers !== null || this.state.loadingAssignableMembers) return;
    void this.loadAssignableMembers();
  }

  async loadAssignableMembers(): Promise<void> {
    // Card scope "generation-scoped assignable-member cache" (repair 5): a
    // late response from an older full-load generation must never apply — a
    // newer `runInitialLoad` bumps `memberCounter` before this request's
    // result can arrive, so the guard below discards it.
    const seq = ++this.memberCounter;
    this.setState({ loadingAssignableMembers: true });
    const result = await this.props.bridge.identity.listAssignableCompanyMembers();
    if (seq !== this.memberCounter) return;
    if (!result.ok) {
      this.setState({ loadingAssignableMembers: false, assignableMembersFailure: result.failure });
      return;
    }
    this.setState({ loadingAssignableMembers: false, assignableMembers: result.value, assignableMembersFailure: null });
  }

  // Card scope "selected-role assignment loading is lazy, not N+1" +
  // "When a role is changed while its assignment request is pending, the
  // stale response must be ignored" — `assignmentCounter` guards both.
  async runAssignmentLoad(roleId: string): Promise<void> {
    const context = this.state.context;
    if (context === null) return;
    const seq = ++this.assignmentCounter;
    this.setState({ roleAssignmentsState: { status: "loading" } });
    const result = await this.props.bridge.service.listArchiveRoleAssignmentsForRole(context, roleId);
    if (seq !== this.assignmentCounter) return;

    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        roleAssignmentsState:
          result.error.category === "unauthorized" ? { status: "denied", presentation } : { status: "error", presentation },
      });
      return;
    }
    // Card scope "snapshot-scoped identity data" (repair 4): every newly
    // accepted assignment snapshot clears the identity map/failure BEFORE
    // enrichment, exactly like `loadRulesAndExplanation` above.
    this.setState({
      roleAssignmentsState: { status: "ready", assignments: result.value },
      assignmentIdentityByUserId: {},
      assignmentIdentityFailure: null,
    });
    void this.resolveAssignmentIdentities(seq, result.value);
  }

  // Card scope "Assignment identity behavior": builds/merges the shared
  // identity display cache only — row projection for rendering is computed
  // at render time (see `renderRoleManagementSection`) directly from
  // `roleAssignmentsState`/`assignmentIdentityByUserId` so a slower identity
  // resolution can never leave the visible assignment LIST briefly out of
  // sync with the already-ready `roleAssignmentsState` (a real assignment
  // count never renders as though it were empty while identities are still
  // resolving).
  async resolveAssignmentIdentities(
    seq: number,
    assignments: readonly ArchiveRoleAssignmentSummary[],
  ): Promise<void> {
    const ids = archiveUiUniqueAssignmentPlatformUserIds(assignments);
    // The caller already cleared `assignmentIdentityByUserId`/
    // `assignmentIdentityFailure` for this snapshot; an empty-id snapshot
    // needs no further write.
    if (ids.length === 0) return;
    const result = await this.props.bridge.identity.resolvePlatformUsers(ids);
    // Guarded by `assignmentCounter` — an older assignment-identity response
    // can never attach to a newer assignment snapshot (across a role switch
    // OR a same-role reload).
    if (seq !== this.assignmentCounter) return;
    if (!result.ok) {
      this.setState({ assignmentIdentityFailure: result.failure });
      return;
    }
    this.setState((prev) => ({
      assignmentIdentityByUserId: archiveUiMergeIdentityDisplays(prev.assignmentIdentityByUserId, result.value, ids),
      assignmentIdentityFailure: null,
    }));
  }

  private currentRoleName(roleId: string): string | null {
    if (this.state.rolesState.status !== "ready") return null;
    return this.state.rolesState.roles.find((role) => role.id === roleId)?.name ?? null;
  }

  private rolesForValidation(): readonly ArchiveRoleSummary[] {
    return this.state.rolesState.status === "ready" ? this.state.rolesState.roles : [];
  }

  private subjectLabelForRule(rule: ArchivePermission): string {
    if (this.state.context === null) {
      return rule.subjectType === "role" ? "Unresolved role" : "Unresolved user";
    }
    if (rule.subjectType === "role") {
      return archiveUiPermissionsRoleSubjectDisplay(this.rolesForValidation(), rule.subjectId);
    }
    return archiveUiPermissionsSubjectDisplay(
      this.props.bridge,
      this.state.context,
      rule.subjectId,
      this.state.identityDisplayByUserId[rule.subjectId],
    );
  }

  handleDismissFeedback(): void {
    this.setState({ feedback: archiveUiFeedbackDismiss(this.state.feedback) });
  }

  handleSetRuleSubjectTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    this.setState({
      setRuleSubjectType: value === "user" || value === "role" ? value : "",
      setRuleSubjectId: "",
      setRuleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
    });
    if (value === "user") this.ensureAssignableMembersLoaded();
  }

  handleSetRuleSubjectIdChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ setRuleSubjectId: event.target.value });
  }

  handleSetRuleActionChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ setRuleAction: event.target.value });
  }

  handleSetRuleEffectChange(event: ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    this.setState({ setRuleEffect: value === "allow" || value === "deny" ? value : "" });
  }

  handleSetRuleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (this.state.submittingSetRule) return;
    const outcome = archiveUiValidateSetRuleDraft(
      {
        subjectType: this.state.setRuleSubjectType,
        subjectId: this.state.setRuleSubjectId,
        action: this.state.setRuleAction,
        effect: this.state.setRuleEffect,
      },
      this.props.target.targetType,
      this.rolesForValidation(),
      this.state.assignableMembers ?? [],
    );
    if (outcome.kind === "invalid") {
      this.setState({ setRuleFieldErrors: outcome.fieldErrors });
      return;
    }
    this.setState({ setRuleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP, submittingSetRule: true });
    void this.submitSetRule(outcome.value);
  }

  async submitSetRule(input: ArchiveUiValidatedSetRuleInput): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ submittingSetRule: false });
      return;
    }
    const result = await this.props.bridge.service.setPermissionRule(context, {
      targetType: this.props.target.targetType,
      targetId: this.props.target.targetId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      action: input.action,
      effect: input.effect,
    });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        submittingSetRule: false,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    this.setState({
      submittingSetRule: false,
      setRuleSubjectType: "",
      setRuleSubjectId: "",
      setRuleAction: "",
      setRuleEffect: "",
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Permission rule saved." }),
    });
    void this.refreshRulesOnly();
  }

  handleRequestRevoke(rule: ArchivePermission): void {
    this.setState({
      revokeTarget: rule,
      revokeConfirmation: archiveUiConfirmationRequest({
        actionLabel: "Revoke",
        subjectLabel: `${this.subjectLabelForRule(rule)} — ${rule.action} (${rule.effect})`,
      }),
    });
  }

  handleCancelRevoke(): void {
    this.setState({ revokeConfirmation: archiveUiConfirmationCancel(), revokeTarget: null });
  }

  handleConfirmRevoke(): void {
    const rule = this.state.revokeTarget;
    if (rule === null) return;
    if (this.state.revokingRuleId === rule.id) return;
    this.setState({ revokingRuleId: rule.id, revokeConfirmation: archiveUiConfirmationCancel() });
    void this.submitRevoke(rule);
  }

  async submitRevoke(rule: ArchivePermission): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ revokingRuleId: null, revokeTarget: null });
      return;
    }
    const result = await this.props.bridge.service.revokePermissionRule(context, {
      targetType: rule.targetType,
      targetId: rule.targetId,
      subjectType: rule.subjectType,
      subjectId: rule.subjectId,
      action: rule.action,
    });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        revokingRuleId: null,
        revokeTarget: null,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    // Card scope "A null/no-op result is a controlled success state.": both
    // an actual revoked row and a null no-op reach this same branch.
    this.setState({
      revokingRuleId: null,
      revokeTarget: null,
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Permission rule revoked." }),
    });
    void this.refreshRulesOnly();
  }

  handleCreateRoleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ createRoleNameDraft: event.target.value });
  }

  handleCreateRoleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (this.state.creatingRole) return;
    const trimmed = this.state.createRoleNameDraft.trim();
    if (trimmed.length === 0) {
      this.setState({
        createRoleFieldErrors: archiveUiFieldErrorMapFromEntries([{ field: "name", message: "Enter a role name." }]),
      });
      return;
    }
    this.setState({ createRoleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP, creatingRole: true });
    void this.submitCreateRole(trimmed);
  }

  async submitCreateRole(name: string): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ creatingRole: false });
      return;
    }
    const result = await this.props.bridge.service.createArchiveRole(context, { name });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        creatingRole: false,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    this.setState({
      creatingRole: false,
      createRoleNameDraft: "",
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Role created." }),
    });
    void this.refreshRolesAndRules();
  }

  handleSelectRole(roleId: string): void {
    if (this.state.selectedRoleId === roleId) return;
    this.setState({
      selectedRoleId: roleId,
      renameRoleNameDraft: this.currentRoleName(roleId) ?? "",
      renameRoleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
      assignMemberDraft: "",
      assignFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP,
      assignmentIdentityByUserId: {},
      assignmentIdentityFailure: null,
    });
    this.ensureAssignableMembersLoaded();
    void this.runAssignmentLoad(roleId);
  }

  handleRenameRoleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ renameRoleNameDraft: event.target.value });
  }

  handleRenameRoleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (this.state.renamingRole) return;
    const roleId = this.state.selectedRoleId;
    if (roleId === null) return;
    const trimmed = this.state.renameRoleNameDraft.trim();
    if (trimmed.length === 0) {
      this.setState({
        renameRoleFieldErrors: archiveUiFieldErrorMapFromEntries([{ field: "name", message: "Enter a role name." }]),
      });
      return;
    }
    this.setState({ renameRoleFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP, renamingRole: true });
    void this.submitRenameRole(roleId, trimmed);
  }

  async submitRenameRole(roleId: string, name: string): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ renamingRole: false });
      return;
    }
    const result = await this.props.bridge.service.renameArchiveRole(context, { roleId, name });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        renamingRole: false,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    this.setState({
      renamingRole: false,
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Role renamed." }),
    });
    void this.refreshRolesAndRules();
  }

  handleRequestDeleteRole(): void {
    const roleId = this.state.selectedRoleId;
    if (roleId === null) return;
    const name = this.currentRoleName(roleId) ?? "this role";
    // Card scope "Freeze the destructive delete target" (repair 1): capture
    // the exact role id/human name NOW, at request time. Selecting a
    // different role while this dialog is open must never alter
    // `deleteRoleTarget` — only `handleRequestDeleteRole`,
    // `handleCancelDeleteRole`, and `submitDeleteRole`'s completion may write
    // it.
    this.setState({
      deleteRoleTarget: { roleId, name },
      deleteRoleConfirmation: archiveUiConfirmationRequest({ actionLabel: "Delete role", subjectLabel: `role "${name}"` }),
    });
  }

  handleCancelDeleteRole(): void {
    this.setState({ deleteRoleConfirmation: archiveUiConfirmationCancel(), deleteRoleTarget: null });
  }

  handleConfirmDeleteRole(): void {
    // Card scope "Confirm deletes the captured role id, never the current
    // selection" (repair 1): reads the FROZEN `deleteRoleTarget`, never
    // `state.selectedRoleId`.
    const target = this.state.deleteRoleTarget;
    if (target === null || this.state.deletingRole) return;
    this.setState({ deletingRole: true, deleteRoleConfirmation: archiveUiConfirmationCancel() });
    void this.submitDeleteRole(target.roleId);
  }

  async submitDeleteRole(roleId: string): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ deletingRole: false, deleteRoleTarget: null });
      return;
    }
    const result = await this.props.bridge.service.deleteArchiveRole(context, { roleId });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        deletingRole: false,
        deleteRoleTarget: null,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    // Card scope "a semantic no-op returning null" is a controlled success
    // here too.
    this.setState({
      deletingRole: false,
      deleteRoleTarget: null,
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Role deleted." }),
    });
    void this.refreshRolesAndRules();
  }

  handleAssignMemberChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.setState({ assignMemberDraft: event.target.value });
  }

  handleAssignSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (this.state.assigningRole) return;
    const roleId = this.state.selectedRoleId;
    if (roleId === null) return;
    const platformUserId = this.state.assignMemberDraft;
    const validMember = (this.state.assignableMembers ?? []).some((member) => member.platformUserId === platformUserId);
    if (!validMember) {
      this.setState({
        assignFieldErrors: archiveUiFieldErrorMapFromEntries([{ field: "member", message: "Choose a member." }]),
      });
      return;
    }
    this.setState({ assignFieldErrors: ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP, assigningRole: true });
    void this.submitAssign(roleId, platformUserId);
  }

  async submitAssign(roleId: string, platformUserId: string): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ assigningRole: false });
      return;
    }
    const result = await this.props.bridge.service.assignArchiveRole(context, { roleId, platformUserId });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        assigningRole: false,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    this.setState({
      assigningRole: false,
      assignMemberDraft: "",
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Member assigned." }),
    });
    // Card scope "Keep assignment refresh aligned with the current selection"
    // (repair 2): refresh `roleId`'s assignments only when it is STILL the
    // current selection at completion time. If the user selected a
    // different role while this mutation was pending, do not start a new
    // request for the old role and do not touch the newer role's assignment
    // state — success feedback above is still shown regardless.
    if (this.state.selectedRoleId === roleId) {
      void this.runAssignmentLoad(roleId);
    }
  }

  handleUnassign(platformUserId: string): void {
    const roleId = this.state.selectedRoleId;
    if (roleId === null) return;
    if (this.state.unassigningPlatformUserId === platformUserId) return;
    this.setState({ unassigningPlatformUserId: platformUserId });
    void this.submitUnassign(roleId, platformUserId);
  }

  async submitUnassign(roleId: string, platformUserId: string): Promise<void> {
    const context = this.state.context;
    if (context === null) {
      this.setState({ unassigningPlatformUserId: null });
      return;
    }
    const result = await this.props.bridge.service.unassignArchiveRole(context, { roleId, platformUserId });
    if (!result.ok) {
      const presentation = this.props.bridge.translateError(result.error);
      this.setState({
        unassigningPlatformUserId: null,
        feedback: archiveUiFeedbackShow({ intent: "failure", title: presentation.title, description: presentation.description }),
      });
      return;
    }
    // Card scope "a semantic no-op" is a controlled success here too.
    this.setState({
      unassigningPlatformUserId: null,
      feedback: archiveUiFeedbackShow({ intent: "success", title: "Member unassigned." }),
    });
    // Card scope "Keep assignment refresh aligned with the current selection"
    // (repair 2): same alignment check as `submitAssign` above.
    if (this.state.selectedRoleId === roleId) {
      void this.runAssignmentLoad(roleId);
    }
  }

  render(): ReactElement {
    return renderArchivePermissionsScreen(this.props.bridge, this.state, this.props.target.targetType, {
      onDismissFeedback: this.handleDismissFeedback,
      onSetRuleSubjectTypeChange: this.handleSetRuleSubjectTypeChange,
      onSetRuleSubjectIdChange: this.handleSetRuleSubjectIdChange,
      onSetRuleActionChange: this.handleSetRuleActionChange,
      onSetRuleEffectChange: this.handleSetRuleEffectChange,
      onSetRuleSubmit: this.handleSetRuleSubmit,
      onRequestRevoke: this.handleRequestRevoke,
      onCancelRevoke: this.handleCancelRevoke,
      onConfirmRevoke: this.handleConfirmRevoke,
      onCreateRoleNameChange: this.handleCreateRoleNameChange,
      onCreateRoleSubmit: this.handleCreateRoleSubmit,
      onSelectRole: this.handleSelectRole,
      onRenameRoleNameChange: this.handleRenameRoleNameChange,
      onRenameRoleSubmit: this.handleRenameRoleSubmit,
      onRequestDeleteRole: this.handleRequestDeleteRole,
      onCancelDeleteRole: this.handleCancelDeleteRole,
      onConfirmDeleteRole: this.handleConfirmDeleteRole,
      onAssignMemberChange: this.handleAssignMemberChange,
      onAssignSubmit: this.handleAssignSubmit,
      onUnassign: this.handleUnassign,
    });
  }
}
