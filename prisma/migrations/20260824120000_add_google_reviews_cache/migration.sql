CREATE TABLE "GoogleReviewsCache" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "overallRating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "reviews" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleReviewsCache_pkey" PRIMARY KEY ("id")
);
