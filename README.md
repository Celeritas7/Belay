# Belay

Career skills, job matching, practice tracking and country comparisons.

Live app: https://celeritas7.github.io/Belay/

## Interface

- **Overview** highlights one practice action, weekly minutes, target readiness and practice history.
- **Skills** has labelled level buttons and All / Want to learn / Needs practice filters. Needs practice means a wanted skill with no session in the last 14 days.
- **Career** holds a selectable target job, top skill gaps, expandable job profiles and work records.
- **Career → Applications** tracks real opportunities separately from estimated job profiles. Save an employer, posting URL, location, posted annual yen salary, application date/status, notes and skill requirements. Fit is calculated against the skills you entered; URLs and advertised salaries are user-supplied, not live-verified.
- **Career → Milestones** tracks dated career goals, optional target-job links, notes and completion. The Skills screen lists linked work achievements as evidence when their skill tags match.
- **More** contains Coach, country comparisons and Settings & data. Account, migration and backup controls are in Settings; save status and recovery remain visible on every screen.
- **Professional finance — Salary history (deferred backlog, phase 1)** is under **More → Salary history**. Record employer, pay month, currency, monthly gross/net pay and notes. Attach an optional PDF/image payslip (10 MB maximum) to a private Supabase Storage bucket; authenticated downloads never use public URLs. No OCR or automatic salary extraction occurs. These figures are actual user-entered history, separate from estimated job salaries.
- **Professional finance — Subscriptions (phase 2)** is under **More → Subscriptions**. Record a service/provider, purpose, amount and billing currency, monthly/quarterly/yearly interval, next renewal date, auto-renew setting, status and cancellation notes. Active subscriptions show a monthly-equivalent total **per currency** and upcoming/overdue renewals when the page is opened. It does not trigger notifications, charge a card, change Cost Management, or assume that cancellation occurred outside Belay.
- **Professional finance — Career investments (phase 3)** is under **More → Career investments**. Track one-time spending on courses, certification exams, books, tools and networking. Record date, provider, category, currency, amount, Planned/Paid status, notes and an optional career-milestone link. Totals distinguish planned vs paid and currencies; they are user-entered estimates/records, not a bank feed or Cost Management transactions.
- **Phase 5A — mobile & installable shell:** Career subtabs scroll horizontally on narrow screens. Long forms have a dedicated scrolling field area and persistent Save/Close controls. Belay includes a web-app manifest and a static-only service worker, so it can be added to the Home Screen without caching private Supabase records.
- **Coach** can now build a four-week practice roadmap from the selected target job's skill gaps and wanted skills. Each week focuses on one skill and targets 120 minutes; progress comes from practice sessions logged during that calendar week. Regenerating replaces the plan only after confirmation and never deletes practice history. The original AI copy/paste coaching remains available.
- Country comparisons show Japan plus up to two selected destinations in monthly yen. The full table remains expandable. Figures are estimates, not current verified quotes. **Phase 4** adds optional HTTPS evidence URLs, effective dates and notes to each user-edited country's assumptions, plus source-age flags and explicit unverified labels. Pasted AI country estimates can include the same evidence fields; an AI-provided citation is never treated as independently verified.

Target job and country selections are saved in the existing Supabase settings JSON; no database migration is required for this UI update. Practice does not automatically change a skill level: users set their level explicitly.

## Storage

- `index.html`: interface and career calculations.
- `ui.css`: responsive layout and accessible touch controls.
- `cloud.js`: Supabase sign-in, loading, saving, migration and conflict handling.
- `public.belay_state`: one private JSON document per authenticated user. Its `data` contains `skills`, `jobs`, `work`, `log`, `settings`, `cOver`, `cAI`, `coach`, and optional Cost summaries. Versioned atomic saves prevent stale overwrites.
- Phase 1 adds an optional `milestones` array to that existing private JSON record; no database schema change or separate table is needed. Old records load with an empty milestone list.
- Phase 3 adds an optional `applications` array to that same private JSON record. Existing accounts still load without migration; application entries follow the existing per-account save and backup flow.
- Phase 4 extends existing `cOver` and `cAI` entries with optional `source`, `asOf` and `notes` fields. Older entries still load, and no new table or migration is required. Imported evidence URLs must use HTTPS.
- Salary history adds an optional `salaryHistory` array to the same per-account JSON document. Old accounts default to an empty list. Payslip *files* are not embedded in the JSON, exported backup, browser cache or offline practice queue. Files live in `belay_salary_slips`, a separate **private** Storage bucket with an account-UUID path prefix.
- Subscriptions add an optional `subscriptions` array to the same private account JSON document, without a new SQL table. Old accounts default to an empty list; records stay in the existing cloud save/backup flow.
- Career investments add an optional `careerExpenses` array to the same private account JSON document, without a new SQL table. Old accounts default to an empty list, and the new records are included in ordinary JSON backups. They do not automatically create or duplicate Cost Management entries.
- `public.belay_reference`: shared reference configuration (`id = 'default'`). Country figures, example skills/jobs, rank definitions, coaching prompts, labels and default settings are loaded from here. They are not bundled in the frontend. The initial figures were migrated as estimates, not freshly verified.
- `public.belay_cost_summary()`: reads the signed-in user's yen expenses using existing Cost RLS; never writes Cost records.

Project: General_apps (`wylxvmkcrexwfpjpbhyy`). Browser configuration uses only the publishable key. RLS limits private records to `auth.uid()`. Reference data is read-only to authenticated clients and maintained through database administration. No secret/service-role key belongs in this repository.

## First use and migration

Sign in with the same Google account used in your other apps, or an existing email/password account. New account registration is controlled by the existing Supabase project settings. The Supabase Auth redirect allowlist must permit `https://celeritas7.github.io/Belay/`.

