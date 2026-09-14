# Privacy Policy — AGC DSKY Android

**Effective date: September 9, 2026**

AGC DSKY Android is an independent historical Apollo Guidance Computer / DSKY simulator. This policy explains the user and device data the app accesses and how that data is handled.

## Data the app accesses

AGC DSKY Android may access the following data only when required for an app feature and when Android grants the applicable permission:

- **Camera:** used for the live sextant view.
- **Approximate or precise location:** used for local astronomical calculations such as horizon and navigation-star assistance.
- **Motion and orientation sensor data:** used for the simulated spacecraft/optics input paths.
- **App state and preferences:** simulator state, settings, and related local configuration may be stored on the device so the app can restore its state.

## Collection, transmission, and sharing

AGC DSKY Android does **not** declare the Android `INTERNET` permission. The app does not intentionally transmit camera imagery, location, sensor readings, simulator state, or other user data to the developer or to third parties.

The app contains no advertising SDK, analytics SDK, user account system, cloud synchronization service, or developer-operated backend. The developer does not sell or share personal data obtained through the app.

For purposes of Google Play's Data safety form, information that is accessed and processed only on the device and is not transmitted off the device is not treated as collected by the developer.

## Data security

Sensitive inputs are processed locally within the Android application sandbox. Because the app has no Android Internet permission, it does not provide a direct network path for transmitting those inputs.

## Retention and deletion

Camera, location, and motion data used by live features are processed locally. App preferences and saved simulator state may remain in the app's private local storage until they are overwritten, cleared through Android's app-storage controls, or removed when the app is uninstalled.

AGC DSKY Android does not create user accounts and the developer does not maintain a server-side user-data record to delete.

## Permissions and user control

Camera and location permissions can be denied or revoked at any time through Android system settings. Features that require a denied permission may be unavailable or reduced in functionality.

Users can delete locally stored app data through Android's **App info → Storage → Clear storage/data** controls or by uninstalling the app.

## Children

The app is a general historical/technical simulator and is not specifically directed to children. It does not knowingly collect personal information from children or other users.

## Third parties and external services

The app bundles open-source and historical simulation components described in the project's third-party notices. These components operate locally in this Android build. No third-party advertising, analytics, or cloud-data service is integrated into the app.

## Changes to this policy

Material changes to this policy will be published in the public source repository and reflected in future distributed versions of the app when applicable.

## Privacy inquiries

Privacy questions can be submitted through the public project issue tracker:

https://github.com/ryanbytes/AGC-DSKY-Android/issues

Project repository:

https://github.com/ryanbytes/AGC-DSKY-Android

AGC DSKY Android is not affiliated with, sponsored by, or endorsed by NASA or the United States Government.
