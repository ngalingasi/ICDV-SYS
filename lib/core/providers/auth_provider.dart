import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/models.dart';

// ── Auth state ────────────────────────────────────────────────────────────────
class AuthState {
  final User?  user;
  final bool   isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});
  bool get isAuthenticated => user != null;
  AuthState copyWith({User? user, bool? isLoading, String? error}) =>
      AuthState(user: user ?? this.user, isLoading: isLoading ?? this.isLoading, error: error);
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Ref _ref;
  AuthNotifier(this._ref) : super(const AuthState()) {
    _tryRestoreSession();
  }

  Future<void> _tryRestoreSession() async {
    final token = await getAccessToken();
    if (token == null) return;
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.getJson('/auth/me');
      state = AuthState(user: User.fromJson(res));
    } catch (_) {
      await clearTokens();
    }
  }

  Future<bool> login(String login, String password) async {
    state = const AuthState(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.postJson('/auth/login', data: {'login': login, 'password': password});
      final tokens = AuthTokens.fromJson(res);
      await saveTokens(access: tokens.access, refresh: tokens.refresh);
      final me = await dio.getJson('/auth/me');
      state = AuthState(user: User.fromJson(me));
      return true;
    } on Exception catch (e) {
      final msg = e.toString().contains('401')
          ? 'Invalid credentials'
          : e.toString().contains('SocketException') || e.toString().contains('connection')
              ? 'Cannot connect to server'
              : 'Login failed. Please try again.';
      state = AuthState(error: msg);
      return false;
    }
  }

  Future<void> logout() async {
    final token = await getRefreshToken();
    if (token != null) {
      try {
        final dio = _ref.read(dioProvider);
        await dio.postJson('/auth/logout', data: {'refreshToken': token});
      } catch (_) {}
    }
    await clearTokens();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
