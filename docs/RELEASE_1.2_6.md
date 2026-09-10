# Mishkat 1.2 (6) — Release preparation

Date: 2026-09-10

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
- Exported IPA: 106,451,594 bytes; SHA-256 `39d2e03f817472eccdff487b2d4610064c0f7b0342ef4d1d2967ab39519b612f`. Archives and signing material remain local and excluded from Git.
- Release source revision on GitHub: `c700f95` (includes application improvements from `33230d6`). Later report-only commits do not change the binary.

## Arabic TestFlight notes

Prepared below; not yet attached because the new build resource is not available in the API. The existing beta locale is `ar-SA`.

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
