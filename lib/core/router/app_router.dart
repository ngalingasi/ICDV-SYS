import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/discharge/discharge_screen.dart';
import '../../features/batch/batch_screen.dart';
import '../../features/transfer/transfer_screen.dart';
import '../../features/receive/receive_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/profile/profile_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isAuth    = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final path      = state.matchedLocation;

      if (path == '/splash') return null;
      if (isLoading)         return null;
      if (!isAuth && path != '/login') return '/login';
      if (isAuth  && path == '/login') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash',   builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login',    builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/home',     builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/discharge',builder: (_, __) => const DischargeScreen()),
      GoRoute(path: '/batch',    builder: (_, __) => const BatchScreen()),
      GoRoute(path: '/transfer', builder: (_, __) => const TransferScreen()),
      GoRoute(path: '/receive',  builder: (_, __) => const ReceiveScreen()),
      GoRoute(path: '/search',   builder: (_, __) => const SearchScreen()),
      GoRoute(path: '/profile',  builder: (_, __) => const ProfileScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.uri}')),
    ),
  );
});
