// ============================================================
// SportMaps — main.dart (FINAL)
// Riverpod + Supabase + GoRouter + ThemeData dinámico
// Todo conectado: Auth → Router → AdaptiveScaffold → Screens
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'navigation/sm_router_v2.dart';

// ─────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Status bar edge-to-edge
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
  ));

  // Supabase — valores inyectados en tiempo de compilación
  // flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
  await Supabase.initialize(
    url: const String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: 'https://YOUR_PROJECT.supabase.co',
    ),
    anonKey: const String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: 'YOUR_ANON_KEY',
    ),
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce, // más seguro para móvil/web
    ),
    realtimeClientOptions: const RealtimeClientOptions(
      logLevel: RealtimeLogLevel.info,
    ),
  );

  runApp(
    // ProviderScope = raíz de Riverpod
    const ProviderScope(
      child: SportMapsApp(),
    ),
  );
}

// ─────────────────────────────────────────
// ROOT APP WIDGET
// ─────────────────────────────────────────
class SportMapsApp extends ConsumerWidget {
  const SportMapsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router     = ref.watch(routerProvider);
    final themeMode  = ref.watch(themeModeProvider);
    final lightTheme = ref.watch(dynamicThemeProvider);
    final darkTheme  = ref.watch(dynamicDarkThemeProvider);

    return MaterialApp.router(
      // ── Identidad ─────────────────────────────────────
      title:       'SportMaps',
      debugShowCheckedModeBanner: false,

      // ── Router (GoRouter) ─────────────────────────────
      routerConfig: router,

      // ── Tema dinámico (branding de escuela) ───────────
      theme:       lightTheme.copyWith(
        // Fusionar tokens SportMaps con el tema dinámico
        textTheme: _buildTextTheme(Brightness.light),
        extensions: [SportMapsThemeExtension.light],
      ),
      darkTheme:   darkTheme.copyWith(
        textTheme: _buildTextTheme(Brightness.dark),
        extensions: [SportMapsThemeExtension.dark],
      ),
      themeMode:   themeMode,

      // ── Locale ────────────────────────────────────────
      locale: const Locale('es'),

      // ── Loading overlay global mientras Supabase/Auth inicia ──
      builder: (context, child) {
        final authAsync = ref.watch(authProvider);

        return authAsync.when(
          loading: () => const _GlobalLoadingScreen(),
          // En error (ej: Supabase no configurado) mostrar la app igual
          // El router redirigirá a /login automáticamente
          error: (err, _) {
            debugPrint('Auth error: \$err');
            return child ?? const _GlobalLoadingScreen();
          },
          data: (_) => child ?? const _GlobalLoadingScreen(),
        );
      },
    );
  }

  TextTheme _buildTextTheme(Brightness brightness) {
    final base = brightness == Brightness.light
        ? ThemeData.light().textTheme
        : ThemeData.dark().textTheme;

    // Poppins en toda la escala tipográfica
    return base.copyWith(
      displayLarge: base.displayLarge
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w700),
      displayMedium: base.displayMedium
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w700),
      displaySmall: base.displaySmall
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
      headlineLarge: base.headlineLarge
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
      headlineMedium: base.headlineMedium
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
      headlineSmall: base.headlineSmall
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
      titleLarge: base.titleLarge
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
      titleMedium: base.titleMedium
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w500),
      titleSmall: base.titleSmall
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w500),
      bodyLarge: base.bodyLarge?.copyWith(fontFamily: 'Poppins'),
      bodyMedium: base.bodyMedium?.copyWith(fontFamily: 'Poppins'),
      bodySmall: base.bodySmall?.copyWith(fontFamily: 'Poppins'),
      labelLarge: base.labelLarge
          ?.copyWith(fontFamily: 'Poppins', fontWeight: FontWeight.w500),
      labelMedium: base.labelMedium?.copyWith(fontFamily: 'Poppins'),
      labelSmall: base.labelSmall?.copyWith(fontFamily: 'Poppins'),
    );
  }
}

