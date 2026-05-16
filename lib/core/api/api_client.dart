import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ── Base URL — change for production ─────────────────────────────────────────
const kBaseUrl = 'http://10.0.2.2:3000/api/v1'; // Android emulator → localhost
// const kBaseUrl = 'https://your-icdv-api.com/api/v1'; // Production

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

const kAccessTokenKey  = 'access_token';
const kRefreshTokenKey = 'refresh_token';

// ── Token helpers ─────────────────────────────────────────────────────────────
Future<String?> getAccessToken()  => _storage.read(key: kAccessTokenKey);
Future<String?> getRefreshToken() => _storage.read(key: kRefreshTokenKey);

Future<void> saveTokens({required String access, required String refresh}) async {
  await _storage.write(key: kAccessTokenKey,  value: access);
  await _storage.write(key: kRefreshTokenKey, value: refresh);
}

Future<void> clearTokens() async {
  await _storage.delete(key: kAccessTokenKey);
  await _storage.delete(key: kRefreshTokenKey);
}

// ── Dio instance provider ─────────────────────────────────────────────────────
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: kBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));

  // Auth interceptor — adds token + handles 401 refresh
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshToken = await getRefreshToken();
          if (refreshToken != null) {
            try {
              final refreshDio = Dio(BaseOptions(baseUrl: kBaseUrl));
              final res = await refreshDio.post(
                '/auth/refresh-tokens',
                data: {'refreshToken': refreshToken},
              );
              final newAccess  = res.data['tokens']['access']['token']  as String;
              final newRefresh = res.data['tokens']['refresh']['token'] as String;
              await saveTokens(access: newAccess, refresh: newRefresh);
              // Retry original request
              error.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
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

  return dio;
});

// ── Convenience wrapper for API calls ────────────────────────────────────────
extension DioExt on Dio {
  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? params}) async {
    final res = await get(path, queryParameters: params);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postJson(String path, {Map<String, dynamic>? data}) async {
    final res = await post(path, data: data);
    return res.data as Map<String, dynamic>;
  }
}
