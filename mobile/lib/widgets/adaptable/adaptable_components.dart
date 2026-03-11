// ============================================================
// SportMaps — Componentes ⚠️ ADAPTABLES
//
// Componentes:
//   1. SmButton (9 variantes)    — reemplaza shadcn/ui Button
//   2. SmCarousel<T>             — reemplaza embla-carousel
//   3. SmInvitationBanner        — reemplaza InvitationBanner.tsx
//   4. SmProfileCompletionBanner — reemplaza ProfileCompletionBanner.tsx
//   5. SmDynamicThemeProvider    — reemplaza ThemeContext (multitenant)
//   6. SmNotificationBell        — reemplaza GlobalNotificationBell.tsx
//   7. SmBreadcrumb              — custom (no existe nativo en Flutter)
//   8. SmConnectivityBanner      — feature nueva (auditoría: estado faltante)
// ============================================================

import 'package:flutter/material.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// 1. BUTTON VARIANTS
//    default | destructive | outline | secondary | ghost
//    link | hero | orange | performance
// ─────────────────────────────────────────

enum SmButtonVariant {
  primary,
  destructive,
  outline,
  secondary,
  ghost,
  link,
  hero,
  orange,
  performance,
}

/// Botón multi-variante con loading state, icono opcional, y fullWidth.
///
/// ```dart
/// SmButton(label: 'Guardar', onPressed: () {})
/// SmButton(label: 'Eliminar', variant: SmButtonVariant.destructive)
/// SmButton(label: 'Iniciar', variant: SmButtonVariant.hero, icon: Icons.play_arrow)
/// SmButton(label: 'Ver todo', variant: SmButtonVariant.link)
/// ```
class SmButton extends StatelessWidget {
  final String label;
  final SmButtonVariant variant;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool fullWidth;
  final double? width;

  const SmButton({
    super.key,
    required this.label,
    this.variant = SmButtonVariant.primary,
    this.onPressed,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    Widget child = loading
        ? const SizedBox(
            width: 18,
            height: 18,
            child:
                CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16),
                const SizedBox(width: 8),
              ],
              Text(label),
            ],
          );

    Widget button = switch (variant) {
      SmButtonVariant.primary => _primaryBtn(child),
      SmButtonVariant.destructive => _destructiveBtn(child),
      SmButtonVariant.outline => _outlineBtn(child),
      SmButtonVariant.secondary => _secondaryBtn(child),
      SmButtonVariant.ghost => _ghostBtn(child),
      SmButtonVariant.link => _linkBtn(child),
      SmButtonVariant.hero => _heroBtn(child),
      SmButtonVariant.orange => _orangeBtn(child),
      SmButtonVariant.performance => _performanceBtn(child),
    };

    if (fullWidth || width != null) {
      return SizedBox(
          width: fullWidth ? double.infinity : width, child: button);
    }
    return button;
  }

  // ── Variantes ──

  Widget _primaryBtn(Widget c) => ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: SmColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: c,
      );

  Widget _destructiveBtn(Widget c) => ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: SmColors.destructive,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: c,
      );

  Widget _outlineBtn(Widget c) => OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: SmColors.primary,
          side: const BorderSide(color: SmColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: c,
      );

  Widget _secondaryBtn(Widget c) => ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: SmColors.secondary,
          foregroundColor: SmColors.primary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: c,
      );

  Widget _ghostBtn(Widget c) => TextButton(
        onPressed: loading ? null : onPressed,
        style: TextButton.styleFrom(
          foregroundColor: SmColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: c,
      );

  Widget _linkBtn(Widget c) => TextButton(
        onPressed: loading ? null : onPressed,
        style: TextButton.styleFrom(
          foregroundColor: SmColors.primary,
          padding: EdgeInsets.zero,
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          textStyle: const TextStyle(decoration: TextDecoration.underline),
        ),
        child: c,
      );

  Widget _heroBtn(Widget c) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: SmGradients.brand,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: SmColors.primary.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: loading ? null : onPressed,
            borderRadius: BorderRadius.circular(8),
            splashColor: Colors.white24,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              child: DefaultTextStyle(
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15),
                child: c,
              ),
            ),
          ),
        ),
      );

  Widget _orangeBtn(Widget c) => DecoratedBox(
        decoration: BoxDecoration(
          color: SmColors.accent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: SmColors.accent.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: loading ? null : onPressed,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: DefaultTextStyle(
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14),
                child: c,
              ),
            ),
          ),
        ),
      );

  Widget _performanceBtn(Widget c) => DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF0A1F0A),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: SmColors.primary, width: 1.5),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: loading ? null : onPressed,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: DefaultTextStyle(
                style: const TextStyle(
                    color: SmColors.primaryGlow,
                    fontWeight: FontWeight.bold,
                    fontSize: 14),
                child: c,
              ),
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────
// 2. CAROUSEL genérico (reemplaza embla-carousel)
// ─────────────────────────────────────────

