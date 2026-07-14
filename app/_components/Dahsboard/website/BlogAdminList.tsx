// app/_components/Dahsboard/website/BlogAdminList.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";

type AdminBlogPost = {
  id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: { en: string; no: string };
  excerpt: { en: string; no: string };
  coverImagePath: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: { username: string | null; email: string } | null;
  authorDisplayName: string | null;
  _count: { sections: number };
};

const STATUS_FILTERS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED", "PINNED"] as const;

const STATUS_CARD_STYLES: Record<AdminBlogPost["status"], { card: string; heading: string; body: string }> = {
  PUBLISHED: { card: "bg-logoblue", heading: "text-white", body: "text-white/80" },
  DRAFT: { card: "bg-white", heading: "text-textcolor", body: "text-textColorSecond" },
  ARCHIVED: { card: "bg-gray-400", heading: "text-textcolor", body: "text-textColorSecond" },
};

async function postAction(postId: string, action: string) {
  const res = await fetch(`/api/dashboard/website/blog/${postId}/${action}`, {
    method: "POST",
    credentials: "include",
  });
  return res.json().catch(() => null);
}

export default function BlogAdminList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "OWNER";

  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "ALL") as (typeof STATUS_FILTERS)[number];
  const page = Number(searchParams.get("page")) || 1;
  const rowsPerPage = 20;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.push(`/dashboard/website/blog?${next.toString()}`);
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      q,
      status,
      page: String(page),
      rowsPerPage: String(rowsPerPage),
    });
    const res = await fetch(`/api/dashboard/website/blog?${params.toString()}`, {
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setPosts(body.posts);
      setTotal(body.total);
      setStatusCounts(body.statusCounts);
    }
    setLoading(false);
  }, [q, status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/filter-change, same pattern used elsewhere pre-dating this rule
    load();
  }, [load]);

  async function handleAction(postId: string, action: string) {
    await postAction(postId, action);
    load();
  }

  async function handleDelete(postId: string) {
    await fetch(`/api/dashboard/website/blog/${postId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setPendingDeleteId(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-textcolor">Blog</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/website/blog/tags" className="customButtonDefault">
            Manage tags
          </Link>
          <Link href="/dashboard/website/blog/new" className="customButtonEnabled">
            New blog post
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="customInput font-normal"
          placeholder="Search by title, excerpt, or slug"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParams({ q: e.currentTarget.value, page: null });
          }}
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => updateParams({ status: filter === "ALL" ? null : filter, page: null })}
              className={`customButtonDefault ${status === filter ? "bg-linePrimary" : ""}`}
            >
              {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
              {filter === "DRAFT" ? ` (${statusCounts.DRAFT})` : ""}
              {filter === "PUBLISHED" ? ` (${statusCounts.PUBLISHED})` : ""}
              {filter === "ARCHIVED" ? ` (${statusCounts.ARCHIVED})` : ""}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-textColorSecond">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="mt-6 text-textColorSecond">No blog posts found.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const imageUrl = getPublicBlogImageUrl(post.coverImagePath);
            const statusStyle = STATUS_CARD_STYLES[post.status];
            const actionButtonClass =
              post.status === "PUBLISHED" ? "customButtonDefault !bg-white !text-logoblue" : "customButtonDefault";
            return (
              <div key={post.id} className="flex flex-col overflow-hidden rounded-lg border border-linePrimary shadow-sm">
                <div className="relative aspect-[16/9] bg-linePrimary/40">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  {post.isPinned ? (
                    <span
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-logoblue text-white shadow"
                      title="Pinned"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                      <span className="sr-only">Pinned</span>
                    </span>
                  ) : null}
                </div>
                <div className={`flex flex-1 flex-col gap-2 p-4 ${statusStyle.card}`}>
                  <div className={`flex items-center gap-2 text-xs font-semibold uppercase ${statusStyle.body}`}>
                    <span>{post.status}</span>
                  </div>
                  <h2 className={`text-lg font-bold ${statusStyle.heading}`}>
                    {getLocalizedText(post.title, "no") || getLocalizedText(post.title, "en") || "(untitled)"}
                  </h2>
                  <p className={`line-clamp-2 flex-1 text-sm ${statusStyle.body}`}>
                    {getLocalizedText(post.excerpt, "no") || getLocalizedText(post.excerpt, "en")}
                  </p>
                  <div className={`text-xs ${statusStyle.body}`}>
                    Created {new Date(post.createdAt).toLocaleDateString()}
                    {post.publishedAt ? ` · Published ${new Date(post.publishedAt).toLocaleDateString()}` : ""}
                  </div>
                  <div className={`text-xs ${statusStyle.body}`}>
                    {post.authorDisplayName ?? post.author?.username ?? post.author?.email ?? "Unknown author"}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/dashboard/website/blog/${post.id}`} className={actionButtonClass}>
                      Edit
                    </Link>
                    {post.status === "PUBLISHED" ? (
                      <button className={actionButtonClass} onClick={() => handleAction(post.id, "unpublish")}>
                        Unpublish
                      </button>
                    ) : (
                      <button className={actionButtonClass} onClick={() => handleAction(post.id, "publish")}>
                        Publish
                      </button>
                    )}
                    {post.status === "PUBLISHED" ? (
                      post.isPinned ? (
                        <button className={actionButtonClass} onClick={() => handleAction(post.id, "unpin")}>
                          Unpin
                        </button>
                      ) : (
                        <button className={actionButtonClass} onClick={() => handleAction(post.id, "pin")}>
                          Pin
                        </button>
                      )
                    ) : null}
                    <button className={actionButtonClass} onClick={() => handleAction(post.id, "duplicate")}>
                      Duplicate
                    </button>
                    {post.status === "ARCHIVED" ? (
                      <button className={actionButtonClass} onClick={() => handleAction(post.id, "restore")}>
                        Restore
                      </button>
                    ) : (
                      <button className={actionButtonClass} onClick={() => handleAction(post.id, "archive")}>
                        Archive
                      </button>
                    )}
                    {isOwner ? (
                      <button
                        className={`customButtonDefault text-red-600 ${post.status === "PUBLISHED" ? "!bg-white !text-logoblue" : ""}`}
                        onClick={() => setPendingDeleteId(post.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            className="customButtonDefault"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            Previous
          </button>
          <span className="text-sm text-textColorSecond">
            Page {page} of {totalPages}
          </span>
          <button
            className="customButtonDefault"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-textcolor">Delete?</h2>
            <p className="mt-2 text-sm text-textColorSecond">
              This cannot be undone. The blog post and all of its sections will be permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="customButtonDefault" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
              <button
                className="customButtonEnabled bg-red-600"
                onClick={() => handleDelete(pendingDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
