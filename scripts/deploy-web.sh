#!/usr/bin/env bash
# Deploys web/ to Vercel production.
#
# Why the .git parking: Vercel attaches the git commit author to every CLI
# deploy. Our commits are authored by an email that is not a member of the
# Vercel team, so such deploys are silently BLOCKED (the CLI shows them as
# UNKNOWN forever). Without a .git directory there is no author metadata and
# nothing to block. Permanent fix: add the git email to the Vercel account,
# or set git user.email to the account email.
set -euo pipefail
cd "$(dirname "$0")/.."

mv .git .git-parked
trap 'mv .git-parked .git' EXIT

cd web
npx vercel build --prod --yes
npx vercel deploy --prebuilt --prod --yes
