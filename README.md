# Scope

Scope is a focused, self-hosted project planner for individuals and teams. It combines list, board and calendar planning with optional, review-first AI assistance.

## Included product areas

- Guided solo/team onboarding with optional AI provider choice
- Responsive project board, list, calendar and My Work views
- Fast task creation, detail panel and keyboard-accessible status movement
- Command palette with `⌘/Ctrl + K`
- Scope Assist proposal preview with explicit approval
- Light, dark and system appearances, density and accent controls
- Persistent PostgreSQL/Drizzle backend with local accounts, sessions and role checks
- Projects, tasks/subtasks, comments, invitations, activity/undo and live SSE events
- AES-256-GCM provider-secret encryption, AI policies and validated proposal/apply flow
- OpenAI, Anthropic, Gemini, OpenRouter, Ollama and compatible provider adapters
- PWA manifest, health endpoint, OpenAPI seed and Docker Compose deployment
- Workspace dashboard with Scope Health, workload and overdue signals
- Milestones, dependency/blocker graph, recurring tasks and saved filter views
- Private local or S3-compatible attachments with authorized downloads
- Notification center with optional SMTP and standards-based Web Push delivery
- No-code event automations with run history and retryable PostgreSQL jobs
- Consent-gated meeting recording/upload, editable transcripts and AI summaries
- Owner-only self-hosting health page with database, worker, storage and backup status

The UI loads its workspace, projects and tasks from `/api/v1` and writes task changes back with optimistic concurrency control. Planner features remain usable when no AI provider is configured.

## Local development

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and complete the one-time setup.

## Self-hosting

```bash
./install.sh
```

The idempotent installer keeps an existing `.env`, generates secrets and a one-time setup token only on first run, builds the containers, applies versioned migrations and prints the setup URL. Change `SCOPE_PORT` in `.env` when port 3000 is occupied.

```bash
./scripts/backup.sh
```

The backup includes PostgreSQL, uploads, checksums and a protected copy of `.env`. Store it encrypted away from the host. Losing `SCOPE_ENCRYPTION_KEY` makes saved provider keys unrecoverable. Restore and update procedures are documented in [Production operations](./docs/production.md).

Uploads are stored in the `scope_uploads` Docker volume by default. An S3-compatible store can be selected from the owner page after its credentials have been supplied through the environment variables documented in `.env.example`.

### Optional local meeting transcription

Scope can call any OpenAI-compatible transcription endpoint. For a fully local CPU-based Whisper service, start the supplied optional Compose profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.transcription.yml --profile transcription up -d
```

The first transcription downloads the selected model and can therefore take longer. Change `SCOPE_TRANSCRIBER_MODEL=base` in `.env` to another Whisper model when the host has enough memory. The bundled optional service uses the maintained Whisper ASR Webservice image; recordings remain inside the deployment network.

### Optional notifications

SMTP and Web Push are off until their respective `SCOPE_SMTP_*` or `SCOPE_VAPID_*` environment variables are configured. Users can then enable each channel in the notification center. In-app notifications work without any optional service.

### Background worker

The standard Compose stack includes a separate worker that processes recurring tasks, automation runs, notifications and transcriptions through the same PostgreSQL database. No Redis service is needed.

## Security model

- Passwords use scrypt; opaque session tokens are hashed in PostgreSQL and delivered through HttpOnly cookies.
- Mutations enforce same-origin requests, schema validation and workspace role checks.
- Provider secrets are encrypted at rest and never returned by the API.
- AI output is schema-validated and staged as a reviewable proposal before data changes.

Security issues should be reported privately as described in [SECURITY.md](./SECURITY.md). Contributions follow [CONTRIBUTING.md](./CONTRIBUTING.md).

## Production readiness

- CI checks types, tests, the production build, production dependencies and Compose configuration.
- Release tags publish `amd64` and `arm64` images with provenance and an SBOM to GHCR.
- Separate readiness and liveness endpoints support container and reverse-proxy health checks.
- Containers run without Linux capabilities, use bounded logs and receive graceful shutdown time.
- Environment validation prevents startup with missing or malformed secrets.

## Design commitments

- Semantic light/dark tokens with WCAG AA text contrast
- Visible keyboard focus, 44px touch targets and reduced-motion support
- The Scope Fold is reserved for navigation and AI change previews
- No telemetry without explicit opt-in
- AI remains optional and cannot bypass normal authorization commands

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
