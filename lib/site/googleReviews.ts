import { prisma } from "@/lib/db";

const CACHE_ID = "main";
const FETCH_TIMEOUT_MS = 8000;
const MAX_REVIEWS = 3;

// Google returns a *different* set of reviews per language — it surfaces the
// ones written in (or translated into) the requested locale — so each locale
// is fetched and cached separately rather than sharing one set.
const LOCALES = ["en", "no"] as const;

export type Locale = (typeof LOCALES)[number];

export type GoogleReviewCacheEntry = {
  id: string;
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number;
  text: string;
  publishTime: string;
};

export type GoogleReviewsByLocale = Record<Locale, GoogleReviewCacheEntry[]>;

type PlacesApiReview = {
  name?: string;
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
  publishTime?: string;
};

type PlacesApiResponse = {
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesApiReview[];
};

async function fetchGoogleReviews(locale: Locale): Promise<{
  overallRating: number | null;
  reviewCount: number | null;
  reviews: GoogleReviewCacheEntry[];
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    throw new Error("GOOGLE_PLACES_ENV_MISSING");
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  url.searchParams.set("languageCode", locale);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => null)) as PlacesApiResponse | null;

  if (!response.ok || !data) {
    throw new Error("GOOGLE_PLACES_FETCH_FAILED");
  }

  const reviews = (data.reviews ?? [])
    .slice(0, MAX_REVIEWS)
    .map((review) => ({
      id: review.name ?? crypto.randomUUID(),
      authorName: review.authorAttribution?.displayName ?? "Google user",
      authorPhotoUrl: review.authorAttribution?.photoUri ?? null,
      rating: review.rating ?? 0,
      text: review.text?.text ?? "",
      publishTime: review.publishTime ?? new Date().toISOString(),
    }))
    .filter((review) => review.text.length > 0);

  return {
    overallRating: data.rating ?? null,
    reviewCount: data.userRatingCount ?? null,
    reviews,
  };
}

// Called only from the cron route (app/api/cron/google-reviews-refresh) — writes the cache.
export async function refreshGoogleReviewsCache() {
  const results = await Promise.all(LOCALES.map((locale) => fetchGoogleReviews(locale)));

  const reviews = Object.fromEntries(
    LOCALES.map((locale, index) => [locale, results[index].reviews]),
  ) as GoogleReviewsByLocale;

  // The place-level rating/count are locale-independent — take them from the
  // first response rather than storing a copy per locale.
  const fresh = {
    overallRating: results[0].overallRating,
    reviewCount: results[0].reviewCount,
    reviews,
  };

  await prisma.googleReviewsCache.upsert({
    where: { id: CACHE_ID },
    create: { id: CACHE_ID, ...fresh },
    update: fresh,
  });

  return fresh;
}

// Called from the homepage — pure read, no external call, no lazy refresh.
export async function getCachedGoogleReviews(
  locale: Locale,
): Promise<GoogleReviewCacheEntry[]> {
  const cached = await prisma.googleReviewsCache.findUnique({ where: { id: CACHE_ID } });

  if (!cached) {
    return [];
  }

  const byLocale = cached.reviews as Partial<GoogleReviewsByLocale> | null;

  return byLocale?.[locale] ?? [];
}
