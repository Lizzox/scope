# Contributing to Scope

Scope is AGPLv3 software. By contributing, you agree that your contribution is distributed under the repository license.

## Development

Use Node.js 24 LTS (Node.js 26 is also accepted for development) and PostgreSQL 17. Copy `.env.example` to a private local `.env`, then run:

```bash
npm ci
npm run db:migrate
npm run dev
```

Before opening a pull request, run `npm run check`. Commit generated Drizzle migrations whenever the schema changes. Never commit real credentials, database dumps, recordings or user attachments.

Keep UI changes keyboard-accessible, responsive at 360/768/1440 px and compatible with reduced motion. AI-originated mutations must remain schema-validated, policy-limited, reviewable and auditable.
