// Archive UI field-level validation primitives — Correction Phase 6 TASK-03
// (A-UI-FORM-001). Types/helpers only, suitable for later forms — no actual
// folder/item/file form is implemented by this task. Client-side validation
// here is presentation layering ONLY; server validation results remain
// authoritative and are represented through the exact same field-error shape
// so a screen can merge both without inventing a second error format.

// A field name maps to zero or more human-readable messages (zero messages
// means the field currently has no error).
export type ArchiveUiFieldErrorMap = Readonly<Record<string, readonly string[]>>;

export interface ArchiveUiFieldErrorEntry {
  readonly field: string;
  readonly message: string;
}

export const ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP: ArchiveUiFieldErrorMap = {};

// Builds a field-error map from a flat list of (field, message) entries.
// Multiple entries for the same field accumulate in encounter order.
export function archiveUiFieldErrorMapFromEntries(
  entries: readonly ArchiveUiFieldErrorEntry[],
): ArchiveUiFieldErrorMap {
  const map: Record<string, string[]> = {};
  for (const entry of entries) {
    const existing = map[entry.field];
    if (existing === undefined) {
      map[entry.field] = [entry.message];
    } else {
      existing.push(entry.message);
    }
  }
  return map;
}

export function archiveUiFieldHasError(
  errors: ArchiveUiFieldErrorMap,
  field: string,
): boolean {
  return (errors[field]?.length ?? 0) > 0;
}

export function archiveUiFieldMessages(
  errors: ArchiveUiFieldErrorMap,
  field: string,
): readonly string[] {
  return errors[field] ?? [];
}

export function archiveUiHasAnyFieldError(errors: ArchiveUiFieldErrorMap): boolean {
  return Object.values(errors).some((messages) => messages.length > 0);
}

// -----------------------------------------------------------------------
// Accessible presentation metadata: stable ids for label/control/error
// association (e.g. `<label id=labelId htmlFor=fieldId>` / `<input
// id=fieldId aria-describedby=describedBy>` / `<p id=errorId>`), derived
// deterministically from a form id + field name so the same inputs always
// produce the same ids across renders.
// -----------------------------------------------------------------------

export interface ArchiveUiFieldAccessibility {
  readonly fieldId: string;
  readonly labelId: string;
  readonly errorId: string;
  // `aria-describedby` value: the error id when the field currently has an
  // error, `undefined` otherwise (so a control never references a
  // nonexistent/empty error element).
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
}

export function archiveUiFieldAccessibility(
  formId: string,
  field: string,
  errors: ArchiveUiFieldErrorMap,
): ArchiveUiFieldAccessibility {
  const fieldId = `${formId}-${field}`;
  const errorId = `${fieldId}-error`;
  const invalid = archiveUiFieldHasError(errors, field);
  return {
    fieldId,
    labelId: `${fieldId}-label`,
    errorId,
    describedBy: invalid ? errorId : undefined,
    invalid,
  };
}
