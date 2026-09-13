#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker wurde nicht gefunden. Installiere Docker Engine und starte dieses Skript erneut."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 wurde nicht gefunden."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL wurde nicht gefunden. Es wird für sichere Instanzgeheimnisse benötigt."
  exit 1
fi

if [ ! -f .env ]; then
  umask 077
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  SCOPE_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  SCOPE_SESSION_SECRET="$(openssl rand -hex 48)"
  SCOPE_SETUP_TOKEN="$(openssl rand -hex 24)"
  {
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "SCOPE_ENCRYPTION_KEY=${SCOPE_ENCRYPTION_KEY}"
    echo "SCOPE_SESSION_SECRET=${SCOPE_SESSION_SECRET}"
    echo "SCOPE_SETUP_TOKEN=${SCOPE_SETUP_TOKEN}"
    echo "SCOPE_PORT=3000"
    echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
  } > .env
  echo "Sichere Konfiguration wurde in .env angelegt."
else
  echo "Vorhandene .env wird beibehalten."
fi

docker compose up -d --build
SCOPE_PORT_VALUE="$(sed -n 's/^SCOPE_PORT=//p' .env | tail -n 1)"
SCOPE_SETUP_TOKEN_VALUE="$(sed -n 's/^SCOPE_SETUP_TOKEN=//p' .env | tail -n 1)"
echo "Scope startet unter http://localhost:${SCOPE_PORT_VALUE:-3000}/?setup=${SCOPE_SETUP_TOKEN_VALUE}"
