"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ArchiveRichTextEditorField } from "@/app/_components/Dahsboard/archive/ArchiveRichTextEditorField";
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

export type TextFieldsPanelHandle = {
  flushPendingAdds: () => Promise<void>;
};

type TextFieldsPanelProps = {
  sectionId: string;
  locale: string;
  // Reported whenever a field is staged/discarded, so the page-level Save
  // button (ContentSectionList) knows to show up — mirrors
  // website/BlogSectionList.tsx's onDraftChange reporting pattern.
  onDirtyChange?: (dirty: boolean) => void;
};

// Multiple named text fields inside one Text-fields content section — the
// text-content counterpart to the Images/Files section types. Backed by
// ArchiveItemTextField, scoped to this one section instance (an item can
// have several Text-fields sections, each with its own independent field
// list — see the model's comment in schema.prisma).
//
// Adding a field is staged locally (a "pending" row with a temp id, not sent
// to the server) rather than saved immediately on its own inline button —
// per explicit user request that the page-level big Save button is what
// actually persists a new field, not the small "Add" button inside the
// section. `flushPendingAdds` (exposed via ref) is what ContentSectionList
// calls when that big Save button is clicked. Editing/deleting an
// *existing* (already-persisted) field is unaffected — those still save
// immediately, since only "adding" was in scope for this change.
export const TextFieldsPanel = forwardRef<TextFieldsPanelHandle, TextFieldsPanelProps>(function TextFieldsPanel(
  { sectionId, locale, onDirtyChange },
  ref,
) {
  const [fields, setFields] = useState<ArchiveTextFieldRow[]>([]);
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [loading, setLoading] = useState(true);

  const [addingLabel, setAddingLabel] = useState("");
  const [addingValue, setAddingValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadFields() {
    try {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${sectionId}/text-fields`, {
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
    onDirtyChange?.(pendingFields.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFields]);

  useImperativeHandle(ref, () => ({
    async flushPendingAdds() {
      if (pendingFields.length === 0) return;

      for (const pending of pendingFields) {
        const res = await fetch(`/api/archive/content-sections/${sectionId}/text-fields`, {
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

      setPendingFields([]);
      await loadFields();
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
    setEditingId(field.id);
    setEditLabel(field.label);
    setEditValue(field.value);
    setError("");
  }

  async function handleSaveEdit(fieldId: string) {
    const label = editLabel.trim();
    if (!label) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`/api/archive/text-fields/${fieldId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, value: editValue }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to save text field");
        return;
      }

      setEditingId(null);
      await loadFields();
    } catch {
      setError("Failed to save text field");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fieldId: string) {
    if (!confirm(locale === "nb" ? "Slette dette tekstfeltet?" : "Delete this text field?")) return;

    try {
      setDeletingId(fieldId);
      setError("");

      const res = await fetch(`/api/archive/text-fields/${fieldId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to delete text field");
        return;
      }

      await loadFields();
    } catch {
      setError("Failed to delete text field");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  return (
    <div>
      {fields.length === 0 && pendingFields.length === 0 && !showAddForm ? (
        <p className="mb-3 text-sm text-textColorThird">
          {locale === "nb" ? "Ingen tekstfelt" : "No text fields"}
        </p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {fields.map((field) =>
            editingId === field.id ? (
              <div key={field.id} className="rounded-xl border border-lineSecondary px-4 py-3">
                <input
                  className="customInput mb-2 w-full max-w-[320]"
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  disabled={saving}
                />
                <div className="mb-2">
                  <ArchiveRichTextEditorField value={editValue} onChange={setEditValue} locale={locale} />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="customButtonEnabled h-9 px-4 text-sm"
                    onClick={() => void handleSaveEdit(field.id)}
                    disabled={saving}
                  >
                    {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="text-sm text-textColorThird hover:underline"
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                  >
                    {locale === "nb" ? "Avbryt" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={field.id} className="rounded-xl border border-lineSecondary px-4 py-3">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="font-semibold text-logoblue">{field.label}</span>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button type="button" className="text-logoblue hover:underline" onClick={() => startEdit(field)}>
                      {locale === "nb" ? "Rediger" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => void handleDelete(field.id)}
                      disabled={deletingId === field.id}
                    >
                      {locale === "nb" ? "Slett" : "Delete"}
                    </button>
                  </div>
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
            ),
          )}

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
            <ArchiveRichTextEditorField value={addingValue} onChange={setAddingValue} locale={locale} />
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
