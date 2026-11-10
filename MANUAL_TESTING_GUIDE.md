# Janaseva AI Manual Testing Guide

This guide is for a local demonstration of Janaseva AI. It explains what each
page does, where its information comes from, and how to inspect it without
changing existing records.

Janaseva AI is not an official Karnataka government portal. There is no
citizen-facing application-submission page. The current starting data is
synthetic and is loaded into PostgreSQL by the development seed/fixtures.

## Important safety rules

- Use only synthetic records and synthetic files.
- The shared local database already contains data. Do not upload, verify,
  reject, replace, schedule, submit, approve, or return an existing record
  during a read-only walkthrough.
- The private local document directory is currently empty. The four document
  versions on `DEMO-FINAL-REVIEW-001` are synthetic fixture metadata only;
  they do not have physical files to preview or download.
- `DEMO-FINAL-REVIEW-001` is currently at `FINAL_REVIEW` with no decision. It
  is a synthetic fixture and can be used for one final-decision demonstration.
- Tests that change documents, field visits, or decisions should use a separate
  disposable local database. Do not run seed/fixture SQL against a database
  containing data you need to keep.
- AI generation contacts Groq and may consume free-plan quota. Run it at most
  once when you are ready to test the provider.
- Never copy `.env` values into screenshots, chat, logs, or this guide.

## 1. Start the services

The local services use these addresses:

| Service            | Address                 |
| ------------------ | ----------------------- |
| Frontend           | <http://localhost:3001> |
| NestJS backend     | <http://localhost:3002> |
| PostgreSQL         | `localhost:5432`        |
| FastAPI AI service | <http://127.0.0.1:8000> |

For an already-configured project, start PostgreSQL from the repository root:

```bash
docker compose up -d postgres
```

In separate terminals, start each application service:

```bash
cd backend
npm run start:dev
```

```bash
cd frontend
npm run dev
```

