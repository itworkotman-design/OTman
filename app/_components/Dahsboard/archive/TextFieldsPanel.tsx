"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { RichTextEditorField } from "@/app/_components/Dahsboard/RichTextEditorField";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export type ArchiveTextFieldRow = {
  id: string;
  label: string;
  value: string;
};

type PendingField = { tempId: string; label: string; value: string };
type PendingEdit = { label: string; value: string };

export type TextFieldsPanelHandle = {
  // Takes the section's real id as a call-time argument rather than reading
  // the `sectionId` prop, so ContentSectionList can flush a section that was
  // just created (a pending section has no real id until Save's first
  // phase creates it) without needing a prop update to land first — and
  // without ever changing this component's `key`, which would remount it
  // and lose any other staged state.
  flushPendingChanges: (sectionId: string) => Promise<void>;
};

type TextFieldsPanelProps = {
  // `null` means this is a not-yet-created (pending) section — see
  // ContentSectionList's staging model. There is nothing to fetch yet, so
  // the panel behaves as pure local draft state until a real id exists.
  sectionId: string | null;
  locale: string;
  // Reported whenever staged state changes, so the page-level Save button
  // (ContentSectionList) knows to show up — mirrors website/BlogSectionList
  // .tsx's onDraftChange reporting pattern.
  onDirtyChange?: (dirty: boolean) => void;
};

