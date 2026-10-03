## 2026-10-03 DreamService brightness and solar source audit

### Exact-HEAD debug artifact and source-suite revalidation

At source commit `0702651ae3c71ff47189533a1ee34b991efe8b86` (application/source directories match `origin/main`), `env TZ=UTC bash tools/run-source-smokes.sh` passed: 99 canonical Node smokes plus `ntp-time-smoke.sh`, including the real pinned Comanche055/WASM semantic gate. The current Regular and Fire debug APKs passed `tools/verify-apk.sh` against this checkout; their SHA-256 values are `7c9795d893db2216940245ec66e5e31ff52c83ebcb729e9bd6fff8198deaad98` and `a878a404af3412f6ee5b2bd842d357d4a2bb0f9c6dc29ee171e279f920d87986`, respectively. The Regular and Fire flavor full-device gates passed on the attached Android 16 emulator in this audit. Fire-flavor emulator evidence does not establish Fire OS behavior.

A live WebView DOM probe confirmed the auxiliary controls region is a 120 CSS-pixel scrollport with 173 CSS pixels of content and `overflow-y:auto`; setting `scrollTop` to its maximum reached the bottom of the panel. The probe restored the initial scroll position and hid the panel afterward. This validates access to the lower portrait controls in this emulator WebView, not a physical handset gesture. In this inspection the WebView viewport remained portrait (262×466 CSS pixels); no new landscape result is claimed. No runtime source changed, and no release APK was built, signed, or published. The broader release hold remains in effect until the open audit gates below are resolved.

Continued the DreamService audit without building an APK or changing runtime code. Reviewed `AgcDreamService`, the packaged screen-only gesture handler, DREAM SOLAR calculations, the opt-in read-only Dream AGC clone, Android manifest registration, and the focused host smokes. The native implementation enables interactive touch, uses a full-sensor Dream window, restores immersive bars after focus changes, queues brightness updates on the main thread, and tears down its WebView and pending callbacks on detach/destroy. Android's API documents `setScreenBright` as keeping the display bright while dreaming and `WindowManager.LayoutParams.screenBrightness` as a 0-to-1 window override; the source uses both as separate controls ([DreamService](https://developer.android.com/reference/android/service/dreams/DreamService), [WindowManager.LayoutParams](https://developer.android.com/reference/android/view/WindowManager.LayoutParams)).

`node tools/solar-model-smoke.js`, `node tools/dream-mode-smoke.js`, `node tools/dream-interaction-smoke.js`, `node tools/dream-orientation-smoke.js`, and `node tools/dream-agc-runtime-smoke.js` all passed. These confirm the solar model's equinox/mid-latitude and polar fallbacks, clock-only DreamService URL, tap/hold bridge contract, safe early configuration callbacks, and Dream AGC snapshot/lifecycle isolation. No source defect was demonstrated. These host checks do not prove Android DreamManager input delivery or actual Fire/physical panel output for DIM/BRIGHT/SOLAR; those device gates remain open. Per the user's direction, no new release is to be made until the audit is complete.

### 2026-10-03 updater handoff and Command Module-only source audit

Reviewed release discovery and fallback, bounded APK download, SHA-256/sidecar parsing, package/version/signer validation, pending-update revalidation, foreground-only installer launch, fixed-name read-only APK provider, component visibility, and backup exclusions. Reviewed Android packaging and shared frontend references for mission selection/rope scope. The source forces Comanche055, defaults the core to CM and reads back its mode, packages only the pinned Comanche055 rope, and the APK verifier rejects Luminary099. The public PWA is separately verified in the deployment audit above; an existing untracked local `pwa/dist/` build artifact was left untouched and is not evidence of current runtime output.

`node tools/self-update-smoke.js`, `node tools/update-retry-policy-smoke.js`, `node tools/manifest-policy-smoke.js`, `node tools/asset-reference-smoke.js`, and `node tools/wasm-runtime-smoke.js` all passed. The real pinned Comanche runtime passed V16N65, V05N09, V14N09, P00, V35, and MARK/KEYRUPT2 checks. No new source defect was demonstrated. Live updater network/install behavior remains unverified because debug builds disable updates; release-signed installer handoff and Fire-device acceptance remain outstanding. No APK was built as part of this pass.

### 2026-10-03 macOS WebView follow-up

Rebuilt the isolated macOS Debug app with temporary error capture. The packaged page loaded and its DebugBridge reported document-start installation and `FRONTEND READY app`. CUA keyboard and DSKY-button actions did not produce frontend input or runtime-error events, so this run does not establish whether the earlier blank-register/OPR ERR symptom came from yaAGC startup or from input delivery. The temporary Swift instrumentation was restored byte-for-byte to the original source. macOS AGC command execution remains unverified; the iOS Simulator is still blocked by the CoreSimulator/Xcode version mismatch. No release artifact was created.

### 2026-10-03 current source-suite replay

On source commit `a4eb12111b3d347fa9cb22accac3740b9db318a0`, `env TZ=UTC bash tools/run-source-smokes.sh` passed all 99 canonical Node smokes plus `ntp-time-smoke.sh`. The real pinned Comanche055/WASM gate verified V16N65E, all eight V05N09E numeric selectors, V14N09E's six R1/R2 selectors (Comanche V14 displays components 1 and 2), P00 relay 11 `01265`, V35 relay 12 `00650`, and MARK/KEYRUPT2 consumption. `adb devices -l` showed only the Android 16 emulator; no physical Fire/handset was attached. No APK was built, signed, or published.

### 2026-10-03 Activity lifecycle and asset-origin audit

Reviewed Activity pause/resume/destroy handling, sensor registration and acceleration fallbacks, JavaScript visibility transitions and core snapshot/resume, Dream WebView teardown, and `NetClient`'s synthetic HTTPS asset origin and decoded path-segment checks. No source defect was demonstrated. `adb devices -l` showed only `emulator-5554` (`sdk_gphone64_arm64`), so this pass cannot close physical handset/Fire sensor or display gates.

The exact source tree passed `env TZ=UTC bash tools/run-source-smokes.sh`: 99 canonical Node smokes plus `ntp-time-smoke.sh`. This includes lifecycle/service ownership, native sensor fallback, manifest/network policy, DreamService behavior, CM-only asset policy, and real pinned Comanche055 WASM semantics. No APK was built. Device-specific DreamManager, Fire OS, physical sensor/display, and release-signed updater behavior remain open.

## 2026-10-03 client APK confirmation and local PWA offline runtime

The user confirmed that the Regular debug APK runs on their device. The same APK remains verified by `tools/verify-apk.sh` (package/signature, exact CM rope/WASM, and byte-for-byte frontend asset checks); Android 16 emulator `tools/device-full-smoke.sh` had also passed earlier, but the user's device model/OS and full command-level interaction results are not yet known.

## 2026-10-03 current Android emulator Comanche/WebView audit

Re-ran the Regular debug APK (`6d106d1bda3dec2458f30170c15d95a76fe211fd0bcc7cb41a1e909e004632af`) against the attached Android 16 emulator after confirming the installed app is the isolated `org.apollo.agcdsky.eltest` package. `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk regular` passed: package/version/manifest/signature, exact pinned yaAGC/Comanche blobs, byte-identical referenced frontend assets, and absence of an LM rope. The corresponding `tools/device-full-smoke.sh` run passed against the packaged WebView and real WASM.

The live gate read back CM mode `1`; pointer-entered V16N65 returned numeric output with OPR ERR clear; V05N09 displayed three five-digit octal words (`01107 00000 00000`); V14N09 displayed the expected two words (`01107 00000`); held PRO and pause-time release passed; P00/V35 matched `PROG 00`, relay 11 `01265`, `88/+88888` in all registers, relay 12 `00650`, and raw channel 011/0163 state. Page recreation and actual process death each restored the 327,680-byte memory snapshot into a fresh CM-configured core. This is emulator evidence; Fire OS, physical controls/sensors, DreamManager, and handset display remain open.

An iOS Simulator runtime check remains inconclusive on this host: `xcrun simctl list runtimes` produced no output during a 15-second wait and I terminated only that new command. Existing CoreSimulator service and older `simctl` processes were left untouched. iOS runtime behavior remains unverified.

## 2026-10-03 deployed PWA offline Comanche runtime

Rechecked the post-merge GitHub Pages site in an isolated Playwright/Brave context. The registered worker at `https://ryanbytes.github.io/AGC-DSKY-Android/sw.js` was active and controlled the page; cache `agc-dsky-pwa-e3a097e72950` contained 90 entries, including the document, current WASM/Comanche rope, manifest, both checked icons, and print-window script. With browser networking disabled, a reload still rendered the DSKY. Entered CM AGC mode and P00, then entered V16N65 through the visible pointer-key path. The exact pinned Comanche runtime reported V16N65, numeric output (`00000`, `00003`, `04187`), and no OPR ERR while `offlineReady` remained true.

The three browser console errors were the expected offline failures of the PWA HTTP-Date network-time probes to `manifest.webmanifest`; the app reported network time unavailable and the simulator continued. This closes the post-merge hosted-browser install/offline runtime gap. Physical phone-browser behavior remains unverified. The isolated browser session was closed after the check.

## 2026-10-03 optional analytics deployment-surface audit

Confirmed the public PWA `analytics.js` endpoint is empty; its current deployed build does not transmit analytics events. GitHub's Actions API reports no runs of `deploy-analytics.yml`, the repository variable lookup for `AGC_ANALYTICS_ENDPOINT` returns 404, the repository secret listing returned no entries, and this shell has no `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` environment variables. These checks show no configured repository-driven Worker deployment path. They do not rule out a manually deployed Worker or organization/environment-scoped credentials, so they do not establish whether a standalone endpoint is live or rate-limited.

The Worker source remains publicly callable if deployed: allowed `Origin` only controls browser CORS, and no rate limiter is implemented. Keep PWA telemetry disabled until a deployed Worker URL and its actual edge/account abuse controls are inspected and a rate-limit policy is selected. No Cloudflare account or service was changed.

Rebuilt the PWA into a fresh `<temporary-path>` directory, leaving the existing untracked `pwa/dist/` untouched. `node pwa/tools/pwa-smoke.js` and `node pwa/tools/pwa-parity-smoke.js` passed. In Chromium, the packaged service worker installed and controlled the audit page; its cache contained 91 entries and all required page, runtime, WASM, rope, and icon resources. All four packaged PNG icons decoded at their expected dimensions (180, 192, 512, and 512 square). After stopping the local HTTP server, reloading the DSKY still rendered its full page structure from the worker's offline cache. The later main merge and Pages deployment are recorded below.

## 2026-10-03 Apple builds reconciled to current shared assets

The already-running macOS debug app was built before the strict-CSP asset refactor: its bundle lacked `dsky-solo.css` and six shared files differed from the current source. Left that running app untouched. Rebuilt both `AGCDSKYmacOS` and `AGCDSKYiOS` from the current worktree into separate fresh `<temporary-path>*` DerivedData directories. Both Xcode builds succeeded. Each new bundle contains all 73 shared source assets byte-for-byte; the bundled `yaAGC.wasm` and `Comanche055.bin` hashes match the current pinned webAGC files, and `bash apple/tools/verify-pinned-assets.sh` passed. CoreSimulator still reports version 1051.55.0 versus Xcode's required 1171.7.0, so iOS runtime/printing remains unverified. A current-source macOS debug process launch was logged, but the CUA app binding may have attached to the older process with the same bundle ID; the displayed faceplate and subsequent VERB interaction therefore cannot be attributed conclusively to the new build. The DEBUG bridge probe emitted no callback in the new process log. Mac interactive AGC initialization, bridge/input behavior, and actual rendered output remain unverified. AppKit also logged negative view-geometry warnings at launch; their source and user-visible effect are not established.

## 2026-10-03 pre-merge hosted PWA deployment finding (superseded)

Before PR #211 merged, the public deployment's `sw.js` included `./.self-contained-assets-note`, while that URL returned HTTP 404; the hosted Chromium tab had no service-worker registration/controller. The live Apple touch, 192-pixel, and 512-pixel PNGs also had corrupt IDAT data (CRC/decompression/truncation failures). This finding was superseded by the main-branch Pages deployment recorded below.

## 2026-10-03 GitHub main merge and Pages deployment verification

