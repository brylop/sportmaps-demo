// ============================================================
// SportMaps — Platform Adaptive Layer
// Detección de plataforma + widgets adaptativos iOS/Android/Web
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

// ─────────────────────────────────────────
// DETECTOR DE PLATAFORMA
// ─────────────────────────────────────────
class SmPlatform {
  SmPlatform._();

  static bool get isWeb => kIsWeb;
  static bool get isIOS => !kIsWeb && Platform.isIOS;
  static bool get isAndroid => !kIsWeb && Platform.isAndroid;
  static bool get isMobile => isIOS || isAndroid;
  static bool get isDesktopWeb => kIsWeb;

  /// Ancho actual del contexto
  static bool isWide(BuildContext ctx) => MediaQuery.sizeOf(ctx).width >= 768;
  static bool isTablet(BuildContext ctx) {
    final w = MediaQuery.sizeOf(ctx).width;
    return w >= 600 && w < 1024;
  }

  static bool isDesktopLayout(BuildContext ctx) =>
      MediaQuery.sizeOf(ctx).width >= 1024;

  /// Devuelve valor según plataforma
  static T adaptive<T>({
    required T ios,
    required T android,
    T? web,
  }) {
    if (isWeb) {
      return web ?? android;
    }
    if (isIOS) {
      return ios;
    }
    return android;
  }
}

// ─────────────────────────────────────────
// RESPONSIVE BREAKPOINTS
// ─────────────────────────────────────────
class SmBreakpoint {
  static const double mobile = 0;
  static const double tablet = 600;
  static const double desktop = 1024;
  static const double wide = 1400;
}

// ─────────────────────────────────────────
// RESPONSIVE BUILDER — maneja mobile/tablet/desktop
// ─────────────────────────────────────────
class SmResponsiveBuilder extends StatelessWidget {
  final Widget Function(BuildContext, BoxConstraints) mobile;
  final Widget Function(BuildContext, BoxConstraints)? tablet;
  final Widget Function(BuildContext, BoxConstraints)? desktop;

  const SmResponsiveBuilder({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        if (w >= SmBreakpoint.desktop && desktop != null) {
          return desktop!(ctx, constraints);
        }
        if (w >= SmBreakpoint.tablet && tablet != null) {
          return tablet!(ctx, constraints);
        }
        return mobile(ctx, constraints);
      },
    );
  }
}

// ─────────────────────────────────────────
// ADAPTIVE SCAFFOLD — el corazón de la navegación
// Mobile: Scaffold + BottomNav
// Tablet: Scaffold + NavigationRail
// Desktop/Web: Row(Sidebar expandido + content)
// ─────────────────────────────────────────
class SmAdaptiveScaffold extends StatefulWidget {
  final List<SmNavDestinationDef> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final Widget body;
  final String title;
  final List<Widget>? appBarActions;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom; // TabBar, etc.

  const SmAdaptiveScaffold({
    super.key,
    required this.destinations,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.body,
    required this.title,
    this.appBarActions,
    this.floatingActionButton,
    this.bottom,
  });

  @override
  State<SmAdaptiveScaffold> createState() => _SmAdaptiveScaffoldState();
}

