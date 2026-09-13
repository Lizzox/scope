#!/usr/bin/env sh
set -eu

destination="${1:-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${destination}/${timestamp}"

mkdir -p "${target}"
docker compose exec -T postgres pg_dump -U scope -d scope --format=custom > "${target}/database.dump"
docker compose exec -T app tar -C /data/uploads -czf - . > "${target}/uploads.tar.gz"

if [ -f .env ]; then
  cp .env "${target}/environment.env"
  chmod 600 "${target}/environment.env"
fi

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${target}/database.dump" "${target}/uploads.tar.gz" > "${target}/SHA256SUMS"
else
  sha256sum "${target}/database.dump" "${target}/uploads.tar.gz" > "${target}/SHA256SUMS"
fi

echo "Scope backup created at ${target}"
