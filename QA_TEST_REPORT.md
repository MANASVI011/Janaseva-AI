# Janaseva AI QA Test Report

**Test date:** 2026-11-09

**Environment:** Local macOS development environment; browser frontend on
`localhost:3001`, NestJS on `localhost:3002`, PostgreSQL on `localhost:5432`,
and FastAPI on `127.0.0.1:8000`. Synthetic demo data only.

## Summary

- **Overall:** PASS for the tested read-only pages, service health, tests, and
  one controlled synthetic AI analysis. This is not a complete write-workflow
  or production-readiness certification.
- **Database safety:** No application, document, field-verification, or
  decision records were changed by this QA run. No migrations, seeds,
  destructive operations, or upload/decision actions were run.
- **AI:** One real synthetic Kannada analysis completed through the browser,
  NestJS, authenticated FastAPI, and Groq. It returned HTTP 201 in
  approximately 720 ms and rendered the expected response fields and advisory
  disclaimer.

## Environment and health checks

| Check                                   | Status  | Result                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                                | PASS    | `http://localhost:3001` returned HTTP 200.                                                                                                                                                                                                                                      |
| NestJS                                  | PASS    | `GET /health` returned HTTP 200.                                                                                                                                                                                                                                                |
| FastAPI                                 | PASS    | `GET /health` returned HTTP 200.                                                                                                                                                                                                                                                |
| PostgreSQL                              | PASS    | Docker Compose reports the `postgres` service running; TCP port 5432 is open; backend health also passed.                                                                                                                                                                       |
| Required local AI configuration         | PASS    | Provider/model/key presence checked without printing values. Backend and FastAPI internal token presence and equality confirmed without printing the token.                                                                                                                     |
| Authenticated FastAPI provider status   | PASS    | HTTP 200; provider Groq, model `qwen/qwen3.8-27b`, status `CONFIGURED`; `Cache-Control` includes `no-store`.                                                                                                                                                                    |
| NestJS-to-FastAPI/provider connectivity | PASS    | Authenticated `GET /api/ai/provider-status?checkConnectivity=true` returned HTTP 200 and `CONNECTED`.                                                                                                                                                                           |
| Unauthenticated backend request         | BLOCKED | `GET /api/reports` without demo auth or a bearer token returned HTTP 503 because a JWT secret meeting the required minimum length is not configured. Development demo auth is enabled and authenticated UI/API requests succeeded. Production signed-officer auth is not ready. |

No secret values, authorization headers, or internal tokens were recorded.

## Page-by-page results

| Page / route                                   | Status           | Evidence and limits                                                                                                                                                                                                                    |
| ---------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard `/`                                  | PASS             | Loaded; API-backed cards matched report totals: 9 total, 8 pending, 8 requiring attention, 1 approved. Five recent activity rows loaded.                                                                                               |
| Applications `/applications`                   | PASS             | Search for `DEMO-FINAL-REVIEW-001` returned one row; `COMPLETED` stage filter preserved that row. The same application ID opened in the workspace. Nine total records meant pagination was not exercised.                              |
| Application Workspace `/applications/[id]`     | PASS             | Synthetic application loaded with applicant/application, document, field, history, and AI sections. The AI response was displayed. Preview/download of an existing document was not tested.                                            |
| Document Verification `/document-verification` | PASS             | Route and authenticated queue API loaded; queue total 9. Search/filter/write actions were not comprehensively tested. Upload/verify/reject/replacement were not attempted because they mutate records/files.                           |
| Field Verification `/field-verification`       | PASS             | Route and authenticated queue API loaded; queue total 9, one submitted report. Filters were rendered. Assignment, scheduling, start, draft, and report submission were not attempted because they mutate records.                      |
| Final Review `/final-review`                   | PASS (read-only) | Authenticated endpoint returned HTTP 200, but current pending review queue total was 0. No approve/reject/return action was attempted. Live decision persistence remains unverified.                                                   |
| Reports `/reports`                             | PASS             | Loaded; displayed totals matched the report API. Invalid date range was rejected with a localized validation alert. The report CSV API returned HTTP 200, `text/csv`, the expected header, and 9 data rows.                            |
| Application History `/history`                 | PASS             | Authenticated API returned HTTP 200 and 59 events. History CSV API returned HTTP 200, the expected header, and 59 data rows. Submission events are derived from application records; document/field/decision activities are persisted. |
| Settings `/settings`                           | PASS (read-only) | Profile API returned HTTP 200. Authentication type was `DEMONSTRATION`; department and district were null; official-portal flag was false. Notification preferences are not implemented.                                               |

