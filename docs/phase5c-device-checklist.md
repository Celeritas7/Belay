# Belay Phase 5C — Android and iPad acceptance checklist

Automated checks are not a substitute for physical-device installation and airplane-mode testing. This checklist does not request access to production records and should be run using an ordinary small practice session on your own account.

## Before starting (online)

1. Open <https://celeritas7.github.io/Belay/> in Chrome on Android or Safari on iPad, after Phase 5C is merged and GitHub Pages has deployed.
2. Sign in to your existing Belay account. Do **not** clear browser data, uninstall the Home Screen app, sign out while edits are pending, or delete old offline data.
3. Open **More → Settings & data**. Select **Enable offline practice** if this is a trusted device. Then select **Save app files for offline** and wait for **Ready for offline practice entry (7/7 files)**. Retry if interrupted; previously saved files should remain.
4. Select **Download readiness report** and keep the JSON file; it contains file readiness and pending counts, not personal skills or tokens.
5. Install the app: Android Chrome menu → **Install app** or **Add to Home Screen**; iPad Safari Share → **Add to Home Screen**. Reopen the installed icon once while online.

## Offline cold start

1. While signed in and with no unsaved edits, turn on airplane mode. Ensure Wi-Fi is also off.
2. Close the Home Screen app, then reopen from its icon without a network connection.
3. Confirm the **Practice offline** form appears for your enabled account and shows the pending count. The normal cloud dashboard is **not** expected to load offline.
4. Choose a known skill and enter **25 minutes**; tap **Save practice on device** once.
5. Confirm the pending count increases by **exactly one**. Close and reopen offline; the count must survive. Do **not** clear website data.

## Reconnection and sync

1. Disable airplane mode and reconnect. If the offline view asks, reload and sign in to the **same** account.
2. Open **Settings & data** and check the offline practice pending count. Wait for sync or select **Sync pending practice**.
3. Confirm the pending count returns to **0** and your practice history shows the 25-minute entry **exactly once**, even after refreshing.
4. If Belay reports a version conflict, download a normal data backup before choosing **Recover device practice from latest cloud data**. That action discards other unsaved edits but retains queued practice.
5. Download a second readiness report and compare it with the first. Do not share login tokens, passwords or private backups.

## Record outcomes separately for Android and iPad

| Gate | Android | iPad |
| --- | --- | --- |
| Online sign-in from browser | Pending | Pending |
| Home Screen installation and first online open | Pending | Pending |
| 7/7 shell files and active service worker | Pending | Pending |
| Airplane-mode cold reopen shows offline form | Pending | Pending |
| One 25-minute log persists across offline restart | Pending | Pending |
| Reconnect signs into correct account | Pending | Pending |
| Exactly one synced entry and zero pending | Pending | Pending |
| No mobile overflow or unusable controls | Pending | Pending |

If a gate fails, record the device/browser version, exact step, displayed message and readiness JSON. A screenshot is useful, but redact personal account details. Do not reinstall or delete storage to troubleshoot; report first.
