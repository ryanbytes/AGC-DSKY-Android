# Dedicated Home and Fire modes

AGC DSKY 1.0 has two separate startup paths.

## Standard Android Home mode

The normal `play` build can be selected as Android's default **Home app** for a dedicated phone or tablet. Installing it does not replace the normal launcher automatically.

Enable it from Android **Settings > Apps > Default apps > Home app** and choose **AGC DSKY v1.0**. Once selected, Android brings AGC DSKY up after boot and whenever Home is pressed.

This path remains in both the Play and Fire builds.

## Amazon Fire mode (sideload build only)

Amazon Fire OS does not reliably honor third-party Home activities and blocks ordinary apps from forcing an Activity to the foreground from `BOOT_COMPLETED`. The Fire APK therefore adds an opt-in accessibility-based redirect.

1. Install the **Fire** APK.
2. Open **AGC DSKY Fire Mode** from the app grid.
3. Fire Mode turns on and opens Accessibility settings if the redirect service is not already enabled.
4. Enable **AGC DSKY Fire Redirect** in Accessibility.
5. Reboot.

When Fire Mode is enabled, the accessibility service observes only foreground-window package changes. When Amazon's launcher becomes foreground, it redirects to AGC DSKY. Android restores enabled accessibility services across reboots, so the service also performs a delayed DSKY launch when it reconnects after boot.

Opening **AGC DSKY Fire Mode** again turns Fire Mode off. The accessibility service may remain enabled in system settings, but it stays idle while Fire Mode is off.

The Fire code checks `Build.MANUFACTURER` and refuses to activate on non-Amazon devices.

## Distribution split

- **Play build:** standard Android Home mode only; no Fire accessibility service or boot receiver.
- **Fire build:** standard Android Home mode plus the opt-in Fire accessibility redirect and boot fallback.

This separation keeps the Play package free of an Accessibility API feature whose sole purpose is Fire OS launcher redirection.
