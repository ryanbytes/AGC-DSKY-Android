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
- The Channel 010 logical field has 12 selected physical rows with up to 11
  relay-bit positions. The documented row population contains 120 installed
  latching positions; the remaining logical positions are not physical relay
  packages.
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
3. Reconcile the surviving K22 wiring disagreement between 2005973 and 2005940
   transcriptions before assigning that package to a specific function.
