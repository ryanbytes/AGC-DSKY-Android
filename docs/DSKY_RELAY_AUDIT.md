# Block II DSKY physical relay audit (RLY-02)

Date: 2026-09-26

This file is the explicit no-skips inventory for the relay-fidelity audit. The physical Block II DSKY contains **132 relays total: 120 magnetic-latching matrix relays plus 12 non-latching status/caution relays**. The old software assumption of 132 latching + 8 auxiliary relays was wrong.

## Evidence and interpretation

- D1-D6 each contain 20 type 1006282/2004688 magnetic-latching relays and 2 type 1010784/2004689 non-latching relays.
- Channel 010 is 11 data bits wide, but only 120 of the possible 132 row/bit positions are physically populated.
- SCD 1006282 bounds latching-relay operate and release time to 3 ms maximum and contact bounce to 2 ms maximum. The 20 ms HANG20 interval is the DSKY bank-drive/settle envelope, not armature travel.
- The 12 non-latching functional sources are enumerated below. Their **electrical/function mapping is audited**, but exact 1010784 mechanical timing remains OPEN because the primary timing table has not yet been retrieved. Runtime timing for those relays must remain labeled unverified rather than presented as measured Apollo data.
- Channel 0163 is VirtualAGC's effective DSKY hardware-state output for hardware-modulated conditions such as TEMP, KEY REL, FLASH, OPR ERR, RESTART, warning and STBY; it is not a literal AGC output register.

## 120 latching matrix relays

