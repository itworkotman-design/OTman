"use client";

import { useEffect, useState } from "react";
import type { ArchiveTagSummary } from "./types";

type TagsPanelProps = {
  kind: "item" | "folder";
  id: string;
  locale: string;
};

// Tenant-scoped Tags (0.2.0 delivery — attachTagToFolder/attachTagToItem,
// create-or-reuse by name, case-insensitive per tenant). Attach/remove persist
// immediately (no big Save button) — same immediate-write pattern as the
// folder Sharing section, not the deferred-save Content-section model, since
// each tag chip is its own independent, already-atomic action.
export function TagsPanel({ kind, id, locale }: TagsPanelProps) {
  const [tags, setTags] = useState<ArchiveTagSummary[]>([]);
  const [vocabulary, setVocabulary] = useState<ArchiveTagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const basePath = kind === "item" ? `/api/archive/items/${id}/tags` : `/api/archive/folders/${id}/tags`;

  async function loadTags() {
    try {
      setLoading(true);
      const res = await fetch(basePath, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) setTags(data.tags ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTags();
    fetch("/api/archive/tags", { credentials: "include", cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data?.ok) setVocabulary(data.tags ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  async function handleAttach() {
    const name = newTagName.trim();
    if (!name) return;

    setAdding(true);
    setError("");
    try {
      const res = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to add tag");
        return;
      }
      setNewTagName("");
      await loadTags();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tagId: string) {
    setRemovingId(tagId);
    setError("");
    try {
      const res = await fetch(`${basePath}/${tagId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to remove tag");
        return;
      }
      setTags((prev) => prev.filter((tag) => tag.id !== tagId));
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tags.length === 0 && <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen stikkord" : "No tags"}</p>}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-2 rounded-full bg-logoblue/10 px-3 py-1 text-sm font-medium text-logoblue"
          >
            {tag.name}
            <button
              type="button"
              className="text-logoblue/70 hover:text-red-600 disabled:opacity-50"
              disabled={removingId === tag.id}
              onClick={() => void handleRemove(tag.id)}
              aria-label={locale === "nb" ? `Fjern ${tag.name}` : `Remove ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="customInput w-full max-w-[240]"
          type="text"
          list="archive-tag-vocabulary"
          placeholder={locale === "nb" ? "Nytt stikkord" : "New tag"}
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAttach();
            }
          }}
          disabled={adding}
        />
        <datalist id="archive-tag-vocabulary">
          {vocabulary.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <button
          type="button"
          className="customButtonDefault h-10 px-4 text-sm"
          onClick={() => void handleAttach()}
          disabled={adding || !newTagName.trim()}
        >
          {adding ? (locale === "nb" ? "Legger til..." : "Adding...") : locale === "nb" ? "Legg til" : "Add"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
