# AGC DSKY Android

Android Apollo Block II DSKY clock/screensaver project, currently at **v6**.

![v6 DSKY preview](docs/agc_v6_preview.png)

## Current v6 build

The APK currently being tested is a lightweight native Android/WebView shell with a locally bundled DSKY face. It is **not yet the full offline yaAGC CPU emulator**.

Current features:

- Apollo Block II-inspired 19-key DSKY layout.
- Apollo 11-era LM 2×7 annunciator layout, including the two blank positions.
- Fixed-coordinate SVG electroluminescent display so digit fields cannot be independently stretched by CSS.
- 14×24 numeric character envelope and 7×24 sign envelope derived from Apollo DSKY artwork.
- Chamfered/slanted EL segment geometry based on close inspection of restored real DSKY hardware and Apollo-derived drawings.
- `V16 N65` phone clock mode.
- `V35E` lamp test.
- Dim mode.
- Android `DreamService` screen saver intended for charging/idle use.
- Small periodic position drift in dream mode to reduce completely static OLED content.
- `COMP ACTY` repurposed in clock mode to pulse from **aggregate device network traffic** using `TrafficStats.getTotalRxBytes()` + `getTotalTxBytes()`. No packet contents, destinations, UIDs, or app identities are inspected.
- `WEB AGC` control opens the webAGC demo. This is the only current part that requires Internet access.

The tested v6 APK is checked in at [`releases/AGC-DSKY-Android-v6.apk`](releases/AGC-DSKY-Android-v6.apk).

## Important distinction: DSKY clock vs. real AGC

The current v6 APK implements the DSKY/clock/screensaver locally. The complete Apollo Guidance Computer execution core is **not bundled into v6**. The next major implementation step is to package yaAGC/WebAssembly and Apollo rope images locally and drive this DSKY from real AGC I/O channels.

That work should preserve the current v6 face as the UI while replacing the clock-mode state machine with actual AGC output when emulator mode is active.

## Screen saver

Android uses a `DreamService` for system screen savers. After installing:

1. Open Android **Screen saver** settings.
2. Select **AGC DSKY Clock** / AGC DSKY as the screen saver.
3. Set the system start condition to **While charging**.

The dream URL starts in clock + dim mode and uses a low screen brightness in the native service.

## COMP ACTY behavior

On a real DSKY, COMP ACTY represented AGC computer activity. In the phone clock mode it is deliberately repurposed as a phone-activity indicator:

1. The page requests a sample about every 400 ms using the private `agcnet://poll` URL scheme.
2. `NetClient` intercepts it in the WebView.
3. Android `TrafficStats` supplies only aggregate RX+TX byte counters.
4. Increases of at least 512 bytes pulse COMP ACTY for a short period.

When a real AGC core is integrated, emulator mode should use authentic AGC COMP ACTY state instead.

## Source layout

- `app/src/main/assets/index.html` — DSKY structure and fixed EL SVG coordinate system.
- `app/src/main/assets/style.css` — physical faceplate, annunciators, keys, display treatment.
- `app/src/main/assets/app.js` — DSKY input, clock, lamp test, dimming, network COMP ACTY, dream pixel drift.
- `MainActivity.java` — immersive interactive WebView shell.
- `AgcDreamService.java` — Android screen saver shell.
- `NetClient.java` — aggregate traffic bridge.
- `docs/IMPLEMENTATION_NOTES.md` — design/build history and remaining work.
- `docs/REFERENCES.md` — Apollo/VirtualAGC/CuriousMarc references used during development.

## Android Studio build

The repository now includes a conventional Android Gradle project for continued development:

- JDK 17
- compile/target SDK 37
- Android Gradle Plugin 9.3.0

```bash
gradle :app:assembleDebug
```

The locally produced v6 APK was built in a restricted environment using a minimal direct APK toolchain rather than this Gradle project, so the checked-in Gradle source is the maintainable source form of the same shell/UI rather than a byte-for-byte reproduction of `classes.dex`.

## Signing

The private v5+ signing key is intentionally **not committed**. v5 and v6 were signed with the same retained key so v6 can install over v5. Keep signing keys outside the repository.

## GitHub Actions

No GitHub Actions workflow is enabled. Builds are intentionally local/manual at present.

## License

Android/frontend code in this repository is GPL-2.0. See `THIRD_PARTY.md` for upstream/reference attribution.
