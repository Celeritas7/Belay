# Phase 6B — live matching checkpoint

Updated: 2026-11-22 JST.

## Completed user acceptance checks

The user tested a temporary Belay career expense against an existing same-account Cost transaction and supplied screenshots. This note records behavior only; it includes no transaction values, identifiers, account details, screenshots or production configuration.

| Check | Observed result | Status |
| --- | --- | --- |
| Paid expense with matching date, amount and currency | Expected Cost transaction appears as a possible match. | PASS |
| Change Paid to Planned | Match disappears; amount moves to Planned totals. | PASS |
| Change Planned back to Paid | Original match and Paid totals return. | PASS |
| Change only the amount | Original match disappears. | PASS |
| Change only the date | Original match disappears. | PASS |
| Change only the currency | Original match disappears; currency totals remain separate. | PASS |
| Restore the original date, amount and currency | Original match returns. | PASS |

These results are based on user-operated live UI checks and supplied screenshots. They are not independent browser automation or a complete security certification.

## Remaining acceptance work

- Two-account server read isolation and clearing displayed matches when switching accounts.
- Network or access-failure behavior and recovery.
- Confirmation that fetched match details are excluded from exports and offline storage.
- Temporary Belay test-record deletion and cloud-refresh confirmation.
- Remaining mobile and iPad Home Screen acceptance.
- Completion of the previously documented browser-regression and release-review gates.

**Phase 6B remains in progress.** Complete these checks before final release sign-off. All test-record edits in this acceptance group were performed in Belay; no Cost transaction change was required.
