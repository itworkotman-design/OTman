// app/_components/Dahsboard/website/BlogEditor.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import BlogSectionList from "@/app/_components/Dahsboard/website/BlogSectionList";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type MetadataForm = {
  title: LocalizedTextValue;
  slug: string;
  excerpt: LocalizedTextValue;
  seoTitle: LocalizedTextValue;
  seoDescription: LocalizedTextValue;
  coverImagePath: string | null;
  coverImageAlt: LocalizedTextValue;
  authorDisplayName: string;
};

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

const EMPTY_TEXT = { en: "", no: "" };

function toForm(post: {
  title: LocalizedTextValue;
  slug: string;
  excerpt: LocalizedTextValue;
  seoTitle: LocalizedTextValue | null;
  seoDescription: LocalizedTextValue | null;
  coverImagePath: string | null;
  coverImageAlt: LocalizedTextValue | null;
  authorDisplayName: string | null;
}): MetadataForm {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    seoTitle: post.seoTitle ?? EMPTY_TEXT,
    seoDescription: post.seoDescription ?? EMPTY_TEXT,
    coverImagePath: post.coverImagePath,
    coverImageAlt: post.coverImageAlt ?? EMPTY_TEXT,
    authorDisplayName: post.authorDisplayName ?? "",
  };
}

export default function BlogEditor({ postId }: { postId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<MetadataForm | null>(null);
  const [savedForm, setSavedForm] = useState<MetadataForm | null>(null);
  const [status, setStatus] = useState<PostStatus>("DRAFT");
  const [isPinned, setIsPinned] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const isDirty = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/website/blog/${postId}`, { credentials: "include" });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      const nextForm = toForm(body.post);
      setForm(nextForm);
      setSavedForm(nextForm);
      setStatus(body.post.status);
      setIsPinned(body.post.isPinned);
    }
  }, [postId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, same pattern used elsewhere pre-dating this rule
    load();
  }, [load]);

  const dirty = Boolean(form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));

  useEffect(() => {
    isDirty.current = dirty;
  }, [dirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function handleSave() {
    if (!form) return;
    setSaveState("saving");
    const res = await fetch(`/api/dashboard/website/blog/${postId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      setSaveState("error");
      return;
    }
    setSavedForm(form);
    setSaveState("saved");
  }

  async function handleStatusAction(action: "publish" | "unpublish" | "archive" | "restore") {
    setPublishError(null);
    const res = await fetch(`/api/dashboard/website/blog/${postId}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      if (body?.reason === "PUBLISH_REQUIREMENTS_NOT_MET") {
        const missing: string[] = [];
        if (!body.details.hasTitle) missing.push("a title");
        if (!body.details.hasValidSlug) missing.push("a valid slug");
        if (!body.details.hasNonEmptySection) missing.push("at least one non-empty section");
        setPublishError(`Cannot publish: missing ${missing.join(", ")}.`);
      }
      return;
    }
    setStatus(body.post.status);
  }

  async function handlePinToggle() {
    const action = isPinned ? "unpin" : "pin";
    const res = await fetch(`/api/dashboard/website/blog/${postId}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) setIsPinned(body.post.isPinned);
  }

  if (!form) {
    return <div className="p-6 text-textColorSecond">Loading...</div>;
  }

  const saveLabel: Record<SaveState, string> = {
    idle: "Saved",
    unsaved: "Unsaved changes",
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed",
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linePrimary pb-4">
        <div className="flex items-center gap-3">
          <button type="button" className="customButtonDefault" onClick={() => router.push("/dashboard/website/blog")}>
            Back to blog list
          </button>
          <span className="text-sm text-textColorSecond">
            {saveLabel[saveState === "saving" || saveState === "error" ? saveState : dirty ? "unsaved" : "saved"]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/website/blog/${postId}/preview`} target="_blank" className="customButtonDefault">
            Preview
          </Link>
          <button type="button" className="customButtonEnabled" onClick={handleSave} disabled={saveState === "saving"}>
            Save
          </button>
          {status === "PUBLISHED" ? (
            <button type="button" className="customButtonDefault" onClick={() => handleStatusAction("unpublish")}>
              Unpublish
            </button>
          ) : (
            <button type="button" className="customButtonDefault" onClick={() => handleStatusAction("publish")}>
              Publish
            </button>
          )}
          {status === "ARCHIVED" ? (
            <button type="button" className="customButtonDefault" onClick={() => handleStatusAction("restore")}>
              Restore
            </button>
          ) : (
            <button type="button" className="customButtonDefault" onClick={() => handleStatusAction("archive")}>
              Archive
            </button>
          )}
        </div>
      </div>

      {publishError ? <p className="mt-3 text-sm text-red-600">{publishError}</p> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase text-textColorSecond">Status: {status}</div>
          <LocalizedTextFieldGroup
            label="Title"
            required
            maxLength={200}
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
          />
          <label className="flex flex-col gap-1 text-sm">
            Slug
            <input
              className="customInput font-normal"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <LocalizedTextFieldGroup
            label="Excerpt"
            multiline
            maxLength={500}
            value={form.excerpt}
            onChange={(excerpt) => setForm({ ...form, excerpt })}
          />
          <BlogImagePicker
            label="Cover image"
            storagePath={form.coverImagePath}
            onChange={(coverImagePath) => setForm({ ...form, coverImagePath })}
          />
          <LocalizedTextFieldGroup
            label="Cover image alt text"
            maxLength={300}
            value={form.coverImageAlt}
            onChange={(coverImageAlt) => setForm({ ...form, coverImageAlt })}
          />
          <label className="flex flex-col gap-1 text-sm">
            Public byline (optional)
            <input
              className="customInput font-normal"
              value={form.authorDisplayName}
              onChange={(e) => setForm({ ...form, authorDisplayName: e.target.value })}
              placeholder="e.g. Otman AS"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPinned} onChange={handlePinToggle} />
            Pinned
          </label>
          <LocalizedTextFieldGroup
            label="SEO title"
            maxLength={200}
            value={form.seoTitle}
            onChange={(seoTitle) => setForm({ ...form, seoTitle })}
          />
          <LocalizedTextFieldGroup
            label="SEO description"
            multiline
            maxLength={300}
            value={form.seoDescription}
            onChange={(seoDescription) => setForm({ ...form, seoDescription })}
          />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-textcolor">Content sections</h2>
          <BlogSectionList postId={postId} />
        </div>
      </div>
    </div>
  );
}
