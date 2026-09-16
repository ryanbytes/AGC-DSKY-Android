# DSKY EL display glass geometry

This note is the dimensional source of truth for the WebView presentation-only glass/parallax layer. It deliberately separates the external EL cover glass from the sealed digital-indicator package.

## Primary assembly evidence

The Block II CM DSKY `2003988-011/-021` E/L & cover assembly contains:

- `2004699-001` — frame, indicator cover;
- `2004746-001` — digital indicator (thermal-vac);
- `2004745-001/-002` — panel, indicator (E/L);
- sealing compound and retaining hardware.

Drawing `2003988` instructs that the `2004745` panel be centrally located and bonded with thermosetting optical adhesive to the **glass face** of the `2004746` digital indicator. The external panel therefore is not separated from the indicator face by the digital indicator's full package depth.

Original drawing scan source:

- MIT Instrumentation Laboratory / NASA aperture-card Box 459, drawing `2003988` (Internet Archive `apertureCardBox459NARASW_images`, BookReader leaf n876).
- Virtual AGC assembly drilldown: `https://www.ibiblio.org/apollo/2003994-121.html`.

## 2004745 panel material and geometry

Original drawing `2004745`, **PANEL, INDICATOR (E/L), AGC DSKY**, specifies laminated glass per `MIL-G-8602A`, Class II, Grade 2N. Revision `-002` may receive the specified anti-reflection coating on its front surface.

The OCR-visible `.140 BOTH ENDS` callout is **not** used as glass thickness. The reconstructed drawing-accurate STEP model makes its role clear: the `.140` value is the top/bottom border inset from the outer panel to the raised central viewing face.

Cross-check model:

- `rrainey/agc-mechanical-cad/agc-block-ii/2004745-exact-PANEL, INDICATOR EL.step`
- STEP length unit: inch.
- STEP surface style: `Glass (Clear)`.

Relevant model bounds, read directly from the STEP Cartesian coordinates:

| Feature | Coordinate span | Dimension |
| --- | --- | ---: |
| outer glass width | x = 0.0682146 .. 2.6082146 | 2.540 in |
| raised clear-view width | x = 0.1612146 .. 2.5152146 | 2.354 in |
| outer glass height | z = 0.0702112 .. 4.4282112 | 4.358 in |
| raised clear-view height | z = 0.2102112 .. 4.2882112 | 4.078 in |
| top/bottom border inset | 0.2102112 - 0.0702112 | 0.140 in |
| rear face to border/front datum | y = -0.109 .. 0.000 | 0.109 in |
| raised center above border datum | y = 0.000 .. +0.025 | 0.025 in |
| rear face to raised viewing face | y = -0.109 .. +0.025 | **0.134 in** |

The app should therefore use **0.134 in** as the physical separation between the front central viewing surface and the rear face of the external `2004745` glass panel. The 2.354-in raised clear-view width is the scale reference for converting that depth into CSS pixels.

The legacy 2.360-in indicator-face width from SCD `1006315` is a useful independent cross-check: it differs from the reconstructed 2004745 raised-view width by only about 0.25%. It is not evidence that the external glass is 0.260 in thick.

## Values that must not be confused

- `0.257/0.263 in` on `1006315`: sealed digital-indicator package thickness; **not** external cover-glass thickness.
- `0.300 in` in the indicator-cover frame model: frame depth envelope; **not** cover-glass thickness.
- `.140 BOTH ENDS` on `2004745`: top/bottom border geometry; **not** glass thickness.
- `0.134 in`: rear face to raised central front viewing surface in the drawing-accurate 2004745 reconstruction; this is the depth used by the presentation model.

## Rendering contract

The presentation layer may model three optical layers without changing AGC state or display vectors:

1. front AR/glass surface at the viewer-facing datum;
2. rear glass/interface plane one physical `2004745` viewing thickness behind it;
3. EL artwork immediately behind that rear interface because `2003988` specifies optical bonding to the digital indicator glass face.

No large independent X/Y counter-motion is permitted for the front glass or phosphor. Parallax should come from shared perspective/rotation plus the dimension-scaled Z separation. Any future perceptual exaggeration must be named and kept separate from the physical dimension so it cannot be mistaken for Apollo hardware geometry.
