# Janaseva AI backend

NestJS REST API and Prisma setup for the Janaseva AI demonstration platform.

## Setup

```bash
npm install
cp -n ../.env.example .env
npm run prisma:generate
```

To run database migrations, start PostgreSQL from the repository root with `docker compose up -d postgres`, then run:

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

## Run and validate

```bash
npm run start:dev
npm run lint
npm run build
npm test
npm run test:e2e
```

The readiness endpoint is `GET /health` on port `3002` by default, matching the frontend's API URL. It returns `200` only when PostgreSQL is reachable and `503` when the database is unavailable. Start the existing database service with `docker compose up -d postgres` before using document APIs.

## Document verification

The API persists synthetic application records, document requirements, upload versions, verification status, missing-document requests, and activity history in PostgreSQL. Files are stored outside the public web root under `.private-documents` by default; set `DOCUMENT_STORAGE_PATH` to an appropriately restricted persistent directory for local use.

Non-production requests can use the explicitly marked demo headers when
`DOCUMENT_VERIFICATION_DEMO_AUTH_ENABLED` is not `false`; they are always
rejected in production. Production login uses `AUTH_JWT_SECRET` (at least 32
random bytes), `AUTH_JWT_ISSUER`, and the configured `FRONTEND_ORIGIN`.
`POST /api/auth/login` sets an HttpOnly, SameSite=Lax session cookie. `GET
/api/auth/session` returns the authenticated officer profile, and `POST
/api/auth/logout` revokes the database session and clears its cookie. Session IDs
are verified against PostgreSQL on protected requests. Login failure limits
are stored in PostgreSQL for serverless-safe enforcement.

Apply the new schema migration explicitly using the direct
`DATABASE_URL_UNPOOLED` connection for production. It creates credential,
session, and login-attempt tables but does not insert or update users. Then run
`npm run auth:provision-reviewer` in an interactive terminal to attach an
Argon2id credential to an existing active authorized officer. This command
does not create users and is never run by the application or migration.
It requires a password of at least 12 characters and refuses to overwrite an
existing credential. For local testing only, `npm run auth:provision-local-demo`
targets the existing `demo-authorized-officer` on a loopback database and
requires an explicit `LOCAL DEMO` confirmation. That local-only command may
use a short password; never use it with a production database.

Uploads accept PDF, JPEG, and PNG files up to 10 MB. The seed contains synthetic applications and no document file content.

## Field verification

The field-verification migration adds application location and priority fields, synthetic VA / RI officers, one field-verification record per application, and append-only activity records. Apply it with `npm run prisma:migrate:deploy`; the seed also includes the VA / RI demo users for fresh databases.

Routes include:

- `GET /api/field-verification` and `GET /api/field-verification/officers`
- `GET /api/applications/:applicationId/field-verification`
- `POST /api/applications/:applicationId/field-verification/assign`
- `POST /api/applications/:applicationId/field-verification/schedule`
- `PATCH /api/field-verification/:id/schedule`
- `POST /api/field-verification/:id/start`
- `PUT /api/field-verification/:id/draft`
- `POST /api/field-verification/:id/submit`
- `GET /api/field-verification/:id/history`
- `POST /api/field-verification/assist`

Schedule, start, draft, and report rules are enforced in the service. In particular, all required document categories must have a verified latest version before a visit can be scheduled, started, or reported. Final reports move the application to `FINAL_REVIEW`; a report requesting follow-up stays in `FIELD_VERIFICATION`.

The assistant endpoint is intentionally deterministic and advisory-only. It echoes officer-entered observations and identifies incomplete checklist items; it is not an LLM integration and must not be used to make an eligibility or government decision. Demo field-officer identity selection is gated by the same non-production demo-auth setting and active database role checks as other demo access.
