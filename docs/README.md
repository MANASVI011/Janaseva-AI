# Project notes

Janaseva AI is a demonstration application, not an official government service. The interface and seeded application records use synthetic demonstration data.

## Service boundaries

- `frontend/` contains the Next.js App Router client.
- `backend/` contains the NestJS REST API and Prisma PostgreSQL schema, including protected document-verification operations.
- `ai-service/` contains the FastAPI service.
- PostgreSQL is provided by the root Docker Compose configuration.

The backend persists document metadata, immutable upload versions, verification actions, and activity history. Its document-verification routes require an officer token; the repository does not include a production identity provider. Uploaded files are stored privately on local disk by default.

The application-details workflow and final-decision actions remain demonstration state. The AI assistant uses deterministic mock responses and does not analyze uploaded documents. pgvector and live AI processing are deferred.
