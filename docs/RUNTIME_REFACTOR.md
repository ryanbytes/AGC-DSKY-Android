# DSKY runtime refactor status

Updated: 2026-09-17
Status: **open-ended runtime refactor complete at Phase 83**

This document is the cutoff record for the DSKY runtime refactor. Detailed service ownership is documented in `CORE_SERVICE_GRAPH.md`; phase-by-phase history remains in `PROGRESS.md` and the individual phase notes.

## Cutoff decision

Phase 83 is the end of the open-ended cleanup/refactor series.

Do **not** start Phase 84 or another broad architecture-cleanup pass merely to reduce indirection, rename services, move ownership boundaries, or make the graph look cleaner. A future refactor is justified only when all of the following are true:

1. there is a concrete user-visible bug, demonstrated runtime failure mode, or specific ownership violation;
2. the exact failure can be reproduced or statically demonstrated;
3. the proposed change is the smallest reasonable change that addresses that failure;
4. an acceptance/regression test is added or identified before the change is considered complete;
5. APK/build verification is performed when the changed surface can affect packaged Android behavior.

If a proposed refactor cannot identify the failure it fixes and the acceptance test that proves the fix, treat it as churn and do not do it.

## Current architecture boundary

The runtime is no longer organized around one application script owning unrelated behavior. Production state and behavior are separated behind explicit owners for:

- application/core state;
- shell/configuration/time;
- renderer state;
- relay audio;
- PHONE CLOCK state;
- AGC display/channel state;
- snapshots/autosave;
- lifecycle and CLOCK/AGC transitions;
- DSKY normal-key electrical input;
- maintained PRO input;
- Block II hardware timing/latches;
- late presentation, diagnostics, optics and parallax services.

`AGCDSKY_COMPAT` remains an audited compatibility adapter rather than a second mutable authority. The root `AGCDSKY` object remains a stable public facade; production runtime modules are not supposed to use it as their internal source of truth.

The canonical service/dependency graph and detailed ownership rules are in `docs/CORE_SERVICE_GRAPH.md`.

## Phase 82 / 83 closeout

Phase 82 removed remaining runtime/input dependence on the public `AGCDSKY` facade by routing transition and DSKY input authority directly through the owning lifecycle/core-session/service-registry layers.

Phase 83 completed the same ownership correction for the CLOCK fallback path:

- `clock-behavior.js` consumes the runtime, input and snapshot owners directly;
- the CLOCK fallback queue no longer uses the public facade as internal authority;
- cancellation semantics remain epoch-protected so stale contacts cannot reappear after CLOCK wins;
- physical keyboard capture still remains the normal live CM input owner;
- RSET remains a physical Pinball `022` make followed by KEYRST, with no synthetic JavaScript reset path.

A stale Phase-83 RSET smoke fixture initially expected the older CLOCK publication spelling. That fixture was corrected without changing production runtime behavior. The corrected fixture also requires direct snapshot ownership so the test cannot accidentally pass through the public facade.

## Verified CI checkpoint

Verified production/test head before merge:

```text
fa0c9d2da745ba5eb7b3e59c9965db5d548a547c
```

GitHub Actions run:

```text
35240669652
```

The run completed successfully and passed:

- canonical source smoke tests;
- release, EL-test and unique install-fix APK builds;
- APK output existence checks;
- signing of installable regular and Fire APKs;
- side-by-side signature/package/icon/restored-asset verification;
- artifact uploads.

That verified Phase-83 head was then fast-forwarded to `main` without a force push.

## Regression gates that define the boundary

The canonical suite now guards the architecture rather than relying on convention alone. Important gates include:

- `compat-boundary-smoke.js`;
- `public-facade-boundary-smoke.js`;
- `root-facade-creation-smoke.js`;
- `late-public-facade-mutation-smoke.js`;
- `late-service-publication-smoke.js`;
- `core-service-graph-smoke.js`;
- `late-service-boundary-smoke.js`;
- `late-state-ownership-smoke.js`;
- `runtime-authority-smoke.js`;
- `runtime-clock-transition-smoke.js`;
- `runtime-transition-integration-smoke.js`;
- `dsky-input-runtime-smoke.js`;
- `clock-mode-behavior-smoke.js`;
- `clock-fallback-cancel-smoke.js`;
- `keyboard-electrical-interlock-smoke.js`;
- `keyboard-clock-cancel-smoke.js`;
- `proceed-electrical-smoke.js`;
- `rset-flightpath-smoke.js`;
- `dsky-keycode-consistency-smoke.js`;
- `asset-reference-smoke.js`.

These tests are the reason future architecture work should be demand-driven: they already prevent the known spaghetti failure modes from silently returning.

## What is still allowed

The end of open-ended refactoring does **not** mean the application is frozen. Continue work when there is a concrete reason, including:

- a reproducible user-visible bug;
- a device-specific failure;
- incorrect Apollo/Block-II behavior;
- a measurable performance/reliability problem;
- a regression exposed by an existing gate;
- a new feature that cannot be implemented cleanly through an existing owner;
- a demonstrated ownership violation caught in review or testing.

In those cases, change the smallest relevant boundary and add/adjust the corresponding regression gate.

## Outstanding acceptance

The Phase-83 source and Android CI build/signing/package gates are verified.

**Physical-device verification remains outstanding for this exact Phase-83 revision.** Do not describe Pixel/regular-phone or Fire-tablet behavior as device-verified until the APK from this source revision is actually installed and exercised on the intended hardware.

At minimum, the device smoke should cover:

- launch/startup behavior;
- CLOCK -> AGC first-key handoff;
- normal DSKY key make/release and RSET;
- maintained PRO behavior;
- return to CLOCK during/after AGC activity;
- parallax/IMU path on the regular phone;
- Fire HOME/startup behavior on the Fire build;
- relay audio/display behavior sufficiently to catch WebView/device-only regressions.

Until those device checks are run, the correct status is: **refactor complete; source/build verified; physical-device acceptance pending.**