// Multiple named text fields inside one Text-fields content section — the
// text-content counterpart to the Images/Files section types. Backed by
// ArchiveItemTextField, scoped to this one section instance (an item can
// have several Text-fields sections, each with its own independent field
// list — see the model's comment in schema.prisma).
//
// Adding, editing, AND deleting a field are all staged locally (no network
// call happens on the small inline buttons inside this panel) — matching the
// rest of the item settings page's deferred-save model. `flushPendingChanges`
// (exposed via ref) is what ContentSectionList's page-level Save button
// calls to actually persist everything staged here at once.
export const TextFieldsPanel = forwardRef<TextFieldsPanelHandle, TextFieldsPanelProps>(function TextFieldsPanel(
  { sectionId, locale, onDirtyChange },
  ref,
) {
  const [fields, setFields] = useState<ArchiveTextFieldRow[]>([]);
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [pendingEdits, setPendingEdits] = useState<Record<string, PendingEdit>>({});
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [addingLabel, setAddingLabel] = useState("");
  const [addingValue, setAddingValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");

  async function loadFields(idOverride?: string) {
    const targetId = idOverride ?? sectionId;
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${targetId}/text-fields`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) setFields(data.fields ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    onDirtyChange?.(pendingFields.length > 0 || Object.keys(pendingEdits).length > 0 || pendingDeleteIds.size > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFields, pendingEdits, pendingDeleteIds]);

  useImperativeHandle(ref, () => ({
    async flushPendingChanges(resolvedSectionId: string) {
      if (pendingFields.length === 0 && Object.keys(pendingEdits).length === 0 && pendingDeleteIds.size === 0) return;

      for (const pending of pendingFields) {
        const res = await fetch(`/api/archive/content-sections/${resolvedSectionId}/text-fields`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: pending.label, value: pending.value }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to save text field");
          return;
        }
      }

      for (const [fieldId, edit] of Object.entries(pendingEdits)) {
        const res = await fetch(`/api/archive/text-fields/${fieldId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: edit.label, value: edit.value }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to save text field");
          return;
        }
      }

      for (const fieldId of pendingDeleteIds) {
        const res = await fetch(`/api/archive/text-fields/${fieldId}`, { method: "DELETE", credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to delete text field");
          return;
        }
      }

      setPendingFields([]);
      setPendingEdits({});
      setPendingDeleteIds(new Set());
      await loadFields(resolvedSectionId);
    },
  }));

  function handleStageAdd() {
    const label = addingLabel.trim();
    if (!label) return;

    setPendingFields((prev) => [...prev, { tempId: crypto.randomUUID(), label, value: addingValue }]);
    setAddingLabel("");
    setAddingValue("");
    setShowAddForm(false);
  }

  function handleDiscardPending(tempId: string) {
    setPendingFields((prev) => prev.filter((f) => f.tempId !== tempId));
  }

  function startEdit(field: ArchiveTextFieldRow) {
    const staged = pendingEdits[field.id];
    setEditingId(field.id);
    setEditLabel(staged?.label ?? field.label);
    setEditValue(staged?.value ?? field.value);
    setError("");
  }

  // Staged locally only — nothing is sent to the server until the page-level
  // Save button flushes it via flushPendingChanges.
  function handleStageEdit(fieldId: string) {
    const label = editLabel.trim();
    if (!label) return;

    setPendingEdits((prev) => ({ ...prev, [fieldId]: { label, value: editValue } }));
    setEditingId(null);
  }

  // Hides the field immediately (optimistic); the actual delete only
  // happens at Save time. Any staged edit for the same field is dropped
  // since it would just be deleted right after anyway.
  function handleStageDelete(fieldId: string) {
    setPendingDeleteIds((prev) => new Set(prev).add(fieldId));
    setPendingEdits((prev) => {
      const { [fieldId]: _removed, ...rest } = prev;
      return rest;
    });
    if (editingId === fieldId) setEditingId(null);
  }

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  const visibleFields = fields.filter((field) => !pendingDeleteIds.has(field.id));

  return (
    <div>
      {visibleFields.length === 0 && pendingFields.length === 0 && !showAddForm ? (
        <p className="mb-3 text-sm text-textColorThird">
          {locale === "nb" ? "Ingen tekstfelt" : "No text fields"}
        </p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {visibleFields.map((field) => {
            const staged = pendingEdits[field.id];
            const displayLabel = staged?.label ?? field.label;
            const displayValue = staged?.value ?? field.value;

            return editingId === field.id ? (
              <div key={field.id} className="rounded-xl border border-lineSecondary px-4 py-3">
                <input
                  className="customInput mb-2 w-full max-w-[320]"
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
                <div className="mb-2">
                  <RichTextEditorField value={editValue} onChange={setEditValue} locale={locale} showLink listMode="bullet" showFontSize />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="customButtonEnabled h-9 px-4 text-sm"
                    onClick={() => handleStageEdit(field.id)}
                  >
                    {locale === "nb" ? "Lagre" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="text-sm text-textColorThird hover:underline"
                    onClick={() => setEditingId(null)}
                  >
                    {locale === "nb" ? "Avbryt" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={field.id} className="rounded-xl border border-lineSecondary px-4 py-3">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-logoblue">
                    {displayLabel}
                    {staged && (
                      <span className="rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-normal text-logoblue">
                        {locale === "nb" ? "Ikke lagret" : "Unsaved"}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button type="button" className="text-logoblue hover:underline" onClick={() => startEdit(field)}>
                      {locale === "nb" ? "Rediger" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => handleStageDelete(field.id)}
                    >
                      {locale === "nb" ? "Slett" : "Delete"}
                    </button>
                  </div>
                </div>
                {isEmptyHtml(displayValue) ? (
                  <p className="text-sm text-textColorThird">{locale === "nb" ? "Tomt" : "Empty"}</p>
                ) : (
                  <div
                    className="rich-text-content prose max-w-none text-sm text-textColorSecond [&_p]:m-0"
                    dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(displayValue) }}
                  />
                )}
              </div>
            );
          })}

          {pendingFields.map((field) => (
            <div key={field.tempId} className="rounded-xl border border-dashed border-logoblue/50 px-4 py-3">
              <div className="mb-1 flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-logoblue">
                  {field.label}
                  <span className="rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-normal text-logoblue">
                    {locale === "nb" ? "Ikke lagret" : "Unsaved"}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-sm text-red-600 hover:underline"
                  onClick={() => handleDiscardPending(field.tempId)}
                >
                  {locale === "nb" ? "Forkast" : "Discard"}
                </button>
              </div>
              {isEmptyHtml(field.value) ? (
                <p className="text-sm text-textColorThird">{locale === "nb" ? "Tomt" : "Empty"}</p>
              ) : (
                <div
                  className="rich-text-content prose max-w-none text-sm text-textColorSecond [&_p]:m-0"
                  dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(field.value) }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        <div className="rounded-xl border border-dashed border-lineSecondary px-4 py-3">
          <input
            className="customInput mb-2 w-full max-w-[320]"
            type="text"
            placeholder={locale === "nb" ? "Feltnavn" : "Field label"}
            value={addingLabel}
            onChange={(e) => setAddingLabel(e.target.value)}
          />
          <div className="mb-2">
            <RichTextEditorField value={addingValue} onChange={setAddingValue} locale={locale} showLink listMode="bullet" showFontSize />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="customButtonEnabled h-9 px-4 text-sm"
              onClick={handleStageAdd}
              disabled={!addingLabel.trim()}
            >
              {locale === "nb" ? "Legg til" : "Add"}
            </button>
            <button
              type="button"
              className="text-sm text-textColorThird hover:underline"
              onClick={() => {
                setShowAddForm(false);
                setAddingLabel("");
                setAddingValue("");
              }}
            >
              {locale === "nb" ? "Avbryt" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="customButtonDefault inline-block w-fit"
          onClick={() => setShowAddForm(true)}
        >
          {locale === "nb" ? "Legg til tekstfelt" : "Add text field"}
        </button>
      )}

      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
});
