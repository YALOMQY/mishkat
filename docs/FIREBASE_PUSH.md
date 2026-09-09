# إعداد Firebase Cloud Messaging لتطبيق مشكاة على iOS

هذا الدليل يخص تطبيق **مشكاة** بمعرّف الحزمة:

```text
com.dakomn.mishkatapp
```

لا تضع مفاتيح APNs أو حسابات الخدمة أو معرّفات الأجهزة الفعلية داخل المستودع أو لقطات الشاشة.

## 1. إنشاء مشروع Firebase

1. افتح [Firebase Console](https://console.firebase.google.com/) واختر **Create a project**.
2. سمِّ المشروع باسم واضح مثل `Mishkat`.
3. فعّل Google Analytics فقط إذا كنت تحتاج قياس فتح الحملات أو تقسيم الجمهور؛ ليس شرطًا لاستقبال FCM الأساسي.
4. أكمل إنشاء المشروع ثم افتح صفحته.

## 2. إضافة تطبيق iOS

1. من **Project Overview** اختر **Add app** ثم رمز iOS.
2. أدخل معرّف الحزمة حرفيًا، مع مراعاة حالة الأحرف:

   ```text
   com.dakomn.mishkatapp
   ```

3. اجعل اسم التطبيق الداخلي `Mishkat iOS`. يمكن إضافة App Store ID لاحقًا.
4. اضغط **Register app**.

> لا تسجّل الودجت `com.dakomn.mishkatapp.MishkatWidget` كتطبيق Firebase مستقل ما لم يحتج فعلًا إلى خدمات Firebase خاصة به.

## 3. تنزيل ملف الإعداد

1. اضغط **Download GoogleService-Info.plist** بعد تسجيل التطبيق.
2. لا تُنشئ `GoogleService-Info.plist` يدويًا ولا تنسخ محتواه من مشروع آخر؛ يجب تنزيله من Firebase للتطبيق المسجّل نفسه.
3. تأكد أن الاسم هو `GoogleService-Info.plist` بلا لاحقة مثل `(2)`.
4. ضع الملف في المسار التالي داخل المشروع:

   ```text
   ios/Mishkat/GoogleService-Info.plist
   ```

5. لا تضفه يدوياً إلى **Copy Bundle Resources**؛ مرحلة بناء «مشكاة» تنسخه تلقائياً إلى الحزمة، وتتحقق أداة الإصدار من أن `BUNDLE_ID` يساوي `com.dakomn.mishkatapp`.

الملف يحتوي معرّفات إعداد خاصة بالمشروع وليست مفتاح APNs. مع ذلك، لا تنشر نسخته الخاصة ببيئة الإنتاج خارج الأماكن الموثوقة.

## 4. إضافة Firebase إلى Xcode

1. افتح `ios/Mishkat.xcodeproj`.
2. اختر **File → Add Package Dependencies** وأضف:

   ```text
   https://github.com/firebase/firebase-ios-sdk
   ```

3. اختر المنتج `FirebaseMessaging` لهدف **Mishkat**؛ ستُضاف تبعية `FirebaseCore` تلقائياً.
4. في **Signing & Capabilities** أضف **Push Notifications**.
5. أضف **Background Modes → Remote notifications** فقط إذا ستستخدم رسائل البيانات أو التحديث الصامت في الخلفية.

عند تنفيذ الربط في `AppDelegate`:

- استدعِ `FirebaseApp.configure()` مرة واحدة عند بدء التطبيق.
- عيّن `Messaging.messaging().delegate` وسجّل التطبيق بواسطة `registerForRemoteNotifications()` بعد موافقة المستخدم.
- لأن مشكاة يعرض شاشة تمهيدية لطلب الإذن، لا تعرض طلب النظام مرة ثانية عند كل تشغيل.
- تعامل مع تغيّر Firebase Installation ID أو رمز FCM وحدّثه في خادمك إن كنت تحفظه.
- إذا عُطّل Firebase method swizzling، اربط APNs token يدويًا مع `Messaging.messaging().apnsToken`.

راجع [دليل ربط Firebase بتطبيق Apple](https://firebase.google.com/docs/ios/setup) و[دليل FCM على iOS](https://firebase.google.com/docs/cloud-messaging/ios/get-started) عند تنفيذ الكود.

## 5. رفع مفتاح APNs إلى Firebase

> مفتاح APNs ليس مفتاح App Store Connect API. يجب أن يكون مفتاحًا من Apple Developer ومفعّلًا لخدمة **Apple Push Notifications service (APNs)**.

1. افتح [Apple Developer → Certificates, Identifiers & Profiles → Keys](https://developer.apple.com/account/resources/authkeys/list).
2. أنشئ مفتاحًا أو استخدم مفتاح APNs صالحًا، وسجّل بأمان:
   - ملف المفتاح بصيغة `.p8`.
   - **Key ID**.
   - **Team ID** لحساب Apple Developer.
3. في Firebase افتح **Project settings → Cloud Messaging**.
4. تحت **Apple app configuration → APNs authentication key** اضغط **Upload**.
5. ارفع ملف `.p8` وأدخل قيمتي `<APNS_KEY_ID>` و`<APPLE_TEAM_ID>` ثم احفظ.

لا تضف ملف `.p8` إلى Xcode أو Git، ولا ترسله في المحادثات. تحتفظ Apple عادة بإتاحة تنزيله مرة واحدة فقط.

## 6. إرسال رسالة اختبار

الاختبار الحقيقي يحتاج جهاز iPhone فعليًا؛ لا تعتمد على السمليتر لإثبات وصول APNs.

1. ثبّت نسخة موقّعة من مشكاة على الجهاز وافتحها.
2. وافق على الإشعارات من شاشة التطبيق، ثم ضع التطبيق في الخلفية.
3. احصل من سجل التطوير الآمن على Firebase Installation ID أو FCM registration token الخاص بجهاز الاختبار. لا تنشره في README أو لقطات عامة.
4. في Firebase افتح **DevOps & Engagement → Messaging**.
5. اختر **Create your first campaign → Firebase Notification messages**، أو **New campaign → Notifications**.
6. اكتب عنوانًا ونصًا تجريبيين، ثم اختر **Send test message**.
7. أدخل `<TEST_INSTALLATION_ID_OR_FCM_TOKEN>` واضغط **Test**.
8. تحقق من ظهور البانر والصوت وفتح التطبيق عند الضغط عليه.

إذا لم تصل الرسالة، افحص بالترتيب: إذن الإشعارات، وجود Push Notifications entitlement، تطابق bundle ID، وجود `GoogleService-Info.plist` في Target الصحيح، نجاح تسجيل APNs، ثم صحة مفتاح APNs وTeam ID في Firebase.

## 7. إرسال حملة للعملاء

لا ترسل حملة عامة قبل نجاح رسالة الاختبار على نسخة TestFlight أو نسخة موقعة بالإنتاج.

1. افتح **DevOps & Engagement → Messaging → New campaign → Notifications**.
2. اكتب عنوانًا واضحًا ورسالة قصيرة غير مضللة.
3. في **Target** اختر تطبيق iOS ذي المعرّف `com.dakomn.mishkatapp`، ثم الجمهور المطلوب. استخدم «جميع المستخدمين» فقط عند الحاجة الفعلية.
4. راجع إعدادات الصوت، رابط الفتح، وقت الإرسال، المنطقة الزمنية وتاريخ الانتهاء.
5. أرسل اختبارًا أخيرًا إلى جهاز فريقك.
6. اختر **Schedule** أو **Publish**، ثم راقب النتائج من **Messaging → Reports**.

لرسائل عامة يختار المستخدم الاشتراك فيها، يمكن استخدام FCM topics. أما الرسائل الفردية أو الحساسة فتُرسل من بيئة خادم موثوقة باستخدام Firebase Admin SDK أو HTTP v1، وليس من داخل التطبيق.

## 8. الخصوصية والموافقة

- اطلب إذن الإشعارات في سياق مفهوم، واسمح للمستخدم بالرفض أو التفعيل لاحقًا من الإعدادات.
- وضّح في سياسة الخصوصية أن Firebase Messaging يسجل APNs token ويربطه بمعرّف تثبيت التطبيق، وقد يجمع طراز الجهاز واللغة والمنطقة الزمنية وإصدار النظام والتطبيق لأغراض التسليم والاشتراكات.
- حدّث قسم **App Privacy** في App Store Connect وفق حزم Firebase المستخدمة فعليًا؛ إضافة Analytics تغيّر الإفصاحات المطلوبة.
- لا تربط معرّف التثبيت بهوية المستخدم إلا عند الحاجة وبموافقة واضحة، وقيّد الوصول إليه واحذفه عندما يصبح غير صالح أو عند طلب حذف الحساب.
- لا تضع بيانات شخصية أو أسرارًا في نص الإشعار؛ قد يظهر على شاشة القفل.
- وفر إلغاء الاشتراك في الحملات غير الضرورية، واحترم إعدادات النظام وتفضيلات المستخدم.

المرجع: [متطلبات إفصاح بيانات Firebase لتطبيقات Apple](https://firebase.google.com/docs/ios/app-store-data-collection).

## قائمة تحقق قبل الإطلاق

- [ ] تطبيق Firebase مسجّل بالمعرّف `com.dakomn.mishkatapp`.
- [ ] `GoogleService-Info.plist` منزّل من Firebase ومضاف إلى Target **Mishkat**.
- [ ] `FirebaseMessaging` مضاف إلى التطبيق و`FirebaseCore` موجود كتبعية تلقائية.
- [ ] Push Notifications مفعّلة في Xcode وApple Developer.
- [ ] مفتاح APNs الصحيح مرفوع إلى Firebase دون حفظه في المستودع.
- [ ] الإذن والتسجيل يعملان على iPhone فعلي.
- [ ] رسالة الاختبار تصل في المقدمة والخلفية وتفتح الوجهة المتوقعة.
- [ ] سياسة الخصوصية وApp Privacy محدثتان قبل إرسال حملة للعملاء.