PR [#211](https://github.com/ryanbytes/AGC-DSKY-Android/pull/211) merged to `main` at `e3a097e7295007e22a9a660b3167d445d4baa236`. The main-branch PWA workflow completed successfully, including build/smokes and GitHub Pages deployment; the Apple build workflow also completed successfully for both macOS and iOS simulator targets. Fresh no-cache HTTP reads of `index.html`, `sw.js`, `analytics.js`, `manifest.webmanifest`, `icons/icon-192.png`, and `icons/icon-512-maskable.png` all returned HTTP 200 with the new Pages timestamp (`2026-10-03 12:17:38 GMT`). The deployed worker no longer references `.self-contained-assets-note` and precaches the print-window script. The deployed analytics client identifies build `e3a097e72950` and keeps its endpoint disabled. This verifies the current files served from Pages; a fresh browser service-worker installation/offline reload against the deployed site remains unverified.

## 2026-10-03 analytics Worker malformed-event validation

Exercised the public event handler with an object-valued `event` containing non-callable `toString` and `valueOf` members. Coercing it through `String(...)` threw `TypeError` out of `fetch()` instead of returning the documented invalid-event response. The Worker now accepts the event name only when the JSON value is a string, then lowercases it; regression cases cover null, array, hostile object, and number values and assert HTTP 400 with no D1 writes. `node --check analytics/cloudflare/worker.js`, `node --check analytics/cloudflare/worker-smoke.mjs`, `node analytics/cloudflare/worker-smoke.mjs`, the complete source suite (98 Node smokes plus NTP shell smoke and real pinned Comanche055 WASM), and `git diff --check` passed.

The separate endpoint-abuse review remains open: the Worker still has no rate limiter, and its Origin check only controls browser CORS, not authenticated access. The currently served `analytics.js` is built from `fbba2ef8434e` and has an empty endpoint, so the published PWA is not sending events; repository state does not identify whether a standalone Cloudflare Worker URL is currently deployed or protected by Cloudflare-side rules.

## 2026-10-03 hosted PWA network-time end-to-end check

Closed the deployed-browser verification gap for the HTTP-Date clock fallback. Reloaded the hosted PWA in a fresh Codex in-app Chromium tab with DevTools Network events enabled. The page issued three timestamped, no-cache `HEAD` requests to `manifest.webmanifest`; all three returned HTTP 200 with a `Date` header and were served by GitHub Pages, not the service worker. Production `AGCDSKY.ntpStatus()` then reported `source: "http-date"`, `state: "synced"`, `usingNetworkTime: true`, `lastAttemptResult: "success"`, `roundTripMs: 11`, and `offsetMs: -260`; the visible clock label was `PHONE CLOCK · NETWORK TIME`. The deployed analytics asset identifies build `fbba2ef8434e`, matching the current branch HEAD. This verifies the deployed Chromium browser fallback; it does not establish physical-device timing accuracy.

## 2026-10-03 cold-start readiness smoke race

A fresh install of the current Regular debug APK launched successfully but the device smoke failed to observe `FRONTEND READY app` after its fixed two-second delay. The same process emitted that marker at 3.5 seconds after launch, with no JavaScript/native fatal error; the failure was a smoke-test timeout, not a demonstrated application startup failure. Updated `tools/device-smoke.sh` to poll the debug readiness marker for up to 15 seconds while continuing to fail if the process exits or frontend initialization never completes.

Validation on APK SHA-256 `6d106d1bda3dec2458f30170c15d95a76fe211fd0bcc7cb41a1e909e004632af`, source HEAD `fbba2ef8434e82f026548d805249e9b2518a1aee`: `bash -n tools/device-smoke.sh`, `git diff --check -- tools/device-smoke.sh`, the full `env TZ=UTC bash tools/run-source-smokes.sh` (98 Node smokes plus NTP shell smoke and real Comanche055 WASM), a fresh PWA build plus package/parity smokes, APK verification, and `tools/device-full-smoke.sh` passed. The device gate confirmed frontend readiness, CM peripheral mode, V16N65/V05N09/V14N09/V35, held/released PRO, WebView recreation and 327,680-byte memory restoration, and process recreation. This is Android 16 emulator evidence; physical Android/Fire gates remain outstanding.

## 2026-10-03 strict offline CSP enforcement audit

The repository required and documented a strict offline Content Security Policy, but the packaged page had no policy; `tools/csp-smoke.js` only checked local references and inline script/event-handler absence. Added an enforcing policy to the shared page: default deny, same-origin packaged scripts/styles/images/fonts/media/WASM and workers, and only the narrow `'wasm-unsafe-eval'` exception required by yaAGC. Ordinary `'unsafe-eval'` and all inline execution/style allowances remain absent. The PWA build extends `connect-src` only with the exact HTTPS origin configured for its optional analytics endpoint.

Removed the page's inline DSKY presentation stylesheet and moved it to `dsky-solo.css`. Moved the synthetic incandescent lamp rule out of a runtime-created `<style>` element into packaged CSS. The PWA checklist print window no longer emits inline CSS or JavaScript: its print styles and behavior are separate local assets, and the service worker precaches them. Expanded CSP/PWA/lighting/print smokes to enforce these boundaries and policy directives.

Validation: `node tools/csp-smoke.js`, `node tools/lighting-electrical-model-smoke.js`, `node pwa/tools/pwa-print-bridge-smoke.js`, `node pwa/tools/pwa-smoke.js <fresh local build>`, `node pwa/tools/pwa-parity-smoke.js <fresh local build>`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (98 Node smokes plus the NTP shell smoke and real Comanche055 WASM gate). PWA builds and smokes passed with analytics disabled and with `AGC_ANALYTICS_ENDPOINT=https://metrics.example.test/api`; the latter policy allows only `https://metrics.example.test` in addition to same-origin. Gradle `:app:verifyPinnedAgcAssets :app:assembleRegularDebug`, APK verification, and `tools/device-full-smoke.sh` passed on Android 16 emulator `emulator-5554` under the packaged policy, including frontend readiness, live Comanche055 V16N65/V05N09/V14N09/V35, held PRO, WebView recreation, and process recreation. Captured Android logcat had no CSP/refused-resource entries. Regular debug APK SHA-256: `6d106d1bda3dec2458f30170c15d95a76fe211fd0bcc7cb41a1e909e004632af`; it was built from the current dirty working tree at base HEAD `fbba2ef8434e82f026548d805249e9b2518a1aee`.

Both `AGCDSKYmacOS` and `AGCDSKYiOS` Debug targets built with signing disabled; each app bundle contains 72 byte-identical shared frontend assets plus the exact pinned WASM and Comanche rope. CoreSimulator on this Mac is older than the installed Xcode requires, so iOS simulator runtime could not be exercised. Physical iOS/macOS runtime and an actual PWA-browser print interaction remain unverified.

## 2026-10-03 post-retry-change full Android emulator gate

Reinstalled and exercised the Regular debug APK built after the updater retry-policy change (source commit `fbba2ef8434e82f026548d805249e9b2518a1aee`, SHA-256 `cf2322f6cd47e8eadc4f690e8e9545493d27b42b2408ac7e922e4b4b385a4017`) on Android 16 emulator `emulator-5554`. `tools/device-full-smoke.sh` passed: app startup and packaged frontend readiness, CM mode 1, V16N65/V05N09/V14N09 monitor commands, held/released PRO and visibility release, real Comanche055 P00/V35 with channel 011/0163 and relay 11/12 assertions, full 327,680-byte snapshot restoration after WebView recreation, and process force-stop/relaunch with a fresh CM-configured core. This verifies the updated package on the emulator; it does not exercise the updater because debug variants disable self-update, or replace physical-device, Fire OS, DreamManager, and physical display-fit checks.

## 2026-10-03 GitHub updater rate-limit and scheduled-retry audit

Official GitHub REST guidance documents primary and secondary rate limits as either HTTP 403 or 429; primary limits expose `X-RateLimit-Remaining: 0` and `X-RateLimit-Reset`, while secondary limits may include `Retry-After` or a rate-limit error body. The updater previously retried 429 but treated rate-limited 403 as permanent. It also left a recent successful-check timestamp in place after transient failures, allowing the retry receiver to return early under the 12-hour freshness gate.

The production retry policy now retries 403 only when rate-limit headers or a recognized GitHub rate-limit body identify it; ordinary authorization 403 remains permanent. Retry alarms respect `Retry-After` / reset windows with a 30-minute minimum and 24-hour cap. Transient failures clear only the prior successful-check timestamp while preserving the last-attempt throttle, so the scheduled retry can pass both gates. The JVM smoke executes the production policy for 403/429 boundaries, retry timing, network errors, fallback suppression, and exception cycles.

Validation: `node tools/update-retry-policy-smoke.js`, `node tools/self-update-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (98 Node smokes plus the NTP shell smoke and real Comanche055 WASM gate), Gradle `:app:verifyPinnedAgcAssets :app:assemble :app:lint`, ZIP integrity for all six variants, `tools/verify-apk.sh` for Regular and Fire debug, and `git diff --check` passed. Regular debug APK SHA-256: `cf2322f6cd47e8eadc4f690e8e9545493d27b42b2408ac7e922e4b4b385a4017`; Fire debug: `346b96e9737c9e25d2e948b759902295d22d1a94a15bceea4a1bd6449307b25c`. Live GitHub/release behavior remains unverified; debug builds disable the updater. Source: [GitHub REST API rate-limit guidance](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## 2026-10-03 updater retry classifier executable audit

The updater smoke previously asserted that retry status codes and suppressed-exception traversal were present in source, but did not execute the retry decision itself. Extracted the policy to Android-independent `UpdateRetryPolicy.java` and added `tools/update-retry-policy-smoke.js`, which compiles and runs the production Java logic. It checks retryable HTTP 408/429/5xx and permanent HTTP boundaries, the four network exception types, nested suppressed API-fallback errors, and cyclic failure graphs. `AppUpdater` still supplies typed HTTP status exceptions from release metadata, APK, and checksum requests and schedules retry only when the policy returns true.

Validation on the current working tree: `node tools/update-retry-policy-smoke.js`, `node tools/self-update-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (98 Node tests plus the NTP shell smoke, including real Comanche055 WASM checks), `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon :app:verifyPinnedAgcAssets :app:assembleRegularDebug`, `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk regular`, and `git diff --check` passed. Current Regular debug APK SHA-256: `be5bc467099db32a5bc6ff04e98c4c70478382eba0aa47d75cb25baeed6d2fe0`. The live network/release flow remains unverified because debug builds disable self-update and no release endpoint was exercised.

## 2026-10-03 relay-timing source audit follow-up

Rechecked the unresolved operate/release timing for production DSKY relays 2004688 and 2004689 against the Virtual AGC assembly hierarchy. The primary hierarchy lists relay 2004689-2 and allows 2004688-1 or -2, but identifies no manufacturer timing data. It also documents a source conflict: parent assembly 2003952-031 calls out schematic 2005940, while the later 2005973 is judged more likely from the drawing evidence; the two differ in K22 wiring, and neither page establishes production relay timing. This strengthens the source trail but does not justify replacing the app's explicitly labeled predecessor timing references or claiming exact relay bounce/timing. Source: https://www.ibiblio.org/apollo/2003994-021.html. Exact production unit timing remains unresolved.

## 2026-10-03 current Regular APK full emulator and screenshot-surface audit

Built and verified the current Regular debug APK from source commit `fbba2ef8434e82f026548d805249e9b2518a1aee` (SHA-256 `568e359083b686a23a0d848188004105bae5649025a3041bf07ea326a346c37b`). `tools/device-full-smoke.sh` passed on Android 16 emulator `emulator-5554`: packaged frontend startup, real Comanche055 V16N65/V05N09/V14N09 monitor commands, held/released PRO, P00 relay 11 `01265`, V35 `88/88/88 +88888`, relay 12 `00650`, raw channel 011/0163 annunciator checks, WebView recreation with the 327,680-byte memory snapshot restored into a fresh core, and process force-stop/relaunch with the same snapshot restored into a fresh CM core.

The Android `screencap` image initially appeared to have an opaque black mask over the upper-left DSKY. A Chrome DevTools `Page.captureScreenshot` from the same packaged WebView showed the complete DSKY and controls. Live CSS geometry was viewport 262×466, DSKY x=2/y=20.42/258.18×300.14, controls x=4/y=324.56/254.18×121.20 with an internal scrollport. The black mask therefore came from outside the rendered WebView page; do not use that Android surface capture as proof of page clipping. The WebView screenshot showed the current all-8 V35 state. Physical-phone layout and sensor behavior remain unverified.

The exact APK passed `tools/verify-apk.sh`; `tools/device-full-smoke.sh` passed as recorded above. The Regular/Fire six-variant Gradle build and lint had already passed for this source revision, and the full source suite/PWA runtime checks are recorded in the browser-audio audit below.

## 2026-10-03 Android PIPA display-frame audit

The Android-native PIPA path used inconsistent display rotations: linear acceleration was rotated from sensor axes by `+displayAngle`, while Android `SensorManager` documents the `ROTATION_90` screen basis as `AXIS_Y, AXIS_MINUS_X` (sensor +X therefore becomes screen −Y, and sensor +Y becomes screen +X). The rotation-vector quaternion was also right-multiplied by the inverse transform, so the sensor vector and attitude frame disagreed in landscape. The previous host smoke generated fixtures using the same sign convention as production and did not independently assert Android's basis mapping.

Changed the native path to convert sensor vectors into screen coordinates with `-displayAngle` and right-multiply device-to-world quaternions by the corresponding screen-to-device `+displayAngle`. Added independent 0/90/180/270 basis expectations and direct production-module assertions for device +X→screen −Y and +Y→screen +X at 90°, while retaining bias cancellation, compound-attitude and delta-V scale coverage. The Android API documentation establishes the coordinate remap; real physical handset integration remains unverified.

Validation: `node --check app/src/main/assets/phone-icdu.js`, `node --check tools/pipa-inertial-frame-smoke.js`, `node tools/pipa-inertial-frame-smoke.js`, and `node tools/asset-reference-smoke.js` passed. `env TZ=UTC bash tools/run-source-smokes.sh` passed (96 Node smokes plus NTP shell smoke, including real pinned Comanche055 WASM). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assembleRegularDebug` built the packaged app; `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk regular` passed, and the APK passed `tools/device-full-smoke.sh` on Android 16 emulator `emulator-5554` including V16N65, V05N09, V14N09, V35, page recreation and process recreation. APK SHA-256: `7adac669af7406d3161bc5ba6737377d8ba180b121caebe674e0601381934e03`. The emulator path does not inject real sensor motion, so physical-phone PIPA orientation remains unverified.

## 2026-10-03 PIPA calibration authority

Android documents that the linear-acceleration sensor has an offset and recommends measuring it with the device still during an application calibration step. The app's cheat sheet already told users to hold the phone still and tap `PIPA CALIBRATE`, but native sensor discovery silently started calibration immediately at startup. This could record motion as the bias, and the app then integrated PIPA input without a user-confirmed calibration.

Removed automatic calibration on sensor availability. PIPA increments now remain disabled until the user explicitly starts and completes the calibration sample window; the diagnostic control distinguishes `PIPA CALIBRATE` from `PIPA RECALIBRATE`, and the five-second PIPA motion diagnostic refuses to claim a test before calibration. `tools/pipa-inertial-frame-smoke.js` now verifies no auto-calibration or uncalibrated increments, the explicit control transition, and the existing offset/frame/pulse behavior. The calibration still relies on the user holding the phone still as instructed; physical handset calibration quality is unverified.

Validation: `node --check app/src/main/assets/phone-icdu.js`, `node --check app/src/main/assets/diagnostics.js`, `node --check tools/pipa-inertial-frame-smoke.js`, `node tools/pipa-inertial-frame-smoke.js`, `node tools/diagnostics-self-test-smoke.js`, and `node tools/asset-reference-smoke.js` passed. `env TZ=UTC bash tools/run-source-smokes.sh` passed (96 Node smokes plus NTP shell smoke and real Comanche055 WASM checks). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assembleRegularDebug`, APK verification, and `tools/device-full-smoke.sh` passed on Android 16 emulator `emulator-5554`; the device gate covered frontend startup, CM mode, physical-key/held-PRO bridge, V16N65, V05N09, V14N09, V35, page recreation, and process recreation. APK SHA-256: `e51c1171cb86f5e1f59013b52bf5ff70943b9527e08f0311a0821687e335075b`. Emulator does not establish real-sensor calibration quality; physical-phone PIPA behavior remains unverified.

## 2026-10-03 acceleration fallback filter audit

When a device lacks `TYPE_LINEAR_ACCELERATION` and `TYPE_GRAVITY`, `SensorMainActivity` estimates gravity from accelerometer samples using a fixed `0.92/0.08` coefficient per delivered event. This gives a different filter time response when sensor event spacing varies. Android's motion-sensor guide shows computing the low-pass coefficient from a time constant and the elapsed event interval.

The fallback now computes `alpha = tau / (tau + dt)` from event timestamps. `tau=0.23 s` preserves the former `0.92` coefficient at an assumed 20 ms sample spacing; this is an application filter setting, not a phone measurement or Apollo requirement. Extracted the gravity-removal logic into Android-independent `AccelerometerGravityFilter.java` and added `tools/native-sensor-fallback-smoke.js`, which compiles and exercises that production Java class for first-sample gating, gravity subtraction, initialization, and irregular event timing. The Android 16 emulator exposes a linear-acceleration sensor, so fallback selection on a device lacking that sensor remains unverified.

Validation: `node tools/native-diagnostic-smoke.js`, `node tools/pipa-inertial-frame-smoke.js`, and `git diff --check` passed. `env TZ=UTC bash tools/run-source-smokes.sh` passed (96 Node smokes plus NTP shell smoke and real Comanche055 WASM checks). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assembleRegularDebug` compiled and packaged the Java change, and APK verification passed. The first Android 16 emulator full-smoke attempt missed V14N09 output before its polling deadline; an immediate rerun on the identical APK SHA-256 `39c45c9210645a91a81fedd562062830584dbe4ab2482aa28556adfab9cabc2f` passed V14N09, V35, page recreation and process recreation. Emulator sensors do not exercise the low-pass fallback because `TYPE_LINEAR_ACCELERATION` is available there; test it on hardware without that sensor remains outstanding.

## 2026-10-03 sensor registration fallback audit

`registerListener()` returns whether each sensor was successfully enabled, but the app previously collapsed these results into one overall lifecycle flag and reported sensor availability from discovered sensor objects. A discovered linear-acceleration sensor that failed registration could be reported as available without any PIPA events, while the accelerometer/gravity fallback sensors had not even been discovered. A gravity sensor present but failing registration could leave gravity in accelerometer samples because fallback selection checked sensor-object presence rather than successful registration. IMU and magnetic status had the same discovered-versus-enabled mismatch. The accelerometer fallback could also forward raw acceleration before the registered gravity stream delivered its first sample.

The native activity now records successful registration per attitude, magnetic, linear-acceleration, gravity, and accelerometer sensor. It tries the accelerometer path if the preferred linear-acceleration registration fails, uses time-based gravity estimation if the gravity listener itself fails, ignores callbacks from sensors that did not register, holds accelerometer events until a registered gravity stream supplies its first sample, and reports availability from active listeners. Registration and fallback ordering now live in Android-independent `SensorRegistrationPolicy.java`; `tools/native-sensor-fallback-smoke.js` drives that production policy with success/failure results and separately executes the production gravity filter. `tools/native-diagnostic-smoke.js` checks the Android adapter wiring. The available emulator successfully registers all sensors, so an actual `SensorManager.registerListener()` failure remains unverified on Android hardware.

Validation on the latest source: `node --check tools/native-sensor-fallback-smoke.js`, `node tools/native-sensor-fallback-smoke.js`, `node tools/native-diagnostic-smoke.js`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (97 Node smokes plus `ntp-time-smoke.sh`, including real Comanche055 WASM checks). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assembleRegularDebug`, `tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk regular`, and `tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed. The Android 16 emulator gate covered V16N65, V05N09, V14N09, V35, page recreation, and process recreation. APK SHA-256: `e19046feeade7e671a98199c536f22f5432926341a3f30b165c213679d370c53`. The emulator accepts all real sensor registrations; physical-sensor behavior and an actual Android registration-failure callback remain unverified.

After the focused device gate, `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh :app:verifyPinnedAgcAssets :app:assemble :app:lint` also passed for all six Regular/Fire variants. Lint reported 11 warnings and zero errors.

## 2026-10-03 updater HTTP retry audit

The updater treated non-200 responses from release metadata, APK download, and checksum download as generic permanent errors. That bypassed its scheduled retry for HTTP timeouts, rate limits, and server failures. Added a status-carrying HTTP exception and classify 408, 429, and 5xx responses as retryable; other client errors remain non-retryable, and the latest-release API's 404 remains the existing successful no-update result. Review of the API-to-raw-host fallback also found its retryable failure is attached as a suppressed exception, which the old cause-only classifier skipped. Retry classification now walks causes and suppressed exceptions with cycle protection. `tools/self-update-smoke.js` guards all three request paths and these status-policy boundaries.

Validation: `node tools/self-update-smoke.js` and `env TZ=UTC bash tools/run-source-smokes.sh` passed (96 Node smokes plus `ntp-time-smoke.sh`). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assemble` built all six Regular/Fire debug, installfix, and unsigned release variants. Both debug APKs passed `tools/verify-apk.sh`; all six passed ZIP integrity and Comanche055-present/Luminary-absent checks. Final debug APK SHA-256: Regular `25ad88f850ddf721f2318afda62a5a02e5fb283c0060aff1558af19a9243b54b`; Fire `99349103db1470779def8c0bf5f132669a6de50a4f8d9e379f00f7f7974fc259`. `:app:lint` passed with 0 errors and 11 existing warnings; `git diff --check` passed. The pre-change six-APK matrix was preserved in `<temporary-path>`. The retry behavior was not exercised against a live HTTP server or release channel; debug builds disable the updater, and release APKs are unsigned.

## 2026-10-03 current Android matrix, lint, and Apple bridge audit

Built all six Regular/Fire debug, installfix, and unsigned release APK variants from the current working tree with Gradle 9.5.1 using `:app:verifyPinnedAgcAssets :app:assemble`. ZIP integrity passed for all six; each contains the pinned Comanche055 rope and excludes Luminary099. Regular and Fire debug packages passed `tools/verify-apk.sh` and use the debug certificate with APK Signature Scheme v2; they are test builds, not client update packages. The six APKs that existed before this matrix build were preserved under `<temporary-path>`.

`env TZ=UTC bash tools/run-source-smokes.sh` passed on this source state (96 Node smokes plus `ntp-time-smoke.sh`). Full Android lint completed with 0 errors and 11 warnings: four API-level `UnusedAttribute` notices for Dream/widget XML, four `@TargetApi` versus `@RequiresApi` notices, and three JavaScript-enabled WebView review notices. The WebViews require packaged JavaScript and configure `setBlockNetworkLoads(true)`, `setAllowFileAccess(false)`, and `setAllowContentAccess(false)`; no warnings were suppressed. The canonical `tools/build-local.sh` clean-tree gate remains unrun because this checkout contains extensive pre-existing work; its explicit Gradle/source equivalents were run instead.

Reviewed Apple `WKWebView` native boundaries. Script messages require the main frame and exact private `agcdsky://app` origin before print or haptic dispatch; camera grants require that same origin, the main frame, and camera capture; external HTTP(S) navigations leave the embedded view. Relay haptic inputs have explicit byte/count/duration/amplitude limits. `node tools/apple-script-bridge-smoke.js`, `node tools/apple-camera-permission-smoke.js`, and `git diff --check` passed. This is source/build-policy evidence only; Apple WebKit runtime, physical Apple hardware, Fire OS, and physical Android behavior remain unverified.

Remaining accuracy gap: readable production SCDs for relays 2004688 and 2004689 have not been located in the Virtual AGC catalogs, so exact unit-level operate/release timing and bounce remain unresolved. The runtime retains explicitly labeled predecessor-spec presentation references and does not claim measured production acoustics.

## 2026-10-03 PWA icon recovery

Recovered the intended icon artwork from the tracked Android `ic_launcher_original.webp` (144×144). The three tracked PWA PNGs were genuinely undecodable: their IDAT payloads failed CRC/inflate checks, and identical broken copies existed in older local worktrees, so there was no recoverable higher-resolution PWA image. Rebuilt the 180×180 Apple touch icon and 192×192/512×512 PWA icons by resampling the preserved launcher artwork; the displayed design is retained, with sharpness limited by the 144×144 source. Before replacement, copied the three broken files to `<temporary-path>`.

Validation: `file pwa/icons/*.png` confirms the required dimensions; a fresh site build to `<temporary-path>` passed `node pwa/tools/pwa-parity-smoke.js <temporary-path>` and `node pwa/tools/pwa-smoke.js <temporary-path>`, including complete PNG CRC/decompression validation and service-worker precache installation. A [W3C manifest review](https://www.w3.org/TR/appmanifest/#icon-masks-and-safe-zone) found the earlier manifest incorrectly declared the close-cropped square as `maskable`; the W3C safe zone is a centered circle with radius 40% of the icon size. The normal 192/512 icons now declare `any`, and a separate 512px icon pads the same source artwork to keep the main DSKY/label inside the safe zone. The maskable preview was visually checked before adding it to the manifest. No app runtime icon wiring changed.

Refreshed current-tree validation: every PNG chunk in all four source icons passes CRC validation; `bash pwa/tools/build-site.sh <temporary-directory>`, `node pwa/tools/pwa-parity-smoke.js <temporary-directory>`, and `node pwa/tools/pwa-smoke.js <temporary-directory>` all passed. This verifies the current local bundle; the hosted GitHub Pages copy has not been republished or rechecked.

## 2026-10-03 primary EL geometry source decision

Reopened the primary MIT/MSC SCD 1006315G Rev G scan while reconciling the request for a direct scan-derived redraw with the current geometry audit. The drawing explicitly says “DO NOT SCALE THIS DRAWING”; its controlled Detail-C dimensions, not raster-traced pixels, govern the electrode. The current custom vectors match the asymmetric contours and named-segment layout on the scan, and the primary-callout conformance and physical E/N identity checks pass. A pixel trace of the scan would replace drawing-controlled geometry with lower-authority raster estimates without fixing a demonstrated mismatch, so no geometry rewrite is warranted. The CAD reconstruction remains a secondary provenance/license item, not an open accuracy defect.

Validation: `node tools/el-drawing-conformance-smoke.js`, `node tools/el-geometry-lock-smoke.js`, and `node tools/dsky-mapping-smoke.js` passed against the current source. The verified current Regular debug APK also passed the full Android 16 Comanche V35 gate; `<temporary-path>` was visually checked and shows the corrected, filled asymmetric E/N strokes in the live display. The capture does not measure the physical screen's optics. Primary scan: [MIT/MSC SCD 1006315G](https://www.ibiblio.org/apollo/SCDs/scd_1006315g.pdf), sheet 1, Detail C and title-block instruction.

## 2026-10-03 PIPA sensor-bias coordinate audit

The CM scale is source-confirmed: Apollo Guidance Computer System Test Procedures §§21-119–21-120 gives exactly `5.85 cm/sec/pulse`, equivalent to the app's `0.0585 m/s`. The input audit found a separate frame error: linear acceleration was rotated from device axes into the simulated stable-platform frame, while the calibrated sensor-bias vector was stored and subtracted as if it were already in that frame. A stationary, biased phone could therefore accumulate false PIPA delta-V while being rotated.

The app now stores the calibrated bias in raw device axes and applies the same display/reference rotations to the bias as to each sample before subtraction. Added `tools/pipa-inertial-frame-smoke.js`, which executes the production phone module with a fixed bias, rotates 90 degrees with zero real acceleration, and requires no pending or fractional PIPA pulses; it then verifies stable-frame +X/-X map only to PIPAX and conserve the source-backed `5.85 cm/s` scale. The diagnostic field is now named `biasDevice` to reflect its coordinate frame. This host test does not measure physical phone accelerometer bias or establish real-device sensor fidelity.

Validation: `node --check app/src/main/assets/phone-icdu.js`, `node --check tools/pipa-inertial-frame-smoke.js`, `node tools/pipa-inertial-frame-smoke.js`, `node tools/source-smoke-manifest-smoke.js`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (96 Node smokes plus NTP shell smoke). Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assembleRegularDebug` built the current Regular debug APK; `tools/verify-apk.sh` and `tools/device-full-smoke.sh` passed on Android 16 emulator `emulator-5554`. APK SHA-256: `c7229ef8d726a5ed26e4901fd9b56d58635b60845837a95a64234b6615b1daf0`. The packaged runtime exercised normal CM input, V16N65/V05N09/V14N09/V35, page recreation, and process recreation. It did not inject PIPA sensor values on-device; PIPA-frame behavior is covered by the production-module host regression, while real handset sensor behavior remains unverified.

Cross-platform packaging follow-up: macOS and iOS Simulator Debug builds both succeeded, and each staged `phone-icdu.js` byte-for-byte from the corrected shared source. `<temporary-path>` built successfully and passed its 71-asset parity smoke; its package smoke exposed the broken touch-icon PNG before the icon recovery recorded above. The follow-up fresh site build now passes the complete PWA package smoke with the recovered original artwork.

Extended the PIPA production-module regression beyond its initial 90-degree case: it now calibrates device-axis bias and checks a compound attitude at each 0/90/180/270-degree display rotation, requiring zero bias-generated counts and correct stable-frame +X integration. An exact two-pulse fixture exposed expected floating-point behavior just below the integer boundary; the final stimulus uses a small margin above the threshold and checks accumulated delta-V conservation rather than demanding an exact floating-point boundary. The expanded PIPA smoke and full 96-test source suite pass. This remains a host simulation, not physical handset sensor evidence.

## 2026-10-03 Comanche multi-component read-only display audit

Extended the real-WASM and packaged-WebView gates with source-defined `V14N09E`: Comanche055 V14 monitors components 1 and 2, while N09 is a three-component octal alarm-code noun. The Node gate requires the corresponding six display relays for R1/R2 and no OPR ERR; the device gate now enters and executes V14N09 through DevTools `Input.dispatchKeyEvent`, exercising the app's real WebView keydown/keyup listener, then requires both rendered octal words with raw and rendered OPR ERR clear. This exercises the component-count boundary without loading or mutating mission data. The source reference now links the upstream Comanche command and noun definitions.

Validation: `env TZ=UTC bash tools/run-source-smokes.sh` passed (95 Node smokes plus the NTP shell smoke). The real yaAGC/Comanche055 gate passed with V14N09 selectors 3–8 reached within 20,000 steps. The keyboard electrical interlock smoke now behaviorally checks all 18 Pinball keys plus `Enter`/`Escape` aliases, repeats, matched releases, and editable-field exclusions. `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-agc-smoke.sh` passed on emulator `emulator-5554`: packaged-WebView key events entered/executed V14N09E and rendered `01107 00000`, followed by existing V35 and page-recreation gates. `node tools/device-v35-policy-smoke.js` and `git diff --check` passed. Physical-keyboard behavior on a handset remains unverified.

## 2026-10-03 hosted PWA runtime and offline-precache audit

Opened the live GitHub Pages site in Playwright Chromium. Its DSKY UI rendered without browser console errors; the real shipped Comanche055 WASM reported version `2020-12-24 ddc65e7`, with hosted WASM SHA-256 matching the pinned local core and the 73,728-byte Comanche rope returning HTTP 200. Through the actual UI, held the panel to expose controls, entered AGC mode, drove `V37E00E` to P00 / relay-11 low-11 `01265`, and executed the read-only `V05N09E` alarm-code display. It showed `01107 00000 00000`, retained blank octal signs, and had OPR ERR clear. Returned the isolated browser session to CLOCK after the command.

The deployed service worker's source-backed precache list contains `./.self-contained-assets-note`; an exact public GET returns HTTP 404. Probed all 86 hosted precache URLs: that hidden marker was the only failure. The install handler uses one atomic `cache.addAll(CORE_ASSETS)`, so the missing file rejects worker installation. This also explains why the live PWA's offline-ready state is not established. Fixed `pwa/tools/build-site.sh` to omit this repository-only marker from both staging and generated precache, and strengthened `pwa/tools/pwa-smoke.js` to reject it and fail if any generated precache URL is absent from the staged site.

The three live PWA PNG icons have corrupt image data: fresh parsing confirmed CRC mismatches and zlib inflate failures in the IDAT payloads, so correcting checksums alone cannot recover their pixels. Each hosted file is byte-identical to its broken tracked source. No replacement artwork was installed. A fresh current-source build at `<temporary-path>` omitted the marker, passed `node pwa/tools/pwa-parity-smoke.js`, and confirmed 71 shared assets; `node pwa/tools/pwa-smoke.js` still fails on `icons/apple-touch-icon.png ... IDAT CRC mismatch`. The earlier temporary bundle used generated valid placeholder PNGs only to exercise the complete PWA package smoke; no artwork source or deployment changed. GitHub Pages still serves the unfixed service worker until a future authorized publication; live offline operation and physical phone-browser behavior remain unverified.

## 2026-10-03 analytics activity-window accuracy fix

The Worker stores `last_seen` with `Date.toISOString()` (`T` separator and `Z`) but counted active users by lexically comparing it with SQLite `datetime()` output (space separator). Since `T` sorts after a space, rows from just before the seven-day cutoff were incorrectly counted as active. Changed the predicate to compare against `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')`, matching the stored representation while keeping the indexed `last_seen` column bare. A fixed-time SQLite probe reproduced the old count of 3 versus the correct ISO cutoff count of 2; `EXPLAIN QUERY PLAN` confirmed the corrected predicate uses `idx_clients_last_seen`. Added a worker-smoke guard for the normalized cutoff and the boundary fixture. This does not address the separate public-endpoint abuse/rate-limit risk.

Validation: `node --check analytics/cloudflare/worker.js`, `node --check analytics/cloudflare/worker-smoke.mjs`, `node analytics/cloudflare/worker-smoke.mjs`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (95 Node smokes plus NTP shell smoke). SQLite version of the exact query passed the boundary/count and index-plan assertions.

## 2026-10-03 Apple target build and bridge audit

Built both Apple targets from this worktree with Xcode 27 using separate `<temporary-path>` DerivedData directories. The macOS and iOS Simulator Debug app bundles each staged 74 shared web files plus the pinned core and rope; SHA-256 checks matched the source `yaAGC.wasm` (`38107b60…b7cec`) and Comanche055 rope (`2ba31de9…a2d79`). `tools/apple-script-bridge-smoke.js` and `tools/apple-camera-permission-smoke.js` passed. Xcode emitted a CoreSimulator framework-version mismatch warning but completed both builds successfully; simulator startup and rendered WebKit behavior remain unverified.

The source audit found an Apple relay-haptic gap: `AGCWebView.swift` originally injected `keyMake`, `keyRelease`, and `testPulse`, while shared `relay-identity-audio.js` requires `relayWaveform` or `relayImpact` for relay haptics and suppresses browser vibration whenever `window.HapticBridge` exists. Added the missing Apple bridge methods, using Core Haptics capability detection and one transient event for each nonzero relay waveform segment. The bridge bounds input size, segment count, durations, amplitudes, and total time before scheduling; the encoded Android amplitude is normalized by 255 without claiming cross-device tactile equivalence. `tools/apple-script-bridge-smoke.js` now checks the dispatch methods, capability query, origin guard, and limits. Both Apple Debug targets rebuilt successfully after this change. `swift -e 'import CoreHaptics; print(CHHapticEngine.capabilitiesForHardware().supportsHaptics)'` returned `false` on this Mac, so its hardware cannot verify haptic output; simulator/physical tactile output remains unverified.

## 2026-10-03 refreshed Android packaged-runtime audit

Verified the current Regular debug APK (`bfd946b96bc71bdd72e94f69fccea060377a4ff326348595b064e837024efd94`) against source and reran `tools/device-full-smoke.sh` on the attached Android emulator. APK metadata/pinned-assets/frontend checks passed. Packaged WebView input reached Comanche055 V16N65E and V05N09E (`01107 00000 00000`), held/released PRO, then reached P00 and V35 with relay 12 `00650`, raw channel 011/0163 checks, page recreation snapshot restore, and force-stop/process recreation snapshot restore. The captured V35 screenshot is `<temporary-path>`. `env TZ=UTC bash tools/run-source-smokes.sh` also passed with 95 Node smokes plus the NTP shell smoke. Fire OS and physical-phone behavior remain unverified.

## 2026-10-03 Comanche non-V35 Pinball input-path audit

Extended the real pinned yaAGC/Comanche055 host gate with the source-documented read-only `V05N09E` path. At the pinned VirtualAGC source commit `ddc65e7bed41f1301921b934fcbaaee93db99dda`, Comanche documents V05 as a three-component octal display and N09 as the alarm-code noun (`FAILREG`). The host test enters P00, types the exact Pinball key sequence, checks the latched V05/N09 relay words, executes ENTR, requires all eight numeric display selectors, and rejects raw channel-0163 OPR ERR. It does not assert a specific alarm value.

Extended the packaged-WebView device driver to enter and execute the same command with DSKY pointer events and exact channel-015 codes, require PROG 00 / VERB 05 / NOUN 09, and verify three five-digit octal fields with blank signs and both raw/rendered OPR ERR clear. The Android 16 emulator displayed `01107 00000 00000`; the subsequent V35 relay/raw-channel check, page recreation, process death, and CM snapshot restoration also passed. The first assertion attempt rejected the UI's single-space representation for an unlit sign; the regression now checks trimmed blank signs. No production runtime code changed.

Validation: `node --check tools/wasm-runtime-smoke.js`, `node --check tools/device-v35-smoke.js`, `node --check tools/device-v35-policy-smoke.js`, `node tools/device-v35-policy-smoke.js`, `node tools/wasm-runtime-smoke.js`, `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed. The full source runner reported 95 Node smokes plus `ntp-time-smoke.sh`. Emulator gate used the current verified `.eltest` APK (SHA-256 `bfd946b96bc71bdd72e94f69fccea060377a4ff326348595b064e837024efd94`) and restored mission/run-mode state after both WebView and process recreation.

Source: [VirtualAGC Comanche055 assembly and operation information at the pinned source revision](https://github.com/virtualagc/virtualagc/blob/ddc65e7bed41f1301921b934fcbaaee93db99dda/Comanche055/ASSEMBLY_AND_OPERATION_INFORMATION.agc) and [Comanche055 Pinball noun tables](https://github.com/virtualagc/virtualagc/blob/ddc65e7bed41f1301921b934fcbaaee93db99dda/Comanche055/PINBALL_NOUN_TABLES.agc).

## 2026-10-03 current APK, runtime, and controls-scroll audit

Revalidated the current Regular debug APK (SHA-256 `bfd946b96bc71bdd72e94f69fccea060377a4ff326348595b064e837024efd94`, source commit `fbba2ef8434e82f026548d805249e9b2518a1aee`) against the modified source tree. `verify-apk.sh` confirmed v1.1.62/versionCode 2026093009, exact pinned CM WASM and Comanche rope, byte-for-byte current frontend assets, and absence of the LM rope. The full Android 16 emulator gate passed again: V16N65E, pointer VERB/held PRO, P00 relay 11 low-11 `01265`, V35 `88/88/88 +88888`, relay 12 `00650`, raw channel 011/0163 checks, page recreation, and force-stop/process recreation with a restored 327,680-byte snapshot in a fresh CM core.

Inspected the verified WebView screenshot `<temporary-path>` (721×1282); it shows the portrait panel at its initial scroll position. A read-only live DOM measurement at the same viewport (262×466 CSS px) found the controls panel has 173 px content in a 120 px scrollport. Setting its scroll position to maximum made the lighting controls fully visible within both panel and viewport; the original scroll position was restored. Thus this capture shows a scrollable panel at its top, not inaccessible clipped controls. Removed the temporary ADB forward after inspection.

Validation: `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` and `AGC_V35_SCREENSHOT_PATH=<temporary-path> ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed. Final `git diff --check` passed. Fire OS/physical-device behavior remains unverified.

Rechecked the analytics Worker payload regression with `node analytics/cloudflare/worker-smoke.mjs` (PASS). `node pwa/tools/pwa-smoke.js pwa/dist` still fails immediately with `icons/apple-touch-icon.png ... IDAT CRC mismatch`, confirming the checked-in PWA build output remains unusable until its PNG artwork is replaced with owner-approved valid files.

## 2026-10-02 Apple print-size documentation audit

Found and corrected an inaccurate Apple README claim. The README said the checklist uses 5.5 × 8-inch media, but `app/src/main/assets/cheatsheet.css` requests `Letter landscape` with 0.25-inch page margins and describes 5.10 × 3.80-inch checklist cards. The iOS renderer sets an 11 × 8.5-inch page rectangle; the macOS renderer sets 8.5 × 11-inch Letter stock with landscape orientation. Updated `apple/README.md` to match those sources. Native print output itself remains unverified on Apple hardware/runtime.

Validation: manually compared the shared `@page`/card rules, both native print branches, and the README. `xcodebuild -list -project apple/AGCDSKY.xcodeproj` lists the iOS and macOS targets, but reports CoreSimulator 1051.55.0 is older than this Xcode 27 build's required 1171.7.0; simulator runtime verification is unavailable on this host.

## 2026-10-02 Apple media-capture permission audit

The Apple delegate granted `.cameraAndMicrophone` to the packaged app origin, despite the sextant requesting `{audio:false, video:...}` and the app providing no microphone privacy description. Narrowed the native grant to `.camera` requested by the main frame at the packaged app origin; all other media-capture types, frames, and origins are denied. Added `tools/apple-camera-permission-smoke.js` and included it in the source-smoke manifest to preserve the camera-only invariant.

The native script-message handler also accepted PrintBridge/HapticBridge messages without checking the sender frame or origin. It now dispatches only for a main-frame message from `agcdsky://app`; `tools/apple-script-bridge-smoke.js` locks in that gate.

Validation: `node --check` and direct runs of both new Apple policy smokes passed; the full `env TZ=UTC bash tools/run-source-smokes.sh` suite passed (95 Node smokes plus `ntp-time-smoke.sh`, including real Comanche P00/V35 runtime). After the changes, both `xcodebuild -project apple/AGCDSKY.xcodeproj -scheme AGCDSKYmacOS -configuration Debug -destination 'platform=macOS' -derivedDataPath <temporary-path> CODE_SIGNING_ALLOWED=NO build` and the equivalent `AGCDSKYiOS` build with `-sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <temporary-path>` completed with `** BUILD SUCCEEDED **`; both stages verified pinned assets. Staged WASM and Comanche SHA-256 values matched the repository inputs. Xcode still warns that installed CoreSimulator is older than required, so no simulator app launch, camera prompt, or Apple print runtime behavior is verified.

## 2026-10-02 production relay drawing search

Checked the Virtual AGC scanned-drawing index and Electrical/Mechanical source catalog for production part numbers 2004688 and 2004689; neither page has a matching entry, and broad exact-number web searches did not surface an Apollo drawing. This is evidence that the needed SCDs are not discoverable in those public indexes, not proof that they do not exist. No per-relay production timing was inferred from the generic channel scan or replica behavior; the exact relay acoustic timing remains unresolved. Sources: https://www.ibiblio.org/apollo/AgcDrawingIndexBox439.html and https://www.ibiblio.org/apollo/ElectroMechanical.html.

## 2026-10-02 Android native and WebView trust-boundary review

Reviewed the merged Android manifest, active `SensorMainActivity` and `AgcDreamService` WebView setup, `NetClient`, JavaScript bridge permissions, update components/provider, `AppUpdater`, debug-report storage, and backup exclusions. Both active WebViews disable network loads and file/content access; `NetClient` serves only the exact packaged HTTPS asset host and validates decoded path segments before opening APK assets. Camera and geolocation prompts are restricted to that origin, the DreamService is protected by `BIND_DREAM_SERVICE`, update components are private, cleartext is disabled, and app-private report/update state is excluded from backup. The updater bounds APK streaming, checks the published SHA-256, requires a higher version and matching installed signer/package, then exposes a read-only content URI to the system installer. No new code defect was demonstrated in this review.

Validation: `node tools/manifest-policy-smoke.js`, `node tools/csp-smoke.js`, `node tools/self-update-smoke.js`, `node tools/asset-reference-smoke.js`, and `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed. These policy/source smokes do not adversarially exercise arbitrary WebView navigation, redirects, or JavaScript bridge calls on device; those behaviors remain supported by source review and the offline packaged-WebView runtime gate rather than a dedicated negative runtime test.

## 2026-10-02 repeated full Android device gate

Re-ran the same-process WebView gate after the earlier `DevTools WebSocket closed` failure. It passed independently and again inside the full device wrapper after reinstalling the current APK. The run reached Comanche055 V16N65E with numeric output and no OPR ERR, P00 with relay 11 low-11 `01265`, then V35 with rendered `88/88/88` and `+88888` in all registers, relay 12 low-11 `00650`, and raw channel 011/0163 annunciator checks. WebView reload and actual Android process death both restored the 327,680-byte snapshot into a fresh CM-configured core. A separate landscape-primary run at 466×262 CSS px showed the complete DSKY and controls panel within the viewport. In that installed WebView, opening AUX placed QUICK REF and SOURCE fully inside the viewport at x=248..420/y=76..106. The screenshot is captured from the WebView because Android `screencap` returned a visibly mismatched composition. One DevTools socket close recurred on the first landscape sequence, then direct V35 and a repeated full same-process sequence passed. The socket-close cause is undetermined.

Validation: `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk`, `AGC_V35_SCREENSHOT_PATH=<temporary-path> ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk`, and `AGC_V35_SCREENSHOT_PATH=<temporary-path> ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-agc-smoke.sh org.apollo.agcdsky.eltest` passed. APK SHA-256: `bfd946b96bc71bdd72e94f69fccea060377a4ff326348595b064e837024efd94`, source commit `fbba2ef8434e82f026548d805249e9b2518a1aee`. Verified V35 EL display captures: `<temporary-path>` (portrait) and `<temporary-path>` (landscape). Landscape controls/AUX capture: `<temporary-path>`. Emulator orientation settings were restored after the landscape check. Fire OS, physical display fit/orientation, DreamManager, and physical keys are still unverified.

## 2026-10-02 EL widget alarm policy and API 36 runtime audit

Resolved a stale source-contract mismatch: the widget uses `AlarmManager.RTC`, which is non-wakeup, but its minute scheduler uses exact delivery on pre-Android 12 and only when Android 12+ reports exact-alarm access; otherwise it falls back to `setAndAllowWhileIdle`. Clarified that contract, added a narrow lint suppression for the guarded calls, and strengthened the widget smoke to require both guarded exact paths, the inexact fallback, and absence of `RTC_WAKEUP`.

Runtime evidence: installed the current Regular debug APK on the API 36 emulator, added the EL widget to the launcher, and inspected the real AppWidget and AlarmManager state. The widget displayed PROG 00 / VERB 16 / NOUN 65 and live `+00002`, `+00033`, `+00045` registers at emulator time 02:33:45. The minute tick appeared as `RTC` type 1 with a nonzero delivery window and no exact-alarm app-op requested; repeated minute scheduling showed zero wakeups. A second V35 screenshot remains available at `<temporary-path>`.

Validation: `node tools/el-widget-smoke.js`, `env TZ=UTC ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:assembleRegularDebug :app:lint`, `env ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (93 Node smokes plus `ntp-time-smoke.sh`). APK SHA-256: `7c25bedd5792a13da1a6e087ad78f9f4f8928666ef2896c0ba56dc30490d73d7`. The live launcher capture is `<temporary-path>`.

## 2026-10-02 PWA analytics payload and Worker input audit

Traced the PWA event from the client through the Cloudflare Worker. The client sends only `event`, random `clientId`, `standalone`, coarse `device`, and `build`; credentials are omitted, and both the `?telemetry=off` preference and Do Not Track suppress sends. The Worker bounds bodies to 2 KiB, checks allowed origins and event/client-id shape, and HMAC-hashes the client ID before D1 storage. A direct malformed-request probe found JSON `null` threw a TypeError before validation. Added an object-payload guard returning HTTP 400 and regressions for null, array, and scalar JSON bodies.

Validation: `node --check analytics/cloudflare/worker.js`, `node --check analytics/cloudflare/worker-smoke.mjs`, `node analytics/cloudflare/worker-smoke.mjs`, `node --check pwa/tools/pwa-smoke.js`, `AGC_ANALYTICS_ENDPOINT=https://analytics.example bash pwa/tools/build-site.sh <temporary directory>`, and `node pwa/tools/pwa-smoke.js <temporary directory>` passed. The client test uses a mocked fetch and verifies the exact payload allowlist plus both opt-out paths; it sends no network request.

At the pre-merge deployment check, `analytics.js` reported `ENDPOINT = ""` and build `fbba2ef8434e`. After PR #211's Pages deployment, a fresh read reports build `e3a097e72950` and still has an empty endpoint, so new PWA clients do not enable telemetry or send launch/install events. Previously installed/offline clients could still have an older cached bundle. The public GitHub Actions API reported zero runs of `deploy-analytics.yml`; that does not rule out a manual Wrangler deployment. The exact Worker URL and Cloudflare-side rate-limit configuration were not available from repository state and were not inspected.

Added a PWA smoke assertion that an empty analytics endpoint creates no telemetry listener, request, or client identifier; HTTPS endpoint, opt-out, and Do Not Track cases remain covered. `node --check pwa/tools/pwa-smoke.js` and a fresh `pwa/tools/build-site.sh` + `node pwa/tools/pwa-smoke.js` run passed. To isolate this check from the already-diagnosed corrupt source icon files, existing temporary PNG candidates were copied into a temporary `<temporary-path>` build; tracked and untracked repository artwork was not touched.

Open source risk: the Worker has no application-level rate limit. Its CORS origin allowlist constrains browser reads but is not caller authentication; a non-browser client can forge `Origin` and submit events if the Worker endpoint is deployed and discovered, potentially inflating counters or D1 write usage. Cloudflare provides a Worker rate-limit binding, but its counters are local to each Cloudflare location and permissive/eventually consistent; Cloudflare also cautions against IP-based keys because mobile/NAT users share addresses. The repository has no rate-limit namespace/binding or selected identity/threshold, so the cost-abuse risk remains open rather than introducing an arbitrary policy. See [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). Do not treat the inactive hosted PWA client as proof that an independently deployed Worker is unreachable. No Cloudflare deployment or configuration was changed.

## 2026-10-02 PWA icon integrity follow-up

Rechecked all three source PWA PNGs with chunk CRC, chunk-boundary, IDAT inflate, and decoded-row validation. All are corrupt despite valid signatures and dimensions; their working-tree bytes match the committed blobs. A history audit found only two revisions per PNG (`58db924` and `a16c019`), and both revisions have the same IDAT CRC defect; no valid PWA icon revision exists in the available Git history. Upgraded `pwa/tools/pwa-smoke.js` so this defect now fails the real package smoke at the first CRC mismatch instead of passing on headers alone. The intact current Android launcher asset is 144×144. I prepared exact resized 180/192/512 PNG candidates under `<temporary-path>`, showed the 512-pixel preview, and verified a fresh PWA site passes its full smoke with those candidate files. No PWA artwork has been installed pending the owner's response to the preview request; the existing `pwa/dist/` remains untouched.

Validation: `node --check pwa/tools/pwa-smoke.js` passed. `node pwa/tools/pwa-smoke.js pwa/dist` now fails with `icons/apple-touch-icon.png ... IDAT CRC mismatch`; a separate CRC/decompression probe confirmed all three source icons are invalid. `AGC_ANALYTICS_ENDPOINT=https://analytics.example bash pwa/tools/build-site.sh <fresh temporary directory>` followed by replacing only the temporary icons with the candidates and running `node pwa/tools/pwa-smoke.js <temporary directory>` passed. The untracked `pwa/dist/` also contains an older service worker with duplicate precache entries; a fresh build from current source has unique precache entries and passes the same gate with valid candidate icons.

## 2026-10-02 diagnostics dynamic-HTML audit

The Diagnostics table sent platform, sensor, network-time, self-test, and snapshot strings through raw `innerHTML` interpolation. No remote exploit path was demonstrated, but those values are dynamic and the page exposes native JavaScript bridges. Added HTML escaping at the shared row-rendering boundary and a regression that supplies a markup payload and verifies it stays text. The PWA icon preview decision remains pending and no icon files were changed.

Validation: `node --check app/src/main/assets/diagnostics.js`, `node --check tools/diagnostics-self-test-smoke.js`, `node tools/diagnostics-self-test-smoke.js`, `node tools/native-diagnostic-smoke.js`, `node tools/cm-feature-load-smoke.js`, `git diff --check`, and the canonical source suite passed.

## 2026-10-02 DreamService interaction contract audit

The DreamService source enables interactive input and the packaged screen-only page implements a brief tap to toggle relay ticking plus a 1.8-second hold to exit through `DreamBridge.finishDream()`. Android's DreamService API confirms interactive dreams receive input and must finish themselves. No source mismatch was found. Added a host smoke that runs the production gesture code and checks the bridge calls; clarified the intended gestures and remaining device-runtime gate in the implementation and device-smoke notes.

Validation: `node --check tools/dream-interaction-smoke.js`, `node tools/dream-interaction-smoke.js`, manifest and Dream-specific focused smokes, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (93 Node smokes plus `ntp-time-smoke.sh`). The real pinned Comanche/WASM checks passed. Android DreamManager input delivery remains unverified because the Android 16 emulator has no DreamManager service; Fire OS and physical targets also remain unverified.

## 2026-10-02 EL path cross-check against the primary drawing

Reviewed the current WebView digit polygons against sheet 1, Detail C of MIT/MSC SCD 1006315G Rev G, obtained from the Virtual AGC drawing archive. The scan depicts the same asymmetric Apollo electrode contours and named segment arrangement represented by the current paths. The existing conformance gate independently checks the drawing-controlled height, width, side slant and thickness, bevel, middle datum, and minimum center gaps; the geometry lock preserves the accepted vectors, and the E/N identity regression prevents a dimension-preserving 180-degree reversal. No contour mismatch was found in this review, so I made no geometry change. The vectors still originate in the secondary drawing-backed STEP reconstruction; a manual scan-derived redraw is not needed to fix a demonstrated accuracy defect, and source/license provenance remains an open review item.

Validation: inspected the primary 1006315G Rev G sheet-1 scan and current `dsky-geometry.js` paths; `node tools/el-drawing-conformance-smoke.js`, `node tools/el-geometry-lock-smoke.js`, `node tools/el-widget-smoke.js`, and `git diff --check` passed.

## 2026-10-02 current-worktree APK and live Android gate

Rebuilt the current working tree as the isolated Regular `.eltest` APK and ran the full Android 16 emulator gate. The APK verifier confirmed the exact pinned CM WASM/Comanche inputs and byte-for-byte current frontend assets. Real WebView input reached Comanche V16N65E and produced numeric output without OPR ERR, then reached P00 and V35 with exact relay-11/12 words and raw channel 011/0163 checks. Page reload and actual Android process death each restored the 327,680-byte WASM memory snapshot into a fresh CM-configured core. Process absence was observed between PIDs.

Validation: `env TZ=UTC ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:verifyPinnedAgcAssets :app:assembleRegularDebug`, `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/verify-apk.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk`, and `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed. APK SHA-256: `914232f5005bee2d8f522941ef74d391d58b3023195b85e39d888099be2fb8fe`; package is debuggable `org.apollo.agcdsky.eltest`, not a release-signed client update artifact. Fire OS, physical screen fidelity, DreamManager, and Apple target runtime gates remain open.

The complete six-variant matrix was rebuilt from the current worktree with `:app:verifyPinnedAgcAssets :app:assemble`. All six archives passed `unzip -t`; Regular and Fire debug APKs each passed `tools/verify-apk.sh`, including exact shared-asset and pinned-core checks. The Fire debug APK SHA-256 is `d36c8319d1da9b1b6efa21da3b3006893a6cbb12a0a9bd8c324482a6ecafa316`. Release APKs are unsigned build outputs, not client-installable release artifacts. The full `env TZ=UTC bash tools/run-source-smokes.sh` suite also passed (93 Node smokes plus `ntp-time-smoke.sh`). This confirms build/package gates only; Fire OS runtime remains unverified.

The initial `adb screencap` artifacts did not match the asserted state: they showed zero register digits, blank V/N values, and a black gap over part of the left panel. The driver now also reads the values written into the actual SVG slots, waits two animation frames, rechecks the AGC/relay/channel invariants, and captures the WebView directly through DevTools. A fresh full-gate run produced `<temporary-path>`; visual inspection confirms `88/88/88 +88888` and a complete, clean DSKY rendering. The mismatch was in the whole-device capture path; the new WebView screenshot is a valid test reference. No app icon asset was changed.

Validation: `node --check tools/device-v35-smoke.js`, `node tools/device-v35-policy-smoke.js`, and `AGC_V35_SCREENSHOT_PATH=<temporary-path> ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed. V35 model, actual rendered SVG slots, raw channels, and the captured WebView image agreed; page/process recreation restored 327,680 bytes into fresh Comanche cores.

## 2026-10-02 native macOS build audit

The documented `AGCDSKYmacOS` Debug target compiled successfully from the current worktree and staged the pinned AGC assets into an app bundle under `<temporary-path>`. The first command using `-target` with a custom derived-data path was rejected because this Xcode requires `-scheme`; rerunning with the documented scheme succeeded. Xcode emitted CoreSimulator/CoreDevice version-mismatch warnings (the installed CoreSimulator is older than this Xcode), but selected a macOS destination and completed the macOS build. The Mac is locked, so native app startup and rendered UI could not be inspected. iOS Simulator and physical Apple runtime gates remain open.

Validation: `xcodebuild -project apple/AGCDSKY.xcodeproj -scheme AGCDSKYmacOS -configuration Debug -sdk macosx -derivedDataPath <temporary-path> CODE_SIGNING_ALLOWED=NO build` completed with `** BUILD SUCCEEDED **`; build log reported `Apple pinned AGC assets: PASS` and staged shared assets. The local app launch was requested, but no UI/runtime result was available because the Mac was locked.

## 2026-10-02 EL geometry provenance and attribution audit

Current WebView and native-widget segment paths match the digit electrode coordinates transcribed from `1006315G-exact.step` at `rrainey/agc-mechanical-cad` commit `2d7dccd5bc4f0263a14ac5a4fd112a15d447010d`; the WebView change replaced the earlier SVG-derived contours in commit `1a4e97f`. The repository's top-level and packaged notices still described Ben Krasnow's replica as the current source, and `docs/LOCAL_BUILD.md` repeated that obsolete claim. Updated those records to identify Riley Rainey's CAD model and CC BY-SA 4.0, and retained the replica attribution only as prior-version history. No runtime behavior or geometry changed. The upstream CAD repository declares CC BY-SA 4.0; the compatibility of distributing this adapted geometry alongside the app's GPL components has not had a legal review.

Validation: source/history comparison (`git show 1a4e97f -- app/src/main/assets/dsky-geometry.js`), current native/WebView path and widget-smoke inspection, `node tools/el-widget-smoke.js`, `node tools/el-drawing-conformance-smoke.js`, `node tools/el-geometry-lock-smoke.js`, and `git diff --check`.

## 2026-10-02 complete K1-K5 character truth-table audit

Compared the runtime's K1..K5 contact decoder against all 32 combinations in the archived VirtualAGC `Tools/traceDSKY.py` logic (blob `6d994a40529d377ceaf865f63f8ce0bebec885a8`), applying the documented physical E/H/M/N/K/F/J to SVG a/b/c/d/e/f/g mapping. The runtime outputs matched every combination. The previous `dsky-mapping-smoke.js` only fixed the ten decimal glyph patterns and merely required more than 11 distinct physical states, so it could miss errors in the other combinations. Added a full 32-entry expected-pattern table to the regression.

Validation: `node --check tools/dsky-mapping-smoke.js`, `node tools/dsky-mapping-smoke.js`, `node tools/relay-code-map-smoke.js`, `node tools/physical-relay-audit-smoke.js`, `node tools/widget-relay-model-smoke.js`, `git diff --check`, and `env TZ=UTC bash tools/run-source-smokes.sh` all passed. The full source runner reported 92 Node smokes plus `ntp-time-smoke.sh`; the real pinned Comanche/WASM V16N65E, P00, V35E, and MARK/KEYRUPT2 checks passed.

## 2026-10-02 relay acoustic accuracy audit

The relay source audit found an unexplained 1.5% pitch reduction for non-latching auxiliary relays, different deterministic waveform seeds, and a lower direct-impact gain. Available production drawings prove relay package/function mappings but not measured Apollo relay acoustics. Removed those unsupported relay-class distinctions; all relay classes now share one explicitly generic synthesized acoustic profile. Added a focused runtime assertion to `relay-haptic-smoke.js` that locks the common waveform profile. Exact production 2004688/2004689 timing remains unresolved as documented in `relay-fidelity-evidence.md`.

Validation: `node --check app/src/main/assets/relay-identity-audio.js`, `node --check tools/relay-haptic-smoke.js`, `node tools/relay-haptic-smoke.js`, `node tools/relay-spec-fidelity-smoke.js`, `git diff --check`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed; the full suite reported 92 Node smokes plus `ntp-time-smoke.sh`. The real Comanche WASM runtime gate passed V16N65E, P00, V35E, and MARK/KEYRUPT2. A current-source Regular debug APK (SHA-256 `2770ba984d2d7dd2dc951162e49a6ff0296795fed4d0bd3d54c3211fc7637f74`) passed `:app:verifyPinnedAgcAssets :app:assembleRegularDebug`, `tools/verify-apk.sh`, and `tools/device-full-smoke.sh` on the Android 16 emulator. Live V16N65E, V35, page reload, held PRO, and actual process-death snapshot restoration passed.

## 2026-10-02 AGC snapshot lifecycle and compatibility audit

The page- and process-recreation gates previously checked only that a new yaAGC object started, while implementation notes incorrectly said CPU/erasable memory was not serialized. The source actually stores the complete WASM linear memory. Both Android gates now explicitly require `lastAction=restored` and report the restored 327,680-byte snapshot. On the Android 16 emulator, page recreation and an actual `am force-stop`/relaunch both restored that snapshot into a fresh core with Comanche and CM mode `1`.

The audit also found restore-safety gaps: snapshots recorded but did not enforce the yaAGC core version, and `importSnapshot()` verified a fingerprint only after writing snapshot bytes into live WASM memory. Interactive restore now rejects a different core version, verifies snapshot bytes before mutating WASM memory, and has focused regressions for both behaviors. The separate read-only Dream clone now also ignores snapshots from a different core version. `docs/DEVICE_RUNTIME_SMOKE.md` and `docs/IMPLEMENTATION_NOTES.md` describe the real persistence contract.

Validation: focused snapshot/core/Dream smokes and `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus the NTP shell smoke). `:app:verifyPinnedAgcAssets :app:assemble` built all six Regular/Fire debug, installfix, and unsigned release variants; both debug APKs passed `tools/verify-apk.sh`. The current isolated Regular `.eltest` APK passed `tools/device-full-smoke.sh` on Android 16: live V16N65E and V35E, CM mode readback, page recreation, and actual process force-stop/relaunch all passed, restoring 327,680 bytes into a fresh core. APK SHA-256: `7cfae0739d18f336d5699a8a97afafed2c3f94a385d1557b97001c38a210d7e0`. The emulator has no DreamManager service, so DreamService runtime behavior could not be exercised; Fire OS and physical handset recreation remain unverified.

## 2026-10-02 PWA icon image-integrity finding

At the time of this initial finding, the PWA's three tracked icon PNGs had valid signatures and dimensions but malformed image data: Chromium could not decode them, and PNG inspection found bad CRCs or truncated IDAT streams. No valid earlier PWA PNG icon revision was found in Git history. A separate tracked `app/src/main/res/mipmap-xxhdpi/ic_launcher_original.webp` is an intact DSKY launcher-image candidate, but it has not been confirmed as the exact source the owner wants used. The first replacement concept was rejected by the owner and removed from the app files. Follow-up above added full PNG integrity validation and reconfirmed the source files remain malformed; replacement artwork is still awaiting owner approval.

For a second visual direction, captured the actual Comanche055 `V35E` display from the locally staged PWA after the real test reached `PROG/VERB/NOUN 88` and `+88888` in all registers. The 12 channel-010 relay latches matched the source-backed V35 low-11 words. A square app-icon composition using that screenshot was shown for review and is not integrated. Preview files are temporary under `<temporary-path>*`; they do not validate the currently tracked broken icons. The existing untracked `pwa/dist/` was not used or changed.

## 2026-10-02 shared-runtime cross-platform audit

Built the current macOS and iOS Simulator Apple targets from the same working tree. Their staged `WebAssets` each contain all 72 shared source assets byte-for-byte, including the new snapshot compatibility guard and Comanche/WASM payloads. Built the PWA into a temporary `<temporary-path>` destination so the pre-existing untracked `pwa/dist/` was preserved; its PWA, sensor, auto-dim, print-bridge, parity, analytics Worker, and analytics schema checks passed, covering 72 shared assets, offline precache, and the pinned Comanche core/rope. All six Regular/Fire Android APK variants assembled and every archive passed `unzip -t`; both debug APKs passed the exact pinned-asset/frontend APK verifier.

The installed Regular debug APK passed the full Android 16 emulator gate after these shared-runtime changes. Apple simulator runtime testing remains unavailable: the installed CoreSimulator 1051.55.0 is older than the Xcode 27.0 build requirement 1171.7.0. The macOS target compiled successfully, but no Apple app was launched. Fire OS and physical iPhone/iPad runtime behavior remain unverified.

## 2026-10-02 Android OS screen-off/on lifecycle audit

Verified an actual Android system sleep/wake cycle on the Android 16 emulator while the isolated `.eltest` app was running Comanche AGC. `adb shell input keyevent 223` put the system in `mWakefulness=Asleep`; a read through the packaged WebView DevTools socket during that state showed `coreRunning=false`, `appVisible=false`, and the same core object identity. `adb shell input keyevent 224` restored `mWakefulness=Awake` and the same foreground Activity; a follow-up read showed the core running and the object identity retained. The emulator's AC stay-awake setting and the app's `FLAG_KEEP_SCREEN_ON` were left unchanged. Fire OS and a physical handset remain unverified.

## 2026-10-02 scrollable controls panel and clipped AUX popup

The options panel capped its height but left overflow visible, so lower controls such as the lighting knobs extended past the screen. The panel now scrolls within its viewport. In landscape its height is bounded by the safe viewport, and the AUX popup flips below its summary when scrolling leaves insufficient room above it; resize, popup-toggle, and scroll events keep that placement current.

Validation: `node tools/display-layout-smoke.js`, `node tools/app-shell-runtime-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (92 Node smokes plus `ntp-time-smoke.sh`), and `git diff --check` passed. `:app:verifyPinnedAgcAssets :app:assembleRegularDebug` built the Regular debug APK, `tools/verify-apk.sh` passed, and `adb install -r` installed it to the isolated `.eltest` package on the Android 16 emulator. In its packaged WebView at 262x466 CSS px, the controls scrollport was 120 px high for 173 px of content; the lighting knob and both AUX choices were fully inside the scrollport at maximum scroll. The popup opened upward at the top and downward when scrolled. A 466x262 landscape viewport emulation kept the panel (y=42..221) and choices (y=76..106) inside the viewport. APK SHA-256: `970986f2805cb937f00c510017ff982d3d454eee8d22fb7182427fe0da23e096` (debug/test APK; not a release handoff).

## 2026-10-02 CM peripheral-mode rebuild and package audit

The CM-only audit found that the app packaged webAGC's browser WASM with `CmOrLm=0` (LM) and no way to configure it, despite loading only Comanche055. Rebuilt the core from VirtualAGC commit `ddc65e7bed41f1301921b934fcbaaee93db99dda` with the small source patch in `vendor/yaAGC-cm/patches/001-cm-mode-api.patch`: the core defaults to CM, exposes configure/readback exports, and rejects mode changes after CPU startup. `agc-core.js` sets and confirms CM after loading the rope but before reset. The reproducible build pins upstream version text `2020-12-24 ddc65e7`; final WASM is 27,270 bytes, SHA-256 `38107b6002e3c4e9c8dcb9da208c9d11e60d2a36bbc3b308680e087c561b7cec`, Git blob `04a24dd1df4a81738e138b3e9f048d2b10498439`. Android, PWA, and Apple staging now consume that exact core; only Comanche055 is packaged.

Validation: `WASI_SDK_PATH=<WASI SDK 16.0 root> bash tools/build-cm-wasm.sh <clean VirtualAGC checkout>` reproduced the exact binary. `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus `ntp-time-smoke.sh`), including real WASM CM-mode readback/lock and Comanche V16N65, P00, V35, and MARK/KEYRUPT2 execution. PWA staging, PWA smoke/parity, and Apple pinned-asset verification passed. Xcode Release builds passed for macOS and generic iOS; their staged WASM files match the pinned Git blob. Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assemble` built all six Regular/Fire variants; both debug APKs passed `tools/verify-apk.sh`, and all six archives passed ZIP and core-identity checks.

Created a client-downloadable Regular `.eltest` APK, SHA-256 `751b934bd82ed0706764d919fb2a5d472016937d5f26e1c37cda98d1e457efb2`. It passed APK verification, zipalign, APK Signature Schemes v2/v3, and the established standalone signer fingerprint. No Android device is attached; the user confirmed the prior APK runs, but this newly rebuilt CM-core APK has not been installed or exercised on-device.

`adb devices -l` reported no attached device. `xcodebuild` logged that the installed CoreSimulator framework is older than Xcode, but both macOS and generic iOS target builds completed successfully. Live WebView/device behavior, Android lifecycle, and physical DSKY appearance remain open audit gates.

## 2026-10-02 AUX menu short-viewport clipping

The AUX DATA choices opened below the final panel row in portrait. At a 320x500 CSS-pixel viewport, the popup's bottom edge was at y=519, outside the viewport, so QUICK REF and SOURCE were clipped. The popup now opens above AUX in portrait and landscape. The layout smoke requires the upward placement in the base rules.

Validation: `node tools/display-layout-smoke.js`, `git diff --check`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus the NTP shell smoke). Playwright Chromium measured both menu buttons fully inside the viewport at 320x500 (y=423..453) and at 720x360 landscape (y=163..193). A working-tree Regular debug APK (`27e05b0a156757a89bf09c23e1f3ddb052d09eb9e708a7db95e0f9b6d9bb069e`) built with `:app:verifyPinnedAgcAssets :app:assembleRegularDebug`, passed `tools/verify-apk.sh`, and passed `tools/device-full-smoke.sh` on the Android 16 emulator. In its packaged WebView at 262x466 CSS pixels, touch-and-hold opened the controls, tapping AUX opened the popup, and both popup buttons remained inside the viewport (y=360..390). The source and APK remain a local working-tree build; physical handset fit remains unverified.

## 2026-10-02 packaged-WebView non-V35 monitor command

The device driver previously proved P00 entry and V35 but did not execute an ordinary monitor command. It now enters P00 with `V37E00E`, enters and executes Comanche `V16N65E` through the DSKY pointer handlers, checks the exact Pinball codes for V16N65 and ENTR, requires a numeric register response with raw channel-0163 OPR ERR clear and rendered OPR ERR off, returns to P00, then runs the existing exact V35 relay/channel gate. The monitor result is mission/runtime data, so the test checks response class and error state rather than a fixed numeric value.

Validation: `node --check tools/device-v35-smoke.js`, `node --check tools/device-v35-policy-smoke.js`, `node tools/device-v35-policy-smoke.js`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus the NTP shell smoke). `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed on the Android 16 emulator using Regular debug APK SHA-256 `27e05b0a156757a89bf09c23e1f3ddb052d09eb9e708a7db95e0f9b6d9bb069e`: live V16N65E returned numeric output without OPR ERR (observed values varied across runs), then P00/V35, CM-mode readback, page reload, and process recreation all passed. This is emulator/WebView evidence; physical DSKY key timing and additional program/data paths remain open.

## 2026-10-02 landscape menu clipping and live V35 consistency

Follow-up to the landscape slide-out showed that the controls menu was still anchored at the top edge. The open DSKY/menu composition now keeps the menu vertically centered in the viewport, with the existing upward AUX DATA popup retained. The display-layout smoke checks the centered transform and safe vertical bounds for short landscape heights.

The first full device smoke on the new panel build found a real auxiliary-relay race: a rapid channel 011 transition could leave an older delayed COMP contact callback eligible to overwrite the latest state. Auxiliary relay presentation now tracks the requested target and invalidates superseded callbacks. Added a deterministic rapid-on/rapid-off regression.

Validation: `node tools/display-layout-smoke.js`, `node tools/relay-visual-coupling-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (92 Node smokes plus `ntp-time-smoke.sh`), and `ANDROID_SDK_ROOT=<configured SDK> bash tools/build-local.sh` passed at commit `0206d918a82601c96eee89ba8fc2be6a12dcd04d`. Regular and Fire debug APKs passed verification. Regular APK SHA-256 `be3a90b92f2809f5512c595b50fdf712e9c0b62187b44c8a3dd3f6c0e98191c1` passed `tools/device-full-smoke.sh`, including pointer-driven V37E00E/P00, real Comanche055 V35 latches and raw-channel annunciators, WebView reload, and process recreation. A local Chromium landscape screenshot confirmed the complete panel at 1280x720 and at 720x360 with AUX open; at 720x360 the DSKY bounds were x=75..367, controls x=371..645/y=108..252, and both AUX submenu buttons x=375..643/y=163..193. Physical handset fit remains unverified.

