# Mishkat 1.1 (6) — Release preparation

Date: 2026-09-10

## Scope

- Existing application: `com.dakomn.mishkatapp`.
- Existing widget extension: `com.dakomn.mishkatapp.MishkatWidget`.
- Marketing version remains 1.1; application and widget build numbers advance together from 5 to 6.
- Quran reader, search, bookmarks, contextual recitation controls, khatma flow, shared visual system, permission/location lifecycle fixes, and widget contrast improvements.
- No bundle identifier, Firebase project, signing team, religious source asset, or prayer-calculation change in this release-preparation step.
- Distribution requested: GitHub and TestFlight. No App Store production submission or automatic public release.

## Preflight

- `prayer-regression.js`, `product-regression.js`, `mushaf-integrity.js`: passed.
- `quran-ux-regression.js`, `khatma-ux-regression.js`: passed using isolated browser profiles.
- `ux-regression.js` and `redesign-regression.js`: passed for the release, including contrast, permission lifecycle, responsive layouts and animated zoom anchoring.
- Previous offline verification stored all 604 pages, resumed a missing page, and opened the reader after an offline relaunch.
- Existing distribution identity and App Store Connect app verified locally and through the API.
- Private keys, profiles, archives, and local environment files excluded from Git; runtime packaging additionally uses an allowlist.
- CI approval is not claimed: these are locally executed tests.

## Archive verification

- Xcode Release archive succeeded. Main application and widget present; both version 1.1, build 6.
- Valid code signatures and application-group entitlements in the exported IPA.
- Main app has production APNs entitlement and matching Firebase bundle configuration.
- All 604 SVG pages present and SHA-256 hashes match their source assets. Current Quran/khatma JavaScript, HTML, CSS and service-worker bytes match the archive.
- Runtime allowlist verified: no test artifacts, source-control directory, environment files, or signing keys in `www`.
- Apple upload validation succeeds before transmission; processing state checked after upload.

## Known verification limits

Physical-device recitation, full VoiceOver and Dynamic Type, and Android were not verified. The keyboard-number entry flow was verified in the browser, not fully in the iOS Simulator. Native touch controls were checked and the WebKit focus regression was fixed and retested.

## Rollback and distribution safety

Build 1.1 (5) remains in TestFlight and must not be expired as part of this release. Existing user data keys and schemas are preserved. If reading, launch, notifications, or widgets regress, stop distribution of build 6 and return testers to the previous build; issue a corrected build with a new number. Do not force-push or rewrite the Git history to roll back; use a normal revert commit after authorization. Stop before App Store production submission unless separately requested.

No unattended production monitoring or physical-device stability claim is made.
