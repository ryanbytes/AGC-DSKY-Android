# Instructions for coding agents

This repository is an Android Apollo DSKY project. Read `docs/PROGRESS.md` and `docs/IMPLEMENTATION_NOTES.md` before changing code.

## Owner requirements

- Keep the repository updated during substantial work. Prefer small, coherent commits over one giant end-of-session dump.
- Maintain `docs/PROGRESS.md` whenever architecture, blockers, completed checkpoints, or the next action changes materially.
- Do **not** add or use GitHub Actions for builds unless the owner explicitly reverses this instruction.
- Build and sign APKs locally/manual when build tooling is available.
- Never commit private signing keys, passwords, tokens, or other credentials.
- Do not claim an APK builds, installs, or runs unless that specific result was actually verified.

## Product intent

The app has two distinct purposes:

1. A phone clock / charging DreamService presented as an Apollo Block II DSKY.
2. A real AGC emulator mode backed by an onboard Apollo Guidance Computer execution core.

Do not blur these modes. Phone clock state is synthetic. AGC mode must be driven by authentic AGC I/O.

## Authenticity rules

- COMP ACTY in AGC mode must come from Block II output channel `011` octal, bit 2 (`0b10`).
- Do not use network traffic, random pulses, animation timers, CPU load, or other stand-ins for COMP ACTY in AGC mode.
- Preserve the fixed SVG EL display coordinate system. Do not replace the custom segment vectors with a generic seven-segment font.
- Keep EL styling restrained and green/green-white; avoid modern LED bloom effects.
- Verify Apollo/VirtualAGC mappings against primary or established VirtualAGC/webAGC sources before changing channel/bit/key assignments.

## Core direction

The current intended core is VirtualAGC `yaAGC`, using the WebAssembly build/API pattern demonstrated by `michaelfranzl/webAGC` unless a materially cleaner offline integration is proven.

Expected useful yaAGC exports include:

- `cpu_step`
- `cpu_reset`
- `packet_read`
- `packet_write`
- `set_fixed`
- `get_erasable_ptr`
- `malloc` / `free`

The upstream webAGC WASM build expects WASI support. Do not simply call `WebAssembly.instantiate()` with guessed imports and declare failure/success. Inspect imports and provide the required runtime shim, or rebuild the core with a cleaner embedding interface.

## DSKY I/O targets

- Normal DSKY key channel: `015` octal.
- PRO/Proceed path: `032` octal, handled separately.
- COMP ACTY: output channel `011` octal, bit 2.
- webAGC also consumes channel `0163` octal as yaAGC's fictitious/modulated blinking-light output; preserve the distinction between real AGC output and emulator-provided hardware modulation.

When implementing additional display decoding, cite/source the mapping in `docs/PROGRESS.md` or `docs/REFERENCES.md`.

## Code organization

Prefer separating emulator integration from UI state:

- `app/src/main/assets/app.js`: DSKY UI/mode coordination only.
- Add a dedicated AGC runtime module (for example `agc-core.js`) for WASM loading, rope loading, CPU stepping, packet I/O, and key injection.
- Keep Android shell code minimal unless native code is required for a capability that WebView cannot provide cleanly.
- Remove obsolete bridges once no longer needed. In particular, the `TrafficStats`/`agcnet://poll` COMP ACTY bridge should disappear when real AGC I/O is connected.

## Core integration sequence

1. Make yaAGC instantiate offline from packaged assets.
2. Load a packaged rope image.
3. Reset and step the CPU.
4. Drain `packet_read()` output and prove real channel values are arriving.
5. Wire channel `011` bit 2 to COMP ACTY.
6. Decode DSKY display/annunciator outputs.
7. Map keypad input back through `packet_write()`.
8. Only then call AGC mode functional.

Prefer Apollo 11 `Luminary099.bin` as the first rope for LM/DSKY testing. Add CM `Comanche055.bin` as a selectable option after the first complete path works.

## Verification discipline

For every significant checkpoint, record what was actually tested in `docs/PROGRESS.md`.

Examples:

- Good: `WASM import table inspected; requires wasi_snapshot_preview1.fd_write, ...`
- Good: `Luminary099 loaded; packet_read produced channel 010 values after N steps.`
- Bad: `Core integrated` when only files were copied.
- Bad: `Build passes` when syntax checks only were run.

If a blocker appears, document the blocker and the shortest next experiment. Do not hide it by substituting a mock behavior.

## Repository hygiene

- GPL-2.0 compatibility and upstream attribution matter. Update `THIRD_PARTY.md` when vendoring code/binaries.
- Keep large/generated binaries intentional and documented.
- Do not commit APKs as proof of a build unless the APK was actually produced from the corresponding source revision and its signing provenance is clear.
- Keep README claims synchronized with reality; remove stale statements rather than preserving aspirational wording.
