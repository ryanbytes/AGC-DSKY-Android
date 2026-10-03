# FA-05 EL segment-orientation audit

## Current status (2026-10-03)

The correction described below remains in the current source. Current-source checks pass:
`node tools/el-drawing-conformance-smoke.js`,
`node tools/el-geometry-lock-smoke.js`, and
`node tools/dsky-mapping-smoke.js`. The full source suite (97 Node smokes plus
`ntp-time-smoke.sh`), six-variant Gradle assemble/lint, APK verification, and
full Android 16 packaged-runtime smoke also pass on the current source. The
captured Comanche V35 screen was
visually inspected; this checks the actual rendered geometry but does not
establish physical EL glass/optical appearance.

## Question

Are the Apollo EL digit electrodes vertically flipped, mirrored, or otherwise bound to the wrong physical positions?

## Independent nomenclature evidence

VirtualAGC `Tools/traceDSKY.py` (Git blob `6d994a40529d377ceaf865f63f8ce0bebec885a8`) documents the segment lettering traced from the original DSKY relay schematics:

```
        E
    F       H
        J
    K       M
        N
```

That establishes the physical names independently of the app's generic seven-segment labels.

The archived `1006315G-exact.step` independently contains solids named:
`SegE`, `SegF`, `SegH`, `SegJ`, `SegK`, `SegM`, and `SegN`.

## Finding

Before FA-05 correction, the app's logical `a/b/c/d/e/f/g` polygons corresponded by shape to:

`SegN / SegK / SegF / SegE / SegH / SegM / SegJ`

instead of the Apollo physical mapping:

`SegE / SegH / SegM / SegN / SegK / SegF / SegJ`.

This is a **180-degree physical-electrode assignment error**. It is not a CSS transform and it does not reverse the numeric relay truth table. The relay matrix still asks for normal seven-segment digits; it was drawing the wrong asymmetric Apollo electrode shape at each corresponding logical position.

The previous dimensional gate did not catch this because a 180-degree rotation preserves overall height, widths used by the gate, side slant, thickness, and center gaps.

## Observable 2/5 effect

Digits 2 and 5 remain recognizable under the wrong assignment because their logical segment sets are rotational counterparts, but the Apollo electrode polygons are not geometrically symmetric. The most obvious source-backed asymmetry is the top-vs-bottom horizontal electrode span:

- STEP `SegE` (top): about **0.2285 in**;
- STEP `SegN` (bottom): about **0.2905 in**.

The corrected candidate renders:
- logical `a` / physical E: **0.228794 in**;
- logical `d` / physical N: **0.292814 in**.

## Correction

Commit `fbeec20b34b969db1a45cdae561ce8bdbdd0ef0b` corrects the digit polygons consistently in:
- WebView runtime geometry;
- native Android widget geometry;
- generated Android second-frame vectors.

The regression suite now tests both SCD dimensions and physical E/N identity, so a dimension-preserving 180-degree reassignment cannot silently pass again.

## Classification

- Apollo segment lettering: **PROVEN** by the independent schematic trace and named CAD solids.
- Prior app physical assignment: **PROVEN wrong** by coordinate/shape correspondence.
- Corrected dimensional conformance: **PASS** in the source calculation.
- Local implementation acceptance: **PASS** current build, source, APK, and rendered-device gates; physical-screen appearance remains unverified.

## Live rendered verification

The final browser-runtime gate executes inside the same headless Chrome path used for PWA visual-golden capture. PWA run **#816** reports:

- live glyph implementation: `apolloGlyph`;
- live register implementation: `apolloRenderReg`;
- five static Apollo register glyph slots and zero fallback/base glyph slots;
- live logical `a` path exactly equal to the accepted physical E/top polygon;
- live logical `d` path exactly equal to the accepted physical N/bottom polygon.

The gate is now permanent in `tools/capture-visual-goldens.sh`; future visual captures fail if the runtime silently falls back or the accepted E/N paths change.

Independent old/new artifact comparison between the pre-orientation golden capture and the corrected capture confirms a real rendered change. The normal full-panel capture differs in **2,608 pixels**, bounded to the EL display region (x 248–369, y 186–388 in the 412×915 golden). The lamp-test capture differs in **3,558 pixels**. This disproves the earlier local comparison result that mistakenly reported the captures as pixel-identical.

The corrected golden was inspected directly: digit strokes remain sharp, continuous, and unclipped while the asymmetric Apollo electrode contours move to the documented physical E/H/M/N/K/F/J identities. The current Android 16 V35 screenshot also shows these filled segment shapes in the packaged runtime; physical-screen optics remain outside that evidence.
