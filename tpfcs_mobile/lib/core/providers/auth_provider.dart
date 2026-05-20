import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/models.dart';

// ── OTP channel model ─────────────────────────────────────────────────────────
class OtpChannel {
  final String type;    // 'email' | 'sms'
  final String label;
  final String display;
  const OtpChannel({required this.type, required this.label, required this.display});

  factory OtpChannel.fromJson(Map<String, dynamic> j) => OtpChannel(
    type:    j['type']    as String,
    label:   j['label']   as String? ?? j['type'],
    display: j['display'] as String? ?? '',
  );
}

// ── Auth state ────────────────────────────────────────────────────────────────
enum AuthStep { idle, credentials, channel, otp, authenticated, mustChangePassword }

class AuthState {
  final User?         user;
  final bool          isLoading;
  final bool          isInitializing; // true while restoring session on app start
  final String?       error;
  final AuthStep      step;
  final List<OtpChannel> channels;
  final String        maskedContact;
  final String        loginField;

  const AuthState({
    this.user,
    this.isLoading      = false,
    this.isInitializing = true, // starts true until session check completes
    this.error,
    this.step       = AuthStep.idle,
    this.channels   = const [],
    this.maskedContact = '',
    this.loginField = '',
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    bool? isInitializing,
    String? error,
    AuthStep? step,
    List<OtpChannel>? channels,
    String? maskedContact,
    String? loginField,
  }) => AuthState(
    user:           user           ?? this.user,
    isLoading:      isLoading      ?? this.isLoading,
    isInitializing: isInitializing ?? this.isInitializing,
    error:          error,
    step:           step           ?? this.step,
    channels:       channels       ?? this.channels,
    maskedContact:  maskedContact  ?? this.maskedContact,
    loginField:     loginField     ?? this.loginField,
  );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Ref _ref;
  AuthNotifier(this._ref) : super(const AuthState()) {
    _tryRestoreSession();
  }

  Future<void> _tryRestoreSession() async {
    final token = await getAccessToken();
    if (token == null) {
      state = state.copyWith(isInitializing: false);
      return;
    }
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.getJson('/auth/me');
      final user = User.fromJson(res);
      state = AuthState(
        user: user,
        isInitializing: false,
        step: user.mustChangePassword ? AuthStep.mustChangePassword : AuthStep.authenticated,
      );
    } catch (_) {
      await clearTokens();
      state = state.copyWith(isInitializing: false);
    }
  }

  // ── Step 1: validate credentials → get OTP channels ──────────────────────
  Future<void> validateCredentials(String login, String password) async {
    state = state.copyWith(isLoading: true, loginField: login);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.postJson('/auth/validate-credentials',
          data: {'login': login, 'password': password});

      if (res['status'] == true) {
        final channels = (res['channels'] as List? ?? [])
            .map((c) => OtpChannel.fromJson(c as Map<String, dynamic>))
            .toList();
        state = state.copyWith(isLoading: false, step: AuthStep.channel,
            channels: channels, loginField: login);
      } else if (res['must_change_password'] == true) {
        // Direct login + redirect to change password
        final loginRes = await dio.postJson('/auth/login',
            data: {'login': login, 'password': password});
        final tokens = AuthTokens.fromJson(loginRes);
        await saveTokens(access: tokens.access, refresh: tokens.refresh);
        final me = await dio.getJson('/auth/me');
        state = state.copyWith(
          isLoading: false,
          user: User.fromJson(me),
          step: AuthStep.mustChangePassword,
        );
      } else {
        state = state.copyWith(isLoading: false, error: res['message'] as String? ?? 'Invalid credentials');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
    }
  }

  // ── Step 2: send OTP via chosen channel ───────────────────────────────────
  Future<void> sendOtp(String channel) async {
    state = state.copyWith(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.postJson('/auth/send-otp',
          data: {'login': state.loginField, 'channel': channel});
      state = state.copyWith(
        isLoading: false,
        step: AuthStep.otp,
        maskedContact: res['maskedContact'] as String? ?? '',
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to send OTP. Please try again.');
    }
  }

  // ── Step 3: verify OTP → authenticate ─────────────────────────────────────
  Future<void> verifyOtp(String otp) async {
    state = state.copyWith(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.postJson('/auth/verify-otp',
          data: {'login': state.loginField, 'otp': otp});
      final tokens = AuthTokens.fromJson(res);
      await saveTokens(access: tokens.access, refresh: tokens.refresh);
      final user = User.fromJson(res['user'] as Map<String, dynamic>);
      state = state.copyWith(
        isLoading: false,
        user: user,
        step: user.mustChangePassword ? AuthStep.mustChangePassword : AuthStep.authenticated,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Invalid or expired OTP.');
    }
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  Future<void> resendOtp(String channel) async {
    state = state.copyWith(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final res = await dio.postJson('/auth/send-otp',
          data: {'login': state.loginField, 'channel': channel});
      state = state.copyWith(
        isLoading: false,
        maskedContact: res['maskedContact'] as String? ?? state.maskedContact,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to resend OTP.');
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  Future<bool> changePassword(String current, String newPass) async {
    state = state.copyWith(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      await dio.postJson('/auth/change-password',
          data: {'currentPassword': current, 'newPassword': newPass});
      // Update user flag
      if (state.user != null) {
        state = state.copyWith(
          isLoading: false,
          user: User(
            userId: state.user!.userId,
            username: state.user!.username,
            fullName: state.user!.fullName,
            role: state.user!.role,
            icdvId: state.user!.icdvId,
            icdvName: state.user!.icdvName,
            mustChangePassword: false,
          ),
          step: AuthStep.authenticated,
        );
      }
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false,
        error: _extractMessage(e) ?? 'Failed to change password.');
      return false;
    }
  }

  // ── Go back between OTP steps ──────────────────────────────────────────────
  void backToCredentials() => state = state.copyWith(step: AuthStep.idle, error: null);
  void backToChannel()     => state = state.copyWith(step: AuthStep.channel, error: null);

  // ── Logout ─────────────────────────────────────────────────────────────────
  Future<void> logout() async {
    final token = await getRefreshToken();
    if (token != null) {
      try {
        await _ref.read(dioProvider).postJson('/auth/logout', data: {'refreshToken': token});
      } catch (_) {}
    }
    await clearTokens();
    state = const AuthState();
  }

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('401')) return 'Invalid credentials. Please try again.';
    if (s.contains('SocketException') || s.contains('connection')) return 'Cannot connect to server';
    return 'Login failed. Please try again.';
  }

  String? _extractMessage(Object e) {
    try {
      final s = e.toString();
      final match = RegExp(r'"message":"([^"]+)"').firstMatch(s);
      return match?.group(1);
    } catch (_) { return null; }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
