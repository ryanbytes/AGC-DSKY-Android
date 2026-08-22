# References

## Apollo / VirtualAGC

- Virtual AGC project: https://github.com/virtualagc/virtualagc
- Virtual AGC site and DSKY documentation: https://www.ibiblio.org/apollo/
- VirtualAGC `yaDSKY2/LM.ini`: LM annunciator map, channel assignments, key codes.
- Apollo-derived DSKY interface drawing: https://commons.wikimedia.org/wiki/File:Apollo_DSKY_interface.svg

## Genuine DSKY visual references

CuriousMarc restoration videos were used to stop treating modern CAD/SVG styling as the visual master and instead compare against genuine hardware:

- `Apollo DSKY - part 1: we have a real (and broken) DSKY!`
- `Genuine NASA Apollo DSKY Full Restoration — part 2`
- `Apollo Guidance Computer Part 28: real DSKY display works again after 50 years`

Channel: https://www.youtube.com/@CuriousMarc

Key observations used in v6:

- EL segments are flat surface emitters, not LED bars.
- Glow should be restrained and relatively uniform.
- Segment ends/corners are more sculpted than a generic seven-segment font.
- Display labels, register separators, COMP ACTY, and numeric segments visually belong to one EL assembly.
- The physical DSKY has significant recess depth, seams, and non-flat mechanical construction.

No CuriousMarc video frames are copied into this repository.

## webAGC

- Source: https://github.com/michaelfranzl/webAGC
- Demo: https://michaelfranzl.github.io/webAGC/demo/

Used as a behavioral reference and as the current optional online real-AGC target.
