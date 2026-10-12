"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

type ReviewsResponse = {
  ok: boolean;
  reviews: Review[];
  hasMore: boolean;
  nextCursor: string | null;
  reason?: string;
};

const INITIAL_VISIBLE_REVIEWS = 6;

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          className={`w-4 h-4 ${value <= rating ? "text-logoblue" : "text-slate-200"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345l2.125-5.111Z" />
        </svg>
      ))}
    </div>
  );
}

async function loadReviews(cursor?: string): Promise<ReviewsResponse | null> {
  const searchParams = new URLSearchParams();
  if (cursor) searchParams.set("cursor", cursor);

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const res = await fetch(`/api/dashboard/reviews${query}`, {
    credentials: "include",
    cache: "no-store",
  });

  return res.json().catch(() => null);
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  useEffect(() => {
    async function refresh() {
      try {
        setLoading(true);
        const json = await loadReviews();

        if (!json?.ok) {
          setError(json?.reason || "Failed to load reviews");
          return;
        }

        setError("");
        setReviews(json.reviews);
        setHasMore(json.hasMore);
        setNextCursor(json.nextCursor);
      } catch {
        setError("Failed to load reviews");
      } finally {
        setLoading(false);
      }
    }

    void refresh();
  }, []);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setLoadMoreError("");

    try {
      const json = await loadReviews(nextCursor);

      if (!json?.ok) {
        setLoadMoreError(json?.reason || "Failed to load more reviews");
        return;
      }

      setReviews((current) => [...current, ...json.reviews]);
      setHasMore(json.hasMore);
      setNextCursor(json.nextCursor);
    } catch {
      setLoadMoreError("Failed to load more reviews");
    } finally {
      setLoadingMore(false);
    }
  }

  const visibleReviews = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE_REVIEWS);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-logoblue">Reviews</h2>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No reviews yet.
          </div>
        ) : (
          <>
            <div
              className={expanded ? "max-h-[80rem] overflow-y-auto overscroll-contain pr-2 sm:max-h-[44rem]" : ""}
              role={expanded ? "region" : undefined}
              aria-label={expanded ? "Reviews list" : undefined}
              tabIndex={expanded ? 0 : undefined}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleReviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StarDisplay rating={review.rating} />
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(review.createdAt).toLocaleDateString("nb-NO")}
                      </span>
                    </div>

                    {review.rating <= 3 && review.comment && (
                      <p className="mt-3 text-sm text-slate-600">&quot;{review.comment}&quot;</p>
                    )}
                  </div>
                ))}
              </div>

              {expanded && hasMore && nextCursor && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    className="customButtonDefault min-w-40"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load 30 more"}
                  </button>
                </div>
              )}

              {expanded && loadMoreError && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadMoreError}
                </div>
              )}
            </div>

            {!expanded && reviews.length > INITIAL_VISIBLE_REVIEWS && (
              <div className="flex justify-center pt-4">
                <button type="button" className="customButtonDefault min-w-40" onClick={() => setExpanded(true)}>
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
