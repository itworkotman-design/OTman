#!/bin/bash
set -e

npx prisma migrate deploy --schema=prisma/schema.prisma
npx prisma migrate deploy --config node_modules/@customprojects/custom-archive/prisma.config.ts

# Idempotent (upsert-based) — safe to run on every deploy. Unlike
# prisma/seed.ts, this doesn't touch Company/User/Membership/Order rows, so it
# never wipes tester-created data.
npm run seed:white-goods-catalog

npm run build
