# AGC DSKY self-updates

Release builds for both Android targets use the same native updater.

## Device behavior

- Release builds check `https://api.github.com/repos/ryanbytes/AGC-DSKY-Android/releases/latest` at startup and on a 12-hour inexact alarm.
- Debug / `-eltest` builds never self-update.
- `regular` selects `app-regular-release.apk`.
- `fire` selects `app-fire-release.apk`.
- Draft and prerelease GitHub releases are ignored.
- The release tag must be semantic, for example `v1.1.5`, and newer than the installed `versionName`.
- The downloaded APK must have a higher Android `versionCode` than the installed app.
- SHA-256 must be supplied either by the GitHub release asset `digest` field or by an adjacent `<apk>.sha256` release asset.
- The downloaded APK package name and signing certificate must match the installed app before PackageInstaller is invoked.
- Android / Fire OS may require the user to allow this app as an install source and may still display the system install confirmation. The updater cannot bypass those OS security prompts.

## Preparing a release

Build and sign the regular and Fire release APKs with the same Android signing identity already installed on devices. Then run:

```bash
tools/prepare-update-release.sh /path/to/signed-regular.apk /path/to/signed-fire.apk
```

This verifies both APK signatures and writes exactly four upload assets under `dist/update-release/`:

```text
app-regular-release.apk
app-regular-release.apk.sha256
app-fire-release.apk
app-fire-release.apk.sha256
```

Create a normal (non-draft, non-prerelease) GitHub Release tagged with the new application version, such as `v1.1.5`, and upload all four files.

Do not publish an APK signed with a different key. Android will reject it, and the app also rejects it before opening the installer.
