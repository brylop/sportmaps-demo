// ============================================================
// SportMaps — ThemeData completo
// Mapeo 1:1 de CSS tokens → Flutter ColorScheme + TextTheme
// ============================================================

import 'package:flutter/material.dart';

// ─────────────────────────────────────────
// TOKENS DE COLOR (desde globals.css)
// ─────────────────────────────────────────
class SmColors {
  SmColors._();

  // Brand primario
  static const primary = Color(0xFF248223);
  static const primaryGlow = Color(0xFF3FA53D);
  static const primaryDark = Color(0xFF164016);
  static const primaryForeground = Colors.white;

  // Accent naranja
  static const accent = Color(0xFFFB9F1E);
  static const accentLight = Color(0xFFFCBA4A);
  static const accentDark = Color(0xFFF28C02);

  // Superficie / Fondo (light)
  static const background = Color(0xFFFFFFFF);
  static const foreground = Color(0xFF0A1F0A);
  static const card = Color(0xFFFFFFFF);
  static const muted = Color(0xFFF3F5F3);
  static const mutedForeground = Color(0xFF627D62);
  static const border = Color(0xFFDDE8DD);
  static const secondary = Color(0xFFF2F7F2);
  static const destructive = Color(0xFFEF4444);

  // Superficie (dark)
  static const darkBackground = Color(0xFF0A1F0A); // HSL 119 45% 6%
  static const darkCard = Color(0xFF142814);        // HSL 119 40% 12%
  static const darkPrimary = Color(0xFF3FA53D);     // HSL 119 55% 45%
  static const darkBorder = Color(0xFF1E3A1E);
  static const darkMuted = Color(0xFF1A301A);
  static const darkMutedForeground = Color(0xFF8FAF8F);
}

// ─────────────────────────────────────────
// LIGHT THEME
// ─────────────────────────────────────────
ThemeData sportMapsLightTheme() {
  final colorScheme = ColorScheme(
    brightness: Brightness.light,
    // Primary — verde SportMaps
    primary: SmColors.primary,
    onPrimary: SmColors.primaryForeground,
    primaryContainer: SmColors.primaryGlow.withOpacity(0.15),
    onPrimaryContainer: SmColors.primaryDark,
    // Secondary
    secondary: SmColors.secondary,
    onSecondary: SmColors.foreground,
    secondaryContainer: SmColors.secondary,
    onSecondaryContainer: SmColors.foreground,
    // Tertiary — naranja accent
    tertiary: SmColors.accent,
    onTertiary: Colors.white,
    tertiaryContainer: SmColors.accentLight.withOpacity(0.2),
    onTertiaryContainer: SmColors.accentDark,
    // Error
    error: SmColors.destructive,
    onError: Colors.white,
    errorContainer: const Color(0xFFFEE2E2),
    onErrorContainer: const Color(0xFF991B1B),
    // Surface
    surface: SmColors.background,
    onSurface: SmColors.foreground,
    surfaceContainerLowest: SmColors.card,
    surfaceContainerLow: SmColors.muted,
    surfaceContainer: SmColors.muted,
    surfaceContainerHigh: const Color(0xFFEBF0EB),
    surfaceContainerHighest: SmColors.border,
    onSurfaceVariant: SmColors.mutedForeground,
    // Outline
    outline: SmColors.border,
    outlineVariant: SmColors.border.withOpacity(0.5),
    // Shadow
    shadow: Colors.black.withOpacity(0.1),
    // Inverse
    inverseSurface: SmColors.foreground,
    onInverseSurface: SmColors.background,
    inversePrimary: SmColors.primaryGlow,
    // Scrim
    scrim: Colors.black54,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    textTheme: _buildTextTheme(SmColors.foreground),
    scaffoldBackgroundColor: SmColors.background,
    appBarTheme: AppBarTheme(
      backgroundColor: SmColors.background,
      foregroundColor: SmColors.foreground,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: SmColors.border,
      titleTextStyle: const TextStyle(fontFamily: 'Poppins', 
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: SmColors.foreground,
      ),
    ),
    cardTheme: CardThemeData(
      color: SmColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: SmColors.border, width: 1),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: SmColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontFamily: 'Poppins', 
            fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: SmColors.primary,
        side: const BorderSide(color: SmColors.border),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontFamily: 'Poppins', 
            fontSize: 14, fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: SmColors.primary,
        textStyle: const TextStyle(fontFamily: 'Poppins', 
            fontSize: 14, fontWeight: FontWeight.w500),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: SmColors.background,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: SmColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: SmColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: SmColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: SmColors.destructive),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      hintStyle:
          TextStyle(fontFamily: 'Poppins', fontSize: 14, color: SmColors.mutedForeground),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? SmColors.primary
              : Colors.transparent),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      side: const BorderSide(color: SmColors.border, width: 1.5),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? Colors.white
              : SmColors.mutedForeground),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? SmColors.primary
              : SmColors.muted),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: SmColors.primary,
      inactiveTrackColor: SmColors.border,
      thumbColor: SmColors.primary,
      overlayColor: SmColors.primary.withOpacity(0.1),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: SmColors.primary,
      linearTrackColor: SmColors.border,
    ),
    dividerTheme: const DividerThemeData(
      color: SmColors.border,
      thickness: 1,
      space: 1,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: SmColors.background,
      indicatorColor: SmColors.primary.withOpacity(0.12),
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? SmColors.primary
                : SmColors.mutedForeground,
            size: 22,
          )),
      labelTextStyle: WidgetStateProperty.resolveWith((states) =>
          TextStyle(fontFamily: 'Poppins', 
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.normal,
            color: states.contains(WidgetState.selected)
                ? SmColors.primary
                : SmColors.mutedForeground,
          )),
      elevation: 0,
      shadowColor: Colors.transparent,
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: SmColors.primary,
      unselectedLabelColor: SmColors.mutedForeground,
      indicatorColor: SmColors.primary,
      labelStyle: const TextStyle(fontFamily: 'Poppins', 
          fontSize: 14, fontWeight: FontWeight.w600),
      unselectedLabelStyle:
          const TextStyle(fontFamily: 'Poppins', fontSize: 14),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: SmColors.muted,
      selectedColor: SmColors.primary.withOpacity(0.1),
      labelStyle: const TextStyle(fontFamily: 'Poppins', fontSize: 12),
      side: const BorderSide(color: SmColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: SmColors.foreground,
        borderRadius: BorderRadius.circular(6),
      ),
      textStyle: const TextStyle(fontFamily: 'Poppins', fontSize: 12, color: Colors.white),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: SmColors.card,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16)),
      titleTextStyle: TextStyle(fontFamily: 'Poppins', 
        fontSize: 18,
        fontWeight: FontWeight.bold,
        color: SmColors.foreground,
      ),
      contentTextStyle: TextStyle(fontFamily: 'Poppins', 
        fontSize: 14,
        color: SmColors.mutedForeground,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    extensions: const [SmColorExtension.light],
  );
}

