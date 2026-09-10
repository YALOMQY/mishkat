import WidgetKit
import SwiftUI

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    let nextName: String
    let nextAt: Date
    let currentName: String?
    let city: String
    let configured: Bool
}

struct Provider: TimelineProvider {
    private let sample = Entry(
        date: .now,
        nextName: "المغرب",
        nextAt: .now.addingTimeInterval(3120),
        currentName: "العصر",
        city: "مكة المكرمة",
        configured: true
    )

    func placeholder(in context: Context) -> Entry { sample }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(entry(at: .now) ?? sample)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        guard let first = entry(at: .now) else {
            let empty = Entry(
                date: .now,
                nextName: "—",
                nextAt: .now,
                currentName: nil,
                city: "",
                configured: false
            )
            completion(Timeline(entries: [empty], policy: .after(.now.addingTimeInterval(3600))))
            return
        }

        var entries = [first]
        var cursor = first.nextAt
        for _ in 0..<6 {
            guard let next = entry(at: cursor.addingTimeInterval(1)) else { break }
            entries.append(next)
            cursor = next.nextAt
        }
        completion(Timeline(entries: entries, policy: .after(cursor.addingTimeInterval(60))))
    }

    private func entry(at date: Date) -> Entry? {
        guard let config = SharedStore.load() else { return nil }
        let result = PrayerTimes.next(after: date, config: config)
        return Entry(
            date: date,
            nextName: result.next.name,
            nextAt: result.next.date,
            currentName: result.current?.name,
            city: config.city,
            configured: true
        )
    }
}

// MARK: - Mishkat visual system

enum MishkatWidgetTheme {
    static let emerald = Color(red: 11 / 255, green: 61 / 255, blue: 50 / 255)
    static let deepEmerald = Color(red: 7 / 255, green: 42 / 255, blue: 35 / 255)
    static let ivory = Color(red: 255 / 255, green: 253 / 255, blue: 248 / 255)
    static let gold = Color(red: 209 / 255, green: 173 / 255, blue: 88 / 255)
    static let ink = Color(red: 23 / 255, green: 33 / 255, blue: 29 / 255)
    static let muted = Color(red: 93 / 255, green: 104 / 255, blue: 99 / 255)

    static func readingAccent(for scheme: ColorScheme) -> Color {
        scheme == .dark ? gold : Color(red: 135 / 255, green: 96 / 255, blue: 24 / 255)
    }

    static func prayerBackground(for scheme: ColorScheme) -> Color {
        scheme == .dark ? deepEmerald : emerald
    }

    static func readingBackground(for scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 16 / 255, green: 34 / 255, blue: 27 / 255) : ivory
    }

    static func readingForeground(for scheme: ColorScheme) -> Color {
        scheme == .dark ? ivory : ink
    }
}

enum MishkatWidgetFormatters {
    private static let prayerTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ar_YE")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "h:mm a"
        return formatter
    }()

    static func time(_ date: Date) -> String {
        prayerTime.string(from: date)
    }
}

/// الخط المميز للودجت: محراب هادئ يحيط بالمعلومة الأساسية دون إنشاء بطاقة أخرى.
struct MihrabContour: Shape {
    func path(in rect: CGRect) -> Path {
        let shoulderY = rect.minY + rect.height * 0.33
        let left = rect.minX + rect.width * 0.15
        let right = rect.maxX - rect.width * 0.15
        let crown = CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.05)

        var path = Path()
        path.move(to: CGPoint(x: left, y: rect.maxY))
        path.addLine(to: CGPoint(x: left, y: shoulderY))
        path.addQuadCurve(
            to: crown,
            control: CGPoint(x: left, y: rect.minY + rect.height * 0.08)
        )
        path.addQuadCurve(
            to: CGPoint(x: right, y: shoulderY),
            control: CGPoint(x: right, y: rect.minY + rect.height * 0.08)
        )
        path.addLine(to: CGPoint(x: right, y: rect.maxY))
        return path
    }
}

// MARK: - Prayer widget views

