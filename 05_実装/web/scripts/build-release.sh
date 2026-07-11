#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATEWAY_ROOT="$(cd "$ROOT/../gateway" && pwd)"
OUT="$ROOT/release"
rm -rf "$OUT"
mkdir -p "$OUT/webroot/api" "$OUT/setup"
cd "$ROOT"
npm ci
npm run build
find api -name '*.php' -print0 | xargs -0 -n1 php -l >/dev/null
for test_file in tests/*.php; do php "$test_file"; done
cp -R dist/. "$OUT/webroot/"
rsync -a --exclude='config.php' --exclude='config.sample.php' api/ "$OUT/webroot/api/"
cp api/config.sample.php "$OUT/setup/config.sample.php"
cp -R database "$OUT/setup/database"
cp scripts/install.php scripts/release-check.php scripts/generate-production-config.php "$OUT/setup/"
tar -C "$OUT/webroot" -czf "$OUT/shalomworks-live-interpreter-webroot.tar.gz" .
tar -C "$OUT/setup" -czf "$OUT/shalomworks-live-interpreter-setup.tar.gz" .
cd "$GATEWAY_ROOT"
npm ci
npm test
tar --exclude='node_modules' --exclude='.env' -czf "$OUT/shalomworks-live-interpreter-gateway.tar.gz" Dockerfile package.json package-lock.json src deploy
printf 'Release packages created in %s\n' "$OUT"
