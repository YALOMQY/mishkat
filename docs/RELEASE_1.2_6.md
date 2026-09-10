# Mishkat 1.2 (6) — Release preparation

Date: 2026-09-10

## Current TestFlight status — verified 04:47 Asia/Aden

- Upload processing: `COMPLETE`, no errors or warnings. Build 1.2 (6): `VALID`.
- Build ID: `2937797d-d180-4dd0-b710-32ac75df58b8`; prerelease version 1.2 verified.
- Internal testing: `IN_BETA_TESTING`. Build 6 is present in the existing internal `test` group (`d5b8582a-17e2-42d9-b287-96557498aaea`). The group picked it up automatically; the attempted manual API association was rejected, so no internal-group settings were changed.
- External testing: associated build 6 with the existing external `test` group (`6bbbb303-9d2a-4a4d-a65a-46c73e429093`), preserving builds 5 and 3 and all existing public-link settings.
- TestFlight beta review submitted at 04:45:15 Asia/Aden. Readback: `WAITING_FOR_REVIEW` / `WAITING_FOR_BETA_REVIEW`. External availability is not yet approved; do not present the public link as installing build 6 until approval.
- Arabic (`ar-SA`) test notes updated and read back successfully; localization ID `8231c668-4dd7-44d1-8cdc-ac5db514491f`.
- Safari App Store Connect readback also shows upload 1.2 (6) as `Complete`, both existing groups attached, and the external-review status `Waiting for Review`. No additional UI configuration change was necessary.
- No additional binary upload, credential change, tester creation, App Store production submission, or expiration of an old build was performed during this follow-up.
- Used deployment-checklist and structured-debugging skills to distinguish successful file delivery from Apple processing and actual tester availability.

## Scope

- Existing application: `com.dakomn.mishkatapp`.
- Existing widget extension: `com.dakomn.mishkatapp.MishkatWidget`.
- Marketing version advances to 1.2; application and widget build numbers advance together from 5 to 6. Apple validation rejected the initial 1.1 (6) candidate because the approved 1.1 release train is closed (90062 / 90186); no upload was attempted for that candidate.
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

- Final 1.2 (6) Xcode Release archive and IPA export succeeded; both the application and widget versions were verified.
- Exported application and widget signatures passed `codesign --verify --deep --strict` with access to the existing system trust store. Their existing shared Keychain group is `Z6WLFR3247.com.dakomn.mishkatapp.shared`, not an App Group; that architecture is unchanged.
- Production APNs, matching Firebase bundle configuration, disabled debugging entitlement and non-exempt encryption declaration were verified in the exported IPA.
- All 604 SVG pages in the final archive matched source SHA-256 hashes; current Quran/khatma JavaScript, HTML, CSS and service-worker bytes also matched.
- Runtime allowlist verified on the final archive: no test artifacts, source-control directory, environment files, or signing keys in `www`.
- Apple validation passed with no errors on 2026-09-10. Upload then succeeded with no errors at 04:25:49 Asia/Aden; delivery UUID `2937797d-d180-4dd0-b710-32ac75df58b8`.
- At 04:31 Asia/Aden the new build was not yet returned by the App Store Connect builds API (checked both filtered and latest-build listings). Upload success is confirmed; processing state, TestFlight readiness and tester access for this build are not yet confirmed. Do not re-upload blindly; check for build 6 / version 1.2 first.
- Follow-up at approximately 04:38 Asia/Aden: the `buildUploads` API confirms delivery `2937797d-d180-4dd0-b710-32ac75df58b8`, version 1.2 (6), state `PROCESSING`, with empty errors, warnings and infos. The linked build is still null. This explains the empty builds listing; a repeat upload is not indicated.
- Exported IPA: 106,451,594 bytes; SHA-256 `39d2e03f817472eccdff487b2d4610064c0f7b0342ef4d1d2967ab39519b612f`. Archives and signing material remain local and excluded from Git.
- Release source revision on GitHub: `c700f95` (includes application improvements from `33230d6`). Later report-only commits do not change the binary.

## Arabic TestFlight notes

Attached to build 1.2 (6) in the existing `ar-SA` locale and verified by API readback.

تحديث تجربة المصحف والختمة في مشكاة:
- واجهة قراءة أهدأ، وأدوات أوضح للفهرس والبحث والعلامات والتلاوة.
- تكبير وتصغير سلس مع الحفاظ على موضع القراءة وتحسين اللمس داخل قارئ المصحف.
- تحسين إنشاء خطط الختمة ومتابعة الورد، وتناسق الواجهات الفاتحة والداكنة.
- تحسينات للموقع والأذونات وتباين الودجت مع الحفاظ على المحتوى والبيانات الحالية.

يرجى تجربة الانتقال بين الصفحات، التكبير والعودة للحجم الطبيعي، البحث بالعربية والأرقام، حفظ العلامات، التلاوة، إنشاء خطة ختمة ومتابعة الورد، وإضافة الودجت على iPhone. جرّبوا تحديث النسخة السابقة دون حذف التطبيق للتأكد من بقاء البيانات.

## Known verification limits

Physical-device recitation, full VoiceOver and Dynamic Type, and Android were not verified. The keyboard-number entry flow was verified in the browser, not fully in the iOS Simulator. Native touch controls were checked and the WebKit focus regression was fixed and retested.

## Rollback and distribution safety

Build 1.1 (5) remains in TestFlight and must not be expired as part of this release. Existing user data keys and schemas are preserved. If reading, launch, notifications, or widgets regress, stop distribution of build 6 and return testers to the previous build; issue a corrected build with a new number. Do not force-push or rewrite the Git history to roll back; use a normal revert commit after authorization. Stop before App Store production submission unless separately requested.

No unattended production monitoring or physical-device stability claim is made.