```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For a new local installation, follow the root `README.md` environment and
dependency instructions before starting services. Do not re-run migrations or
seed scripts against a database that contains records you need to preserve.
The root Docker Compose configuration starts PostgreSQL only.

### Confirm services are available

- Open <http://localhost:3001>. There is no dedicated frontend health route.
- Open <http://localhost:3002/health>. Expect HTTP 200 and a backend health
  response. This endpoint checks PostgreSQL connectivity.
- Open <http://127.0.0.1:8000/health>. Expect HTTP 200 and an AI-service
  health response.
- In the browser, open **Settings** and confirm the demo officer profile
  loads. This reads the authenticated NestJS API.
- AI provider `CONFIGURED` means credentials/configuration are present; it
  does not by itself prove a live model response. The actual analysis test is
  described below.

The FastAPI provider-status endpoint requires the internal
`X-Janaseva-AI-Service-Token`; do not paste or display that token.

## 2. Navigate and change language

The left navigation contains these implemented routes:

| Page                  | URL                                             |
| --------------------- | ----------------------------------------------- |
| Dashboard             | `/`                                             |
| Applications          | `/applications`                                 |
| Application Workspace | `/applications/DEMO-FINAL-REVIEW-001` (example) |
| Document Verification | `/document-verification`                        |
| Field Verification    | `/field-verification`                           |
| Final Review          | `/final-review`                                 |
| Reports               | `/reports`                                      |
| Application History   | `/history`                                      |
| Settings              | `/settings`                                     |

The language controls are **ಕನ್ನಡ** and **EN** in the top bar. Kannada is the
default. Select **EN** to read the English labels below; select **ಕನ್ನಡ** to
return to Kannada. The choice is stored in this browser (local storage and a
cookie), not as an officer preference in PostgreSQL. Refresh after changing it
to confirm it persists.

## 3. Page-by-page walkthrough

### Dashboard

**Who uses it:** Any officer viewing the current operations overview.

**What it shows and where it comes from:** Summary cards, workflow/stage
breakdowns, attention items, recent activity, and quick links are based on
the NestJS reports/history APIs, which read PostgreSQL. The four top cards use
the report summary: total applications, pending applications, requiring
attention, and approved applications. The activity list uses the history API.

**Steps**

1. Select **Dashboard** in the left navigation or open `/`.
2. Wait for the four number cards and activity list to load.
3. Confirm each card says **Database records** (localized in Kannada). The
   numbers are not a frontend-only demo array.
4. In the applications table, try the **All stages** and **All priorities**
   dropdowns. Use the column headings to change sorting.
5. Use **Search by name or application ID** to find
   `DEMO-FINAL-REVIEW-001`.
6. Select a quick action such as **Applications** or **Application History**.
7. Refresh. The database-backed totals and activity should load again.

Before the QA reset, a historical run showed 9 total, 8 pending, 8 requiring
attention, and 1 approved. Those are not current expected values; use the live
dashboard and API results as the source of truth.

### Applications

**Who uses it:** Caseworkers and other authorized officers.

**What it shows and where it comes from:** A paginated, searchable
application list from `GET /api/applications`, backed by PostgreSQL.

**Steps**

1. Select **Applications** or open `/applications`.
2. Search `DEMO-FINAL-REVIEW-001` using **Search by name or application ID**.
3. Confirm one matching row appears and the same ID is shown in the row.
4. Try **All stages** and **All priorities**. The list reloads using the
   selected filter.
5. Select the row's **Open application details** control.
6. Confirm the URL contains the same application ID.
7. Refresh the workspace. Its record should load from the backend again.

There are only nine seeded records in the database observed during this
run, so pagination was not available to exercise.

### Application Workspace

**Who uses it:** Officers reviewing one application.

**What it shows and where it comes from:** The application header, applicant
and application details, document records, field verification, activity
history, and AI analysis. These panels load from separate NestJS endpoints.
Document files, when present, are private local files; the database stores
their metadata and versions.

**Steps**

1. Open a row from **Applications**, or navigate to
   `/applications/DEMO-FINAL-REVIEW-001`.
2. Confirm the application ID stays visible at the top.
3. Review **Applicant information**, **Application information**,
   **Field verification report**, **Checklist**, **Application documents**,
   and **Application activity history**.
4. Check the stage/status and document/field summaries against the
   corresponding module pages.
5. Use **Document preview** only when a real synthetic file version is
   available.
6. Do not upload or change a status on the existing shared demonstration
   record. Use an isolated disposable database for those tests.

### Document Verification

**Who uses it:** Caseworkers/officers with document permissions.

**What it shows and where it comes from:** A backend verification queue and
document status summaries from `GET /api/document-verification`.

**Read-only steps**

1. Select **Document Verification** or open `/document-verification`.
2. Confirm the queue and summary cards appear.
3. Search by **application ID, name or village**; try a document status,
   application stage, officer, date, and sort control.
4. Open a record's workspace to inspect its document list and history.
5. Refresh and confirm statuses still match the backend.

**Write-action steps (isolated test database only):**

1. Select a synthetic application and a valid synthetic PDF/JPG/PNG (up to
   10 MB).
2. Use **Upload document**, select its category, and select **Start upload**.
3. Confirm a new version appears with its upload metadata and pending status.
4. Open **Document preview** or **Download authorized file** if the file type
   is supported.
5. Use **Verify**, **Request replacement**, or the applicable replacement
   action, then confirm the displayed status and history after refresh.
6. In that isolated environment, test a wrong file extension/signature and a
   file over 10 MB. The backend accepts only PDF, JPEG, and PNG, checks file
   signatures and extensions, and rejects oversized files.

Uploads are stored outside the public web root, under
`backend/.private-documents` by default. Never use a real applicant document.

### Field Verification

**Who uses it:** Assigned VA / RI field officers and authorized officers.

**What it shows and where it comes from:** A field queue, assignment,
schedule, checklist, visit report, and activity history from the
`/api/field-verification` endpoints and PostgreSQL.

**Read-only steps**

1. Select **Field Verification** or open `/field-verification`.
2. Search for `DEMO-FINAL-REVIEW-001` or another synthetic ID.
3. Try officer, visit-status, workflow-stage, priority, date, and sort filters.
4. Select a queue item and review the current assignment, schedule,
   checklist, report, and activity history.
5. Refresh and confirm the saved values remain.

**Write-action steps (isolated test database only):**

1. Choose a record whose documents meet the scheduling requirements.
2. Choose **Assign officer** (or **Reassign**) and select a synthetic VA / RI.
3. Choose **Schedule visit**, enter a future time and synthetic location, and
   save.
4. Select **Start visit** when the application permits it.
5. Complete checklist items and enter synthetic observations.
6. Select **Save draft**, refresh, and confirm the draft values return.
7. Finish the required checklist and select **Submit report** once.
8. Confirm the field status, application stage, and activity history.
   Do not double-submit; duplicate submission behavior was not verified in
   this QA run.

### Final Review / Approval

**Who uses it:** Authorized officers and administrators. A caseworker must
not make the final decision.

**What it shows and where it comes from:** The queue and review package
combine the application, latest document versions, field report, outstanding
document requests, and prior decisions. The decision API transaction updates
the application and adds an `ApplicationDecision`.

**Read-only steps**

1. Select **Final Review** or open `/final-review`.
2. Search for a synthetic application.
3. If an eligible item appears, open it and inspect applicant details,
   verified document versions, the field checklist/report, activity history,
   and any AI advisory.
4. Review the displayed eligibility blockers. Do not treat AI as a decision.

After the QA reset, `DEMO-FINAL-REVIEW-001` is pending at `FINAL_REVIEW`, with
verified synthetic document metadata and a submitted synthetic field report.
The physical document files are absent, so do not expect their previews to
load. A single decision on this shared local database will change its state.

**Decision tests (isolated test database only):** The controls are **Approve**,
**Reject**, and **Return for correction**. Check the required remarks and
confirmation step, submit once, then refresh and inspect the decision and
history. The normal seed does not create an eligible review item. The
synthetic fixture is `backend/prisma/fixtures/final-review-demo.sql`; use it
only in a separate disposable database after migrations and seed. Do not run
it against the current shared database.

### Reports

**Who uses it:** Officers checking operational totals and exporting records.

**What it shows and where it comes from:** Database-backed summary metrics,
charts, officer workload and application rows from `GET /api/reports`.

**Steps**

1. Select **Reports** or open `/reports`.
2. Compare the total, document-pending, field-stage, and completed cards with
   the unfiltered API/report data.
3. Try the date, officer, service, status, stage, and search filters.
4. Select **Apply filters**. Use **Reset filters** to clear them.
5. Set the start date later than the end date and select **Apply filters**.
   Expect a validation message and no filtered request.
6. Select **Export CSV**. Check the browser's Downloads list for
   `janaseva-reports.csv` and compare the rows with the current filter.

Overdue applications are not currently calculated. Do not interpret
`Not tracked` as a zero count.

### Application History

**Who uses it:** Officers reviewing the event timeline.

**What it shows and where it comes from:** `GET /api/history` combines
document activities, field activities, and decisions persisted in PostgreSQL.
The application-submitted event is derived from the application's submission
record; it is not an independently stored application event.

**Steps**

1. Select **Application History** or open `/history`.
2. Review the chronological activity list and summary counts.
3. Filter by application search, activity category, officer, status, stage,
   and date.
4. Select **Details** for an event. Confirm the application reference and
   event-specific details.
5. Refresh and confirm the records remain.
6. Select **Export CSV** and inspect `janaseva-history.csv` in Downloads.

### Settings

**Who uses it:** The signed-in/demo officer.

**What it shows and where it comes from:** The officer/application profile
from `GET /api/settings/profile`, plus the browser language control.

**Steps**

1. Select **Settings** or open `/settings`.
2. Confirm **Officer account**, **Application information**, and **AI
   Provider** load.
3. Confirm unavailable organization values are shown as unavailable rather
   than invented.
4. Use **ಕನ್ನಡ** and **EN** in the top bar, then refresh to confirm the
   browser-language preference persists.

Settings does not currently implement editable notification preferences or
persisted profile changes. No settings values need to be restored after this
read-only check.

### AI Application Analysis

**Who uses it:** An authenticated officer requesting advisory assistance.

**What it shows and where it comes from:** The NestJS service reads the
application and sends a compact, redacted structured request to the
authenticated FastAPI service, which calls Groq. Document file bytes are not
sent. The result is validated before it is returned to the frontend.

**One controlled synthetic test**

1. Confirm <http://127.0.0.1:8000/health> returns HTTP 200.
2. In **Settings** or an application workspace, confirm the provider and
   model are configured. A configured status alone is not a generation test.
3. Open `/applications/DEMO-FINAL-REVIEW-001#ai-analysis`.
4. Select **Analyze Application with AI** once. Do not click again while it is
   loading and do not retry an error without checking its cause.
