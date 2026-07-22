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
  reason?: string;
};

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

async function loadReviews(): Promise<ReviewsResponse | null> {
  const res = await fetch("/api/dashboard/reviews", {
    credentials: "include",
    cache: "no-store",
  });

  return res.json().catch(() => null);
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function refresh() {
      setLoading(true);
      const json = await loadReviews();

      if (!json?.ok) {
        setError(json?.reason || "Failed to load reviews");
        setLoading(false);
        return;
      }

      setError("");
      setReviews(json.reviews);
      setLoading(false);
    }

    void refresh();
  }, []);

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-flow-col sm:grid-rows-3">
            {reviews.map((review) => (
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
        )}
      </div>
    </div>
  );
}
