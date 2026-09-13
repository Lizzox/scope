# Production operations

## Supported deployment

Scope's reference deployment is Docker Compose on a single Linux host with persistent volumes. Put a TLS reverse proxy in front of the app, expose only the app port, and keep PostgreSQL, the worker and optional transcription service on the private Compose network.

Minimum starting point: 2 CPU cores, 4 GiB RAM and SSD-backed storage. Local transcription needs additional memory based on the selected Whisper model.

## Release process

1. CI must pass type checking, unit tests, the production Next.js build, dependency audit and multi-architecture container build.
2. Create an immutable semantic tag such as `v0.2.0`.
3. The release workflow publishes signed-provenance/SBOM-capable `amd64` and `arm64` images to GHCR.
4. Back up the instance before updating.
5. Pull/build the new image, start the stack and wait for `/api/health` to return `200`.
6. Roll back to the previous image tag if readiness fails. Database migrations are forward-only, so always keep the matching pre-update backup.

## Reverse proxy

- Terminate TLS with a valid certificate.
- Forward `Host`, `X-Forwarded-Proto` and the client IP.
- Allow long-lived responses for `/api/v1/events` (Server-Sent Events).
- Set the public HTTPS origin as `NEXT_PUBLIC_APP_URL`; Scope's same-origin mutation checks rely on it.
- Keep request limits aligned with `SCOPE_MAX_UPLOAD_BYTES` (250 MiB by default).

## Backups

Run `./scripts/backup.sh` from the deployment directory. It creates a timestamped PostgreSQL custom-format dump, upload archive, checksums and a mode-`0600` copy of `.env` under `backups/`.

Store backups encrypted on another machine or object store. A backup is not complete without `.env`: the encryption key is required to recover AI provider credentials.

Test restore quarterly on an empty instance:

```bash
docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U scope -d scope < backups/TIMESTAMP/database.dump
docker compose exec -T app tar -C /data/uploads -xzf - < backups/TIMESTAMP/uploads.tar.gz
docker compose restart app worker
curl --fail http://localhost:3000/api/health
```

The restore commands replace database objects and must never be run against the wrong instance.

## Monitoring

- Readiness: `GET /api/health` checks the application and database.
- Liveness: `GET /api/health/live` confirms the web process is responding.
- The owner-only Self-Hosting page shows queue failures, storage use and optional service status.
- Alert on repeated container restarts, readiness failures, PostgreSQL disk growth and failed jobs.
- Compose rotates each service's local JSON logs at 10 MiB with three files.

## Secrets

- Never commit `.env` or backups.
- Generate a unique `SCOPE_ENCRYPTION_KEY`, `SCOPE_SESSION_SECRET`, database password and setup token per installation.
- Back up the encryption key separately. Rotating it requires re-encrypting stored provider secrets.
- Prefer Docker secrets or a host secret manager when operating beyond a single trusted host.
- Scope does not mount the Docker socket and has no implicit host administration rights.

## Incident basics

For a suspected credential leak, disconnect the instance, rotate provider/API keys and session secret, revoke exposed invitations, inspect activity and job logs, then restore from a known-good backup if data integrity is uncertain. Preserve logs before cleanup.
