# AGC DSKY Android progress

Last updated: 2026-08-22

## Goal

Ship an Android DSKY that keeps the phone clock / DreamService mode but also contains a real Apollo Guidance Computer execution core. In AGC mode, DSKY displays, annunciators, COMP ACTY, and key input must be driven by actual AGC I/O rather than phone/network stand-ins.

## Current state

- Android Activity and DreamService shells exist.
- DSKY face, keys, annunciators, and fixed-coordinate SVG EL display exist.
- Phone clock mode is implemented as V16 N65.
- V35 lamp test is implemented.
- Dim mode and DreamService brightness/pixel drift are implemented.
- EL digit segments were redrawn in commit `a70c2437d69729b6217d5cfa1cbbb57e7be04ad6`.
- The current source still contains the old phone-network COMP ACTY surrogate. Replace it as part of AGC-core integration.
- No GitHub Actions build workflow should be added. Builds are local/manual.

## Confirmed authentic COMP ACTY mapping

For Block II AGC output:

- Channel: `011` octal
- Signal: COMACT / COMP ACTY
- Bit: 2 (Apollo 1-based bit numbering)
- Numeric mask: `0b10`

Michael Franzl's webAGC/yaAGC wrapper implements the same mapping when reading output channel `0o11`.

## Selected core direction

Use the VirtualAGC `yaAGC` core, preferably the WebAssembly build used by `michaelfranzl/webAGC`, because it already exposes the interfaces needed for a DSKY frontend:

- `cpu_step(steps)`
- `cpu_reset()`
- `packet_read()`
- `packet_write(channel, value)`
- `set_fixed(ptr)` for loading a rope image
- `get_erasable_ptr()`

Upstream webAGC `yaAGC.wasm` is about 133 KB. Apollo 11 rope images `Comanche055.bin` and `Luminary099.bin` are each about 72 KB.

### Integration constraint

The upstream WASM build expects WASI imports. webAGC currently supplies those using `@wasmer/wasi` and `@wasmer/wasmfs`. Do not assume the raw `.wasm` can be instantiated in Android WebView with only `{env:{memory}}`; inspect its import table or provide the required WASI shim.

## Core integration checklist

1. Vendor the chosen yaAGC WASM core and license/attribution.
2. Vendor one Apollo rope image for the first complete path. Prefer Apollo 11 LM `Luminary099.bin` for initial DSKY testing; add `Comanche055.bin` when CM selection is exposed.
3. Add a small local WASI/runtime loader suitable for Android WebView, or rebuild yaAGC without unnecessary WASI dependencies.
4. Create an `AgcCore` JS module with `load`, `reset`, `step`, `readAllIo`, and `keyPress` APIs.
5. Run the core at approximately real AGC instruction timing. webAGC uses ~11.72 microseconds/instruction and drains I/O around 60 Hz.
6. Decode channel `011` bit 2 directly into COMP ACTY. Remove the `TrafficStats` / `agcnet://poll` surrogate.
7. Decode DSKY numerical output channels into PROG, VERB, NOUN, and registers.
8. Decode authentic annunciators, including channel `011` and yaAGC's emulated blinking-light channel `0163` octal where applicable.
9. Map the 19 physical DSKY keys to AGC key codes and send them through `packet_write` on normal-key channel `015` octal. Handle PRO separately through channel `032` octal.
10. Keep phone clock mode as a separate mode; do not let clock-mode state overwrite AGC-driven displays.
11. Build locally, sign locally, and test installation on Android. Do not add GitHub Actions unless the repository owner reverses this instruction.

## Verification gates

Do not claim the AGC core works until all of these are demonstrated:

- WASM instantiates in Android WebView without network access.
- A rope image loads from packaged assets.
- CPU stepping produces real output packets.
- COMP ACTY follows channel `011` bit 2, not timers/network traffic.
- A DSKY keypress reaches the AGC and causes an observable program response.
- The resulting APK installs and launches on a real Android device or emulator.

## Build/signing note

The original private v5/v6 signing key is not committed. A locally generated replacement key cannot update an APK signed by that original key; Android requires matching signatures for in-place updates. Never commit private signing material.

## Next concrete checkpoint

Add the core assets/runtime module, get yaAGC to instantiate offline inside the packaged WebView, and log/drain real AGC output packets before changing the visible DSKY state machine.