| # | Physical identity | Function | AGC source | Timing | Runtime event path |
|---:|---|---|---|---|---|
| 1 | ROW-01:D-K1 | R3-D5-K1 | CH010 row 1, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 2 | ROW-01:D-K2 | R3-D5-K2 | CH010 row 1, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 3 | ROW-01:D-K3 | R3-D5-K3 | CH010 row 1, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 4 | ROW-01:D-K4 | R3-D5-K4 | CH010 row 1, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 5 | ROW-01:D-K5 | R3-D5-K5 | CH010 row 1, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 6 | ROW-01:C-K1 | R3-D4-K1 | CH010 row 1, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 7 | ROW-01:C-K2 | R3-D4-K2 | CH010 row 1, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 8 | ROW-01:C-K3 | R3-D4-K3 | CH010 row 1, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 9 | ROW-01:C-K4 | R3-D4-K4 | CH010 row 1, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 10 | ROW-01:C-K5 | R3-D4-K5 | CH010 row 1, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 11 | ROW-01:B | R3-MINUS | CH010 row 1, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 12 | ROW-02:D-K1 | R3-D3-K1 | CH010 row 2, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 13 | ROW-02:D-K2 | R3-D3-K2 | CH010 row 2, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 14 | ROW-02:D-K3 | R3-D3-K3 | CH010 row 2, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 15 | ROW-02:D-K4 | R3-D3-K4 | CH010 row 2, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 16 | ROW-02:D-K5 | R3-D3-K5 | CH010 row 2, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 17 | ROW-02:C-K1 | R3-D2-K1 | CH010 row 2, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 18 | ROW-02:C-K2 | R3-D2-K2 | CH010 row 2, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 19 | ROW-02:C-K3 | R3-D2-K3 | CH010 row 2, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 20 | ROW-02:C-K4 | R3-D2-K4 | CH010 row 2, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 21 | ROW-02:C-K5 | R3-D2-K5 | CH010 row 2, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 22 | ROW-02:B | R3-PLUS | CH010 row 2, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 23 | ROW-03:D-K1 | R3-D1-K1 | CH010 row 3, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 24 | ROW-03:D-K2 | R3-D1-K2 | CH010 row 3, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 25 | ROW-03:D-K3 | R3-D1-K3 | CH010 row 3, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 26 | ROW-03:D-K4 | R3-D1-K4 | CH010 row 3, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 27 | ROW-03:D-K5 | R3-D1-K5 | CH010 row 3, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 28 | ROW-03:C-K1 | R2-D5-K1 | CH010 row 3, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 29 | ROW-03:C-K2 | R2-D5-K2 | CH010 row 3, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 30 | ROW-03:C-K3 | R2-D5-K3 | CH010 row 3, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 31 | ROW-03:C-K4 | R2-D5-K4 | CH010 row 3, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 32 | ROW-03:C-K5 | R2-D5-K5 | CH010 row 3, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 33 | ROW-04:D-K1 | R2-D4-K1 | CH010 row 4, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 34 | ROW-04:D-K2 | R2-D4-K2 | CH010 row 4, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 35 | ROW-04:D-K3 | R2-D4-K3 | CH010 row 4, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 36 | ROW-04:D-K4 | R2-D4-K4 | CH010 row 4, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 37 | ROW-04:D-K5 | R2-D4-K5 | CH010 row 4, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 38 | ROW-04:C-K1 | R2-D3-K1 | CH010 row 4, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 39 | ROW-04:C-K2 | R2-D3-K2 | CH010 row 4, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 40 | ROW-04:C-K3 | R2-D3-K3 | CH010 row 4, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 41 | ROW-04:C-K4 | R2-D3-K4 | CH010 row 4, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 42 | ROW-04:C-K5 | R2-D3-K5 | CH010 row 4, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 43 | ROW-04:B | R2-MINUS | CH010 row 4, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 44 | ROW-05:D-K1 | R2-D2-K1 | CH010 row 5, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 45 | ROW-05:D-K2 | R2-D2-K2 | CH010 row 5, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 46 | ROW-05:D-K3 | R2-D2-K3 | CH010 row 5, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 47 | ROW-05:D-K4 | R2-D2-K4 | CH010 row 5, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 48 | ROW-05:D-K5 | R2-D2-K5 | CH010 row 5, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 49 | ROW-05:C-K1 | R2-D1-K1 | CH010 row 5, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 50 | ROW-05:C-K2 | R2-D1-K2 | CH010 row 5, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 51 | ROW-05:C-K3 | R2-D1-K3 | CH010 row 5, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 52 | ROW-05:C-K4 | R2-D1-K4 | CH010 row 5, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 53 | ROW-05:C-K5 | R2-D1-K5 | CH010 row 5, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 54 | ROW-05:B | R2-PLUS | CH010 row 5, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 55 | ROW-06:D-K1 | R1-D5-K1 | CH010 row 6, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 56 | ROW-06:D-K2 | R1-D5-K2 | CH010 row 6, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 57 | ROW-06:D-K3 | R1-D5-K3 | CH010 row 6, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 58 | ROW-06:D-K4 | R1-D5-K4 | CH010 row 6, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 59 | ROW-06:D-K5 | R1-D5-K5 | CH010 row 6, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 60 | ROW-06:C-K1 | R1-D4-K1 | CH010 row 6, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 61 | ROW-06:C-K2 | R1-D4-K2 | CH010 row 6, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 62 | ROW-06:C-K3 | R1-D4-K3 | CH010 row 6, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 63 | ROW-06:C-K4 | R1-D4-K4 | CH010 row 6, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 64 | ROW-06:C-K5 | R1-D4-K5 | CH010 row 6, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 65 | ROW-06:B | R1-MINUS | CH010 row 6, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 66 | ROW-07:D-K1 | R1-D3-K1 | CH010 row 7, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 67 | ROW-07:D-K2 | R1-D3-K2 | CH010 row 7, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 68 | ROW-07:D-K3 | R1-D3-K3 | CH010 row 7, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 69 | ROW-07:D-K4 | R1-D3-K4 | CH010 row 7, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 70 | ROW-07:D-K5 | R1-D3-K5 | CH010 row 7, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 71 | ROW-07:C-K1 | R1-D2-K1 | CH010 row 7, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 72 | ROW-07:C-K2 | R1-D2-K2 | CH010 row 7, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 73 | ROW-07:C-K3 | R1-D2-K3 | CH010 row 7, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 74 | ROW-07:C-K4 | R1-D2-K4 | CH010 row 7, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 75 | ROW-07:C-K5 | R1-D2-K5 | CH010 row 7, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 76 | ROW-07:B | R1-PLUS | CH010 row 7, bit 11 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 77 | ROW-08:D-K1 | R1-D1-K1 | CH010 row 8, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 78 | ROW-08:D-K2 | R1-D1-K2 | CH010 row 8, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 79 | ROW-08:D-K3 | R1-D1-K3 | CH010 row 8, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 80 | ROW-08:D-K4 | R1-D1-K4 | CH010 row 8, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 81 | ROW-08:D-K5 | R1-D1-K5 | CH010 row 8, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 82 | ROW-09:D-K1 | NOUN-2-K1 | CH010 row 9, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 83 | ROW-09:D-K2 | NOUN-2-K2 | CH010 row 9, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 84 | ROW-09:D-K3 | NOUN-2-K3 | CH010 row 9, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 85 | ROW-09:D-K4 | NOUN-2-K4 | CH010 row 9, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 86 | ROW-09:D-K5 | NOUN-2-K5 | CH010 row 9, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 87 | ROW-09:C-K1 | NOUN-1-K1 | CH010 row 9, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 88 | ROW-09:C-K2 | NOUN-1-K2 | CH010 row 9, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 89 | ROW-09:C-K3 | NOUN-1-K3 | CH010 row 9, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 90 | ROW-09:C-K4 | NOUN-1-K4 | CH010 row 9, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 91 | ROW-09:C-K5 | NOUN-1-K5 | CH010 row 9, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 92 | ROW-10:D-K1 | VERB-2-K1 | CH010 row 10, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 93 | ROW-10:D-K2 | VERB-2-K2 | CH010 row 10, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 94 | ROW-10:D-K3 | VERB-2-K3 | CH010 row 10, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 95 | ROW-10:D-K4 | VERB-2-K4 | CH010 row 10, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 96 | ROW-10:D-K5 | VERB-2-K5 | CH010 row 10, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 97 | ROW-10:C-K1 | VERB-1-K1 | CH010 row 10, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 98 | ROW-10:C-K2 | VERB-1-K2 | CH010 row 10, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 99 | ROW-10:C-K3 | VERB-1-K3 | CH010 row 10, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 100 | ROW-10:C-K4 | VERB-1-K4 | CH010 row 10, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 101 | ROW-10:C-K5 | VERB-1-K5 | CH010 row 10, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 102 | ROW-11:D-K1 | PROG-2-K1 | CH010 row 11, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 103 | ROW-11:D-K2 | PROG-2-K2 | CH010 row 11, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 104 | ROW-11:D-K3 | PROG-2-K3 | CH010 row 11, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 105 | ROW-11:D-K4 | PROG-2-K4 | CH010 row 11, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 106 | ROW-11:D-K5 | PROG-2-K5 | CH010 row 11, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 107 | ROW-11:C-K1 | PROG-1-K1 | CH010 row 11, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 108 | ROW-11:C-K2 | PROG-1-K2 | CH010 row 11, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 109 | ROW-11:C-K3 | PROG-1-K3 | CH010 row 11, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 110 | ROW-11:C-K4 | PROG-1-K4 | CH010 row 11, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 111 | ROW-11:C-K5 | PROG-1-K5 | CH010 row 11, bit 10 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 112 | ROW-12:D-K1 | PRIO DISP | CH010 row 12, bit 1 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 113 | ROW-12:D-K2 | NO DAP | CH010 row 12, bit 2 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 114 | ROW-12:D-K3 | VEL | CH010 row 12, bit 3 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 115 | ROW-12:D-K4 | NO ATT | CH010 row 12, bit 4 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 116 | ROW-12:D-K5 | ALT | CH010 row 12, bit 5 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 117 | ROW-12:C-K1 | GIMBAL LOCK | CH010 row 12, bit 6 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 118 | ROW-12:C-K2 | SPARE | CH010 row 12, bit 7 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 119 | ROW-12:C-K3 | TRACKER | CH010 row 12, bit 8 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |
| 120 | ROW-12:C-K4 | PROG CAUTION | CH010 row 12, bit 9 | SCD 1006282 bounded: operate/release <=3 ms; bounce <=2 ms | one profile -> contact trace -> sound/haptic -> contact projection |

