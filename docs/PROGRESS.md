# AGC DSKY Android progress

Last updated: 2026-08-29

## Goal

Ship a self-contained Android Apollo Block II DSKY with two deliberately separate modes:

1. A synthetic phone clock / charging DreamService presentation.
2. A real AGC mode driven by the pinned VirtualAGC `yaAGC` WebAssembly core and authentic AGC I/O.

AGC mode must never substitute phone traffic, random animation, or other synthetic state for real computer output. The APK must remain offline and must not request `android.permission.INTERNET`. Device location is the only intended external runtime input and is used only for DREAM SOLAR.

## Current source state

### Android shell / offline packaging

- `MainActivity` and `AgcDreamService` use a local synthetic HTTPS asset origin served by `NetClient`.
- WebView network loads are explicitly blocked; file/content access is disabled.
- Navigation is restricted to packaged `/assets/` content.
- A strict frontend CSP allows same-origin scripts/styles/fetches and only the narrow `'wasm-unsafe-eval'` capability needed for WebAssembly.
- CSP violations, JavaScript errors, WebView resource failures, and native failures are routed to the private debug reporter.
- The merged manifest is intended to remain free of `android.permission.INTERNET` and backup is disabled.
- Gradle packages only the verified `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin` inputs from the pinned webAGC submodule.
- The build verifies exact sizes and Git blob SHA-1 values before packaging.

Pinned webAGC revision:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Required binary inputs:

