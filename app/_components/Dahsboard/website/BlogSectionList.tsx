// app/_components/Dahsboard/website/BlogSectionList.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import BlogSectionCard, { type BlogSectionRow } from "@/app/_components/Dahsboard/website/BlogSectionCard";
import BlogSectionPicker from "@/app/_components/Dahsboard/website/BlogSectionPicker";
import { getDefaultSectionData } from "@/lib/blog/defaultSectionData";
import type { BlogSectionData, BlogSectionTypeValue } from "@/lib/blog/blogSectionSchemas";

type Props = {
  postId: string;
  onSectionsChange?: (sections: BlogSectionRow[]) => void;
  onFocusSections?: () => void;
};

const BASE_URL = (postId: string) => `/api/dashboard/website/blog/${postId}/sections`;

export default function BlogSectionList({ postId, onSectionsChange, onFocusSections }: Props) {
  const [sections, setSections] = useState<BlogSectionRow[]>([]);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, BlogSectionData>>({});
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dashboard/website/blog/${postId}`, { credentials: "include" });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setSections(
        body.post.sections.map((s: { id: string; type: BlogSectionTypeValue; data: object }) => ({
          id: s.id,
          type: s.type,
          data: { type: s.type, ...s.data } as BlogSectionData,
        })),
      );
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const merged = sections.map((s) => ({ ...s, data: draftOverrides[s.id] ?? s.data }));
    onSectionsChange?.(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSectionsChange is a reporting callback, not a reactive dependency
  }, [sections, draftOverrides]);

  function handleDraftChange(id: string, data: BlogSectionData) {
    setDraftOverrides((prev) => ({ ...prev, [id]: data }));
  }

  // Flushes any section drafts that differ from what's persisted — called
  // before adding/reordering sections so edits are never lost just because
  // the user moved on to another action without closing the editor first.
  async function flushPendingDraftSaves() {
    const pending = sections.filter((s) => {
      const draft = draftOverrides[s.id];
      return draft && JSON.stringify(draft) !== JSON.stringify(s.data);
    });
    await Promise.all(pending.map((s) => handleSaveSection(s.id, draftOverrides[s.id])));
  }

  async function persistOrder(orderedIds: string[]) {
    await fetch(`${BASE_URL(postId)}/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderedIds.map((id, position) => ({ id, position }))),
    });
  }

  async function handleAddSection(type: BlogSectionTypeValue) {
    await flushPendingDraftSaves();
    const data = getDefaultSectionData(type);
    const { type: _type, ...payload } = data;
    const res = await fetch(BASE_URL(postId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setSections((prev) => [...prev, { id: body.section.id, type, data }]);
      setJustAddedId(body.section.id);
    }
  }

  async function handleSaveSection(id: string, data: BlogSectionData) {
    const { type, ...payload } = data;
    const res = await fetch(`${BASE_URL(postId)}/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, data } : s)));
      setDraftOverrides((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`${BASE_URL(postId)}/${id}/duplicate`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) load();
  }

  async function handleDelete(id: string) {
    await fetch(`${BASE_URL(postId)}/${id}`, { method: "DELETE", credentials: "include" });
    setSections((prev) => prev.filter((s) => s.id !== id));
    setDraftOverrides((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    await flushPendingDraftSaves();
    const reordered = arrayMove(sections, index, targetIndex);
    setSections(reordered);
    persistOrder(reordered.map((s) => s.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    await flushPendingDraftSaves();
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);
    persistOrder(reordered.map((s) => s.id));
  }

  if (loading) {
    return <p className="text-textColorSecond">Loading sections...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, index) => (
            <BlogSectionCard
              key={section.id}
              blogPostId={postId}
              section={section}
              index={index}
              total={sections.length}
              onSave={handleSaveSection}
              onMove={handleMove}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onExpandStart={onFocusSections}
              onDraftChange={handleDraftChange}
              initiallyExpanded={section.id === justAddedId}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="text-sm text-white/80">No sections yet. Add one to build the article body.</p>
      ) : null}

      <button
        type="button"
        className="customButtonEnabled self-start !bg-white !text-logoblue"
        onClick={() => {
          onFocusSections?.();
          setPickerOpen(true);
        }}
      >
        Add section
      </button>

      {pickerOpen ? (
        <BlogSectionPicker onPick={handleAddSection} onClose={() => setPickerOpen(false)} />
      ) : null}
    </div>
  );
}
