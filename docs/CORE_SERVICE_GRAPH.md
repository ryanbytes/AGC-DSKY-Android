# DSKY core runtime service graph

Date: 2026-09-14
Branch: `refactor/dsky-core-service-graph`

## Scope

This refactor converts the core DSKY runtime from parser-global cross-module calls to an explicit frozen service graph. It is intentionally one architectural change rather than a sequence of small extraction phases.

The production dependency direction is now:

```text
AGCDSKY_RENDERER
      |
      +--> AGCDSKY_ENVIRONMENT --> AGCDSKY_AUDIO
      |                               |
      +-------------------------------+
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
- `AGCDSKY_DISPLAY`: real AGC output channels, relay/display state, rendering, and UI snapshot state.
- `AGCDSKY_SNAPSHOT`: AGC snapshot persistence, restore, verification, autosave, and snapshot diagnostics.
- `AGCDSKY_LIFECYCLE`: AGC core construction/loading, CLOCK suspension, same-core resume, visibility lifecycle, and composed application status.

The public API now routes channel output through `AGCDSKY_DISPLAY`, snapshot calls through `AGCDSKY_SNAPSHOT`, time/NTP calls through `AGCDSKY_SHELL`, and lifecycle calls through `AGCDSKY_LIFECYCLE`.

## Compatibility boundary retained on purpose

This change does **not** remove every classic-script binding from the entire frontend.

The late hardware/presentation stack still contains compatibility consumers and refinements, notably `dsky-geometry.js`, `hardware-fidelity.js`, and the relay/audio personality layers. For example, `dsky-geometry.js` replaces `glyph`, `renderDigits`, and `renderReg` after the base renderer loads, while hardware fidelity still consumes the classic clock relay structures.

To preserve that behavior during this core-runtime conversion:

- renderer and audio services use dynamic wrappers that resolve the current classic binding at call time;
- the core runtime consumes only the named services;
- the late compatibility surface remains a separate future refactor target rather than being mixed into this change.

This distinction is important: the core graph is explicit, but the entire late fidelity stack is not yet free of classic bindings.

## Behavior intended to remain unchanged

- CM / Comanche 055 remains the only mission configuration.
- `yaAGC.wasm` and `Comanche055.bin` inputs are unchanged.
- channel `015` normal-key / KEYRST behavior is unchanged.
- PRO remains a separate level-sensitive channel `032` input.
- channel `010`, `011`, `013`, and `0163` display/discrete decoding is unchanged.
- PHONE CLOCK synthetic relay/V35 behavior is unchanged.
- snapshot schema remains schema 1.
- CLOCK suspension still saves resumable state and AGC return resumes the same loaded core when valid.
- Dream mode remains isolated from real AGC startup.
- classic `window.enterAgc` / `window.enterClock` transition globals remain absent.

## Regression gates

The canonical source gate now includes `tools/core-service-graph-smoke.js`. Existing shell, API, renderer, phone-clock, AGC-display, snapshot, lifecycle, frontend, NTP, V35, output-path, and authority tests were updated to exercise the explicit services rather than reconstructing removed ambient dependencies.

A stale `device-v35-policy-smoke.js` dependency on deleted `app.js` was also removed. The policy gate now reads the current display/lifecycle/API service stack.

The service-graph gates use bare-call detection where needed, so `foo()` is rejected as an ambient dependency while `service.foo()` remains valid. This avoids false failures from naïve substring matching.

## Verification boundary

The branch records source-level regression gates and the canonical local build wiring. The full `tools/build-local.sh` Gradle/APK/device path must still be run from a complete recursive checkout with the required Android SDK and pinned `vendor/webAGC` submodule.

Do not treat source inspection alone as proof that the current regular or Fire APK builds or passes device smoke testing.