## 2026-10-02 AUX menu viewport clipping

The AUX DATA submenu could extend below the options panel's scrollport on short portrait screens, leaving PROCEDURES and TECH DATA partially hidden. The options panel now allows overflow and keeps the two-column submenu as a floating popup; landscape positions the popup above AUX DATA. The display-layout smoke locks the visible overflow and upward landscape placement.

Validation: `node tools/display-layout-smoke.js` and `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus `ntp-time-smoke.sh`). Playwright Chromium at 576x1280 showed both popup buttons fully inside the viewport, and tapping TECH DATA opened its dialog; at 1280x576 the upward popup remained inside the viewport. Gradle 9.5.1 built all six Regular/Fire debug, installfix, and unsigned release APKs. Both debug APKs passed `tools/verify-apk.sh`, all six archives passed ZIP integrity checks, and the Regular `.eltest` debug APK signed with the standalone release key passed APK verification and the required signer fingerprint check. No Android device is connected, so on-device touch/layout behavior remains unverified.

## 2026-10-02 SNTP accuracy audit

The native SNTP client validated the echoed client timestamp but estimated clock offset from the server transmit time plus half the measured round trip. That approximation includes half of the server's own processing time and can bias the display-clock correction. Updated `SntpClient` to use RFC 5905's four-timestamp offset formula (T1 client send, T2 server receive, T3 server transmit, T4 client receive) and to subtract server processing time from measured RTT when ranking network delay. T4 is derived from monotonic elapsed time so a wall-clock change during one request does not distort the sample. Added a localhost regression with a known 600 ms offset and 120 ms server processing delay.

Focused verification: `bash tools/ntp-time-smoke.sh` PASS, including the server-processing regression, peer validation, malformed response, timeout, recovery, and era rollover. `node tools/ntp-policy-smoke.js` PASS.

Follow-up code review found the monotonic RTT clock was sampled immediately before the T1 wall-clock timestamp, while T4 was reconstructed as if both samples were simultaneous. The SNTP query now anchors monotonic elapsed time immediately after sampling T1 and uses one receive instant for both RTT and T4. A deterministic host regression guards the monotonic T1-to-T4 conversion; the localhost protocol cases continue checking known offset and server processing.

Post-fix validation: `bash tools/ntp-time-smoke.sh` passed; `env TZ=UTC bash tools/run-source-smokes.sh` passed all 92 Node smokes plus the shell smoke; Gradle `:app:verifyPinnedAgcAssets :app:assemble` built all six variants; the Regular Debug APK passed `tools/verify-apk.sh` and `tools/device-full-smoke.sh`. Current emulator-tested Regular Debug APK SHA-256: `a4e25fbdae6aba2644a99f43a54b504dde8188286b1c59310bdc53c9a34da3ff`.

The native time audit also found that persisted `elapsedRealtime()` from an earlier boot could make a stale sync appear fresh when the new boot's uptime happened to exceed the saved uptime. Sync freshness now uses monotonic time only when Android's boot count still matches; otherwise it falls back to corrected wall time. `NtpSyncAge` host cases cover same-boot monotonic age, changed boot count, legacy records without a boot count, and unavailable sync state.

The native updater audit found that `onResume` immediately relaunched a verified pending APK or unknown-source settings after the user returned from dismissing either screen. Installer handoff is now limited to the explicit CHECK FOR UPDATE action; startup, periodic, and foreground discovery continue validating and retaining verified updates without reopening UI. The updater source smoke now rejects a resume-triggered relaunch.

CM-only cleanup removes the obsolete mission-namespaced snapshot behavior and makes snapshot/Dream cloning fail closed unless the active rope is Comanche055. Phone ICDU comments now identify only the Comanche CM path. At this point in the audit, the packaged WASM still had an LM-default internal peripheral flag with no exported setter. The CM peripheral-mode rebuild documented at the top of this file supersedes that limitation and remains consistent with the CM-only policy.

Verification: `env TZ=UTC bash tools/run-source-smokes.sh` PASS (92 Node smokes plus the SNTP smoke, including real pinned-WASM Comanche execution). `env TZ=UTC ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:verifyPinnedAgcAssets :app:assemble` PASS for all six Regular/Fire debug, installfix, and unsigned release APKs. Both debug APKs passed `tools/verify-apk.sh`; all six archives passed ZIP integrity and exact pinned-WASM/Comanche-blob checks, with the unsupported rope absent. No Android device is connected, so live WebView/device interaction remains unverified.

## 2026-10-01 selectable LM/CM mission audit

Restored the documented product policy that Luminary099 is the first-run/default rope while Comanche055 remains selectable. Added the Options mission selector, one-time migration from the old forced-Comanche storage value, mission-specific DSKY face annunciators, and separate LM/CM snapshot slots. Switching missions during AGC first returns through the shared CLOCK transition so the active mission snapshot is saved before changing ropes. The pinned engine still defaults its internal peripheral mode to LM; selectable Comanche rope execution does not claim full CM peripheral-mode fidelity.

The first all-variant build revealed a packaging gap: Gradle and the APK verifier still staged/rejected the Luminary rope. Added Luminary to the exact size/Git-blob build gate and package set, updated APK verification to require both ropes, and added a source regression tying the Gradle asset list to APK verification. Both ropes now ship in all variants so either selector choice can load its actual rope.

Validation: `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus `ntp-time-smoke.sh`), including real pinned-WASM execution with both ropes and the channel-012 dispatch path. `env TZ=UTC ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:verifyPinnedAgcAssets :app:assemble` built all six Regular/Fire debug, installfix, and unsigned release APKs with Gradle 9.5.1, JDK 25, SDK platform 37, and Build Tools 36.0.0. Regular and Fire debug APKs passed `tools/verify-apk.sh`; all six packages passed ZIP integrity, pinned WASM/rope Git-blob, package/version, and selected frontend byte-comparison checks. No ADB device is connected, so Android WebView/device interaction remains unverified. Release APKs are unsigned and are not installation handoff artifacts.

