# Google Play submission checklist — AGC DSKY 1.0

This checklist is for the Android package `org.apollo.agcdsky`, version name `1.0`, version code `20034`.

## Developer account

- Create/verify the Google Play Console developer account.
- Choose **Personal** if publishing as an individual or **Organization** only if the publisher is an eligible organization with the required verification details.
- Complete identity, contact, device, and payments-profile verification requested by Play Console.
- If selling the app, configure the merchant/payments profile and make the listing **Paid** before first production publication. A listing first published as free generally cannot later be changed to paid.

## Create app

- App name: `AGC DSKY`
- Default language: English (United States)
- App or game: App
- Suggested category: Education
- Package name: `org.apollo.agcdsky`

## Release artifact

- Upload a signed Android App Bundle (`.aab`), not the standalone APK, for the new Play app.
- Enroll in Play App Signing when prompted.
- Preserve the upload key used for future bundle uploads; Play App Signing keeps the store-distributed app-signing key separately.
- Version name: `1.0`
- Version code: `20034`
- Target SDK: 37 (meets the current Play requirement of API 36+ for new phone/tablet submissions after August 31, 2026).

## Main store listing

Use `docs/PLAY_STORE_LISTING.md` for the prepared title, short description, full description, disclosure text, and screenshot order.

Required graphic assets for this release package:

- 512 × 512 32-bit PNG app icon.
- 1024 × 500 JPEG or 24-bit PNG feature graphic with no alpha.
- At least 2 phone screenshots. Three are prepared: Main DSKY, Sextant, EL-only display.

## Privacy policy

Play Console privacy-policy URL:

https://github.com/ryanbytes/AGC-DSKY-Android/blob/release/1.0-commercial-1/PRIVACY.md

The same policy is packaged offline in the app under **LEGAL / SOURCE**.

## Data safety

Based on version 1.0 as packaged:

- Data collected by developer: **No**.
- Data shared with third parties: **No**.
- Advertising SDK: **None**.
- Analytics SDK: **None**.
- User accounts: **None**.
- Cloud/backend service: **None**.

The app accesses camera, location, and motion/orientation sensors for on-device functionality. These inputs are processed locally and are not intentionally transmitted off the device. The Android manifest does not declare `INTERNET`.

When Play Console asks about individual data types, do not mark locally processed data as collected unless the final Play build is changed to transmit it off-device.

## App content declarations

- Ads: **No**.
- App access: **No restricted/login-only functionality**.
- Government app: **No**.
- News app: **No**.
- Financial features: **No**.
- Health features: **No**.
- Target audience: general historical/technical audience; not specifically directed to children. Avoid under-13 targeting unless intentionally entering the Families policy program.
- Content rating: complete the IARC questionnaire truthfully; the app contains no gambling, sexual content, drugs, realistic violence, or user-generated/social content in the app itself.

## Permissions reviewers may notice

### Camera

Purpose: live command-module sextant view. Camera access is user-triggered and tied to the sextant feature.

### Approximate / precise location

Purpose: local astronomical calculations for horizon and navigation-star assistance. The app does not request background-location permission.

### Motion/orientation sensors

Purpose: simulated spacecraft/optics input paths. No special Android runtime permission is required for normal motion-sensor access.

## Testing requirement for newer personal accounts

If the Play developer account is a personal account created after November 13, 2023, Google currently requires a closed test with at least **12 testers continuously opted in for at least 14 days** before production access can be requested.

Recruit more than 12 if possible so one tester leaving does not reset eligibility. Ask testers to actually use the DSKY, sextant, EL-only widget, DreamService, state restore, and permission flows and keep notes on feedback because the production-access application asks about testing.

## Recommended closed-test script

1. Fresh install and launch; confirm DSKY appears and CLOCK starts as expected.
2. Enter AGC mode and exercise several DSKY keys.
3. Run `V35` lamp/display test.
4. Open SEXTANT; allow camera; confirm live view and motion response.
5. Deny/revoke camera once; confirm no repeated permission/retry loop.
6. Allow location and verify star-helper behavior.
7. Background/restore app during SXT use.
8. Exercise EL-only home-screen widget.
9. Start/stop DreamService/screensaver if available on the tester's device.
10. Background/foreground and process-recreation state behavior.
11. Report crashes, permission loops, display scaling problems, and device model/Android version.

## Before production rollout

- Verify the exact AAB version code is not already used in Play Console.
- Confirm the privacy-policy URL opens publicly without login.
- Confirm the public source branch `release/1.0-commercial-1` matches the distributed binary's corresponding source.
- Confirm store screenshots depict the current app and contain no NASA insignia/seal/logotype.
- Confirm listing text does not claim NASA sponsorship, approval, or endorsement.
- Review Play Console's automated pre-review checks and resolve all errors before submitting.
