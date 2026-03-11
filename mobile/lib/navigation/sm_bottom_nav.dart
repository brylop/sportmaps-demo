// ============================================================
// SportMaps — MobileBottomNav role-based
// Reemplaza: MobileBottomNav.tsx (role-based tabs)
// ============================================================

import 'package:flutter/material.dart';

import '../navigation/sm_router_v2.dart';
import '../providers/auth_provider.dart';

// ─────────────────────────────────────────
// MODELO de destino
// ─────────────────────────────────────────
class SmNavDestination {
  final String route;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String? badge;

  const SmNavDestination({
    required this.route,
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.badge,
  });
}

// ─────────────────────────────────────────
// CONFIGURACIÓN DE TABS POR ROL
// Reemplaza: config/navigation.ts getBottomNavForRole()
// ─────────────────────────────────────────
class SmNavConfig {
  SmNavConfig._();

  static List<SmNavDestination> forRole(SmUserRole role) {
    return switch (role) {
      SmUserRole.admin || SmUserRole.superAdmin => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.dashboard_outlined,
            selectedIcon: Icons.dashboard,
            label: 'Panel',
          ),
          SmNavDestination(
            route: SmRoutes.schools,
            icon: Icons.school_outlined,
            selectedIcon: Icons.school,
            label: 'Escuelas',
          ),
          SmNavDestination(
            route: SmRoutes.users,
            icon: Icons.people_outline,
            selectedIcon: Icons.people,
            label: 'Usuarios',
          ),
          SmNavDestination(
            route: SmRoutes.finance,
            icon: Icons.attach_money_outlined,
            selectedIcon: Icons.attach_money,
            label: 'Finanzas',
          ),
          SmNavDestination(
            route: SmRoutes.settings,
            icon: Icons.settings_outlined,
            selectedIcon: Icons.settings,
            label: 'Config',
          ),
        ],
      SmUserRole.coach => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.dashboard_outlined,
            selectedIcon: Icons.dashboard,
            label: 'Inicio',
          ),
          SmNavDestination(
            route: SmRoutes.teams,
            icon: Icons.groups_outlined,
            selectedIcon: Icons.groups,
            label: 'Equipos',
          ),
          SmNavDestination(
            route: SmRoutes.attendance,
            icon: Icons.fact_check_outlined,
            selectedIcon: Icons.fact_check,
            label: 'Asistencia',
          ),
          SmNavDestination(
            route: SmRoutes.performance,
            icon: Icons.bar_chart_outlined,
            selectedIcon: Icons.bar_chart,
            label: 'Stats',
          ),
          SmNavDestination(
            route: SmRoutes.messages,
            icon: Icons.chat_bubble_outline,
            selectedIcon: Icons.chat_bubble,
            label: 'Mensajes',
          ),
        ],
      SmUserRole.parent => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.home_outlined,
            selectedIcon: Icons.home,
            label: 'Inicio',
          ),
          SmNavDestination(
            route: SmRoutes.children,
            icon: Icons.child_care_outlined,
            selectedIcon: Icons.child_care,
            label: 'Mis hijos',
          ),
          SmNavDestination(
            route: SmRoutes.events,
            icon: Icons.event_outlined,
            selectedIcon: Icons.event,
            label: 'Eventos',
          ),
          SmNavDestination(
            route: SmRoutes.finance,
            icon: Icons.receipt_long_outlined,
            selectedIcon: Icons.receipt_long,
            label: 'Pagos',
          ),
          SmNavDestination(
            route: SmRoutes.messages,
            icon: Icons.chat_bubble_outline,
            selectedIcon: Icons.chat_bubble,
            label: 'Mensajes',
          ),
        ],
      SmUserRole.student => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.home_outlined,
            selectedIcon: Icons.home,
            label: 'Inicio',
          ),
          SmNavDestination(
            route: SmRoutes.performance,
            icon: Icons.trending_up_outlined,
            selectedIcon: Icons.trending_up,
            label: 'Mi progreso',
          ),
          SmNavDestination(
            route: SmRoutes.events,
            icon: Icons.event_outlined,
            selectedIcon: Icons.event,
            label: 'Eventos',
          ),
          SmNavDestination(
            route: SmRoutes.explore,
            icon: Icons.explore_outlined,
            selectedIcon: Icons.explore,
            label: 'Explorar',
          ),
          SmNavDestination(
            route: SmRoutes.profile,
            icon: Icons.person_outline,
            selectedIcon: Icons.person,
            label: 'Perfil',
          ),
        ],
      SmUserRole.schoolAdmin => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.dashboard_outlined,
            selectedIcon: Icons.dashboard,
            label: 'Panel',
          ),
          SmNavDestination(
            route: SmRoutes.teams,
            icon: Icons.groups_outlined,
            selectedIcon: Icons.groups,
            label: 'Equipos',
          ),
          SmNavDestination(
            route: SmRoutes.finance,
            icon: Icons.attach_money_outlined,
            selectedIcon: Icons.attach_money,
            label: 'Finanzas',
          ),
          SmNavDestination(
            route: SmRoutes.events,
            icon: Icons.event_outlined,
            selectedIcon: Icons.event,
            label: 'Eventos',
          ),
          SmNavDestination(
            route: SmRoutes.settings,
            icon: Icons.settings_outlined,
            selectedIcon: Icons.settings,
            label: 'Config',
          ),
        ],
      _ => const [
          SmNavDestination(
            route: SmRoutes.dashboard,
            icon: Icons.home_outlined,
            selectedIcon: Icons.home,
            label: 'Inicio',
          ),
          SmNavDestination(
            route: SmRoutes.explore,
            icon: Icons.explore_outlined,
            selectedIcon: Icons.explore,
            label: 'Explorar',
          ),
          SmNavDestination(
            route: SmRoutes.profile,
            icon: Icons.person_outline,
            selectedIcon: Icons.person,
            label: 'Perfil',
          ),
        ],
    };
  }
}

