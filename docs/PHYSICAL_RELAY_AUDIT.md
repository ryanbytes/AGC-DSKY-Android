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

The source join is now complete at the production design-document level. Original 2005918 plus 2005954A/2005973 maps all **120 latching** logical Channel 010 identities one-to-one to D1-D6/K1-K20, and the 2005954A terminal-85/86 paths joined through the 2005973 Q12/Q13 drive network map all **12 non-latching** functions one-to-one to D1-D6/K21-K22. For the established 2003910-021 / 2003952-031 configuration, K22 switched-contact topology is now also resolved by 2003910 Rev E assembly instructions.

The former 2005940A-vs-2005973 K22 discrepancy is reconciled by the Rev E -021 assembly jumpers: **K22-8 to K22-4, K22-7 to K22-3, and K22-6 to K22-2**. In 2005940A, pins 6/7/4 lead to J1-5/J1-3/J1-6 while pins 2/3/8 are open; installing the specified jumpers yields the 2005973 connectivity exactly. The immediate relay-circuit assembly 2003910-021 also calls out original drawing **2005973-**, and the system manual's DSKY 2003994 table likewise calls out 2005973. This proves the 2005973 K22 topology for the 2003910-021 / 2003952-031 configuration.

Mission/system provenance is also established for the Apollo 11 LM configuration: Virtual AGC's NASA-perspective mission hierarchy identifies **6014999-091** as G&N system serial **609** for LM-5/Apollo 11, and the generated 6014999-091 engineering drilldown contains DSKY **2003994-091**, which contains six **2003952-031** indicator-driver modules, each containing **2003910-021**. This establishes the Rev-E-resolved K22 topology at the Apollo 11 LM mission/G&N-system configuration level. The remaining provenance gap is narrower: the individual engraved/physical **DSKY chassis serial number** has not been identified here, so no chassis-serial-specific claim is made beyond the configuration-controlled hierarchy.

## Runtime fidelity rule

A logical Channel 010 bit can still participate in AGC word semantics even when no relay package occupies that logical intersection. Such a bit may be stored in the logical word, but it must **not** generate a physical relay armature/contact event, manufacturing fingerprint, click, or haptic.

The 12 non-latching functions use only their real sourced control/hardware-phase signals. No synthetic status transitions are added.