## 2026-09-30 line-by-line audit follow-up

The first audit pass reproduced two parser-validation gaps: a trailing M/L/C command with no coordinates was silently accepted, and a large exponent could become an infinite float. The production parser now rejects missing command coordinates and non-finite values; its JVM regression includes these cases and unsupported relative commands.

The same pass found a material privacy-documentation mismatch: the manifest and `AppUpdater` use HTTPS GitHub release metadata, checksum, and APK endpoints, while several policy files claimed INTERNET was SNTP-only or absent. Updated owner guidance, README, canonical/in-app privacy policy and legal text, Play Store copy, privacy links, and build notes to disclose GitHub updater traffic and the IP address/app-version User-Agent visible to those services. No camera, location, sensor, or simulator payload is sent by the updater.

The release-publication workflow also executed YAML from any pushed `release-payload/**` branch while granting it `contents: write`. Converted it to manual dispatch gated to `main`, with payload files fetched as Git data, matching VERSION enforcement, isolated archive extraction, and unchanged SHA-256 checks. Line review caught and fixed an initial path handoff bug that would have made the publisher look for APKs in the main checkout rather than the verified temp archive. Added a canonical source smoke to keep branch code from regaining access to the publisher token or bypassing the verified payload directory. It still only publishes prebuilt files; it does not build, sign, or test APKs.

Verification for this follow-up: actual production-parser JVM regression PASS; widget-label, manifest-policy, NTP-policy, release-publication-policy, legal.js syntax, publisher YAML/Bash syntax, and `git diff --check` PASS. The full canonical source suite passed with 91 Node smokes plus `ntp-time-smoke.sh`, including real pinned WASM and both ropes. Full Android APK/device verification remains blocked because this environment lacks Android SDK platform 37 and Build Tools 36.0.0.

## 2026-09-30 audit remediation

Strengthened the EL widget label regression gate to compile and execute the same pure-Java path parser used by `ElWidgetProvider`, including the v1.1.61 comma-separated crash fixture, malformed inputs, and every embedded legend outline. The parser regression and all 90 canonical Node smokes plus the NTP shell smoke passed under OpenJDK 17; the runner now pins `TZ=UTC` so fixed-time fixtures are deterministic across developer machines. Corrected repository policy text so native UDP SNTP's narrow INTERNET permission is distinguished from offline WebView behavior. Disabled the obsolete hosted Android build workflow to match the local-only APK build policy. Clarified that the fixed Version 1.0 commercial source snapshot is historical and separate from current v1.1.x Android releases. Full Gradle/APK/device verification was not run because this environment lacks Android SDK platform 37 and Build Tools 36.0.0.

## 2026-09-30 v1.1.62 widget vector-path crash hotfix

Device crash evidence from Pixel 9a / Android 17 on v1.1.61 showed ExceptionInInitializerError in ElWidgetProvider.ElRenderer caused by Float.parseFloat receiving ",9.2002" while initializing the fixed-vector widget labels. The parser's end-scanner skipped commas internally but readPathNumber still sliced from the pre-separator index.

The parser now separates separator skipping from numeric-token scanning, slices only the numeric token, and supports leading signs, decimals, and exponent notation. The canonical widget-label smoke locks the exact crashing prefix M75.4402,9.2002 and executes every embedded label through the production Java parser.

Hotfix identifiers: 1.1.62 / Android versionCode 2026093009.

## 2026-09-30 v1.1.61 fixed-vector widget labels

Moves the Android home-screen widget PROG, VERB, NOUN, COMP, and ACTY legends from device-dependent runtime font rendering to fixed filled vector outlines. This keeps label shape and placement deterministic across Android devices while preserving the accepted EL geometry from v1.1.60.

The release also updates the widget source-smoke contract for vector rendering and classifies the dedicated widget-label vector smoke in the canonical source suite.

Release candidate identifiers: 1.1.61 / Android versionCode 2026093008.

## 2026-09-30 v1.1.60 complete EL symbol placement

Carries the final drawing-backed EL symbol placement from the audit branch onto current main without replaying stale release metadata or losing the v1.1.59 updater repair.

The register sign row remains at the accepted drawing-backed datum, while the EL glass and native/generated widget frame now extend left far enough to contain the full sign envelope. Screen-only mode reserves 16 CSS px per side (32 px total) and allows the EL panel overflow needed for the complete sign geometry. Native widget framing, generated second frames, WebView glass, and regression locks are aligned to the same overhang.

Release candidate identifiers: 1.1.60 / Android versionCode 2026093007.

## 2026-09-30 v1.1.59 updater freshness repair

Observed failure: a device process that had already completed an automatic update check could miss a release published afterward because foreground resumes reused the 12-hour background freshness window. That made a newly published release legitimately invisible until manual CHECK, process restart, or the next periodic alarm.

Repair: keep the 12-hour background alarm, but foreground resumes now recheck when the last successful discovery is at least 60 seconds old. Release HTTP connections also disable response caching and request no-cache semantics. Pending verified APKs are still offered before any network check, manual CHECK remains force-immediate, transient-network retry behavior is unchanged, and all existing signer/package/version/checksum gates remain intact.

Release candidate identifiers: 1.1.59 / Android versionCode 2026093006. The self-update smoke now locks the short foreground freshness window and cache-bypass behavior.

## 2026-09-30 v1.1.58 EL audit regression lock

