# Google Reviews Cron

## Source

- `app/api/cron/google-reviews-refresh/route.ts`
- `lib/site/googleReviews.ts`

## Responsibility

Keeps the homepage's "top 3 reviews" section (`app/_components/site/pageComponents/HomePage.tsx`,
testimonials block) populated with real Google reviews.

The cache is written only by this cron route, never by a page request:
`refreshGoogleReviewsCache()` calls the Google Places API (New) and upserts a
single `GoogleReviewsCache` row; `getCachedGoogleReviews()` (used by
`app/(site)/[locale]/page.tsx`) only ever reads that row. This split keeps
Google's API off the request path entirely — no added homepage latency, and
no homepage failure mode if Google's API is slow or down.

**There is no static fallback.** If there are no reviews to show for any
reason — the cron hasn't run yet on a fresh deploy, the DB is unreachable, or
Google returned nothing usable — `homePageContent.testimonials` stays empty
and the entire testimonials section (heading included) is skipped rather than
rendering placeholder copy or an empty heading. The rest of the homepage is
unaffected.

`refreshGoogleReviewsCache()` fetches
`GET https://places.googleapis.com/v1/places/{GOOGLE_PLACE_ID}` with the
`rating,userRatingCount,reviews` field mask, takes the first 3 entries from
whatever `reviews[]` Google returns (its default relevance ranking, not
re-sorted), and stores `{ authorName, authorPhotoUrl, rating, text,
publishTime }` per review plus the place's `overallRating`/`reviewCount`.

**One fetch per locale.** Google returns a *different set of reviews*
depending on the `languageCode` query parameter — it surfaces reviews written
in (or translated into) the requested language, and defaults to English when
the parameter is omitted. Since this business has both Norwegian and English
reviews, the cron fetches `en` and `no` separately and stores the two sets
side by side under `reviews.{en,no}`; the homepage reads the set matching its
locale. `overallRating`/`reviewCount` are locale-independent and stored once.
Adding a locale to the site means adding it to `LOCALES` in
`lib/site/googleReviews.ts`.
The latter two are captured but not currently displayed anywhere — the
static "4.9 ★ Google" stat tile in `lib/content/StatsContent.ts` stays
hardcoded; wiring it to this cache is a possible future follow-up, not done
here.

There is no in-process scheduler, so the refresh only runs when something
calls `POST /api/cron/google-reviews-refresh` — same shape as the other
`/api/cron/*` routes (see
[gdpr-cleanup-cron.md](./gdpr-cleanup-cron.md)).

## Render deployment (manual step)

This is infrastructure configuration, not something checked into the repo:

1. `CRON_SECRET` should already be set on the Render web service (reused
   as-is, no new secret needed).
2. In Google Cloud Console: enable **Places API (New)** on the project, make
   sure billing is active, and create/restrict an API key for it. Set
   `GOOGLE_PLACES_API_KEY` (the key) and `GOOGLE_PLACE_ID` (this business's
   Place ID) on the Render web service.
3. Create a **separate** Render **Cron Job** service:
   - Schedule: e.g. `0 6 * * 1` (weekly, Monday morning) — exact cadence
     doesn't matter for this feature and can be changed anytime in Render
     without a code change; monthly (`0 6 1 * *`) works just as well.
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/google-reviews-refresh
     ```
4. No manual migration step: `build.sh` already runs
   `npx prisma migrate deploy --schema=prisma/schema.prisma` on every deploy,
   so the `GoogleReviewsCache` table is created automatically when this code
   ships. Just make sure the deploy has finished before the cron job's first
   run, or that run 500s with a Prisma "table does not exist" error (harmless
   — the next run succeeds).
