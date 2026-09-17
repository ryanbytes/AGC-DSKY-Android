# DSKY runtime refactor — Phase 82

Date: 2026-09-17
Branch: `refactor/dsky-runtime-phase82`
Base: `refactor/dsky-runtime-phase81`

## Goal

Remove internal runtime/input dependence on the public `window.AGCDSKY` facade while preserving the stable public facade and existing DSKY behavior.

## Production changes

### `runtime-transitions.js`

The transition coordinator now consumes its real owners directly:

- `window.AGCDSKY_SERVICE_REGISTRY`
- `window.AGCDSKY_LIFECYCLE`
- `window.AGCDSKY_CORE_SESSION`

It no longer uses `AGCDSKY.lifecycle`, `AGCDSKY.appStatus()`, or `AGCDSKY.getCore()` as internal authority. The public facade continues to delegate to the published runtime service without having its method identities replaced.

The existing behavioral contract remains intact:

- one serialized CLOCK -> AGC transition;
- later callers join the owned in-flight transition;
- `requestAgc()` requires a ready AGC and rejects if CLOCK wins;
- CLOCK requested during AGC loading is deferred until the active load settles, then wins;
- pre-CLOCK cleanup hooks run before the base CLOCK transition;
- classic `window.enterAgc` / `window.enterClock` shims remain absent.

### `dsky-input-runtime.js`

The input owner now resolves `AGCDSKY_RUNTIME` from the service registry instead of through `AGCDSKY.runtimeTransitions`.

Preserved behavior includes:

- positive channel-015 key makes only;
- separate KEYRST/release path;
- retained-core KEYRST support;
- maintained PRO contact forwarding;
- AGC-mode/core readiness gating.

## Regression coverage updated

Phase 82 updates the runtime/input authority, CLOCK transition, integration, fallback, PRO, keyboard, cancellation, RSET, late-service publication, and input-runtime smoke fixtures so they model the direct service-owner architecture rather than reintroducing the retired facade dependency in tests.

The integration coverage still requires a physical CLOCK-mode key handoff to join one AGC load, deliver the original Pinball keycode, and finish with one KEYRST.

## Verified CI checkpoint

GitHub Actions run `35229450230` at production/test HEAD `c6ec2d5328b9a923d816f44c0e8bec1b46bfb8f8` passed all of the following stages:

1. canonical source smoke tests;
2. release, EL-test, and unique install-fix APK builds;
3. APK output existence checks;
4. regular and Fire APK signing;
5. side-by-side signature, package, icon, and restored-asset verification;
6. all artifact uploads.

The canonical suite includes the Phase-82 runtime authority, CLOCK transition, transition integration, DSKY input, CLOCK fallback/cancellation, PRO, keyboard electrical, RSET, parallax, and real yaAGC/WASM gates.

## CI artifacts from run 35229450230

- `AGC-DSKY-Android-installable`
  - artifact ZIP SHA-256: `1ec5455af65c2ef686d0af3fc392e75379bdff3db57a222b7bbfb8c6082e87cf`
  - contains `regular/release/AGC-DSKY-regular.apk`
  - contains `fire/release/AGC-DSKY-fire.apk`
- `AGC-DSKY-Android-unsigned-release`
  - artifact ZIP SHA-256: `42cdc2de1604c936a193fbfbfd6841390ba4c0832b01c49c1d20debd2fd25aea`
- `AGC-DSKY-ELTEST-debug`
  - artifact ZIP SHA-256: `00a210fd119ebc36b798fe18ccba0c498c08b1a6a6bcb74db9d9b69e295cd7fa`
- `AGC-DSKY-Regular-installfix`
  - artifact ZIP SHA-256: `91620273702dca91fbeb2e7db5b5d82afec21a0c900fbd722d5d8248e0ae959d`

The downloaded installable artifact was independently hashed after retrieval. Its ZIP digest matched the GitHub artifact digest. Inner APK SHA-256 values were:

- regular: `6a1170b5e95cbfe3a0a223b31db3dad2da5439660bf366c86243a545c74d82e5`
- Fire: `10a8e41fa4f199c57dc537907d80d5811f296c91088a3ffc12f5dde04431205c`

## Scope / remaining acceptance

Phase 82 has source-level and Android CI build verification. It does **not** yet have a physical-device smoke for this phase. Do not describe device behavior as verified until an APK from this phase is installed and exercised on the intended Android/Fire target.
