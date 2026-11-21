# Belay professional finance — release readiness

Status on 2026-11-22: **Phase 6A Storage activation and account-isolation checks completed** with disposable test attachments (user-verified). **Phase 6B live Cost matching remains NO-GO** pending signed-in browser acceptance, regression-suite completion and review of the database privilege finding below. Salary metadata, subscriptions, investments and salary analytics use the existing `belay_state` document. Cost matching is intentionally on-demand and read-only.

## Read-only production observations

- Project: General_apps (`wylxvmkcrexwfpjpbhyy`).
- `public.belay_state` has RLS enabled and an authenticated owner-scoped SELECT policy.
- `public.cost_management_expenses` has RLS enabled with an authenticated owner-scoped policy. The `id`, `date`, `amount`, `region`, `category`, `shop`, `expense_type` and `user_id` columns exist. This validates the *shape* of the Phase 5 read-only request, not a signed-in browser's permission or results.
- Supabase check on 2026-11-22: `belay_salary_slips` exists, is private, limits files to 10 MiB and allows PDF/PNG/JPEG/WebP/HEIC. Its three explicit Storage RLS policies enforce owner-UUID folder prefixes for SELECT/INSERT/DELETE. This catalog inspection does not replace the previously reported two-account device tests.
- No schema or Storage changes were made during inspection.

## Phase 6A — salary-slip files (completed acceptance evidence)

The private bucket setup and synthetic upload/download/cross-account isolation were accepted in the preceding phase. The test attachment and its salary record were deleted, with cloud refresh verifying removal. The following steps are retained as a repeatable recovery/revalidation checklist, not as evidence that Storage remains unprovisioned.

## Admin gate: salary-slip files

1. Before creating the Storage bucket, confirm an up-to-date project backup and review `db/salary_slips_storage.sql`. That file is a *proposal*, not an auto-applied migration.
2. Apply the reviewed setup once as an authorized admin. Confirm the bucket is **private**, has a 10 MiB limit and only approved image/PDF MIME types.
3. Audit *all* `storage.objects` policies, not just policies named for Belay: a permissive unrelated policy on the same bucket would defeat isolation. Authenticated users must read/insert/delete only objects prefixed with their own `auth.uid()`; anonymous users and a different signed-in account must not access them. Do not add UPDATE/upsert permission.
4. In Belay, sign in and choose **More → Salary history → Check storage connection**. This is a read-only bucket-list check and is **not** a security certification.
5. With a disposable test account and non-sensitive synthetic PDF, verify upload/download/delete, file size/type rejection, account isolation, and a successful cloud metadata save/reload. Do not use real salary slips until this passes.
6. Confirm an account switch or sign-out requires a new storage check, and failed checks leave uploads disabled. Existing documents should remain downloadable even when a fresh list check fails.

## Signed-in Cost Management acceptance

1. Use synthetic or already-known entries; do not create Cost transactions merely to test Belay. Sign in with the *same* account in Belay and Cost Management.
2. Add or select a **Paid** career investment whose date, amount and currency match one existing Cost entry. Choose **Check Cost for possible duplicates**. Confirm the Cost row ID, shop and category appear.
3. Change currency or date in the Belay record and verify it no longer matches. Planned entries must not match. A matching date and price can still be an unrelated purchase: no automatic merge or accounting deduction is allowed.
4. Verify denied access or network loss shows a clear error, without modifying Cost data. Check that Cost details do not appear in exported Belay JSON or the offline practice queue.
5. Verify both mobile and desktop views; on iPad Home Screen, finish existing offline/OAuth acceptance from `docs/phase5c-device-checklist.md` before claiming full release readiness.

## Phase 6B technical audit — 2026-11-22

- **PASS (catalog only):** The live `cost_management_expenses` table has `id bigint`, `date date`, `amount integer`, `region text` and `user_id uuid`. RLS is enabled and its authenticated `ALL` policy uses `user_id = auth.uid()` for both visibility and writes. `belay_cost_summary` is security-invoker, not security-definer.
- **PASS (source inspection):** Career expense lookup selects only `id,date,amount,region,category,shop,expense_type`, filters by the active `user_id` and paid investment dates, and does not call insert/update/delete on Cost Management. Matches remain transient in memory; they are not copied to the Belay JSON export or practice queue.
- **PASS (focused synthetic execution on proposed PR #18):** Exact date and currency matching, Paid-only matching, strict integer amount equality, and rejection of stale responses when the account switches during a pending request. The added Node regression cases and complete test suite still require execution on the branch.
- **OPEN:** Signed-in same-account browser comparison with an existing Cost transaction, denied-access/network failure, two-account isolation, mobile/desktop display and iPad offline/OAuth acceptance. Never create or modify a real Cost expense for these tests.
- **PERMISSION REVIEW REQUIRED:** Read-only SQL catalog inspection found that both `anon` and `authenticated` have effective `TRUNCATE` privileges on `public.cost_management_expenses`. PostgreSQL row-level security does **not** restrict `TRUNCATE`. This is a least-privilege concern that belongs to Cost Management/database administration; it is **not** evidence that the Belay client executes `TRUNCATE`, and the ordinary REST table endpoint may not expose this operation. Do not execute `TRUNCATE` to test it. Review how these grants were issued and revoke unnecessary `TRUNCATE` privileges in a separately approved, impact-assessed Cost Management security change. No shared security configuration was modified by this audit.
- **LIMIT:** Each lookup accepts at most 100 distinct Paid expense dates and fetches a maximum of 1,001 Cost rows. The interface warns if results exceed 1,000; a complete match is not guaranteed for larger date sets.

## Release decision

**Phase 6A Storage: accepted based on the completed synthetic isolation tests. Phase 6B Cost integration: NO-GO for final release sign-off** until PR #18 is reviewed/tested, signed-in account-isolation and matching checks pass, and the effective TRUNCATE privileges receive an explicit security disposition. No real Cost transactions were modified or deleted during Phase 6B.