All nine routes returned HTTP 200 in the browser. At `1440 × 900` and
`390 × 844`, the tested pages had no horizontal page overflow. English and
Kannada headings rendered; the language selection survived refresh and was
restored to Kannada after testing.

## Workflow and persistence

- **Application intake:** NOT IMPLEMENTED. The database contains seeded
  synthetic applications; there is no citizen submission route.
- **Application search/filter:** PASS for a synthetic application ID and
  workflow-stage filter. Refreshing its workspace loaded the backend record.
- **Document upload/verification:** BLOCKED for live mutation testing in this
  shared database. The application stores files on local private disk and
  metadata/status/history in PostgreSQL. Unit tests cover file validation,
  but no live upload was attempted.
- **Field verification:** BLOCKED for live mutation testing. Queue data and
  API responses loaded; no assignment, visit, draft, or report was written.
- **Final Review:** BLOCKED for decision testing. The queue was empty. Existing
  `DEMO-FINAL-REVIEW-001` is already completed/approved and was not changed.
  The service has transactional decision logic, but the live PostgreSQL
  transaction was not exercised.
- **Reports/history:** PASS for read-only API data and CSV response content.
  Browser-generated CSV file download was NOT TESTED: the integrated browser
  automation did not emit a download event for its scripted button activation.
  The endpoint response and download headers were separately confirmed.
- **AI:** PASS for a single synthetic Kannada analysis; see separate section.

No application status/decision changes were made. The application still
appeared as completed/approved after the AI request; the AI service code reads
application data and does not write decision/status fields.

## AI integration

| Check                           | Status | Result                                                                                                                                                                                                                                  |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groq configuration              | PASS   | `AI_PROVIDER=groq`, model `qwen/qwen3.8-27b`; key presence confirmed without printing it.                                                                                                                                               |
| Provider model connectivity     | PASS   | Authenticated provider connectivity check through NestJS reported `CONNECTED`.                                                                                                                                                          |
| Internal FastAPI authentication | PASS   | Authenticated FastAPI provider-status HTTP 200; service token matched between backend and AI service (value not exposed).                                                                                                               |
| Controlled analysis             | PASS   | Exactly one POST to the browser's `DEMO-FINAL-REVIEW-001` analysis endpoint; HTTP 201, ~720 ms.                                                                                                                                         |
| Response schema                 | PASS   | Received `summary`, `missingInformation`, `potentialInconsistencies`, `documentObservations`, `fieldVerificationObservations`, `suggestedQuestions`, `officerAttentionPoints`, and `disclaimer`; all types matched the expected schema. |
| UI display and disclaimer       | PASS   | The Kannada summary was visible in the workspace and the advisory-only human-decision disclaimer was present.                                                                                                                           |
| Decision permissions            | PASS   | No decision action was performed; AI analysis remains advisory.                                                                                                                                                                         |

The six list fields were present and empty for this synthetic sample. The
summary was 171 characters. The test did not use real applicant information
and no application file bytes were sent.

## Browser errors and limitations

- During the first route sweep, no page console errors, failed API requests,
  or API responses with status 400+ were observed.
