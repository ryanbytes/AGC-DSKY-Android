# AGC DSKY Android

Independent Apollo Guidance Computer / DSKY simulator for Android. It runs the real `yaAGC` WebAssembly core with the Apollo 11 Command Module **Comanche 055** rope and keeps the normal runtime offline.

> Not affiliated with, sponsored by, or endorsed by NASA or the United States Government. NASA names and mission references are used descriptively for historical identification.

## Screenshots

| Main DSKY | Sextant | EL-only display |
| --- | --- | --- |
| ![Main DSKY](docs/screenshots/main-dsky.webp) | ![Sextant](docs/screenshots/sextant.webp) | ![EL-only display](docs/screenshots/el-only.webp) |

The sextant screenshot shows the real app UI with a static demonstration pointing state; it does not contain a camera photograph.

## What it does

- Apollo Block II-style 19-key DSKY.
- Real `yaAGC` execution with pinned **Comanche 055**.
- Real AGC relay/channel-driven DSKY output, including `COMP ACTY`.
- Phone IMU / ICDU and PIPA input paths.
- Camera-based CM sextant interface with MARK / MARK REJECT and Apollo navigation-star helper.
- AGC state save/restore and runtime diagnostics.
- Synthetic relay-click audio.
- Android DreamService clock/screensaver.
- Resizable **EL-only** home-screen widget.
- Optional Android **Home app** mode for dedicated boot-to-DSKY phones/tablets.
- No Android `INTERNET` permission in the packaged app.

## Dedicated Home mode

AGC DSKY can be selected manually as Android's default **Home app**. When selected, Android launches it as Home after boot and when Home is pressed. Installing the app does not replace the normal launcher automatically.

See [docs/HOME_MODE.md](docs/HOME_MODE.md).

## Build

Requirements: JDK 17, Node.js 18+, Android SDK 37 / Build Tools 36, and the pinned `vendor/webAGC` submodule.

```bash
git clone --recurse-submodules https://github.com/ryanbytes/AGC-DSKY-Android.git
cd AGC-DSKY-Android
bash tools/build-local.sh
```

The build verifies the pinned webAGC revision and packaged `yaAGC.wasm` / `Comanche055.bin` identities before packaging.

## Privacy, licensing, and distribution

The Android/frontend project is **GNU GPL version 2**. GPLv2 permits selling copies, but recipients retain the GPL rights to source, modification, and redistribution.

- [Privacy policy](PRIVACY.md)
- [GPLv2 license](LICENSE)
- [Third-party notices](THIRD_PARTY.md)
- [Commercial release checklist](docs/COMMERCIAL_RELEASE.md)
- [Google Play listing copy](docs/PLAY_STORE_LISTING.md)
- [Google Play submission checklist](docs/PLAY_STORE_SUBMISSION.md)

The app includes an offline **LEGAL / SOURCE** screen with the privacy policy, corresponding-source location, complete GPLv2 text, third-party notices, and NASA/U.S. Government non-endorsement statement.

## Current commercial release

**Version 1.0** uses `release/1.0-commercial-1` as the fixed corresponding-source branch. The Home-mode build keeps version name `1.0` and uses Android version code `20035`.
