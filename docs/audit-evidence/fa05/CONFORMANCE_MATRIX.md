# FA-05 Detail-C conformance matrix

Primary authority: MIT/MSC SCD 1006315G Detail C.  
Current runtime authority inspected: `main@1fb5823cc512de4e441bf81bfd77dc81a0ee1872`.  
Candidate: the two-end-cut clearance repair documented in `CLEARANCE_AUDIT.md`.

## Explicit Detail-C dimensions

| Requirement | SCD limit | Current main | Candidate | Status |
|---|---:|---:|---:|---|
| Overall digit height | 0.495–0.505 in | 0.500351988 | 0.500351988 | PASS |
| Upper outside width | 0.315–0.325 in | 0.317860102 | 0.318543126 | PASS |
| Top-to-middle datum | 0.215–0.225 in | 0.215351988 | 0.215351988 | PASS |
| Horizontal segment thickness | 0.060–0.070 in TYP | a=0.070000; g=0.065000; d=0.065000 | unchanged | PASS |
| Side-segment normal width | 0.060–0.070 in TYP | b=0.06500043; f=0.06500038; c=0.06499942; e=0.06499945 | unchanged | PASS |
| Side slant from vertical | 14°30′–15°30′ TYP | ~15.021° | unchanged | PASS |
| Depicted ~60° end cuts | 59°30′–60°30′ TYP | f top=59.8964°; c bottom=60.2756° | unchanged | PASS for the directly corresponding F/M end cuts |
| Adjacent segment clearance | 0.010 in MIN TYP | a-f=0.00813746; c-d=0.00942452 | both 0.010005 | **FAIL current / PASS candidate** |

Sub-microinch deviations around other nominal 0.010-in gaps are consistent with the app's decimal transcription precision and are not classified with the two material shortfalls above.

## Interpretation boundary

The drawing says **DO NOT SCALE THIS DRAWING**. Therefore visual proportions in the scan are not used as independent dimensions. A planform edge is changed only when an explicit dimension/angle/clearance or stronger primary evidence requires it.

The 59°30′–60°30′ and 14°30′–15°30′ construction callouts are evaluated against the directly corresponding F/M side-segment geometry shown by the Detail-C construction. The drawing does not provide enough explicit independent coordinates to infer arbitrary new H/K endpoint shapes from scan pixels alone.

## Detail E

Detail E is a **cross-section/profile** of the electroluminescent construction. Its 0.055–0.065-in TYP dimensions constrain profile/depth relationships, not the X-Z front-face polygon outlines audited here.

Therefore Detail E does **not** by itself justify redrawing the seven front-face polygons. Any 3-D/parallax representation of the segment stack should be audited separately against Detail E.

## Current conclusion

The current polygon family passes the explicit Detail-C height, width, thickness, slant, and representative end-angle limits that can be directly evaluated. The confirmed front-face defect is the pair of below-minimum adjacent-segment clearances. The documented candidate fixes only those two junctions and preserves the passing dimensions.

Status remains **audit/candidate only** until:
1. candidate coordinates are rendered through the real WebView geometry path,
2. full 0–9 comparison is inspected,
3. native widget and generated-frame parity are updated and tested,
4. geometry-lock regression is changed only with the same evidence.
