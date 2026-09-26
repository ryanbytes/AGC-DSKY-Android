# DSKY relay and light-test model

This project separates source-backed AGC/DSKY behavior from acoustic simulation. The goal is to make the display state emerge from the same relay-state model that produces the sound.

## Block II relay topology

MIT report R-700 describes the Block II DSKY as a relay-decoded electroluminescent display. Output channel 10 supplies a 15-bit parallel interface: bits 15-12 select one relay row and bits 11-1 carry up to 11 relay commands. The electrical word is 11 bits wide, but the physical matrix is not dense: exactly 120 latching relay positions are populated across the 12 rows.

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

The channel-10 display-selector matrix is shared by both the synthetic phone-clock relay encoder and the authentic AGC decoder. There is intentionally no second `CLOCK_GROUPS` topology. Relay 8 has only its right/D five-relay bank connected to a visible numerical position (R1D1); relay selectors 7/6, 5/4 and 2/1 latch the independent plus/minus sign states for R1, R2 and R3.

An output bit being present in a channel-10 word does not prove a relay exists behind it. Row 8 is the important counterexample: only its D/K1-K5 bank is physically populated for R1D1; the C bank and B position have no latching relays. AGC software may write those unused bit positions, but the physical relay/contact/audio/haptic model must ignore them.

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

## Physical relay timing and acoustic model

The 20 ms HANG20 interval is the selected-bank coil-drive/settle window; it is **not** the armature travel time. SCD 1006282 for the magnetic-latching relay specifies operate time <=3 ms, release time <=3 ms, transfer time <=1 ms, and contact bounce <=2 ms. Every one of the 120 populated latching-relay profiles is therefore constrained to those limits.

The app retains deterministic relay-to-relay variation for presentation, but that variation is explicitly synthetic within the SCD envelope; it is not claimed to be serial-number-specific measurement data from the flight relays. Sound, haptic, modeled contact bounce and rendered contact projection all derive from the same relay transition profile.

Both setting and resetting a bistable relay are mechanical transitions and can produce a click. The 12 non-latching 1010784/2004689 relays are separately enumerated and coupled to their actual functional sources. Their exact mechanical timing remains **unverified** until the 1010784 SCD timing table can be inspected; the model must not present the current auxiliary timing spread as measured Apollo data.

## V35 DSKY light test

Apollo 11 Luminary 99 implements Verb 35 at `VBTSTLTS`. The source is explicit rather than inferred from a screenshot:

- `FULLDSP = 05675` writes numerical **8** patterns; after T4's low-11 extraction this is `01675`, so both five-relay character banks are driven to code `035`;
- `FULLDSP1 = 07675` is the same physical two-bank digit-8 state with the sign B bit asserted, giving low-11 `03675` and producing **+88888** in R1/R2/R3;
- `TSTCON2 = 40674` supplies the relay-12 LM condition-light word; its visible low-11 state is `00674` octal;
- `TSTCON1 = 00175` turns on UPLINK ACTY, TEMP, KEY REL, V/N flash and OPR ERR;
- channel 13 bit 10 TEST ALARM is asserted, which the yaAGC DSKY model exposes as RESTART/STBY;
- `SHOLTS = 0764` schedules the light-test teardown after about **5 seconds**.

The visible Apollo-11 LM relay-12 assignments are VEL, NO ATT, ALT, GIMBAL LOCK, TRACKER and PROG.

### COMP ACTY distinction

V35's own test mask does **not force COMP ACTY** because channel 11 bit 2 is absent from `TSTCON1`. That does not mean real AGC V35 requires COMP ACTY to be off. Luminary's Executive normally asserts the computer-activity bit while a job is running and clears it while idling, and V35 itself executes as an Executive job.

Therefore:

- **synthetic phone-clock V35** does not invent COMP ACTY and keeps it off;
- **real AGC V35** accepts either COMP state and requires the rendered COMP lamp to exactly match raw channel `011` bit `00002`;
- UPLINK is likewise required to match raw channel `011` bit `00004`.

This is a stronger hardware-fidelity rule than hard-coding a particular COMP state.

yaAGC's DSKY hardware model further defines flashing as a **1.28 s period with 75% duty cycle**. During the off quarter, V/N is blanked and KEY REL / OPR ERR are suppressed. AGC mode follows the already-modulated synthetic channel `0163`; it does not start a second frontend flasher. The phone-clock-only V35 convenience mode mirrors that 4 × 320 ms modulation locally because no AGC engine is running there.

Both clock-mode and AGC-mode V35 numerical rendering use the same channel-10 relay decoder. Clock-mode V35 does not use an `88`/all-lamps DOM shortcut, and ordinary keypad input is ignored while the five-second synthetic test owns the display except for RSET.

