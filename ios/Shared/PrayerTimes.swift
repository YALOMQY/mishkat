import Foundation

/// حساب مواقيت الصلاة فلكياً — نقل مطابق لمحرّك JavaScript في `js/prayer.js`.
/// يُستخدم في الودجت ليعمل وحده دون فتح التطبيق.
enum PrayerTimes {

    struct Config: Codable {
        var lat: Double, lng: Double
        var method: String = "MWL"
        var methodAuto: Bool = true
        var asr: String = "Standard"
        var highLats: String = "NightMiddle"
        var city: String = ""
        var tune: [String: Double] = [:]
    }

    struct Prayer: Identifiable {
        let key: String, name: String, date: Date
        var id: String { key }
    }

    static let order: [(key: String, name: String)] = [
        ("fajr", "الفجر"), ("sunrise", "الشروق"), ("dhuhr", "الظهر"),
        ("asr", "العصر"), ("maghrib", "المغرب"), ("isha", "العشاء")
    ]

    /// زوايا الفجر والعشاء لكل طريقة حساب. القيمة النصية تعني «دقائق بعد الغروب».
    private static let methods: [String: (fajr: Double, isha: Double, ishaMinutes: Bool)] = [
        "MWL": (18, 17, false),      "Makkah": (18.5, 90, true),
        "Egypt": (19.5, 17.5, false), "Karachi": (18, 18, false),
        "ISNA": (15, 15, false),      "Gulf": (19.5, 90, true),
        "Kuwait": (18, 17.5, false),  "Qatar": (18, 90, true),
        "Dubai": (18.2, 18.2, false), "Turkey": (18, 17, false),
        "Singapore": (20, 18, false), "France": (12, 12, false),
        "Russia": (16, 15, false),    "Tehran": (17.7, 14, false),
        "Jafari": (16, 14, false)
    ]

    /// حدود تقريبية لليمن تُستخدم لترحيل اختيار أم القرى الخاطئ في الإصدارات السابقة.
    /// تبقى أم القرى للسعودية، ولا نغيّر أي طريقة أخرى اختارها المستخدم.
    /// Natural Earth 1:110m (public domain)، بترتيب (خط العرض، خط الطول).
    private static let yemenMainland: [(lat: Double, lng: Double)] = [
        (19.000003, 52.000010), (17.349742, 52.782184), (16.651051, 53.108573),
        (16.382411, 52.385206), (15.938433, 52.191729), (15.597420, 52.168165),
        (15.175250, 51.172515), (14.708767, 49.574576), (14.003202, 48.679231),
        (13.948090, 48.238947), (14.007233, 47.938914), (13.592220, 47.354454),
        (13.399699, 46.717076), (13.347764, 45.877593), (13.290946, 45.625050),
        (13.026905, 45.406459), (12.953938, 45.144356), (12.699587, 44.989533),
        (12.721653, 44.494576), (12.585950, 44.175113), (12.636800, 43.482959),
        (13.220950, 43.222871), (13.767584, 43.251448), (14.062630, 43.087944),
        (14.802249, 42.892245), (15.213335, 42.604873), (15.261963, 42.805015),
        (15.718886, 42.702438), (15.911742, 42.823671), (16.347891, 42.779332),
        (16.666890, 43.218375), (17.088440, 43.115798), (17.579987, 43.380794),
        (17.319977, 43.791519), (17.410359, 44.062613), (17.433329, 45.216651),
        (17.333335, 45.399999), (17.233315, 46.366659), (17.283338, 46.749994),
        (16.949999, 47.000005), (17.116682, 47.466695), (18.166669, 48.183344),
        (18.616668, 49.116672)
    ]

