# DSKY indicator-driver timing evidence — PS 2016009

This note separates three timing layers that must not be conflated in the Block II
DSKY relay model:

1. **AGC software output hold** — Comanche 055 writes Channel 010, schedules
   `HANG20`, then clears `OUT0` on the 20-ms T4RUPT return. This establishes a
   20-ms software command/hold interval; it is not a measurement of relay
   armature travel.
2. **Indicator-driver electronics** — Apollo G&N specification PS 2016009,
   acceptance requirements for indicator-driver module 2003952-031, gives
   driver pulse widths and electronic propagation delays.
3. **Individual relay mechanics** — exact production 2004688/2004689-2
   operate/release/bounce timing remains unrecovered. The app therefore keeps
   predecessor SCD 1006282/1010784 values only as explicitly labeled
   presentation references.

## Primary acceptance-test source

Drawing/specification: **PS 2016009 — Configuration & Acceptance Test
Requirements, Indicator Driver Module, Drawing No. 2003952**.

Recovered from NARA aperture-card Box 466 through the Internet Archive item
`apertureCardBox466Part1NARASW_images`. The indexed revision sequence is:

- Rev A: sheets 1–14, scans n183–n196.
- Rev B: changed sheets 1, 8, 9, scans n197–n199.
- Rev C: changed sheets 1, 2, 3, scans n200–n202.
- Rev D: changed sheets 1, 2, 3, scans n203–n205.
- Rev E: changed sheets 1, 2, scans n206–n207.
- Rev F: changed sheets 1, 2, scans n208–n209.

Rev F sheet 2 explicitly identifies PS 2016009 as an addendum to **PS 2003952
Revision F**. The unrecovered PS 2003952 base specification therefore remains a
separate evidence target where PS 2016009 says "Same as PS 2003952."

Relevant source-image SHA-256 values:

- n187 / Rev A sheet 5:
  `a74b976cd7e406ef69bd995876d65aae3815b555f64a99c4a3d7012ff4cbe024`
- n188 / Rev A sheet 6:
  `280bfcdb258a4fbb077ce2df6943eed2382e6f0243089a66d82c058030f06b72`
- n190 / Rev A sheet 8:
  `6fc8f14fee7e17be6060051f2d639b5fccc99fcda6d01ee55b09fafea038523f`
- n191 / Rev A sheet 9:
  `39d15894fa125a251970c44ab58c7b2e2c6d11f68ccad5443275157eac5ba85c`
- n198 / Rev B sheet 8:
  `68da47c4ff1e94c003a44ad30c50e445bf5d8e35e0635e3547a27033f47232dd`
- n199 / Rev B sheet 9:
  `8be983d4f0e570009997a9a8d832562a09f675d38de9adafc3217a06d2d22d21`
- n208 / Rev F sheet 1:
  `7eb12da57aef17bdf0fe38f159397fd73e05706281cad8262b9802d41ff64ce7`
- n209 / Rev F sheet 2:
  `c79a58b1127d20d176beaf121a2976fe73c3a462ed05398437a31e7892b1075c`

The complete 27-scan acquisition artifact was independently fetched with HTTP
success through GitHub Actions; artifact digest:
`sha256:6870ae6c689d73d8077fb5177e75ca818f67c49255a90e20c10e7b74ba264df1`.

## What PS 2016009 proves

### Relay contact functional acceptance

Rev A sheets 5–6 (unchanged by the later revision-card set) require the indicated
relay contact closures when **17.5 ±0.1 VDC** is applied to designated module
inputs for **15.0 +0.0 / -1.5 ms** in paragraphs 3.1.18 through 3.1.22.

This proves a module-level functional requirement under a 13.5–15.0 ms command
pulse. It does **not** establish the exact instant at which a production
2004688 armature or contact transfers.

### Driver pulse and propagation timing

Rev B sheets 8–9 supersede the corresponding Rev A sheets. No later revision in
the indexed C–F change-page set replaces sheets 8 or 9.

The Rev B figures specify:

- alarm-driver output pulse width: **15 ±10 ms**;
- Y-line-driver output pulse width: **15 ±10 ms**;
- nominal driver delay TD1: **65 ±40 µs**;
- nominal driver delay TD2: **20 ±15 µs**;
- a separate high-voltage-extreme delay note of **45 +45 / -27 µs**.

These are driver-electronics acceptance characteristics. They are not relay
mechanical operate/release measurements.

## Flight-software hold interval

Apollo 11 Comanche 055 T4RUPT code writes Channel 010 and immediately branches
to `HANG20`; `HANG20` loads `20MRUPT` into TIME4. The subsequent
`NODSPOUT` path writes zero to `OUT0`, explicitly turning off relays. The
Programmed Guidance Equations independently describe HANG20 as setting TIME4
for an interrupt in 20 ms.

Sources:

- https://www.ibiblio.org/apollo/listings/Comanche055/T4RUPT_PROGRAM.agc.html
- https://www.ibiblio.org/apollo/Documents/programmed-guidance-equations-colossus-3-002_text.pdf

Therefore the app may retain a **20-ms software row-command hold boundary**.
It must not label that interval as measured production-relay settle time.

## Simulation consequence

Current source-bounded presentation already changes a visible latching contact at
the predecessor-reference armature event (3 ms) and uses the 20-ms boundary only
for settled row state / software-hold bookkeeping. No timing behavior change is
required from PS 2016009.

The remaining timing unknown is still exact production **2004688/2004689-2
mechanical operate/release/bounce behavior**. Recovering PS 2003952 Revision F
or the production relay SCDs could narrow that unknown; until then, no exact
production mechanical timing may be claimed.
