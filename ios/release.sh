#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  رفع «مشكاة» إلى TestFlight / App Store Connect
#
#  الاستخدام:
#     ./release.sh
#
#  الأفضل — رفع بدون الاعتماد على حساب Xcode (مفتاح App Store Connect API):
#     export ASC_KEY_ID=XXXXXXXXXX
#     export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#     export ASC_KEY_PATH=~/private_keys/AuthKey_XXXXXXXXXX.p8
#     ./release.sh
# ══════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' Mishkat.xcodeproj/project.pbxproj | sed 's/.*= *//;s/;//' || true)
VERSION=$(grep -m1 'MARKETING_VERSION = ' Mishkat.xcodeproj/project.pbxproj | sed 's/.*= *//;s/;//')
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION = ' Mishkat.xcodeproj/project.pbxproj | sed 's/.*= *//;s/;//')
RELEASE_ROOT="archive/${VERSION}-${BUILD}"
ARCHIVE="$RELEASE_ROOT/Mishkat.xcarchive"
EXPORT_PATH="$RELEASE_ROOT/export"

# ───────── فحص سلامة النسخة قبل لمس مفاتيح التوقيع ─────────
echo "▸ فحص النسخة ${VERSION} (${BUILD})…"
plutil -lint Mishkat/Info.plist MishkatWidget/Info.plist ExportOptions.plist >/dev/null
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.dakomn.mishkatapp;' Mishkat.xcodeproj/project.pbxproj
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.dakomn.mishkatapp.MishkatWidget;' Mishkat.xcodeproj/project.pbxproj
grep -q 'FirebaseMessaging' Mishkat.xcodeproj/project.pbxproj || {
  echo "✗ حزمة FirebaseMessaging غير مرتبطة بهدف Mishkat"
  exit 1
}
grep -q '<key>aps-environment</key>' Mishkat/Mishkat.entitlements || {
  echo "✗ صلاحية Push Notifications غير موجودة في Mishkat.entitlements"
  exit 1
}
grep -q 'Firebase Cloud Messaging' ../privacy.html || {
  echo "✗ سياسة الخصوصية لا تتضمن إفصاح Firebase Messaging"
  exit 1
}

FIREBASE_CONFIG="Mishkat/GoogleService-Info.plist"
[ -f "$FIREBASE_CONFIG" ] || {
  echo "✗ ملف Firebase غير موجود: $FIREBASE_CONFIG"
  echo "  نزّله من Firebase Console لتطبيق com.dakomn.mishkatapp ثم أعد المحاولة."
  exit 1
}
plutil -lint "$FIREBASE_CONFIG" >/dev/null
FIREBASE_BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print:BUNDLE_ID' "$FIREBASE_CONFIG" 2>/dev/null || true)
[ "$FIREBASE_BUNDLE_ID" = "com.dakomn.mishkatapp" ] || {
  echo "✗ ملف Firebase مرتبط بمعرّف مختلف: ${FIREBASE_BUNDLE_ID:-غير معروف}"
  exit 1
}

MUSHAF_COUNT=$(find ../assets/mushaf/hafs-kfqc/pages -type f -name '*.svg' | wc -l | tr -d ' ')
[ "$MUSHAF_COUNT" = "604" ] || { echo "✗ صفحات المصحف: $MUSHAF_COUNT بدل 604"; exit 1; }

