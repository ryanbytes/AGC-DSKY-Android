# FA-05 continuously-lit separator audit

Primary authority: MIT/MSC SCD 1006315G, sheet 2.  
Secondary geometry evidence: archived `1006315G-exact.step` from rrainey/agc-mechanical-cad commit `2d7dccd5bc4f0263a14ac5a4fd112a15d447010d`, Git blob `841351a225482cb7926aeb4e97cced8db7ba2258`.

## Authority boundary

The SCD controls dimensioned values. The archived STEP is used only for front-face details that the SCD depicts but does not independently dimension, such as the exact horizontal extents of the continuously-lit separator electrodes.

Detail E is an enlarged front-face/detail of the digit/separator relationship, not a basis for vertically flipping or redrawing the seven numeric electrodes.

## Dimensioned vertical geometry

The app retains the existing SCD-derived values:

- separator centers: 2.280, 1.520, and 0.760 in from the active-face bottom, 0.760-in pitch;
- separator thickness: 0.060 in nominal, within the sheet-2 0.055–0.065 TYP range;
- register datum gap constant: 0.070 in;
- actual clear gap to the highest digit electrode after the exact digit-top offset: about 0.069648 in, inside the separate 0.065–0.075 TYP spacing range.

The archived STEP independently uses 0.065-in-thick separator solids and about 0.065908 in of clear space at the close side of the repeated row/bar relationship. Those values sit at/near the corresponding drawing tolerance endpoints and are consistent with the drawing-based app nominals.

No vertical center, row pitch, register baseline, digit polygon, sign polygon, or bar thickness is changed by this audit item.

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

FA-05 corrects only these un-dimensioned horizontal extents and Web line-cap shape. The drawing-derived vertical geometry is frozen.

## Regression

`tools/el-widget-smoke.js` now requires:

- the wider upper Web separator extent;
- the two shorter Web separator extents;
- square Web separator caps;
- matching native-widget rectangles.

No generated-second-frame change is required because those 23-unit register-only vectors contain sign/digit electrodes, not the between-row static separators.
