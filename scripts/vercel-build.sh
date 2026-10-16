#!/bin/bash
set -e

# Migrate needs a session-level advisory lock, which hangs (P1002) through
# Neon's PgBouncer pooler — run migrations against the direct (non "-pooler")
# host. The app keeps using the pooled URL at runtime. No-op for non-Neon URLs.
DATABASE_URL="${DATABASE_URL/-pooler./.}" \
  npx prisma migrate deploy --schema=prisma/schema.prisma
ARCHIVE_DATABASE_URL="${ARCHIVE_DATABASE_URL/-pooler./.}" \
  npx prisma migrate deploy --config node_modules/@customprojects/custom-archive/prisma.config.ts

# No catalog seeding here: the seed:* scripts refuse a non-local DATABASE_URL, so
# they can't run in a hosted build. Seed a hosted database by hand instead.

npm run build
