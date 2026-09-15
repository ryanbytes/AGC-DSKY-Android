# DSKY core runtime service graph

Date: 2026-09-15
Branch: `refactor/dsky-core-service-graph`

## Scope

This refactor converts the core DSKY runtime from parser-global cross-module calls to an explicit frozen service graph. It is intentionally one architectural change rather than a sequence of small extraction phases.

The production dependency direction is now:

```text
AGCDSKY_APP_STATE / AGCDSKY_CORE_SESSION
              |
        AGCDSKY_COMPAT
              |
       AGCDSKY_RENDERER
              |
      +-------+-----------------------+
      |                               |
AGCDSKY_ENVIRONMENT ------------> AGCDSKY_AUDIO
                                      |
                          +-----------+-----------+
                          |                       |
                    AGCDSKY_CLOCK           AGCDSKY_DISPLAY
                                                  |
                                           AGCDSKY_SNAPSHOT
                                                  |
                    shell + renderer + clock + display + snapshot
                                                  |
                                         AGCDSKY_LIFECYCLE
                                                  |
                                         AGCDSKY_SERVICES
                                                  |
                                              AGCDSKY
```

`AGCDSKY_SERVICES` is the frozen public service-graph root. `AGCDSKY` remains the application facade and keeps stable transition-method identity while `runtime-transitions.js` provides transition serialization after publication.

## Service ownership

- `AGCDSKY_RENDERER`: EL digit/register rendering and annunciator primitives.
- `AGCDSKY_SHELL`: configuration, persistent store, mission lock, NTP-adjusted application time, shell controls, and startup bootstrap.
- `AGCDSKY_ENVIRONMENT`: dim/Dream/solar presentation state and solar calculations.
- `AGCDSKY_AUDIO`: relay-contact audio entry points and current audio context.
- `AGCDSKY_CLOCK`: synthetic PHONE CLOCK relay state, queue, V35 lamp-test presentation, and clock rendering.
- `AGCDSKY_DISPLAY`: real AGC output channels, relay/display state, rendering, relay-code decoding, and UI snapshot state.
- `AGCDSKY_SNAPSHOT`: AGC snapshot persistence, restore, verification, autosave, and snapshot diagnostics.
- `AGCDSKY_LIFECYCLE`: AGC core construction/loading, CLOCK suspension, same-core resume, visibility lifecycle, and composed application status.

The public API routes channel output through `AGCDSKY_DISPLAY`, snapshot calls through `AGCDSKY_SNAPSHOT`, time/NTP calls through `AGCDSKY_SHELL`, and lifecycle calls through `AGCDSKY_LIFECYCLE`.

## Audited compatibility boundary

The late hardware/presentation stack is intentionally parser ordered. It contains source-backed fidelity layers that refine an already-established primitive, for example:

- `dsky-geometry.js` replaces `glyph`, `signGlyph`, `renderDigits`, and `renderReg`;
- `dsky-relay-matrix.js` replaces `relayDigit` for all 32 K1-K5 contact states;
- `hardware-fidelity.js` wraps AGC channel decoders, AGC reset, PHONE CLOCK queue/cancel/lamp-test behavior, and relay audio;
- relay identity/visual/personality layers successively wrap `emitTick`, channel-010 presentation, and crew-facing render primitives;
- `background-audio-guard.js` wraps audio acquisition/output and snapshot UI restoration.

Those assignments are no longer free-floating implementation ownership. `app-state-runtime.js` creates one frozen `AGCDSKY_COMPAT` registry before the service stack loads. Renderer, audio, clock, and display services register the historical names as accessor-backed slots owned by the service that defines the primitive.

A late assignment such as:

```js
emitTick = wrappedEmitTick;
decodeChannel10 = hardwareDecodeChannel10;
renderDigits = apolloRenderDigits;
```

therefore updates a versioned slot. Calls through `AGCDSKY_AUDIO`, `AGCDSKY_DISPLAY`, `AGCDSKY_CLOCK`, or `AGCDSKY_RENDERER` immediately dispatch through the current slot implementation. Parser order and middleware composition are preserved without requiring the core graph to rediscover ambient function bindings.

The compatibility registry does **not** mirror application fields such as `mode`, `verb`, `tickSound`, `agcCore`, or visibility state onto `window`. Those remain exclusively in `AGCDSKY_APP_STATE` and `AGCDSKY_CORE_SESSION`.

Read-only compatibility accessors are used for structures that late layers only consume (`DIGIT_RELAY`, `CLOCK_GROUPS`, `SEG`, relay backing objects). Mutable slots are used only where a late layer is known to replace the primitive. `relayDigit` is deliberately mutable because `dsky-relay-matrix.js` installs the schematic 32-state decoder after the base decimal mapping.

## Behavior intended to remain unchanged

- CM / Comanche 055 remains the only mission configuration.
- `yaAGC.wasm` and `Comanche055.bin` inputs are unchanged.
- channel `015` normal-key / KEYRST behavior is unchanged.
- PRO remains a separate level-sensitive channel `032` input.
- channel `010`, `011`, `013`, and `0163` display/discrete decoding is unchanged.
- PHONE CLOCK synthetic relay/V35 behavior is unchanged.
- snapshot schema remains schema 1.
- CLOCK suspension still saves resumable state and AGC return resumes the same loaded core when valid.
- Dream mode remains isolated from real AGC startup and relay audio.
- classic `window.enterAgc` / `window.enterClock` transition globals remain absent.
- the 20-ms settled relay-bank boundary in `hardware-fidelity.js` remains authoritative.

## Regression gates

`tools/core-service-graph-smoke.js` now verifies both the frozen service graph and the single compatibility boundary. Renderer, audio, phone-clock, and AGC-display smokes perform behavioral late-replacement checks and require the corresponding compatibility version to increment.

Mapping/V35/output-path gates read the current service-owned names rather than deleted `app.js` or pre-refactor global implementations. The mapping gate also verifies that `relayDigit` remains a mutable display-owned slot so the schematic relay matrix can install its 32-state decoder without throwing under strict mode.

State-ownership gates continue to reject Window mirrors for application/core fields. The presence of `Object.defineProperty` is allowed only as part of the named `AGCDSKY_COMPAT` registry used for service-owned compatibility slots.

The service-graph gates use bare-call detection where needed, so `foo()` is rejected as an ambient core dependency while `service.foo()` remains valid.

## Verification boundary

The branch records source-level regression gates and the canonical local build wiring. The full `tools/build-local.sh` Gradle/APK/device path still must be run from a complete recursive checkout with the required Android SDK and pinned `vendor/webAGC` submodule.

Do not treat source inspection alone as proof that the current regular or Fire APK builds or passes device smoke testing.