// ─────────────────────────────────────────
// DARK THEME
// ─────────────────────────────────────────
ThemeData sportMapsDarkTheme() {
  final colorScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: SmColors.darkPrimary,
    onPrimary: Colors.white,
    primaryContainer: SmColors.primary.withOpacity(0.2),
    onPrimaryContainer: SmColors.primaryGlow,
    secondary: SmColors.darkMuted,
    onSecondary: Colors.white,
    secondaryContainer: SmColors.darkMuted,
    onSecondaryContainer: Colors.white70,
    tertiary: SmColors.accent,
    onTertiary: Colors.white,
    tertiaryContainer: SmColors.accentDark.withOpacity(0.2),
    onTertiaryContainer: SmColors.accentLight,
    error: SmColors.destructive,
    onError: Colors.white,
    errorContainer: const Color(0xFF7F1D1D),
    onErrorContainer: const Color(0xFFFECACA),
    surface: SmColors.darkBackground,
    onSurface: Colors.white,
    surfaceContainerLowest: SmColors.darkCard,
    surfaceContainerLow: SmColors.darkMuted,
    surfaceContainer: const Color(0xFF1E3A1E),
    surfaceContainerHigh: const Color(0xFF244824),
    surfaceContainerHighest: SmColors.darkBorder,
    onSurfaceVariant: SmColors.darkMutedForeground,
    outline: SmColors.darkBorder,
    outlineVariant: SmColors.darkBorder.withOpacity(0.5),
    shadow: Colors.black.withOpacity(0.3),
    inverseSurface: Colors.white,
    onInverseSurface: SmColors.foreground,
    inversePrimary: SmColors.primary,
    scrim: Colors.black87,
  );

  return sportMapsLightTheme().copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: SmColors.darkBackground,
    textTheme: _buildTextTheme(Colors.white),
    appBarTheme: AppBarTheme(
      backgroundColor: SmColors.darkCard,
      foregroundColor: Colors.white,
      elevation: 0,
      titleTextStyle: const TextStyle(fontFamily: 'Poppins', 
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: Colors.white,
      ),
    ),
    cardTheme: CardThemeData(
      color: SmColors.darkCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: SmColors.darkBorder, width: 1),
      ),
    ),
    extensions: const [SmColorExtension.dark],
  );
}

