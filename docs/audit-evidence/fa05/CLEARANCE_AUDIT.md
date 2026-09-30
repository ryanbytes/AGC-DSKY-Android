# FA-05 EL segment-clearance audit

Primary authority: MIT/MSC SCD 1006315G, Detail C.
Secondary CAD evidence: `docs/audit-evidence/fa05/1006315G-exact.step`.
Archived STEP Git blob: `841351a225482cb7926aeb4e97cced8db7ba2258`.

## Authority boundary

The SCD drawing is authoritative. The STEP is a reconstruction from the drawing and is used only as a secondary geometry cross-check. Current runtime polygons are a later transcription of that STEP with an intentional X-handedness transform and four drawing-motivated sharp-corner intersections.

Detail C specifies `.010 MIN TYP` segment clearance. Adjacent segment spacing below 0.010 in is therefore a dimensional defect unless stronger primary-source evidence shows that a particular junction is excluded.

## Exact STEP findings

### Upper junction

High-precision STEP geometry gives the top-segment corner:

- `(0.322764003325723, 0.102239890501143)`

and the adjacent upper-side end edge through:

- `(0.371746066183875, 0.0339784565668979)`
- `(0.325740364290097, 0.113331486756462)`

Point-to-line clearance: **0.0081380436 in**.

This is **0.0018619564 in below** the SCD 0.010-in minimum.

### Lower junction

The STEP lower horizontal and adjacent lower-side rounded transitions share the circle center:

- center `(0.203492524377882, 0.512239890501143)`
- radius `0.0200000000 in`

Relevant arc boundary points:

- `(0.199266188445390, 0.531788242978672)`
- `(0.190763266555885, 0.527666036983694)`

Their chord separation is **0.0094494583 in**, still below the 0.010-in minimum.

The older six-decimal SVG transcription produced a slightly different approximate value because sampled chords approximated the STEP arcs; use the high-precision STEP value above when discussing the upstream CAD.

## Current main findings

Current main `1fb5823cc512de4e441bf81bfd77dc81a0ee1872` preserves the same physical two clearance failures after its mirror/mapping transform:

- `a-f`: **0.0081374563 in**
- `c-d`: **0.0094245238 in**

The second value is slightly worse than the rounded STEP because the app replaced the STEP radius with a straight-edge intersection.

Other adjacent app clearances are nominally 0.010 in; sub-microinch deviations are consistent with decimal transcription precision and are not treated as the same class of defect.

## Independent cross-check

The independent `benkrasnow/DSKY_EL_replica` `DSKY V2.svg` vector reconstruction uses approximately **0.015000 in** comparable adjacent-segment clearances. It is not primary authority, but it independently demonstrates that satisfying the SCD 0.010-in minimum does not require the STEP's two undersized gaps.

## Minimal candidate correction — NOT APPLIED

Keep the horizontal segments unchanged. Shorten only the two offending side-segment end cuts by translating each 60-degree end line parallel into its segment until the measured clearance is 0.010005 in. The extra 0.000005 in is only a numerical margin above the minimum.

Candidate current-app coordinates:

### segment f top end

Keep:
- `(0.124277898, 0.269917)`
- `(0.191577898, 0.269917)`

Replace the top-end vertices with:
- `(0.232913874080695, 0.115876324339664)`
- `(0.186907873676747, 0.036523323642918)`

### segment c bottom end

Keep:
- `(0.371594898, 0.279917)`
- `(0.438893898, 0.279917)`

Replace the lower-end vertices with:
- `(0.325616610701715, 0.451257587994998)`
- `(0.371398760778625, 0.531442896378248)`

## Candidate preservation checks

- corrected `a-f` clearance: **0.0100050000 in**
- corrected `c-d` clearance: **0.0100050000 in**
- segment-f end angle: **59.8963928 deg**, unchanged
- segment-c end angle: **60.2756059 deg**, unchanged
- side slant: **~15.021 deg**, unchanged
- overall digit height: **0.500351988 in**, unchanged
- upper outside span: **0.3185431263 in**, within SCD 0.315–0.325 in
- center-junction geometry: unchanged

Status: **candidate only**. Do not modify WebView, native widget, generated frames, or the geometry-lock regression until the candidate is independently checked against the SCD image and a rendered 0–9 comparison.
