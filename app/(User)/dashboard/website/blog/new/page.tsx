// app/(User)/dashboard/website/blog/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PreviewLocale = "en" | "no";

export default function NewBlogPostPage() {
  const router = useRouter();
  const [titleEn, setTitleEn] = useState("");
  const [titleNo, setTitleNo] = useState("");
  const [previewLocale, setPreviewLocale] = useState<PreviewLocale>("no");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = { en: titleEn, no: titleNo };
  const previewTitle = title[previewLocale];

  async function handleCreate() {
    setCreating(true);
    setError(null);

    const res = await fetch("/api/dashboard/website/blog", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok || !body?.ok) {
      setError(body?.reason ?? "CREATE_FAILED");
      setCreating(false);
      return;
    }

    router.push(`/dashboard/website/blog/${body.post.id}`);
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col lg:flex-row">
      {/* Live preview — left half */}
      <div className="flex flex-1 flex-col bg-linePrimary/20 p-6 md:p-10 lg:w-1/2">
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

        <div className="mx-auto mt-8 w-full max-w-xl">
          <div className="overflow-hidden rounded-lg border border-linePrimary bg-white shadow-sm">
            <div className="flex aspect-[16/9] items-center justify-center bg-linePrimary/40 text-sm text-textColorSecond">
              Cover image
            </div>
            <div className="p-6">
              <span className="text-xs font-semibold text-textColorSecond">Draft</span>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-logoblue">
                {previewTitle.trim() || "Your title will appear here"}
              </h1>
              <p className="mt-4 text-textColorSecond">
                Your excerpt will appear here once you add one.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Work area — right half */}
      <div className="flex flex-1 flex-col p-6 md:p-10 lg:w-1/2">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <h1 className="text-2xl font-bold text-textcolor">New blog post</h1>
          <p className="mt-2 text-textColorSecond">Choose a title to get started.</p>

          <div className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
              Title (Norwegian)
              <input
                autoFocus
                className="customInput font-normal text-lg"
                value={titleNo}
                onChange={(e) => setTitleNo(e.target.value)}
                onFocus={() => setPreviewLocale("no")}
                placeholder="Skriv en tittel..."
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
              Title (English)
              <input
                className="customInput font-normal text-lg"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                onFocus={() => setPreviewLocale("en")}
                placeholder="Write a title..."
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">Could not create the post ({error}).</p> : null}

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              className="customButtonEnabled"
              disabled={creating || (!titleEn.trim() && !titleNo.trim())}
              onClick={handleCreate}
            >
              {creating ? "Creating..." : "Create draft"}
            </button>
            <button type="button" className="customButtonDefault" onClick={() => router.push("/dashboard/website/blog")}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
