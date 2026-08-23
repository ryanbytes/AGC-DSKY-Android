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
- 4 = `027`
- 5 = `036`
- 6 = `034`
- 7 = `023`
- 8 = `035`
- 9 = `037`

All values above are octal.

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

Apollo documentation describes V35 as a P00-only light test. In Luminary/Colossus-family software the test does not merely repaint a display bitmap:

- the numeric `DSPTAB` entries are changed so the numerical windows display **8** and R1/R2/R3 display **+88888** through the ordinary channel-10 relay matrix;
- warning/status outputs are asserted;
- VERB/NOUN flashing is enabled;
- output channel 13 bit 10 (`ALTEST`, TEST DSKY LIGHTS / TEST ALARMS) is asserted to exercise otherwise inaccessible alarm/indicator circuitry including RESTART/STBY paths;
- the test remains active for about **5 seconds**, then the caution/status test outputs are removed.

For Luminary, `DSPTAB+11D` is the latching condition-light relay word. Its visible LM assignments include Landing Radar Velocity Fail (VEL), NO ATT, Landing Radar Altitude Fail (ALT), GIMBAL LOCK, TRACKER and PROG. The all-visible-condition-light test state for these bits is `00674` octal.

COMP ACTY is **not** synthetically forced on by V35. Its DSKY relay is operated by output channel 11 bit 2; the V35 warning/status mask does not assert that bit.

The application therefore routes V35 through the same physical relay-state machine as ordinary channel-10 output. There is no direct `88`/all-lamps DOM shortcut.

## AGC mode

When running Luminary through yaAGC, software-originated channel-10 timing is retained. The frontend does not impose a second synthetic 120/40 ms scheduler on authentic AGC output. It applies the physical latch/relay-contact model and sound to the channel words actually emitted by the AGC.

## Primary references

- MIT Instrumentation Laboratory, **R-700 Apollo Guidance, Navigation and Control** — relay-matrix topology, five relays per digit, 120 latching + 12 non-latching relays.
- Apollo 11 **Luminary 99 `T4RUPT_PROGRAM.agc`** — `HANG20`, `20MRUPT`, `QUIKDSP`, `QUIKOFF`, `120MRUPT` display timing.
- Apollo GN&CS **User's Guide, E-2448** — V35 P00 restriction, all display-panel lights for 5 seconds.
- Programmed Guidance Equations / AGC I/O descriptions — channel 13 bit 10 light/alarm test and V35 display/output behavior.
- VirtualAGC Luminary telemetry documentation — `DSPTAB+11D` LM condition-light bit assignments.
