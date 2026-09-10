# AGC DSKY for iPhone, iPad, and Mac

This Apple target wraps the same HTML/CSS/JavaScript DSKY, pinned `yaAGC.wasm`, and Apollo 11 CM `Comanche055.bin` used by the Android app. The AGC implementation is not rewritten in Swift.

## Requirements

- macOS with Xcode
- The repository checked out with its pinned `vendor/webAGC` submodule

```bash
git submodule update --init --recursive
apple/tools/verify-pinned-assets.sh
```

## Open in Xcode

```bash
open apple/AGCDSKY.xcodeproj
```

Targets:

- `AGCDSKYiOS` — iPhone/iPad
- `AGCDSKYmacOS` — native macOS

For a physical iPhone/iPad, select your Apple development team in Signing & Capabilities. The simulator and unsigned macOS CI builds do not require signing.

## Command-line build checks

```bash
xcodebuild \
  -project apple/AGCDSKY.xcodeproj \
  -target AGCDSKYmacOS \
  -configuration Debug \
  -sdk macosx \
  CODE_SIGNING_ALLOWED=NO \
  build

xcodebuild \
  -project apple/AGCDSKY.xcodeproj \
  -target AGCDSKYiOS \
  -configuration Debug \
  -sdk iphonesimulator \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Runtime design

The app uses `WKWebView` with a private `agcdsky://app/` asset scheme. `AGCAssetSchemeHandler` serves only files staged into the application bundle. The build phase copies the shared Android web assets and the two verified pinned VirtualAGC files into `WebAssets/`.

Using a WebKit scheme handler avoids fragile `file://` WebAssembly fetches while keeping the AGC runtime local to the app. External top-level HTTP/HTTPS links are opened in the system browser instead of navigating the DSKY WebView.

The existing JavaScript remains authoritative for DSKY relay behavior, V35, `COMP ACTY`, VERB/NOUN input, snapshots, and AGC timing. iOS also keeps the screen awake while the app is active; macOS uses a process activity assertion for the same purpose.

## Current Apple-specific limitations

The core DSKY/AGC path is shared. Android-only native integrations such as the `SensorMainActivity` Core Motion equivalent and Android widget/dream/home-launcher features are not part of this first Apple target. Browser `DeviceOrientation` remains available as a WebKit fallback where supported. Camera/sextant permission plumbing is present, but device runtime behavior must be verified on an actual iPhone before claiming parity.
