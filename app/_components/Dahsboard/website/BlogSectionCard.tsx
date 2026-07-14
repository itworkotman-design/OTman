// app/_components/Dahsboard/website/BlogSectionCard.tsx
"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BlogSectionEditorSwitch from "@/app/_components/Dahsboard/website/BlogSectionEditorSwitch";
import SectionTypeIcon from "@/app/_components/Dahsboard/website/SectionTypeIcon";
import { isSectionNonEmpty, type BlogSectionData } from "@/lib/blog/blogSectionSchemas";
import { SECTION_TYPE_LABELS } from "@/lib/blog/defaultSectionData";

export type BlogSectionRow = {
  id: string;
  type: BlogSectionData["type"];
  data: BlogSectionData;
};

type Props = {
  blogPostId: string;
  section: BlogSectionRow;
  index: number;
  total: number;
  onSave: (id: string, data: BlogSectionData) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExpandStart?: () => void;
  onDraftChange?: (id: string, data: BlogSectionData) => void;
  initiallyExpanded?: boolean;
};

export default function BlogSectionCard({
  blogPostId,
  section,
  index,
  total,
  onSave,
  onMove,
  onDuplicate,
  onDelete,
  onExpandStart,
  onDraftChange,
  initiallyExpanded,
}: Props) {
  const [expanded, setExpanded] = useState(Boolean(initiallyExpanded));
  const [draft, setDraft] = useState<BlogSectionData>(section.data);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    onDraftChange?.(section.id, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report-only effect, id/callback identity aren't reactive dependencies here
  }, [draft]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  function handleToggleExpanded() {
    // No manual "Save" button — the draft is saved automatically whenever
    // the editor is opened or closed, so edits are never lost just because
    // the user forgot to click save.
    onSave(section.id, draft);
    if (!expanded) onExpandStart?.();
    setExpanded((v) => !v);
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
      className={`rounded-lg border border-linePrimary bg-white ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab px-1 text-textColorSecond"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        <button
          type="button"
          className="flex flex-1 items-center rounded-md px-2 py-2 text-left hover:bg-linePrimary/10"
          onClick={handleToggleExpanded}
          aria-expanded={expanded}
        >
          <SectionTypeIcon type={section.type} className="h-5 w-5 shrink-0 text-logoblue" />
          <span className="ml-2 font-semibold text-textcolor">{SECTION_TYPE_LABELS[section.type].name}</span>
        </button>

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
          <BlogSectionEditorSwitch blogPostId={blogPostId} data={draft} onChange={setDraft} />
        </div>
      ) : null}
    </div>
  );
}
