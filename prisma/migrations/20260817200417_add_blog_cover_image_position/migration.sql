-- Migration: Add BlogPost.coverImagePosition (vertical focal-point %, 0-100, default 50)

ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "coverImagePosition" INTEGER DEFAULT 50;
