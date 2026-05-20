import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ── Base URL ──────────────────────────────────────────────────────────────────
const kBaseUrl = 'https://bandari.tpfcs.co.tz/api';
// const kBaseUrl = 'http://10.0.2.2:3000/api';  // local emulator

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

const kAccessTokenKey = 'access_token';
const kRefreshTokenKey = 'refresh_token';

Future<String?> getAccessToken() => _storage.read(key: kAccessTokenKey);
Future<String?> getRefreshToken() => _storage.read(key: kRefreshTokenKey);

Future<void> saveTokens({
  required String access,
  required String refresh,
}) async {
  await _storage.write(key: kAccessTokenKey, value: access);
  await _storage.write(key: kRefreshTokenKey, value: refresh);
}

Future<void> clearTokens() async {
  await _storage.delete(key: kAccessTokenKey);
  await _storage.delete(key: kRefreshTokenKey);
}

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kBaseUrl,
      // Generous timeouts — server is remote, may have cold-start delay
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  // ── Auth token injection ──────────────────────────────────────────────────
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await getAccessToken();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        // Auto-refresh on 401
        if (error.response?.statusCode == 401) {
          final refreshToken = await getRefreshToken();
          if (refreshToken != null) {
            try {
              final refreshDio = Dio(
                BaseOptions(
                  baseUrl: kBaseUrl,
                  connectTimeout: const Duration(seconds: 60),
                  receiveTimeout: const Duration(seconds: 60),
                ),
              );
              final res = await refreshDio.post(
                '/auth/refresh-tokens',
                data: {'refreshToken': refreshToken},
              );
              final newAccess = res.data['access']['token'] as String;
              final newRefresh = res.data['refresh']['token'] as String;
              await saveTokens(access: newAccess, refresh: newRefresh);
              error.requestOptions.headers['Authorization'] =
                  'Bearer $newAccess';
              final retryRes = await dio.fetch(error.requestOptions);
              return handler.resolve(retryRes);
            } catch (_) {
              await clearTokens();
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  // ── Debug logging (remove before release) ────────────────────────────────
  /*dio.interceptors.add(LogInterceptor(
    requestBody: false,
    responseBody: false,
    requestHeader: false,
    responseHeader: false,
    logPrint: (o) => print('[API] $o'),
  ));
  */

  return dio;
});

extension DioExt on Dio {
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? params,
  }) async {
    final res = await get(path, queryParameters: params);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? data,
  }) async {
    final res = await post(path, data: data);
    return res.data as Map<String, dynamic>;
  }
}
