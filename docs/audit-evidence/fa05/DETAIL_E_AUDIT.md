# FA-05 Detail E front-face audit

Primary authority: MIT/MSC SCD 1006315G, sheet 2, Detail E.

## What Detail E is

Detail E is a magnified **front-face plan detail**, not a package-depth cross-section.

The drawing shows:
- a digit electrode adjacent to the continuously-lit cross-hatched separator;
- a ground-pin mark in the same front-face plane;
- one `.065/.055 TYP` dimension between the digit electrode and the separator;
- a second `.065/.055 TYP` dimension across the separator thickness;
- `.765/.755 REF` in the same front-face vertical coordinate system.

Therefore Detail E constrains both:
1. digit-to-separator clearance: **0.055–0.065 in TYP**;
2. continuously-lit separator thickness: **0.055–0.065 in TYP**.

## Exact STEP cross-check

Archived immutable STEP blob:
`841351a225482cb7926aeb4e97cced8db7ba2258`.

Repeated separator boundaries in the exact STEP include:
- 0.685980012601254
- 0.750980012601254

Difference: **0.0650000000 in**.

The three separator groups repeat on a **0.760000 in** pitch, consistent with the drawing's 0.755–0.765 REF range.

Nested assembly placement gives the next register digit datum at:
- row placement 0.800000 in
- digit-in-row placement -0.015000 in
- digit local face minimum 0.0322398905011428 in

STEP digit-to-separator gap:
`0.800 - 0.015 + 0.0322398905011428 - 0.750980012601254`
= **0.0662598779 in**.

That is 0.0012599 in above the SCD maximum. Because the STEP is secondary reconstruction evidence, the SCD limit governs.

## Current WebView implementation

Face scale:
`U = 106 / 2.360 = 44.9152542373 SVG units/in`.

Current static separator:
`style.css: .el-rule { stroke-width: 2.05; ... }`

Visible separator thickness:
`2.05 / U = 0.0456415094 in`

Result: **FAIL** against 0.055–0.065 in.

Current placement model:
- `BAR_H_IN = 0.060`
- `REGISTER_GAP_IN = 0.070`
- register datum offset from bar center = 0.100 in.

The sharp current polygons extend 0.0003518785 in above `DIGIT_TOP_IN`, so the actual visible gap using the current 2.05-unit stroke is:

**0.0768273668 in**

Result: **FAIL** against 0.055–0.065 in.

Even if the separator were visibly rendered at the internal 0.060-in bar height, the current 0.070 placement constant would produce:

**0.0696481215 in**

Result: **FAIL**.

## Smallest drawing-bounded candidate

Use drawing-nominal values already implied by the implementation:
- separator thickness = **0.060 in**
- digit-to-separator nominal gap = **0.060 in**

Candidate changes:
1. visible `.el-rule` stroke width: `0.060 * U = 2.6949152542` SVG units;
2. `REGISTER_GAP_IN`: `0.070 -> 0.060`.

With the existing sharp polygon minimum, resulting actual clearance is:

**0.0596481215 in**

which is inside the SCD 0.055–0.065 range.

This leaves unchanged:
- separator center positions;
- 0.760-in separator pitch;
- digit polygon geometry;
- relay/electrical mapping;
- upper PROG/VERB/NOUN geometry.

Status: **confirmed current WebView conformance defect; candidate not yet merged**.
