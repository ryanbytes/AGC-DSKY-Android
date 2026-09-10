# AGC DSKY PWA

The PWA is the no-developer-account iPhone/iPad distribution path and the installable browser build for Android/desktop. It packages the same shared DSKY HTML/CSS/JavaScript, pinned `yaAGC.wasm`, and Apollo 11 CM `Comanche055.bin` used by the Android and Apple shells.

## Build locally

```bash
git submodule update --init --recursive
pwa/tools/build-site.sh
node pwa/tools/pwa-smoke.js pwa/dist
node pwa/tools/pwa-parity-smoke.js pwa/dist
```

The generated site is in `pwa/dist/` and can be served by any HTTPS static host.

## Install

### iPhone/iPad

1. Open the deployed site in Safari.
2. Let the first page load complete so the service worker can pre-cache the AGC runtime.
3. Use **Share → Add to Home Screen → Add**.
4. Launch **AGC DSKY** from the Home Screen.
5. Tap once inside the app when prompted by iOS so motion/orientation access can be granted.

### Android

Use the browser's **Install app** / **Add to Home screen** action. The manifest requests fullscreen display, and the PWA also retains the completed-touch fullscreen fallback for Android browsers that install only a shortcut.

The installed web app has no Apple developer signing period and does not expire every seven days. Core application files, `yaAGC.wasm`, and `Comanche055.bin` are pre-cached for offline operation after the first successful load.

## Web-capable parity with the packaged app

The PWA uses the Android app's frontend directly rather than maintaining a fork. CI now verifies the shared frontend is copied into the PWA byte-for-byte except for the intentional PWA index/privacy overlays.

The browser parity layer supplies web equivalents for shell features where the browser exposes an API:

- real `yaAGC` + Comanche 055 execution;
- AGC-driven DSKY, V35, COMP ACTY, relay audio, clock mode, EL-only mode, cheat sheet and diagnostics;
- AGC state save/restore using browser storage;
- camera sextant and navigation-star helper using `getUserMedia` and geolocation;
- phone orientation input for ICDU simulation;
- `DeviceMotionEvent` linear-acceleration input for the PIPA path, including a gravity-estimation fallback when only acceleration-with-gravity is exposed;
- absolute browser orientation/compass input for magnetic yaw correction and star-finder pointing when the browser supplies it;
- screen Wake Lock where supported, matching Android's keep-screen-on behavior;
- fullscreen/standalone operation and offline service-worker caching.

Browser permissions and hardware support still control camera, location, motion, compass and Wake Lock availability. iOS requires motion/orientation permission to be requested from a user gesture; the parity bridge requests both permissions from the same completed gesture.

Android-only operating-system integrations cannot exist as ordinary web APIs and are therefore outside PWA parity: Android DreamService/screensaver registration, the native home-screen widget, and selection as the Android HOME launcher.

## GitHub Pages

`.github/workflows/pwa.yml` builds and validates the static site for pull requests and branch pushes. On a push to `main`, it also attempts a GitHub Pages deployment.

GitHub requires Pages to be enabled for the repository with **Settings → Pages → Build and deployment → Source: GitHub Actions**. That is a one-time repository setting; it does not require a paid Apple developer account.