// ─────────────────────────────────────────
// WIDGET: Bottom Nav role-based con badge
// ─────────────────────────────────────────

/// Bottom navigation bar que adapta sus tabs según el rol del usuario.
/// Reemplazo directo de `MobileBottomNav.tsx`.
///
/// ```dart
/// SmRoleBottomNav(
///   role: SmUserRole.coach,
///   currentLocation: '/dashboard',
///   onDestinationSelected: (route) => context.go(route),
/// )
/// ```
class SmRoleBottomNav extends StatelessWidget {
  final SmUserRole role;
  final String currentLocation;
  final void Function(String route) onDestinationSelected;

  const SmRoleBottomNav({
    super.key,
    required this.role,
    required this.currentLocation,
    required this.onDestinationSelected,
  });

  int _currentIndex(List<SmNavDestination> destinations) {
    // Buscar la ruta que mejor match haga con la ubicación actual
    final idx = destinations.indexWhere(
        (d) => currentLocation.startsWith(d.route) && d.route != '/');
    if (idx != -1) {
      return idx;
    }
    // Fallback: dashboard
    if (currentLocation == SmRoutes.dashboard || currentLocation == '/') {
      return destinations
          .indexWhere((d) => d.route == SmRoutes.dashboard)
          .clamp(0, destinations.length - 1);
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final destinations = SmNavConfig.forRole(role);
    final current = _currentIndex(destinations);

    return NavigationBar(
      selectedIndex: current.clamp(0, destinations.length - 1),
      onDestinationSelected: (i) =>
          onDestinationSelected(destinations[i].route),
      height: 64, // Mínimo 48dp por ítem (accesibilidad)
      elevation: 0,
      destinations: destinations.map((dest) {
        Widget iconWidget = Icon(dest.icon);
        Widget selectedIconWidget = Icon(dest.selectedIcon);

        // Badge naranja si hay notification count
        if (dest.badge != null) {
          iconWidget = Badge(
            label: Text(dest.badge!),
            backgroundColor: const Color(0xFFFB9F1E),
            child: iconWidget,
          );
          selectedIconWidget = Badge(
            label: Text(dest.badge!),
            backgroundColor: const Color(0xFFFB9F1E),
            child: selectedIconWidget,
          );
        }

        return NavigationDestination(
          icon: iconWidget,
          selectedIcon: selectedIconWidget,
          label: dest.label,
          tooltip: dest.label,
        );
      }).toList(),
    );
  }
}