Carries forward the post-v1.1.57 drawing-audit result without replaying the divergent candidate history. The accepted screen-only renderer geometry remains unchanged from v1.1.57. The geometry lock now additionally requires exactly two occurrences of the accepted inset-width expression so the front EL face and parallax indicator-package rear cannot drift apart independently.

The completed drawing audit measured the accepted source geometry at digit height 0.500351988 in, upper width 0.317299151 in, top-to-middle datum 0.220000000 in, side bevels 60.275606/59.896393 degrees, center gaps 0.010000 in, and sign envelope 0.338 x 0.265 in with 0.010-in gaps.

Release candidate identifiers: 1.1.58 / Android versionCode 2026093005. Full CI, standalone signing, and publication remain release gates.

## 2026-09-30 v1.1.57 full-screen EL viewport clearance

Transplanted the post-v1.1.56 screen-only EL work onto current main without replaying the already-squashed 1.1.56 history. Screen-only EL artwork now reserves 8 CSS pixels on each side while preserving the 1006315G active-face aspect ratio; the parallax indicator-package rear uses the identical inset dimensions so it remains aligned with the EL face.

Release candidate identifiers: 1.1.57 / Android versionCode 2026093004. Source/build/signing/publication gates are pending CI and standalone release verification.

## 2026-09-30 EL accuracy release candidate preparation

Candidate source version is 1.1.56 / versionCode 2026093003, with the matching application label. These identifiers are a source candidate only. No release APK has been built or signed; the normal local Android build and standalone signing gates remain required before publishing.

## 2026-09-30 EL sign geometry correction

MIT/IL SCD 1006315G Detail A specifies a .338-in nominal sign envelope (.333/.343 limits), .265-in B-island width (.260/.270 limits), .065-in nominal thickness (.060/.070 TYP limits), and .010-in minimum spacing between A/B islands. The older STEP sign solids and all three app render paths were too small; the STEP profile was not used to overrule the controlled drawing.

Updated the WebView, Android widget, and generated clock frames to the drawing nominal island dimensions. Placement retains the STEP-derived B-island center and existing register-row datum. The source conformance smoke now measures the Detail A envelope, B width, thickness, both gaps, and clearance to the first digit; the geometry lock requires the same paths in all three renderers.

Source smoke checks were executed against the modified source contents in the available JavaScript runtime and passed. The full repository build and device visual check have not run in a local checkout.

# AGC DSKY Android progress

## 2026-10-01 channel diagnostics and Mac build audit

Retained the raw 15-bit channel `012` value alongside decoded selector-4 state and exposed it in diagnostics. Fixed `tools/verify-apk.sh` to ignore inline SVG `#fragment` suffixes when resolving local asset references; the asset-reference smoke covers the case. Updated the repository guidance and implementation/device-smoke notes to describe the current modular frontend and current build gates rather than the removed `app.js` / `app-refine.js` layout.

Validation on macOS: `env TZ=UTC bash tools/run-source-smokes.sh` passed (91 Node smokes plus `ntp-time-smoke.sh`). `env TZ=UTC ANDROID_SDK_ROOT=<configured Android SDK path> bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:assemble` passed and produced all six Regular/Fire debug, installfix, and release variant APKs. Regular and Fire debug APKs passed `tools/verify-apk.sh`; package checks confirmed all six variants contain byte-for-byte current `index.html`, `diagnostics.js`, and `hardware-fidelity.js`. Release APKs are unsigned (`*-release-unsigned.apk`). No Android device smoke, release signing, or publication was performed.

The next harness audit found that `device-full-smoke.sh` installed the isolated `.eltest` debug APK, but its later AGC and process-recreation stages hard-coded the production package ID. The full runner now derives the application ID from the APK, requires the isolated `.eltest` package, and passes that ID through; standalone live stages default to and require `.eltest`. The immediate install stage also rejects production APKs before installing. Added `tools/device-package-policy-smoke.js` to lock the routing and pre-install check order. The full host suite passes with 92 Node smokes plus `ntp-time-smoke.sh`. No Android device was connected, so this change has host-policy coverage but no live Android verification.

Continued source/doc audit corrected the stale preferred APK path and removed device-only frontend readiness from the canonical host-smoke checklist in `AGENTS.md`.

The channel-012 test audit found that `hardware-service-smoke.js` invoked the registered callback directly, so it did not cover production `AGCDSKY_DISPLAY.onChannel()` dispatch or the AGC-mode gate. Added an isolated fixture loading the real display and hardware-fidelity services; it verifies mode gating, independent INJ SEQ/CUTOFF bits, 15-bit raw-word masking, and the both-relays state through the public dispatcher. `node tools/hardware-service-smoke.js`, `git diff --check`, and `env TZ=UTC bash tools/run-source-smokes.sh` passed; the full source suite remains 92 Node smokes plus `ntp-time-smoke.sh`. No app runtime source changed. Device/WebView validation remains unavailable without an attached Android device.

The rope-coverage audit then found that the documented canonical host preflight promised both real ropes, but `wasm-runtime-smoke.js` only instantiated Comanche055. The smoke now loads the exact pinned Luminary099 rope in a separate real WASM instance and proves V37E00E P00 relay-11 `01265` plus V35 FULLDSP/FULLDSP1 state and LM relay-12 `00674`; the existing CM V16N65/P00/V35 checks remain. `node tools/wasm-runtime-smoke.js` and the full canonical source suite passed (92 Node smokes plus `ntp-time-smoke.sh`). At that point, the audit recorded a scope mismatch because the shell still hard-locked Comanche. The subsequent selectable LM/CM mission change at the top of this file resolved it.

The follow-on mission-input audit found two CM values were being applied to Luminary: SXT optical inputs used Comanche channel/erasable meanings, and phone PIPA integration used the CM `0.0585 m/s` pulse scale instead of LM `0.01 m/s`. SXT camera capture, star finder, MARK/REJECT, and CDU inputs are now gated to Comanche; LM phone PIPA selects the LM scale, and changing missions clears accumulated PIPA timing/count state. The real pinned Comanche WASM smoke now drives MARK through channel `016`, checks the actual KEYRUPT2 request and proves the CPU consumes it. This covers the request transport path, not physical peripheral fidelity or a live device.

The relay haptics audit also corrected unsupported implementation comments: the current cue is uniform at 1 ms / amplitude 1 of 255, and no production-relay-specific tactile profile or contact bounce is modeled. `tools/relay-haptic-smoke.js` locks those source boundaries.

Validation on macOS: `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node tests plus `ntp-time-smoke.sh`); `env TZ=UTC ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh --no-daemon --stacktrace :app:verifyPinnedAgcAssets :app:assemble` built all six Regular/Fire debug, installfix, and unsigned release APKs. Both debug APKs passed `tools/verify-apk.sh`. Device interaction, release signing, and publication remain unverified.

The current implementation/device notes were reconciled against that evidence: the pinned real-WASM host gate and non-V35 Pinball sequences have passed, while live packaged-WebView and physical-device semantics remain separate unverified gates.

The native-time audit found that `SntpClient` checked the NTP originate timestamp but did not check the datagram source. It now rejects packets whose source address or port differs from the configured endpoint; `NtpTimeSmoke` sends a valid-looking response from the wrong local UDP port to lock the rejection. The focused time smoke and `env TZ=UTC bash tools/run-source-smokes.sh` passed, all six APK variants rebuilt, and both Regular/Fire debug APKs passed `tools/verify-apk.sh`.

Last updated: 2026-10-01

## 2026-09-29 v1.1.53 terse Apollo-style panel nomenclature

Owner requested more NASA/Apollo-like names for the application-panel buttons and legends. This is a presentation convention for app functions, not a claim that these exact controls existed on Apollo hardware.

Final nomenclature:
- RLY AUDIO — ON/OFF
- VIB — ON/OFF
- DSKY DISP — FULL/EXIT
- GUIDANCE — CLOCK/CMC/CMC LOAD/RLY TEST
- OPTICS — SXT
- SYS TEST — RUN
- AUX — DATA
- NIGHT DISP — DIM/BRIGHT/AUTO
- SW LOAD — CHECK plus existing talkback
- PROCEDURES — QUICK REF
- TECH DATA — SOURCE
- hidden panel-lighting operator: PANEL LTG — DIMMER

The v1.1.52 physical-state repair remains intact: logical aria-pressed state does not leave toggle buttons mechanically depressed; only the actual active press receives the depressed visual.

v1.1.53 / Android versionCode 2026092913. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Exact key source blobs: VERSION 36a0393faacda946f0e653c6104ade7ca58d07e6; app/build.gradle 88e9811a3ecf6b8eb2c687ef355165bc97786712; AndroidManifest.xml 127c15e270b941378a01b0a51d4c255c8acbb36c; index.html 3d74cb1e9733173dfc41e539769d24849d9a64e6; app-shell-runtime.js 35327dd677da3931e1444fcae878d67b9171969b; relay-audio-runtime.js 4996e9d97b1dcd8f7003d5e550f66f8116ffc8a6; display-environment.js 720e0a1df0c887626abee2f738388933a38d4d3f; display-layout-smoke.js 67f1a5d94e8945e904a2b659be26f8718b73816b; self-update-smoke.js f78cfae0b4e6a7e098f8d62a36008feae661ae03; app-shell-runtime-smoke.js 848e65b3eaccf5e0451367c279a483e1e7a0b685.

Regular and Fire were rebuilt locally from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone signer. Both packages are org.apollo.agcdsky v1.1.53/code 2026092913; 73/73 runtime assets with 0 missing/extra/mismatch; relay-panel.js, relay-panel.css, and relay-perceptual-personality.js absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 10ab903bb200f3f0a1d181692be71ce09b4b4f5d195746c5d833034333f8be9f.
Fire SHA-256 ad4c152a6ebfd2e73d89d2f51ef2ad46b4e06bdf4d1bb8811ce42593b888d7ef.

Physical nomenclature/fit acceptance remains pending owner device inspection.


## 2026-09-29 v1.1.52 momentary panel-button visuals

Owner reported HAPTICS stayed visually depressed while enabled and requested the same correction for RELAY CLICKS.

Root cause: controls-layout.css coupled logical toggle state to physical button travel with `button[aria-pressed="true"]` in the depressed-face selector. HAPTICS correctly uses aria-pressed to represent enabled state, so the panel face remained visually latched. The fix removes logical aria-pressed from the physical depression selector; panel buttons now use only `:active` for the depressed appearance. HAPTICS and RELAY CLICKS keep their logical ON/OFF state and accessibility semantics without looking mechanically held. RELAY CLICKS now explicitly projects its ON/OFF state to aria-pressed as well.

v1.1.52 / Android versionCode 2026092912. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference, audio-recovery. Exact changed source blobs: VERSION cf6931b078c9307190606ffba8eb48e07da31117; app/build.gradle 5f89c159eb0196132e0fa4f3753f39d037cbc16f; AndroidManifest.xml 783000d44979494de28b2cdeaaef0812d86bea4d; controls-layout.css 89455384bd5e64ce2f65490652828ee178602c25; display-layout-smoke.js f9bb50979fdd90ff6a73c11f1199aff8e3c3e007; relay-audio-runtime.js 69e2c3868be8248e5e24f61bd172f86c70925fac; audio-recovery-smoke.js 615fe317cd1a8a21f0d83bbfc1baece533b59227.

Regular and Fire rebuilt from exact exported source through aapt2 -> javac 17 -> classes.jar -> d8 -> zipalign -> apksigner with the established standalone release signer. Both org.apollo.agcdsky v1.1.52/code 2026092912; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 b642965b36ce2c25c29edb1ef189751915b7a75c5615a1373cff5d002e37dc5c.
Fire SHA-256 945a3b50c9a1e635466ea63b17e4a14cee8df87c9b2bcc2f3d75c4140063ce29.

Physical device gate: confirm HAPTICS and RELAY CLICKS return visually to their normal raised face immediately after release while their ON/OFF labels/state remain correct.


## 2026-09-29 v1.1.51 SOFTWARE beside DREAM + momentary flag

Owner requested moving the SOFTWARE talkback next to DREAM and keeping the flag present for as long as CHECK is physically pressed.

Final row 3 is fixed as AUXILIARY | DREAM | SOFTWARE. SOFTWARE is no longer inside the AUXILIARY submenu. REFERENCE and DOCUMENTS remain under AUXILIARY; when opened, that submenu spans the row in two columns.

CHECK is now a true momentary operator for the talkback flag. Pointer-down forces the SOFTWARE talkback to barber pole and captures the pointer. Pointer-up, pointer-cancel, or lost pointer capture releases the forced flag and restores the actual updater state. If the updater itself is still checking/downloading/ready-to-install, the talkback remains barber pole because that is the real state. Gray remains current/normal and red remains updater failure.

v1.1.51 / Android versionCode 2026092911. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Exact changed source blobs: VERSION 3baec79077d35049d23cd22950bc118a880021ba; app/build.gradle c294ac93e29822cb1bce01d20651e2c68f15fee8; AndroidManifest.xml 5ab16d993047b5bc16b7c8afac63303186624f65; index.html 4387580891c150b8adab5593961ec2d346f349d6; controls-layout.css e378e0addb4e87c6b25110004c67a06178acb881; app-shell-runtime.js facba0c6a30d63d4dfd37c6e3e80c7537eb0c570; display-layout-smoke.js 594d93b9e280db7f05704598e3b71799ecdccf76; self-update-smoke.js dbb318c0da0d1a17aae91ebc88ef98ac668c3458.

Regular and Fire rebuilt from exact source via aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established standalone release signer. Both org.apollo.agcdsky v1.1.51/code 2026092911; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay-panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 539d148cdb8d95dbc502be1e0cbee82edc183fd7ebd34c8385dea051f4349b9f.
Fire SHA-256 e1dfec786c2b5f799de475117a11570fe6ec2aee7f92a503fb9ed2cb2c61a2e2.

Physical row placement and press-duration behavior remain pending owner device acceptance.


## 2026-09-29 v1.1.50 SOFTWARE updater talkback

Owner requested replacing the updater status text with an Apollo-style panel talkback. The TOOLS / INFO submenu remains one compact row. The SOFTWARE cell contains a rectangular talkback and a separate compact CHECK pushbutton; long updater status strings are no longer rendered into the button.

Talkback semantics are intentionally application-specific while following Apollo talkback visual language:
- gray = current / normal software state;
- barber pole = update process active or unresolved (CHECKING, DOWNLOADING, READY TO INSTALL, UPDATE CHECK BUSY);
- red = updater failure state;
- CHECK remains a short manual operator.

This is not a claim that Apollo barber pole universally meant "update pending"; the software mapping is an app-side convention.

v1.1.50 / Android versionCode 2026092910. Exact changed source blobs: VERSION da44c7f34804178c3004959361167ab1ce211579; app/build.gradle 0c094b484ba6b276b4f6ff19776c75bb712cc3f5; AndroidManifest.xml 972db36664b9bc62eaf4ad385aef6b78f3cb199d; index.html 4cbc6ef72e6f250c4fe3d6531fb347ad249f1c21; controls-layout.css 7d8416e6ac0851d7ab1c02fb2bba485372c231b9; app-shell-runtime.js a585d1903f723c54242204cb96e6d7851a49dd53; display-layout-smoke.js 2bff078fa1eb168e4e1f1871dc3d85dfb59ac028; self-update-smoke.js dbc1774b94de4834ddb6125e03d9a9626c0709ab.

Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Regular and Fire rebuilt from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone release signer. Both packages are org.apollo.agcdsky v1.1.50/code 2026092910; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay-panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 c3c474db0c207e669ef5820755a8b40f7fb9fa566758d45d1e037c7b53bdc9f9.
Fire SHA-256 00b702a3b2dac9474523c4f8b421fc4cd655e7a0c6cf7c9423a03f8be6b425bf.

Physical phone/Fire appearance remains pending owner device acceptance.


## 2026-09-29 v1.1.49 updater test + phone software-cell fit

Owner requested a fresh updater test from v1.1.48 and then reported the SOFTWARE/update status text was clipped on the phone. v1.1.49 / versionCode 2026092909 keeps the current Fire direct-installer path unchanged and widens only the TOOLS / INFO software cell. The submenu remains one row: CHEAT and LEGAL occupy one quarter each; SOFTWARE / CHECK FOR UPDATE spans the remaining half. No extra vertical row was added.

Exact changed source blobs: VERSION 8ac3ef6b26a02f52e23597a7f122911721c6b2ae; app/build.gradle dd12ace44e7909096a80bc557581ac37b7294a8e; AndroidManifest.xml 1911f4f2db764f9240069e6a78da96b9df7fde7f; controls-layout.css dacdeebc4f4e4be1c85c4741b71b2ddb893d1f21; display-layout-smoke.js 1d71837086b8748291234dbbed52f28dcf2f8281.

Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Regular and Fire rebuilt from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone release signer. Both are org.apollo.agcdsky v1.1.49/code 2026092909, 73/73 runtime assets with 0 missing/extra/mismatch, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate MATCH. Regular SHA-256 ee033f2d40bf4bd4eecf25e5bc0e0a355239a0bacfddd462953cd9f45abd4f48. Fire SHA-256 485d5fba6a3d13560506f94e02ec0b95645aa171f3ff54239579c9e797388598.


## 2026-09-29 v1.1.42 updater test candidate

Owner requested AUXILIARY and DREAM share one row and explicitly chose this change as the end-to-end updater test. The compact fixed main panel now places AUXILIARY across columns 1-2 on row 3 and DREAM in column 3 on row 3. The TOOLS / INFO submenu remains one fixed row of three equal controls: CHEAT SHEET | LEGAL / SOURCE | CHECK FOR UPDATE. No flowing/reordering was introduced.

Version metadata is v1.1.42 / Android versionCode 2026092902. Source gates PASS: display-layout, self-update, app-shell-runtime, and asset-reference. Both Regular and Fire were rebuilt from source using aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established release key. Both packages are org.apollo.agcdsky v1.1.42/code 2026092902, target/compile SDK 37, 73/73 runtime assets with 0 missing/extra/byte mismatches, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate SHA-256 409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f MATCH. Regular SHA-256 7b3b8c06942054f6a5e3dd7813d9bd2b9d27eedf9d010d21e861d5ee1f8ce37f. Fire SHA-256 441d11cc06860f598b102656dcbae071d86e2d0a7f89b67b329a94b4d1a54222.

A dedicated .github/workflows/publish-release.yml was added. It triggers only on release-payload/** branches, verifies committed SHA-256 sidecars, and uses the repository GITHUB_TOKEN with contents:write to create/refresh the matching GitHub Release against main from the exact pre-signed APK bytes. This avoids CI re-signing and therefore preserves updater signer equality. The payload branch is release-only and is not merged into main. The intended device test is installed v1.1.41 -> manual CHECK FOR UPDATE -> v1.1.42 discovery/download/install.


## 2026-09-29 manual updater control candidate

After the v1.1.41 updater repair, device feedback showed there was still no visible manual update command. This candidate adds a fixed full-width SOFTWARE / CHECK FOR UPDATE control under TOOLS / INFO. The button invokes a native UpdateBridge forced check and displays asynchronous updater state directly on the control: CHECKING, UP TO DATE, DOWNLOADING, READY TO INSTALL, NETWORK ERROR, checksum/signature/package rejection, or other explicit failure state. The auxiliary submenu remains fixed-position in one compact row: CHEAT SHEET, LEGAL / SOURCE, and CHECK FOR UPDATE occupy three equal cells.

Source gates PASS: self-update smoke, display-layout smoke, app-shell runtime smoke, and asset-reference smoke. Exact branch runtime/source blobs used by the local build are AppUpdater.java 3b858b3ca12027582165ca7846c9ad5727f4c49c, SensorMainActivity.java 85c271acb71942ac2c3a3781edc7cf3986ef8ec8, index.html 9aefd532cacba17544647de4e1b2de764ddd5e70, app-shell-runtime.js 1dc54a7c2cdd75f78ec7f999d153902466db10fd, controls-layout.css 2e761d94a262e23038e30f39f5a2453556efa565, display-layout-smoke.js bd6cdeab6265f7d71c8344090ed7f924eb68f1b8, and self-update-smoke.js 15332bb24e9fd1bbb2f99affb384ac21072a2acc.

Regular and Fire release APKs were rebuilt from source via aapt2 -> javac 17 -> d8 -> zipalign -> apksigner. Both are org.apollo.agcdsky v1.1.41/code 2026092901, SDK 26/37, 73 expected / 73 packaged runtime assets, 0 missing, 0 extra, 0 byte mismatches, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, established signer certificate MATCH. Regular SHA-256 cff7b8dc485917e85fbb59d408512e6b263da2203d44ec0f80976c897ce9bd7f. Fire SHA-256 db62a6868ee2d2e6bc31b309177a93d322bc94fa461239fd1e4194a650472cd1. Physical Fire/Pixel acceptance is pending; do not merge until the manual control is observed and exercised on device. The overall options panel was also tightened after owner feedback: 32px nominal operators, smaller nomenclature band/padding/gaps, lower vertical reservation, and a compact three-button auxiliary row rather than a full-width updater row.


## 2026-09-29 v1.1.41 release candidate + updater repair

Release candidate v1.1.41 / Android versionCode 2026092901 consolidates the verified post-v1.1.40 mainline and repairs the native self-update handoff. The previous updater could initiate unknown-source/package-installer UI from the background startup provider. The repaired flow keeps release discovery, download, SHA-256 verification, package/version validation, and signer validation in the background, but stores a verified pending APK and hands permission/install UI to the foreground SensorMainActivity. Process startup now forces one release-discovery check instead of being suppressed by the persisted 12-hour success window. The normal periodic receiver remains throttled. If GitHub's releases/latest API fails, the updater falls back to main/VERSION plus deterministic release asset and .sha256 URLs, preserving the same integrity and signing checks. ACTION_SECURITY_SETTINGS is a fallback when per-app unknown-source settings are unavailable.

Focused self-update, branding, app-shell, display-layout, and asset-reference smokes PASS. Both Regular and Fire were rebuilt from source using aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established standalone release key. Both packages are org.apollo.agcdsky v1.1.41/code 2026092901, target/compile SDK 37, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate SHA-256 409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f. Runtime asset audit: 73 expected / 73 packaged in each APK, 0 missing, 0 extra, 0 byte mismatches; relay-perceptual-personality.js and relay-panel.js/css absent. Regular APK: 460898 bytes, SHA-256 75ac8a796792872293e4d2b156293076b43112342e24b2dd11ad1ec7e16e3c6a. Fire APK: 464994 bytes, SHA-256 018dc1831e810dec4fd0785a8380377c4bf2df753a0e683c7f58cb8cf3c47ef6. Release assets prepared as app-regular-release.apk, app-fire-release.apk, and matching .sha256 sidecars.


## 2026-09-29 Fixed options panel + first-start instruction

The Apollo-style application options were revised after device feedback so the buttons no longer use a flowing/wrapping strip. The panel now has explicit fixed grid positions: AUDIO / TACTILE / DISPLAY on row one; COMPUTER / OPTICS / TEST on row two; AUXILIARY spanning row three. The TOOLS / INFO submenu is a fixed two-column grid. A one-time first-start instruction now reads `HOLD PANEL FOR OPTIONS`; the prior inline rule that forcibly hid the hint was removed, and the new `optionsHintV1` key makes existing installs see the instruction once after this update.

Source regression gates cover the fixed grid positions, fixed submenu, visible hint, one-time runtime key, Apollo nomenclature, and absence of the rejected relay panel/personality layer. Physical Pixel acceptance remains pending; PR #166 stays draft.



## 2026-09-29 Apollo-style application option panel

After physical Pixel acceptance closed RLY-01, the bottom application-options strip was restyled without changing relay or AGC behavior. The controls remain explicitly application-only, but now use an Apollo spacecraft panel vocabulary: gray metal panel field, a separate painted nomenclature band, recessed dark pushbutton face, and restrained white lettering. Each operator has a stable `data-panel-legend` nomenclature label while the existing button text/state and IDs remain unchanged, so sound, haptics, display, mode, optics, diagnostics, checklist, and legal/source behavior keep their existing event ownership. The TOOLS / INFO summary uses the same treatment.

The display-layout regression gate now requires the Apollo panel treatment and all visible nomenclature labels, and rejects restoration of the superseded DSKY-key styling. Relay-panel UI and synthetic relay personality/timing remain forbidden and untouched.

## 2026-09-27 RLY-02 source/provenance re-audit

The relay-fidelity audit now separately tracks **production design authority**, **mission/G&N-system configuration provenance**, and **individual DSKY chassis provenance**; all three are now established for the Apollo 11 LM relay hierarchy, while exact production relay mechanical timing remains unknown.

Verified/retained:

- Block II DSKY physical population remains 132 relay packages: 120 latching + 12 non-latching.
- Each D1-D6 relay-circuit assembly 2003910-021 contains 20 x 2004688-1/-2 and 2 x 2004689-2.
- Exact production 2004688/2004689 unit timing remains unrecovered; the app must not invent per-package travel, bounce, pole skew, or acoustic manufacturing fingerprints.
- The 3 ms / 5 ms values remain explicitly predecessor-SCD presentation bounds only.
- The complete production design-basis logical/function -> D1-D6/K1-K22 package crosswalk is now source-joined: 120/120 latching identities through 2005918 + 2005954A + 2005973, and 12/12 non-latching function drives through 2005954A + 2005973. 2003910 Rev E resolves the K22 switched-contact topology for the 2003910-021 / 2003952-031 configuration; exact production relay mechanical timing remains explicitly unresolved.

K22 provenance was tightened after checking the actual Virtual AGC schematic sources:

- original-drawing transcription `2005973-`: K22 pins 2/3/8 connect to J1-5/J1-3/J1-6;
- original-drawing transcription `2005940A`: K22 pins 2/3/8 are unconnected;
- K22 pins 1/4/5/6/7 agree, and K21 is not the differing relay;
- `2005973r` is explicitly a 2018 **reconstruction** from predecessor 2005952- plus ND-1021042 figure 4-226, not another surviving production drawing;
- immediate relay-circuit assembly 2003910-021 and the DSKY 2003994 system-manual table call out 2005973; parent assembly 2003952-031 calls out 2005940 and the manual figure preserves older 2005940-style K22 wiring;
- a NARA aperture-card scan of original drawing 2005973- survives and was the basis for the later direct transcription.

Current conclusion: **2003910 Rev E proves the 2005973 K22 topology for the 2003910-021 / 2003952-031 configuration, and that hierarchy is now tied to Apollo 11 LM's actual DSKY chassis.** Virtual AGC's NASA-perspective hierarchy identifies 6014999-091 as G&N system serial 609 (LM-5/Apollo 11), with DSKY 2003994-091 -> six 2003952-031 -> 2003910-021. MIT/IL reports E-1142-58, E-1142-59, and E-1142-61 provide the chassis chronology: LM-5/System 609 DSKY S/N 54 was 2003994-021, retained S/N 54 through the -051 modification, and is listed at KSC as 2003994-091 S/N 54 on 1 April 1969. Thus Apollo 11 LM DSKY **S/N 54** reaches the Rev-E-resolved relay assembly hierarchy. Exact production relay mechanical timing remains unknown.

This re-audit supersedes the 2026-09-25 relay-rack section's claims of measured-looking per-relay manufacturing profiles, contact bounce, pole skew, and unique package acoustic identity. Those were simulation inventions rather than recovered Apollo measurements and are being removed in PR #156.

Verification performed for this audit:

- [x] compared K22 pin connectivity in the `2005973-`, `2005940A`, and reconstructed `2005973r` Virtual AGC netlists;
- [x] checked provenance notes embedded in the original-drawing and reconstructed CAD files;
- [x] checked the production assembly hierarchy and DSKY system-manual drawing table;
- [x] updated relay evidence/inventory documentation to distinguish design basis from as-flown proof;
- [ ] recovered/read a production SCD for 2004688;
- [ ] recovered/read a production SCD for 2004689;
- [x] recovered and machine-gated the complete production design-basis D1-D6/Kx logical/function crosswalk (120 latching + 12 non-latching drive mappings);
- [x] recovered 2003910 Rev E assembly evidence resolving K22 switched-contact wiring for the 2003910-021 / 2003952-031 configuration;
- [x] established Apollo 11 LM mission/G&N-system provenance: 6014999-091 / serial 609 -> DSKY 2003994-091 -> 6 x 2003952-031 -> 2003910-021;
- [x] established Apollo 11 LM DSKY chassis provenance: MIT/IL E-1142-58/-59/-61 track DSKY S/N 54 from 2003994-021 -> -051 -> 2003994-091 for LM-5/System 609;
- [x] exact final PR #156 head 970828493f1998ca23b2f75180747071dce6d9dd passed Android 36352669981, PWA 36352669967, and Apple 36352669972; the accepted minimal 1 ms / amplitude 1 handset relay haptic was retained rather than retuned.


## 2026-09-25 production web register glyph-stability repair

The web/PWA renderer previously replaced an entire register SVG group whenever any sign/digit on that row changed. That caused unchanged digits—most visibly bottom-row zeros—to be destroyed and recreated when neighboring relay-driven elements changed.

The production repair keeps one persistent SVG slot per sign/digit position and updates only the slot whose rendered value changed. Cache keys include renderer implementation versions so deliberate renderer replacement still repaints correctly. Apollo 1006315G digit/sign geometry, spacing, relay mappings, contact timing, bounce, and sound coupling are unchanged.

Regression coverage includes `tools/dsky-render-stability-smoke.js`, the canonical source-smoke manifest, and the PWA deployment workflow. The regression proves unchanged register and upper-field zeros retain SVG node identity and receive no repaint when neighboring elements change.

The relay-rack UI remains removed on production `main`; this repair was reapplied cleanly on top of current production rather than merging the stale relay-panel feature branch and resurrecting that removed experiment.


## 2026-09-25 full 140-relay live rack / unified contact-event presentation

A new relay-rack view is mounted above the DSKY in the normal interactive layout. It has no decorative title/legend block and depicts every relay currently modeled by the app:

- 132 latching display relays: 12 selectable channel-010 banks x 11 relays (B + C-K1..K5 + D-K1..K5);
- 8 auxiliary relays: COMP ACTY, UPLINK ACTY, TEMP, KEY REL, OPR ERR, FLASH, RESTART, STBY;
- 140 modeled relays total.

The rack is not a separate animation. relay-visual-coupling.js is now the single presentation-event authority for relay contact motion. For each changed latching relay, one deterministic per-relay event path uses the existing manufacturing profile from relay-identity-audio.js to drive:

1. relay-rack armature/contact motion;
2. that exact relay's manufactured sound identity;
3. the DSKY EL/contact projection.

Set/reset travel, stable time, contact bounce, pole skew, and per-relay acoustic identity remain deterministic per installed relay. Authentic mode keeps the original 20-ms physical bank/latch boundary unchanged. Stretched mode remains presentation-only, but its armature arrival is frame-coupled so rack motion, sound, and DSKY contact change occur on the same presentation frame. Bounce timing is anchored to that actual shared impact event rather than the earlier command time.

The 20-ms latch commit in hardware-fidelity.js remains authoritative for settled hardware state. Raw channel 011/0163 backing state is recorded immediately for diagnostics, while modeled auxiliary relay contacts own the corresponding annunciator transition. PHONE CLOCK and real AGC channel-010 paths now use the same relay-contact presentation path rather than maintaining a separate visual/audio timing approximation.

Source/test work on branch feature/relay-panel-140:

- added relay-panel.js and relay-panel.css;
- added canonical relay-panel-smoke.js;
- strengthened relay-visual-coupling-smoke.js to prove the same manufactured contact event drives rack subscribers, sound, DSKY projection, and bounce;
- updated hardware/service/output/state ownership smokes for the new authority boundary;
- connector-backed syntax compilation passed for all changed JavaScript files;
- direct branch execution with mocked hardware verified a 5.0-ms relay produces rack/contact, sound, and DSKY projection at 5.0 ms and its modeled bounce at 5.5 ms;
- direct stretched-mode execution verified rack/contact, sound, and DSKY projection share the same stretched frame, with bounce scheduled from that frame;
- direct relay-panel execution verified 132 latching + 8 auxiliary = 140 live cells.

These are source-level checks. The canonical bash tools/build-local.sh, Gradle APK build/signature verification, and Android device smokes have not yet been executed for this feature and must not be marked verified until observed.


## 2026-09-18 SNTP / network-time repair

The reported clock-sync failure traced to a real platform split rather than the SNTP client itself:

- `SensorMainActivity` and `AgcDreamService` already started `NtpTime` and exposed `TimeBridge`;
- the regular/Fire `MainActivity` did neither, so its frontend could only retain the default zero offset and Android wall clock;
- PWA/web cannot use UDP SNTP from browser JavaScript, so it also had no external network-time correction path.

This repair:

- starts `NtpTime` and registers/removes the listener in `MainActivity`;
- exposes `TimeBridge.getStatus()` in `MainActivity` and pushes native SNTP status updates into the shared frontend;
- tears the bridge down with the WebView;
- preserves Cloudflare UDP SNTP as the authoritative Android correction source;
- adds a browser-only same-origin HTTP `Date` fallback using three no-cache HEAD samples, midpoint/RTT correction, a median offset, ten-minute resync throttling, and the same two-hour stale policy;
- labels browser fallback as NETWORK TIME rather than claiming browser UDP SNTP;
- expands `tools/ntp-policy-smoke.js` so MainActivity, SensorMainActivity, DreamService, and the browser fallback are all source-gated.

No system clock is set and `android.permission.SET_TIME` remains forbidden. WebView network loading remains blocked; Android SNTP stays native.

Verification status for this repair:

- [x] source changes committed on `fix/sntp-mainactivity-web-fallback`;
- [x] policy test source updated to catch the exact missing-MainActivity regression;
- [ ] canonical `bash tools/build-local.sh` has been run for this branch;
- [ ] regular/Fire APKs from this branch have been installed and clock-sync behavior verified on-device;
- [x] deployed PWA HTTP-Date fallback has been checked in Chromium; see the 2026-10-03 hosted PWA network-time end-to-end check above.

Local browser runtime evidence (2026-10-03): a fresh PWA build served from `<temporary-path>` loaded in Brave at `127.0.0.1:8765`. The local server logged three successful `HEAD /manifest.webmanifest?...` requests; `AGCDSKY.ntpStatus()` returned `source: "http-date"`, `state: "synced"`, `usingNetworkTime: true`, `lastAttemptResult: "success"`, `lastAttemptReason: "automatic"`, `roundTripMs: 5`, and `offsetMs: 16`. This verifies the local browser runtime only; the deployed-host item above remains unchecked.

Hosted verification is now recorded above: three GitHub Pages Date-header samples succeeded and the live status returned `source: "http-date"` / `state: "synced"`. Physical phone/browser behavior remains unverified.

The same Chromium runtime audit initially logged hundreds of “AudioContext was not allowed to start” warnings while PHONE CLOCK relay updates ran before user interaction. A resume promise can remain pending under autoplay policy, so handling only a `NotAllowedError` rejection does not stop repeated attempts. The audio guard now defers both context creation and relay bursts until a trusted page pointer gesture; synthetic pointer events cannot unlock audio, and later policy rejections remain suppressed until another trusted gesture. `node tools/audio-recovery-smoke.js` verifies pre-gesture silence, synthetic-event rejection, retry suppression, and successful post-gesture recovery. A fresh rebuilt local Brave page produced no AudioContext warnings across 15 seconds of clock updates; a blank-panel gesture then yielded `AGCDSKY.audioStatus() = {state: "running", failures: 0, circuitOpen: false}`. The same page again returned three successful HTTP-Date samples and `state: "synced"`. Only the test server's missing `/favicon.ico` returned 404. `env TZ=UTC bash tools/run-source-smokes.sh` passed (97 Node tests plus the NTP shell test); `bash pwa/tools/build-site.sh <temporary-path> && node pwa/tools/pwa-smoke.js <temporary-path>` passed; `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/gradle-bootstrap.sh :app:verifyPinnedAgcAssets :app:assemble :app:lint` passed for all six Regular/Fire variants with lint completing successfully; Regular and Fire debug APK verifiers and ZIP integrity checks passed. Hosted PWA and physical-device behavior remain unverified.

Do not upgrade the unchecked items without observed build/device/browser evidence.

## 2026-09-14 DSKY runtime refactor phase 30

`startup-defaults.js` had become a catch-all for four unrelated boot concerns: persistent run-mode defaulting, page-owned browser-resource teardown, chunked AGC snapshot transport, and camera console-error classification.

Phase 30 narrows that startup ownership without changing AGC/DSKY semantics:

- `startup-defaults.js` now owns only the first-run CLOCK persistence default;
- `page-resource-lifecycle.js` owns timer/interval/animation-frame tracking, WebAudio wrapper cleanup, media/core teardown, and `AGCLifecycle`;
- `agc-snapshot-codec.js` owns only the existing chunked `AgcCore` snapshot encoding/decoding path and preserves snapshot schema 1;
- `camera-error-policy.js` owns only SXT camera console classification, downgrading expected permission/lifecycle outcomes while preserving unexpected failures as errors;
- parser order is locked as `agc-core.js -> spacecraft-default.js -> startup-defaults.js -> page-resource-lifecycle.js -> agc-snapshot-codec.js -> camera-error-policy.js -> app-state-runtime.js`, so `AgcCore` exists before the codec patch, page-resource wrappers still install before application timers/audio work, and camera classification installs before `optics.js` can report camera failures;
- `tools/startup-runtime-smoke.js` source-gates those ownership boundaries and behaviorally checks first-run mode defaulting, tracked resource cleanup, AudioContext closed-state removal, snapshot round-trip behavior, and camera-error classification;
- `tools/audio-recovery-smoke.js` now reads `page-resource-lifecycle.js` directly for the closed-AudioContext lifecycle invariant instead of coupling that test to the old catch-all file;
- `tools/asset-reference-smoke.js` requires the new startup modules and their parser order;
- `tools/build-local.sh` includes the new startup runtime smoke in the canonical local gate.

No channel mapping, Pinball key code, held-PRO behavior, relay model, display rendering, yaAGC startup sequence, Comanche rope input, or persisted snapshot schema changed in this phase.

Observed in this execution environment against the phase-30 source staged from the committed branch:

- `startup-defaults.js`, `page-resource-lifecycle.js`, `agc-snapshot-codec.js`, `camera-error-policy.js`, and `tools/startup-runtime-smoke.js` all passed `node --check`;
- `node tools/startup-runtime-smoke.js` passed, including the snapshot memory round trip and page-resource/camera policy scenarios;
- GitHub compare reports phase 30 as two commits ahead of phase 29 with only the intended startup/runtime-gate files changed.

These are source-level checks only. The current execution environment still lacks the complete recursive checkout/Android SDK build path and its shell cannot resolve GitHub, so `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this phase. Do not upgrade those gates to verified from the source smoke.

