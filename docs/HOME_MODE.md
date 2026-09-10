# Dedicated Home and Fire modes

AGC DSKY can be selected as Android's default **Home app** for a dedicated phone or tablet display.

This is optional. Installing AGC DSKY does not replace the normal launcher automatically.

## Enable

1. Open Android **Settings**.
2. Open **Apps** > **Default apps** > **Home app** (wording varies by Android build).
3. Select **AGC DSKY v1.0**.

Once selected, Android treats AGC DSKY as the device Home activity. It will be brought up as Home after boot and when the Home gesture/button is used.

On Amazon Fire OS 7, Amazon's launcher advertises its HOME activity at a higher
intent-filter priority than ordinary sideloaded apps. Fire OS can therefore
record DSKY as the preferred HOME activity while still resolving HOME to
`com.amazon.firelauncher/.Launcher`.

For a dedicated Fire tablet, build the current APK and run:

```bash
bash tools/fire-tablet-home-setup.sh app/build/outputs/apk/fire/debug/app-fire-debug.apk
```

The setup script installs and launches DSKY once, verifies both the regular
launcher and HOME registrations, assigns `SensorMainActivity` as HOME, and only
then attempts to disable `com.amazon.firelauncher`. If disabling is supported,
it requires the native HOME resolver to return DSKY. Fire OS builds that protect
Amazon Launcher cannot meet that resolver condition without root; on those
builds the Fire APK restores the previous same-package accessibility/boot path.
The script enables that path, presses HOME, reboots, and requires DSKY to return
to the foreground. If any post-safety check fails, it idles Fire Mode,
re-enables Amazon Fire Launcher, and returns it to HOME.

The resulting HOME component is:

```text
org.apollo.agcdsky/.SensorMainActivity
```

## Disable

Return to Android's **Home app** setting and select the normal launcher again.

On a Fire tablet configured by the script, re-enable Amazon Home first:

```bash
adb shell pm enable --user 0 com.amazon.firelauncher
adb shell cmd package set-home-activity --user 0 com.amazon.firelauncher/.Launcher
adb shell input keyevent KEYCODE_HOME
```

The regular Home mode uses no `BOOT_COMPLETED` receiver, background-start
permission, Internet permission, or always-running startup service.

The regular APK has no boot receiver or accessibility service. The Fire APK is
a separate build flavor and adds only the opt-in Fire boot receiver and
same-package launcher redirect needed on protected Fire OS firmware. Neither
variant requests Internet access.
