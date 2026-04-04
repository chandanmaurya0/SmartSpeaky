# SmartSpeaky — Issue Tracker

Issues identified from production logs (March 2026).

---

## Issue 1: Key Listener Heartbeat Failures (Critical)

**Status:** Fixed

**Symptom:** `[Key listener] No heartbeat received for Xms, restarting key listener...` — occurs dozens of times per session, sometimes as frequently as every 46 seconds. The `global-key-listener` subprocess is restarted continuously throughout the day, making the hotkey for voice activation unreliable.

**Suspected cause:** macOS App Nap throttling the background subprocess. The process logs "App Nap prevention enabled" but the prevention is not reliably working. Timeout intervals vary wildly (46s–17min), consistent with OS-level interference.

**Fix:** Removed `detached: true` and `unref()` from the key listener spawn options in `lib/media/keyboard.ts`. The process is now a proper child of Electron so macOS manages their App Nap policies together. Also widened the heartbeat timeout from 15s → 30s for extra margin.

**Impact:** High — core voice activation hotkey is unreliable.

---

## Issue 2: gRPC Server 500s — Interactions, Dictionary, Notes (Critical)

**Status:** Likely resolved server-side (no client-side change needed)

**Symptom:**

- `Failed to fetch interactions: ConnectError: [internal] Internal server error`
- `Failed to fetch dictionary: ConnectError: [internal] Internal server error`
- `Failed to fetch notes: ConnectError: [internal] Internal server error`
- `[InteractionManager] Failed to create interaction: ConnectError: [internal] Failed to store interaction`

Server is reachable but returning 500s. `createInteraction` specifically says "Failed to store interaction", suggesting a database write failure.

**Impact:** High — transcriptions are not saved, history is unavailable.

---

## Issue 3: Token Refresh Clears Auth When Offline (High)

**Status:** Fixed

**Symptom:** `Token refresh error: TypeError: fetch failed` → `Token refresh failed, clearing auth data`

When the device is offline at startup and tokens are expired, the refresh fails and **auth data is cleared entirely**, logging the user out. Should gracefully fail without destroying local credentials.

**Fix:** Added `isNetworkError()` helper in `lib/auth/events.ts`. Both `refreshTokens` and `ensureValidTokens` now return `isNetworkError: true` on connectivity failures. Neither function clears credentials on a network error — only genuine auth failures (401s, revoked tokens) trigger a logout.

**Impact:** High — users are unexpectedly logged out when starting the app offline.

---

## Issue 4: Auto Updater S3 403 Forbidden (Medium)

**Status:** Disabled — auto-update check is commented out in `lib/main/main.ts` until S3 bucket permissions are fixed. Re-enable by uncommenting `initializeAutoUpdater()` in that file.

**Symptom:** `Auto updater error: HttpError: 403 Forbidden` from `smartspeaky-release-bucket.s3.amazonaws.com/releases/latest-mac.yml`

The S3 bucket policy is blocking public read access to the update manifest. Auto updates are silently broken.

**Impact:** Medium — users on old versions won't receive updates.

---

## Issue 5: Old Hostname ENOTFOUND (Medium)

**Status:** Already resolved — hostname not present in any source file

**Symptom:** `ConnectError: [unavailable] getaddrinfo ENOTFOUND vibetype.chandanmaurya.space`

Old server hostname `vibetype.chandanmaurya.space` still referenced somewhere in config/code. DNS resolution fails.

**Impact:** Medium — affects sessions where this hostname is still in use.

---

## Issue 6: Key Listener stderr Logged as [error] (Low)

**Status:** Fixed

**Symptom:** Normal informational messages from the key listener binary (`macOS App Nap prevention enabled`, `Registered 2 hotkeys`) are piped to the logger as `[error]` level, polluting error logs with false positives.

**Fix:** Changed stderr handler in `lib/media/keyboard.ts` from `console.error` to `console.log`.

**Impact:** Low — cosmetic, but makes real errors harder to find in logs.

---

## Issue 7: Auto Updater ERR_INTERNET_DISCONNECTED Logged as Error (Low)

**Status:** Fixed

**Symptom:** `Auto updater error: Error: net::ERR_INTERNET_DISCONNECTED` logged at `[error]` level. Being offline is a normal condition and should be handled gracefully.

**Fix:** Auto-updater error handler in `lib/main/autoUpdaterWrapper.ts` now logs network-related errors at `console.warn` level instead of `console.error`.

**Impact:** Low — log noise.

---

## Issue 8: Stuck Key Events (Low)

**Status:** Open

**Symptom:** `Removing stuck key: return (held for 5.703s)` / `Removing stuck key: shift-left (held for 5.222s)`. Keys are reported as "stuck" while dictation is active, likely caused by keydown events not receiving a corresponding keyup.

**Impact:** Low — occasional, likely edge case during active dictation.

---