5. Confirm the response has Summary, Missing information, Potential
   inconsistencies, Document observations, Field verification observations,
   Suggested questions, Officer attention points, and the advisory disclaimer.
6. Confirm the summary is visible in the page and the disclaimer states that
   the authorized officer independently verifies findings and makes the final
   decision.
7. Confirm no application status/decision changed. AI does not approve,
   reject, or return applications.

The QA run on 2026-11-09 made one real synthetic Kannada analysis request;
that test succeeded. Repeating it can consume provider quota.

## 4. One safe walkthrough using current data

The current demonstration data has nine application records. Use
`INC-2026-1208` to inspect the normal seeded workflow and
`DEMO-FINAL-REVIEW-001` to inspect the Final Review fixture:

1. Open **Applications**, search for `INC-2026-1208`, and open its workspace.
   The seed has this application in document verification with no uploaded
   documents after the reset.
2. Read its application details, empty document list, and submission history.
3. Open **Document Verification** and confirm there are no uploaded documents
   waiting in the queue. An empty queue is expected after the reset.
4. Open **Field Verification** and inspect the queue. Do not schedule or
   submit against this shared application during a read-only walkthrough.
5. Open **Final Review** and inspect `DEMO-FINAL-REVIEW-001`. Its review
   package should have no decision yet. The four fixture document versions
   have metadata but no physical previewable files.
