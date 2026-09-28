# DSKY relay-to-code map

Reconciled by the RLY-02 physical-relay audit.

This map keeps the AGC's **132 logical Channel 010 row/bit positions** separate from the relay packages that physically exist. It also maps all **12 non-latching relay functions**. The physical inventory is in `docs/physical-relay-inventory.json` and `docs/PHYSICAL_RELAY_AUDIT.md`.

## Counts

- Logical Channel 010 positions: **132** (12 × 11).
- Physically populated latching positions: **120**.
- Unpopulated logical positions: **12**.
- Physical non-latching relay functions: **12**.
- Physical relay packages total: **132**.
- Logical-position + non-latching-function entries in this code map: **144**.

A logical Channel 010 bit remains part of the AGC word even if the corresponding row/bit intersection is unpopulated. An unpopulated logical bit can therefore be stored/projected logically, but it must not create a relay armature/contact, manufacturing fingerprint, click, or haptic.

## Physical-population authority

`dsky-relay-topology.js` is the runtime authority for whether a Channel 010 row/bit has a physical latching relay. The twelve unpopulated logical positions are:

`ROW-03:B`, `ROW-08:C-K1`, `ROW-08:C-K2`, `ROW-08:C-K3`, `ROW-08:C-K4`, `ROW-08:C-K5`, `ROW-08:B`, `ROW-09:B`, `ROW-10:B`, `ROW-11:B`, `ROW-12:C-K5`, `ROW-12:B`.

## Runtime flow

```text
AGC/PHONE CLOCK logical word
  -> hardware-fidelity.js (logical latch + physical-population filter)
  -> relay-visual-coupling.js (physical contacts only)
  -> relay-identity-audio.js (physical sound/haptic identity only)
  -> agc-display-runtime.js (logical display projection)
```

## All 132 logical Channel 010 positions