struct WidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    let entry: Entry

    private var locationName: String {
        let value = entry.city.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? "الموقع الحالي" : value
    }

    var body: some View {
        Group {
            if entry.configured {
                configuredContent
            } else {
                missingLocationContent
            }
        }
        .environment(\.locale, Locale(identifier: "ar"))
        .environment(\.layoutDirection, .rightToLeft)
    }

    @ViewBuilder
    private var configuredContent: some View {
        switch family {
        case .accessoryInline:
            Text("\(entry.nextName) · \(MishkatWidgetFormatters.time(entry.nextAt))")
                .accessibilityLabel("الصلاة القادمة \(entry.nextName)، الساعة \(MishkatWidgetFormatters.time(entry.nextAt))")

        case .accessoryCircular:
            VStack(spacing: 0) {
                Text(entry.nextName)
                    .font(.system(.caption2, design: .rounded, weight: .bold))
                    .lineLimit(1)
                Text(MishkatWidgetFormatters.time(entry.nextAt))
                    .font(.system(.caption2, design: .rounded, weight: .medium))
                    .monospacedDigit()
                    .minimumScaleFactor(0.64)
                    .lineLimit(1)
            }
            .widgetAccentable()
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(entry.nextName)، \(MishkatWidgetFormatters.time(entry.nextAt))")
            .containerBackground(for: .widget) { Color.clear }

        case .accessoryRectangular:
            LockPrayerView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }

        case .systemMedium:
            mediumView

        default:
            smallView
        }
    }

    private var smallView: some View {
        ZStack {
            MihrabContour()
                .stroke(MishkatWidgetTheme.gold.opacity(0.25), lineWidth: 1.2)
                .padding(.horizontal, 6)
                .allowsHitTesting(false)

            ViewThatFits(in: .vertical) {
                smallDetails
                smallCompact
            }
        }
        .foregroundStyle(MishkatWidgetTheme.ivory)
        .containerBackground(for: .widget) {
            MishkatWidgetTheme.prayerBackground(for: colorScheme)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "الصلاة القادمة \(entry.nextName)، الساعة \(MishkatWidgetFormatters.time(entry.nextAt))، في \(locationName)"
        )
    }

    private var smallDetails: some View {
        VStack(alignment: .trailing, spacing: 3) {
            LocationLine(name: locationName)
            Spacer(minLength: 4)
            Text("الصلاة القادمة")
                .font(.caption2.weight(.medium))
                .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.72))
            Text(entry.nextName)
                .font(.system(.title, design: .rounded, weight: .heavy))
                .foregroundStyle(MishkatWidgetTheme.gold)
                .lineLimit(1)
                .minimumScaleFactor(0.76)
            Text(MishkatWidgetFormatters.time(entry.nextAt))
                .font(.system(.headline, design: .rounded, weight: .bold))
                .monospacedDigit()
            HStack(spacing: 4) {
                Text("متبقٍ")
                    .font(.caption2)
                    .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.68))
                Text(entry.nextAt, style: .timer)
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }

    private var smallCompact: some View {
        VStack(alignment: .trailing, spacing: 4) {
            LocationLine(name: locationName)
            Spacer(minLength: 0)
            Text(entry.nextName)
                .font(.title2.weight(.heavy))
                .foregroundStyle(MishkatWidgetTheme.gold)
                .lineLimit(1)
            Text(MishkatWidgetFormatters.time(entry.nextAt))
                .font(.headline.weight(.bold))
                .monospacedDigit()
            Text(entry.nextAt, style: .timer)
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }

    private var mediumView: some View {
        ZStack {
            MihrabContour()
                .stroke(MishkatWidgetTheme.gold.opacity(0.18), lineWidth: 1.2)
                .frame(maxWidth: 178)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .allowsHitTesting(false)

            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(MishkatWidgetFormatters.time(entry.nextAt))
                        .font(.system(.title2, design: .rounded, weight: .bold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    HStack(spacing: 5) {
                        Text("متبقٍ")
                            .font(.caption2)
                            .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.66))
                        Text(entry.nextAt, style: .timer)
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.65)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .environment(\.layoutDirection, .rightToLeft)

                Rectangle()
                    .fill(MishkatWidgetTheme.gold.opacity(0.72))
                    .frame(width: 2, height: 66)

                VStack(alignment: .trailing, spacing: 3) {
                    Text("الصلاة القادمة")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.7))
                    Text(entry.nextName)
                        .font(.system(.title, design: .rounded, weight: .heavy))
                        .foregroundStyle(MishkatWidgetTheme.gold)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    LocationLine(name: locationName)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .environment(\.layoutDirection, .rightToLeft)
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .foregroundStyle(MishkatWidgetTheme.ivory)
        .containerBackground(for: .widget) {
            MishkatWidgetTheme.prayerBackground(for: colorScheme)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "الصلاة القادمة \(entry.nextName)، الساعة \(MishkatWidgetFormatters.time(entry.nextAt))، في \(locationName)"
        )
    }

    @ViewBuilder
    private var missingLocationContent: some View {
        switch family {
        case .accessoryInline:
            Text("مشكاة · حدّد موقعك")

        case .accessoryCircular:
            VStack(spacing: 1) {
                Image(systemName: "location.slash")
                    .font(.caption.weight(.semibold))
                Text("مشكاة")
                    .font(.caption2.weight(.bold))
            }
            .widgetAccentable()
            .accessibilityLabel("افتح مشكاة لتحديد موقعك")
            .containerBackground(for: .widget) { Color.clear }

        case .accessoryRectangular:
            VStack(alignment: .trailing, spacing: 2) {
                Text("مواقيت الصلاة")
                    .font(.headline)
                Text("افتح مشكاة لتحديد موقعك")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .accessibilityElement(children: .combine)
            .containerBackground(for: .widget) { Color.clear }

        default:
            ZStack {
                MihrabContour()
                    .stroke(MishkatWidgetTheme.gold.opacity(0.25), lineWidth: 1.2)
                    .allowsHitTesting(false)
                VStack(alignment: .trailing, spacing: 7) {
                    Image(systemName: "location.slash.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(MishkatWidgetTheme.gold)
                    Text("الموقع غير محدّد")
                        .font(.headline.weight(.bold))
                    Text("افتح مشكاة وحدّد موقعك لعرض الصلاة القادمة.")
                        .font(.caption)
                        .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.72))
                        .multilineTextAlignment(.trailing)
                        .lineLimit(3)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            }
            .foregroundStyle(MishkatWidgetTheme.ivory)
            .containerBackground(for: .widget) {
                MishkatWidgetTheme.prayerBackground(for: colorScheme)
            }
            .accessibilityElement(children: .combine)
        }
    }
}

private struct LocationLine: View {
    let name: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "location.fill")
                .font(.caption2)
            Text(name)
                .font(.caption2.weight(.medium))
                .lineLimit(1)
        }
        .foregroundStyle(MishkatWidgetTheme.ivory.opacity(0.72))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("الموقع \(name)")
    }
}

private struct LockPrayerView: View {
    let entry: Entry

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .trailing, spacing: 2) {
                Text("الصلاة القادمة")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(entry.nextName)
                    .font(.headline.weight(.bold))
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .leading, spacing: 2) {
                Text(MishkatWidgetFormatters.time(entry.nextAt))
                    .font(.headline.weight(.bold))
                    .monospacedDigit()
                    .lineLimit(1)
                Text(entry.nextAt, style: .timer)
                    .font(.caption2.weight(.medium))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .widgetAccentable()
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "الصلاة القادمة \(entry.nextName)، الساعة \(MishkatWidgetFormatters.time(entry.nextAt))"
        )
    }
}

// MARK: - Registration

struct MishkatWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MishkatPrayerWidget", provider: Provider()) { entry in
            WidgetView(entry: entry)
        }
        .configurationDisplayName("مواقيت الصلاة")
        .description("الصلاة القادمة ووقتها وموقعك بنظرة واحدة.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

@main
struct MishkatWidgetBundle: WidgetBundle {
    var body: some Widget {
        MishkatWidget()
        DuaWidget()
    }
}