// ─────────────────────────────────────────
// TEXT THEME — Poppins
// ─────────────────────────────────────────
TextTheme _buildTextTheme(Color baseColor) {
  return ThemeData.light().textTheme.copyWith(
    // Display — H1 hero (≈72px)
    displayLarge: TextStyle(fontFamily: 'Poppins', 
        fontSize: 72, fontWeight: FontWeight.bold, color: baseColor),
    displayMedium: TextStyle(fontFamily: 'Poppins', 
        fontSize: 57, fontWeight: FontWeight.bold, color: baseColor),
    displaySmall: TextStyle(fontFamily: 'Poppins', 
        fontSize: 45, fontWeight: FontWeight.bold, color: baseColor),
    // Headline — H2 secciones (≈30px)
    headlineLarge: TextStyle(fontFamily: 'Poppins', 
        fontSize: 36, fontWeight: FontWeight.bold, color: baseColor),
    headlineMedium: TextStyle(fontFamily: 'Poppins', 
        fontSize: 30, fontWeight: FontWeight.bold, color: baseColor),
    headlineSmall: TextStyle(fontFamily: 'Poppins', 
        fontSize: 24, fontWeight: FontWeight.bold, color: baseColor),
    // Title — H3 cards (≈20px)
    titleLarge: TextStyle(fontFamily: 'Poppins', 
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: baseColor),
    titleMedium: TextStyle(fontFamily: 'Poppins', 
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: baseColor),
    titleSmall: TextStyle(fontFamily: 'Poppins', 
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: baseColor),
    // Body — párrafos (≈16px)
    bodyLarge: TextStyle(fontFamily: 'Poppins', 
        fontSize: 16, color: baseColor),
    bodyMedium: TextStyle(fontFamily: 'Poppins', 
        fontSize: 14, color: baseColor),
    bodySmall: TextStyle(fontFamily: 'Poppins', 
        fontSize: 12, color: baseColor.withOpacity(0.7)),
    // Label — botones, badges (≈14px, ≈10px)
    labelLarge: TextStyle(fontFamily: 'Poppins', 
        fontSize: 14, fontWeight: FontWeight.w500, color: baseColor),
    labelMedium: TextStyle(fontFamily: 'Poppins', 
        fontSize: 12, fontWeight: FontWeight.w500, color: baseColor),
    labelSmall: TextStyle(fontFamily: 'Poppins', 
        fontSize: 10, fontWeight: FontWeight.w500, color: baseColor),
  );
}

// ─────────────────────────────────────────
// EXTENSION — colores extra no en ColorScheme
// ─────────────────────────────────────────
@immutable
class SmColorExtension extends ThemeExtension<SmColorExtension> {
  final Color accentOrange;
  final Color accentOrangeLight;
  final Color accentOrangeDark;
  final Color brandGradientStart;
  final Color brandGradientEnd;

  const SmColorExtension({
    required this.accentOrange,
    required this.accentOrangeLight,
    required this.accentOrangeDark,
    required this.brandGradientStart,
    required this.brandGradientEnd,
  });

  static const light = SmColorExtension(
    accentOrange: SmColors.accent,
    accentOrangeLight: SmColors.accentLight,
    accentOrangeDark: SmColors.accentDark,
    brandGradientStart: SmColors.primary,
    brandGradientEnd: SmColors.accent,
  );

  static const dark = SmColorExtension(
    accentOrange: SmColors.accent,
    accentOrangeLight: SmColors.accentLight,
    accentOrangeDark: SmColors.accentDark,
    brandGradientStart: SmColors.darkPrimary,
    brandGradientEnd: SmColors.accent,
  );

  @override
  SmColorExtension copyWith({
    Color? accentOrange,
    Color? accentOrangeLight,
    Color? accentOrangeDark,
    Color? brandGradientStart,
    Color? brandGradientEnd,
  }) =>
      SmColorExtension(
        accentOrange: accentOrange ?? this.accentOrange,
        accentOrangeLight: accentOrangeLight ?? this.accentOrangeLight,
        accentOrangeDark: accentOrangeDark ?? this.accentOrangeDark,
        brandGradientStart: brandGradientStart ?? this.brandGradientStart,
        brandGradientEnd: brandGradientEnd ?? this.brandGradientEnd,
      );

  @override
  SmColorExtension lerp(SmColorExtension? other, double t) {
    if (other == null) return this;
    return SmColorExtension(
      accentOrange: Color.lerp(accentOrange, other.accentOrange, t)!,
      accentOrangeLight:
          Color.lerp(accentOrangeLight, other.accentOrangeLight, t)!,
      accentOrangeDark:
          Color.lerp(accentOrangeDark, other.accentOrangeDark, t)!,
      brandGradientStart:
          Color.lerp(brandGradientStart, other.brandGradientStart, t)!,
      brandGradientEnd:
          Color.lerp(brandGradientEnd, other.brandGradientEnd, t)!,
    );
  }

  // Acceso fácil desde el contexto
  static SmColorExtension of(BuildContext context) =>
      Theme.of(context).extension<SmColorExtension>()!;
}

// ─────────────────────────────────────────
// GRADIENTES reutilizables
// ─────────────────────────────────────────
class SmGradients {
  SmGradients._();

  static const brand = LinearGradient(
    colors: [SmColors.primary, SmColors.accent],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const heroBackground = LinearGradient(
    colors: [Color(0xFF0A1F0A), Color(0xFF164016), Color(0xFF0A1F0A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const greenFade = LinearGradient(
    colors: [Color(0xFF248223), Colors.transparent],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}
