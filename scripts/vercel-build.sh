#!/bin/bash
set -e

npx prisma migrate deploy --schema=prisma/schema.prisma
npx prisma migrate deploy --config node_modules/@customprojects/custom-archive/prisma.config.ts

# No catalog seeding here: the seed:* scripts refuse a non-local DATABASE_URL, so
# they can't run in a hosted build. Seed a hosted database by hand instead.

npm run build
