#!/bin/bash
set -e

mkdir -p ~/.ssh
CLEAN_KEY=$(printf '%s' "$SSH_KEY" | tr -d '\r')
if echo "$CLEAN_KEY" | grep -q "PRIVATE KEY"; then
  echo "$CLEAN_KEY" | sed -n '/-----BEGIN/,/-----END/p' > ~/.ssh/id_ed25519
else
  echo "$CLEAN_KEY" | base64 -d > ~/.ssh/id_ed25519
fi
tr -d '\r' < ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.clean
echo >> ~/.ssh/id_ed25519.clean
mv ~/.ssh/id_ed25519.clean ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keygen -y -f ~/.ssh/id_ed25519 > /dev/null || {
  echo "SSH_KEY did not decode to a valid private key. Make sure it's the base64 of the PRIVATE key file (not the .pub file)." >&2
  exit 1
}
ssh-keyscan github.com >> ~/.ssh/known_hosts

echo "Key fingerprint in use:"
ssh-keygen -lf ~/.ssh/id_ed25519
ssh -vT -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 git@github.com 2>&1 | grep -iE "identity|offering|load key|invalid|authenticat|denied|Hi " || true

export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
echo "ls-remote CustomProjectsAS:"
git ls-remote ssh://git@github.com/CustomProjectsAS/custom-archive.git HEAD 2>&1 | tail -3 || true
echo "ls-remote RonaldsKrastins:"
git ls-remote ssh://git@github.com/RonaldsKrastins/custom-archive.git HEAD 2>&1 | tail -3 || true

npm install
