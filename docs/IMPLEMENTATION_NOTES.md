# Implementation notes

## Evolution through v6

### Early builds

The first Android shell demonstrated the basic idea but had several visual/runtime problems seen on the test phone:

- DSKY rendered off-center.
- Android title/action chrome remained visible.
- Faceplate was a modern-looking approximation rather than Apollo hardware.
- Keyboard initially used the wrong arrangement.
- Numeric display fields were compressed because percentage-based layout distorted the individual digits.

### Geometry corrections

Apollo-derived artwork established the front-face coordinate system at roughly 320×372 and confirmed:

- 19 keys in a 7-column × 3-row layout with intentional empty positions.
- 14 annunciator positions in two columns of seven.
- Two blank annunciator positions in the Apollo 11-era LM map.
- Full numeric glyph envelope: 14×24 reference units.
- Sign envelope: 7×24 reference units.

v5 fixed the major width bug by sizing the display from those envelopes.

### v6 EL display

v6 replaced independent HTML/flex digit fields with one SVG display coordinate system (`viewBox="0 0 106 190"`). This prevents the browser from giving PROG/VERB/NOUN/register glyphs different aspect ratios.

The segment geometry uses custom paths rather than generic CSS rectangles. It deliberately uses:

- short chamfered horizontal elements;
- slightly slanted vertical elements;
- very low-opacity unlit segment ghosts;
- restrained blur so the display reads as a flat electroluminescent emitter rather than an LED clock;
- a three-element sign cell (horizontal + separate upper/lower vertical elements).

COMP ACTY, labels, separator rules, and all numeric fields occupy the same SVG glass coordinate system.

## Network-driven COMP ACTY

The local page cannot call Android `TrafficStats` directly. Instead it navigates to `agcnet://poll/<timestamp>`. `NetClient` intercepts the navigation, reads aggregate RX/TX counters, and invokes:

```js
window.AGCDSKY.phoneTraffic(totalBytes)
```

The JS ignores deltas smaller than 512 bytes and varies the lamp pulse duration slightly with transfer size. This is a clock-mode reinterpretation only; authentic AGC mode should drive COMP ACTY from AGC state.

## DreamService

`AgcDreamService` loads the same local assets with:

```
?dream=1&clock=1&dim=1
```

Dream mode:

- hides app controls;
- starts in dim mode;
- sets a low native screen brightness;
- drifts the DSKY by a few pixels once per minute.

## Signing

A persistent signing key was created for v5 and reused for v6. It is not committed. Never put the private signing key in a public repository.

## Remaining high-value work

1. Bundle yaAGC/WebAssembly and one or more Apollo rope images locally.
2. Decode real AGC output channels into the v6 SVG face.
3. Send keypresses back to the AGC core, including the special PRO mechanism.
4. Preserve network-driven COMP ACTY only in phone-clock mode; use authentic AGC activity in emulator mode.
5. Add user-adjustable dream brightness (target 2–25%) through a settings Activity.
6. Do screenshot comparison against close-up genuine DSKY imagery on the actual phone.
7. Add repeatable local build/sign scripts without depending on GitHub Actions.
