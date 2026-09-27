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
- Apollo 11 CM-107 / G&N System 210 is now tied to that exact DSKY
  production branch rather than by generic mission association alone. MIT/IL
  E-1142 Rev. 60 records the CM-107 main DSKY as 2003994-051 S/N 53 and
  navigation DSKY as 2003994-051 S/N 66 on 1 January 1969. E-1142 Rev. 61
  records the same serial numbers at KSC on 1 April 1969 after both units had
  been updated to **2003994-121**. The 2003994-121 assembly tree contains six
  2003952-031 indicator-driver modules, whose 2003910-021 relay circuit
  assemblies contain the 20 x 2004688-1/-2 plus 2 x 2004689-2 population and
  call out schematic 2005973. This strengthens the Apollo 11 production-design
  provenance for the relay inventory without resolving unit-specific K22
  switched-contact wiring or exact production relay timing.
  Sources: https://www.ibiblio.org/apollo/Documents/E1142-60.pdf ;
  https://www.ibiblio.org/apollo/Documents/E1142-61.pdf ;
  https://www.ibiblio.org/apollo/2003994-121.html
- The production/flight Channel 010 mapping uses 12 selected relay-word rows with up to 11 relay-bit positions. MIT/IL R-700 describes selection of "1 row out of 12", and Apollo 11 Comanche055 flight software RELTAB emits relay-word codes 1 through 12 (octal 01 through 14). The documented row population contains 120 installed latching positions; the remaining logical positions are not physical relay packages.
- AGC Information Series Issue 30 (changed 10 Dec 1965) describes an earlier/document-era matrix as thirteen banks octal 00 through 14. That statement is preserved as a configuration-history discrepancy rather than silently merged into the Apollo 11 production model. In the flight mapping used here, logical row ordinals 1..12 correspond directly to relay-word bank codes octal 01..14; bank 00 is not emitted by Comanche055 RELTAB.
- The production DSKY references interconnect drawing 2005954, signal-flow
  drawing 2005918, and connector assignment 2005957.
- yaAGC channel 0163 is a simulator-side effective-hardware-state channel. It is
  **not** a historical Apollo AGC output channel and must never be described as
  one.
- The source-joined 2005918 + 2005954A + 2005973 latching crosswalk yields
  **120 unique physical-package matches, 12 unpopulated logical positions,
  and zero ambiguous matches**. The machine-readable join is
  `docs/relay-logical-physical-crosswalk-2005918.json`.

## Timing evidence and limitation

The production relay-circuit assembly identifies relay parts 2004688-1/-2 and
2004689-2, and production-design schematic 2005973 explicitly identifies K21
and K22 as 2004689-2 and states that their relay circuit switches from the
shown position when positive voltage is applied on relay pin 1. That closes the
non-latching drive-pin/dash question used for the function-to-package join.

This audit still has not recovered readable specification-control drawings for
production relay 2004688 or 2004689-2 that establish exact mechanical timing.
Therefore the simulation must not claim measured 2004688/2004689-2
unit-by-unit travel, bounce, pole skew, or acoustic individuality.

A 2026-09-27 follow-up search checked the public Apollo/Virtual AGC material and
GitHub code indexing for `2004688`, `2004688-1`, `2004688-2`,
`2004689`, and `2004689-2`. The production assembly and schematic evidence
now establish the installed 2004689-2 dash number and its K21/K22 drive
instruction, but no readable production relay SCD was recovered for exact
mechanical timing. This remains a negative timing-evidence checkpoint, not
proof that the SCD never existed. Repeating the same indexed-source search must
not be treated as new timing evidence unless a new scan/catalog record is
found.

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
- No claim that the proven K21/K22 drive-function mapping also resolves exact
  2004689-2 mechanical timing or the disputed K22 switched-contact wiring of a
  particular flown DSKY.
- No claim of unique flown-unit acoustic fingerprints.
- No claim that yaAGC channel 0163 physically existed in Apollo hardware.

