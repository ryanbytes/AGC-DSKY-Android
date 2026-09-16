# Phase 36 — persistent app controls

The application controls below the DSKY no longer disappear on a timer.

Behavior in the normal DSKY presentation:

- a long press on the DSKY/background still reveals the controls;
- once visible, the controls remain visible indefinitely;
- a short tap on the DSKY/background hides them;
- tapping a control does not hide the controls;
- DSKY key presses do not count as tap-away gestures;
- Dream, display-only, and EL-only presentation rules remain unchanged.

The old 5.5-second `controls-visible` removal timer was deleted. The tap-away path is tracked from pointer-down to pointer-up so the long-press gesture that reveals the controls cannot immediately dismiss them on release.

The regular sideload build carrying this behavior is 1.1.20 / versionCode 20090 and retains the standalone release certificate used by the preceding builds.
