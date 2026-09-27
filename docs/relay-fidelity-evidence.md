# Block II DSKY relay fidelity evidence

This file records what the current simulation may claim as hardware fact and what
must remain explicitly uncertain.

## Proven production hardware facts

- MIT/IL final report R-700 states that the Block II DSKY contains **120
  latching relays and 12 nonlatching relays**.
  Source: https://ibiblio.org/apollo/Documents/R-700.pdf
- Production relay-circuit assembly 2003910-021 contains **20 relay part
  2004688-1/-2 plus 2 relay part 2004689-2**. Each DSKY contains six D1-D6
  indicator-driver modules, independently corroborating 6 x 22 = **132 relay
  packages**.
  Source: https://www.ibiblio.org/apollo/2003994-121.html
- The production/flight Channel 010 mapping uses 12 selected relay-word rows with up to 11 relay-bit positions. MIT/IL R-700 describes selection of "1 row out of 12", and Apollo 11 Comanche055 flight software RELTAB emits relay-word codes 1 through 12 (octal 01 through 14). The documented row population contains 120 installed latching positions; the remaining logical positions are not physical relay packages.
- AGC Information Series Issue 30 (changed 10 Dec 1965) describes an earlier/document-era matrix as thirteen banks octal 00 through 14. That statement is preserved as a configuration-history discrepancy rather than silently merged into the Apollo 11 production model. In the flight mapping used here, logical row ordinals 1..12 correspond directly to relay-word bank codes octal 01..14; bank 00 is not emitted by Comanche055 RELTAB.
- The production DSKY references interconnect drawing 2005954, signal-flow
  drawing 2005918, and connector assignment 2005957.
- yaAGC channel 0163 is a simulator-side effective-hardware-state channel. It is
  **not** a historical Apollo AGC output channel and must never be described as
  one.

## Timing evidence and limitation

The later production BOM names relay parts 2004688 and 2004689, but this audit
has not recovered readable specification-control drawings for those two part
numbers. Therefore the simulation must not claim measured 2004688/2004689
unit-by-unit travel, bounce, pole skew, or acoustic individuality.

The readable predecessor magnetic-latching relay SCD 1006282 specifies:

- operate time: <= 3 ms
- release time: <= 3 ms
- transfer time: <= 1 ms
- contact bounce: <= 2 ms
- contact chatter under vibration/shock: <= 10 microseconds

Source: https://www.ibiblio.org/apollo/SCDs/scd_1006282-.pdf

The readable predecessor general-purpose relay SCD 1010784 specifies:

- operate time: <= 5 ms
- release time: <= 5 ms
- contact bounce: <= 2 ms

Source: https://www.ibiblio.org/apollo/SCDs/scd_1010784c.pdf

These values are retained only as conservative **predecessor-spec presentation
references**. They are not relabeled as exact production 2004688/2004689
measurements.

The AGC's roughly 20 ms DSKY relay-drive interval is a separate system-level
drive/settle allowance. It must not be confused with an individual relay's
mechanical operate/release time.

## Things we deliberately do not fabricate

- No pseudo-random per-relay operate/release time.
- No pseudo-random contact-bounce count or timing.
- No pseudo-random pole-to-pole skew.
- No claim that logical ROW/bit identity equals a specific physical D1-D6/Kx
  package slot until the interconnect crosswalk is proven.
- No claim of unique flown-unit acoustic fingerprints.
- No claim that yaAGC channel 0163 physically existed in Apollo hardware.

The app may still provide a generic synthesized relay click and a minimal phone
haptic cue. Those are presentation aids, not historical measurements.

## Open documentation questions

1. Recover readable production SCDs for relay 2004688 and 2004689.
2. Resolve the exact logical/function-to-D1-D6/K1-K22 package crosswalk from
   the production interconnect documentation.
3. Preserve the K22 documentation conflict without treating all surviving evidence as equally authoritative.

   Exact K22 delta checked against the Virtual AGC netlists:
   - original-drawing transcription 2005973-: K22 pin 2 -> J1-5, pin 3 -> J1-3, pin 8 -> J1-6.
   - original-drawing transcription 2005940A: K22 pins 2, 3, and 8 are explicitly unconnected.
   - K22 pins 1, 4, 5, 6, and 7 agree; K21 is not the differing relay.

   Provenance matters. Virtual AGC's separate `2005973r` is explicitly a 2018 reconstruction made from predecessor drawing 2005952- plus ND-1021042 figure 4-226; it is not an independently surviving production drawing. Its 2005940-like K22 wiring therefore does not outweigh the later recovered original 2005973- aperture-card drawing.

   The production-design evidence favors 2005973-: the immediate relay-circuit assembly 2003910-021 (the assembly containing the 20 x 2004688 and 2 x 2004689 relays) calls out 2005973; ND-1021042/ND-1021043 table 8-II calls out 2005973 for DSKY 2003994; and original 2005973- has later drawing/TDRR and approval chronology than 2005940A. The parent indicator-driver assembly 2003952-031 still calls out 2005940, and ND-1021042 figure 4-226 carries the older 2005940-style K22 wiring.

   Audit conclusion: use original 2005973- as the best-supported **production design basis** for K22. Do not promote that to a serial-number/as-flown claim: no unit-specific as-built or acceptance-test record has yet been recovered that independently proves the K22 contact wiring of a particular flown DSKY. The runtime still must not invent a Dn:K22 functional crosswalk until the full package/function mapping is proven.
4. Preserve and explain the 1965 Information Series 13-bank (00..14) statement versus the Apollo 11 flight-software/final-report 12-row (01..14) configuration; do not collapse them into one undocumented model.
