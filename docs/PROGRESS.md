## 2026-09-30 v1.1.60 complete EL symbol placement

Carries the final drawing-backed EL symbol placement from the audit branch onto current main without replaying stale release metadata or losing the v1.1.59 updater repair.

The register sign row remains at the accepted drawing-backed datum, while the EL glass and native/generated widget frame now extend left far enough to contain the full sign envelope. Screen-only mode reserves 16 CSS px per side (32 px total) and allows the EL panel overflow needed for the complete sign geometry. Native widget framing, generated second frames, WebView glass, and regression locks are aligned to the same overhang.

Release candidate identifiers: 1.1.60 / Android versionCode 2026093007.

## 2026-09-30 v1.1.59 updater freshness repair

Observed failure: a device process that had already completed an automatic update check could miss a release published afterward because foreground resumes reused the 12-hour background freshness window. That made a newly published release legitimately invisible until manual CHECK, process restart, or the next periodic alarm.

Repair: keep the 12-hour background alarm, but foreground resumes now recheck when the last successful discovery is at least 60 seconds old. Release HTTP connections also disable response caching and request no-cache semantics. Pending verified APKs are still offered before any network check, manual CHECK remains force-immediate, transient-network retry behavior is unchanged, and all existing signer/package/version/checksum gates remain intact.

Release candidate identifiers: 1.1.59 / Android versionCode 2026093006. The self-update smoke now locks the short foreground freshness window and cache-bypass behavior.

## 2026-09-30 v1.1.58 EL audit regression lock

Carries forward the post-v1.1.57 drawing-audit result without replaying the divergent candidate history. The accepted screen-only renderer geometry remains unchanged from v1.1.57. The geometry lock now additionally requires exactly two occurrences of the accepted inset-width expression so the front EL face and parallax indicator-package rear cannot drift apart independently.

The completed drawing audit measured the accepted source geometry at digit height 0.500351988 in, upper width 0.317299151 in, top-to-middle datum 0.220000000 in, side bevels 60.275606/59.896393 degrees, center gaps 0.010000 in, and sign envelope 0.338 x 0.265 in with 0.010-in gaps.

Release candidate identifiers: 1.1.58 / Android versionCode 2026093005. Full CI, standalone signing, and publication remain release gates.

## 2026-09-30 v1.1.57 full-screen EL viewport clearance

Transplanted the post-v1.1.56 screen-only EL work onto current main without replaying the already-squashed 1.1.56 history. Screen-only EL artwork now reserves 8 CSS pixels on each side while preserving the 1006315G active-face aspect ratio; the parallax indicator-package rear uses the identical inset dimensions so it remains aligned with the EL face.

Release candidate identifiers: 1.1.57 / Android versionCode 2026093004. Source/build/signing/publication gates are pending CI and standalone release verification.

## 2026-09-30 EL accuracy release candidate preparation

Candidate source version is 1.1.56 / versionCode 2026093003, with the matching application label. These identifiers are a source candidate only. No release APK has been built or signed; the normal local Android build and standalone signing gates remain required before publishing.

## 2026-09-30 EL sign geometry correction

MIT/IL SCD 1006315G Detail A specifies a .338-in nominal sign envelope (.333/.343 limits), .265-in B-island width (.260/.270 limits), .065-in nominal thickness (.060/.070 TYP limits), and .010-in minimum spacing between A/B islands. The older STEP sign solids and all three app render paths were too small; the STEP profile was not used to overrule the controlled drawing.

Updated the WebView, Android widget, and generated clock frames to the drawing nominal island dimensions. Placement retains the STEP-derived B-island center and existing register-row datum. The source conformance smoke now measures the Detail A envelope, B width, thickness, both gaps, and clearance to the first digit; the geometry lock requires the same paths in all three renderers.

Source smoke checks were executed against the modified source contents in the available JavaScript runtime and passed. The full repository build and device visual check have not run in a local checkout.

# AGC DSKY Android progress

Last updated: 2026-09-29

## 2026-09-29 v1.1.53 terse Apollo-style panel nomenclature

Owner requested more NASA/Apollo-like names for the application-panel buttons and legends. This is a presentation convention for app functions, not a claim that these exact controls existed on Apollo hardware.

Final nomenclature:
- RLY AUDIO — ON/OFF
- VIB — ON/OFF
- DSKY DISP — FULL/EXIT
- GUIDANCE — CLOCK/CMC/CMC LOAD/RLY TEST
- OPTICS — SXT
- SYS TEST — RUN
- AUX — DATA
- NIGHT DISP — DIM/BRIGHT/AUTO
- SW LOAD — CHECK plus existing talkback
- PROCEDURES — QUICK REF
- TECH DATA — SOURCE
- hidden panel-lighting operator: PANEL LTG — DIMMER

The v1.1.52 physical-state repair remains intact: logical aria-pressed state does not leave toggle buttons mechanically depressed; only the actual active press receives the depressed visual.

v1.1.53 / Android versionCode 2026092913. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Exact key source blobs: VERSION 36a0393faacda946f0e653c6104ade7ca58d07e6; app/build.gradle 88e9811a3ecf6b8eb2c687ef355165bc97786712; AndroidManifest.xml 127c15e270b941378a01b0a51d4c255c8acbb36c; index.html 3d74cb1e9733173dfc41e539769d24849d9a64e6; app-shell-runtime.js 35327dd677da3931e1444fcae878d67b9171969b; relay-audio-runtime.js 4996e9d97b1dcd8f7003d5e550f66f8116ffc8a6; display-environment.js 720e0a1df0c887626abee2f738388933a38d4d3f; display-layout-smoke.js 67f1a5d94e8945e904a2b659be26f8718b73816b; self-update-smoke.js f78cfae0b4e6a7e098f8d62a36008feae661ae03; app-shell-runtime-smoke.js 848e65b3eaccf5e0451367c279a483e1e7a0b685.

Regular and Fire were rebuilt locally from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone signer. Both packages are org.apollo.agcdsky v1.1.53/code 2026092913; 73/73 runtime assets with 0 missing/extra/mismatch; relay-panel.js, relay-panel.css, and relay-perceptual-personality.js absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 10ab903bb200f3f0a1d181692be71ce09b4b4f5d195746c5d833034333f8be9f.
Fire SHA-256 ad4c152a6ebfd2e73d89d2f51ef2ad46b4e06bdf4d1bb8811ce42593b888d7ef.

Physical nomenclature/fit acceptance remains pending owner device inspection.


## 2026-09-29 v1.1.52 momentary panel-button visuals

Owner reported HAPTICS stayed visually depressed while enabled and requested the same correction for RELAY CLICKS.

Root cause: controls-layout.css coupled logical toggle state to physical button travel with `button[aria-pressed="true"]` in the depressed-face selector. HAPTICS correctly uses aria-pressed to represent enabled state, so the panel face remained visually latched. The fix removes logical aria-pressed from the physical depression selector; panel buttons now use only `:active` for the depressed appearance. HAPTICS and RELAY CLICKS keep their logical ON/OFF state and accessibility semantics without looking mechanically held. RELAY CLICKS now explicitly projects its ON/OFF state to aria-pressed as well.

