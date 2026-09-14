# AGC DSKY PWA

The PWA is the no-developer-account iPhone/iPad distribution path. It packages the same shared DSKY HTML/CSS/JavaScript, pinned `yaAGC.wasm`, and Apollo 11 CM `Comanche055.bin` used by the Android and Apple shells.

## Build locally

```bash
git submodule update --init --recursive
pwa/tools/build-site.sh
node pwa/tools/pwa-smoke.js pwa/dist
```

The generated site is in `pwa/dist/` and can be served by any HTTPS static host.

## iPhone/iPad install

1. Open the deployed site in Safari.
2. Let the first page load complete so the service worker can pre-cache the AGC runtime.
3. Use **Share → Add to Home Screen → Add**.
4. Launch **AGC DSKY** from the Home Screen.

The installed web app has no Apple developer signing period and does not expire every seven days. Core application files, `yaAGC.wasm`, and `Comanche055.bin` are pre-cached for offline operation after the first successful load.

## GitHub Pages

`.github/workflows/pwa.yml` builds and validates the static site for pull requests and branch pushes. On a push to `main`, it also attempts a GitHub Pages deployment.

GitHub requires Pages to be enabled for the repository with **Settings → Pages → Build and deployment → Source: GitHub Actions**. That is a one-time repository setting; it does not require a paid Apple developer account.

## What stays shared

The PWA does not fork the AGC behavior. V35, `COMP ACTY`, VERB/NOUN input, relay timing, snapshots, Comanche 055, and the WebAssembly CPU continue to come from `app/src/main/assets` plus the pinned `vendor/webAGC` files.

Browser motion/orientation remains the iPhone sensor path for now. Native iOS Core Motion parity is separate from the PWA and should not be assumed until tested on-device.
