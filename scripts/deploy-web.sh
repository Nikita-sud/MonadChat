#!/usr/bin/env bash
# Deploys web/ to Vercel production: npm run deploy:web
#
# History: deploys used to be silently BLOCKED because the git commit author
# was not a member of the Vercel team. That is fixed properly now (the email
# was added to the team), so no .git tricks are needed. The check below only
# heals the repo if an interrupted old version of this script left .git parked.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -d .git-parked ] && [ ! -d .git ]; then
  mv .git-parked .git
  echo "restored .git left parked by an interrupted earlier run"
fi

cd web
npx vercel deploy --prod --yes
