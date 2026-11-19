# Belay professional finance — release readiness

Status on 2026-11-20: **NO-GO for payslip uploads**, pending private Storage setup and security tests. Salary metadata, subscriptions, investments and salary analytics use the existing `belay_state` document. Cost transaction lookup is implemented read-only; live user-session acceptance remains to be performed.

## Read-only production observations

- Project: General_apps (`wylxvmkcrexwfpjpbhyy`).
- `public.belay_state` has RLS enabled and an authenticated owner-scoped SELECT policy.
- `public.cost_management_expenses` has RLS enabled with an authenticated owner-scoped policy. The `id`, `date`, `amount`, `region`, `category`, `shop`, `expense_type` and `user_id` columns exist. This validates the *shape* of the Phase 5 read-only request, not a signed-in browser's permission or results.
- `storage.buckets` has no `belay_salary_slips` bucket, and no policies with Belay/salary names exist on `storage.objects` at the time of inspection.
- No schema or Storage changes were made during inspection.

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

## Release decision

**NO-GO for private-file uploads until the admin gate passes.** Read-only Cost matching and other finance screens have automated coverage, but live signed-in integration testing is pending. No production finance rows were modified or deleted.
