import 'dart:convert';
import 'dart:io';

import '../models/quran_audio_station.dart';

/// Resolves the current live YouTube video behind a stable official channel URL.
class HaramainLiveService {
  HaramainLiveService._();

  static final Map<String, ({String videoId, DateTime fetchedAt})> _cache = {};
  static final Map<String, Future<String?>> _inFlight = {};

  static Future<String?> resolveVideoId(QuranAudioStation station) {
    final cached = _cache[station.id];
    if (cached != null &&
        DateTime.now().difference(cached.fetchedAt) <
            const Duration(minutes: 3)) {
      return Future.value(cached.videoId);
    }

    return _inFlight.putIfAbsent(station.id, () async {
      try {
        final videoId = await _fetchVideoId(station.watchUrl);
        if (videoId != null) {
          _cache[station.id] = (videoId: videoId, fetchedAt: DateTime.now());
        }
        return videoId;
      } finally {
        _inFlight.remove(station.id);
      }
    });
  }

  static String thumbnailUrl(String videoId) =>
      'https://i.ytimg.com/vi/$videoId/hqdefault.jpg';

  static Future<String?> _fetchVideoId(String? rawUrl) async {
    if (rawUrl == null || rawUrl.isEmpty) return null;

    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12);
    try {
      final request = await client.getUrl(Uri.parse(rawUrl));
      request.headers.set(
        HttpHeaders.userAgentHeader,
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      );
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) return null;

      final html = await utf8.decoder.bind(response).join();
      return RegExp(r'"videoId":"([A-Za-z0-9_-]{11})"')
          .firstMatch(html)
          ?.group(1);
    } on Object {
      return null;
    } finally {
      client.close(force: true);
    }
  }
}
