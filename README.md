# Belay

Career skills, job matching, practice tracking and country comparisons.

Live app: https://celeritas7.github.io/Belay/

## Storage

- `index.html`: interface and career calculations.
- `cloud.js`: Supabase sign-in, loading, saving, migration and conflict handling.
- `public.belay_state`: one private JSON document per authenticated user. Its `data` contains `skills`, `jobs`, `work`, `log`, `settings`, `cOver`, `cAI`, `coach`, and optional Cost summaries. Versioned atomic saves prevent stale overwrites.
- `public.belay_reference`: shared reference configuration (`id = 'default'`). Country figures, example skills/jobs, rank definitions, coaching prompts, labels and default settings are loaded from here. They are not bundled in the frontend. The initial figures were migrated as estimates, not freshly verified.
- `public.belay_cost_summary()`: reads the signed-in user's yen expenses using existing Cost RLS; never writes Cost records.

Project: General_apps (`wylxvmkcrexwfpjpbhyy`). Browser configuration uses only the publishable key. RLS limits private records to `auth.uid()`. Reference data is read-only to authenticated clients and maintained through database administration. No secret/service-role key belongs in this repository.

## First use and migration

Sign in with the same Google account used in your other apps, or an existing email/password account. New account registration is controlled by the existing Supabase project settings. The Supabase Auth redirect allowlist must permit `https://celeritas7.github.io/Belay/`.

On the device/browser holding the previous app's data, choose **Move device data to cloud** after signing in. The app asks before replacing cloud records and removes the old `careerClimb` localStorage copy only after a successful save. Other browsers' old data cannot be discovered automatically. JSON import/export remains available under Work; import replaces the current records.

App records are held in memory while open and persisted in Supabase. Only the sign-in session is stored locally. Edits during a connection failure remain in memory: keep the page open and retry or download the recovery JSON. Closing with unsaved edits triggers a browser warning. This is an online app, not an offline database.

## Feeding data

Use the app forms or authenticated account JSON import. Administrators can update the appropriate `belay_state.data` JSON fields directly; the update trigger advances `version`. Refresh Belay to load database edits. Returning focus to the tab refreshes when no form or unsaved edits are active. Reference changes belong in `belay_reference.data`, not JavaScript.

The Coach and country-estimate screens provide prompts and accept pasted answers. Automatic AI generation is not configured; there is no client AI key or dependency on the Claude artifact runtime.

## Verification

`node --test tests/state.test.cjs` tests rendering of every tab, save/reload, queued edits, failed-save recovery, version conflicts, migration, Cost summaries, logout and invalid imports using a simulated API.

`tests/cloud.test.cjs` contains a Playwright test with simulated HTTP responses and the real pinned Supabase client. Set `BELAY_SDK` to a local copy of `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js`; install Playwright and Chromium as needed. The development executor could not launch Chromium due to its socket permissions, so this test was not run successfully there.

Database integration was checked in a rolled-back transaction: authenticated create/update, stale-version rejection, reference reads, Cost summary and cross-account isolation. No test user or personal record was retained.

`db/schema.sql` records the initial schema applied to the project. Do not reapply it blindly to an existing installation. Existing applications and authentication settings were not modified.
