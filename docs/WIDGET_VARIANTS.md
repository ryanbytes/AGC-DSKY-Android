# Independent DSKY Android home widgets — v1.1.67 candidate

This replaces the earlier (unreleased) design in which a single Android widget
followed the application's interactive CLOCK/AGC mode.

## Widget picker entries

| Picker label | Android receiver | Header legends | Upper numeric electrodes | R1/R2/R3 |
| --- | --- | --- | --- | --- |
| DSKY Classic Clock | `org.apollo.agcdsky.ElWidgetProvider` | PROG / VERB / NOUN | Off | HH / MM / SS |
| DSKY Date Clock | `org.apollo.agcdsky.DateElWidgetProvider` | YEAR / MONTH / DAY | YY / MM / DD | HH / MM / SS |

- Both widgets can exist concurrently in any number. Resizing either does not
  change the other.
- The previous `ElWidgetProvider` component identity is preserved: existing
  launcher placements become Classic Clock automatically when upgraded.
- Neither widget reads WebView localStorage or changes on interactive
  CLOCK/AGC or DreamService transitions.
- Both use the same geometric EL renderer, static legend vector paths,
  accurate NTP-backed time source, and Android 12+ RemoteViews register
  flippers (with pre-Android 12 static register fallback).
- The existing non-wakeup RTC minute tick is shared by both providers.
  Deleting the last widget of one kind does not cancel the tick while any
  instance of the other kind survives.
- Both variants retain the inactive COMP ACTY print without illuminating its
  EL surface.
- Date legend shapes use the same League Spartan Medium vector source family
  as the existing native widget lettering; they do not claim to be the exact
  historical SCD-specified Futura Demibold outlines (see THIRD_PARTY.md).

## Source/build gates

```bash
node tools/el-widget-smoke.js
node tools/el-widget-labels-smoke.js
bash tools/build-local.sh
```

The label smoke must execute `SvgPathParserRegressionTest.java` with the
actual Java parser for all eight PROG/VERB/NOUN/YEAR/MONTH/DAY/COMP/ACTY
outlines. The APK gate must confirm both provider receiver classes and both
provider XML resources in the merged Regular and Fire packages.

## Physical acceptance

1. Confirm *two* entries appear in the Android widget picker under AGC DSKY.
2. Add both simultaneously; Classic retains PROG/VERB/NOUN with blank upper
   numerical positions and live time registers; Date displays YEAR/MONTH/DAY
   with accurate YY/MM/DD and live time registers.
3. Independently resize, remove, and re-add each variant. Verify a surviving
   widget still receives minute updates after its sibling is removed.
4. Toggle interactive AGC and CLOCK and start/stop Dream. Neither launcher
   widget changes its identity or stops displaying time.
5. Check midnight/date/month/year rollover, time-zone changes, NTP refresh,
   launcher and process restarts, and an in-place update over v1.1.66.
6. Confirm both Regular and Fire release APKs were built from the same commit,
   signed with the established standalone certificate, and inspected before
   merging or publishing a GitHub Release.

**Verification status (2026-10-14):** The widget implementation and source
regression checks are committed to draft PR #324. GitHub source/readback checks
can be performed from this session, but the canonical Node/Java tests, Android
Gradle build, signing, and physical runtime gates have **not** been executed
here. v1.1.67 is not a published release.