On the device/browser holding the previous app's data, open **Settings & data → Move device data to cloud** after signing in. The app asks before replacing cloud records and removes the old `careerClimb` localStorage copy only after a successful save. Other browsers' old data cannot be discovered automatically. JSON import/export remains available under **More → Settings & data**; import replaces the current records.

App records are held in memory while open and persisted in Supabase. Only the sign-in session is stored locally. Edits during a connection failure remain in memory: keep the page open and retry or download the recovery JSON. Closing with unsaved edits triggers a browser warning. This is an online app, not an offline database.

**Mobile/offline limits:** The app shell (HTML, CSS, JavaScript and icon) can be cached for reopening, but authentication and loading personal cloud data still require internet, and the external Supabase SDK may not be available offline. The offline practice queue below is a narrow exception for practice logging only. Other unsaved edits remain in the open tab and need a recovery JSON before closing. Save attempts pause while the browser reports offline and retry on reconnection. The service worker never caches Supabase API responses, auth tokens or personal records. Avoid clearing browser storage, especially before migrating older records.

**Phase 5B — opt-in offline practice:** In **More → Settings & data → Offline practice on this device**, enable the feature while signed in and online. Belay stores only that account's ID/email, the current skill-name list and uniquely identified unsynced practice sessions in the browser. Practice from the normal UI is queued before an in-memory update; if the app opens offline, a minimal **Practice offline** screen can record more sessions without cloud data. It is not a full offline dashboard. On the same account's next successful cloud load, entries are merged by stable ID and acknowledged from the queue only after the server confirms them. If the cloud version changed, resolve using **Recover device practice from latest cloud data**; doing so discards other unsaved edits, so first download the normal backup if needed. Switching accounts never applies another account's queue; pending entries prevent replacing the last offline profile. Disabling requires a clear queue. This browser storage is device-local and unencrypted, so enable only on a trusted device; clearing website data removes it. Other types of Belay edits still require internet and are not durably offline.

**Phase 5C — offline readiness:** Settings includes **App files for offline use**, with **Save app files for offline**, **Check readiness** and **Download readiness report**. The check confirms the current app-shell files exist in CacheStorage and a service worker is active; it does **not** prove that private cloud records work offline. File downloads are retriable and do not delete existing cached data. The readiness report omits account identifiers and Supabase tokens. Physical Android/iPad acceptance, including Home Screen cold-start, Google OAuth after reconnect and single-entry synchronization, is still required. Follow [the device checklist](docs/phase5c-device-checklist.md), and do not clear website data to troubleshoot.

## Feeding data

Use the app forms or authenticated account JSON import. Administrators can update the appropriate `belay_state.data` JSON fields directly; the update trigger advances `version`. Refresh Belay to load database edits. Returning focus to the tab refreshes when no form or unsaved edits are active. Reference changes belong in `belay_reference.data`, not JavaScript.

The Coach and country-estimate screens provide prompts and accept pasted answers. Automatic AI generation is not configured; there is no client AI key or dependency on the Claude artifact runtime.

The Phase 2 practice roadmap is calculated locally and stored under `belay_state.data.coach.practiceRoadmap`. It needs no additional tables, remote AI service, or migration.

Country comparisons are scenarios: model gross pay is scaled from reference engineer pay, effective tax is adjusted heuristically, living costs are subtracted, and the surplus is divided by one year's inflation factor. This is neither a purchasing-power parity calculation nor a replacement for actual offers and local tax estimates. The manually entered USD/JPY rate is not live. Evidence labels describe the presence and age of user-entered data, not independent verification or quality of the underlying source.

## Verification

`node --test tests/state.test.cjs` tests rendering of every tab, save/reload, queued edits, failed-save recovery, version conflicts, migration, Cost summaries, logout and invalid imports using a simulated API. It also checks target-driven practice suggestions, exact level selection, skill filters, relocated account controls and monthly country shortlists.

`tests/cloud.test.cjs` contains a Playwright test with simulated HTTP responses and the real pinned Supabase client. Set `BELAY_SDK` to a local copy of `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js`; install Playwright and Chromium as needed. The development executor could not launch Chromium due to its socket permissions, so this test was not run successfully there.

Phase 0 validation: `node --test tests/state.test.cjs` also covers rejection of invalid custom practice minutes and local-calendar date/streak calculations. Run the suite with `TZ=Asia/Tokyo` as a regression check for Japan. Practice entries accept whole minutes from 1 to 1440, and the date for a new entry follows the device's local calendar day. Live Google OAuth and authenticated Supabase access still require an end-to-end check in a supported browser; simulated tests do not verify production configuration.

Database integration was checked in a rolled-back transaction: authenticated create/update, stale-version rejection, reference reads, Cost summary and cross-account isolation. No test user or personal record was retained.

`db/schema.sql` records the initial schema applied to the project. Do not reapply it blindly to an existing installation. Existing applications and authentication settings were not modified.

**Salary-slip setup gate:** Before using file uploads, review and apply [db/salary_slips_storage.sql](db/salary_slips_storage.sql) to the General_apps project using a database administrator and validate both same-account download and cross-account denial. This SQL has **not** been applied to production automatically. The app can save salary metadata without this bucket, but uploads will fail until setup is complete. The bucket must remain private, with a 10 MB limit and owner-scoped `storage.objects` policies; never put service-role keys in the browser. File upload first requires the salary record to be synced; on a file upload success followed by metadata save failure, keep the page open and retry the record save. A salary JSON backup does not contain the original attached documents—download them separately before removing them. Removing a payslip is an explicit permanent deletion; a salary record with an attachment must have that attachment removed before the record can be deleted.
