# FA-05 EL segment-orientation audit

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
- Final branch acceptance: **PENDING** full CI and rendered/device verification.
