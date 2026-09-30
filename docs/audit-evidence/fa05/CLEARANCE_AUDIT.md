# FA-05 EL clearance audit — corrected interpretation

Primary authority: MIT/MSC SCD 1006315G, Detail C.  
Secondary CAD evidence: `docs/audit-evidence/fa05/1006315G-exact.step`.  
Archived STEP Git blob: `841351a225482cb7926aeb4e97cced8db7ba2258`.

## Authority boundary

The SCD drawing is authoritative. The STEP is a reconstruction and is used only as a secondary cross-check.

The earlier provisional interpretation that `.010 MIN TYP` imposed a global Euclidean minimum at every adjacent segment junction is **withdrawn**.

Tracing the Detail-C leader shows that `.010 MIN TYP` dimensions the **center split between the upper and lower side electrodes**. The callout is not attached to the diagonal top/bottom corner junctions.

## Center-split requirement

The accepted FA-05 candidate retains:

- left center split (F-to-K physical side pair): **0.010000 in**
- right center split (H-to-M physical side pair): **0.010000 in**

Result: **PASS** against Detail C `.010 MIN TYP`.

## Descriptive diagonal distances

These values are retained only as measurements; they are **not SCD failures under the corrected callout interpretation**.

Archived STEP diagonal nearest distances are approximately **0.008138 in** and **0.009449 in**.

Accepted FA-05 app polygons produce the corresponding pair at approximately **0.008137 in** and **0.009425 in**. The 180-degree segment-identity correction changes which top/bottom junction carries which member of the pair; it does not create a new clearance defect.

The independent `DSKY V2.svg` reconstruction uses about 0.015 in at comparable diagonal junctions, but that difference does not establish a required SCD dimension because the primary drawing does not assign the `.010 MIN TYP` callout there.

## Withdrawn candidate

A prior candidate shortened two side-segment end cuts to force diagonal distances to 0.010005 in. That candidate is **withdrawn and must not be applied** because it was based on the incorrect global-clearance interpretation.

No runtime geometry change is authorized **from the clearance analysis itself**. FA-05's separate physical segment-identity correction is documented in `SEGMENT_ORIENTATION_AUDIT.md`.

## Status

- STEP provenance: VERIFIED
- center-split clearance: PASS
- diagonal distances: descriptive only
- runtime change from clearance analysis: NONE
- physical segment identity: handled separately by the orientation audit
