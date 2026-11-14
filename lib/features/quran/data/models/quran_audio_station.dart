import 'package:equatable/equatable.dart';

/// Category of an audio broadcast or stream.
enum AudioStationCategory { liveStream, radio }

/// Truthful availability state of an audio stream.
enum AudioStationAvailability {
  /// Stream URL is verified and playable.
  available,

  /// Stream endpoint is awaiting official verified source.
  awaitingSource,

  /// Stream is currently offline or unreachable.
  offline,
}

/// Metadata and streaming configuration for Quran live streams and radio stations.
class QuranAudioStation extends Equatable {
  const QuranAudioStation({
    required this.id,
    required this.title,
    required this.category,
    required this.subtitle,
    required this.availability,
    this.streamUrl,
    this.watchUrl,
    this.youtubeChannelId,
    this.sourceLabel,
    this.country,
    this.city,
    this.notes,
  });

  final String id;
  final String title;
  final AudioStationCategory category;
  final String subtitle;
  final AudioStationAvailability availability;
  final String? streamUrl;
  final String? watchUrl;
  final String? youtubeChannelId;
  final String? sourceLabel;
  final String? country;
  final String? city;
  final String? notes;

  bool get isAudioPlayable =>
      availability == AudioStationAvailability.available &&
      streamUrl != null &&
      streamUrl!.isNotEmpty;

  bool get isWatchable =>
      availability == AudioStationAvailability.available &&
      ((youtubeChannelId != null && youtubeChannelId!.isNotEmpty) ||
          (watchUrl != null && watchUrl!.isNotEmpty));

  bool get isPlayable => isAudioPlayable || isWatchable;

  String get availabilityLabel {
    switch (availability) {
      case AudioStationAvailability.available:
        return isWatchable ? 'مباشر الآن' : 'بث مباشر';
      case AudioStationAvailability.awaitingSource:
        return 'بانتظار اعتماد المصدر الموثق';
      case AudioStationAvailability.offline:
        return 'غير متاح حالياً';
    }
  }

  @override
  List<Object?> get props => [
    id,
    title,
    category,
    subtitle,
    availability,
    streamUrl,
    watchUrl,
    youtubeChannelId,
    sourceLabel,
    country,
    city,
    notes,
  ];