6. Open **Reports** and **Application History**. Compare their current values
   with the records displayed elsewhere; do not expect historical QA counts.
7. Open **Settings**, switch language, and refresh to test preference
   persistence.
8. Run live AI analysis only if you are ready to use provider quota; do it
   once with synthetic data.

This walkthrough verifies navigation and existing data, not a new
application's entire progression. Application registration/submission is not
implemented. Use an isolated disposable database to test document uploads,
field changes, or multiple decision outcomes. On the shared local database,
the Final Review fixture can be used for one decision demonstration; after
that decision it will no longer be pending until the fixture/database is
restored.

## 5. Error and status guide

| Result                              | Meaning                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `401`                               | Missing, invalid, or expired officer authentication.                                                                                   |
| `403`                               | The authenticated role cannot perform the requested action.                                                                            |
| `404`                               | The requested application, document, or resource was not found.                                                                        |
| `408` / timeout code                | The request exceeded a configured time limit. Do not retry repeatedly.                                                                 |
| `429`                               | Provider or service rate limit; respect the retry delay.                                                                               |
| `502` / provider error code         | An upstream AI/provider or response-validation problem. Read the safe error code; do not infer success.                                |
| `503`                               | A required service/authentication configuration is unavailable.                                                                        |
| Loading indicator that never clears | Check the browser Network panel and service health endpoints; report the request path/status without copying tokens or applicant data. |

