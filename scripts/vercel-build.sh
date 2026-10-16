#!/bin/bash
set -e

# Migrate needs a session-level advisory lock, which hangs (P1002) through
# Neon's PgBouncer pooler — run migrations against the direct (non "-pooler")
# host. The app keeps using the pooled URL at runtime. No-op for non-Neon URLs.
#
# A suspended Neon compute takes a few seconds to wake on a direct connection,
# longer than Prisma's default 5 s connect timeout (P1001 "Can't reach database
# server") — so allow 30 s, and retry a migrate that still fails to connect.
migrate_url() {
  local url="${1/-pooler./.}"
  if [[ -n "$url" && "$url" != *connect_timeout=* ]]; then
    if [[ "$url" == *\?* ]]; then url="${url}&connect_timeout=30"; else url="${url}?connect_timeout=30"; fi
  fi
  printf '%s' "$url"
}

with_retries() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then return 0; fi
    if [[ $attempt -lt 3 ]]; then
      echo "migrate failed (attempt $attempt of 3), retrying in 10 s…" >&2
      sleep 10
    fi
  done
  return 1
}

DATABASE_URL="$(migrate_url "$DATABASE_URL")" \
  with_retries npx prisma migrate deploy --schema=prisma/schema.prisma
ARCHIVE_DATABASE_URL="$(migrate_url "$ARCHIVE_DATABASE_URL")" \
  with_retries npx prisma migrate deploy --config node_modules/@customprojects/custom-archive/prisma.config.ts

# No catalog seeding here: the seed:* scripts refuse a non-local DATABASE_URL, so
# they can't run in a hosted build. Seed a hosted database by hand instead.

npm run build
