#!/bin/bash
set -e

mkdir -p ~/.ssh
echo "$SSH_KEY" | base64 -d > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan github.com >> ~/.ssh/known_hosts

npm install
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run build
