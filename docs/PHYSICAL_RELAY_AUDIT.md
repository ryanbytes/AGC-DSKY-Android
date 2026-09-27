# Block II DSKY physical relay inventory (RLY-02)

This inventory distinguishes the **logical 11-bit Channel 010 relay-control word** from the **physical relay packages actually installed** in the Block II DSKY.

## Verified physical population

- Six D1-D6 indicator-driver modules.
- Each module has 20 latching relay packages (K1-K20) and two non-latching relay packages (K21-K22).
- Physical total: **120 latching + 12 non-latching = 132 relay packages**.
- The logical Channel 010 space is 12 rows × 11 controls = 132 possible row/bit positions, but **12 of those positions are not populated by physical latching relays**.

### Unpopulated logical Channel 010 positions

`ROW-03:B`; `ROW-08:C-K1..C-K5`; `ROW-08:B`; `ROW-09:B`; `ROW-10:B`; `ROW-11:B`; `ROW-12:C-K5`; `ROW-12:B`.

That leaves **120 physically populated latching positions**.

## Twelve non-latching relay functions

| Signal | Model identity | Runtime authority | Physical effect |
|---:|---|---|---|
| 229 | ISS WARNING | CH011 bit 1 | external ISS WARNING |
| 230 | COMP ACTY | CH011 bit 2 | DSKY COMP ACTY |
| 231 | STBY | hardware-phase CH0163 bit 0400 | DSKY STBY |
| 232 | RESTART | hardware-phase CH0163 bit 0200 | DSKY RESTART |
| 233 | INJ SEQ START | CH012 bit 13 | CM external S-IVB/G HIGH indication |
| 234 | CUTOFF | CH012 bit 14 | CM external S-IVB/G LOW indication |
| 235 | UPLINK ACTY | CH011 bit 3 | DSKY UPLINK ACTY |
| 236 | KEY REL | hardware-phase CH0163 bit 0020 | DSKY KEY REL |
| 237 | CIRCUIT / CMC-LGC WARNING | hardware-phase CH0163 bit 0001 | external computer warning |
| 238 | FLASH | hardware-phase CH0163 bit 0040 | VERB/NOUN flash contact |
| 244 | OPR ERR | hardware-phase CH0163 bit 0100 | DSKY OPR ERR |
| 258 | TEMP | hardware-phase CH0163 bit 0010 | DSKY TEMP |

The hardware-phase CH0163 source is intentionally used where yaAGC models hardware behavior rather than merely the originating AGC command. This preserves the previously verified FLASH contact/visible-phase synchronization.

## Mechanical package-slot inventory

The file `docs/physical-relay-inventory.json` enumerates every actual package slot `D1:K1` through `D6:K22` — **132 unique slots**. K1-K20 are latching, K21-K22 are non-latching.

The surviving/digitized sources used in this audit do not yet establish a complete one-to-one crosswalk from every logical/function identity to a specific D1-D6/K-number package. The model therefore does **not** invent that mapping. Runtime fidelity is keyed to the proven logical/function identity and physical-population mask.

## Runtime fidelity rule

A logical Channel 010 bit can still participate in AGC word semantics even when no relay package occupies that logical intersection. Such a bit may be stored in the logical word, but it must **not** generate a physical relay armature/contact event, manufacturing fingerprint, click, or haptic.

The 12 non-latching functions use only their real sourced control/hardware-phase signals. No synthetic status transitions are added.
