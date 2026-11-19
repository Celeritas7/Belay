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
- `public.belay_reference`: shared reference configuration (`id = 'default'`). Country figures, example skills/jobs, rank definitions, coaching prompts, labels and default settings are loaded from here. They are not bundled in the frontend. The initial figures were migrated as estimates, not freshly verified.
- `public.belay_cost_summary()`: reads the signed-in user's yen expenses using existing Cost RLS; never writes Cost records.

Project: General_apps (`wylxvmkcrexwfpjpbhyy`). Browser configuration uses only the publishable key. RLS limits private records to `auth.uid()`. Reference data is read-only to authenticated clients and maintained through database administration. No secret/service-role key belongs in this repository.

## First use and migration

Sign in with the same Google account used in your other apps, or an existing email/password account. New account registration is controlled by the existing Supabase project settings. The Supabase Auth redirect allowlist must permit `https://celeritas7.github.io/Belay/`.

On the device/browser holding the previous app's data, open **Settings & data → Move device data to cloud** after signing in. The app asks before replacing cloud records and removes the old `careerClimb` localStorage copy only after a successful save. Other browsers' old data cannot be discovered automatically. JSON import/export remains available under **More → Settings & data**; import replaces the current records.

App records are held in memory while open and persisted in Supabase. Only the sign-in session is stored locally. Edits during a connection failure remain in memory: keep the page open and retry or download the recovery JSON. Closing with unsaved edits triggers a browser warning. This is an online app, not an offline database.

**Mobile/offline limits:** The app shell (HTML, CSS, JavaScript and icon) can be cached for reopening, but authentication and loading personal data still require internet, and the external Supabase SDK may not be available offline. An offline warning now explicitly says if unsaved changes exist only in the open tab. Save attempts pause while the browser reports offline and retry on reconnection; this does not provide durable offline editing. Download the recovery JSON before closing a tab with unsaved changes. The service worker never caches Supabase API responses, auth tokens or personal data. Avoid clearing browser storage, especially before migrating older records. Offline practice logging with a safe, account-specific durable outbox remains a later Phase 5 gate.

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
