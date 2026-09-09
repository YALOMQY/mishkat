import Foundation
import WebKit
import CoreLocation
import UserNotifications

/// جسر بين صفحة الويب وخدمات النظام: الموقع، البوصلة، والتنبيهات المحلية.
final class NativeBridge: NSObject, WKScriptMessageHandler, WKUIDelegate,
                          WKNavigationDelegate, CLLocationManagerDelegate {

    weak var webView: WKWebView?
    private let loc = CLLocationManager()
    private var adhanKey = "a1"                 // صوت الأذان المختار من الإعدادات
    private var pageReady = false
    private var pendingLocation: CLLocationCoordinate2D?   // موقع وصل قبل جاهزية الصفحة

    /// يُحقن قبل تحميل الصفحة: يعرّف الجسر ويخبر الويب أنه داخل تطبيق أصلي.
    static let injectedJS = """
    window.__MISHKAT_NATIVE__ = true;
    window.MishkatNative = {
      _post(m){ try { window.webkit.messageHandlers.mishkat.postMessage(m); } catch(e){} },
      schedule(list, city, adhan){ this._post({t:'schedule', list, city, adhan}); },
      testNotification(adhan){ this._post({t:'test', adhan}); },
      requestNotifications(){ this._post({t:'perm'}); },
      getPushStatus(){ this._post({t:'pushStatus'}); },
      startHeading(){ this._post({t:'heading', on:true}); },
      stopHeading(){ this._post({t:'heading', on:false}); },
      requestLocation(){ this._post({t:'location'}); },
      syncWidget(cfg){ this._post(Object.assign({t:'widget'}, cfg)); },
      syncDuas(list){ this._post({t:'duas', list}); }
    };
    """

    func start() {
        loc.delegate = self
        // قراءة واحدة دقيقة عند الطلب؛ لا نبقي GPS يعمل في الخلفية.
        loc.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        loc.headingFilter = 2
        // لا نعرض طلب النظام عند الإقلاع بلا سياق؛ الواجهة تشرح الفائدة أولاً ثم ترسل طلب location.
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(pushStatusChanged(_:)),
                                               name: .mishkatPushStatusDidChange,
                                               object: nil)
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(pushMessageOpened(_:)),
                                               name: .mishkatPushMessageOpened,
                                               object: nil)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    // MARK: - الرسائل القادمة من الويب

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let t = body["t"] as? String else { return }
        switch t {
        case "widget":
            saveWidgetConfig(body)
        case "duas":
            let raw = body["list"] as? [[String: String]] ?? []
            SharedStore.saveDuas(raw.map { SharedStore.Dua(title: $0["title"] ?? "", text: $0["text"] ?? "") })
        case "schedule":
            adhanKey = body["adhan"] as? String ?? adhanKey
            reschedule(list: body["list"] as? [[String: Any]] ?? [], city: body["city"] as? String ?? "")
        case "perm":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
                DispatchQueue.main.async {
                    if ok { (UIApplication.shared.delegate as? AppDelegate)?.activateRemoteMessaging() }
                    self.eval("window.dispatchEvent(new CustomEvent('mishkat-perm',{detail:\(ok)}))")
                    self.sendPushStatus()
                }
            }
        case "pushStatus":
            sendPushStatus()
        case "heading":
            if (body["on"] as? Bool) == true {
                updateHeadingOrientation()
                if CLLocationManager.headingAvailable() { loc.startUpdatingHeading() }
            } else {
                loc.stopUpdatingHeading()
            }
        case "location":
            switch loc.authorizationStatus {
            case .notDetermined:
                loc.requestWhenInUseAuthorization()
            case .authorizedWhenInUse, .authorizedAlways:
                loc.requestLocation()
            case .denied, .restricted:
                eval("window.dispatchEvent(new CustomEvent('mishkat-location-error',{detail:{reason:'denied'}}))")
            @unknown default:
                break
            }
        case "test":
            adhanKey = body["adhan"] as? String ?? adhanKey
            let c = UNMutableNotificationContent()
            c.title = "تجربة تنبيه الأذان"
            c.body = "هكذا سيصلك تنبيه الصلاة — أوقف الصوت بزر رفع/خفض الصوت ✓"
            c.sound = sound(for: adhanKey, type: "adhan")
            c.interruptionLevel = .timeSensitive
            UNUserNotificationCenter.current().add(
                UNNotificationRequest(identifier: "mishkat.test",
                                      content: c,
                                      trigger: UNTimeIntervalNotificationTrigger(timeInterval: 4, repeats: false)))
        default: break
        }
    }

    private func eval(_ js: String) { webView?.evaluateJavaScript(js, completionHandler: nil) }

    private func sendPushStatus() {
        (UIApplication.shared.delegate as? AppDelegate)?.pushStatus { [weak self] status in
            self?.dispatchJSONEvent(name: "mishkat-push-status", payload: status)
        }
    }

    @objc private func pushStatusChanged(_ note: Notification) {
        dispatchJSONEvent(name: "mishkat-push-status", payload: note.userInfo ?? [:])
    }

    @objc private func pushMessageOpened(_ note: Notification) {
        dispatchJSONEvent(name: "mishkat-notification-opened", payload: note.userInfo ?? [:])
    }

    private func dispatchJSONEvent(name: String, payload: [AnyHashable: Any]) {
        let safe = payload.reduce(into: [String: Any]()) { result, item in
            result[String(describing: item.key)] = item.value
        }
        guard JSONSerialization.isValidJSONObject(safe),
              let data = try? JSONSerialization.data(withJSONObject: safe),
              let json = String(data: data, encoding: .utf8) else { return }
        eval("window.dispatchEvent(new CustomEvent('\(name)',{detail:\(json)}))")
    }

    /// حفظ إعدادات المواقيت في App Group ليحسبها الودجت وحده
    private func saveWidgetConfig(_ b: [String: Any]) {
        guard let lat = b["lat"] as? Double, let lng = b["lng"] as? Double else { return }
        var c = PrayerTimes.Config(lat: lat, lng: lng)
        c.method   = b["method"] as? String ?? "MWL"
        c.methodAuto = b["methodAuto"] as? Bool ?? true
        c.asr      = b["asr"] as? String ?? "Standard"
        c.highLats = b["highLats"] as? String ?? "NightMiddle"
        c.city     = b["city"] as? String ?? ""
        if let t = b["tune"] as? [String: Double] { c.tune = t }
        SharedStore.save(c)
    }

    // MARK: - التنبيهات المحلية (تعمل والتطبيق مغلق)

    /// صوت الأذان يُرفق بالإشعار نفسه (٢٩ ثانية، حدّ iOS ٣٠) — لا يُشغَّل كمقطع صوتي،
    /// فيتحكّم به النظام: يظهر مع البانر، ويسكت بزر الصوت أو بسحب الإشعار.
    private func sound(for key: String, type: String) -> UNNotificationSound {
        guard type == "adhan", key.hasPrefix("a"), let n = Int(key.dropFirst()), (1...6).contains(n)
        else { return .default }
        return UNNotificationSound(named: UNNotificationSoundName("adhan\(n).caf"))
    }

    private func reschedule(list: [[String: Any]], city: String) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let mine = pending.filter { $0.identifier.hasPrefix("mishkat.") }.map(\.identifier)
            center.removePendingNotificationRequests(withIdentifiers: mine)

            // ٦٤ تنبيهاً هو سقف iOS — نأخذ الأقرب زمنياً
            for (i, ev) in list.prefix(60).enumerated() {
                guard let ms = ev["at"] as? Double else { continue }
                let date = Date(timeIntervalSince1970: ms / 1000)
                guard date.timeIntervalSinceNow > 5 else { continue }

                let type = ev["type"] as? String ?? "adhan"
                let name = ev["ar"] as? String ?? ""
                let mins = ev["min"] as? Int ?? 0

                let c = UNMutableNotificationContent()
                switch type {
                case "adhan":
                    c.title = "حان الآن وقت صلاة \(name)"
                    c.body = city.isEmpty ? "حيّ على الصلاة، حيّ على الفلاح"
                                          : "\(city) — حيّ على الصلاة، حيّ على الفلاح"
                case "pre":
                    c.title = "اقترب وقت \(name)"
                    c.body = "بقي \(mins) دقيقة على الأذان"
                case "adhkarM":
                    c.title = "أذكار الصباح"; c.body = "لا تنسَ وردك من أذكار الصباح"
                case "khatma":
                    c.title = ev["title"] as? String ?? "ورد الختمة"
                    c.body = ev["body"] as? String ?? "حان وقت وردك اليومي"
                default:
                    c.title = "أذكار المساء"; c.body = "لا تنسَ وردك من أذكار المساء"
                }
                c.sound = self.sound(for: self.adhanKey, type: type)
                c.interruptionLevel = (type == "adhan") ? .timeSensitive : .active

                let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
                center.add(UNNotificationRequest(identifier: "mishkat.\(type).\(i)", content: c, trigger: trigger))
            }
        }
    }

    // MARK: - الموقع والبوصلة

    func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let p = locs.last else { return }
        guard pageReady else { pendingLocation = p.coordinate; return }
        sendLocation(p.coordinate)
    }

    private func sendLocation(_ c: CLLocationCoordinate2D) {
        eval("window.dispatchEvent(new CustomEvent('mishkat-location',{detail:{lat:\(c.latitude),lng:\(c.longitude)}}))")
        lookUpPlaceName(c)
    }

    /// اسم المكان من نظام iOS بالعربية: الحيّ ← المدينة ← المديرية ← المحافظة ← الدولة.
    /// يحلّ مشكلة المناطق الصغيرة (مثل الشحر) التي لا توجد في جدول المدن.
    private func lookUpPlaceName(_ c: CLLocationCoordinate2D) {
        let loc = CLLocation(latitude: c.latitude, longitude: c.longitude)
        let locale = Locale(identifier: "ar")
        CLGeocoder().reverseGeocodeLocation(loc, preferredLocale: locale) { [weak self] marks, _ in
            guard let self, let m = marks?.first else { return }
            let city = m.locality ?? m.subAdministrativeArea
            let region = m.administrativeArea
            // «الشحر، حضرموت» — ويسقط للمحافظة وحدها إن لم تُعرف المدينة
            let parts = [city, region].compactMap { $0 }.filter { !$0.isEmpty }
            var name = parts.isEmpty ? (m.country ?? "") : Array(Set(parts)).count == 1 ? parts[0] : parts.joined(separator: "، ")
            if name.isEmpty { return }
            name = name.replacingOccurrences(of: "\"", with: " ")
                       .replacingOccurrences(of: "\\", with: " ")
                       .replacingOccurrences(of: "\n", with: " ")
            DispatchQueue.main.async {
                // نرسل الإحداثيات معه ليتحقّق الويب أنه اسم الموقع المعروض فعلاً
                self.eval("window.dispatchEvent(new CustomEvent('mishkat-place',{detail:{name:\"\(name)\",lat:\(c.latitude),lng:\(c.longitude)}}))")
            }
        }
    }

    /// الصفحة جاهزة: نُرسل ما وصل من الموقع أثناء التحميل
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = true
        if let c = pendingLocation { pendingLocation = nil; sendLocation(c) }
        sendPushStatus()
    }

    func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        eval("window.dispatchEvent(new CustomEvent('mishkat-location-error'))")
    }

    /// عند منح الإذن نجلب الموقع مباشرة، ثم تحدّث الواجهة المواقيت والقبلة والودجت.
    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        switch m.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: m.requestLocation()
        default: break
        }
    }

    func locationManager(_ m: CLLocationManager, didUpdateHeading h: CLHeading) {
        // القيمة السالبة تعني أن CoreLocation لا يملك تقديراً صالحاً للدقة.
        guard h.headingAccuracy >= 0 else { return }

        // إذا تغيّر اتجاه الشاشة فهذه العينة حُسبت بالمرجع السابق؛ ننتظر العينة التالية.
        if updateHeadingOrientation() { return }

        // الشمال الحقيقي إن توفّر (يحتاج الموقع)، وإلا المغناطيسي.
        let usesTrueNorth = h.trueHeading >= 0
        let deg = usesTrueNorth ? h.trueHeading : h.magneticHeading
        guard deg.isFinite else { return }

        let timestamp = h.timestamp.timeIntervalSince1970 * 1000
        let north = usesTrueNorth ? "true" : "magnetic"

        // أول وسيطين يحافظان على التوافق مع النداء القديم، والثالث يحمل البيانات الموسّعة.
        eval("window.__mishkatHeading && window.__mishkatHeading(\(deg), \(h.headingAccuracy), {heading:\(deg),accuracy:\(h.headingAccuracy),timestamp:\(timestamp),north:'\(north)'})")
    }

    /// يجعل مرجع CoreLocation موافقاً لأعلى واجهة التطبيق في الوضع الحالي.
    @discardableResult
    private func updateHeadingOrientation() -> Bool {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
            ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
        else { return false }

        let orientation: CLDeviceOrientation
        switch scene.interfaceOrientation {
        case .portrait: orientation = .portrait
        case .portraitUpsideDown: orientation = .portraitUpsideDown
        // UIInterfaceOrientation يصف دوران المحتوى، لذلك اليمين/اليسار معكوسان عن الجهاز الفيزيائي.
        case .landscapeLeft: orientation = .landscapeRight
        case .landscapeRight: orientation = .landscapeLeft
        default: return false
        }

        guard loc.headingOrientation != orientation else { return false }
        loc.headingOrientation = orientation
        return true
    }

    /// إذن الموقع لصفحة الويب داخل WKWebView
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType) async -> WKPermissionDecision { .prompt }

    /// عرض alert/confirm القادمة من الويب
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { cont in
            let a = UIAlertController(title: "مشكاة", message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in cont.resume(returning: false) })
            a.addAction(UIAlertAction(title: "متابعة", style: .destructive) { _ in cont.resume(returning: true) })
            Self.topController()?.present(a, animated: true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: "مشكاة", message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "حسناً", style: .default) { _ in cont.resume() })
            Self.topController()?.present(a, animated: true)
        }
    }

    private static func topController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let p = top?.presentedViewController { top = p }
        return top
    }
}