The app may still provide a generic synthesized relay click and a minimal phone
haptic cue. Those are presentation aids, not historical measurements.

## Open documentation questions

1. Recover readable production SCDs for relay 2004688 and 2004689.
2. Preserve the now-proven non-latching function-to-package drive join.

   **All 12 K21/K22 function drives are now source-joined at the production
   design-document level.** Original 2005954A routes the external annunciator
   controls to module terminals 85/86. Drawing 2005973 routes terminal 85
   through R22/C6/Q12 to terminal 87; 2005954A loops 87 to terminal 4, and
   2005973 connects terminal 4 to K22 pin 1. Terminal 86 similarly routes
   through R24/C7/Q13 to terminal 95; 2005954A loops 95 to terminal 7, and
   2005973 connects terminal 7 to K21 pin 1. K21/K22 pin 5 returns through
   module terminal 26. Drawing 2005973 explicitly calls K21/K22
   **2004689-2** and states that the relay circuit switches from the shown
   position when positive voltage is applied on pin 1.

   The resulting mapping is:
   - D1: K22 FLASH; K21 OPR ERROR.
   - D2: K22 KEY REL; K21 TEMP CAUTION.
   - D3: K22 UPLINK ACTY; K21 RESTART.
   - D4: K22 COMP ACTY; K21 ISS WARNING.
   - D5: K22 INJ SEQ START; K21 STBY.
   - D6: K22 CUTOFF; K21 CIRCUIT.

   This is independently robust to the 2005973-vs-2005940A disagreement:
   both schematic transcriptions use the same K21/K22 pin-1 drive and pin-5
   common topology. Their difference is in **K22 switched contacts**, not the
   drive coil. The machine-readable proof is
   `docs/relay-package-functional-crosswalk-2005954A-2005973.json`.

   This closes the function-to-package drive crosswalk only. Exact
   2004689-2 operate/release/bounce timing remains unknown, and the K22
   contact-wiring conflict remains bounded below rather than silently resolved.

3. Preserve the K22 documentation conflict without treating all surviving evidence as equally authoritative.

   Exact K22 delta checked against the Virtual AGC netlists:
   - original-drawing transcription 2005973-: K22 pin 2 -> J1-5, pin 3 -> J1-3, pin 8 -> J1-6.
   - original-drawing transcription 2005940A: K22 pins 2, 3, and 8 are explicitly unconnected.
   - K22 pins 1, 4, 5, 6, and 7 agree; K21 is not the differing relay.

   Provenance matters. Virtual AGC's separate `2005973r` is explicitly a 2018 reconstruction made from predecessor drawing 2005952- plus ND-1021042 figure 4-226; it is not an independently surviving production drawing. Its 2005940-like K22 wiring therefore does not outweigh the later recovered original 2005973- aperture-card drawing.

   The production-design evidence favors 2005973-: the immediate relay-circuit assembly 2003910-021 (the assembly containing the 20 x 2004688 and 2 x 2004689 relays) calls out 2005973; ND-1021042/ND-1021043 table 8-II calls out 2005973 for DSKY 2003994; and original 2005973- has later drawing/TDRR and approval chronology than 2005940A. The parent indicator-driver assembly 2003952-031 still calls out 2005940, and ND-1021042 figure 4-226 carries the older 2005940-style K22 wiring.

   Audit conclusion: use original 2005973- as the best-supported **production design basis** for K22. Do not promote that to a serial-number/as-flown claim: no unit-specific as-built or acceptance-test record has yet been recovered that independently proves the K22 contact wiring of a particular flown DSKY. The K22 function-to-package **drive** mapping is now proven as described above; the remaining dispute is K22 switched-contact wiring, not which external function actuates the package.
4. Preserve and explain the 1965 Information Series 13-bank (00..14) statement versus the Apollo 11 flight-software/final-report 12-row (01..14) configuration; do not collapse them into one undocumented model.