v1.1.52 / Android versionCode 2026092912. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference, audio-recovery. Exact changed source blobs: VERSION cf6931b078c9307190606ffba8eb48e07da31117; app/build.gradle 5f89c159eb0196132e0fa4f3753f39d037cbc16f; AndroidManifest.xml 783000d44979494de28b2cdeaaef0812d86bea4d; controls-layout.css 89455384bd5e64ce2f65490652828ee178602c25; display-layout-smoke.js f9bb50979fdd90ff6a73c11f1199aff8e3c3e007; relay-audio-runtime.js 69e2c3868be8248e5e24f61bd172f86c70925fac; audio-recovery-smoke.js 615fe317cd1a8a21f0d83bbfc1baece533b59227.

Regular and Fire rebuilt from exact exported source through aapt2 -> javac 17 -> classes.jar -> d8 -> zipalign -> apksigner with the established standalone release signer. Both org.apollo.agcdsky v1.1.52/code 2026092912; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 b642965b36ce2c25c29edb1ef189751915b7a75c5615a1373cff5d002e37dc5c.
Fire SHA-256 945a3b50c9a1e635466ea63b17e4a14cee8df87c9b2bcc2f3d75c4140063ce29.

Physical device gate: confirm HAPTICS and RELAY CLICKS return visually to their normal raised face immediately after release while their ON/OFF labels/state remain correct.


## 2026-09-29 v1.1.51 SOFTWARE beside DREAM + momentary flag

Owner requested moving the SOFTWARE talkback next to DREAM and keeping the flag present for as long as CHECK is physically pressed.

Final row 3 is fixed as AUXILIARY | DREAM | SOFTWARE. SOFTWARE is no longer inside the AUXILIARY submenu. REFERENCE and DOCUMENTS remain under AUXILIARY; when opened, that submenu spans the row in two columns.

CHECK is now a true momentary operator for the talkback flag. Pointer-down forces the SOFTWARE talkback to barber pole and captures the pointer. Pointer-up, pointer-cancel, or lost pointer capture releases the forced flag and restores the actual updater state. If the updater itself is still checking/downloading/ready-to-install, the talkback remains barber pole because that is the real state. Gray remains current/normal and red remains updater failure.

v1.1.51 / Android versionCode 2026092911. Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Exact changed source blobs: VERSION 3baec79077d35049d23cd22950bc118a880021ba; app/build.gradle c294ac93e29822cb1bce01d20651e2c68f15fee8; AndroidManifest.xml 5ab16d993047b5bc16b7c8afac63303186624f65; index.html 4387580891c150b8adab5593961ec2d346f349d6; controls-layout.css e378e0addb4e87c6b25110004c67a06178acb881; app-shell-runtime.js facba0c6a30d63d4dfd37c6e3e80c7537eb0c570; display-layout-smoke.js 594d93b9e280db7f05704598e3b71799ecdccf76; self-update-smoke.js dbb318c0da0d1a17aae91ebc88ef98ac668c3458.

Regular and Fire rebuilt from exact source via aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established standalone release signer. Both org.apollo.agcdsky v1.1.51/code 2026092911; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay-panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 539d148cdb8d95dbc502be1e0cbee82edc183fd7ebd34c8385dea051f4349b9f.
Fire SHA-256 e1dfec786c2b5f799de475117a11570fe6ec2aee7f92a503fb9ed2cb2c61a2e2.

Physical row placement and press-duration behavior remain pending owner device acceptance.


## 2026-09-29 v1.1.50 SOFTWARE updater talkback

Owner requested replacing the updater status text with an Apollo-style panel talkback. The TOOLS / INFO submenu remains one compact row. The SOFTWARE cell contains a rectangular talkback and a separate compact CHECK pushbutton; long updater status strings are no longer rendered into the button.

Talkback semantics are intentionally application-specific while following Apollo talkback visual language:
- gray = current / normal software state;
- barber pole = update process active or unresolved (CHECKING, DOWNLOADING, READY TO INSTALL, UPDATE CHECK BUSY);
- red = updater failure state;
- CHECK remains a short manual operator.

This is not a claim that Apollo barber pole universally meant "update pending"; the software mapping is an app-side convention.

v1.1.50 / Android versionCode 2026092910. Exact changed source blobs: VERSION da44c7f34804178c3004959361167ab1ce211579; app/build.gradle 0c094b484ba6b276b4f6ff19776c75bb712cc3f5; AndroidManifest.xml 972db36664b9bc62eaf4ad385aef6b78f3cb199d; index.html 4cbc6ef72e6f250c4fe3d6531fb347ad249f1c21; controls-layout.css 7d8416e6ac0851d7ab1c02fb2bba485372c231b9; app-shell-runtime.js a585d1903f723c54242204cb96e6d7851a49dd53; display-layout-smoke.js 2bff078fa1eb168e4e1f1871dc3d85dfb59ac028; self-update-smoke.js dbc1774b94de4834ddb6125e03d9a9626c0709ab.

Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Regular and Fire rebuilt from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone release signer. Both packages are org.apollo.agcdsky v1.1.50/code 2026092910; 73/73 runtime assets with 0 missing/extra/mismatch; rejected relay-panel/personality assets absent; zipalign PASS; APK Signature Scheme v2/v3 PASS; signer certificate MATCH.

Regular SHA-256 c3c474db0c207e669ef5820755a8b40f7fb9fa566758d45d1e037c7b53bdc9f9.
Fire SHA-256 00b702a3b2dac9474523c4f8b421fc4cd655e7a0c6cf7c9423a03f8be6b425bf.

Physical phone/Fire appearance remains pending owner device acceptance.


## 2026-09-29 v1.1.49 updater test + phone software-cell fit

Owner requested a fresh updater test from v1.1.48 and then reported the SOFTWARE/update status text was clipped on the phone. v1.1.49 / versionCode 2026092909 keeps the current Fire direct-installer path unchanged and widens only the TOOLS / INFO software cell. The submenu remains one row: CHEAT and LEGAL occupy one quarter each; SOFTWARE / CHECK FOR UPDATE spans the remaining half. No extra vertical row was added.

Exact changed source blobs: VERSION 8ac3ef6b26a02f52e23597a7f122911721c6b2ae; app/build.gradle dd12ace44e7909096a80bc557581ac37b7294a8e; AndroidManifest.xml 1911f4f2db764f9240069e6a78da96b9df7fde7f; controls-layout.css dacdeebc4f4e4be1c85c4741b71b2ddb893d1f21; display-layout-smoke.js 1d71837086b8748291234dbbed52f28dcf2f8281.

Source gates PASS: display-layout, self-update, app-shell-runtime, asset-reference. Regular and Fire rebuilt from source with aapt2 -> javac 17 -> d8 -> zipalign -> apksigner using the established standalone release signer. Both are org.apollo.agcdsky v1.1.49/code 2026092909, 73/73 runtime assets with 0 missing/extra/mismatch, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate MATCH. Regular SHA-256 ee033f2d40bf4bd4eecf25e5bc0e0a355239a0bacfddd462953cd9f45abd4f48. Fire SHA-256 485d5fba6a3d13560506f94e02ec0b95645aa171f3ff54239579c9e797388598.


