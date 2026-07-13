// app/_components/Dahsboard/website/BlogSectionCard.tsx
"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BlogSectionEditorSwitch from "@/app/_components/Dahsboard/website/BlogSectionEditorSwitch";
import { isSectionNonEmpty, type BlogSectionData } from "@/lib/blog/blogSectionSchemas";
import { SECTION_TYPE_LABELS } from "@/lib/blog/defaultSectionData";

export type BlogSectionRow = {
  id: string;
  type: BlogSectionData["type"];
  data: BlogSectionData;
};

type Props = {
  section: BlogSectionRow;
  index: number;
  total: number;
  onSave: (id: string, data: BlogSectionData) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function BlogSectionCard({ section, index, total, onSave, onMove, onDuplicate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<BlogSectionData>(section.data);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  async function handleSave() {
    setSaving(true);
    await onSave(section.id, draft);
    setSaving(false);
  }

  function handleDeleteClick() {
    const hasContent = isSectionNonEmpty(section.data);
    if (hasContent && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(section.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-linePrimary ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Drag to reorder"
            className="cursor-grab px-1 text-textColorSecond"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <span className="font-semibold text-textcolor">{SECTION_TYPE_LABELS[section.type].name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.id, "up")}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === total - 1}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.id, "down")}
          >
            ↓
          </button>
          <button type="button" className="customButtonDefault !px-2 !py-1 text-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Edit"}
          </button>
          <button type="button" className="customButtonDefault !px-2 !py-1 text-xs" onClick={() => onDuplicate(section.id)}>
            Duplicate
          </button>
          <button
            type="button"
            className={`customButtonDefault !px-2 !py-1 text-xs ${confirmingDelete ? "bg-red-100 text-red-700" : ""}`}
            onClick={handleDeleteClick}
          >
            {confirmingDelete ? "Confirm delete" : "Delete"}
          </button>
          {confirmingDelete ? (
            <button
              type="button"
              className="customButtonDefault !px-2 !py-1 text-xs"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-linePrimary p-4">
          <BlogSectionEditorSwitch data={draft} onChange={setDraft} />
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="customButtonEnabled" disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save section"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