- `vendor/webAGC/src/yaAGC.wasm` — 132,617 bytes — blob `713685680492098d05437b99c26403f683d56009`
- `vendor/webAGC/demo/agc/Luminary099.bin` — 73,728 bytes — blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- `vendor/webAGC/demo/agc/Comanche055.bin` — 73,728 bytes — blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`

### AGC core

`app/src/main/assets/agc-core.js` embeds the pinned yaAGC WASM with the minimal required WASI surface:

- `env.memory`
- `wasi_snapshot_preview1.fd_close`
- `wasi_snapshot_preview1.fd_fdstat_get`
- `wasi_snapshot_preview1.fd_seek`
- `wasi_snapshot_preview1.fd_write`

The wrapper uses `malloc`, `free`, `set_fixed`, `cpu_reset`, `cpu_step`, `packet_write`, `packet_read`, and optional `version`.

The required lazy-I/O-safe startup sequence is:

1. Copy the exact rope through `set_fixed()`.
2. `cpu_reset()`.
3. Disposable `cpu_step(1)` to force ring-buffer/channel-mask initialization.
4. Drain/discard disposable output.
5. `cpu_reset()` again to return to the true mission reset state.
6. Queue U-bit masks for channel `015` and channel `032`.
7. Begin ordinary mission stepping.

Normal DSKY keys use channel `015`; PRO uses channel `032` bit `020000` and remains press-and-hold capable.

Luminary099 is the default LM rope. Comanche055 is selectable. The pinned WASM does not export a setter for upstream `CmOrLm`, so full CM peripheral-mode fidelity is not claimed.

### Lifecycle

- Selected mission and requested AGC/CLOCK mode persist locally.
- Same-WebView app hide/show pauses and resumes the same in-memory core.
- Page/Activity/process recreation restores selected mission/requested mode but starts yaAGC from a fresh reset; CPU/erasable memory is not serialized.
- Device smoke tooling now includes both WebView reload and `adb force-stop`/relaunch state checks.

### Dream / display modes

- DreamService remains display-only and must not start yaAGC.
- DREAM DIM / BRIGHT / SOLAR are persistent modes.
- SOLAR uses saved local coordinates and offline sunrise/sunset calculation with a one-hour smooth transition around each event.
- Polar day and polar night are now distinguished correctly when the `-0.833°` sunrise/sunset altitude is never crossed.
- DISPLAY crop geometry is guarded by a source regression test.

## DSKY relay audit checkpoint — 2026-08-29

The channel `010` display path was re-audited against VirtualAGC `yaDSKY2.cpp`, `piPeripheral/convertNasspLog.py`, Apollo 11 Luminary 99 `T4RUPT_PROGRAM.agc`, and Luminary 99 `PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`.

### Five-relay digit codes

Exact octal codes:

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

The old relay note incorrectly listed digit 4 as `027`; the application code was already using the correct `017`, and the documentation has been corrected.

### Channel 010 selector matrix

- 11 → PROG D1/D2
- 10 → VERB D1/D2
- 9 → NOUN D1/D2
- 8 → R1D1 from the connected right/D field only
- 7 → R1 plus + D2/D3
- 6 → R1 minus + D4/D5
- 5 → R2 plus + D1/D2
- 4 → R2 minus + D3/D4
- 3 → R2D5 + R3D1
- 2 → R3 plus + D2/D3
- 1 → R3 minus + D4/D5
- 12 → Apollo-11-era LM condition-light relays

The decoder now has one table-driven topology. The synthetic phone-clock relay encoder consumes the same selector/sign tables; the former duplicate `CLOCK_GROUPS` topology has been removed.

Plus and minus are latched independently. Rendering follows VirtualAGC behavior and gives plus display priority if both sign relays are asserted.

Unsupported five-bit character patterns are no longer silently rendered as blanks. A malformed relay word is rejected, the last good displayed/latched state is preserved, and one diagnostic is recorded per unique bad word/detail.

### Apollo 11 LM relay-12 lights

Visible low-11 relay bits:

- `00004` VEL
- `00010` NO ATT
- `00020` ALT
- `00040` GIMBAL LOCK
- `00200` TRACKER
- `00400` PROG

All six visible condition lights = `00674` octal.

Relay-12 bits 1 and 2 remain unplacarded/blank for the Apollo 11-14 LM panel. Later Apollo 15-17 LM panels labeled those positions PRIO DISP and NO DAP; this project intentionally keeps the Apollo-11-era layout.

### Other DSKY channels

- Channel `011` bit `00002` → COMP ACTY.
- Channel `011` bit `00004` → UPLINK ACTY.
- yaAGC synthetic/modulated channel `0163` carries TEMP, KEY REL, V/N blanking state, OPR ERR, RESTART, STBY, and EL-off state.

The frontend follows channel `0163` directly in AGC mode. It does not create a second V/N flashing timer on top of yaAGC.

### Relay timing

Luminary 99 T4RUPT confirms:

- normal display service cadence: **120 ms**
- relay-drive / settle phase: **20 ms**
- intervening relay-off phase: **20 ms**
- successive dirty-bank writes in `QUIKDSP`: **40 ms start-to-start**

Phone-clock mode previously delayed every dirty bank by 120 ms. It now uses a 120 ms scan cadence but services an active dirty-bank queue at 40 ms start-to-start with the 20 ms visible settle phase retained.

AGC mode does not impose this synthetic scheduler; it consumes the channel words emitted by yaAGC.

### Verb 35 light test

Luminary 99 source constants confirm:

- `FULLDSP = 05675` → all numerical 8s
- `FULLDSP1 = 07675` → all numerical 8s plus sign
- `TSTCON1 = 00175` → UPLINK ACTY, TEMP, KEY REL, V/N FLASH, OPR ERR
- `TSTCON2 = 40674`; visible relay-12 low-11 state `00674`
- channel 13 bit 10 TEST ALARM drives RESTART/STBY behavior
- `SHOLTS = 0764` → about **5 seconds**

COMP ACTY is not part of the V35 test mask and must remain off unless the AGC itself drives channel `011` bit 2.

yaAGC models DSKY flashing with a **1.28 s period and 75% duty cycle**. During the off quarter it blanks V/N and suppresses KEY REL / OPR ERR.

Clock-mode V35 has been tightened accordingly:

- numerical display and plus signs are generated as real channel-010 relay words and sent through the same decoder as AGC mode;
- the six Apollo-11 LM relay-12 lights use `00674`;
- UPLINK is asserted without COMP ACTY;
- TEMP/KEY REL/OPR ERR/RESTART/STBY use the same frontend state path as AGC mode;
- V/N / KEY REL / OPR ERR use a local four-phase 320 ms modulation only because the synthetic phone-clock mode has no yaAGC engine running;
- test duration is 5 seconds;
- the old direct `88` / force-every-DOM-lamp shortcut is removed.

## Automated verification gates now in source

`tools/dsky-mapping-smoke.js` executes the committed decoder and checks:

- exact five-relay digit codes;
- channel-010 selectors 1–12;
- all 21 numerical positions;
- relay-8 right-only wiring;
- independent signs and plus priority;
- all six Apollo-11 LM relay-12 lights;
- valid blank versus malformed codes;
- malformed-word state preservation / rate-limited diagnostics;
- shared phone-clock/AGC relay topology;
- channel `011`, channel `0163`, channel `015`, and PRO channel `032` mappings.

`tools/v35-model-smoke.js` checks the synthetic V35 relay words, three plus signs, relay-12 mask, COMP exclusion, five-second duration, and 1.28-second/75% flash model.

`tools/wasm-runtime-smoke.js` drives real `V37E00E` then `V35E` through the exact pinned yaAGC WASM and both ropes. The V35 relay gate now requires:

- all 21 numerical positions to be 8;
- plus-sign bits on R1/R2/R3;
- for Luminary099, all six Apollo-11 LM relay-12 condition-light bits.

`tools/build-local.sh` syntax-checks all shell/JavaScript helpers and invokes these source/relay tests before Gradle.

Device tooling includes:

- immediate install/launch/frontend readiness smoke;
- live real-core mission / pointer / PRO smoke;
- live Luminary V35 semantic rendered-display smoke;
- page-reload recreation smoke;
- process-force-stop/relaunch recreation smoke.

## Verification boundary

The relay/code audit above is source-backed and committed. The new source tests and strengthened V35 semantic checks have **not been executed in a complete checkout in this restricted execution environment** because it does not contain Android SDK platform 37 / Build Tools 36.0.0 and the private submodule assets are not mounted into the shell.

Do not report the current revision as built/device-verified until the canonical sequence actually succeeds:

```bash
bash tools/build-local.sh
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

