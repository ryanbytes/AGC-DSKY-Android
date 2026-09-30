# FA-05 Detail-C conformance matrix

Primary authority: MIT/MSC SCD 1006315G Detail C.  
Current runtime inspected: `main@1fb5823cc512de4e441bf81bfd77dc81a0ee1872`.

## Explicit Detail-C checks

| Requirement | SCD limit | Current main | Status |
|---|---:|---:|---|
| Overall digit height | 0.495–0.505 in | 0.500351988 | PASS |
| Upper outside width | 0.315–0.325 in | 0.317860102 | PASS |
| Top-to-middle datum | 0.215–0.225 in | 0.215351988 | PASS |
| Horizontal segment thickness | 0.060–0.070 in TYP | a=0.070000; g=0.065000; d=0.065000 | PASS |
| Side-segment normal width | 0.060–0.070 in TYP | b=0.06500043; f=0.06500038; c=0.06499942; e=0.06499945 | PASS |
| Side slant from vertical | 14°30′–15°30′ TYP | ~15.021° | PASS |
| Directly corresponding ~60° free-end cuts | 59°30′–60°30′ TYP | f top=59.8964°; c bottom=60.2756° | PASS |
| Center split between upper/lower side electrodes | 0.010 in MIN TYP | left=0.010000; right=0.010000 | PASS |

## Interpretation boundary

The drawing explicitly says **DO NOT SCALE THIS DRAWING**. Scan-pixel proportions are therefore not promoted into dimensions.

The `.010 MIN TYP` leader is traced to the center split between the upper and lower side electrodes. It is **not** a global Euclidean nearest-distance requirement at the diagonal top/bottom junctions. Earlier provisional claims to the contrary are withdrawn.

The 59°30′–60°30′ and 14°30′–15°30′ construction callouts are evaluated against the directly corresponding Detail-C side-segment construction. Geometry not independently dimensioned by the SCD is not redesigned from scan appearance alone.

## Detail E

Detail E is a cross-section/profile of the electroluminescent construction. Its 0.055–0.065-in TYP dimensions constrain profile/depth relationships, not the X-Z front-face polygon planform audited here.

A separate 3-D/profile audit is required if the app's parallax/depth representation is intended to reproduce the element construction itself.

## Current conclusion

Current main passes the explicit Detail-C planform dimensions and the correctly interpreted center-split clearance gate checked here. No front-face polygon change is justified by the user's Detail-E crop or by the diagonal distances measured during the provisional clearance investigation.

FA-05 remains open for any remaining primary-source-backed shape question, but the previous two-end-cut correction is withdrawn.