/// Carrusel horizontal con dots animados y soporte autoPlay.
///
/// ```dart
/// SmCarousel(
///   items: images,
///   itemBuilder: (ctx, url, i) => Image.network(url, fit: BoxFit.cover),
/// )
/// ```
class SmCarousel<T> extends StatefulWidget {
  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final double height;
  final bool autoPlay;
  final Duration autoPlayInterval;

  const SmCarousel({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.height = 220,
    this.autoPlay = false,
    this.autoPlayInterval = const Duration(seconds: 4),
  });

  @override
  State<SmCarousel<T>> createState() => _SmCarouselState<T>();
}

class _SmCarouselState<T> extends State<SmCarousel<T>> {
  final _controller = PageController(viewportFraction: 0.9);
  int _current = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: widget.height,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.items.length,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (ctx, i) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: widget.itemBuilder(ctx, widget.items[i], i),
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Dots indicator
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.items.length, (i) {
            final isActive = i == _current;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: isActive ? 20 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: isActive ? SmColors.primary : SmColors.border,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 3. INVITATION BANNER (reemplaza InvitationBanner.tsx)
// ─────────────────────────────────────────

/// Banner animado (slide-in + dismiss) para invitaciones.
///
/// ```dart
/// SmInvitationBanner(
///   schoolName: 'Club Deportivo Norte',
///   inviterName: 'Carlos García',
///   role: 'Entrenador',
///   onAccept: () => acceptInvite(),
///   onDecline: () => declineInvite(),
/// )
/// ```
class SmInvitationBanner extends StatefulWidget {
  final String schoolName;
  final String inviterName;
  final String role;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const SmInvitationBanner({
    super.key,
    required this.schoolName,
    required this.inviterName,
    required this.role,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  State<SmInvitationBanner> createState() => _SmInvitationBannerState();
}

class _SmInvitationBannerState extends State<SmInvitationBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Offset> _slide;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _slide = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _dismiss() async {
    await _ctrl.reverse();
    if (mounted) {
      setState(() => _dismissed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed) {
      return const SizedBox.shrink();
    }

    return SlideTransition(
      position: _slide,
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF0A1F0A), Color(0xFF164016)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: SmColors.primary.withValues(alpha: 0.4), width: 1),
          boxShadow: [
            BoxShadow(
              color: SmColors.primary.withValues(alpha: 0.2),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: SmColors.accent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.mail_outline,
                      color: SmColors.accent, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '¡Tienes una invitación!',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${widget.inviterName} te invita a ${widget.schoolName}',
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon:
                      const Icon(Icons.close, color: Colors.white54, size: 16),
                  onPressed: _dismiss,
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Rol asignado: ${widget.role}',
              style: const TextStyle(color: SmColors.primaryGlow, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SmButton(
                    label: 'Aceptar',
                    variant: SmButtonVariant.hero,
                    onPressed: () {
                      _dismiss();
                      widget.onAccept();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SmButton(
                    label: 'Rechazar',
                    variant: SmButtonVariant.outline,
                    onPressed: () {
                      _dismiss();
                      widget.onDecline();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 4. PROFILE COMPLETION BANNER
// ─────────────────────────────────────────

/// Banner con barra de progreso adaptativa y items pendientes.
///
/// ```dart
/// SmProfileCompletionBanner(
///   completionPercent: 65,
///   pendingItems: ['Agregar foto', 'Verificar email'],
///   onCompleteProfile: () => context.push('/profile/edit'),
/// )
/// ```
class SmProfileCompletionBanner extends StatelessWidget {
  final int completionPercent;
  final List<String> pendingItems;
  final VoidCallback onCompleteProfile;

  const SmProfileCompletionBanner({
    super.key,
    required this.completionPercent,
    required this.pendingItems,
    required this.onCompleteProfile,
  });

  Color get _progressColor {
    if (completionPercent >= 80) {
      return SmColors.primary;
    }
    if (completionPercent >= 50) {
      return SmColors.accent;
    }
    return SmColors.destructive;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.person_outline,
                    color: SmColors.primary, size: 20),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text('Completa tu perfil',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
                Text(
                  '$completionPercent%',
                  style: TextStyle(
                    color: _progressColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: completionPercent / 100,
                minHeight: 6,
                backgroundColor: SmColors.border,
                valueColor: AlwaysStoppedAnimation(_progressColor),
              ),
            ),
            if (pendingItems.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...pendingItems.take(2).map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.radio_button_unchecked,
                            size: 12, color: SmColors.mutedForeground),
                        const SizedBox(width: 6),
                        Text(item,
                            style: const TextStyle(
                                fontSize: 12, color: SmColors.mutedForeground)),
                      ],
                    ),
                  )),
            ],
            const SizedBox(height: 12),
            SmButton(
              label: 'Completar ahora',
              variant: SmButtonVariant.outline,
              fullWidth: true,
              onPressed: onCompleteProfile,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 5. DYNAMIC BRANDING THEME PROVIDER
//    → Feature multitenant más competitiva
// ─────────────────────────────────────────

/// Configuración de branding por escuela.
class SmBrandingConfig {
  final String primaryHex;
  final String? secondaryHex;
  final String? logoUrl;
  final String schoolName;

  const SmBrandingConfig({
    required this.primaryHex,
    this.secondaryHex,
    this.logoUrl,
    required this.schoolName,
  });

  Color get primaryColor => _hexToColor(primaryHex);
  Color get secondaryColor => _hexToColor(secondaryHex ?? '#FB9F1E');

  static Color _hexToColor(String hex) {
    final sanitized = hex.replaceAll('#', '');
    return Color(int.parse('FF$sanitized', radix: 16));
  }
}

/// Provider que aplica branding dinámico (colores por escuela).
/// Se actualiza con `context.updateSchoolBranding(config)`.
///
/// ```dart
/// SmDynamicThemeProvider(
///   branding: SmBrandingConfig(
///     primaryHex: '#2E7D32',
///     schoolName: 'Club Norte',
///   ),
///   child: MaterialApp.router(...),
/// )
/// ```
class SmDynamicThemeProvider extends StatefulWidget {
  final Widget child;
  final SmBrandingConfig? branding;

  const SmDynamicThemeProvider({
    super.key,
    required this.child,
    this.branding,
  });

  @override
  State<SmDynamicThemeProvider> createState() => SmDynamicThemeProviderState();

  static SmDynamicThemeProviderState? of(BuildContext context) =>
      context.findAncestorStateOfType<SmDynamicThemeProviderState>();
}

class SmDynamicThemeProviderState extends State<SmDynamicThemeProvider> {
  SmBrandingConfig? _branding;

  @override
  void initState() {
    super.initState();
    _branding = widget.branding;
  }

  void updateBranding(SmBrandingConfig config) {
    setState(() => _branding = config);
  }

  ThemeData _buildDynamicTheme() {
    final primary = _branding?.primaryColor ?? SmColors.primary;
    final secondary = _branding?.secondaryColor ?? SmColors.accent;

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        tertiary: secondary,
        brightness: Brightness.light,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _SmBrandingScope(
      branding: _branding,
      child: Theme(
        data: _buildDynamicTheme(),
        child: widget.child,
      ),
    );
  }
}

// InheritedWidget para acceder al branding desde cualquier widget
class _SmBrandingScope extends InheritedWidget {
  final SmBrandingConfig? branding;

  const _SmBrandingScope({required this.branding, required super.child});

  static SmBrandingConfig? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_SmBrandingScope>()?.branding;

  @override
  bool updateShouldNotify(_SmBrandingScope old) => branding != old.branding;
}

/// Extension para acceder / actualizar el branding desde cualquier widget.
extension SmBrandingContext on BuildContext {
  SmBrandingConfig? get schoolBranding => _SmBrandingScope.of(this);

  void updateSchoolBranding(SmBrandingConfig config) =>
      SmDynamicThemeProvider.of(this)?.updateBranding(config);
}

// ─────────────────────────────────────────
// 6. GLOBAL NOTIFICATION BELL
// ─────────────────────────────────────────

/// Campana con badge naranja para notificaciones.
///
/// ```dart
/// SmNotificationBell(
///   unreadCount: 5,
///   onTap: () => context.push('/notifications'),
/// )
/// ```
class SmNotificationBell extends StatelessWidget {
  final int unreadCount;
  final VoidCallback onTap;

  const SmNotificationBell({
    super.key,
    required this.unreadCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          icon: Icon(
            unreadCount > 0
                ? Icons.notifications
                : Icons.notifications_outlined,
            color: unreadCount > 0 ? SmColors.primary : null,
          ),
          onPressed: onTap,
          tooltip: 'Notificaciones',
        ),
        if (unreadCount > 0)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                color: SmColors.accent,
                shape: BoxShape.circle,
              ),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 7. BREADCRUMB
//    Resuelve el problema de 4 niveles sin contexto
// ─────────────────────────────────────────

class SmBreadcrumbItem {
  final String label;
  final String? route;
  const SmBreadcrumbItem({required this.label, this.route});
}

/// Breadcrumb horizontal con separadores chevron.
///
/// ```dart
/// SmBreadcrumb(
///   items: [
///     SmBreadcrumbItem(label: 'Equipos', route: '/teams'),
///     SmBreadcrumbItem(label: 'Sub-17', route: '/teams/123'),
///     SmBreadcrumbItem(label: 'Plantilla'),
///   ],
///   onNavigate: (route) => context.go(route),
/// )
/// ```
class SmBreadcrumb extends StatelessWidget {
  final List<SmBreadcrumbItem> items;
  final void Function(String route)? onNavigate;

  const SmBreadcrumb({
    super.key,
    required this.items,
    this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: items.asMap().entries.expand((entry) {
          final i = entry.key;
          final item = entry.value;
          final isLast = i == items.length - 1;

          return [
            if (isLast)
              Text(
                item.label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: SmColors.foreground,
                ),
              )
            else
              InkWell(
                onTap: item.route != null && onNavigate != null
                    ? () => onNavigate!(item.route!)
                    : null,
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text(
                    item.label,
                    style: const TextStyle(
                        fontSize: 13, color: SmColors.mutedForeground),
                  ),
                ),
              ),
            if (!isLast)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Icon(Icons.chevron_right,
                    size: 14, color: SmColors.mutedForeground),
              ),
          ];
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 8. CONNECTIVITY BANNER — Banner offline animado
//    (Feature faltante crítica identificada en auditoría)
// ─────────────────────────────────────────

/// Wrapper que muestra un banner naranja cuando se pierde conectividad.
/// Usa `connectivity_plus` internamente. Envuelve tu `MaterialApp`.
///
/// ```dart
/// SmConnectivityBanner(
///   child: MaterialApp.router(routerConfig: router),
/// )
/// ```
class SmConnectivityBanner extends StatefulWidget {
  final Widget child;

  const SmConnectivityBanner({super.key, required this.child});

  @override
  State<SmConnectivityBanner> createState() => _SmConnectivityBannerState();
}

class _SmConnectivityBannerState extends State<SmConnectivityBanner>
    with SingleTickerProviderStateMixin {
  bool _isOffline = false;
  late AnimationController _ctrl;
  late Animation<double> _heightAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _heightAnim = Tween<double>(begin: 0, end: 40)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    // TODO: Conectar connectivity_plus en implementación real:
    // Connectivity().onConnectivityChanged.listen((result) {
    //   _handleOffline(result == ConnectivityResult.none);
    // });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // ignore: unused_element
  void _handleOffline(bool offline) {
    setState(() => _isOffline = offline);
    offline ? _ctrl.forward() : _ctrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _heightAnim,
          builder: (_, __) => SizedBox(
            height: _heightAnim.value,
            child: _isOffline
                ? Container(
                    color: SmColors.accent,
                    alignment: Alignment.center,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.wifi_off, color: Colors.white, size: 14),
                        SizedBox(width: 6),
                        Text(
                          'Sin conexión — algunos datos pueden no estar actualizados',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ),
        Expanded(child: widget.child),
      ],
    );
  }
}