    private static func pointInPolygon(lat: Double, lng: Double,
                                       polygon: [(lat: Double, lng: Double)]) -> Bool {
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.lat > lat) != (b.lat > lat),
               lng < (b.lng - a.lng) * (lat - a.lat) / (b.lat - a.lat) + a.lng {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    private static func isInYemen(lat: Double, lng: Double) -> Bool {
        let mainland = pointInPolygon(lat: lat, lng: lng, polygon: yemenMainland)
        let socotra = (11.7...12.9).contains(lat) && (52.9...54.7).contains(lng)
        return mainland || socotra
    }

    private static func resolvedMethod(_ requested: String, methodAuto: Bool, lat: Double, lng: Double) -> String {
        methodAuto && requested == "Makkah" && isInYemen(lat: lat, lng: lng) ? "MWL" : requested
    }

    // ───────── أدوات رياضية بالدرجات ─────────
    private static let d2r = Double.pi / 180
    private static func sin_(_ d: Double) -> Double { sin(d * d2r) }
    private static func cos_(_ d: Double) -> Double { cos(d * d2r) }
    private static func tan_(_ d: Double) -> Double { tan(d * d2r) }
    private static func asin_(_ x: Double) -> Double { asin(x) / d2r }
    private static func acos_(_ x: Double) -> Double { acos(x) / d2r }
    private static func atan2_(_ y: Double, _ x: Double) -> Double { atan2(y, x) / d2r }
    private static func acot_(_ x: Double) -> Double { atan2(1, x) / d2r }
    private static func wrap(_ a: Double, _ b: Double) -> Double {
        let r = a - b * floor(a / b); return r < 0 ? r + b : r
    }

    private static func julian(_ y: Int, _ m: Int, _ d: Int) -> Double {
        var y = y, m = m
        if m <= 2 { y -= 1; m += 12 }
        let a = floor(Double(y) / 100)
        let b = 2 - a + floor(a / 4)
        return floor(365.25 * Double(y + 4716)) + floor(30.6001 * Double(m + 1)) + Double(d) + b - 1524.5
    }

    private static func sunPosition(_ jd: Double) -> (decl: Double, eqt: Double) {
        let D = jd - 2451545.0
        let g = wrap(357.529 + 0.98560028 * D, 360)
        let q = wrap(280.459 + 0.98564736 * D, 360)
        let L = wrap(q + 1.915 * sin_(g) + 0.020 * sin_(2 * g), 360)
        let e = 23.439 - 0.00000036 * D
        let RA = wrap(atan2_(cos_(e) * sin_(L), cos_(L)) / 15, 24)
        return (asin_(sin_(e) * sin_(L)), q / 15 - RA)
    }

    /// مواقيت يوم واحد بالتوقيت المحلي للجهاز
    static func times(for date: Date, config c: Config) -> [String: Date] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let comp = cal.dateComponents([.year, .month, .day], from: date)
        guard let y = comp.year, let mo = comp.month, let d = comp.day else { return [:] }

        let methodKey = resolvedMethod(c.method, methodAuto: c.methodAuto, lat: c.lat, lng: c.lng)
        let m = methods[methodKey] ?? methods["MWL"]!
        let tzOffset = Double(TimeZone.current.secondsFromGMT(for: date)) / 3600
        let jDate = julian(y, mo, d) - c.lng / (15 * 24)
        let lat = c.lat

        func midDay(_ t: Double) -> Double { wrap(12 - sunPosition(jDate + t).eqt, 24) }
        func sunAngle(_ angle: Double, _ t: Double, ccw: Bool = false) -> Double {
            let decl = sunPosition(jDate + t).decl
            let x = (-sin_(angle) - sin_(decl) * sin_(lat)) / (cos_(decl) * cos_(lat))
            if x > 1 || x < -1 { return .nan }
            let v = acos_(x) / 15
            return midDay(t) + (ccw ? -v : v)
        }
        func asrTime(_ factor: Double, _ t: Double) -> Double {
            let decl = sunPosition(jDate + t).decl
            return sunAngle(-acot_(factor + tan_(abs(lat - decl))), t)
        }
        let riseSet = 0.833

        // تقديرات بالساعات ثم تكرار للتقارب
        var t: [String: Double] = ["imsak": 5, "fajr": 5, "sunrise": 6, "dhuhr": 12,
                                   "asr": 13, "sunset": 18, "maghrib": 18, "isha": 18]
        for _ in 0..<3 {
            let p = t.mapValues { $0 / 24 }
            t["imsak"]   = sunAngle(10, p["imsak"]!, ccw: true)
            t["fajr"]    = sunAngle(m.fajr, p["fajr"]!, ccw: true)
            t["sunrise"] = sunAngle(riseSet, p["sunrise"]!, ccw: true)
            t["dhuhr"]   = midDay(p["dhuhr"]!)
            t["asr"]     = asrTime(c.asr == "Hanafi" ? 2 : 1, p["asr"]!)
            t["sunset"]  = sunAngle(riseSet, p["sunset"]!)
            t["maghrib"] = t["sunset"]!
            t["isha"]    = m.ishaMinutes ? t["sunset"]! : sunAngle(m.isha, p["isha"]!)
        }
        if m.ishaMinutes { t["isha"] = t["sunset"]! + m.isha / 60 }

        // تصحيح خطوط العرض العالية
        if c.highLats != "None" {
            let night = wrap(t["sunrise"]! - t["sunset"]!, 24)
            func portion(_ angle: Double) -> Double {
                switch c.highLats {
                case "AngleBased": return angle / 60 * night
                case "OneSeventh": return night / 7
                default:           return night / 2
                }
            }
            func adjust(_ time: Double, _ base: Double, _ angle: Double, ccw: Bool) -> Double {
                let p = portion(angle)
                let diff = ccw ? wrap(base - time, 24) : wrap(time - base, 24)
                return (time.isNaN || diff > p) ? base + (ccw ? -p : p) : time
            }
            t["fajr"] = adjust(t["fajr"]!, t["sunrise"]!, m.fajr, ccw: true)
            t["isha"] = adjust(t["isha"]!, t["sunset"]!, m.ishaMinutes ? 18 : m.isha, ccw: false)
        }

        let shift = tzOffset - c.lng / 15
        var out: [String: Date] = [:]
        let midnight = cal.startOfDay(for: date)
        for (k, v) in t where !v.isNaN {
            let tuned = (c.tune[k] ?? 0) / 60
            // تُطبّق التعديلات اليدوية أولاً، ثم يُقرّب الناتج النهائي لأقرب دقيقة.
            // سماحية نصف ثانية تمنع اختلاف JS وSwift عند حدود التقريب بسبب دقة النموذج الفلكي.
            let roundedMinutes = ((v + shift + tuned) * 60 + 0.5 / 60).rounded()
            out[k] = midnight.addingTimeInterval(roundedMinutes * 60)
        }
        return out
    }

    /// الصلاة القادمة (تبحث في الغد إن لزم) والصلاة الحالية
    static func next(after now: Date, config c: Config) -> (next: Prayer, current: Prayer?) {
        let today = times(for: now, config: c)
        var list: [Prayer] = []
        for (k, n) in order { if let d = today[k] { list.append(Prayer(key: k, name: n, date: d)) } }
        list.sort { $0.date < $1.date }

        let upcoming = list.first { $0.date > now }
        let nextPrayer: Prayer
        if let u = upcoming {
            nextPrayer = u
        } else {
            let tomorrow = times(for: now.addingTimeInterval(86400), config: c)
            nextPrayer = Prayer(key: "fajr", name: "الفجر",
                                date: tomorrow["fajr"] ?? now.addingTimeInterval(3600))
        }
        let passed = list.filter { $0.date <= now && $0.key != "sunrise" }
        var current = passed.last
        if current == nil {
            let y = times(for: now.addingTimeInterval(-86400), config: c)
            if let isha = y["isha"] { current = Prayer(key: "isha", name: "العشاء", date: isha) }
        }
        return (nextPrayer, current)
    }
}