## 2026-09-14 DSKY runtime refactor phase 1

A second audit caught an important detail the first pass missed: `index.html` does not list `flight-hardware-ui.js` or `keyboard-electrical-interlock.js` directly, but the statically loaded `cm-mode.js` installs both scripts dynamically from its window-load handler. They are therefore part of the active CM runtime. The earlier Phase-1 note that treated them as dormant was wrong and has been removed.

The effective input/transition ownership is now documented as follows:

- `keyboard-electrical-interlock.js` owns the 18 normal keycoded switches at **window capture** and preserves the series-key / KEYRST electrical model;
- `hardware-fidelity.js` owns the maintained PRO contact on channel `032`;
- `runtime-transitions.js` loads synchronously after `app.js` and the required `dream-silence.js` guard, then owns one shared CLOCK -> AGC in-flight Promise exposed through `AGCDSKY.runtimeTransitions` / `AGCDSKY_RUNTIME`;
- `runtime-transitions.js` replaces both the classic-script global `enterAgc` binding and `AGCDSKY.enterAgc` with the same serialized wrapper, so app startup, the AGC button, clock fallback input, and the electrical interlock all join the same transition;
- `clock-behavior.js` now owns only the document-level clock keypad fallback/queue and consumes the shared transition service;
- `app.js` remains the authoritative underlying AGC loader, channel decoder, display-state owner, and snapshot owner;
- once the electrical interlock is dynamically installed, physical normal-key events are stopped at window capture before the document-level clock fallback can see them.

The packaged synchronous script order for this slice is deliberately:

```text
app.js -> dream-silence.js -> runtime-transitions.js -> clock-behavior.js -> ... -> cm-mode.js
```

`dream-silence.js` remains immediately after `app.js` because the existing asset gate requires that safety guard before any later frontend layer. `runtime-transitions.js` still runs in the same script turn, before app startup timers or user input can execute.

Phase 1 removes duplicate AGC-loading coordination while preserving the existing CM-only behavior:

- the shared service serializes AGC entry through one Promise and returns that same Promise to later callers while the load is in flight;
- the already-installed app startup/AGC-button closures resolve the replaced classic-script global `enterAgc` binding at call time, so they enter through the same service without rewriting the underlying `app.js` loader;
- the previous 10 ms readiness polling fallback has been removed; an `agc-loading` state without the shared Promise is now treated as an invariant violation instead of being hidden by another polling loop;
- `keyboard-electrical-interlock.js` awaits `runtimeTransitions.requestAgc('keyboard electrical contact')` and only then asserts the original Pinball keycode on channel `015`;
- a fast touchscreen release during loading still preserves the physical cycle until the make is delivered and the minimum KEYRST dwell completes;
- queued document-level fallback contacts remain ordered and are forwarded after AGC readiness;
- direct AGC-button/startup entry preserves `app.js` failure compatibility: if the loader catches an error and falls back to clock, the app-entry Promise resolves with that final state, while keyboard/fallback callers get a derived rejection because they require a ready AGC before injecting a key;
- transition diagnostics return copied state rather than mutable production structures;
- synthetic CLOCK-mode COMP ACTY remains forbidden;
- AGC/WASM startup ordering, channel mappings, relay state, PRO semantics, snapshot format, and display rendering are unchanged by this phase.

Regression coverage was tightened in four places:

- `tools/clock-mode-behavior-smoke.js` covers ordinary fallback promotion, ordered fallback contacts during one load, a direct app/startup-style `enterAgc` call followed by a keypad join with no polling or second loader start, and app-load failure compatibility;
- `tools/keyboard-electrical-interlock-smoke.js` treats the shared transition API as the handoff contract while retaining the series-chain, PRO-bypass, fast-tap, and KEYRST checks;
- `tools/runtime-transition-integration-smoke.js` checks script order, installs the extracted transition service plus clock fallback and electrical interlock together, propagates pointer events from window to document unless actually stopped, and requires a physical VERB fast-tap during a direct app AGC load to join one transition, generate one Pinball `021` make, avoid the clock fallback/legacy editor, avoid readiness polling, and end with one KEYRST;
- `tools/asset-reference-smoke.js` now requires `runtime-transitions.js` to be packaged and locks the exact `app.js -> dream-silence.js -> runtime-transitions.js` ordering.

The transition smokes are wired into `tools/build-local.sh`. The clock behavior smoke existed previously but was not part of the canonical build gate; Phase 1 added it, and the new integration smoke is adjacent to the electrical-interlock gate.

Observed in this execution environment against source fetched from the current refactor branch:

- current `runtime-transitions.js`, `clock-behavior.js`, and `keyboard-electrical-interlock.js` passed `node --check` in a reconstructed minimal source tree;
- current transition/clock production source passed scenarios for ordinary first-key handoff, ordered fallback queuing, direct app-load joining with no second loader/poll loop, and app-load failure compatibility;
- current electrical production source passed the physical fast-tap handoff scenario: window-capture ownership, no document fallback participation, no 10 ms readiness polling, one Pinball `021` make, one KEYRST, and no latched channel-015 cycle;
- the execution container still cannot resolve `github.com`, so a complete recursive checkout and the repository's exact full smoke scripts cannot be executed directly in that container.

These are source-level checks against the current fetched production files, not a canonical full-repository build. `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this branch in this environment. The Android SDK/recursive-checkout limitations below still apply. No device/runtime claim is upgraded from these source checks.

## 2026-09-13 WebAudio renderer recovery

A regular-phone prototype report from Android 17 / Chromium WebView 151 showed Chromium's native WebAudio renderer diagnostic:

```text
The AudioContext encountered an error from the audio device or the WebAudio renderer.
```

The failure was in the relay-audio lifecycle, not AGC/DSKY channel logic. The prior frontend kept one global `AudioContext`, retried `resume()` without handling failure, never replaced a context that had reached `closed`, and allowed the raw Chromium console error to be promoted into the next-launch prototype crash/error report.

The late `background-audio-guard.js` layer now owns bounded WebAudio recovery after all relay-audio refinements are loaded:

- every relay `AudioContext` is observed for Chromium's `error` event;
- a renderer/device failure retires and closes the failed context and clears the global reference;
- the next audible relay event may create one fresh context;
- if that replacement also fails before eight seconds of stable running audio, a circuit breaker stops automatic retries rather than creating an endless fail/recreate loop;
- the RELAY CLICKS control displays `ERROR · OFF/ON TO RETRY`, and an explicit off/on cycle resets the breaker;
- an already-`closed` context is replaced without counting that normal state as a renderer failure;
- a non-policy `resume()` rejection retires the context instead of being silently swallowed;
- `NotAllowedError` remains a user-gesture/autoplay-policy condition and does not destroy a context that may resume on a later gesture;
- Dream mode and hidden-app state still refuse to create/resume relay audio;
- stale-context relay emissions are rejected after a context has been retired.

`DebugReporter` now ignores only Chromium's exact recoverable renderer-console sentence. If bounded recovery itself fails twice, the frontend reports a distinct `WebAudio recovery failed...` detail through the local `DebugBridge`, so a genuine unrecovered audio failure still produces diagnostic evidence.

A related lifecycle bug was also fixed: `startup-defaults.js` previously retained closed `AudioContext` wrappers in its page-owned `audioContexts` set until full page teardown. Recovered/replaced contexts are now removed on the `closed` state transition, preventing dead-wrapper accumulation and keeping `AGCLifecycle.counts().audioContexts` meaningful.

`tools/audio-recovery-smoke.js` now covers renderer-error replacement, repeated-failure circuit breaking, manual retry, closed-context replacement, resume rejection, `NotAllowedError`, Dream/hidden silence, lifecycle tracking cleanup, and raw Chromium-report filtering. It is part of the canonical `tools/build-local.sh` source gate.

Observed in this execution environment:

- the edited `background-audio-guard.js` passed `node --check`;
- the new audio-recovery smoke passed against the staged edited sources;
- the edited `tools/build-local.sh` passed `bash -n`.

These are source-level checks only. The current execution environment still cannot resolve GitHub from the shell and does not provide the complete Android SDK/Gradle recursive checkout, so the canonical Android build, APK verification, and Pixel/Fire device smokes have **not** been run for this revision. The shortest acceptance step remains `bash tools/build-local.sh`, followed by the regular-phone device smoke on the Pixel-class Android 17 target.

## Current scope

The current Android app defaults to **LM / Luminary 099** and retains selectable CM / Comanche 055 AGC execution. It has two deliberately separate modes:

1. a synthetic phone-clock / DreamService presentation; and
2. a real AGC mode driven by the pinned `yaAGC` WebAssembly core and the selected exact pinned `Luminary099.bin` or `Comanche055.bin` rope.

The current Gradle package inputs are only:

- `vendor/webAGC/src/yaAGC.wasm` — 132,617 bytes — Git blob `713685680492098d05437b99c26403f683d56009`;
- `vendor/webAGC/demo/agc/Comanche055.bin` — 73,728 bytes — Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`;
- `vendor/webAGC/demo/agc/Luminary099.bin` — 73,728 bytes — Git blob `cd2ec9992d5863e1c7234fa760020f68ef946202`.

The pinned `vendor/webAGC` gitlink remains:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Normal DSKY keys use channel `015` with the Pinball codes. PRO remains a level-sensitive input on channel `032` bit `020000` and is not converted into an ordinary key event.

## 2026-09-12 phone CLOCK -> AGC input regression

The interactive phone Activity had regressed so normal DSKY commands entered while the display was in CLOCK mode no longer promoted the app into real AGC mode. The cause was the newer Block II series-key electrical interlock: it owns normal keys at **window capture** and stops propagation, while the older clock-handoff helper was listening later at **document capture**. The first physical key therefore never reached the handoff helper and fell through to the obsolete synthetic clock command-entry path instead.

