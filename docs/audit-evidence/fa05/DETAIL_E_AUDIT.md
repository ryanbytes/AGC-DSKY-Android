# FA-05 Detail E front-face audit

Primary authority: MIT/MSC SCD 1006315G, sheet 2, Detail E.

## What Detail E constrains

Detail E is a magnified front-face plan detail of the digit/separator relationship. It supports:
1. digit-to-separator clearance: **0.055–0.065 in TYP**;
2. continuously-lit separator thickness: **0.055–0.065 in TYP**.

The drawing's `.765/.755 REF` dimension is in the same front-face coordinate system.

## Exact STEP cross-check

Archived immutable STEP blob:
`841351a225482cb7926aeb4e97cced8db7ba2258`.

Repeated separator boundaries include:
- 0.685980012601254
- 0.750980012601254

Difference: **0.0650000000 in**.

The three separator groups repeat on a **0.760000 in** pitch, consistent with the drawing's 0.755–0.765 REF range.

The STEP reconstruction puts the next register digit approximately **0.06626 in** from the separator. Because the STEP is secondary reconstruction evidence, the SCD limit governs.

## Current main

Current main `1fb5823cc512de4e441bf81bfd77dc81a0ee1872` already has:

`cm-dsky-finish.css: .el-rule { stroke-width: 2.695; }`

With `U = 106 / 2.360 = 44.9152542373 SVG units/in`, that is approximately **0.0600 in**.

Result for separator thickness: **PASS**.

Current main still uses:
- `BAR_H_IN = 0.060`
- `REGISTER_GAP_IN = 0.070`

With the prior polygon's 0.0003518785-in top protrusion, the actual visible clearance is approximately **0.069648 in**.

Result for digit-to-separator clearance: **FAIL** against 0.055–0.065 in.

The previous audit text saying the live WebView separator was still 2.05 units thick was stale and is withdrawn.

## FA-05 branch candidate

The branch changes:
- `REGISTER_GAP_IN: 0.070 -> 0.060`;
- separator extents to the archived STEP-backed lengths;
- WebView separator line caps to square/butt ends;
- the seven digit electrodes to their correct Apollo front-view physical identities.

The corrected top electrode no longer protrudes above `DIGIT_TOP_IN`; with a 0.060-in separator and 0.060-in placement constant, the intended visible clearance is approximately **0.060 in**.

Result: **PASS** against the Detail-E 0.055–0.065 in band.

## Status

- separator thickness on main: PASS;
- main digit-to-separator placement: FAIL;
- FA-05 branch placement candidate: PASS by source calculation;
- separator lengths/end shape: restored from archived STEP secondary evidence;
- final FA-05 closure still requires complete branch build/test and rendered/device verification.