// ─────────────────────────────────────────
// THEME EXTENSION — tokens SportMaps
// ─────────────────────────────────────────
class SportMapsThemeExtension extends ThemeExtension<SportMapsThemeExtension> {
  final Color accent;
  final Color accentDark;
  final Color muted;
  final Color mutedForeground;
  final Color destructive;
  final Color border;
  final Color success;

  const SportMapsThemeExtension({
    required this.accent,
    required this.accentDark,
    required this.muted,
    required this.mutedForeground,
    required this.destructive,
    required this.border,
    required this.success,
  });

  static const light = SportMapsThemeExtension(
    accent: Color(0xFFFB9F1E),
    accentDark: Color(0xFFE08500),
    muted: Color(0xFFF1F5F1),
    mutedForeground: Color(0xFF627D62),
    destructive: Color(0xFFEF4444),
    border: Color(0xFFE2E8E2),
    success: Color(0xFF22C55E),
  );

  static const dark = SportMapsThemeExtension(
    accent: Color(0xFFFB9F1E),
    accentDark: Color(0xFFE08500),
    muted: Color(0xFF1A2E1A),
    mutedForeground: Color(0xFF8FA68F),
    destructive: Color(0xFFEF4444),
    border: Color(0xFF2A3E2A),
    success: Color(0xFF22C55E),
  );

  @override
  SportMapsThemeExtension copyWith({
    Color? accent,
    Color? accentDark,
    Color? muted,
    Color? mutedForeground,
    Color? destructive,
    Color? border,
    Color? success,
  }) =>
      SportMapsThemeExtension(
        accent: accent ?? this.accent,
        accentDark: accentDark ?? this.accentDark,
        muted: muted ?? this.muted,
        mutedForeground: mutedForeground ?? this.mutedForeground,
        destructive: destructive ?? this.destructive,
        border: border ?? this.border,
        success: success ?? this.success,
      );

  @override
  SportMapsThemeExtension lerp(SportMapsThemeExtension? other, double t) {
    if (other == null) {
      return this;
    }
    return SportMapsThemeExtension(
      accent: Color.lerp(accent, other.accent, t)!,
      accentDark: Color.lerp(accentDark, other.accentDark, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      border: Color.lerp(border, other.border, t)!,
      success: Color.lerp(success, other.success, t)!,
    );
  }
}

// Extensión de contexto para acceder rápido a los tokens
extension SportMapsThemeX on BuildContext {
  SportMapsThemeExtension get smTheme =>
      Theme.of(this).extension<SportMapsThemeExtension>()!;
}

// ─────────────────────────────────────────
// LOADING SCREEN GLOBAL
// Se muestra mientras Riverpod carga el estado inicial de Auth
// ─────────────────────────────────────────
class _GlobalLoadingScreen extends StatefulWidget {
  const _GlobalLoadingScreen();

  @override
  State<_GlobalLoadingScreen> createState() => _GlobalLoadingScreenState();
}

class _GlobalLoadingScreenState extends State<_GlobalLoadingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulse = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1F0A),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Logo pulsante
            ScaleTransition(
              scale: _pulse,
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF248223), Color(0xFFFB9F1E)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF248223).withValues(alpha: 0.5),
                      blurRadius: 24,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.sports,
                  color: Colors.white,
                  size: 36,
                ),
              ),
            ),
            const SizedBox(height: 24),
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [Color(0xFF3FA53D), Color(0xFFFB9F1E)],
              ).createShader(bounds),
              child: const Text(
                'SportMaps',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Poppins',
                ),
              ),
            ),
            const SizedBox(height: 32),
            // Dots loader
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) => _Dot(delay: i * 200)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatefulWidget {
  final int delay;
  const _Dot({required this.delay});

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) {
        _ctrl.repeat(reverse: true);
      }
    });
    _anim = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: FadeTransition(
        opacity: _anim,
        child: Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: Color(0xFF248223),
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
