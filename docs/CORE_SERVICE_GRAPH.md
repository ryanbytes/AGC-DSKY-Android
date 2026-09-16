# DSKY runtime service graph

Date: 2026-09-15
Branch: `refactor/dsky-core-service-graph`

## Scope

The frontend runtime now has explicit ownership from application bootstrap through the late Block II hardware/presentation stack. Parser order remains significant where a late layer intentionally decorates a service implementation, but application modules no longer reach sideways through bare mutable helper bindings or patch public API methods.

Core dependency direction:

```text
AGCDSKY_APP_STATE / AGCDSKY_CORE_SESSION
             |
       AGCDSKY_COMPAT
             |
    +--------+---------+
    |                  |
AGCDSKY_SHELL     AGCDSKY_RENDERER
    |                  |
AGCDSKY_ENVIRONMENT    |
    |                  |
AGCDSKY_AUDIO <--------+
    |                  |
    +----> AGCDSKY_CLOCK
    |
    +----> AGCDSKY_DISPLAY
              |
        AGCDSKY_SNAPSHOT
              |
        AGCDSKY_LIFECYCLE
              |
        AGCDSKY_SERVICES
              |
            AGCDSKY
```

Late physical/presentation services build on that graph:

```text
AGCDSKY_DISPLAY + AGCDSKY_CLOCK + AGCDSKY_AUDIO
                    |
             AGCDSKY_HARDWARE
                    |
          DSKY_RELAY_AUDIO
                    |
          DSKY_RELAY_VISUAL
                    |
   DSKY_RELAY_STRETCH_STABILITY

AGCDSKY_AUDIO ---> AGCDSKY_AUDIO_RECOVERY
AGCDSKY_HARDWARE ---> AGCDSKY_RELAY_SHOW
```

## Ownership

- `AGCDSKY_RENDERER`: EL glyph/register/annunciator primitives.
- `AGCDSKY_SHELL`: persistent configuration, NTP-adjusted time, controls and startup.
- `AGCDSKY_ENVIRONMENT`: dim/Dream/solar presentation state.
- `AGCDSKY_AUDIO`: relay audio implementation entry points and AudioContext ownership.
- `AGCDSKY_CLOCK`: PHONE CLOCK backing digits/relay words, queue and V35 entry points.
- `AGCDSKY_DISPLAY`: real AGC channel state, relay words, relay-word projection, UI snapshot reconstruction and raw-channel state.
- `AGCDSKY_SNAPSHOT`: schema-1 persistence, restore, verification and autosave.
- `AGCDSKY_LIFECYCLE`: AGC load/run/suspend/resume and visibility lifecycle.
- `AGCDSKY_HARDWARE`: 120/20/40-ms relay timing, physical latch state, auxiliary relays, V35 sequence, hardware diagnostics, diagnostic extensions and settled-paint policy.
- `AGCDSKY_AUDIO_RECOVERY`: WebAudio failure recovery/circuit breaker only. It no longer owns AGC display/snapshot reconstruction.
- `AGCDSKY_RELAY_SHOW`: presentation choreography over the final physical relay handlers, with explicit task/state restoration.

## Compatibility boundary

`AGCDSKY_COMPAT` is retained as one audited adapter for historical parser-visible names. Core services register owned slots with `mutable`, `accessor` or `readonly`. Late layers that deliberately decorate an implementation use `get()` and `replace(name, implementation, reason)`.

The Window accessors remain so external/debug/legacy code can still observe or replace documented compatibility names, but production late modules no longer perform bare assignments such as `emitTick = ...`, `decodeChannel10 = ...`, `set2 = ...`, or `lampTest = ...`.

The completed late stack uses explicit registration:

- drawing geometry replaces renderer slots through `AGCDSKY_COMPAT`;
- schematic K1-K5 decoding replaces the display-owned `relayDigit` slot;
- hardware fidelity replaces channel/clock/V35 implementation slots and publishes `AGCDSKY_HARDWARE`;
- relay identity, visual timing, stretched stability and perceptual audio compose through service APIs and compatibility replacement slots;
- background audio recovery wraps only audio slots;
- Relay Show reads/writes state through shell/audio/clock/display/snapshot/hardware services plus audited clock compatibility state.

No late module needs to replace `AGCDSKY.hardware`, `AGCDSKY.audioStatus`, global `setTimeout`, or another module's public service object. The public facade publishes stable dynamic delegates for hardware diagnostics, audio recovery status and Relay Show.

## Display/snapshot authority

`AGCDSKY_DISPLAY` now owns one relay-word projection function for normal channel 010 decode, hardware-settled relay commits, diagnostics and snapshot reconstruction. Snapshot restore reconstructs the visible DSKY from authoritative relay words rather than copying an independent display projection.

This also fixes the previous duplicate background-guard row-3 reconstruction path: Block II relay row 3 maps C to `R2[4]` and D to `R3[0]`, and that mapping now exists in one place.

## Hardware timing invariants

The refactor intentionally preserves the physical model:

- T4RUPT display cadence: 120 ms.
- selected latching relay bank settle boundary: 20 ms.
- dirty-bank start spacing: 40 ms.
- PHONE CLOCK V35 hold: 5 seconds.
- V/N flash quantum: 320 ms, four phases.
- Comanche V35 relay 12: octal `0650`.
- synthetic plus rows: 2, 5 and 7.

Normal PHONE CLOCK hardware commits update physical/backing relay state at 20 ms but render from `clockDigits`; they no longer transiently paint the AGC display projection. STRETCHED mode suppresses only the crew-facing settled paint through an explicit hardware policy while physical latch timing remains unchanged.

## Behavior preserved

- CM / Comanche 055 only.
- `yaAGC.wasm` and `Comanche055.bin` unchanged.
- normal keys use channel `015` plus KEYRST.
- PRO remains level-sensitive channel `032`.
- channels `010`, `011`, `013`, `0163` retain their Block II mappings.
- snapshot schema remains schema 1.
- CLOCK suspension saves resumable state and AGC return resumes the same loaded core when valid.
- Dream mode never starts real AGC.
- classic `window.enterAgc` / `window.enterClock` globals remain absent.

## Regression gates

The canonical local build runs the core service, fidelity compatibility, and late-service boundary gates. The late boundary gate rejects direct production assignments to owned compatibility implementations and rejects public-API/global-timer monkey-patching. Dedicated tests cover WebAudio recovery, V35 policy/model, relay output mapping, and stretched visual monotonicity under the new service contracts.

## Verification boundary

Source syntax and targeted Node smoke tests can be run independently. The authoritative build remains:

```bash
bash tools/build-local.sh
```

That command requires a complete recursive checkout, JDK 17+, Node 18+, stable Gradle 9.5+, Android compile SDK 37, Build Tools 36.0.0, and the pinned `vendor/webAGC` submodule at `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`.

Source inspection or isolated smoke execution is not proof that the regular/Fire APKs assemble or pass device tests; the full local build/device path must still be run from that environment.