| Ord | Relay ID | Row | Bit | Mask | Physical? | Physical ord | Visible/logical destination | Logical route |
|---:|---|---:|---:|---:|:---:|---:|---|---|
| 0 | `ROW-01:D-K1` | 1 | 0 | `0o0001` | YES | 0 | R3 digit 5 (index 4) | DIGIT |
| 1 | `ROW-01:D-K2` | 1 | 1 | `0o0002` | YES | 1 | R3 digit 5 (index 4) | DIGIT |
| 2 | `ROW-01:D-K3` | 1 | 2 | `0o0004` | YES | 2 | R3 digit 5 (index 4) | DIGIT |
| 3 | `ROW-01:D-K4` | 1 | 3 | `0o0010` | YES | 3 | R3 digit 5 (index 4) | DIGIT |
| 4 | `ROW-01:D-K5` | 1 | 4 | `0o0020` | YES | 4 | R3 digit 5 (index 4) | DIGIT |
| 5 | `ROW-01:C-K1` | 1 | 5 | `0o0040` | YES | 5 | R3 digit 4 (index 3) | DIGIT |
| 6 | `ROW-01:C-K2` | 1 | 6 | `0o0100` | YES | 6 | R3 digit 4 (index 3) | DIGIT |
| 7 | `ROW-01:C-K3` | 1 | 7 | `0o0200` | YES | 7 | R3 digit 4 (index 3) | DIGIT |
| 8 | `ROW-01:C-K4` | 1 | 8 | `0o0400` | YES | 8 | R3 digit 4 (index 3) | DIGIT |
| 9 | `ROW-01:C-K5` | 1 | 9 | `0o1000` | YES | 9 | R3 digit 4 (index 3) | DIGIT |
| 10 | `ROW-01:B` | 1 | 10 | `0o2000` | YES | 10 | R3 MINUS sign | SIGN |
| 11 | `ROW-02:D-K1` | 2 | 0 | `0o0001` | YES | 11 | R3 digit 3 (index 2) | DIGIT |
| 12 | `ROW-02:D-K2` | 2 | 1 | `0o0002` | YES | 12 | R3 digit 3 (index 2) | DIGIT |
| 13 | `ROW-02:D-K3` | 2 | 2 | `0o0004` | YES | 13 | R3 digit 3 (index 2) | DIGIT |
| 14 | `ROW-02:D-K4` | 2 | 3 | `0o0010` | YES | 14 | R3 digit 3 (index 2) | DIGIT |
| 15 | `ROW-02:D-K5` | 2 | 4 | `0o0020` | YES | 15 | R3 digit 3 (index 2) | DIGIT |
| 16 | `ROW-02:C-K1` | 2 | 5 | `0o0040` | YES | 16 | R3 digit 2 (index 1) | DIGIT |
| 17 | `ROW-02:C-K2` | 2 | 6 | `0o0100` | YES | 17 | R3 digit 2 (index 1) | DIGIT |
| 18 | `ROW-02:C-K3` | 2 | 7 | `0o0200` | YES | 18 | R3 digit 2 (index 1) | DIGIT |
| 19 | `ROW-02:C-K4` | 2 | 8 | `0o0400` | YES | 19 | R3 digit 2 (index 1) | DIGIT |
| 20 | `ROW-02:C-K5` | 2 | 9 | `0o1000` | YES | 20 | R3 digit 2 (index 1) | DIGIT |
| 21 | `ROW-02:B` | 2 | 10 | `0o2000` | YES | 21 | R3 PLUS sign | SIGN |
| 22 | `ROW-03:D-K1` | 3 | 0 | `0o0001` | YES | 22 | R3 digit 1 (index 0) | DIGIT |
| 23 | `ROW-03:D-K2` | 3 | 1 | `0o0002` | YES | 23 | R3 digit 1 (index 0) | DIGIT |
| 24 | `ROW-03:D-K3` | 3 | 2 | `0o0004` | YES | 24 | R3 digit 1 (index 0) | DIGIT |
| 25 | `ROW-03:D-K4` | 3 | 3 | `0o0010` | YES | 25 | R3 digit 1 (index 0) | DIGIT |
| 26 | `ROW-03:D-K5` | 3 | 4 | `0o0020` | YES | 26 | R3 digit 1 (index 0) | DIGIT |
| 27 | `ROW-03:C-K1` | 3 | 5 | `0o0040` | YES | 27 | R2 digit 5 (index 4) | DIGIT |
| 28 | `ROW-03:C-K2` | 3 | 6 | `0o0100` | YES | 28 | R2 digit 5 (index 4) | DIGIT |
| 29 | `ROW-03:C-K3` | 3 | 7 | `0o0200` | YES | 29 | R2 digit 5 (index 4) | DIGIT |
| 30 | `ROW-03:C-K4` | 3 | 8 | `0o0400` | YES | 30 | R2 digit 5 (index 4) | DIGIT |
| 31 | `ROW-03:C-K5` | 3 | 9 | `0o1000` | YES | 31 | R2 digit 5 (index 4) | DIGIT |
| 32 | `ROW-03:B` | 3 | 10 | `0o2000` | NO | — | Unrendered / mechanically modeled | MECH-ONLY |
| 33 | `ROW-04:D-K1` | 4 | 0 | `0o0001` | YES | 32 | R2 digit 4 (index 3) | DIGIT |
| 34 | `ROW-04:D-K2` | 4 | 1 | `0o0002` | YES | 33 | R2 digit 4 (index 3) | DIGIT |
| 35 | `ROW-04:D-K3` | 4 | 2 | `0o0004` | YES | 34 | R2 digit 4 (index 3) | DIGIT |
| 36 | `ROW-04:D-K4` | 4 | 3 | `0o0010` | YES | 35 | R2 digit 4 (index 3) | DIGIT |
| 37 | `ROW-04:D-K5` | 4 | 4 | `0o0020` | YES | 36 | R2 digit 4 (index 3) | DIGIT |
| 38 | `ROW-04:C-K1` | 4 | 5 | `0o0040` | YES | 37 | R2 digit 3 (index 2) | DIGIT |
| 39 | `ROW-04:C-K2` | 4 | 6 | `0o0100` | YES | 38 | R2 digit 3 (index 2) | DIGIT |
| 40 | `ROW-04:C-K3` | 4 | 7 | `0o0200` | YES | 39 | R2 digit 3 (index 2) | DIGIT |
| 41 | `ROW-04:C-K4` | 4 | 8 | `0o0400` | YES | 40 | R2 digit 3 (index 2) | DIGIT |
| 42 | `ROW-04:C-K5` | 4 | 9 | `0o1000` | YES | 41 | R2 digit 3 (index 2) | DIGIT |
| 43 | `ROW-04:B` | 4 | 10 | `0o2000` | YES | 42 | R2 MINUS sign | SIGN |
| 44 | `ROW-05:D-K1` | 5 | 0 | `0o0001` | YES | 43 | R2 digit 2 (index 1) | DIGIT |
| 45 | `ROW-05:D-K2` | 5 | 1 | `0o0002` | YES | 44 | R2 digit 2 (index 1) | DIGIT |
| 46 | `ROW-05:D-K3` | 5 | 2 | `0o0004` | YES | 45 | R2 digit 2 (index 1) | DIGIT |
| 47 | `ROW-05:D-K4` | 5 | 3 | `0o0010` | YES | 46 | R2 digit 2 (index 1) | DIGIT |
| 48 | `ROW-05:D-K5` | 5 | 4 | `0o0020` | YES | 47 | R2 digit 2 (index 1) | DIGIT |
| 49 | `ROW-05:C-K1` | 5 | 5 | `0o0040` | YES | 48 | R2 digit 1 (index 0) | DIGIT |
| 50 | `ROW-05:C-K2` | 5 | 6 | `0o0100` | YES | 49 | R2 digit 1 (index 0) | DIGIT |
| 51 | `ROW-05:C-K3` | 5 | 7 | `0o0200` | YES | 50 | R2 digit 1 (index 0) | DIGIT |
| 52 | `ROW-05:C-K4` | 5 | 8 | `0o0400` | YES | 51 | R2 digit 1 (index 0) | DIGIT |
| 53 | `ROW-05:C-K5` | 5 | 9 | `0o1000` | YES | 52 | R2 digit 1 (index 0) | DIGIT |
| 54 | `ROW-05:B` | 5 | 10 | `0o2000` | YES | 53 | R2 PLUS sign | SIGN |
| 55 | `ROW-06:D-K1` | 6 | 0 | `0o0001` | YES | 54 | R1 digit 5 (index 4) | DIGIT |
| 56 | `ROW-06:D-K2` | 6 | 1 | `0o0002` | YES | 55 | R1 digit 5 (index 4) | DIGIT |
| 57 | `ROW-06:D-K3` | 6 | 2 | `0o0004` | YES | 56 | R1 digit 5 (index 4) | DIGIT |
| 58 | `ROW-06:D-K4` | 6 | 3 | `0o0010` | YES | 57 | R1 digit 5 (index 4) | DIGIT |
| 59 | `ROW-06:D-K5` | 6 | 4 | `0o0020` | YES | 58 | R1 digit 5 (index 4) | DIGIT |
| 60 | `ROW-06:C-K1` | 6 | 5 | `0o0040` | YES | 59 | R1 digit 4 (index 3) | DIGIT |
| 61 | `ROW-06:C-K2` | 6 | 6 | `0o0100` | YES | 60 | R1 digit 4 (index 3) | DIGIT |
| 62 | `ROW-06:C-K3` | 6 | 7 | `0o0200` | YES | 61 | R1 digit 4 (index 3) | DIGIT |
| 63 | `ROW-06:C-K4` | 6 | 8 | `0o0400` | YES | 62 | R1 digit 4 (index 3) | DIGIT |
| 64 | `ROW-06:C-K5` | 6 | 9 | `0o1000` | YES | 63 | R1 digit 4 (index 3) | DIGIT |
| 65 | `ROW-06:B` | 6 | 10 | `0o2000` | YES | 64 | R1 MINUS sign | SIGN |
| 66 | `ROW-07:D-K1` | 7 | 0 | `0o0001` | YES | 65 | R1 digit 3 (index 2) | DIGIT |
| 67 | `ROW-07:D-K2` | 7 | 1 | `0o0002` | YES | 66 | R1 digit 3 (index 2) | DIGIT |
| 68 | `ROW-07:D-K3` | 7 | 2 | `0o0004` | YES | 67 | R1 digit 3 (index 2) | DIGIT |
| 69 | `ROW-07:D-K4` | 7 | 3 | `0o0010` | YES | 68 | R1 digit 3 (index 2) | DIGIT |
| 70 | `ROW-07:D-K5` | 7 | 4 | `0o0020` | YES | 69 | R1 digit 3 (index 2) | DIGIT |
| 71 | `ROW-07:C-K1` | 7 | 5 | `0o0040` | YES | 70 | R1 digit 2 (index 1) | DIGIT |
| 72 | `ROW-07:C-K2` | 7 | 6 | `0o0100` | YES | 71 | R1 digit 2 (index 1) | DIGIT |
| 73 | `ROW-07:C-K3` | 7 | 7 | `0o0200` | YES | 72 | R1 digit 2 (index 1) | DIGIT |
| 74 | `ROW-07:C-K4` | 7 | 8 | `0o0400` | YES | 73 | R1 digit 2 (index 1) | DIGIT |
| 75 | `ROW-07:C-K5` | 7 | 9 | `0o1000` | YES | 74 | R1 digit 2 (index 1) | DIGIT |
| 76 | `ROW-07:B` | 7 | 10 | `0o2000` | YES | 75 | R1 PLUS sign | SIGN |
| 77 | `ROW-08:D-K1` | 8 | 0 | `0o0001` | YES | 76 | R1 digit 1 (index 0) | DIGIT |
| 78 | `ROW-08:D-K2` | 8 | 1 | `0o0002` | YES | 77 | R1 digit 1 (index 0) | DIGIT |
| 79 | `ROW-08:D-K3` | 8 | 2 | `0o0004` | YES | 78 | R1 digit 1 (index 0) | DIGIT |
| 80 | `ROW-08:D-K4` | 8 | 3 | `0o0010` | YES | 79 | R1 digit 1 (index 0) | DIGIT |
| 81 | `ROW-08:D-K5` | 8 | 4 | `0o0020` | YES | 80 | R1 digit 1 (index 0) | DIGIT |
| 82 | `ROW-08:C-K1` | 8 | 5 | `0o0040` | NO | — | Visually unconnected C digit bank | MECH-ONLY |
| 83 | `ROW-08:C-K2` | 8 | 6 | `0o0100` | NO | — | Visually unconnected C digit bank | MECH-ONLY |
| 84 | `ROW-08:C-K3` | 8 | 7 | `0o0200` | NO | — | Visually unconnected C digit bank | MECH-ONLY |
| 85 | `ROW-08:C-K4` | 8 | 8 | `0o0400` | NO | — | Visually unconnected C digit bank | MECH-ONLY |
| 86 | `ROW-08:C-K5` | 8 | 9 | `0o1000` | NO | — | Visually unconnected C digit bank | MECH-ONLY |
| 87 | `ROW-08:B` | 8 | 10 | `0o2000` | NO | — | Unrendered / mechanically modeled | MECH-ONLY |
| 88 | `ROW-09:D-K1` | 9 | 0 | `0o0001` | YES | 81 | NOUN right digit | DIGIT |
| 89 | `ROW-09:D-K2` | 9 | 1 | `0o0002` | YES | 82 | NOUN right digit | DIGIT |
| 90 | `ROW-09:D-K3` | 9 | 2 | `0o0004` | YES | 83 | NOUN right digit | DIGIT |
| 91 | `ROW-09:D-K4` | 9 | 3 | `0o0010` | YES | 84 | NOUN right digit | DIGIT |
| 92 | `ROW-09:D-K5` | 9 | 4 | `0o0020` | YES | 85 | NOUN right digit | DIGIT |
| 93 | `ROW-09:C-K1` | 9 | 5 | `0o0040` | YES | 86 | NOUN left digit | DIGIT |
| 94 | `ROW-09:C-K2` | 9 | 6 | `0o0100` | YES | 87 | NOUN left digit | DIGIT |
| 95 | `ROW-09:C-K3` | 9 | 7 | `0o0200` | YES | 88 | NOUN left digit | DIGIT |
| 96 | `ROW-09:C-K4` | 9 | 8 | `0o0400` | YES | 89 | NOUN left digit | DIGIT |
| 97 | `ROW-09:C-K5` | 9 | 9 | `0o1000` | YES | 90 | NOUN left digit | DIGIT |
| 98 | `ROW-09:B` | 9 | 10 | `0o2000` | NO | — | Unrendered / mechanically modeled | MECH-ONLY |
| 99 | `ROW-10:D-K1` | 10 | 0 | `0o0001` | YES | 91 | VERB right digit | DIGIT |
| 100 | `ROW-10:D-K2` | 10 | 1 | `0o0002` | YES | 92 | VERB right digit | DIGIT |
| 101 | `ROW-10:D-K3` | 10 | 2 | `0o0004` | YES | 93 | VERB right digit | DIGIT |
| 102 | `ROW-10:D-K4` | 10 | 3 | `0o0010` | YES | 94 | VERB right digit | DIGIT |
| 103 | `ROW-10:D-K5` | 10 | 4 | `0o0020` | YES | 95 | VERB right digit | DIGIT |
| 104 | `ROW-10:C-K1` | 10 | 5 | `0o0040` | YES | 96 | VERB left digit | DIGIT |
| 105 | `ROW-10:C-K2` | 10 | 6 | `0o0100` | YES | 97 | VERB left digit | DIGIT |
| 106 | `ROW-10:C-K3` | 10 | 7 | `0o0200` | YES | 98 | VERB left digit | DIGIT |
| 107 | `ROW-10:C-K4` | 10 | 8 | `0o0400` | YES | 99 | VERB left digit | DIGIT |
| 108 | `ROW-10:C-K5` | 10 | 9 | `0o1000` | YES | 100 | VERB left digit | DIGIT |
| 109 | `ROW-10:B` | 10 | 10 | `0o2000` | NO | — | Unrendered / mechanically modeled | MECH-ONLY |
| 110 | `ROW-11:D-K1` | 11 | 0 | `0o0001` | YES | 101 | PROG right digit | DIGIT |
| 111 | `ROW-11:D-K2` | 11 | 1 | `0o0002` | YES | 102 | PROG right digit | DIGIT |
| 112 | `ROW-11:D-K3` | 11 | 2 | `0o0004` | YES | 103 | PROG right digit | DIGIT |
| 113 | `ROW-11:D-K4` | 11 | 3 | `0o0010` | YES | 104 | PROG right digit | DIGIT |
| 114 | `ROW-11:D-K5` | 11 | 4 | `0o0020` | YES | 105 | PROG right digit | DIGIT |
| 115 | `ROW-11:C-K1` | 11 | 5 | `0o0040` | YES | 106 | PROG left digit | DIGIT |
| 116 | `ROW-11:C-K2` | 11 | 6 | `0o0100` | YES | 107 | PROG left digit | DIGIT |
| 117 | `ROW-11:C-K3` | 11 | 7 | `0o0200` | YES | 108 | PROG left digit | DIGIT |
| 118 | `ROW-11:C-K4` | 11 | 8 | `0o0400` | YES | 109 | PROG left digit | DIGIT |
| 119 | `ROW-11:C-K5` | 11 | 9 | `0o1000` | YES | 110 | PROG left digit | DIGIT |
| 120 | `ROW-11:B` | 11 | 10 | `0o2000` | NO | — | Unrendered / mechanically modeled | MECH-ONLY |
| 121 | `ROW-12:D-K1` | 12 | 0 | `0o0001` | YES | 111 | Unrendered / reserved in current CM projection | MECH-ONLY |
| 122 | `ROW-12:D-K2` | 12 | 1 | `0o0002` | YES | 112 | Unrendered / reserved in current CM projection | MECH-ONLY |
| 123 | `ROW-12:D-K3` | 12 | 2 | `0o0004` | YES | 113 | VEL condition lamp | COND |
| 124 | `ROW-12:D-K4` | 12 | 3 | `0o0010` | YES | 114 | NO ATT condition lamp | COND |
| 125 | `ROW-12:D-K5` | 12 | 4 | `0o0020` | YES | 115 | ALT condition lamp | COND |
| 126 | `ROW-12:C-K1` | 12 | 5 | `0o0040` | YES | 116 | GIMBAL LOCK condition lamp | COND |
| 127 | `ROW-12:C-K2` | 12 | 6 | `0o0100` | YES | 117 | Unrendered / reserved in current CM projection | MECH-ONLY |
| 128 | `ROW-12:C-K3` | 12 | 7 | `0o0200` | YES | 118 | TRACKER condition lamp | COND |
| 129 | `ROW-12:C-K4` | 12 | 8 | `0o0400` | YES | 119 | PROG condition lamp | COND |
| 130 | `ROW-12:C-K5` | 12 | 9 | `0o1000` | NO | — | Unrendered / reserved in current CM projection | MECH-ONLY |
| 131 | `ROW-12:B` | 12 | 10 | `0o2000` | NO | — | Unrendered / reserved in current CM projection | MECH-ONLY |

