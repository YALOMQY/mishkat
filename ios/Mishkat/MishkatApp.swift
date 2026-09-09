import SwiftUI
import UserNotifications
import FirebaseCore
import FirebaseMessaging

@main
struct MishkatApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea(.container, edges: .all)
                .preferredColorScheme(nil)
        }
    }
}

extension Notification.Name {
    static let mishkatPushStatusDidChange = Notification.Name("mishkat.push.status")
    static let mishkatPushMessageOpened = Notification.Name("mishkat.push.opened")
}

final class AppDelegate: NSObject, UIApplicationDelegate,
                         UNUserNotificationCenterDelegate, MessagingDelegate {
    private(set) var firebaseConfigured = false
    private(set) var fcmToken: String?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        configureFirebaseIfAvailable(application)
        return true
    }

    /// Firebase لا يبدأ جمع معرّف التثبيت قبل موافقة المستخدم على الإشعارات.
    private func configureFirebaseIfAvailable(_ application: UIApplication) {
        guard Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil else {
            publishPushStatus()
            return
        }

        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        firebaseConfigured = FirebaseApp.app() != nil
        guard firebaseConfigured else {
            publishPushStatus()
            return
        }

        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional
                    || settings.authorizationStatus == .ephemeral else {
                self?.publishPushStatus()
                return
            }
            DispatchQueue.main.async { self?.activateRemoteMessaging() }
        }
    }

    /// يُستدعى فقط بعد منح الإذن من واجهة مشكاة أو لمستخدم سبق أن منحه.
    func activateRemoteMessaging() {
        guard firebaseConfigured else {
            publishPushStatus()
            return
        }

        Messaging.messaging().isAutoInitEnabled = true
        UIApplication.shared.registerForRemoteNotifications()
        publishPushStatus()
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard firebaseConfigured else { return }
        // SwiftUI + تعطيل swizzling: نربط APNs بـ FCM يدوياً وفق توثيق Firebase.
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { [weak self] token, _ in
            DispatchQueue.main.async {
                if let token, !token.isEmpty { self?.didReceiveFCMToken(token) }
                else { self?.publishPushStatus() }
            }
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        publishPushStatus()
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken, !fcmToken.isEmpty else {
            self.fcmToken = nil
            publishPushStatus()
            return
        }
        didReceiveFCMToken(fcmToken)
    }

    private func didReceiveFCMToken(_ token: String) {
        fcmToken = token
        // قناة اختيارية تتيح إرسال رسالة واحدة لكل مستخدمي «مشكاة» من FCM.
        Messaging.messaging().subscribe(toTopic: "mishkat_all")
        publishPushStatus()
    }

    func pushStatus(completion: @escaping ([String: Any]) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            guard let self else { return }
            let authorization: String
            switch settings.authorizationStatus {
            case .authorized: authorization = "authorized"
            case .provisional: authorization = "provisional"
            case .ephemeral: authorization = "ephemeral"
            case .denied: authorization = "denied"
            case .notDetermined: authorization = "notDetermined"
            @unknown default: authorization = "unknown"
            }

            DispatchQueue.main.async {
                completion([
                    "configured": self.firebaseConfigured,
                    "authorization": authorization,
                    "registered": UIApplication.shared.isRegisteredForRemoteNotifications,
                    "token": self.fcmToken ?? ""
                ])
            }
        }
    }

    func publishPushStatus() {
        pushStatus { status in
            NotificationCenter.default.post(name: .mishkatPushStatusDidChange,
                                            object: nil,
                                            userInfo: status)
        }
    }

    /// إظهار التنبيه حتى والتطبيق مفتوح
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                               willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    /// تمرير فتح الرسالة إلى واجهة التطبيق؛ يمكن استخدام data.route للانتقال إلى قسم محدد.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        NotificationCenter.default.post(name: .mishkatPushMessageOpened,
                                        object: nil,
                                        userInfo: response.notification.request.content.userInfo)
    }
}