## 6. Browser and responsive checks

Use the browser developer tools' Network and Console panels while testing:

- Confirm API requests go to `localhost:3002` and inspect HTTP status codes.
- Check that refreshing a page reloads database values.
- Test desktop at `1440 × 900` and mobile at `390 × 844`.
- Check that tables scroll within their container and that buttons/dialogs are
  reachable without horizontal page overflow.
- Check Kannada and English headings after switching and after refresh.
- When a request fails, save only the URL path, status, safe error code, and
  elapsed time. Never capture authorization headers, secrets, or real
  applicant documents.

There is no checked-in Playwright configuration, frontend browser-test
command, or Playwright dependency. This guide is manual; unit/e2e service tests
are described in the root `README.md`.

## 7. Manual and future Playwright acceptance checklist

The checklist below is suitable for a manual run now and for a future
Playwright suite. It is not a claim that every interaction has already been
tested. Set up Playwright against a disposable database before automating any
write action.

- [ ] Visit all nine routes and confirm their headings, navigation, loading
      result, and backend request status.
- [ ] Visit `/applications/DEMO-FINAL-REVIEW-001`; refresh and confirm its
      ID and database-backed status are unchanged.
- [ ] Search and filter the applications list; sort columns; verify an
      application link preserves the selected ID. Exercise pagination only when
      there are enough records.
- [ ] Switch Kannada to English and back; refresh after each choice and
      confirm the language and document `lang` attribute. Check for hydration
      errors and clipped Kannada text.
- [ ] At `1440 × 900` and `390 × 844`, check every route for horizontal page
      overflow, clipped controls, unreadable tables, and unusable menus/dialogs.
- [ ] In a disposable database, upload valid synthetic PDF/JPG/PNG files;
      verify invalid file type, mismatched extension/signature, empty file, and
      over-10-MB validation; preview/download; verify/reject/request replacement;
      refresh and compare status/history.
- [ ] In a disposable database, assign/reassign a synthetic VA / RI,
      schedule/reschedule/start a visit, complete checklist items, save and
      refresh a draft, submit a report once, and verify status/history/follow-up.
      Double-submit and confirm no duplicate report is stored.
- [ ] Verify Final Review eligibility blockers; test an authorized reviewer
      and a caseworker/admin role that must not make an unauthorized decision.
      Test required remarks and confirmation, then refresh and compare the
      persisted decision with history.
- [ ] Compare dashboard and report metrics to API values; apply valid and
      invalid date/status/stage/officer filters; reset them; export a CSV with
      Playwright `acceptDownloads: true`, then inspect its filename, header, and
      rows against the filtered response.
- [ ] Filter history by category/application/date/officer, open **Details**,
      compare persisted document/field/decision events, and distinguish the
      derived application-submission event.
- [ ] Confirm Settings shows unavailable profile values as unavailable and
      does not offer notification preferences that are not implemented.
- [ ] Test unauthenticated, expired/invalid token, unauthorized role,
      missing-record, unavailable API, timeout, provider 4xx/5xx, and rate-limit
      responses. Confirm errors are honest and no success-shaped fallback is
      displayed.
- [ ] Check the AI provider status and no-store behavior; run only one live
      synthetic analysis. Verify every response field, Kannada/English language,
      visible advisory disclaimer, and unchanged application decision/status.
      Use mocked provider responses for routine automated tests to avoid quota.
- [ ] Inspect browser Console and Network panels for unexpected errors,
      failed requests, duplicate POSTs, or leaked headers. Record only safe paths,
      status codes, and error codes.

The smallest suitable browser-test addition is a Playwright test dependency
and configuration that starts/reuses the frontend, authenticates with
development demo mode, and targets an isolated PostgreSQL database populated
with synthetic fixtures. Use Playwright's download acceptance for CSV checks.
Do not run mutating UI tests against the current shared database, and do not
add a live Groq call to every automated test run.
