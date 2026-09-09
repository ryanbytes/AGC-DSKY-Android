# Dedicated Home and Fire modes

AGC DSKY 1.0 supports two separate opt-in startup paths.

## Standard Android Home mode

AGC DSKY can be selected as Android's default **Home app** for a dedicated phone or tablet display. Installing the app does not replace the normal launcher automatically.

### Enable

1. Open Android **Settings**.
2. Open **Apps** > **Default apps** > **Home app** (wording varies by Android build).
3. Select **AGC DSKY v1.0**.

Once selected, Android treats AGC DSKY as the device Home activity. It will be brought up as Home after boot and when the Home gesture/button is used.

### Disable

Return to Android's **Home app** setting and select the normal launcher again.

## Amazon Fire mode

Fire OS may not expose or honor the normal Android Home-app picker. Version 1.0 therefore also includes a separate **AGC DSKY Fire Mode** launcher entry.

Fire Mode is disabled by default. It does not run on non-Amazon devices.

### Enable

1. Install AGC DSKY 1.0.
2. In the Fire tablet's app list, open **AGC DSKY Fire Mode**.
3. A toast reports **AGC DSKY Fire Mode ON**.
4. Reboot the Fire tablet.

The enabled boot receiver makes a best-effort request to launch AGC DSKY after Fire OS finishes booting. Fire OS versions that restrict background activity starts may still return to Amazon Home instead; standard Home mode or ADB launcher assignment can still be used where supported.

### Disable

Open **AGC DSKY Fire Mode** again. A toast reports **AGC DSKY Fire Mode OFF** and the boot receiver is disabled.

The Fire helper uses `RECEIVE_BOOT_COMPLETED`, has no Internet requirement, does not run as an always-on service, and leaves the normal Android Home mode intact.