The electrical interlock still owns the physical transition point, but transition serialization is now shared. For a normal key made in CLOCK mode it:

- requests the shared `AGCDSKY.runtimeTransitions.requestAgc()` transition;
- joins an already-running AGC load rather than starting another one;
- forwards that same physical keycode to channel `015` once the Comanche core is ready;
- retains the existing minimum electrical dwell and separate `keyRelease()` / KEYRST path if the touchscreen key was released while the core was loading;
- keeps PRO separate on channel `032` exactly as before;
- does not invoke the old synthetic clock command editor for the handoff key.

`tools/keyboard-electrical-interlock-smoke.js` remains the isolated electrical regression gate. `tools/runtime-transition-integration-smoke.js` is the corresponding multi-layer gate for the shared transition service, clock fallback, and physical electrical owner.

The source gates are committed. They are **not** substitutes for the current canonical local build and Android device smoke.

## 2026-09-11 original-drawing correction pass

The DSKY display source-of-truth policy was tightened. Original MIT Instrumentation Laboratory / NASA Apollo engineering drawings are now the dimensional/specification authority. In particular:

- SCD `1006315`, **INDICATOR, DIGITAL, ELECTROLUMINESCENT, SPECIFICATION CONTROL DRAWING**, is the primary source for the EL indicator;
- the `2003994-121` assembly chain establishes the DSKY/EL installation context, including the `2003988` EL-and-cover assembly;
- VirtualAGC electrical material and preserved schematics are used to cross-check relay/channel behavior;
- Ben Krasnow's `DSKY_EL_replica` SVG remains only a vector-outline transcription source for numeric segment contours that have not yet been re-entered directly from the original drawing.

### EL appearance

Current source now uses:

- gray EL glass with visible gray border/contact hardware;
- nine visible contact/ITO dots already present in the source artwork mapping;
- no synthetic neon-style spatial glow;
- black `PROG`, `VERB`, `NOUN`, and `COMP ACTY` lettering over EL phosphor sections;
- corrected visible clearance between the right-hand digit fields and the glass border;
- source-backed register separator geometry;
- production nominal **5300-angstrom / 530-nm** EL color rather than the cooler appearance of an early surviving panel.

The WebView (`--el:#79ef4f`), native widget (`Color.rgb(121,239,79)`), and generated API-31+ widget register frames (`#79EF4F`) are locked together by `tools/el-widget-smoke.js`.

The native Android home-screen widget carries the same gray glass, border/dots, black-on-EL legends, no-glow treatment, right-side field clearance, and production EL color.

### Keyboard placement

The numeric/center key rows retain their measured pitch. The four outer function keys are intentionally staggered rather than forced onto the numeric-row baselines:

- VERB and ENTR are on the intermediate upper row;
- NOUN and RSET are on the intermediate lower row.

This fixes the earlier convenience 7-column grid behavior without moving the numeric keypad.

### Sextant controls

The sextant and star-selection buttons now use the same Series-2-style option-button construction as the main app controls. This is CSS-only and does not alter optics/AGC behavior.

## CM annunciator panel

The current face is intentionally the CM layout. VirtualAGC `yaDSKY2/CM.ini` defines the two columns of seven as:

```text
11 UPLINK ACTY     21 TEMP
12 NO ATT          22 GIMBAL LOCK
13 STBY            23 PROG
14 KEY REL         24 RESTART
15 OPR ERR         25 TRACKER
16 BLANK           26 BLANK
17 BLANK           27 BLANK
```

Therefore the four lower blank positions are not missing LM `ALT` / `VEL` lamps in this CM build. Do not add LM-only annunciators to the Comanche face.

## Channel-010 physical relay model

The display is modeled as **12 selectable banks of 11 bistable relays**. Channel `010` uses the upper selector field to choose a bank; the low 11 bits are the physical bank state:

```text
B + C1..C5 + D1..D5
```

The selector field is not treated as four extra display relays.

The bank mapping remains:

- 11 → PROG pair;
- 10 → VERB pair;
- 9 → NOUN pair;
- 8 → visible R1D1 from D/right bank (C is physically present but visually unused);
- 7/6 → R1 sign/digits;
- 5/4 → R2 sign/digits;
- 3 → R2D5 + R3D1;
- 2/1 → R3 sign/digits;
- 12 → condition-light relay row.

### Individual relay behavior

`hardware-fidelity.js` keeps a separate low-11 latched state for each bank. A write computes the exact Hamming difference between the old and new 11-bit states; each changed bit is one physical bistable relay operation.

The electrical command is parallel. The simulator therefore does **not** model the eleven relays as being driven serially. It allows the documented 20 ms relay settling interval, emits separate armature/contact transients for relays that actually change state, and exposes the final optical state at the settle boundary rather than inventing an undocumented sub-20-ms visible contact order.

`relay-audio-refine.js` likewise emits one dry mechanical transient per changed bistable relay instead of collapsing a whole bank transition into one generic click.

The current sub-20-ms acoustic scatter is an approximation inside the documented settle budget; it is **not** represented as measured flight-relay pull-in timing.

## K1-K5 character contact matrix

The five character relays are no longer treated as a simple enum of blank plus digits 0-9.

`dsky-relay-matrix.js` implements the actual K1-K5 contact logic traced from the DSKY schematics by VirtualAGC `Tools/traceDSKY.py`. This means all 32 possible five-relay states have their physical EL-segment result.

The normal software codes remain exactly:

- blank `000`
- 0 `025`
- 1 `003`
- 2 `031`
- 3 `033`
- 4 `017`
- 5 `036`
- 6 `034`
- 7 `023`
- 8 `035`
- 9 `037`

The other 21 electrical states are now rendered through the contact matrix rather than incorrectly disappearing as blank.

The visually unused C five-relay field of selector 8 remains physically modeled. If Comanche drives it, its relay operations still exist even though no EL digit is connected to it.

## Other DSKY discretes

Current real-AGC mapping remains source-driven:

- channel `011` bit `00002` → COMP ACTY;
- channel `011` bit `00004` → UPLINK ACTY;
- yaAGC channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off hardware state;
- condition-light row 12 is decoded from channel `010`.

For Comanche 055 V35, the source-backed relay-12 low-11 state remains `00650`.

## Build and verification gates

Canonical local build:

```bash
bash tools/build-local.sh
```

The current build contract requires:

- JDK 17+;
- Node.js 18+;
- Android SDK compileSdk 37;
- Android Build Tools **36.0.0 exactly**;
- stable Gradle 9.5+ (the repository can bootstrap checksum-verified Gradle 9.5.1 when network access is available);
- the exact clean pinned `vendor/webAGC` checkout.

The build runs source/policy tests, DSKY mapping/relay gates, EL-widget checks, real pinned yaAGC/Comanche host semantics, clean regular + Fire Gradle builds, and post-build APK verification.

Expected debug outputs:

```text
app/build/outputs/apk/regular/debug/app-regular-debug.apk
app/build/outputs/apk/fire/debug/app-fire-debug.apk
```

Debug package ID remains install-safe alongside the release app through the `.eltest` application-ID suffix.

## Historical 2026-09-11 host verification and build blocker

This section records the limitations of the 2026-09-11 execution environment. They were not the state of the Mac checkout used for the 2026-10-03 canonical build recorded below.

The 2026-09-11 correction pass was exercised as far as the current container permits. Observed host results:

- changed relay JavaScript syntax checks passed;
- schematic K1-K5 validation produced **28 distinct physical EL segment patterns** across the 32 relay codes and reproduced every normal blank/0-9 code;
- the CM annunciator order and four blank positions were checked;
- the widget-frame generator produced all **60** register frames using the production `#79EF4F` EL color;
- the exact pinned `yaAGC.wasm` + `Comanche055.bin` executed under Node: `V16N65E` produced numeric output, `V37E00E` reached PROG `00` / relay-11 low-11 `01265`, and real `V35E` reached Comanche relay-12 low-11 `00650`.

These are host/source checks, not an Android build or device test.

At that time, the canonical Android build was attempted/preflighted in an execution environment with these blockers:

- Java 21 and Node 22 are available;
- no Gradle installation is available;
- `ANDROID_SDK_ROOT` / `ANDROID_HOME` are absent;
- Android Build Tools 36.0.0 (`aapt2`, `apksigner`) and platform 37 are absent;
- there is no complete current recursive checkout in the build container;
- shell network/DNS cannot resolve GitHub, so the Gradle bootstrap, repository clone/submodule initialization, and Android SDK package download cannot be completed here.

Those blockers were resolved for current `main` on the Mac on 2026-10-03; see the exact-revision build result below. The obsolete hosted Android build workflow remains removed to enforce the local-only APK build policy.

## Historical 2026-09-11 verification status

The following checklist records the earlier drawing/relay revision. It is not a current blocker list; later current-main results and still-open physical gates follow below.

Historical v1.1.2 regular/Fire source checkpoints have previously completed the canonical local build and Fire-device HOME verification. Those results do **not** automatically apply to the 2026-09-11 drawing/relay revision.

For the current drawing/relay revision plus the CLOCK→AGC transition refactor and WebAudio recovery:

- [x] source changes are committed on the current repair/refactor branch;
- [x] K1-K5 contact matrix is source-gated by `tools/dsky-mapping-smoke.js`;
- [x] individual low-11 relay-change accounting is source-gated;
- [x] WebView/native/generated-widget production EL color agreement is source-gated;
- [x] CLOCK→AGC first-key behavior is encoded in the keyboard-interlock regression gate;
- [x] shared transition + electrical ownership is encoded in `tools/runtime-transition-integration-smoke.js`;
- [x] both transition smokes are wired into the canonical local build gate;
- [x] WebAudio renderer recovery is encoded in `tools/audio-recovery-smoke.js` and wired into the canonical local build gate;
- [x] the staged audio-recovery source smoke passed in this execution environment;
- [x] current host/source and real-Comanche WASM checks above passed for the earlier 2026-09-11 drawing/relay state;
- [ ] the complete current transition smoke set has been executed from a full checkout at the exact branch HEAD;
- [ ] canonical `tools/build-local.sh` has been run successfully for this exact revision;
- [x] current regular APK has been installed/device-smoked; the 2026-10-03 cold-start readiness and full device gate are recorded above.
- [ ] current Fire APK has been installed/device-smoked;
- [ ] current native EL widget has been visually checked on-device;
- [ ] current physical-screen DSKY geometry has been visually accepted by the owner.

Do not upgrade any unchecked item to verified without actual output from that exact source revision.

## Verification gates noted on 2026-09-11 (historical)

1. Exact 2004688/2004689 production relay timing remains unresolved; the current generic profile avoids claiming unsupported per-part acoustics. Recover readable production SCDs if they become available.
2. Validate current Fire and Regular release-signed builds on physical targets; the connected Android 36 emulator does not prove Fire OS or physical-screen behavior.
3. The canonical clean-tree build blocker was closed on 2026-10-03 for exact current `main`; physical device gates remain open as listed in the later audit checkpoints.

## Build policy

APK builds, signing, and tests remain local/manual. Do not use hosted build infrastructure for them. The release-only workflow may publish an already built and verified signed payload. Never substitute APK surgery/repacking for a real Gradle build.

## 2026-09-18 checklist / EL cross-platform parity

Current branch now carries the same checklist and EL presentation intent across Android, Apple, and PWA/web:

- unenergized EL digit/sign segments render as opaque neutral gray `#737373`, slightly lighter than the EL glass, instead of low-opacity green phosphor;
- energized EL remains the source-backed `#79EF4F` phosphor approximation;
- the in-app checklist header has a PRINT action;
- the shared print stylesheet expands every checklist section and requests 5.5 × 8 inch pages;
- Android installs a `PrintBridge` JavaScript interface and uses `PrintManager` with a 5500 × 8000 mil custom media size;
- Apple installs a WKScriptMessageHandler named `PrintBridge`; iOS/iPadOS prints through `UIPrintInteractionController` and macOS through `NSPrintOperation`, both using the same 5.5 × 8 inch geometry;
- PWA/web keeps the shared PRINT button and falls back to `window.print()`; the PWA build copies the shared assets byte-for-byte and its smoke test now checks the print markers, Apollo page size, and neutral-gray unlit EL rule;
- `tools/cheatsheet-smoke.js` now guards Android + Apple bridge installation/teardown, 5.5 × 8 inch media geometry, print-all-sections CSS, and neutral unlit EL color.

Verification performed in this environment:

- [x] changed shared JavaScript parses successfully;
- [x] changed shared CSS has balanced structure;
- [x] updated PWA smoke JavaScript parses successfully;
- [x] Apple source contains the expected native print bridge and 5.5 × 8 inch media geometry;
- [x] Apple source has been compiled with Xcode at this exact revision; current bundle/source byte comparisons are recorded above.
- [x] PWA `build-site.sh` has been executed at this exact revision; current package/parity smokes are recorded above.
- [x] Android canonical Gradle build has completed at this exact revision; APK verification and emulator results are recorded above.
- [ ] Android native print flow has been exercised on-device;
- [ ] iPhone/iPad/macOS native print flow has been exercised on-device.

The File Store contains Android SDK/build-tools/signing material used for test-package work, but there is still no complete current recursive checkout plus offline Android Gradle Plugin 9.3.0 cache in the execution container. Do not call this a canonical source build until `bash tools/build-local.sh` succeeds from the exact branch HEAD.

## 2026-10-02 CM-only product scope

Ryan clarified that the Android app is Command Module only. This supersedes the 2026-10-01 selectable LM/CM behavior: removed the mission selector and LM face, force-normalize old mission preference storage to Comanche055, default the core to Comanche055, use the CM-only PIPA scale, and keep CM sextant/navigation inputs available. Gradle and APK verification now stage/require only pinned `yaAGC.wasm` + `Comanche055.bin` and reject a packaged Luminary rope. Diagnostics, host runtime coverage, device-smoke contracts, and current build guidance now describe CM-only behavior. At the time of that product-scope change the upstream WASM still had its LM default; the new CM peripheral-mode rebuild is recorded at the top of this file.

Validation so far: `env TZ=UTC bash tools/run-source-smokes.sh` passed (92 Node smokes plus `ntp-time-smoke.sh`). `node tools/wasm-runtime-smoke.js` passed against the real pinned WASM and Comanche rope: V16N65, P00 relay 11 `01265`, V35 relay 12 `00650`, and MARK/KEYRUPT2 consumption. All six Android variants and packaged APK verification are pending.

CM-only verification completed: local Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assemble` succeeded for all six Regular/Fire debug, installfix, and unsigned release variants. Regular and Fire debug APKs passed `tools/verify-apk.sh`; `unzip -t` passed on all six APKs, and each contained Comanche055 while none contained Luminary099. The canonical `bash tools/build-local.sh` guard was attempted and stopped before Gradle because it requires a clean working tree; the equivalent pinned Gradle build and the full `env TZ=UTC bash tools/run-source-smokes.sh` both succeeded against the current source. `adb devices -l` reported no attached devices, so packaged Android/WebView behavior remains unverified. The unsigned release APKs are build outputs only, not signed update artifacts.


## 2026-10-02 Android emulator audit continuation

The current signed Regular `.eltest` APK was installed and exercised on an Android 36 Google APIs ARM64 emulator (Pixel 5 AVD, WebView 133.0.6943.137). Artifact SHA-256: `751b934bd82ed0706764d919fb2a5d472016937d5f26e1c37cda98d1e457efb2`; the device smoke recorded source commit `00be5cda83a7af02bd990296d1f43f875d7c43b3`. The existing earlier note that no Android device was attached is historical and is superseded for this emulator run.

`ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh <local-path>` passed: APK install/start and packaged frontend readiness; real CM yaAGC startup; VERB pointer input; two-second PRO hold/release; synthetic hidden/visible lifecycle pause/resume on the same core; real `V37E00E` → P00 relay 11 `01265`; real `V35E` all-8 display, relay 12 `00650`, and raw channel 011 / 0163 correspondence; page reload with a newly constructed core; and Android process force-stop/relaunch with a fresh running CM core. The process gate proved PID absence between processes and persisted CM/AGC state restoration.

Audit fixes to device test infrastructure: synthetic PRO `pointerup` is now sent to its captured button (synthetic events do not invoke browser pointer-capture retargeting); the VERB smoke releases its key instead of leaving the matrix contact down; V35 key taps hold each contact for 90 ms so the real AGC scheduler can sample it before KEYRST; and the process-recreation gate tolerates `pidof` returning 1 for the expected no-process state and waits two seconds for WebView localStorage's asynchronous disk commit before force-stop. This changed the smoke harness, not the APK's application code.

Still unverified on Fire OS or a physical target: actual OS screen-off/on, display fit/orientation, physical PRO standby behavior, DreamService startup/touch delivery through Android DreamManager, DREAM brightness/SOLAR, and first-use location permission. The host gesture smoke passes; actual DreamManager delivery remains unverified because the Android 16 emulator has no DreamManager service. Android 16 emulator screen-off/on passed; see the 2026-10-02 lifecycle audit above.

Landscape controls layout follow-up: the interactive DSKY now remains on the left while its auxiliary controls panel is docked to the right. In the closed state the panel is translated over the DSKY and hidden; opening the existing long-press control state animates it rightward from the DSKY edge. The layout smoke checks the row composition, DSKY viewport sizing, hidden/open transforms, and transition. Android 36 emulator screenshots confirmed the DSKY-only and open-panel compositions fit in landscape. `node tools/display-layout-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (92 Node + 1 shell), `:app:assembleRegularDebug`, APK verification, and the full device smoke passed at source commit `00be5cda83a7af02bd990296d1f43f875d7c43b3`; APK SHA-256: `d0a174b5285d846231509facb06e593cff81cd75f8c31d317fe24767955b557a`. The device smoke package is debug-signed and is not update-compatible with the established release-signed client APK.

Follow-up landscape screenshot review found that `index.html` applied `#app{padding:2px!important}`, overriding the CSS safe-area/top padding. Removed that redundant inline rule and changed DSKY sizing to fit within the same top and bottom inset budget used by the row container. The display-layout smoke now rejects the overriding rule and checks the height calculation. `node tools/display-layout-smoke.js` and the full `env TZ=UTC bash tools/run-source-smokes.sh` passed. All six Regular/Fire debug, installfix, and unsigned release variants built with Gradle 9.5.1; the Regular Debug APK passed `tools/verify-apk.sh` and `tools/device-full-smoke.sh` on the Android 36 emulator. Its live WebView measured the DSKY at y=12..385 in a 393-pixel viewport, with the whole faceplate inside the top/bottom insets. APK SHA-256: `e36db0cc9771659d678eb8a8808d4afe89488234074e199d95022a183249fba1`. PWA files staged under `<temporary-path>` passed `pwa/tools/pwa-smoke.js`; the staged `controls-layout.css` byte-matches the shared CSS, and the transformed PWA index has no padding override. This verifies local source and package behavior; the hosted `ryanbytes.github.io` page has not been published with the fix.

Updater audit found that release metadata success was being timestamped before downloading and verifying a newer APK; transient download failures then scheduled a retry that the 12-hour successful-check window suppressed. The timestamp and retry cancellation now happen only after an up-to-date/no-release decision or after the APK has passed digest and installed-signer/package/version checks and is saved as pending. Incomplete update attempts retain the 30-minute attempt throttle. `node tools/self-update-smoke.js` and the full source suite passed; Gradle 9.5.1 `:app:verifyPinnedAgcAssets :app:assemble` built all six variants; Regular and Fire debug APKs passed `tools/verify-apk.sh`; `:app:lint` succeeded with 13 warnings and no errors. The updater remains disabled in debug builds, so the new retry branch was verified by source policy and build, not a live release-channel retry.

The CM core source/host gates already required `configure_cm_mode()` and `get_cm_mode() == 1`, but live Android/WebView smoke did not read that value back. Startup, packaged-page recreation, and process-recreation device drivers now assert the running core's actual WASM export returns CM mode `1`; the package-policy smoke locks all three checks. `node tools/device-package-policy-smoke.js` and `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` passed on the Android 36 emulator. Output reported CM mode `1` at startup, after page reload, and after process recreation; all existing input, P00, V35, and fresh-core checks also passed. Tested APK SHA-256 after the latest updater cleanup: `a94b610d6dedae4e26963c5939bd8dfd62ed19936020f6c71505d213fc829b92`.

Updater transport review found `fetchLatestRelease()` and `downloadText()` disconnected only after successful body reads (release HTTP 404 had its own special-case cleanup). Both methods now disconnect in `finally`, covering non-200 responses and parse/read exceptions. `node tools/self-update-smoke.js` and all 92 source smokes passed; Gradle `:app:verifyPinnedAgcAssets :app:assemble` built all six variants; Regular and Fire APKs passed `tools/verify-apk.sh`; the Regular Debug APK passed `tools/device-full-smoke.sh` including live CM-mode checks. `:app:lint` has not been rerun after this small Java cleanup; the previous lint run succeeded with 13 warnings and no errors.

Landscape screenshot review found that the closed auxiliary panel still participated in `#app`'s flex row, shifting the DSKY left by roughly half the panel width even though the panel was invisible. The landscape panel is now absolutely positioned and anchored to the centered DSKY's right edge, retaining its existing translate-to-open behavior and safe-area top alignment. Merged PR #208 as `a01f1cc404be9e5554949168ad5dc8e25914659c`; PWA run 37056171511 deployed successfully, and a fresh HTTP 200 fetch of the hosted CSS confirmed the centered anchor and slide-out rules. `node tools/display-layout-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (92 Node smokes plus the NTP shell smoke), `bash pwa/tools/build-site.sh`, and `node pwa/tools/pwa-smoke.js` passed. Canonical `ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} bash tools/build-local.sh` passed on the merged commit, building and verifying Regular and Fire debug APKs. The Regular APK (`ff56def9ec2fcf40868baeb2ac30796ad61f076ed0c7252556573198d7a70a85`) passed the full Android 36 emulator smoke, including CM mode, input/PRO, P00/V35, page recreation, and process recreation. Its first V35 attempt missed the transient channel/lamp sampling window; an immediate full retry passed on the same APK. The Fire debug APK was built and verified but not installed on Fire OS. Landscape pixel verification remains outstanding: this emulator's installed app is portrait-locked, and Chrome's first-run screen prevented using its browser for the PWA screenshot in this run.

### 2026-10-02 PWA browser runtime check

Built PWA assets served from a temporary directory loaded in a local Brave/Chromium session. The page rendered and loaded pinned Comanche055 (`2020-12-24 ddc65e7`) with CM mode readback `true`; snapshot metadata reported 327,680 bytes. The first fast-tap/direct-AGC attempt was inconclusive. Repeating through the normal Clock-to-AGC first-key handoff with the Android driver’s 90 ms contact hold reached P00 (`PROG 00`, relay 11 low-11 `01265`), then latched V16N65 with exact Pinball channel-015 codes `021, 001, 006, 037, 006, 005, 034`. V16N65 produced numeric `+00000` output with OPR ERR clear. This verifies the live local PWA → real WASM/Comanche → DSKY input/display path in the browser; it does not verify the hosted deployment or a physical phone browser. The only console error was the temporary Python server's missing `/favicon.ico` response.

### 2026-10-02 PWA service-worker install and offline audit

The first live service-worker check found `AGCDSKYPWA.serviceWorker === 'registered'` but no active worker and `offlineReady === false`. Root cause was a duplicated precache list: `REQUIRED_SHARED_ASSETS` explicitly listed six hardware files and the build generator also inserted all shared assets, including those six. Chromium confirmed `Cache.addAll()` rejects duplicate normalized request URLs, leaving installation incomplete. The source now deduplicates the full `CORE_ASSETS` list with `Set`; the PWA smoke executes the install event and rejects duplicate precache URLs, in addition to checking the required cached files.

Validation: `node --check pwa/tools/pwa-smoke.js`, `node --check pwa/static/sw.js`, `bash pwa/tools/build-site.sh <temporary-path>`, and `node pwa/tools/pwa-smoke.js <temporary-path>` passed. In a fresh Brave/Chromium profile, the worker activated, `offlineReady` became true, and a reload with network disabled loaded the PWA. With the network still disabled, the real Comanche055 core reached P00 (`PROG 00`, relay 11 low-11 `01265`) and read back CM mode `1`; the page reported no runtime errors. The existing untracked `pwa/dist/` was not used or changed.

### 2026-10-03 Packaged Android landscape layout verification

