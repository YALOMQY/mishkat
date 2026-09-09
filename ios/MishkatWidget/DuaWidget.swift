import WidgetKit
import SwiftUI

// MARK: - Timeline

/// يعرض أدعية المستخدم المخصصة بالتناوب، مع أذكار افتراضية قبل إضافة أول دعاء.
struct DuaEntry: TimelineEntry {
    let date: Date
    let dua: SharedStore.Dua
    let isCustom: Bool
}

struct DuaProvider: TimelineProvider {
    private let sample = DuaEntry(
        date: .now,
        dua: SharedStore.Dua(
            title: "",
            text: "سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ"
        ),
        isCustom: false
    )

    func placeholder(in context: Context) -> DuaEntry { sample }

    func getSnapshot(in context: Context, completion: @escaping (DuaEntry) -> Void) {
        completion(entries(from: .now).first ?? sample)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DuaEntry>) -> Void) {
        let list = entries(from: .now)
        completion(
            Timeline(
                entries: list,
                policy: .after(list.last?.date.addingTimeInterval(1800) ?? .now)
            )
        )
    }

    private func entries(from start: Date) -> [DuaEntry] {
        let custom = SharedStore.loadDuas()
        let list = custom.isEmpty ? SharedStore.fallbackDuas : custom
        guard !list.isEmpty else { return [sample] }

        return (0..<min(8, max(list.count, 4))).map { index in
            DuaEntry(
                date: start.addingTimeInterval(Double(index) * 1800),
                dua: list[index % list.count],
                isCustom: !custom.isEmpty
            )
        }
    }
}

// MARK: - Dua widget views

struct DuaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    let entry: DuaEntry

    private var sourceTitle: String {
        entry.isCustom ? "من أدعيتي" : "ذِكر"
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text("\(sourceTitle) · \(entry.dua.text)")

            case .accessoryRectangular:
                lockScreenView
                    .containerBackground(for: .widget) { Color.clear }

            case .systemMedium:
                mediumView

            default:
                smallView
            }
        }
        .environment(\.locale, Locale(identifier: "ar"))
        .environment(\.layoutDirection, .rightToLeft)
    }

    private var smallView: some View {
        ZStack {
            MihrabContour()
                .stroke(MishkatWidgetTheme.gold.opacity(colorScheme == .dark ? 0.24 : 0.31), lineWidth: 1.1)
                .padding(.horizontal, 8)
                .allowsHitTesting(false)

            VStack(alignment: .trailing, spacing: 6) {
                SourceLabel(title: sourceTitle)

                if !entry.dua.title.isEmpty {
                    Text(entry.dua.title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(MishkatWidgetTheme.gold)
                        .lineLimit(1)
                }

                Text(entry.dua.text)
                    .font(.system(.body, design: .serif, weight: .medium))
                    .lineSpacing(3)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(entry.dua.title.isEmpty ? 6 : 5)
                    .minimumScaleFactor(0.72)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        .foregroundStyle(MishkatWidgetTheme.readingForeground(for: colorScheme))
        .containerBackground(for: .widget) {
            MishkatWidgetTheme.readingBackground(for: colorScheme)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var mediumView: some View {
        HStack(alignment: .top, spacing: 14) {
            Rectangle()
                .fill(MishkatWidgetTheme.gold)
                .frame(width: 3)

            VStack(alignment: .trailing, spacing: 6) {
                SourceLabel(title: sourceTitle)

                if !entry.dua.title.isEmpty {
                    Text(entry.dua.title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(MishkatWidgetTheme.gold)
                        .lineLimit(1)
                }

                ViewThatFits(in: .vertical) {
                    Text(entry.dua.text)
                        .font(.system(.title3, design: .serif, weight: .medium))
                        .lineSpacing(4)
                        .lineLimit(4)

                    Text(entry.dua.text)
                        .font(.system(.body, design: .serif, weight: .medium))
                        .lineSpacing(3)
                        .lineLimit(4)
                }
                .multilineTextAlignment(.trailing)
                .minimumScaleFactor(0.75)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .foregroundStyle(MishkatWidgetTheme.readingForeground(for: colorScheme))
        .containerBackground(for: .widget) {
            MishkatWidgetTheme.readingBackground(for: colorScheme)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var lockScreenView: some View {
        VStack(alignment: .trailing, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: entry.isCustom ? "bookmark.fill" : "quote.opening")
                    .font(.caption2)
                Text(entry.dua.title.isEmpty ? sourceTitle : entry.dua.title)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(.secondary)

            Text(entry.dua.text)
                .font(.system(.caption, design: .serif, weight: .medium))
                .lineLimit(3)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.trailing)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .widgetAccentable()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        entry.dua.title.isEmpty
            ? "\(sourceTitle)، \(entry.dua.text)"
            : "\(sourceTitle)، \(entry.dua.title)، \(entry.dua.text)"
    }
}

private struct SourceLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 6) {
            Rectangle()
                .fill(MishkatWidgetTheme.gold)
                .frame(width: 18, height: 2)
            Text(title)
                .font(.caption2.weight(.semibold))
        }
        .foregroundStyle(MishkatWidgetTheme.gold)
    }
}

// MARK: - Registration

struct DuaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MishkatDuaWidget", provider: DuaProvider()) { entry in
            DuaWidgetView(entry: entry)
        }
        .configurationDisplayName("أدعيتي وأذكاري")
        .description("يعرض أدعيتك المخصصة بالتناوب، أو ذكرًا مختارًا عند عدم وجودها.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
