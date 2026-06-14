import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/change_password_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/discharge/discharge_screen.dart';
import '../../features/batch/batch_screen.dart';
import '../../features/transfer/transfer_screen.dart';
import '../../features/receive/receive_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/fuel/fuel_screen.dart';
import '../../features/backoffice/batch_status_screen.dart';
import '../../features/vehicles/vehicle_list_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthListenable(ref);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.matchedLocation;

      // Splash handles its own navigation — don't redirect from it
      if (path == '/splash') return null;

      // While restoring session, allow access to dashboard optimistically.
      // If token is invalid, _tryRestoreSession() will set isAuthenticated=false
      // and this redirect will fire again, sending user to /login.
      if (auth.isInitializing) return null;

      if (!auth.isAuthenticated) return path == '/login' ? null : '/login';
      if (auth.user!.mustChangePassword) return path == '/change-password' ? null : '/change-password';
      if (path == '/login') return '/dashboard';
      return null;
    },
    routes: [
      // ── Auth (no shell) ─────────────────────────────────────────────────
      GoRoute(path: '/splash',          builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login',           builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/change-password', builder: (_, __) => const ChangePasswordScreen()),

      // ── Main shell (bottom nav) ──────────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/home',      builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/search',    builder: (_, __) => const SearchScreen()),
          GoRoute(path: '/profile',   builder: (_, __) => const ProfileScreen()),
        ],
      ),

      // ── Operation screens (no shell — full screen) ───────────────────────
      GoRoute(path: '/discharge',    builder: (_, __) => const DischargeScreen()),
      GoRoute(path: '/batch',        builder: (_, __) => const BatchScreen()),
      GoRoute(path: '/transfer',     builder: (_, __) => const TransferScreen()),
      GoRoute(path: '/receive',      builder: (_, __) => const ReceiveScreen()),
      GoRoute(path: '/fuel',         builder: (_, __) => const FuelScreen()),
      GoRoute(path: '/batch-status', builder: (_, __) => const BatchStatusScreen()),
      GoRoute(
        path: '/vehicles',
        builder: (_, state) {
          final status     = state.uri.queryParameters['workflow_status'] ?? '';
          final manifestId = int.tryParse(state.uri.queryParameters['manifest_id'] ?? '');
          final manifestNo = state.uri.queryParameters['manifest_number'];
          return VehicleListScreen(
            workflowStatus:  status,
            manifestId:      manifestId,
            manifestNumber:  manifestNo,
          );
        },
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.uri}')),
    ),
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }
}