The previously noted landscape pixel-verification gap is now covered on the Android 36 emulator. The installed `org.apollo.agcdsky.eltest` package is `1.1.62-eltest`, SHA-256 `cf2322f6cd47e8eadc4f690e8e9545493d27b42b2408ac7e922e4b4b385a4017`; packaged `assets/controls-layout.css` and `assets/index.html` byte-match this worktree. With the emulator temporarily set to landscape, the WebView reported a 466 × 262 CSS-pixel viewport (1280 × 720 screenshot pixels).

- With controls hidden, the DSKY was horizontally centered and the complete faceplate fit within the landscape viewport.
- The actual long-press gesture opened the panel to the DSKY's right; the DSKY shifted left and the full control panel remained in bounds.
- Opening AUX showed both QUICK REF and SOURCE menu items fully inside the viewport; the popup fit above AUX without clipping.
- Screenshots were captured from the packaged WebView at `<temporary-path>`, `<temporary-path>` (panel open), and `<temporary-path>`.
- `node tools/display-layout-smoke.js` and `env TZ=UTC bash tools/run-source-smokes.sh` passed (98 Node tests plus the NTP shell smoke). `git diff --check` passed.

The emulator's original `accelerometer_rotation=1` and `user_rotation=1` settings were restored, returning the app to its prior portrait presentation; the temporary ADB DevTools forward was removed. This is packaged emulator/WebView evidence, not physical handset or EL-panel verification.

### 2026-10-03 Apple target build check

Xcode 27.0 Debug builds succeeded for the `AGCDSKYmacOS` and `AGCDSKYiOS` schemes using separate temporary DerivedData directories and `CODE_SIGNING_ALLOWED=NO`. Both bundles contain all 72 shared Android web assets byte-for-byte plus only the expected pinned `yaAGC.wasm` and `Comanche055.bin` files; both pinned files also matched their source byte-for-byte.

The macOS app opened and rendered the packaged DSKY through `agcdsky://app/index.html`. A manual pointer-driven `V37E00E` attempt ended at a blank register with OPR ERR; this did not establish whether the failure was in the app runtime or the input gesture, so macOS AGC runtime remains unverified. iOS Simulator execution is blocked by the installed CoreSimulator 1051.55.0 being older than the Xcode-required 1171.7.0; physical Apple runtime remains unverified.

### 2026-10-03 Published APK source-freshness audit

At the time of this snapshot, GitHub's latest release was v1.1.62, published 2026-10-01, from tag commit `94e71781f14c6e43599443cd45ea5bb7b56c99c8`; `main` was 100 commits ahead at that checkpoint. The published Regular and Fire APKs were downloaded and their SHA-256 values matched GitHub's asset digests: Regular `6961770c6d788a1ed8ccc7f1c9f4817d1e99e954ab67b6529eeec0447ce93063`; Fire `58f35d48f0194c1789abd06adbe9a75fd23b2b4302fa638d3468540281de3afb`. Both report package `org.apollo.agcdsky`, version `1.1.62`, versionCode `2026093009`, and the established release signer. Their packaged Comanche055 rope matches the pinned source, and neither contains Luminary099. However, their `yaAGC.wasm` is the older build without the current CM configuration/readback exports, and their frontend assets do not byte-match current source (including the missing `dsky-solo.css`). The refreshed commit distance is recorded below.

Current `main` still declares version `1.1.62` / versionCode `2026093009`. `AppUpdater` compares the latest release tag to the installed `BuildConfig.VERSION_NAME` and reports up to date when the release version is equal. Therefore, an existing v1.1.62 installation will not be offered the newer mainline app until a distinct version is published. This is a release freshness gap; no new release was built, signed, or published during this audit. Before release, increment version metadata, build and verify both signed APKs locally with the established key, then publish only those verified artifacts through the existing release-only process.

### 2026-10-03 published release freshness recheck

Queried GitHub again: v1.1.62 remains the latest release, published 2026-10-01 from `94e71781f14c6e43599443cd45ea5bb7b56c99c8`; current `origin/main` is `cfd65b95107176c11413325fbcaf1dfac9ff3e72`, 134 commits beyond that tag. Re-downloaded both public release APKs. Their hashes still match GitHub's asset digests; `aapt2` reports both as `org.apollo.agcdsky` v1.1.62 / versionCode 2026093009, and `apksigner` verifies v2/v3 with the established certificate. Comparing the 72 current shared assets against each release APK found 1 missing asset (`dsky-solo.css`) and 30 byte-different assets.

`AppUpdater` returns “up to date” when the release tag version is less than or equal to `BuildConfig.VERSION_NAME`; its package check also rejects an APK whose versionCode is not greater than the installed package. Since the live release and current source still share v1.1.62 / 2026093009, existing installs cannot be offered the current mainline package by the updater. This is a confirmed release-freshness limitation, not a new runtime-source defect. Keep the audit release hold; when release work resumes, increment both version identifiers before producing/signing client APKs. No release or signature operation was performed during this recheck.

### 2026-10-03 CM annunciator documentation check

Cross-checking the CM-only face (`index.html`, `dsky-mapping-smoke.js`) against channel-010 relay-12 projection (`agc-display-runtime.js`) found that the implementation notes overstated the visible lamps. The relay decoder retains all six Apollo-11-era condition bits, but the CM face renders only NO ATT, GIMBAL LOCK, TRACKER, and PROG; ALT and VEL remain deliberately absent from the CM projection. Corrected `docs/IMPLEMENTATION_NOTES.md` to state this distinction. No runtime code changed.

### 2026-10-03 Network and data-egress source audit

Inventoried network-capable calls in Android shared assets/native code, PWA code, and the analytics Worker. Android WebView networking is blocked and its CSP allows only same-origin connections; the native network clients are the documented Cloudflare SNTP requests and GitHub release discovery/downloads. Shared JS fetches packaged WASM/rope, legal text, diagnostics assets, and same-origin manifest time only. The PWA service worker handles only same-origin GET requests; optional analytics is a separate injected endpoint and the deployed endpoint remains disabled per the deployment audit above. The Apple bridge/source policy and Android manifest/CSP checks were included in the canonical source suite.

Validation: `env TZ=UTC bash tools/run-source-smokes.sh` passed on current `main` (98 Node smokes plus `ntp-time-smoke.sh`), including manifest/network policy, strict CSP, Apple bridge, PWA, and real pinned Comanche055/WASM checks. This is source/policy evidence, not a packet capture of every OS/runtime request. The analytics Worker's Cloudflare account-level deployment and protections remain uninspected; telemetry stays disabled.

### 2026-10-03 PWA build destination preservation audit

The PWA builder previously ran `rm -rf "$DEST"` and `rsync --delete` on its caller-supplied output path. That could erase unrelated files, including the existing untracked `pwa/dist/` in this checkout. The builder now rejects repository/source roots, symlink destinations, and populated destinations by default; explicit `--replace` is accepted only for a directory bearing the marker written by a successful prior build. Removed `rsync --delete`, documented the replacement rule, and added `tools/pwa-build-site-safety-smoke.js` to the canonical source suite. The pre-existing `pwa/dist/` and `.playwright-cli/` were left untouched.

Validation: the new destination-safety smoke passed. `pwa/tools/build-site.sh --replace <temporary-directory>` replaced only a marked temporary fixture; `node pwa/tools/pwa-smoke.js <temporary-directory>` and `node pwa/tools/pwa-parity-smoke.js <temporary-directory>` passed. The full `env TZ=UTC bash tools/run-source-smokes.sh` passed with 99 Node tests plus `ntp-time-smoke.sh`, including real pinned Comanche055/WASM semantic checks. `git diff --check` passed. An existing populated destination without this builder's marker is intentionally preserved and must be moved/cleared manually before rebuilding there.

GitHub verification after merge: PR run `37125817003` passed the complete PWA build job. Main push run `37125866341` passed both the build and GitHub Pages deployment jobs. A fresh no-cache request to the deployed `index.html` returned HTTP 200; the deployed `sw.js` uses cache version `c6078496111f`, matching the main merge commit. This verifies PWA CI/deployment, not a physical phone-browser install.

### 2026-10-03 DSKY relay-class primary-source cross-check

Inspected AC Electronics ND-1021042 Rev. F, Volume II, §§4-5.10–4-5.10.2 (printed pp. 4-648–4-649). The manual says the CMC main and navigation DSKYs are electrically identical/interchangeable; all relays associated with the display relay matrix are latching; status/caution-circuit relays are non-latching. The existing model keeps channel-010 display-word latches separate from channel-driven auxiliary status/caution state, consistent with that distinction. This confirms system-level relay class behavior, but the section gives no individual production relay operate/release/bounce timing. Exact timing for production parts 2004688-1/-2 and 2004689-2 therefore remains unresolved; predecessor SCD timing values remain presentation references only. No runtime behavior or timing values changed.

The manual was downloaded from the Virtual AGC document archive and its extracted text was checked directly at §4-5.10. `git diff --check` passed. No APK was built, signed, or published; release remains on hold until the audit is complete.

### 2026-10-03 updater and DreamService source audit checkpoint

Reviewed the native updater, retry policy, APK content provider, startup/periodic receiver path, and Android DreamService lifecycle. The updater requires a SHA-256 match, same package, a greater installed versionCode, and matching signing-certificate identity before it records an APK as pending; background discovery/download does not directly open installer or permission UI. Its APK provider is declared non-exported and grants read access only to the system-installer handoff. This pass found no source change to make.

The updater's structural source smoke and executable Java retry-policy smoke passed. The Dream AGC runtime, Dream interaction, Dream clock-mode, and orientation smokes passed. These establish source/host behavior only: the updater is disabled in debug builds, so no live installer handoff was exercised, and the Android 16 emulator lacks DreamManager, so real Dream startup/touch/brightness behavior remains open. No APK was built, signed, or published; the release hold remains active.

Validation: `node tools/self-update-smoke.js`, `node tools/update-retry-policy-smoke.js`, `node tools/dream-agc-runtime-smoke.js`, `node tools/dream-interaction-smoke.js`, `node tools/dream-mode-smoke.js`, `node tools/dream-orientation-smoke.js`, and `git diff --check` passed.

### 2026-10-03 lifecycle-fix integration audit checkpoint

Reviewed and integrated the lifecycle/input fixes from the older open PR #200 against current `main`. This comparison found real integration defects before they could reach users: the PHONE CLOCK generation guard called the slot getter but not the returned queue runner, which would strand a restarted relay queue; an operation-authority smoke had invalid JavaScript quoting and prevented the canonical suite from parsing; and the new sextant cancellation smoke omitted its mission fixture, making valid CDU input fail. Corrected each issue and added regression checks for queue restart/drain, stopping relay show during preflight, and cancelling tap-to-MARK during CDU pulse settling. Also retained current-main WebView main-frame permission checks and per-scene idle-timer behavior during conflict resolution.

Validation passed: `env TZ=UTC bash tools/run-source-smokes.sh` (100 Node smokes plus NTP shell smoke, including pinned Comanche V16N65/V05N09/V14N09/V35 and MARK checks); PWA build, smoke, and 72-asset parity; Xcode 27 Debug builds for macOS and iOS Simulator plus 72-asset parity; Android Regular and Fire debug builds, lint, and APK verification; and `ANDROID_SDK_ROOT=/Users/ryan/Library/Android/sdk bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk` on the Android 16 emulator. The device gate passed packaged WebView startup, pointer/key input, held-PRO lifecycle behavior, Comanche display/relay semantics, page reload, and force-stop/relaunch with fresh core and restored state. `git diff --cached --check` passed and no merge markers were found. Pre-existing untracked `.playwright-cli/` and `pwa/dist/` were preserved.

This checkpoint uses debug-only APKs and does not constitute a release. Audit remains open for Fire OS/physical Android, real DreamManager and sleep/wake on target hardware, physical Apple WebKit/haptics/printing, any historical manually deployed analytics Worker/D1 resources, and production relay-part timing. The iOS Simulator could not be launched because the installed CoreSimulator runtime is older than this Xcode's requirement; macOS interaction was inconclusive and remains unverified.

### 2026-10-03 deployed PWA offline DSKY command recheck

Repeated the hosted PWA offline AGC test after an initial fast pointer-entry attempt showed OPR ERR. That first attempt was inconclusive: it did not follow the slower live-device input cadence and its diagnostic readout showed zero FAILREG words. With the active service-worker cache and network disabled, entered V36E, waited 15 seconds, entered P00, then entered V16N65E and V05N09E using deliberate pointer contacts. The DSKY stayed responsive; V16N65 showed three `+00000` words and V05N09 showed three `00000` octal words. OPR ERR remained clear. Diagnostics read back `FAILREG 00000 / 00000 / 00000` and channel 0163 `00020` (KEY REL, with the OPR ERR bit clear). The initial OPR ERR was not reproduced, so this test did not establish a product defect.

Restored the test tab to CLOCK mode, cleared only the snapshot created by this test (the tab started with no saved snapshot), verified diagnostics reported `Saved AGC snapshot NONE`, restored browser networking, and closed the isolated tab. This is hosted Chromium/browser evidence; physical phone-browser input remains unverified. The canonical `env TZ=UTC bash tools/run-source-smokes.sh` passed on current `main` (100 Node tests plus `ntp-time-smoke.sh`, including the real pinned Comanche055/WASM V16N65, V05N09, V14N09, P00, V35, and MARK gates). No product code changed.

### 2026-10-03 diagnostics self-test result audit

A source-sink review found that the diagnostics self-test successfully verified the pinned Comanche055 rope at `SELF_TEST_ASSETS[1]` but then reported the size from nonexistent `SELF_TEST_ASSETS[2]`. The resulting `TypeError` made a valid rope check show as failed in the user-visible diagnostics panel. Corrected the detail string to use the verified rope's own manifest entry and added a regression that requires the fetch and size report to use index 1 and rejects an out-of-range index. Confirmed the repository rope is exactly 73,728 bytes with Git blob SHA-1 `9e4ec167dc99ac12b233df07b6b91fef585e5015`.

Validation: `node --check app/src/main/assets/diagnostics.js`, `node --check tools/diagnostics-self-test-smoke.js`, `node tools/diagnostics-self-test-smoke.js`, `env TZ=UTC bash tools/run-source-smokes.sh` (100 Node tests plus NTP shell smoke), PWA build/smoke/parity on `/tmp/agcdsky-audit-diagnostics-mainbase-20261003`, and `git diff --check` passed. `ANDROID_SDK_ROOT=/Users/ryan/Library/Android/sdk bash tools/gradle-bootstrap.sh --no-daemon :app:verifyPinnedAgcAssets :app:assembleRegularDebug`, `tools/verify-apk.sh`, and `tools/device-full-smoke.sh` passed. The isolated Regular debug APK SHA-256 was `f5d9149016d780fa4fd35c90c32121157a145a90d31cf7d693070c7713e80a33`; the full Android 16 emulator gate passed including V16N65, V05N09, V14N09, V35, page recreation, and process recreation. No release APK was signed or published.

Running all 15 diagnostics checks on deployed Pages exposed a second stale assertion: 14 passed, while “Key tactile model” failed because diagnostics expected an older enabled-key-haptic policy. The current tactile service and its dedicated smoke confirm normal key make/release haptics are deliberately disabled, with only an explicit diagnostic test pulse and separate relay haptics. Updated diagnostics to compare against the current service policy and extended both diagnostics and tactile-service regressions. On a fresh local PWA build in Chromium, all 15 diagnostics checks then passed, including Comanche rope (`73728 bytes · pinned Git blob SHA-1 verified`) and the current tactile policy. The focused diagnostics/tactile smokes and full 100-Node source suite passed, as did PWA build/smoke/72-asset parity. The updated Regular debug APK passed `tools/verify-apk.sh` and the full Android 16 emulator gate; SHA-256 `6ad6b06a9ac6a7ff0fb25eab4964679376c08eebdd7edf9f81d15348fcf2ea4e`. PR #232 merged as `8dd13e876a8a41dbf88d8e105ed0cb388110643d`; the PWA and Apple workflows passed and Pages deployment succeeded. After reloading the public site, the actual Diagnostics UI passed 15/15, including the Comanche rope and current tactile policy.

### 2026-10-03 analytics feature removal

Removed the PWA analytics client, its endpoint/build-time configuration and external CSP allowance, its service-worker precache entry, the Cloudflare Worker/D1 schema/deployer, and the manual GitHub deployment workflow. The PWA privacy policy now says that no usage events or analytics identifier are created; it documents only the same-origin resources and HTTP-Date clock fallback. PWA build and parity smokes now require the analytics script and cache entry to be absent and require `connect-src 'self'` only. Android's existing privacy policy already stated there is no analytics integration and needed no change. Historical audit entries above remain as records of the removed feature.

The source tree contains no analytics service or deployment path. This does not prove that an independently/manual deployed Cloudflare Worker or D1 database is absent or that any previously collected records were deleted; no Cloudflare account identity or credentials were available in the repository configuration. Verify the next Pages deployment and handle external resource/data removal with the owner before claiming remote analytics storage is gone. No APK/release was built or published.

### 2026-10-03 Apple simulator runtime recheck

The current Xcode host now has Xcode 27.0 and an iOS 26.5 runtime, so the earlier CoreSimulator version mismatch no longer blocks a simulator build. From the exact `origin/main` tree at merge commit `e62e1914ae07944d5d15331816f57e0e013a2817`, `apple/tools/verify-pinned-assets.sh` passed. `xcodebuild` built both `AGCDSKYiOS` for an iPhone 17 Pro simulator and `AGCDSKYmacOS` into isolated `/tmp/agcdsky-*-audit-20261003` DerivedData directories. `tools/verify-shared-frontend-parity.py` confirmed all 72 canonical shared assets are byte-identical in each built bundle.

Installed and launched the iOS Debug app on the iPhone 17 Pro / iOS 26.5 simulator. The native debug bridge recorded main-frame origin `agcdsky://app`, `debug bridge installed at document start`, and `ready: app`; its launch log contained no JavaScript error, unhandled-rejection, or CSP-violation event. A simulator screenshot at `/tmp/agcdsky-ios-audit-20261003-launch.png` visibly shows V16N65 and numeric DSKY registers. This proves packaged-page startup and first rendering on this simulator, not AGC command entry, physical iPhone behavior, camera/location permission behavior, haptics, or native printing. The simulator was shut down after the check. No source/runtime code changed, no APK was built, and no release was created.

### 2026-10-03 responsive controls-menu runtime recheck

Rebuilt the PWA at `/tmp/agcdsky-layout-audit-20261003`; the PWA package smoke and 72-asset parity smoke passed. `node tools/display-layout-smoke.js` passed. In Playwright WebKit 26.6, inspected the rendered page at portrait 402×681, 360×640, and 320×568, and landscape 844×402 and 640×360. At 320×568 the opened auxiliary menu and its two actions remained inside the viewport, the document stayed 320×568 without page overflow, and the PROCEDURES / QUICK REF action opened the checklist successfully. At 640×360 the closed DSKY x-position was 185.59 px versus a centered x-position of 185.60 px; when open, DSKY and control panel together spanned x=62–578, centered in the viewport, with the DSKY face between y=12 and y=324.5. The 844×402 open landscape layout likewise placed the DSKY left of the controls and kept the full menu inside the panel. No application layout defect was reproduced in these browser viewports.

The screenshot operation in the Playwright CLI emitted `style-src-elem` / inline-style CSP reports; after resetting the page listener, viewport changes and menu interactions produced no CSP event. Treat those reports as automation screenshot-path noise, not as evidence of an application runtime violation. `adb devices -l` currently lists no attached Android device, and neither Android SDK environment variable is set on this host; the browser check is not Android WebView or physical-device proof. No source/runtime code changed, and no APK or release was built.

### 2026-10-03 current-main source and Android lint recheck

The tracked application tree in this checkout byte-matched `origin/main` at `f1bb41b`. `env TZ=UTC bash tools/run-source-smokes.sh` passed all 100 canonical Node smokes and the NTP shell smoke, including the pinned Comanche055/WASM V16N65, V05N09, V14N09, P00, V35, and MARK paths. A fresh `ANDROID_SDK_ROOT=/Users/ryan/Library/Android/sdk bash tools/gradle-bootstrap.sh --no-daemon :app:lint` completed successfully. The generated FireDebug lint report contains 11 warnings and zero errors: API-level XML attributes, `@TargetApi` guidance, and JavaScript-enabled WebViews. JavaScript is required by the packaged frontend; the reviewed Android WebViews disable general network/file/content access and use the packaged-asset origin policy. No new application defect was demonstrated by this pass.

`adb devices -l` reported no attached device. This pass therefore adds source/runtime-host and Android lint evidence only; physical Android/Fire behavior, Apple hardware behavior, production relay timing, and externally managed analytics resources remain open. No APK, signed package, or release was produced.

### 2026-10-03 native widget and Fire redirect source audit

Reviewed the native EL home-screen widget renderer, size calculation, API-31+ fixed-frame flippers, pre-31 raster fallback, minute-boundary scheduling, and resize/time/package update paths. Reviewed Fire Mode enable/disable state, package-specific boot intent, launcher-event filtering, redirect debounce, and the guarded Fire HOME setup script. Focused `node tools/el-widget-smoke.js`, `node tools/el-widget-labels-smoke.js`, `node tools/fire-home-setup-smoke.js`, and `node tools/manifest-policy-smoke.js` all passed. No source defect was demonstrated. This is source and host-smoke evidence only: native widget appearance and real Fire OS boot/HOME behavior remain unchecked on hardware. No APK or release was produced.

### 2026-10-03 canonical clean build of current main

Created a separate clean worktree at exact `origin/main` commit `5c98d74784d090ccb370fcd1b5c6e9a72e41aad0`, initialized the recursive `vendor/webAGC` submodule at its required pinned commit, and ran `ANDROID_SDK_ROOT=/Users/ryan/Library/Android/sdk bash tools/build-local.sh`. The canonical gate passed all 100 Node source smokes plus the NTP shell smoke, Gradle 9.5.1 checksum-verified bootstrap, Android platform 37 / Build Tools 36.0.0 checks, clean Regular and Fire debug builds, and `tools/verify-apk.sh` for both APKs. Independent `unzip -t` checks found no archive errors. SHA-256: Regular `f70157a47f6f211d00fc8d34757f70b7588ec01f1c977f9bca229bdeb16d141a`; Fire `143c712e143e39c327b5ddbd99a783fe7376315ce254f2c5bdda2dad698c2b60`.

Then `ANDROID_SDK_ROOT=/Users/ryan/Library/Android/sdk bash tools/gradle-bootstrap.sh --no-daemon :app:verifyPinnedAgcAssets :app:assemble` passed and assembled all six Regular/Fire debug, installfix, and unsigned release APKs. `unzip -t` passed on each archive, and `apksigner verify --verbose` passed for both installfix APKs. `aapt2 dump badging` on both release outputs reported the source version `1.1.62` / `2026093009`. The release outputs remain unsigned local build artifacts; nothing was signed or published.

`adb devices -l` returned no attached targets, and this SDK installation has no emulator executable, so no install/runtime gate ran against these exact APKs. The canonical build blocker is closed; physical Android/Fire behavior, Apple hardware, widget appearance, print flows, DreamManager behavior, and the remaining external accuracy items are still open. No client release was signed or published.

### 2026-10-03 current-source Apple build and simulator launch

`bash apple/tools/verify-pinned-assets.sh` passed. With Xcode 27.0, built `AGCDSKYmacOS` for macOS and `AGCDSKYiOS` for an iPhone 17 Pro / iOS 26.5 simulator in separate `/tmp` DerivedData directories, with signing disabled. `tools/verify-shared-frontend-parity.py` passed for both bundles; all 72 shared assets were byte-identical to `app/src/main/assets`.

Installed and launched the iOS Simulator build. The debug bridge logged main origin `agcdsky://app`, installation at document start, and `ready: app`; its launch log contained no JavaScript error, unhandled-rejection, or CSP event. Cold-launch captures show a black WebView at about 1 second and the complete centered DSKY by 3 seconds; the runtime eventually renders, but the debug readiness event precedes the first captured painted DSKY. This is simulator startup evidence, not proof of physical iPhone behavior or DSKY command input. The simulator was shut down after the check. The macOS target was built but not freshly launched/interacted with; its previous interaction result remains inconclusive. No app source changed, and no release was created.
