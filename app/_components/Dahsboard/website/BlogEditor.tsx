// app/_components/Dahsboard/website/BlogEditor.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import BlogSectionList from "@/app/_components/Dahsboard/website/BlogSectionList";
import CollapsibleSection from "@/app/_components/Dahsboard/website/CollapsibleSection";
import TagInput from "@/app/_components/Dahsboard/website/TagInput";
import type { BlogSectionRow } from "@/app/_components/Dahsboard/website/BlogSectionCard";
import BlogSectionRenderer from "@/app/_components/blog/BlogSectionRenderer";
import BlogListCard from "@/app/_components/blog/BlogListCard";
import { getLocalizedText, type LocalizedTextValue } from "@/lib/blog/localizedText";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";
import type { Locale } from "@/lib/content/NavbarContent";

type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type MetadataForm = {
  title: LocalizedTextValue;
  slug: string;
  excerpt: LocalizedTextValue;
  seoTitle: LocalizedTextValue;
  seoDescription: LocalizedTextValue;
  noIndex: boolean;
  tags: string[];
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
  noIndex: boolean;
  tagNames: string[];
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
    noIndex: post.noIndex,
    tags: post.tagNames,
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
  const [previewSections, setPreviewSections] = useState<BlogSectionRow[]>([]);
  const [previewLocale, setPreviewLocale] = useState<Locale>("no");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
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

  const loadTagSuggestions = useCallback(async () => {
    const res = await fetch(`/api/dashboard/website/blog/tags`, { credentials: "include" });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setTagSuggestions(body.tags.map((tag: { name: string }) => tag.name));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, same pattern used elsewhere pre-dating this rule
    load();
    loadTagSuggestions();
  }, [load, loadTagSuggestions]);

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
    const { tags, ...metadata } = form;
    const [metadataRes, tagsRes] = await Promise.all([
      fetch(`/api/dashboard/website/blog/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }),
      fetch(`/api/dashboard/website/blog/${postId}/tags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagNames: tags }),
      }),
    ]);
    const metadataBody = await metadataRes.json().catch(() => null);
    const tagsBody = await tagsRes.json().catch(() => null);
    if (!metadataRes.ok || !metadataBody?.ok || !tagsRes.ok || !tagsBody?.ok) {
      setSaveState("error");
      return;
    }
    setSavedForm(form);
    setSaveState("saved");
    loadTagSuggestions();
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

  const previewSectionData = previewSections.map((s) => s.data);
  const readingTime = computeReadingTimeMinutes(previewSectionData, previewLocale);

  return (
    <div className="flex min-h-screen flex-col">
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-white p-4 md:px-6"
        style={{ boxShadow: "0px 0px 10px 0 rgba(0, 0, 0, 0.1)" }}
      >
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
            Full preview
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

      {publishError ? <p className="px-4 pt-3 text-sm text-red-600 md:px-6">{publishError}</p> : null}

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Live preview — left half */}
        <div className="flex flex-1 flex-col bg-linePrimary/20 p-6 md:p-8 lg:w-1/2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-textColorSecond">
              Live preview
            </span>
            <div className="flex gap-1">
              {(["no", "en"] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setPreviewLocale(locale)}
                  className={`customButtonDefault !px-3 !py-1 text-xs uppercase ${
                    previewLocale === locale ? "bg-linePrimary" : ""
                  }`}
                >
                  {locale}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex-1">
            {detailsOpen ? (
              <div className="mx-auto w-99.25 max-w-full">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-textColorSecond">
                  Blog list card preview
                </p>
                <BlogListCard
                  locale={previewLocale}
                  title={form.title}
                  titlePlaceholder="Your title will appear here"
                  excerpt={form.excerpt}
                  excerptPlaceholder="Your excerpt will appear here."
                  coverImagePath={form.coverImagePath}
                  isPinned={isPinned}
                  dateLabel="Today"
                  authorDisplayName={form.authorDisplayName}
                  readingTime={readingTime}
                  readTimeLabel="min read"
                  pinnedLabel="Pinned"
                  tags={form.tags.map((name) => ({ name, slug: name }))}
                />
              </div>
            ) : (
              <div className="w-full overflow-hidden rounded-lg border border-linePrimary bg-white shadow-sm">
                <div className="p-6">
                  <span className="text-xs font-semibold text-textColorSecond">{status}</span>
                  <h1 className="mt-3 text-3xl font-bold leading-tight text-logoblue">
                    {getLocalizedText(form.title, previewLocale) || "Your title will appear here"}
                  </h1>
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-linePrimary pt-4 text-sm text-textColorSecond">
                    {form.authorDisplayName ? <span>{form.authorDisplayName}</span> : null}
                    <span>{readingTime} min read</span>
                  </div>
                  {previewSectionData.length > 0 ? (
                    <div className="mt-6">
                      <BlogSectionRenderer sections={previewSectionData} locale={previewLocale} />
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-textColorSecond">
                      Sections you add below will appear here once saved.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Work area — right half */}
        <div className="flex flex-1 flex-col gap-6 bg-logoblue p-6 md:p-8 lg:w-1/2">
          <CollapsibleSection
            title="Details"
            description="Title, excerpt, cover image, byline, and SEO"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            <LocalizedTextFieldGroup
              label="Title"
              required
              maxLength={200}
              value={form.title}
              onChange={(title) => setForm({ ...form, title })}
            />
            <LocalizedTextFieldGroup
              label="Excerpt"
              multiline
              maxLength={500}
              value={form.excerpt}
              onChange={(excerpt) => setForm({ ...form, excerpt })}
            />
            <BlogImagePicker
              label="Cover image"
              blogPostId={postId}
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
            <TagInput
              label="Tags"
              value={form.tags}
              onChange={(tags) => setForm({ ...form, tags })}
              suggestions={tagSuggestions}
            />

            <div className="mt-2 flex flex-col gap-4 border-t border-linePrimary pt-4">
              <span className="text-sm font-semibold text-textcolor">SEO</span>
              <label className="flex flex-col gap-1 text-sm">
                Slug
                <input
                  className="customInput font-normal"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.noIndex}
                  onChange={(e) => setForm({ ...form, noIndex: e.target.checked })}
                />
                Exclude from search engines (noindex)
              </label>
            </div>
          </CollapsibleSection>

          <div>
            <h2 className="mb-3 text-lg font-bold text-white">Content sections</h2>
            <BlogSectionList
              postId={postId}
              onSectionsChange={setPreviewSections}
              onFocusSections={() => setDetailsOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
