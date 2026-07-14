// app/_components/Dahsboard/website/BlogTagManager.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tag = { id: string; name: string; slug: string; postCount: number };

export default function BlogTagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard/website/blog/tags", { credentials: "include" });
    const body = await res.json().catch(() => null);
    if (body?.ok) setTags(body.tags);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, same pattern used elsewhere pre-dating this rule
    load();
  }, [load]);

  function startEditing(tag: Tag) {
    setEditingId(tag.id);
    setEditValue(tag.name);
  }

  async function saveRename(tagId: string) {
    setError(null);
    const res = await fetch(`/api/dashboard/website/blog/tags/${tagId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editValue }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      setError("Could not rename tag.");
      return;
    }
    setEditingId(null);
    load();
  }

  async function handleMerge(tagId: string) {
    const intoTagId = mergeTargets[tagId];
    if (!intoTagId) return;
    setError(null);
    const res = await fetch(`/api/dashboard/website/blog/tags/${tagId}/merge`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intoTagId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      setError("Could not merge tags.");
      return;
    }
    setMergeTargets((prev) => {
      const { [tagId]: _removed, ...rest } = prev;
      return rest;
    });
    load();
  }

  async function handleDelete(tagId: string) {
    setError(null);
    const res = await fetch(`/api/dashboard/website/blog/tags/${tagId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      setError("Could not delete tag.");
      return;
    }
    setPendingDeleteId(null);
    load();
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-textcolor">Manage tags</h1>
        <Link href="/dashboard/website/blog" className="customButtonDefault">
          Back to blog list
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="mt-6 text-textColorSecond">Loading...</p>
      ) : tags.length === 0 ? (
        <p className="mt-6 text-textColorSecond">No tags yet. Tags are created from the post editor.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-linePrimary p-3"
            >
              <div className="flex flex-1 items-center gap-2">
                {editingId === tag.id ? (
                  <>
                    <input
                      className="customInput font-normal"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="customButtonEnabled !px-3 !py-1 text-xs"
                      onClick={() => saveRename(tag.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="customButtonDefault !px-3 !py-1 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-textcolor">{tag.name}</span>
                    <span className="text-xs text-textColorSecond">
                      {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                    </span>
                    <button
                      type="button"
                      className="customButtonDefault !px-2 !py-1 text-xs"
                      onClick={() => startEditing(tag)}
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="customInput !w-auto font-normal"
                  value={mergeTargets[tag.id] ?? ""}
                  onChange={(e) => setMergeTargets((prev) => ({ ...prev, [tag.id]: e.target.value }))}
                >
                  <option value="">Merge into...</option>
                  {tags
                    .filter((t) => t.id !== tag.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="customButtonDefault !px-2 !py-1 text-xs"
                  disabled={!mergeTargets[tag.id]}
                  onClick={() => handleMerge(tag.id)}
                >
                  Merge
                </button>
              </div>

              {pendingDeleteId === tag.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete this tag from all posts?</span>
                  <button
                    type="button"
                    className="customButtonDefault !px-2 !py-1 text-xs"
                    onClick={() => handleDelete(tag.id)}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="customButtonDefault !px-2 !py-1 text-xs"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="customButtonDefault !px-2 !py-1 text-xs text-red-600"
                  onClick={() => setPendingDeleteId(tag.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