## Remaining device acceptance gates

- [ ] Clean recursive checkout contains and verifies the exact pinned WASM/ropes.
- [ ] Canonical local build and APK verifier pass.
- [ ] APK installs/launches on the target Android/GrapheneOS device.
- [ ] Packaged WASM and selected rope fetch successfully from the offline synthetic HTTPS origin.
- [ ] Real channel `010` rendering is visually correct, including signs, blanks and annunciators.
- [ ] Real V35 end-to-end display/light behavior matches the strengthened relay gate.
- [ ] COMP ACTY visibly follows channel `011` bit 2 and is not forced by V35.
- [ ] Representative Pinball key semantics work through channel `015`.
- [ ] Long physical PRO hold behaves correctly through channel `032` bit 14.
- [ ] Real OS screen-off/screen-on resumes the same in-memory core when the WebView survives.
- [ ] Page/process recreation restores mission/requested mode from a fresh AGC reset.
- [ ] DreamService remains display-only/non-interactive and does not start yaAGC.
- [ ] DREAM DIM / BRIGHT / SOLAR and first-use location permission work on the target OS.
- [ ] DISPLAY crop/scaling is visually correct in portrait and landscape.

## Known limitations / risks

1. **Full CM peripheral fidelity is not claimed.** The pinned WASM exposes no `CmOrLm` setter.
2. **Exact AGC continuation across process death is not implemented.** Only mission/requested-mode state persists.
3. **Device/WebView behavior remains the hard verification boundary.** Source tests cannot prove Android compositor, WebView, permission, DreamService, or physical input behavior.
4. **Private signing key is not committed.** A different local key cannot update an APK signed by the original v5/v6 key without uninstalling first.
5. **Do not use old reconstructed/repacked APKs as current-source proof.** They predate the current relay/runtime/native changes.

## Build policy

Builds remain local/manual. Do not add GitHub Actions, Codespaces, or another hosted build service. The canonical local build can use a system Gradle or the repository's checksum-verified Gradle 9.5.1 bootstrap, but still requires the Android SDK/platform/build-tools locally.