class SmNavDestinationDef {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const SmNavDestinationDef({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

class _SmAdaptiveScaffoldState extends State<SmAdaptiveScaffold> {
  bool _railExtended = true;

  @override
  Widget build(BuildContext context) {
    return SmResponsiveBuilder(
      // ── MOBILE: BottomNavigationBar ──────────────────────
      mobile: (ctx, _) => Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          actions: widget.appBarActions,
          bottom: widget.bottom,
        ),
        body: widget.body,
        floatingActionButton: widget.floatingActionButton,
        bottomNavigationBar: NavigationBar(
          selectedIndex: widget.selectedIndex,
          onDestinationSelected: widget.onDestinationSelected,
          height: 64,
          destinations: widget.destinations
              .map((d) => NavigationDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.selectedIcon),
                    label: d.label,
                  ))
              .toList(),
        ),
      ),

      // ── TABLET: NavigationRail ───────────────────────────
      tablet: (ctx, _) => Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          actions: widget.appBarActions,
          bottom: widget.bottom,
        ),
        floatingActionButton: widget.floatingActionButton,
        body: Row(
          children: [
            NavigationRail(
              extended: false,
              selectedIndex: widget.selectedIndex,
              onDestinationSelected: widget.onDestinationSelected,
              leading: const SizedBox(height: 8),
              destinations: widget.destinations
                  .map((d) => NavigationRailDestination(
                        icon: Icon(d.icon),
                        selectedIcon: Icon(d.selectedIcon),
                        label: Text(d.label),
                      ))
                  .toList(),
              indicatorColor: const Color(0xFF248223).withValues(alpha: 0.12),
              selectedIconTheme: const IconThemeData(color: Color(0xFF248223)),
              unselectedIconTheme:
                  const IconThemeData(color: Color(0xFF627D62)),
            ),
            const VerticalDivider(thickness: 1, width: 1),
            Expanded(child: widget.body),
          ],
        ),
      ),

      // ── DESKTOP / WEB: NavigationDrawer extendido ────────
      desktop: (ctx, _) => Scaffold(
        floatingActionButton: widget.floatingActionButton,
        body: Row(
          children: [
            // Sidebar colapsable
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              width: _railExtended ? 260 : 72,
              child: _DesktopSidebar(
                destinations: widget.destinations,
                selectedIndex: widget.selectedIndex,
                onDestinationSelected: widget.onDestinationSelected,
                extended: _railExtended,
                onToggle: () => setState(() => _railExtended = !_railExtended),
                title: widget.title,
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  // Top bar para web
                  _WebTopBar(
                    title: widget.title,
                    actions: widget.appBarActions,
                    bottom: widget.bottom,
                  ),
                  Expanded(child: widget.body),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Sidebar para desktop/web
class _DesktopSidebar extends StatelessWidget {
  final List<SmNavDestinationDef> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final bool extended;
  final VoidCallback onToggle;
  final String title;

  const _DesktopSidebar({
    required this.destinations,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.extended,
    required this.onToggle,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0A1F0A), Color(0xFF164016)],
        ),
      ),
      child: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: extended ? 16 : 8,
                vertical: 16,
              ),
              child: Row(
                mainAxisAlignment: extended
                    ? MainAxisAlignment.spaceBetween
                    : MainAxisAlignment.center,
                children: [
                  if (extended) ...[
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF248223), Color(0xFFFB9F1E)],
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.sports,
                              color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Text('SportMaps',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16)),
                      ],
                    ),
                  ],
                  IconButton(
                    icon: Icon(
                      extended ? Icons.menu_open : Icons.menu,
                      color: Colors.white70,
                      size: 20,
                    ),
                    onPressed: onToggle,
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.symmetric(
                horizontal: extended ? 8 : 4,
                vertical: 4,
              ),
              children: destinations.asMap().entries.map((e) {
                final i = e.key;
                final d = e.value;
                final isActive = i == selectedIndex;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: () => onDestinationSelected(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: EdgeInsets.symmetric(
                          horizontal: extended ? 14 : 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: isActive
                              ? const Color(0xFF248223).withValues(alpha: 0.2)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: isActive
                              ? Border.all(
                                  color: const Color(0xFF248223)
                                      .withValues(alpha: 0.4))
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: extended
                              ? MainAxisAlignment.start
                              : MainAxisAlignment.center,
                          children: [
                            Icon(
                              isActive ? d.selectedIcon : d.icon,
                              color: isActive
                                  ? const Color(0xFF3FA53D)
                                  : Colors.white60,
                              size: 20,
                            ),
                            if (extended) ...[
                              const SizedBox(width: 12),
                              Text(
                                d.label,
                                style: TextStyle(
                                  color:
                                      isActive ? Colors.white : Colors.white70,
                                  fontWeight: isActive
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// Top bar para web/desktop
class _WebTopBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;

  const _WebTopBar({required this.title, this.actions, this.bottom});

  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      title: Text(title),
      actions: actions,
      bottom: bottom,
      surfaceTintColor: Colors.transparent,
    );
  }
}