## Twelve physical non-latching relay functions

| Map ord | Physical ord | Relay ID | Signal | Runtime source | Destination | Route |
|---:|---:|---|---:|---|---|---|
| 132 | 120 | `AUX:ISS-WARNING` | 229 | `0o011` / `0o00001` (channel-command) | External ISS WARNING indication | AUX-EXTERNAL |
| 133 | 121 | `AUX:COMP-ACTY` | 230 | `0o011` / `0o00002` (channel-command) | COMP ACTY lamp | AUX-LAMP |
| 134 | 122 | `AUX:STBY` | 231 | `0o163` / `0o00400` (hardware-phase) | STBY lamp | AUX-LAMP |
| 135 | 123 | `AUX:RESTART` | 232 | `0o163` / `0o00200` (hardware-phase) | RESTART lamp | AUX-LAMP |
| 136 | 124 | `AUX:INJ-SEQ-START` | 233 | `0o012` / `0o10000` (channel-command) | External S-IVB INJ SEQ START / G HIGH indication (CM) | AUX-EXTERNAL |
| 137 | 125 | `AUX:CUTOFF` | 234 | `0o012` / `0o20000` (channel-command) | External S-IVB CUTOFF / G LOW indication (CM) | AUX-EXTERNAL |
| 138 | 126 | `AUX:UPLINK-ACTY` | 235 | `0o011` / `0o00004` (channel-command) | UPLINK ACTY lamp | AUX-LAMP |
| 139 | 127 | `AUX:KEY-REL` | 236 | `0o163` / `0o00020` (hardware-phase) | KEY REL lamp | AUX-LAMP |
| 140 | 128 | `AUX:CIRCUIT-WARNING` | 237 | `0o163` / `0o00001` (hardware-phase) | External CMC/LGC warning indication | AUX-EXTERNAL |
| 141 | 129 | `AUX:FLASH` | 238 | `0o163` / `0o00040` (hardware-phase) | VERB/NOUN flash blanking contact | AUX-FLASH |
| 142 | 130 | `AUX:OPR-ERR` | 244 | `0o163` / `0o00100` (hardware-phase) | OPR ERR lamp | AUX-LAMP |
| 143 | 131 | `AUX:TEMP` | 258 | `0o163` / `0o00010` (hardware-phase) | TEMP lamp | AUX-LAMP |

## Evidence boundary

The six D1-D6 modules contain K1-K20 latching and K21-K22 non-latching relay packages, giving 132 exact physical package slots. The source join now proves the complete production design-basis crosswalk: all 120 latching identities and all 12 non-latching function drives map one-to-one to D1-D6/K1-K22. `docs/physical-relay-inventory.json` records the physical inventory and provenance. Exact 2004688/2004689 mechanical timing remains unrecovered.
