# Local Android build and verification

The AGC DSKY APK is intentionally built and verified locally. Do not add or use GitHub Actions, Codespaces, or another hosted build service for this project.

## Required toolchain

The repository currently pins Android Gradle Plugin 9.3.0 and `compileSdk 37`.

Required minimums:

- JDK 17 or newer compatible with AGP 9.3
- Gradle 9.5.0 or newer
- Android SDK platform 37
- Android SDK Build Tools 36.0.0 or newer compatible with AGP 9.3
- Git with the `vendor/webAGC` submodule initialized

The repository does not currently contain a Gradle wrapper. Do not add a guessed or reconstructed `gradle-wrapper.jar`; generate/add the official wrapper only from a trusted Gradle distribution.

## Checkout

For a fresh checkout:

```bash
git clone --recurse-submodules <repository-url>
cd AGC-DSKY-Android
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

The submodule gitlink is pinned to:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

`tools/build-local.sh` refuses to build if `vendor/webAGC` is at another revision or has local modifications. The pinned checkout must provide all three binary inputs:

- `vendor/webAGC/src/yaAGC.wasm`
- `vendor/webAGC/demo/agc/Luminary099.bin`
- `vendor/webAGC/demo/agc/Comanche055.bin`

## Build

Set either `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then run:

```bash
bash tools/build-local.sh
```

The script performs these gates in order:

1. Verifies Gradle is at least 9.5.0 and Android platform 37 exists.
2. Verifies `vendor/webAGC` is the exact pinned clean checkout.
3. Verifies the recursive webAGC binary inputs are present.
4. Runs the dependency-free frontend and AGC-core JavaScript smoke tests when Node is installed.
5. Runs `:app:verifyPinnedAgcAssets`, which checks exact byte lengths and Git-blob SHA-1 values before Android packaging.
6. Runs `:app:assembleDebug`.
7. Runs `tools/verify-apk.sh` against the produced APK.

The expected debug APK is:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Source invariants checked before the Android build

The source smoke tests currently guard several properties that should not regress silently:

- no `android.permission.INTERNET`
- Android backup disabled for local-only app/WebView state
- both WebViews explicitly block network loads
- both WebViews disable `file://` and `content://` access
- geolocation is restricted to the packaged synthetic HTTPS origin
- top-level WebView navigation is restricted to packaged `/assets/` content
- mission selection and requested AGC mode persist as designed
- DreamService does not start yaAGC
- yaAGC loader wiring performs rope load, disposable I/O initialization, final CPU reset, then DSKY U-bit mask setup
- user DSKY packet-write failures are routed through the AGC error handler rather than silently dropped

These are source/control-flow checks, not substitutes for Android runtime testing.

## APK verification

`tools/verify-apk.sh` independently checks the built archive, not just the source tree. It requires `unzip`, `git`, `aapt2`, and `apksigner`. When Android tools are resolved from the SDK, the script selects the newest installed Build Tools version using version-aware ordering.

It verifies:

- packaged `assets/yaAGC.wasm` is 132,617 bytes and Git blob `713685680492098d05437b99c26403f683d56009`
- packaged `assets/Luminary099.bin` is 73,728 bytes and Git blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- packaged `assets/Comanche055.bin` is 73,728 bytes and Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`
- the merged APK manifest does not request `android.permission.INTERNET`
- the APK signature verifies with `apksigner`

A passing build/verification run still does not prove the AGC runtime. The resulting APK must then be installed on Android/GrapheneOS and tested for real WASM instantiation, real channel output, DSKY input, lifecycle behavior, DreamService, and SOLAR location handling.
