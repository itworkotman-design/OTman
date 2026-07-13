// app/(User)/dashboard/website/blog/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBlogPostPage() {
  const router = useRouter();
  const [titleEn, setTitleEn] = useState("");
  const [titleNo, setTitleNo] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);

    const res = await fetch("/api/dashboard/website/blog", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: { en: titleEn, no: titleNo } }),
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
    <div className="mx-auto max-w-lg p-4 md:p-6">
      <h1 className="text-2xl font-bold text-textcolor">New blog post</h1>
      <p className="mt-2 text-textColorSecond">
        Start with a title — you can fill in the rest and add content sections next.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Title (English)
          <input className="customInput font-normal" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Title (Norwegian)
          <input className="customInput font-normal" value={titleNo} onChange={(e) => setTitleNo(e.target.value)} />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">Could not create the post ({error}).</p> : null}

      <div className="mt-6 flex gap-3">
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
  );
}