## 2026-09-29 v1.1.42 updater test candidate

Owner requested AUXILIARY and DREAM share one row and explicitly chose this change as the end-to-end updater test. The compact fixed main panel now places AUXILIARY across columns 1-2 on row 3 and DREAM in column 3 on row 3. The TOOLS / INFO submenu remains one fixed row of three equal controls: CHEAT SHEET | LEGAL / SOURCE | CHECK FOR UPDATE. No flowing/reordering was introduced.

Version metadata is v1.1.42 / Android versionCode 2026092902. Source gates PASS: display-layout, self-update, app-shell-runtime, and asset-reference. Both Regular and Fire were rebuilt from source using aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established release key. Both packages are org.apollo.agcdsky v1.1.42/code 2026092902, target/compile SDK 37, 73/73 runtime assets with 0 missing/extra/byte mismatches, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate SHA-256 409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f MATCH. Regular SHA-256 7b3b8c06942054f6a5e3dd7813d9bd2b9d27eedf9d010d21e861d5ee1f8ce37f. Fire SHA-256 441d11cc06860f598b102656dcbae071d86e2d0a7f89b67b329a94b4d1a54222.

A dedicated .github/workflows/publish-release.yml was added. It triggers only on release-payload/** branches, verifies committed SHA-256 sidecars, and uses the repository GITHUB_TOKEN with contents:write to create/refresh the matching GitHub Release against main from the exact pre-signed APK bytes. This avoids CI re-signing and therefore preserves updater signer equality. The payload branch is release-only and is not merged into main. The intended device test is installed v1.1.41 -> manual CHECK FOR UPDATE -> v1.1.42 discovery/download/install.


## 2026-09-29 manual updater control candidate

After the v1.1.41 updater repair, device feedback showed there was still no visible manual update command. This candidate adds a fixed full-width SOFTWARE / CHECK FOR UPDATE control under TOOLS / INFO. The button invokes a native UpdateBridge forced check and displays asynchronous updater state directly on the control: CHECKING, UP TO DATE, DOWNLOADING, READY TO INSTALL, NETWORK ERROR, checksum/signature/package rejection, or other explicit failure state. The auxiliary submenu remains fixed-position in one compact row: CHEAT SHEET, LEGAL / SOURCE, and CHECK FOR UPDATE occupy three equal cells.

Source gates PASS: self-update smoke, display-layout smoke, app-shell runtime smoke, and asset-reference smoke. Exact branch runtime/source blobs used by the local build are AppUpdater.java 3b858b3ca12027582165ca7846c9ad5727f4c49c, SensorMainActivity.java 85c271acb71942ac2c3a3781edc7cf3986ef8ec8, index.html 9aefd532cacba17544647de4e1b2de764ddd5e70, app-shell-runtime.js 1dc54a7c2cdd75f78ec7f999d153902466db10fd, controls-layout.css 2e761d94a262e23038e30f39f5a2453556efa565, display-layout-smoke.js bd6cdeab6265f7d71c8344090ed7f924eb68f1b8, and self-update-smoke.js 15332bb24e9fd1bbb2f99affb384ac21072a2acc.

Regular and Fire release APKs were rebuilt from source via aapt2 -> javac 17 -> d8 -> zipalign -> apksigner. Both are org.apollo.agcdsky v1.1.41/code 2026092901, SDK 26/37, 73 expected / 73 packaged runtime assets, 0 missing, 0 extra, 0 byte mismatches, rejected relay panel/personality assets absent, zipalign PASS, APK Signature Scheme v2/v3 PASS, established signer certificate MATCH. Regular SHA-256 cff7b8dc485917e85fbb59d408512e6b263da2203d44ec0f80976c897ce9bd7f. Fire SHA-256 db62a6868ee2d2e6bc31b309177a93d322bc94fa461239fd1e4194a650472cd1. Physical Fire/Pixel acceptance is pending; do not merge until the manual control is observed and exercised on device. The overall options panel was also tightened after owner feedback: 32px nominal operators, smaller nomenclature band/padding/gaps, lower vertical reservation, and a compact three-button auxiliary row rather than a full-width updater row.


## 2026-09-29 v1.1.41 release candidate + updater repair

Release candidate v1.1.41 / Android versionCode 2026092901 consolidates the verified post-v1.1.40 mainline and repairs the native self-update handoff. The previous updater could initiate unknown-source/package-installer UI from the background startup provider. The repaired flow keeps release discovery, download, SHA-256 verification, package/version validation, and signer validation in the background, but stores a verified pending APK and hands permission/install UI to the foreground SensorMainActivity. Process startup now forces one release-discovery check instead of being suppressed by the persisted 12-hour success window. The normal periodic receiver remains throttled. If GitHub's releases/latest API fails, the updater falls back to main/VERSION plus deterministic release asset and .sha256 URLs, preserving the same integrity and signing checks. ACTION_SECURITY_SETTINGS is a fallback when per-app unknown-source settings are unavailable.

Focused self-update, branding, app-shell, display-layout, and asset-reference smokes PASS. Both Regular and Fire were rebuilt from source using aapt2 -> javac 17 -> d8 -> zipalign -> apksigner with the established standalone release key. Both packages are org.apollo.agcdsky v1.1.41/code 2026092901, target/compile SDK 37, zipalign PASS, APK Signature Scheme v2/v3 PASS, signer certificate SHA-256 409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f. Runtime asset audit: 73 expected / 73 packaged in each APK, 0 missing, 0 extra, 0 byte mismatches; relay-perceptual-personality.js and relay-panel.js/css absent. Regular APK: 460898 bytes, SHA-256 75ac8a796792872293e4d2b156293076b43112342e24b2dd11ad1ec7e16e3c6a. Fire APK: 464994 bytes, SHA-256 018dc1831e810dec4fd0785a8380377c4bf2df753a0e683c7f58cb8cf3c47ef6. Release assets prepared as app-regular-release.apk, app-fire-release.apk, and matching .sha256 sidecars.


## 2026-09-29 Fixed options panel + first-start instruction

The Apollo-style application options were revised after device feedback so the buttons no longer use a flowing/wrapping strip. The panel now has explicit fixed grid positions: AUDIO / TACTILE / DISPLAY on row one; COMPUTER / OPTICS / TEST on row two; AUXILIARY spanning row three. The TOOLS / INFO submenu is a fixed two-column grid. A one-time first-start instruction now reads `HOLD PANEL FOR OPTIONS`; the prior inline rule that forcibly hid the hint was removed, and the new `optionsHintV1` key makes existing installs see the instruction once after this update.

Source regression gates cover the fixed grid positions, fixed submenu, visible hint, one-time runtime key, Apollo nomenclature, and absence of the rejected relay panel/personality layer. Physical Pixel acceptance remains pending; PR #166 stays draft.



## 2026-09-29 Apollo-style application option panel

After physical Pixel acceptance closed RLY-01, the bottom application-options strip was restyled without changing relay or AGC behavior. The controls remain explicitly application-only, but now use an Apollo spacecraft panel vocabulary: gray metal panel field, a separate painted nomenclature band, recessed dark pushbutton face, and restrained white lettering. Each operator has a stable `data-panel-legend` nomenclature label while the existing button text/state and IDs remain unchanged, so sound, haptics, display, mode, optics, diagnostics, checklist, and legal/source behavior keep their existing event ownership. The TOOLS / INFO summary uses the same treatment.

The display-layout regression gate now requires the Apollo panel treatment and all visible nomenclature labels, and rejects restoration of the superseded DSKY-key styling. Relay-panel UI and synthetic relay personality/timing remain forbidden and untouched.

## 2026-09-27 RLY-02 source/provenance re-audit

The relay-fidelity audit now separately tracks **production design authority**, **mission/G&N-system configuration provenance**, and **individual DSKY chassis provenance**; all three are now established for the Apollo 11 LM relay hierarchy, while exact production relay mechanical timing remains unknown.

Verified/retained:

- Block II DSKY physical population remains 132 relay packages: 120 latching + 12 non-latching.
- Each D1-D6 relay-circuit assembly 2003910-021 contains 20 x 2004688-1/-2 and 2 x 2004689-2.
- Exact production 2004688/2004689 unit timing remains unrecovered; the app must not invent per-package travel, bounce, pole skew, or acoustic manufacturing fingerprints.
- The 3 ms / 5 ms values remain explicitly predecessor-SCD presentation bounds only.
- The complete production design-basis logical/function -> D1-D6/K1-K22 package crosswalk is now source-joined: 120/120 latching identities through 2005918 + 2005954A + 2005973, and 12/12 non-latching function drives through 2005954A + 2005973. 2003910 Rev E resolves the K22 switched-contact topology for the 2003910-021 / 2003952-031 configuration; exact production relay mechanical timing remains explicitly unresolved.

K22 provenance was tightened after checking the actual Virtual AGC schematic sources:

- original-drawing transcription `2005973-`: K22 pins 2/3/8 connect to J1-5/J1-3/J1-6;
- original-drawing transcription `2005940A`: K22 pins 2/3/8 are unconnected;
- K22 pins 1/4/5/6/7 agree, and K21 is not the differing relay;
- `2005973r` is explicitly a 2018 **reconstruction** from predecessor 2005952- plus ND-1021042 figure 4-226, not another surviving production drawing;
- immediate relay-circuit assembly 2003910-021 and the DSKY 2003994 system-manual table call out 2005973; parent assembly 2003952-031 calls out 2005940 and the manual figure preserves older 2005940-style K22 wiring;
- a NARA aperture-card scan of original drawing 2005973- survives and was the basis for the later direct transcription.

Current conclusion: **2003910 Rev E proves the 2005973 K22 topology for the 2003910-021 / 2003952-031 configuration, and that hierarchy is now tied to Apollo 11 LM's actual DSKY chassis.** Virtual AGC's NASA-perspective hierarchy identifies 6014999-091 as G&N system serial 609 (LM-5/Apollo 11), with DSKY 2003994-091 -> six 2003952-031 -> 2003910-021. MIT/IL reports E-1142-58, E-1142-59, and E-1142-61 provide the chassis chronology: LM-5/System 609 DSKY S/N 54 was 2003994-021, retained S/N 54 through the -051 modification, and is listed at KSC as 2003994-091 S/N 54 on 1 April 1969. Thus Apollo 11 LM DSKY **S/N 54** reaches the Rev-E-resolved relay assembly hierarchy. Exact production relay mechanical timing remains unknown.

This re-audit supersedes the 2026-09-25 relay-rack section's claims of measured-looking per-relay manufacturing profiles, contact bounce, pole skew, and unique package acoustic identity. Those were simulation inventions rather than recovered Apollo measurements and are being removed in PR #156.

Verification performed for this audit:

- [x] compared K22 pin connectivity in the `2005973-`, `2005940A`, and reconstructed `2005973r` Virtual AGC netlists;
- [x] checked provenance notes embedded in the original-drawing and reconstructed CAD files;
- [x] checked the production assembly hierarchy and DSKY system-manual drawing table;
- [x] updated relay evidence/inventory documentation to distinguish design basis from as-flown proof;
- [ ] recovered/read a production SCD for 2004688;
- [ ] recovered/read a production SCD for 2004689;
- [x] recovered and machine-gated the complete production design-basis D1-D6/Kx logical/function crosswalk (120 latching + 12 non-latching drive mappings);
- [x] recovered 2003910 Rev E assembly evidence resolving K22 switched-contact wiring for the 2003910-021 / 2003952-031 configuration;
- [x] established Apollo 11 LM mission/G&N-system provenance: 6014999-091 / serial 609 -> DSKY 2003994-091 -> 6 x 2003952-031 -> 2003910-021;
- [x] established Apollo 11 LM DSKY chassis provenance: MIT/IL E-1142-58/-59/-61 track DSKY S/N 54 from 2003994-021 -> -051 -> 2003994-091 for LM-5/System 609;
- [x] exact final PR #156 head 970828493f1998ca23b2f75180747071dce6d9dd passed Android 36352669981, PWA 36352669967, and Apple 36352669972; the accepted minimal 1 ms / amplitude 1 handset relay haptic was retained rather than retuned.


## 2026-09-25 production web register glyph-stability repair

The web/PWA renderer previously replaced an entire register SVG group whenever any sign/digit on that row changed. That caused unchanged digits—most visibly bottom-row zeros—to be destroyed and recreated when neighboring relay-driven elements changed.

The production repair keeps one persistent SVG slot per sign/digit position and updates only the slot whose rendered value changed. Cache keys include renderer implementation versions so deliberate renderer replacement still repaints correctly. Apollo 1006315G digit/sign geometry, spacing, relay mappings, contact timing, bounce, and sound coupling are unchanged.

Regression coverage includes `tools/dsky-render-stability-smoke.js`, the canonical source-smoke manifest, and the PWA deployment workflow. The regression proves unchanged register and upper-field zeros retain SVG node identity and receive no repaint when neighboring elements change.

The relay-rack UI remains removed on production `main`; this repair was reapplied cleanly on top of current production rather than merging the stale relay-panel feature branch and resurrecting that removed experiment.


## 2026-09-25 full 140-relay live rack / unified contact-event presentation

A new relay-rack view is mounted above the DSKY in the normal interactive layout. It has no decorative title/legend block and depicts every relay currently modeled by the app:

- 132 latching display relays: 12 selectable channel-010 banks x 11 relays (B + C-K1..K5 + D-K1..K5);
- 8 auxiliary relays: COMP ACTY, UPLINK ACTY, TEMP, KEY REL, OPR ERR, FLASH, RESTART, STBY;
- 140 modeled relays total.

The rack is not a separate animation. relay-visual-coupling.js is now the single presentation-event authority for relay contact motion. For each changed latching relay, one deterministic per-relay event path uses the existing manufacturing profile from relay-identity-audio.js to drive:

1. relay-rack armature/contact motion;
2. that exact relay's manufactured sound identity;
3. the DSKY EL/contact projection.

Set/reset travel, stable time, contact bounce, pole skew, and per-relay acoustic identity remain deterministic per installed relay. Authentic mode keeps the original 20-ms physical bank/latch boundary unchanged. Stretched mode remains presentation-only, but its armature arrival is frame-coupled so rack motion, sound, and DSKY contact change occur on the same presentation frame. Bounce timing is anchored to that actual shared impact event rather than the earlier command time.

The 20-ms latch commit in hardware-fidelity.js remains authoritative for settled hardware state. Raw channel 011/0163 backing state is recorded immediately for diagnostics, while modeled auxiliary relay contacts own the corresponding annunciator transition. PHONE CLOCK and real AGC channel-010 paths now use the same relay-contact presentation path rather than maintaining a separate visual/audio timing approximation.

Source/test work on branch feature/relay-panel-140:

- added relay-panel.js and relay-panel.css;
- added canonical relay-panel-smoke.js;
- strengthened relay-visual-coupling-smoke.js to prove the same manufactured contact event drives rack subscribers, sound, DSKY projection, and bounce;
- updated hardware/service/output/state ownership smokes for the new authority boundary;
- connector-backed syntax compilation passed for all changed JavaScript files;
- direct branch execution with mocked hardware verified a 5.0-ms relay produces rack/contact, sound, and DSKY projection at 5.0 ms and its modeled bounce at 5.5 ms;
- direct stretched-mode execution verified rack/contact, sound, and DSKY projection share the same stretched frame, with bounce scheduled from that frame;
- direct relay-panel execution verified 132 latching + 8 auxiliary = 140 live cells.

These are source-level checks. The canonical bash tools/build-local.sh, Gradle APK build/signature verification, and Android device smokes have not yet been executed for this feature and must not be marked verified until observed.


## 2026-09-18 SNTP / network-time repair

The reported clock-sync failure traced to a real platform split rather than the SNTP client itself:

- `SensorMainActivity` and `AgcDreamService` already started `NtpTime` and exposed `TimeBridge`;
- the regular/Fire `MainActivity` did neither, so its frontend could only retain the default zero offset and Android wall clock;
- PWA/web cannot use UDP SNTP from browser JavaScript, so it also had no external network-time correction path.

This repair:

- starts `NtpTime` and registers/removes the listener in `MainActivity`;
- exposes `TimeBridge.getStatus()` in `MainActivity` and pushes native SNTP status updates into the shared frontend;
- tears the bridge down with the WebView;
- preserves Cloudflare UDP SNTP as the authoritative Android correction source;
- adds a browser-only same-origin HTTP `Date` fallback using three no-cache HEAD samples, midpoint/RTT correction, a median offset, ten-minute resync throttling, and the same two-hour stale policy;
- labels browser fallback as NETWORK TIME rather than claiming browser UDP SNTP;
- expands `tools/ntp-policy-smoke.js` so MainActivity, SensorMainActivity, DreamService, and the browser fallback are all source-gated.

No system clock is set and `android.permission.SET_TIME` remains forbidden. WebView network loading remains blocked; Android SNTP stays native.

Verification status for this repair:

- [x] source changes committed on `fix/sntp-mainactivity-web-fallback`;
- [x] policy test source updated to catch the exact missing-MainActivity regression;
- [ ] canonical `bash tools/build-local.sh` has been run for this branch;
- [ ] regular/Fire APKs from this branch have been installed and clock-sync behavior verified on-device;
- [ ] deployed PWA HTTP-Date fallback has been checked in Brave/Chromium.

Do not upgrade the unchecked items without observed build/device/browser evidence.

## 2026-09-14 DSKY runtime refactor phase 30

`startup-defaults.js` had become a catch-all for four unrelated boot concerns: persistent run-mode defaulting, page-owned browser-resource teardown, chunked AGC snapshot transport, and camera console-error classification.

Phase 30 narrows that startup ownership without changing AGC/DSKY semantics:

- `startup-defaults.js` now owns only the first-run CLOCK persistence default;
- `page-resource-lifecycle.js` owns timer/interval/animation-frame tracking, WebAudio wrapper cleanup, media/core teardown, and `AGCLifecycle`;
- `agc-snapshot-codec.js` owns only the existing chunked `AgcCore` snapshot encoding/decoding path and preserves snapshot schema 1;
- `camera-error-policy.js` owns only SXT camera console classification, downgrading expected permission/lifecycle outcomes while preserving unexpected failures as errors;
- parser order is locked as `agc-core.js -> spacecraft-default.js -> startup-defaults.js -> page-resource-lifecycle.js -> agc-snapshot-codec.js -> camera-error-policy.js -> app-state-runtime.js`, so `AgcCore` exists before the codec patch, page-resource wrappers still install before application timers/audio work, and camera classification installs before `optics.js` can report camera failures;
- `tools/startup-runtime-smoke.js` source-gates those ownership boundaries and behaviorally checks first-run mode defaulting, tracked resource cleanup, AudioContext closed-state removal, snapshot round-trip behavior, and camera-error classification;
- `tools/audio-recovery-smoke.js` now reads `page-resource-lifecycle.js` directly for the closed-AudioContext lifecycle invariant instead of coupling that test to the old catch-all file;
- `tools/asset-reference-smoke.js` requires the new startup modules and their parser order;
- `tools/build-local.sh` includes the new startup runtime smoke in the canonical local gate.

No channel mapping, Pinball key code, held-PRO behavior, relay model, display rendering, yaAGC startup sequence, Comanche rope input, or persisted snapshot schema changed in this phase.

Observed in this execution environment against the phase-30 source staged from the committed branch:

- `startup-defaults.js`, `page-resource-lifecycle.js`, `agc-snapshot-codec.js`, `camera-error-policy.js`, and `tools/startup-runtime-smoke.js` all passed `node --check`;
- `node tools/startup-runtime-smoke.js` passed, including the snapshot memory round trip and page-resource/camera policy scenarios;
- GitHub compare reports phase 30 as two commits ahead of phase 29 with only the intended startup/runtime-gate files changed.

These are source-level checks only. The current execution environment still lacks the complete recursive checkout/Android SDK build path and its shell cannot resolve GitHub, so `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this phase. Do not upgrade those gates to verified from the source smoke.

## 2026-09-14 DSKY runtime refactor phase 1

A second audit caught an important detail the first pass missed: `index.html` does not list `flight-hardware-ui.js` or `keyboard-electrical-interlock.js` directly, but the statically loaded `cm-mode.js` installs both scripts dynamically from its window-load handler. They are therefore part of the active CM runtime. The earlier Phase-1 note that treated them as dormant was wrong and has been removed.

The effective input/transition ownership is now documented as follows:

- `keyboard-electrical-interlock.js` owns the 18 normal keycoded switches at **window capture** and preserves the series-key / KEYRST electrical model;
- `hardware-fidelity.js` owns the maintained PRO contact on channel `032`;
- `runtime-transitions.js` loads synchronously after `app.js` and the required `dream-silence.js` guard, then owns one shared CLOCK -> AGC in-flight Promise exposed through `AGCDSKY.runtimeTransitions` / `AGCDSKY_RUNTIME`;
- `runtime-transitions.js` replaces both the classic-script global `enterAgc` binding and `AGCDSKY.enterAgc` with the same serialized wrapper, so app startup, the AGC button, clock fallback input, and the electrical interlock all join the same transition;
- `clock-behavior.js` now owns only the document-level clock keypad fallback/queue and consumes the shared transition service;
- `app.js` remains the authoritative underlying AGC loader, channel decoder, display-state owner, and snapshot owner;
- once the electrical interlock is dynamically installed, physical normal-key events are stopped at window capture before the document-level clock fallback can see them.

The packaged synchronous script order for this slice is deliberately:

```text
app.js -> dream-silence.js -> runtime-transitions.js -> clock-behavior.js -> ... -> cm-mode.js
```

`dream-silence.js` remains immediately after `app.js` because the existing asset gate requires that safety guard before any later frontend layer. `runtime-transitions.js` still runs in the same script turn, before app startup timers or user input can execute.

Phase 1 removes duplicate AGC-loading coordination while preserving the existing CM-only behavior:

- the shared service serializes AGC entry through one Promise and returns that same Promise to later callers while the load is in flight;
- the already-installed app startup/AGC-button closures resolve the replaced classic-script global `enterAgc` binding at call time, so they enter through the same service without rewriting the underlying `app.js` loader;
- the previous 10 ms readiness polling fallback has been removed; an `agc-loading` state without the shared Promise is now treated as an invariant violation instead of being hidden by another polling loop;
- `keyboard-electrical-interlock.js` awaits `runtimeTransitions.requestAgc('keyboard electrical contact')` and only then asserts the original Pinball keycode on channel `015`;
- a fast touchscreen release during loading still preserves the physical cycle until the make is delivered and the minimum KEYRST dwell completes;
- queued document-level fallback contacts remain ordered and are forwarded after AGC readiness;
- direct AGC-button/startup entry preserves `app.js` failure compatibility: if the loader catches an error and falls back to clock, the app-entry Promise resolves with that final state, while keyboard/fallback callers get a derived rejection because they require a ready AGC before injecting a key;
- transition diagnostics return copied state rather than mutable production structures;
- synthetic CLOCK-mode COMP ACTY remains forbidden;
- AGC/WASM startup ordering, channel mappings, relay state, PRO semantics, snapshot format, and display rendering are unchanged by this phase.

Regression coverage was tightened in four places:

- `tools/clock-mode-behavior-smoke.js` covers ordinary fallback promotion, ordered fallback contacts during one load, a direct app/startup-style `enterAgc` call followed by a keypad join with no polling or second loader start, and app-load failure compatibility;
- `tools/keyboard-electrical-interlock-smoke.js` treats the shared transition API as the handoff contract while retaining the series-chain, PRO-bypass, fast-tap, and KEYRST checks;
- `tools/runtime-transition-integration-smoke.js` checks script order, installs the extracted transition service plus clock fallback and electrical interlock together, propagates pointer events from window to document unless actually stopped, and requires a physical VERB fast-tap during a direct app AGC load to join one transition, generate one Pinball `021` make, avoid the clock fallback/legacy editor, avoid readiness polling, and end with one KEYRST;
- `tools/asset-reference-smoke.js` now requires `runtime-transitions.js` to be packaged and locks the exact `app.js -> dream-silence.js -> runtime-transitions.js` ordering.

The transition smokes are wired into `tools/build-local.sh`. The clock behavior smoke existed previously but was not part of the canonical build gate; Phase 1 added it, and the new integration smoke is adjacent to the electrical-interlock gate.

Observed in this execution environment against source fetched from the current refactor branch:

- current `runtime-transitions.js`, `clock-behavior.js`, and `keyboard-electrical-interlock.js` passed `node --check` in a reconstructed minimal source tree;
- current transition/clock production source passed scenarios for ordinary first-key handoff, ordered fallback queuing, direct app-load joining with no second loader/poll loop, and app-load failure compatibility;
- current electrical production source passed the physical fast-tap handoff scenario: window-capture ownership, no document fallback participation, no 10 ms readiness polling, one Pinball `021` make, one KEYRST, and no latched channel-015 cycle;
- the execution container still cannot resolve `github.com`, so a complete recursive checkout and the repository's exact full smoke scripts cannot be executed directly in that container.

These are source-level checks against the current fetched production files, not a canonical full-repository build. `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this branch in this environment. The Android SDK/recursive-checkout limitations below still apply. No device/runtime claim is upgraded from these source checks.

## 2026-09-13 WebAudio renderer recovery

A regular-phone prototype report from Android 17 / Chromium WebView 151 showed Chromium's native WebAudio renderer diagnostic:

```text
The AudioContext encountered an error from the audio device or the WebAudio renderer.
```

The failure was in the relay-audio lifecycle, not AGC/DSKY channel logic. The prior frontend kept one global `AudioContext`, retried `resume()` without handling failure, never replaced a context that had reached `closed`, and allowed the raw Chromium console error to be promoted into the next-launch prototype crash/error report.

The late `background-audio-guard.js` layer now owns bounded WebAudio recovery after all relay-audio refinements are loaded:

- every relay `AudioContext` is observed for Chromium's `error` event;
- a renderer/device failure retires and closes the failed context and clears the global reference;
- the next audible relay event may create one fresh context;
- if that replacement also fails before eight seconds of stable running audio, a circuit breaker stops automatic retries rather than creating an endless fail/recreate loop;
- the RELAY CLICKS control displays `ERROR · OFF/ON TO RETRY`, and an explicit off/on cycle resets the breaker;
- an already-`closed` context is replaced without counting that normal state as a renderer failure;
- a non-policy `resume()` rejection retires the context instead of being silently swallowed;
- `NotAllowedError` remains a user-gesture/autoplay-policy condition and does not destroy a context that may resume on a later gesture;
- Dream mode and hidden-app state still refuse to create/resume relay audio;
- stale-context relay emissions are rejected after a context has been retired.

`DebugReporter` now ignores only Chromium's exact recoverable renderer-console sentence. If bounded recovery itself fails twice, the frontend reports a distinct `WebAudio recovery failed...` detail through the local `DebugBridge`, so a genuine unrecovered audio failure still produces diagnostic evidence.

A related lifecycle bug was also fixed: `startup-defaults.js` previously retained closed `AudioContext` wrappers in its page-owned `audioContexts` set until full page teardown. Recovered/replaced contexts are now removed on the `closed` state transition, preventing dead-wrapper accumulation and keeping `AGCLifecycle.counts().audioContexts` meaningful.

`tools/audio-recovery-smoke.js` now covers renderer-error replacement, repeated-failure circuit breaking, manual retry, closed-context replacement, resume rejection, `NotAllowedError`, Dream/hidden silence, lifecycle tracking cleanup, and raw Chromium-report filtering. It is part of the canonical `tools/build-local.sh` source gate.

Observed in this execution environment:

- the edited `background-audio-guard.js` passed `node --check`;
- the new audio-recovery smoke passed against the staged edited sources;
- the edited `tools/build-local.sh` passed `bash -n`.

These are source-level checks only. The current execution environment still cannot resolve GitHub from the shell and does not provide the complete Android SDK/Gradle recursive checkout, so the canonical Android build, APK verification, and Pixel/Fire device smokes have **not** been run for this revision. The shortest acceptance step remains `bash tools/build-local.sh`, followed by the regular-phone device smoke on the Pixel-class Android 17 target.

## Current scope

The current Android app is the **CM / Comanche 055** configuration. It has two deliberately separate modes:

1. a synthetic phone-clock / DreamService presentation; and
2. a real AGC mode driven by the pinned `yaAGC` WebAssembly core and Apollo 11 Command Module `Comanche055.bin`.

The current Gradle package inputs are only:

- `vendor/webAGC/src/yaAGC.wasm` — 132,617 bytes — Git blob `713685680492098d05437b99c26403f683d56009`;
- `vendor/webAGC/demo/agc/Comanche055.bin` — 73,728 bytes — Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`.

The pinned `vendor/webAGC` gitlink remains:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Normal DSKY keys use channel `015` with the Pinball codes. PRO remains a level-sensitive input on channel `032` bit `020000` and is not converted into an ordinary key event.

## 2026-09-12 phone CLOCK -> AGC input regression

The interactive phone Activity had regressed so normal DSKY commands entered while the display was in CLOCK mode no longer promoted the app into real AGC mode. The cause was the newer Block II series-key electrical interlock: it owns normal keys at **window capture** and stops propagation, while the older clock-handoff helper was listening later at **document capture**. The first physical key therefore never reached the handoff helper and fell through to the obsolete synthetic clock command-entry path instead.

The electrical interlock still owns the physical transition point, but transition serialization is now shared. For a normal key made in CLOCK mode it:

- requests the shared `AGCDSKY.runtimeTransitions.requestAgc()` transition;
- joins an already-running AGC load rather than starting another one;
- forwards that same physical keycode to channel `015` once the Comanche core is ready;
- retains the existing minimum electrical dwell and separate `keyRelease()` / KEYRST path if the touchscreen key was released while the core was loading;
- keeps PRO separate on channel `032` exactly as before;
- does not invoke the old synthetic clock command editor for the handoff key.

`tools/keyboard-electrical-interlock-smoke.js` remains the isolated electrical regression gate. `tools/runtime-transition-integration-smoke.js` is the corresponding multi-layer gate for the shared transition service, clock fallback, and physical electrical owner.

The source gates are committed. They are **not** substitutes for the current canonical local build and Android device smoke.

## 2026-09-11 original-drawing correction pass

The DSKY display source-of-truth policy was tightened. Original MIT Instrumentation Laboratory / NASA Apollo engineering drawings are now the dimensional/specification authority. In particular:

- SCD `1006315`, **INDICATOR, DIGITAL, ELECTROLUMINESCENT, SPECIFICATION CONTROL DRAWING**, is the primary source for the EL indicator;
- the `2003994-121` assembly chain establishes the DSKY/EL installation context, including the `2003988` EL-and-cover assembly;
- VirtualAGC electrical material and preserved schematics are used to cross-check relay/channel behavior;
- Ben Krasnow's `DSKY_EL_replica` SVG remains only a vector-outline transcription source for numeric segment contours that have not yet been re-entered directly from the original drawing.

### EL appearance

Current source now uses:

- gray EL glass with visible gray border/contact hardware;
- nine visible contact/ITO dots already present in the source artwork mapping;
- no synthetic neon-style spatial glow;
- black `PROG`, `VERB`, `NOUN`, and `COMP ACTY` lettering over EL phosphor sections;
- corrected visible clearance between the right-hand digit fields and the glass border;
- source-backed register separator geometry;
- production nominal **5300-angstrom / 530-nm** EL color rather than the cooler appearance of an early surviving panel.

The WebView (`--el:#79ef4f`), native widget (`Color.rgb(121,239,79)`), and generated API-31+ widget register frames (`#79EF4F`) are locked together by `tools/el-widget-smoke.js`.

The native Android home-screen widget carries the same gray glass, border/dots, black-on-EL legends, no-glow treatment, right-side field clearance, and production EL color.

### Keyboard placement

The numeric/center key rows retain their measured pitch. The four outer function keys are intentionally staggered rather than forced onto the numeric-row baselines:

- VERB and ENTR are on the intermediate upper row;
- NOUN and RSET are on the intermediate lower row.

This fixes the earlier convenience 7-column grid behavior without moving the numeric keypad.

### Sextant controls

The sextant and star-selection buttons now use the same Series-2-style option-button construction as the main app controls. This is CSS-only and does not alter optics/AGC behavior.

## CM annunciator panel

The current face is intentionally the CM layout. VirtualAGC `yaDSKY2/CM.ini` defines the two columns of seven as:

```text
11 UPLINK ACTY     21 TEMP
12 NO ATT          22 GIMBAL LOCK
13 STBY            23 PROG
14 KEY REL         24 RESTART
15 OPR ERR         25 TRACKER
16 BLANK           26 BLANK
17 BLANK           27 BLANK
```

Therefore the four lower blank positions are not missing LM `ALT` / `VEL` lamps in this CM build. Do not add LM-only annunciators to the Comanche face.

## Channel-010 physical relay model

The display is modeled as **12 selectable banks of 11 bistable relays**. Channel `010` uses the upper selector field to choose a bank; the low 11 bits are the physical bank state:

```text
B + C1..C5 + D1..D5
```

The selector field is not treated as four extra display relays.

The bank mapping remains:

- 11 → PROG pair;
- 10 → VERB pair;
- 9 → NOUN pair;
- 8 → visible R1D1 from D/right bank (C is physically present but visually unused);
- 7/6 → R1 sign/digits;
- 5/4 → R2 sign/digits;
- 3 → R2D5 + R3D1;
- 2/1 → R3 sign/digits;
- 12 → condition-light relay row.

### Individual relay behavior

`hardware-fidelity.js` keeps a separate low-11 latched state for each bank. A write computes the exact Hamming difference between the old and new 11-bit states; each changed bit is one physical bistable relay operation.

The electrical command is parallel. The simulator therefore does **not** model the eleven relays as being driven serially. It allows the documented 20 ms relay settling interval, emits separate armature/contact transients for relays that actually change state, and exposes the final optical state at the settle boundary rather than inventing an undocumented sub-20-ms visible contact order.

`relay-audio-refine.js` likewise emits one dry mechanical transient per changed bistable relay instead of collapsing a whole bank transition into one generic click.

The current sub-20-ms acoustic scatter is an approximation inside the documented settle budget; it is **not** represented as measured flight-relay pull-in timing.

## K1-K5 character contact matrix

The five character relays are no longer treated as a simple enum of blank plus digits 0-9.

`dsky-relay-matrix.js` implements the actual K1-K5 contact logic traced from the DSKY schematics by VirtualAGC `Tools/traceDSKY.py`. This means all 32 possible five-relay states have their physical EL-segment result.

The normal software codes remain exactly:

- blank `000`
- 0 `025`
- 1 `003`
- 2 `031`
- 3 `033`
- 4 `017`
- 5 `036`
- 6 `034`
- 7 `023`
- 8 `035`
- 9 `037`

The other 21 electrical states are now rendered through the contact matrix rather than incorrectly disappearing as blank.

The visually unused C five-relay field of selector 8 remains physically modeled. If Comanche drives it, its relay operations still exist even though no EL digit is connected to it.

## Other DSKY discretes

Current real-AGC mapping remains source-driven:

- channel `011` bit `00002` → COMP ACTY;
- channel `011` bit `00004` → UPLINK ACTY;
- yaAGC channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off hardware state;
- condition-light row 12 is decoded from channel `010`.

For Comanche 055 V35, the source-backed relay-12 low-11 state remains `00650`.

## Build and verification gates

Canonical local build:

```bash
bash tools/build-local.sh
```

The current build contract requires:

- JDK 17+;
- Node.js 18+;
- Android SDK compileSdk 37;
- Android Build Tools **36.0.0 exactly**;
- stable Gradle 9.5+ (the repository can bootstrap checksum-verified Gradle 9.5.1 when network access is available);
- the exact clean pinned `vendor/webAGC` checkout.

The build runs source/policy tests, DSKY mapping/relay gates, EL-widget checks, real pinned yaAGC/Comanche host semantics, clean regular + Fire Gradle builds, and post-build APK verification.

Expected debug outputs:

```text
app/build/outputs/apk/regular/debug/app-regular-debug.apk
app/build/outputs/apk/fire/debug/app-fire-debug.apk
```

Debug package ID remains install-safe alongside the release app through the `.eltest` application-ID suffix.

## Current host verification and build blocker

The 2026-09-11 correction pass was exercised as far as the current container permits. Observed host results:

- changed relay JavaScript syntax checks passed;
- schematic K1-K5 validation produced **28 distinct physical EL segment patterns** across the 32 relay codes and reproduced every normal blank/0-9 code;
- the CM annunciator order and four blank positions were checked;
- the widget-frame generator produced all **60** register frames using the production `#79EF4F` EL color;
- the exact pinned `yaAGC.wasm` + `Comanche055.bin` executed under Node: `V16N65E` produced numeric output, `V37E00E` reached PROG `00` / relay-11 low-11 `01265`, and real `V35E` reached Comanche relay-12 low-11 `00650`.

These are host/source checks, not an Android build or device test.

The canonical Android build was then attempted/preflighted in the current execution environment. The blockers are concrete:

- Java 21 and Node 22 are available;
- no Gradle installation is available;
- `ANDROID_SDK_ROOT` / `ANDROID_HOME` are absent;
- Android Build Tools 36.0.0 (`aapt2`, `apksigner`) and platform 37 are absent;
- there is no complete current recursive checkout in the build container;
- shell network/DNS cannot resolve GitHub, so the Gradle bootstrap, repository clone/submodule initialization, and Android SDK package download cannot be completed here.

Shortest next experiment: run `bash tools/build-local.sh` on a machine/container with the required Android SDK and exact recursive checkout. The repository still contains an older hosted workflow, but project policy explicitly forbids using GitHub-hosted builds unless the owner separately authorizes that exception; it is therefore not being treated as the build path for this revision.

## Verification status

Historical v1.1.2 regular/Fire source checkpoints have previously completed the canonical local build and Fire-device HOME verification. Those results do **not** automatically apply to the 2026-09-11 drawing/relay revision.

For the current drawing/relay revision plus the CLOCK→AGC transition refactor and WebAudio recovery:

- [x] source changes are committed on the current repair/refactor branch;
- [x] K1-K5 contact matrix is source-gated by `tools/dsky-mapping-smoke.js`;
- [x] individual low-11 relay-change accounting is source-gated;
- [x] WebView/native/generated-widget production EL color agreement is source-gated;
- [x] CLOCK→AGC first-key behavior is encoded in the keyboard-interlock regression gate;
- [x] shared transition + electrical ownership is encoded in `tools/runtime-transition-integration-smoke.js`;
- [x] both transition smokes are wired into the canonical local build gate;
- [x] WebAudio renderer recovery is encoded in `tools/audio-recovery-smoke.js` and wired into the canonical local build gate;
- [x] the staged audio-recovery source smoke passed in this execution environment;
- [x] current host/source and real-Comanche WASM checks above passed for the earlier 2026-09-11 drawing/relay state;
- [ ] the complete current transition smoke set has been executed from a full checkout at the exact branch HEAD;
- [ ] canonical `tools/build-local.sh` has been run successfully for this exact revision;
- [ ] current regular APK has been installed/device-smoked;
- [ ] current Fire APK has been installed/device-smoked;
- [ ] current native EL widget has been visually checked on-device;
- [ ] current physical-screen DSKY geometry has been visually accepted by the owner.

Do not upgrade any unchecked item to verified without actual output from that exact source revision.

## Remaining high-value fidelity work

1. Continue transcribing absolute EL/key geometry from original MIT/NASA drawings where current values still depend on replica vector artwork.
2. Keep CM and LM annunciator configurations distinct; this branch is CM/Comanche-only.
3. Audit the remaining non-latching auxiliary-relay acoustic model against the available indicator-driver schematics; do not invent per-relay measured timings that the surviving documentation does not provide.
4. Run the canonical local build and current-source device gates as soon as the required Android toolchain and recursive checkout are available.

## Build policy

Builds remain local/manual. Do not add or use GitHub Actions, Codespaces, or another hosted build service for this project unless the owner explicitly changes that policy. Never substitute APK surgery/repacking for a real Gradle build.

## 2026-09-18 checklist / EL cross-platform parity

Current branch now carries the same checklist and EL presentation intent across Android, Apple, and PWA/web:

- unenergized EL digit/sign segments render as opaque neutral gray `#737373`, slightly lighter than the EL glass, instead of low-opacity green phosphor;
- energized EL remains the source-backed `#79EF4F` phosphor approximation;
- the in-app checklist header has a PRINT action;
- the shared print stylesheet expands every checklist section and requests 5.5 × 8 inch pages;
- Android installs a `PrintBridge` JavaScript interface and uses `PrintManager` with a 5500 × 8000 mil custom media size;
- Apple installs a WKScriptMessageHandler named `PrintBridge`; iOS/iPadOS prints through `UIPrintInteractionController` and macOS through `NSPrintOperation`, both using the same 5.5 × 8 inch geometry;
- PWA/web keeps the shared PRINT button and falls back to `window.print()`; the PWA build copies the shared assets byte-for-byte and its smoke test now checks the print markers, Apollo page size, and neutral-gray unlit EL rule;
- `tools/cheatsheet-smoke.js` now guards Android + Apple bridge installation/teardown, 5.5 × 8 inch media geometry, print-all-sections CSS, and neutral unlit EL color.

Verification performed in this environment:

- [x] changed shared JavaScript parses successfully;
- [x] changed shared CSS has balanced structure;
- [x] updated PWA smoke JavaScript parses successfully;
- [x] Apple source contains the expected native print bridge and 5.5 × 8 inch media geometry;
- [ ] Apple source has been compiled with Xcode at this exact revision;
- [ ] PWA `build-site.sh` has been executed at this exact revision;
- [ ] Android canonical Gradle build has completed at this exact revision;
- [ ] Android native print flow has been exercised on-device;
- [ ] iPhone/iPad/macOS native print flow has been exercised on-device.

The File Store contains Android SDK/build-tools/signing material used for test-package work, but there is still no complete current recursive checkout plus offline Android Gradle Plugin 9.3.0 cache in the execution container. Do not call this a canonical source build until `bash tools/build-local.sh` succeeds from the exact branch HEAD.