Latching count: **120**.

### Explicitly unpopulated channel-010 positions

These 12 bit positions exist in the 11-bit channel word but have **no physical latching relay** and must generate no relay motion, sound, haptic or contact bounce:

- ROW-03:B
- ROW-08:C-K1
- ROW-08:C-K2
- ROW-08:C-K3
- ROW-08:C-K4
- ROW-08:C-K5
- ROW-08:B
- ROW-09:B
- ROW-10:B
- ROW-11:B
- ROW-12:C-K5
- ROW-12:B

## 12 non-latching status/caution relays

| # | Function | Source | Mask (octal) | Source interpretation | Effect | Mechanical timing |
|---:|---|---:|---:|---|---|---|
| 1 | ISS WARNING | CH011 | 00001 | direct AGC output | external status/caution | OPEN - 1010784 timing table not yet independently sourced |
| 2 | COMP ACTY | CH011 | 00002 | direct AGC output | DSKY COMP ACTY | OPEN - 1010784 timing table not yet independently sourced |
| 3 | UPLINK ACTY | CH011 | 00004 | direct AGC output | DSKY UPLINK ACTY | OPEN - 1010784 timing table not yet independently sourced |
| 4 | TEMP | CH0163 | 00010 | yaAGC effective hardware | DSKY TEMP | OPEN - 1010784 timing table not yet independently sourced |
| 5 | KEY REL | CH0163 | 00020 | yaAGC effective hardware | DSKY KEY REL | OPEN - 1010784 timing table not yet independently sourced |
| 6 | FLASH | CH0163 | 00040 | yaAGC effective hardware | VERB/NOUN flash phase | OPEN - 1010784 timing table not yet independently sourced |
| 7 | OPR ERR | CH0163 | 00100 | yaAGC effective hardware | DSKY OPR ERR | OPEN - 1010784 timing table not yet independently sourced |
| 8 | INJ SEQ START | CH012 | 10000 | direct AGC output | spacecraft discrete | OPEN - 1010784 timing table not yet independently sourced |
| 9 | CUTOFF | CH012 | 20000 | direct AGC output | spacecraft discrete | OPEN - 1010784 timing table not yet independently sourced |
| 10 | RESTART | CH0163 | 00200 | yaAGC effective hardware | DSKY RESTART | OPEN - 1010784 timing table not yet independently sourced |
| 11 | CIRCUIT / CMC WARNING | CH0163 | 00001 | yaAGC effective hardware | external CMC warning | OPEN - 1010784 timing table not yet independently sourced |
| 12 | STBY | CH0163 | 00400 | yaAGC effective hardware | DSKY STBY | OPEN - 1010784 timing table not yet independently sourced |

## Release gate

RLY-02 may be marked VERIFIED only when all of the following are true:

1. Executable inventory enumerates exactly 120 latching + 12 non-latching = 132 unique physical relays.
2. The 12 unpopulated dense-matrix positions are rejected by profile/contact/audio/haptic paths.
3. Every one of the 120 latching profiles satisfies SCD 1006282 timing limits.
4. All 12 non-latching functions are routed from the correct direct/effective source and preserve state across snapshot/restore paths.
5. Web/PWA, Android and Apple canonical suites pass and packaged assets match the tested source.
6. Exact 1010784/2004689 timing is either sourced and implemented or remains explicitly unverified; it must not be silently represented as source-backed.
7. Physical Pixel testing confirms the merged relay/haptic behavior where tactile verification is required.
