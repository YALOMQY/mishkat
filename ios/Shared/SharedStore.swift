import Foundation
import Security
#if canImport(WidgetKit)
import WidgetKit
#endif

/// مخزن مشترك بين التطبيق والودجت.
///
/// يستخدم **سلسلة المفاتيح المشتركة** لا App Group. السبب: صلاحية
/// `keychain-access-groups = <TeamID>.*` مضمّنة تلقائياً في كل ملف تزويد،
/// بينما App Group تتطلّب تسجيلاً يدوياً في بوابة المطوّرين.
/// البيانات المخزّنة صغيرة (إعدادات وأدعية) وغير حسّاسة، والوصول
/// `AfterFirstUnlock` ليقرأها الودجت بعد إعادة التشغيل دون فتح الجهاز.
enum SharedStore {

    private static let group   = "Z6WLFR3247.com.dakomn.mishkatapp.shared"
    private static let service = "com.dakomn.mishkatapp.shared"
    private static let configKey = "prayerConfig"
    private static let duasKey   = "duas"

    // ───────── سلسلة المفاتيح ─────────

    private static func write(_ data: Data, key: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: group
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func read(_ key: String) -> Data? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: group,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    // ───────── إعدادات المواقيت ─────────

    static func save(_ c: PrayerTimes.Config) {
        guard let data = try? JSONEncoder().encode(c) else { return }
        write(data, key: configKey)
        reload()
    }

    static func load() -> PrayerTimes.Config? {
        guard let d = read(configKey) else { return nil }
        return try? JSONDecoder().decode(PrayerTimes.Config.self, from: d)
    }

    // ───────── الأدعية المخصصة ─────────

    struct Dua: Codable, Hashable {
        var title: String
        var text: String
    }

    static func saveDuas(_ list: [Dua]) {
        guard let data = try? JSONEncoder().encode(list) else { return }
        write(data, key: duasKey)
        reload()
    }

    static func loadDuas() -> [Dua] {
        guard let d = read(duasKey),
              let list = try? JSONDecoder().decode([Dua].self, from: d) else { return [] }
        return list
    }

    /// أذكار افتراضية تظهر قبل أن يضيف المستخدم أدعيته
    static let fallbackDuas: [Dua] = [
        Dua(title: "", text: "سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ"),
        Dua(title: "", text: "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ"),
        Dua(title: "", text: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ"),
        Dua(title: "", text: "أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ"),
        Dua(title: "", text: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ")
    ]

    static func reload() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}
