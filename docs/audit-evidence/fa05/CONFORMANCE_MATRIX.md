# FA-05 Detail-C conformance matrix

## Current status (2026-10-03)

The corrected segment identities and Detail-E placement are present in the
current source. The full canonical source suite passed (98 Node smokes plus
`ntp-time-smoke.sh`, including the real pinned Comanche055 WASM checks). Gradle
9.5.1 `:app:verifyPinnedAgcAssets :app:assemble :app:lint` passed across all
six Regular/Fire variants; lint reported 11 warnings and zero errors. The
verified Regular debug APK passed `tools/verify-apk.sh` and
`tools/device-full-smoke.sh` on Android 16, including real Comanche V35 state,
page recreation, and process-death restoration. Its rendered V35 capture was
visually inspected in the current V35 screenshot; the E/H/M/N/K/F/J
electrode forms render as filled, continuous segments with the expected
asymmetric top and bottom strokes. The separate on-source geometry checks
remain the dimensional/identity evidence; the emulator capture does not
measure physical display optics.

The historical “current main” and “candidate” labels below record the original
pre-integration audit checkpoint and do not describe the present branch.

Primary dimensional authority: MIT/MSC SCD 1006315G Detail C.  
Secondary geometry evidence: archived `1006315G-exact.step`.  
Independent Apollo relay/segment nomenclature cross-check: VirtualAGC `Tools/traceDSKY.py`, blob `6d994a40529d377ceaf865f63f8ce0bebec885a8`, traced from the original DSKY relay schematics.

## Explicit Detail-C checks on the corrected front-view candidate

| Requirement | SCD limit | FA-05 candidate | Status |
|---|---:|---:|---|
| Overall digit height | 0.495–0.505 in | 0.500351988 | PASS |
| Upper outside width | 0.315–0.325 in | 0.317299151 | PASS |
| Top-to-middle datum | 0.215–0.225 in | 0.220000000 | PASS |
| Horizontal segment thickness | 0.060–0.070 in TYP | 0.065–0.070 | PASS |
| Side-segment normal width | 0.060–0.070 in TYP | ~0.065 | PASS |
| Side slant from vertical | 14°30′–15°30′ TYP | ~15.021° | PASS |
| Directly corresponding ~60° free-end cuts | 59°30′–60°30′ TYP | 60.2756° / 59.8964° | PASS |
| Center split between upper/lower side electrodes | 0.010 in MIN TYP | 0.010000 / 0.010000 | PASS |

## Segment-identity defect found

The earlier dimensional audit was insufficient because a 180-degree reassignment preserves the dimensions above.

VirtualAGC's traced schematic defines the physical EL sections as:

```
        E
    F       H
        J
    K       M
        N
```

Therefore the logical seven-segment binding is `E/H/M/N/K/F/J -> a/b/c/d/e/f/g`.

The archived STEP independently names the solids `SegE`, `SegH`, `SegM`, `SegN`, `SegK`, `SegF`, and `SegJ`. On current main `1fb5823cc512de4e441bf81bfd77dc81a0ee1872`, the app's polygon shapes correspond instead to `N/K/F/E/H/M/J` for logical `a/b/c/d/e/f/g`: the physical electrode geometry is effectively rotated 180 degrees while the logical digit pattern remains normal.

The asymmetric horizontal spans make the error independently detectable:
- archived STEP `SegE` (physical top): about 0.2285 in wide;
- archived STEP `SegN` (physical bottom): about 0.2905 in wide;
- corrected app candidate: logical `a` = 0.228794 in and logical `d` = 0.292814 in.

This explains why digits such as 2 and 5 can remain recognizable while their contour looks wrong: the same logical segments illuminate, but the asymmetric Apollo electrode shapes are at the opposite ends/sides.

## Regression coverage

`tools/el-drawing-conformance-smoke.js` now contains an asymmetric E/N identity guard in addition to the primary SCD dimensional checks. The exact accepted coordinates remain frozen by `tools/el-geometry-lock-smoke.js`, and `tools/dsky-mapping-smoke.js` checks the physical E/H/M/N/K/F/J bindings.

## Detail E / separators

The visible separator thickness on current main is already 2.695 SVG units, approximately 0.060 in, and therefore passes the 0.055–0.065 in Detail-E thickness band. The remaining main-branch defect is the 0.070-in register placement gap; the FA-05 branch changes that to 0.060 in and also restores STEP-backed separator extents and square ends.

## Status

The corrected digit geometry passes the primary Detail-C and Detail-E conformance calculations, and the physical E/H/M/N/K/F/J assignment is covered by independent source/geometry checks. Current-source build, lint, packaged APK verification, and the rendered Android 16 V35 capture all pass. FA-05's local implementation acceptance is complete; physical-screen appearance on a target phone remains unverified.