for SOURCE in ../js/*.js ../sw.js; do
  node --check "$SOURCE" >/dev/null
done
node ../tests/prayer-regression.js >/dev/null
node ../tests/mushaf-integrity.js >/dev/null
node ../tests/product-regression.js >/dev/null
echo "  ✓ المعرفات، الودجت، Firebase Push، سلامة 604 صفحة، التلاوة، الختمة، المكتبة، ومواقيت حضرموت"

# ───────── فحص مسبق: مصدر الاعتماد ─────────
if [ -n "$ASC_KEY_ID" ] && [ -n "$ASC_ISSUER_ID" ] && [ -n "$ASC_KEY_PATH" ]; then
  [ -f "$ASC_KEY_PATH" ] || { echo "✗ ملف المفتاح غير موجود: $ASC_KEY_PATH"; exit 1; }
  AUTH="-authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID -authenticationKeyPath $ASC_KEY_PATH"
  echo "▸ الاعتماد: مفتاح App Store Connect API ($ASC_KEY_ID)"
else
  AUTH=""
  echo "▸ الاعتماد: الحساب المسجّل في Xcode"
  if ! security find-certificate -c "Apple Distribution" >/dev/null 2>&1; then
    cat <<EOF

⚠️  لا توجد شهادة توزيع (Apple Distribution) على هذا الجهاز.
    الرفع سيفشل غالباً بالخطأ: "No Accounts with App Store Connect Access"

    الحل — أحد الطريقين:

    ١) سجّل الدخول في Xcode:
       Xcode ← Settings (⌘،) ← Accounts ← + ← Apple ID
       استخدم نفس Apple ID الذي اشتريت به العضوية،
       ثم تأكد أن الفريق يظهر بغير كلمة "Personal Team".

    ٢) الأفضل — مفتاح App Store Connect API (لا يعتمد على واجهة Xcode):
       App Store Connect ← Users and Access ← Integrations
       ← App Store Connect API ← Team Keys ← +  (الدور: App Manager)
       نزّل ملف AuthKey_XXXXXXXXXX.p8 (يُنزّل مرّة واحدة فقط) ثم:
         export ASC_KEY_ID=XXXXXXXXXX
         export ASC_ISSUER_ID=<Issuer ID من نفس الصفحة>
         export ASC_KEY_PATH=~/private_keys/AuthKey_XXXXXXXXXX.p8

    وتذكّر: يلزم أيضاً إنشاء سجلّ التطبيق في App Store Connect
    ← My Apps ← + ← معرّف الحزمة com.dakomn.mishkatapp

EOF
    printf "أتابع رغم ذلك؟ [y/N] "; read a
    case "$a" in y|Y) ;; *) exit 1 ;; esac
  fi
fi

echo "▸ الفريق: ${TEAM:-غير محدّد}"

# ───────── هوية التوزيع في سلسلة مفاتيح مخصّصة (لا تحتاج كلمة مرور الجهاز) ─────────
KC=mishkat-build.keychain
KC_PATH="$HOME/Library/Keychains/mishkat-build.keychain-db"
KC_PASSWORD=${MISHKAT_KEYCHAIN_PASSWORD:?عيّن MISHKAT_KEYCHAIN_PASSWORD في بيئة آمنة قبل تشغيل الإصدار}
P12="$HOME/.appstoreconnect/MishkatDistribution.p12"
if [ ! -f "$KC_PATH" ]; then
  [ -f "$P12" ] || { echo "✗ هوية التوزيع مفقودة: $P12"; exit 1; }
  echo "▸ إنشاء سلسلة مفاتيح الإصدار…"
  security create-keychain -p "$KC_PASSWORD" "$KC"
fi
security unlock-keychain -p "$KC_PASSWORD" "$KC_PATH"

if ! security find-identity -v -p codesigning "$KC_PATH" 2>/dev/null | grep -q "Apple Distribution"; then
  [ -f "$P12" ] || { echo "✗ شهادة التوزيع مفقودة: $P12"; exit 1; }
  echo "▸ استيراد شهادة التوزيع…"
  security import "$P12" -k "$KC_PATH" -P "$KC_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
  curl -sf -o /tmp/wwdr.cer https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer \
    && security import /tmp/wwdr.cer -k "$KC_PATH" -T /usr/bin/codesign 2>/dev/null || true
fi
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KC_PASSWORD" "$KC_PATH" >/dev/null
security list-keychains -d user -s "$HOME/Library/Keychains/login.keychain-db" "$KC_PATH"

echo "▸ ١/٣ أرشفة نسخة الإصدار بملفات App Store…"
mkdir -p "$RELEASE_ROOT"
rm -rf "$ARCHIVE" "$EXPORT_PATH"
xcodebuild -project Mishkat.xcodeproj -scheme Mishkat -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" clean archive \
  -allowProvisioningUpdates $AUTH \
  DEVELOPMENT_TEAM="$TEAM"

echo "▸ ٢/٣ تصدير ملف .ipa…"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist ExportOptions.plist -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates $AUTH

IPA=$(find "$EXPORT_PATH" -maxdepth 1 -type f -name '*.ipa' -print -quit)
[ -n "$IPA" ] || { echo "✗ لم يُنتج ملف .ipa"; exit 1; }
echo "  الملف: $IPA  ($(du -h "$IPA" | cut -f1))"

echo "▸ ٣/٣ الرفع إلى App Store Connect…"
if [ -n "$ASC_KEY_ID" ]; then
  # الرفع بمفتاح API — لا يعتمد على حساب Xcode
  export API_PRIVATE_KEYS_DIR="$(dirname "$ASC_KEY_PATH")"
  xcrun altool --validate-app -f "$IPA" -t ios \
    --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
  xcrun altool --upload-app -f "$IPA" -t ios \
    --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
else
  xcrun altool --upload-app -f "$IPA" -t ios --apple-id "$APPLE_ID" --password "$APP_PASSWORD"
fi

echo
echo "✅ تمّ الرفع. افتح App Store Connect ← TestFlight."
echo "   النسخة تحتاج ٥–٣٠ دقيقة للمعالجة، ثم أجب على سؤال تصدير التشفير (الجواب: لا)"
echo "   وأضف المختبرين. الاختبار الداخلي يبدأ فوراً بلا مراجعة."