The synthetic relay model also accounts for the mechanical transition into and out of the light test. It captures the phone-clock latch state immediately before V35, computes changed relay bits as `FULLDSP/FULLDSP1` replaces that state, preserves the active V35 latches for the five-second interval, and computes a second set of changes when RSET/natural completion restores the phone clock. Natural completion uses the same RSET path and returns to canonical **V16 N65**. Entering real AGC mode discards this synthetic return snapshot because the AGC reset/output path immediately takes ownership of the display.

## Automated relay gates

`tools/dsky-mapping-smoke.js` executes the committed channel-10 decoder in a Node VM and checks:

- selectors 1 through 12 and all 21 numerical positions;
- relay-8 visible right/D-field behavior;
- independent plus/minus latches and plus display priority;
- all six Apollo-11 LM relay-12 condition lamps;
- valid blank code 000 versus invalid five-bit codes;
- malformed-word state preservation and rate-limited diagnostics;
- shared phone-clock/AGC relay topology;
- the exact 120-position physical matrix mask, including the 12 nonexistent dense-matrix positions;
- all 12 non-latching relay identities and their source channels/effective hardware signals.

`tools/v35-model-smoke.js` guards the current V35 authority boundary and relay model: real V35 remains user DSKY input -> yaAGC/Comanche055 -> output channels; PHONE CLOCK and diagnostics cannot synthesize it. The test also requires the physical-inventory/SCD-1006282 latching model.

`tools/app-refine-smoke.js` checks the V35 input lock, natural/RSET return to V16 N65, clock-to-V35-to-clock physical relay deltas, mission cleanup, read-only relay snapshots, and raw channel `011`/`0163` diagnostic snapshots.

`tools/device-v35-policy-smoke.js` guards the real-device proof contract at source-test time. In particular it rejects a fixed `COMP === false` assertion and requires COMP/UPLINK plus all channel-0163-derived lamp/blink states to be compared with their exact raw AGC bits.

`tools/wasm-runtime-smoke.js` drives real `V37E00E` then `V35E` through the exact pinned yaAGC WASM and ropes. Its semantic relay gate requires both five-relay character banks on selectors 1 through 11 to carry the digit-8 code, plus-sign bits on R1/R2/R3, and exact mission-specific relay-12 low-11 state (`00674` Luminary099, `00650` Comanche055).

The live Android `tools/device-v35-smoke.js` then requires the same real Luminary low-11 relay states, rendered `88` / `+88888` output, the source-backed V35 annunciators, and an observed yaAGC-modulated V/N + KEY REL/OPR ERR off phase. Instead of assuming COMP state, it requires the rendered channel-011 and channel-0163 discretes to exactly match the raw channel words captured from yaAGC.

These host-side gates are part of `tools/build-local.sh`. They are not a substitute for the Android/WebView device gate and must not be reported as passing until actually executed in a complete checkout with the pinned WASM/rope assets.

## AGC mode

When running Luminary through yaAGC, software-originated channel-10 timing is retained. The frontend does not impose a second synthetic 120/40 ms scheduler on authentic AGC output. It applies the physical latch/relay-contact model and sound to the channel words actually emitted by the AGC.

`window.AGCDSKY.snapshotRelays()`, `snapshotChannels()`, and `snapshotDsky()` expose read-only copies of current relay/raw-channel/render/lamp state for the device smoke and debugging. They do not expose mutable references to the production tables/state.

## Primary references

- MIT Instrumentation Laboratory, **R-700 Apollo Guidance, Navigation and Control** — relay-matrix topology, five relays per digit, 120 latching + 12 non-latching relays.
- Apollo 11 **Luminary 99 `T4RUPT_PROGRAM.agc`** — `HANG20`, `20MRUPT`, `QUIKDSP`, `QUIKOFF`, `120MRUPT` display timing.
- Apollo 11 **Luminary 99 `PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`** — `VBTSTLTS`, `FULLDSP`, `FULLDSP1`, `TSTCON1`, `TSTCON2`, `SHOLTS` V35 behavior.
- Apollo 11 **Luminary 99 `EXECUTIVE.agc`** — normal COMP ACTY control while Executive jobs run/idle.
- VirtualAGC `yaAGC/agc_engine.c` — DSKY channel-0163 modulation, 1.28-second flash period and 75% duty cycle.
- VirtualAGC `yaDSKY2.cpp` and `piPeripheral/convertNasspLog.py` — channel-10 selector/sign/digit relay mapping and invalid-code treatment.
- VirtualAGC LM DSKY/telemetry documentation — Apollo 11-14 blank relay-12 positions and later PRIO DISP / NO DAP labels.
