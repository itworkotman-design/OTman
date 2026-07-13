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

type Props = { postId: string };

const BASE_URL = (postId: string) => `/api/dashboard/website/blog/${postId}/sections`;

export default function BlogSectionList({ postId }: Props) {
  const [sections, setSections] = useState<BlogSectionRow[]>([]);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, same pattern used elsewhere pre-dating this rule
    load();
  }, [load]);

  async function persistOrder(orderedIds: string[]) {
    await fetch(`${BASE_URL(postId)}/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderedIds.map((id, position) => ({ id, position }))),
    });
  }

  async function handleAddSection(type: BlogSectionTypeValue) {
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
  }

  function handleMove(id: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = arrayMove(sections, index, targetIndex);
    setSections(reordered);
    persistOrder(reordered.map((s) => s.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

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
              section={section}
              index={index}
              total={sections.length}
              onSave={handleSaveSection}
              onMove={handleMove}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="text-sm text-textColorSecond">No sections yet. Add one to build the article body.</p>
      ) : null}

      <button type="button" className="customButtonEnabled self-start" onClick={() => setPickerOpen(true)}>
        Add section
      </button>

      {pickerOpen ? (
        <BlogSectionPicker onPick={handleAddSection} onClose={() => setPickerOpen(false)} />
      ) : null}
    </div>
  );
}