- A separate QA-only direct API probe added a `Cache-Control` request header
  that the backend CORS allowlist does not accept. The browser correctly
  reported a CORS preflight failure for that probe. Removing the extra header
  made all authenticated read requests succeed. This was caused by the QA
  probe, not the application's normal API client.
- The report CSV endpoint returned a valid CSV response and download headers.
  The integrated browser automation could not produce a download event from
  its scripted button activation, so the actual browser-saved file and its
  contents were not verified.
- No checked-in Playwright configuration, Playwright dependency, or frontend
  browser-test script exists. The browser walkthrough used the integrated
  browser, not a reproducible repository test suite.
- Invalid/oversized live file uploads, document preview rendering, field
  duplicate-submit behavior, field write paths, and officer decision
  persistence were not tested.
- Frontend handling of deliberately injected API outages, upstream AI
  failures, and timeout responses was not tested. Backend/provider error
  mapping is covered by service tests, but that does not verify each UI error
  state.
- The configured JWT secret does not meet the minimum length checked by the
  backend. Development demo authentication works, but production signed JWT
  authentication must be configured and tested before deployment.
- The private local document directory contained 9 files before this QA run.
  Their contents were not inspected, copied, or changed; verify they are
  synthetic before sharing the workspace.
- The worktree already had 11 staged `qa-output/` screenshots/CSV files.
  Their content was not re-reviewed during this test run. Review them for
  synthetic-only data before publishing. The staged CSVs also have existing
  trailing-whitespace warnings; they were not edited.

## Automated checks

| Command/check                                      | Status | Result                                 |
| -------------------------------------------------- | ------ | -------------------------------------- |
| `cd frontend && npm run lint`                      | PASS   | ESLint completed.                      |
| `cd frontend && npm run format:check`              | PASS   | Prettier reported all files formatted. |
| `cd frontend && npx tsc --noEmit`                  | PASS   | TypeScript check completed.            |
| `cd frontend && npm run build`                     | PASS   | Next.js production build completed.    |
| `cd backend && npm run lint`                       | PASS   | Oxlint completed.                      |
| `cd backend && npm run format:check`               | PASS   | Prettier reported all files formatted. |
| `cd backend && npx tsc --noEmit`                   | PASS   | TypeScript check completed.            |
| `cd backend && npm test`                           | PASS   | 57 tests across 8 files passed.        |
| `cd backend && npm run build`                      | PASS   | NestJS production build completed.     |
| `cd backend && npm run test:e2e`                   | PASS   | 9 tests across 3 files passed.         |
| `cd ai-service && .venv/bin/ruff check .`          | PASS   | Ruff lint completed.                   |
| `cd ai-service && .venv/bin/ruff format --check .` | PASS   | Six Python files formatted.            |
| `cd ai-service && .venv/bin/pytest -q`             | PASS   | 25 tests passed.                       |

The initial backend e2e run found a stale mock disclaimer in
`backend/test/ai-analysis.e2e-spec.ts`. The fixture was corrected to match the
current backend validation contract; assertions were preserved, and all 9
e2e tests passed on rerun.

## Bugs fixed and remaining work

**Fixed:** Updated the outdated AI e2e mock disclaimer in
`backend/test/ai-analysis.e2e-spec.ts`. This corrected the test fixture, not
application behavior.

**Before submission/deployment:**

1. Configure and test a production-grade officer JWT secret and trusted token
   issuer; do not rely on demo-header authentication in production.
2. Test document and field write paths and Final Review persistence against an
   isolated disposable database.
3. Verify browser CSV downloads with a real user gesture or a repository
   Playwright setup that accepts downloads.
4. Review staged `qa-output/` exports/screenshots for synthetic-only content;
   historical QA claims about notification settings are not supported by the
   current Settings implementation.
5. Replace local filesystem document storage with appropriately secured,
   persistent object storage before cloud deployment.
6. Add a reproducible browser test suite and complete backup/restore,
   deployment, monitoring, and operational procedures.
