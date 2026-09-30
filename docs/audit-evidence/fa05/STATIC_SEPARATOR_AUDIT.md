# FA-05 continuously-lit separator audit

Primary authority: MIT/MSC SCD 1006315G, sheet 2 / Detail E.  
Secondary geometry evidence: archived `1006315G-exact.step` from rrainey/agc-mechanical-cad commit `2d7dccd5bc4f0263a14ac5a4fd112a15d447010d`, Git blob `841351a225482cb7926aeb4e97cced8db7ba2258`.

## Authority boundary

The SCD controls dimensioned values. The archived STEP is used only for front-face details that the SCD depicts but does not independently dimension, such as the exact horizontal extents of the continuously-lit separator electrodes.

Detail E does not authorize a global flip or freehand redraw of the seven numeric electrodes; numeric segment identity is handled separately in `SEGMENT_ORIENTATION_AUDIT.md`.

## Dimensioned vertical geometry

Unchanged drawing-derived values:

- separator centers: 2.280, 1.520, and 0.760 in from the active-face bottom;
- row/separator pitch: 0.760 in;
- separator thickness: 0.060 in nominal.

Current pre-FA-05 main already renders the Web separator at 2.695 SVG units, approximately **0.060 in**, so separator **thickness passes** the 0.055–0.065 in Detail-E band.

The pre-FA-05 register placement constant is `REGISTER_GAP_IN = 0.070`; with the then-active digit top this yields about **0.069648 in** of visible separator-to-digit clearance and does **not** satisfy the Detail-E 0.055–0.065 in band.

The accepted FA-05 candidate sets `REGISTER_GAP_IN = 0.060`. With the corrected E/top electrode beginning at the digit-top datum, visible separator-to-digit clearance is approximately **0.060 in**.

Result: **PASS**.

The archived STEP independently uses 0.065-in-thick separator solids and a close-side row/bar spacing near the corresponding drawing limit. The STEP remains secondary reconstruction evidence; the SCD tolerance controls.

## Un-dimensioned separator lengths

The prior app used one 1.890226-in centerline/rectangle length for all three separators. The archived STEP does not:

| STEP solid | Role | x min (in) | x max (in) | Length (in) |
|---|---|---:|---:|---:|
| EL5 | upper/wide separator | 0.000464015133 | 2.180372035200 | 2.179908020067 |
| EL6 | middle/short separator | 0.216548556570 | 2.180372035200 | 1.963823478630 |
| EL7 | lower/short separator | 0.216548556570 | 2.180372035200 | 1.963823478630 |

The SCD front view visibly distinguishes the wider upper separator from the two shorter register separators but does not supply a separate numeric length dimension. For those un-dimensioned extents, the archived drawing-backed STEP is the best available reconstruction evidence.

At the 106 / 2.360 active-face scale these extents are:

- EL5: x = 0.020841 .. 97.931964 panel units;
- EL6/EL7: x = 9.726333 .. 97.931964 panel units.

## End shape and renderer parity

The STEP electrodes are rectangular solids with square x-z corners. Before FA-05:

- WebView used SVG `<line>` elements with inherited round caps;
- the Android native widget drew rectangular boxes;
- all three render paths used the same shortened horizontal extent.

That was a real Web/native shape mismatch and did not reproduce the STEP's differentiated separator lengths.

FA-05 restores the STEP-backed horizontal extents and square Web ends while retaining the drawing-controlled vertical centers, pitch, and thickness.

The generated 23-unit Android second-frame vectors contain register sign/digit electrodes, not these between-row static separators, so no static-separator path is required there.

## Status

- separator thickness: PASS
- register-to-separator clearance on pre-FA-05 main: FAIL
- accepted FA-05 clearance candidate: PASS at approximately 0.060 in
- separator lengths/end shape: corrected from archived STEP secondary evidence
- Web/native separator presentation: parity restored
