# References

## Apollo / VirtualAGC

- Virtual AGC project: https://github.com/virtualagc/virtualagc
- Virtual AGC site: https://www.ibiblio.org/apollo/
- Virtual AGC developer information / yaAGC I/O protocol: https://www.ibiblio.org/apollo/developer.html
- VirtualAGC `yaDSKY2/LM.ini`: LM annunciator map, channel assignments, key codes.
- VirtualAGC `piPeripheral/humanizeScript.py`: channel `010` relay-word decoding and DSKY channel bit names.
- VirtualAGC `piPeripheral/convertNasspLog.py`: DSKY relay/digit code generation and register/sign relay mapping.
- VirtualAGC `yaAGC/agc_engine.h`: fictitious channel `0163` DSKY modulation masks.
- VirtualAGC `yaAGC/agc_engine.c`: DSKY hardware reconstruction, RESTART flip-flop/RSET behavior, STBY/EL-off behavior, channel `0163` output.
- VirtualAGC `yaAGC/ringbuffer_api.c`: browser/WASM input transport and KEYRUPT generation behavior.
- Apollo 11 Comanche 055 `PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`: CM Pinball keyboard processing, RSET/error-reset path, display lock/release behavior.
- Apollo 11 Luminary 099 `PINBALL_GAME_BUTTONS_AND_LIGHTS.agc`: original DSKY key codes, channel 15 keyboard behavior, channel 10 relay-word display format, and relay digit codes.
- Apollo 11 source mirror: https://github.com/chrislgarry/Apollo-11
- Apollo-derived DSKY interface drawing: https://commons.wikimedia.org/wiki/File:Apollo_DSKY_interface.svg

### Block II DSKY key hardware

These sources are authoritative for the source-backed mechanical envelope in `key-mechanical-spec.js`:

- MIT/IL final report R-700, *Apollo Guidance, Navigation and Control — MIT's Role in Project Apollo, Vol. III, Computer Subsystem*, §3.10.1.5, Pushbutton Switch: approximately `3/16 in` cap-housing movement to switch actuation plus `1/16 in` additional travel before bottoming, for approximately `1/4 in` total stroke. https://www.ibiblio.org/apollo/Documents/R-700.pdf
- NASA/MIT drawing `2004941`, compression spring, DSKY pushbutton: `3.0–3.5 lb/in` spring rate, `0.500 in` free length (REF), `0.100 in` maximum solid height, approximately `1.2 lb` load at solid height, `0.245 in` OD, `0.016 in` wire.
- NASA specification-control drawing `1010901`, sensitive switch: `7 oz` maximum actuating force, `1 oz` minimum release force, `0.030 in` maximum pretravel, `0.006 in` maximum differential movement, `0.003 in` minimum overtravel, `3 lb` maximum overtravel force, SPDT contacts, minimum 25,000 operating cycles. https://www.ibiblio.org/apollo/SCDs/scd_1010901b.pdf
- NASA/MIT shaft assembly `2003975-011`: key EL panel acceptance requirement of at least `2.0 foot-lamberts` at `75 Vrms`, `400 Hz`.
- Raytheon Block II development report / NASA NTRS 19700015154: later cap-housing leaf-spring redesign retained the original spring rate while improving fatigue life; Teflon-coated shafts were adopted after wear produced rough/high-force key operation. https://www.ibiblio.org/apollo/Documents/19700015154.pdf

Important modeling rule: acceptance maxima/minima are envelopes, not probability distributions. The app only samples per-key variation where a bounded manufacturing range is actually documented (currently the `3.0–3.5 lb/in` compression-spring rate). Contact timing, return-audio timing, synthesized sound pitch/gain, and screen-space key depth remain explicitly labeled presentation/interaction estimates.

### Mappings implemented in v0.7

- COMP ACTY: output channel `011` octal, bit 2.
- UPLINK ACTY: output channel `011` octal, bit 3.
- DSKY numerical/relay output: channel `010` octal.
- Normal DSKY keys: input channel `015` octal.
- PRO/Proceed: input channel `032` octal, bit 14.
- yaAGC modulated DSKY state: fictitious channel `0163` octal.

## webAGC

- Source: https://github.com/michaelfranzl/webAGC
- Pinned by this repository at commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`.

webAGC is both a behavioral reference and the source of the browser-oriented `yaAGC.wasm` build plus Apollo 11 rope binaries used by the Android v0.7 source. Its `src/webAGC.js` documents the `cpu_step`, `packet_read`, `packet_write`, fixed-memory loading, channel `011`, and channel `0163` flow used as an embedding reference.

The Android project does not require the online webAGC demo for onboard AGC mode.

## Genuine DSKY visual references

CuriousMarc restoration videos were used to stop treating modern CAD/SVG styling as the visual master and instead compare against genuine hardware:

- `Apollo DSKY - part 1: we have a real (and broken) DSKY!`
- `Genuine NASA Apollo DSKY Full Restoration — part 2`
- `Apollo Guidance Computer Part 28: real DSKY display works again after 50 years`

Channel: https://www.youtube.com/@CuriousMarc

Key observations used in the current face:

- EL segments are flat surface emitters, not LED bars.
- Glow should be restrained and relatively uniform.
- Segment ends/corners are more sculpted than a generic seven-segment font.
- Display labels, register separators, COMP ACTY, and numeric segments visually belong to one EL assembly.
- The physical DSKY has significant recess depth, seams, and non-flat mechanical construction.

No CuriousMarc video frames are copied into this repository.