  /// Canonical catalog of requested live streams and Quran radio stations.
  ///
  /// Every entry reflects its TRUTHFUL availability state.
  /// Unverified streams are explicitly marked as awaiting verified source.
  static const List<QuranAudioStation> defaultCatalog = [
    // ----------------------------------------------------
    // Live Streams (البث المباشر)
    // ----------------------------------------------------
    QuranAudioStation(
      id: 'stream_haram_makkah',
      title: 'بث المسجد الحرام',
      category: AudioStationCategory.liveStream,
      subtitle: 'مكة المكرمة · أطهر بقاع الأرض',
      availability: AudioStationAvailability.available,
      watchUrl: 'https://www.youtube.com/@SaudiQuranTv/live',
      youtubeChannelId: 'UCos52azQNBgW63_9uDJoPDA',
      sourceLabel: 'قناة القرآن الكريم الرسمية',
      country: 'المملكة العربية السعودية',
      city: 'مكة المكرمة',
      notes: 'البث الرسمي لقناة القرآن الكريم التابعة لهيئة الإذاعة والتلفزيون السعودية.',
    ),
    QuranAudioStation(
      id: 'stream_masjid_nabawi',
      title: 'بث المسجد النبوي',
      category: AudioStationCategory.liveStream,
      subtitle: 'المدينة المنورة · مدينة رسول الله ﷺ',
      availability: AudioStationAvailability.available,
      watchUrl: 'https://www.youtube.com/@SaudiSunnahTv/live',
      youtubeChannelId: 'UCROKYPep-UuODNwyipe6JMw',
      sourceLabel: 'قناة السنة النبوية الرسمية',
      country: 'المملكة العربية السعودية',
      city: 'المدينة المنورة',
      notes: 'البث الرسمي لقناة السنة النبوية التابعة لهيئة الإذاعة والتلفزيون السعودية.',
    ),

    // ----------------------------------------------------
    // Quran Radio Stations (إذاعات القرآن الكريم)
    // ----------------------------------------------------
    QuranAudioStation(
      id: 'radio_cairo',
      title: 'إذاعة القرآن الكريم من القاهرة',
      category: AudioStationCategory.radio,
      subtitle: 'جمهورية مصر العربية · أعرق إذاعات القرآن',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://service.webvideocore.net/CL1olYogIrDWvwqiIKK7eCxOS4PStqG9DuEjAr2ZjZQtvS3d4y9r0cvRhvS17SGN/a_7a4vuubc6mo8.m3u8',
      sourceLabel: 'إذاعة القرآن الكريم المصرية',
      country: 'مصر',
      city: 'القاهرة',
      notes: 'البث الرقمي المباشر المنشور في الموقع الرسمي لإذاعة القرآن الكريم من القاهرة.',
    ),
    QuranAudioStation(
      id: 'radio_riyadh',
      title: 'إذاعة القرآن الكريم من الرياض',
      category: AudioStationCategory.radio,
      subtitle: 'المملكة العربية السعودية · تلاوات وبرامج قرآنية',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://stream.radiojar.com/0tpy1h0kxtzuv',
      sourceLabel: 'MP3Quran · إذاعة القرآن السعودية',
      country: 'السعودية',
      city: 'الرياض',
      notes:
          'بث إذاعة القرآن الكريم السعودية المدرج في واجهة MP3Quran الرسمية.',
    ),
    QuranAudioStation(
      id: 'radio_sharjah',
      title: 'إذاعة القرآن الكريم من الشارقة',
      category: AudioStationCategory.radio,
      subtitle: 'دولة الإمارات العربية المتحدة · تلاوات خاشعة',
      availability: AudioStationAvailability.available,
      streamUrl:
          'https://l3.itworkscdn.net/smcquranlive/quranradiolive/icecast.audio',
      sourceLabel: 'هيئة الشارقة للإذاعة والتلفزيون',
      country: 'الإمارات',
      city: 'الشارقة',
      notes: 'بث مباشر معتمد عبر خوادم هيئة الشارقة للإذاعة والتلفزيون (Icecast AAC).',
    ),
    QuranAudioStation(
      id: 'radio_qatar',
      title: 'إذاعة القرآن الكريم من قطر',
      category: AudioStationCategory.radio,
      subtitle: 'دولة قطر · تلاوات بروايات متعددة',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://live.kwikmotion.com/qmcquranradiolive/quranradio/playlist.m3u8',
      sourceLabel: 'إذاعة القرآن الكريم القطرية',
      country: 'قطر',
      city: 'الدوحة',
      notes: 'البث الرقمي المباشر المنشور في موقع إذاعة القرآن الكريم القطرية.',
    ),
    QuranAudioStation(
      id: 'radio_bahrain',
      title: 'إذاعة القرآن الكريم من البحرين',
      category: AudioStationCategory.radio,
      subtitle: 'مملكة البحرين · تلاوات عذبة مستمرة',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://5c7b683162943.streamlock.net/live/ngrp:radio-106-1_all/playlist.m3u8',
      sourceLabel: 'وزارة الإعلام البحرينية',
      country: 'البحرين',
      city: 'المنامة',
      notes: 'بث مباشر معتمد عبر وزارة شؤون الإعلام في البحرين (HLS Stream).',
    ),
    QuranAudioStation(
      id: 'radio_reverent_recitations',
      title: 'إذاعة التلاوات الخاشعة',
      category: AudioStationCategory.radio,
      subtitle: 'تلاوات منتقاة تبعث السكينة والطمأنينة',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://backup.qurango.net/radio/salma',
      sourceLabel: 'MP3Quran',
      notes: 'قناة تلاوات خاشعة مستمرة من دليل إذاعات MP3Quran.',
    ),
    QuranAudioStation(
      id: 'radio_short_recitations',
      title: 'إذاعة تراتيل قصيرة',
      category: AudioStationCategory.radio,
      subtitle: 'مختارات قصيرة ومميزة من آيات القرآن',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://backup.qurango.net/radio/tarateel',
      sourceLabel: 'MP3Quran',
      notes: 'قناة تراتيل قصيرة مستمرة من دليل إذاعات MP3Quran.',
    ),
    QuranAudioStation(
      id: 'radio_sakeenah',
      title: 'إذاعة آيات السكينة',
      category: AudioStationCategory.radio,
      subtitle: 'آيات مختارة للسكينة والراحة النفسية',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://backup.qurango.net/radio/sakeenah',
      sourceLabel: 'MP3Quran',
      notes: 'قناة آيات السكينة المستمرة من دليل إذاعات MP3Quran.',
    ),
    QuranAudioStation(
      id: 'radio_al_baqarah',
      title: 'إذاعة سورة البقرة',
      category: AudioStationCategory.radio,
      subtitle: 'سورة البقرة بأصوات مجموعة من القراء',
      availability: AudioStationAvailability.available,
      streamUrl: 'https://backup.qurango.net/radio/albaqarah',
      sourceLabel: 'MP3Quran',
      notes: 'قناة سورة البقرة المستمرة من دليل إذاعات MP3Quran.',
    ),
  ];
}
