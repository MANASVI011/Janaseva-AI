# Reports, History, and Settings QA

## Summary

**Result: PASS**, with one authentication configuration note below. The checks
used the existing frontend (`localhost:3001`) and backend (`localhost:3002`).
No application services were started, stopped, or restarted, and no database
records were changed.

The QA pass added a bilingual invalid-date-range message and a Reset filters
action on Reports and Application History. The Settings reminder label now
specifies that the preference concerns application deadlines.

QA-related source changes:

- [`reports-page.tsx`](../../frontend/src/components/dashboard/reports-page.tsx)
- [`history-page.tsx`](../../frontend/src/components/dashboard/history-page.tsx)
- [`operations-i18n.ts`](../../frontend/src/lib/operations-i18n.ts)

## Test results

| ID | Check | Expected | Actual | Result |
|---|---|---|---|---|
| R-1 | Reports status, workflow stage, officer, and service filters | Results and counts reflect selected filters | Exercised each filter; displayed rows and totals matched API results and the 8 seeded applications | PASS |
| R-2 | Reports date and search filters | Valid ranges/searches filter results; reversed dates are rejected; reset restores defaults | `2026-11-05`–`2026-11-06` returned 2 applications. A reversed range showed a localized validation error without requesting filtered results. ID/name/village and no-match searches worked; Reset restored all 8 | PASS |
| R-3 | Reports CSV | Browser download contains the visible filter result and correct headers | Downloaded both all-results and filtered exports in headless Chrome. The Hulikallu search exported one application (`INC-2026-1208`); CSV response was 200 with `text/csv; charset=utf-8` and an attachment filename | PASS |
| H-1 | History category, status, stage, officer, date, and search filters | Results/counts match the selected filters | Exercised all filter types; visible results matched API totals. Current data contains 8 application, 43 document, and 7 field activities | PASS |
| H-2 | History pagination and details | Pagination changes the page; details show the selected record and close cleanly | Next/Previous changed and restored the records. Application, Document, and Field dialogs showed the translated action, application ID, timestamp, and officer information when recorded; all dialogs closed | PASS |
| H-3 | History order and refresh | Activities are newest first and do not duplicate on refresh | 58 records were newest-first, had unique IDs, and returned the same ordered IDs and total after a second request/refresh | PASS |
| H-4 | History CSV | Download contains records matching the active filter | Browser search for `INC-2026-1208` exported 36 matching activity rows plus the header; all rows contained that application ID. Response was 200 with CSV content type and attachment disposition | PASS |
| S-1 | Settings profile | Displayed fields match the profile API; unavailable data is not invented | Name, role, officer ID, status, authentication type, department/district availability, application name, and version matched the authenticated API response | PASS |
| S-2 | Notification preferences | Each preference toggles, persists after refresh, and original values are preserved | Tested all four preferences. All persisted after refresh; each was restored to its original `true` value and verified again after refresh | PASS |
| L-1 | Kannada/English persistence and navigation | Both languages survive refresh and are consistent across pages | Kannada and English each survived refresh and navigation among Reports, History, and Settings. HTML `lang` matched the active language; no hydration or React errors were observed | PASS |
| W-1 | Reports application link | Opens the same persisted application | `INC-2026-1208` opened in Application Workspace and loaded Nandini Gowda's persisted application details | PASS |
| V-1 | Desktop/mobile layout | Pages remain usable without page-level horizontal overflow | At 1440×900 and 390×844, all three pages had `scrollWidth === clientWidth`. Mobile navigation opened and routed to Reports; the History details dialog fit the 390px viewport | PASS |
| Q-1 | Frontend checks | Lint, type-check, format check, and production build pass | ESLint, TypeScript, Prettier, and the default Turbopack production build all passed. Build ran in an isolated copy so the existing dev server was not disturbed | PASS |

## Evidence

### Screenshots

- [Reports desktop](./reports-desktop.png)
- [Reports mobile](./reports-mobile.png)
- [History desktop](./history-desktop.png)
- [History mobile](./history-mobile.png)
- [Settings desktop](./settings-desktop.png)
- [Settings mobile](./settings-mobile.png)

### CSV downloads

- [Reports all-results export](./janaseva-reports-all.csv)
- [Reports filtered export](./janaseva-reports.csv)
- [History all-results export](./janaseva-history-all.csv)
- [History filtered export](./janaseva-history.csv)

The CSV files were downloaded through the browser interface. The `*-all.csv`
files retain the unfiltered downloads; the un-suffixed files are the filtered
downloads.

## Notes and limitations

- Authenticated demo-officer API requests succeeded. Requests without the
  officer demo-auth header returned HTTP 503 with
  `Officer authentication is not configured for document verification.` The
  authenticated UI flow was unaffected; this environment/auth configuration
  was not changed during this page-focused QA.
- One Next.js route-prefetch request was cancelled while the browser test
  immediately navigated to another page (`ERR_ABORTED`). No browser console
  errors, React errors, or failed backend requests were observed.
- Department, district, and application version are absent from the current
  profile record and are correctly displayed as unavailable.
