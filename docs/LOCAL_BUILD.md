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

The pinned submodule must provide all three binary inputs:

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
2. Verifies the recursive webAGC binary inputs are present.
3. Runs the dependency-free frontend and AGC-core JavaScript smoke tests when Node is installed.
4. Runs `:app:verifyPinnedAgcAssets`, which checks exact byte lengths and Git-blob SHA-1 values before Android packaging.
5. Runs `:app:assembleDebug`.
6. Runs `tools/verify-apk.sh` against the produced APK.

The expected debug APK is:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## APK verification

`tools/verify-apk.sh` independently checks the built archive, not just the source tree. It requires `unzip`, `git`, `aapt2`, and `apksigner`.

It verifies:

- packaged `assets/yaAGC.wasm` is 132,617 bytes and Git blob `713685680492098d05437b99c26403f683d56009`
- packaged `assets/Luminary099.bin` is 73,728 bytes and Git blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- packaged `assets/Comanche055.bin` is 73,728 bytes and Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`
- the merged APK manifest does not request `android.permission.INTERNET`
- the APK signature verifies with `apksigner`

A passing build/verification run still does not prove the AGC runtime. The resulting APK must then be installed on Android/GrapheneOS and tested for WASM instantiation, real channel output, DSKY input, lifecycle behavior, DreamService, and SOLAR location handling.
