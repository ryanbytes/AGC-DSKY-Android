# DSKY relay and light-test model

This project separates source-backed AGC/DSKY behavior from acoustic simulation. The goal is to make the display state emerge from the same relay-state model that produces the sound.

## Block II relay topology

MIT report R-700 describes the Block II DSKY as a relay-decoded electroluminescent display. Output channel 10 supplies a 15-bit parallel interface: bits 15-12 select one relay row and bits 11-1 set or reset the 11 latching relays in that selected row.

Five bistable relays encode each decimal digit. Their multiple contacts form the hard-wired decoder between the five-bit AGC digit code and the seven visible EL segments; the seven segments are therefore not modeled as seven independent relays. The eleventh relay in a display row may control a sign or discrete. R-700 gives the DSKY total as 120 latching relays plus 12 non-latching relays, with some relays serving spacecraft-interface functions rather than visible DSKY indications.

The relay code used by the numeric contact decoder is:

- blank = `000`
- 0 = `025`
- 1 = `003`
- 2 = `031`
- 3 = `033`
- 4 = `017`
- 5 = `036`
- 6 = `034`
- 7 = `023`
- 8 = `035`
- 9 = `037`

All values above are octal.

The channel-10 display-selector matrix is shared by both the synthetic phone-clock relay encoder and the authentic AGC decoder. There is intentionally no second `CLOCK_GROUPS` topology. Relay 8 uses only its connected right/D digit field; relay selectors 7/6, 5/4 and 2/1 latch the independent plus/minus sign states for R1, R2 and R3.

Unsupported five-bit character patterns are not treated as blank. The decoder rejects an invalid relay word, leaves the last good latched/displayed state unchanged, and records one diagnostic per unique bad word/detail. This follows VirtualAGC's treatment of non-table character patterns as I/O errors rather than inventing a display glyph.

For the Apollo-11-era LM panel, relay-12 bits 1 and 2 are intentionally unplacarded/blank. Later Apollo 15-17 LM panels labeled those positions PRIO DISP and NO DAP; this project keeps the Apollo 11-14 layout.

## Source-backed timing

Apollo 11 Luminary 99 `T4RUPT_PROGRAM.agc` shows the display path writing a selected relay bank to `OUT0`, entering `HANG20`, scheduling `20MRUPT`, then using `QUIKDSP` / `QUIKOFF` to remove relay drive and service further dirty display work.

The clock-mode hardware emulator therefore uses:

- Normal T4 display service: **120 ms**
- Selected-bank coil-drive / latch interval: **20 ms**
- Drive removed for the following **20 ms**
- Successive dirty-bank commands in the quick-display path: **40 ms start-to-start**

The 11 relays in the selected row are electrically commanded in parallel. The model must never present the audible cascade as serial AGC electrical drive.

## Acoustic model

Physical armatures and contacts need not land at the exact same instant even when their coils are commanded together. To reproduce the short irregular relay rattle heard from restored DSKY hardware, the app distributes individual changed-relay contact snaps across the documented 20 ms drive window.

That within-bank mechanical scatter is an **acoustic heuristic**, not a measured Apollo relay timing specification. The historical 20/40/120 ms electrical/software timing is kept separate from the sound-calibration constants.

Both setting and resetting a bistable relay are mechanical transitions and can produce a click. A modeled non-latching relay can also produce a mechanical event on energize and release.

## V35 DSKY light test

Apollo 11 Luminary 99 implements Verb 35 at `VBTSTLTS`. The source is explicit rather than inferred from a screenshot:

- `FULLDSP = 05675` writes numerical **8** patterns;
- `FULLDSP1 = 07675` writes **8** plus the sign B bit, producing **+88888** in R1/R2/R3;
- `TSTCON2 = 40674` supplies the relay-12 LM condition-light word; its visible low-11 state is `00674` octal;
- `TSTCON1 = 00175` turns on UPLINK ACTY, TEMP, KEY REL, V/N flash and OPR ERR;
- channel 13 bit 10 TEST ALARM is asserted, which the yaAGC DSKY model exposes as RESTART/STBY;
- `SHOLTS = 0764` schedules the light-test teardown after about **5 seconds**.

The visible Apollo-11 LM relay-12 assignments are VEL, NO ATT, ALT, GIMBAL LOCK, TRACKER and PROG. COMP ACTY is **not** forced by V35 because channel 11 bit 2 is not part of the V35 test mask.

yaAGC's DSKY hardware model further defines flashing as a **1.28 s period with 75% duty cycle**. During the off quarter, V/N is blanked and KEY REL / OPR ERR are suppressed. AGC mode follows the already-modulated synthetic channel `0163`; it does not start a second frontend flasher. The phone-clock-only V35 convenience mode mirrors that 4 × 320 ms modulation locally because no AGC engine is running there.

Both clock-mode and AGC-mode V35 numerical rendering now use the same channel-10 relay decoder. Clock-mode V35 does not use an `88`/all-lamps DOM shortcut.

## Automated relay gates

`tools/dsky-mapping-smoke.js` executes the committed channel-10 decoder in a Node VM and checks:

- selectors 1 through 12 and all 21 numerical positions;
- relay-8 right-only behavior;
- independent plus/minus latches and plus display priority;
- all six Apollo-11 LM relay-12 condition lamps;
- valid blank code 000 versus invalid five-bit codes;
- malformed-word state preservation and rate-limited diagnostics;
- shared phone-clock/AGC relay topology;
- channel 011 and synthetic channel 0163 mappings.

`tools/v35-model-smoke.js` checks the clock-mode V35 relay words, plus-sign rows, 5-second duration, COMP exclusion, relay-12 mask, and 1.28-second/75% flash model.

`tools/wasm-runtime-smoke.js` drives real `V37E00E` then `V35E` through the exact pinned yaAGC WASM and ropes. Its semantic relay gate requires all 21 numerical positions to be 8, plus-sign bits on R1/R2/R3, and for Luminary099 all six Apollo-11 LM relay-12 condition-light bits.

These host-side gates are part of `tools/build-local.sh`. They are not a substitute for the Android/WebView device gate and must not be reported as passing until actually executed in a complete checkout with the pinned WASM/rope assets.

## AGC mode

When running Luminary through yaAGC, software-originated channel-10 timing is retained. The frontend does not impose a second synthetic 120/40 ms scheduler on authentic AGC output. It applies the physical latch/relay-contact model and sound to the channel words actually emitted by the AGC.

## Primary references

- MIT Instrumentation Laboratory, **R-700 Apollo Guidance, Navigation and Control** — relay-matrix topology, five relays per digit, 120 latching + 12 non-latching relays.
- Apollo 11 **Luminary 99 `T4RUPT_PROGRAM.agc`** — `HANG20`, `20MRUPT`, `QUIKDSP`, `QUIKOFF`, `120MRUPT` display timing.
- Apollo 11 **Luminary 99 `PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`** — `VBTSTLTS`, `FULLDSP`, `FULLDSP1`, `TSTCON1`, `TSTCON2`, `SHOLTS` V35 behavior.
- VirtualAGC `yaAGC/agc_engine.c` — DSKY channel-0163 modulation, 1.28-second flash period and 75% duty cycle.
- VirtualAGC `yaDSKY2.cpp` and `piPeripheral/convertNasspLog.py` — channel-10 selector/sign/digit relay mapping and invalid-code treatment.
- VirtualAGC LM DSKY/telemetry documentation — Apollo 11-14 blank relay-12 positions and later PRIO DISP / NO DAP labels.
