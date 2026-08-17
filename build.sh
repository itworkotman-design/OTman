#!/bin/bash
set -e

mkdir -p ~/.ssh
CLEAN_KEY=$(printf '%s' "$SSH_KEY" | tr -d '\r')
if echo "$CLEAN_KEY" | grep -q "PRIVATE KEY"; then
  echo "$CLEAN_KEY" | sed -n '/-----BEGIN/,/-----END/p' > ~/.ssh/id_ed25519
else
  echo "$CLEAN_KEY" | base64 -d > ~/.ssh/id_ed25519
fi
chmod 600 ~/.ssh/id_ed25519
ssh-keygen -y -f ~/.ssh/id_ed25519 > /dev/null || {
  echo "SSH_KEY did not decode to a valid private key. Make sure it's the base64 of the PRIVATE key file (not the .pub file)." >&2
  exit 1
}
ssh-keyscan github.com >> ~/.ssh/known_hosts

npm install
npx prisma migrate deploy --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=node_modules/@customprojects/custom-archive/prisma/schema.prisma
npm run build
