// ============================================================
// SportMaps — School Branding & Theme Providers
// Reemplaza: ThemeContext.tsx + useSchoolContext hook
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'auth_provider.dart';

// ─────────────────────────────────────────
// SHARED PREFERENCES PROVIDER
// ─────────────────────────────────────────
final sharedPrefsProvider = FutureProvider<SharedPreferences>(
  (_) => SharedPreferences.getInstance(),
);

// ─────────────────────────────────────────
// THEME MODE PROVIDER
// Persiste en SharedPreferences
// ─────────────────────────────────────────
final themeModeProvider =
    NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);

class ThemeModeNotifier extends Notifier<ThemeMode> {
  static const _key = 'theme_mode';

  @override
  ThemeMode build() {
    // Cargar preferencia guardada en segundo plano
    SharedPreferences.getInstance().then((prefs) {
      final saved = prefs.getString(_key);
      if (saved != null) {
        state = switch (saved) {
          'dark' => ThemeMode.dark,
          'light' => ThemeMode.light,
          _ => ThemeMode.system,
        };
      }
    });
    return ThemeMode.system;
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, mode.name);
  }

  void toggle() {
    setMode(state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
}

// ─────────────────────────────────────────
// SCHOOL BRANDING MODEL
// ─────────────────────────────────────────
class SmSchoolBranding {
  final String schoolId;
  final String schoolName;
  final String primaryHex;
  final String? secondaryHex;
  final String? logoUrl;
  final String? bannerUrl;

  const SmSchoolBranding({
    required this.schoolId,
    required this.schoolName,
    required this.primaryHex,
    this.secondaryHex,
    this.logoUrl,
    this.bannerUrl,
  });

  Color get primaryColor => _hex(primaryHex);
  Color get secondaryColor => _hex(secondaryHex ?? '#FB9F1E');

  static Color _hex(String hex) {
    final h = hex.replaceAll('#', '');
    return Color(int.parse('FF$h', radix: 16));
  }

  factory SmSchoolBranding.fromMap(Map<String, dynamic> map) =>
      SmSchoolBranding(
        schoolId: map['id'] as String,
        schoolName: map['name'] as String,
        primaryHex: map['primary_color'] as String? ?? '#248223',
        secondaryHex: map['secondary_color'] as String?,
        logoUrl: map['logo_url'] as String?,
        bannerUrl: map['banner_url'] as String?,
      );

  // Default SportMaps branding
  static const defaultBranding = SmSchoolBranding(
    schoolId: 'default',
    schoolName: 'SportMaps',
    primaryHex: '#248223',
    secondaryHex: '#FB9F1E',
  );
}

// ─────────────────────────────────────────
// SCHOOL BRANDING PROVIDER
// Carga el branding de la escuela del usuario
// desde Supabase y genera ThemeData dinámico
// ─────────────────────────────────────────
final schoolBrandingProvider =
    AsyncNotifierProvider<SchoolBrandingNotifier, SmSchoolBranding>(
  SchoolBrandingNotifier.new,
);

class SchoolBrandingNotifier extends AsyncNotifier<SmSchoolBranding> {
  @override
  Future<SmSchoolBranding> build() async {
    final profile = ref.watch(currentProfileProvider);
    if (profile?.schoolId == null) {
      return SmSchoolBranding.defaultBranding;
    }

    try {
      final data = await ref
          .read(supabaseClientProvider)
          .from('schools')
          .select(
              'id, name, primary_color, secondary_color, logo_url, banner_url')
          .eq('id', profile!.schoolId!)
          .single();
      return SmSchoolBranding.fromMap(data);
    } catch (_) {
      return SmSchoolBranding.defaultBranding;
    }
  }

  void updateBranding(SmSchoolBranding branding) {
    state = AsyncValue.data(branding);
  }
}

// ─────────────────────────────────────────
// DYNAMIC THEME PROVIDER
// Genera ThemeData con los colores de la escuela
// ─────────────────────────────────────────
final dynamicThemeProvider = Provider<ThemeData>((ref) {
  final branding = ref.watch(schoolBrandingProvider).valueOrNull ??
      SmSchoolBranding.defaultBranding;

  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: branding.primaryColor,
      primary: branding.primaryColor,
      tertiary: branding.secondaryColor,
      brightness: Brightness.light,
    ),
  );
});

final dynamicDarkThemeProvider = Provider<ThemeData>((ref) {
  final branding = ref.watch(schoolBrandingProvider).valueOrNull ??
      SmSchoolBranding.defaultBranding;

  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: branding.primaryColor,
      primary: branding.primaryColor,
      tertiary: branding.secondaryColor,
      brightness: Brightness.dark,
    ),
  );
});
