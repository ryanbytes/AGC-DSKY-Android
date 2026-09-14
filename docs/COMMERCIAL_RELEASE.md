# Commercial release checklist

This project can be sold under GNU GPL version 2. A price may be charged for the APK or for distribution/support, but recipients keep the GPL rights to copy, modify, and redistribute the GPL-covered software.

For **version 1.0**, keep `release/1.0-commercial-1` fixed as the corresponding-source snapshot for the distributed APK.

## Before distributing an APK

- Build from the fixed corresponding-source snapshot.
- Keep the public source available while the binary is offered.
- Distribute the GPLv2 text and third-party notices with the binary. The app packages both and exposes them through **LEGAL / SOURCE**.
- Do not impose an NDA, no-redistribution term, or other restriction inconsistent with GPLv2.
- Do not publish the private Android signing key. The GPL source requirement does not require distributing private signing credentials.
- If a binary is changed, create and identify a new corresponding-source snapshot rather than pointing buyers at a newer or older tree.

## NASA branding / marketing

The app is an independent historical simulator. Do not market it as official, approved, sponsored, co-created, or endorsed by NASA or the U.S. Government.

Do not use the NASA Insignia, NASA Logotype, NASA Seal, or other NASA identifiers as app/store branding without the applicable NASA approval. Historical terms such as Apollo Guidance Computer, DSKY, Apollo 11, and Comanche 055 should be used descriptively and factually, not as an endorsement claim.

The current recommended product name is **AGC DSKY Android**.

## Store listing baseline

Suggested short description:

> Apollo AGC/DSKY simulator for Android with real yaAGC and Comanche 055.

Suggested disclosure:

> Independent historical simulator. Not affiliated with, sponsored by, or endorsed by NASA or the United States Government. Source code and license information are available in-app under LEGAL / SOURCE and in the public project repository.

## Source and notices

- Repository: https://github.com/ryanbytes/AGC-DSKY-Android
- Version 1.0 source snapshot: `release/1.0-commercial-1`
- GPLv2: `LICENSE`
- Third-party notices: `THIRD_PARTY.md`
- Packaged GPL text: `app/src/main/assets/LICENSE-GPL-2.0.txt`
- Packaged third-party notices: `app/src/main/assets/THIRD_PARTY_NOTICES.txt`
