-- Adds a per-post "exclude from search engines" toggle to BlogPost.
ALTER TABLE "BlogPost" ADD COLUMN "noIndex" BOOLEAN NOT NULL DEFAULT false;
