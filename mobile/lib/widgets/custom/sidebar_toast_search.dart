// ============================================================
// SportMaps — Sidebar Colapsable + Toast + SearchCommand
//
// Componentes:
//   1. SmSidebar        — Sidebar role-based con colapso animado
//   2. SmToast          — Toast/Snackbar (reemplaza Sonner)
//   3. SmSearchCommand  — Barra de búsqueda global (reemplaza cmdk)
// ============================================================

import 'package:flutter/material.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// MODELOS
// ─────────────────────────────────────────

/// Modelo de item de navegación para el sidebar.
class SmNavItem {
  final IconData icon;
  final String label;
  final String route;
  final List<SmNavItem> children;
  final String? badgeCount;

  const SmNavItem({
    required this.icon,
    required this.label,
    required this.route,
    this.children = const [],
    this.badgeCount,
  });
}

// ─────────────────────────────────────────
// 1. SmSidebar — Sidebar colapsable
// ─────────────────────────────────────────

/// Sidebar con estado colapsado/expandido, avatar de usuario, y navegación
/// agrupada. Mapeo directo del `AppSidebar.tsx` de 23KB del frontend React.
///
/// ```dart
/// SmSidebar(
///   userName: 'Carlos García',
///   userRole: 'Entrenador',
///   currentRoute: '/dashboard',
///   onNavigate: (route) => context.go(route),
///   items: getNavItemsForRole(userRole),
/// )
/// ```
class SmSidebar extends StatefulWidget {
  final List<SmNavItem> items;
  final String currentRoute;
  final void Function(String route) onNavigate;
  final String userName;
  final String userRole;
  final String? avatarUrl;
  final bool initiallyCollapsed;
  final VoidCallback? onLogout;

  const SmSidebar({
    super.key,
    required this.items,
    required this.currentRoute,
    required this.onNavigate,
    required this.userName,
    required this.userRole,
    this.avatarUrl,
    this.initiallyCollapsed = false,
    this.onLogout,
  });

  @override
  State<SmSidebar> createState() => _SmSidebarState();
}

class _SmSidebarState extends State<SmSidebar>
    with SingleTickerProviderStateMixin {
  late bool _collapsed;
  late AnimationController _controller;
  late Animation<double> _widthAnim;
  String? _expandedGroup;

  static const double _expandedWidth = 260;
  static const double _collapsedWidth = 68;

  @override
  void initState() {
    super.initState();
    _collapsed = widget.initiallyCollapsed;
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
      value: _collapsed ? 0 : 1,
    );
    _widthAnim = Tween<double>(
      begin: _collapsedWidth,
      end: _expandedWidth,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _collapsed = !_collapsed);
    _collapsed ? _controller.reverse() : _controller.forward();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _widthAnim,
      builder: (_, __) => SizedBox(
        width: _widthAnim.value,
        child: Material(
          elevation: 0,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF0A1F0A), Color(0xFF164016)],
              ),
            ),
            child: Column(
              children: [
                // ── Header con logo y toggle ──
                SafeArea(
                  bottom: false,
                  child: _SidebarHeader(
                    collapsed: _collapsed,
                    onToggle: _toggle,
                  ),
                ),

                const SizedBox(height: 8),

                // ── Items de navegación ──
                Expanded(
                  child: ListView(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    children: widget.items.map((item) {
                      if (item.children.isNotEmpty) {
                        return _SidebarExpandableItem(
                          item: item,
                          collapsed: _collapsed,
                          currentRoute: widget.currentRoute,
                          isExpanded: _expandedGroup == item.route,
                          onExpand: () => setState(() {
                            _expandedGroup = _expandedGroup == item.route
                                ? null
                                : item.route;
                          }),
                          onNavigate: widget.onNavigate,
                        );
                      }
                      return _SidebarNavItem(
                        item: item,
                        collapsed: _collapsed,
                        isActive: widget.currentRoute.startsWith(item.route),
                        onTap: () => widget.onNavigate(item.route),
                      );
                    }).toList(),
                  ),
                ),

                // ── Footer con perfil ──
                _SidebarFooter(
                  collapsed: _collapsed,
                  userName: widget.userName,
                  userRole: widget.userRole,
                  avatarUrl: widget.avatarUrl,
                  onLogout: widget.onLogout,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets internos del sidebar ──

class _SidebarHeader extends StatelessWidget {
  final bool collapsed;
  final VoidCallback onToggle;

  const _SidebarHeader({required this.collapsed, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      child: Row(
        mainAxisAlignment: collapsed
            ? MainAxisAlignment.center
            : MainAxisAlignment.spaceBetween,
        children: [
          if (!collapsed) ...[
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: SmGradients.brand,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child:
                      const Icon(Icons.sports, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                const Text(
                  'SportMaps',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
          IconButton(
            onPressed: onToggle,
            icon: Icon(
              collapsed ? Icons.menu : Icons.menu_open,
              color: Colors.white70,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }
}

class _SidebarNavItem extends StatelessWidget {
  final SmNavItem item;
  final bool collapsed;
  final bool isActive;
  final VoidCallback onTap;

  const _SidebarNavItem({
    required this.item,
    required this.collapsed,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: EdgeInsets.symmetric(
              horizontal: collapsed ? 12 : 14,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: isActive
                  ? SmColors.primary.withValues(alpha: 0.2)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: isActive
                  ? Border.all(
                      color: SmColors.primary.withValues(alpha: 0.4),
                      width: 1,
                    )
                  : null,
            ),
            child: Row(
              mainAxisAlignment: collapsed
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Icon(
                  item.icon,
                  color: isActive
                      ? SmColors.primaryGlow
                      : Colors.white.withValues(alpha: 0.7),
                  size: 20,
                ),
                if (!collapsed) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.label,
                      style: TextStyle(
                        color: isActive ? Colors.white : Colors.white70,
                        fontSize: 14,
                        fontWeight:
                            isActive ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ),
                  if (item.badgeCount != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: SmColors.accent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        item.badgeCount!,
                        style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarExpandableItem extends StatelessWidget {
  final SmNavItem item;
  final bool collapsed;
  final String currentRoute;
  final bool isExpanded;
  final VoidCallback onExpand;
  final void Function(String) onNavigate;

  const _SidebarExpandableItem({
    required this.item,
    required this.collapsed,
    required this.currentRoute,
    required this.isExpanded,
    required this.onExpand,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    if (collapsed) {
      return _SidebarNavItem(
        item: item,
        collapsed: true,
        isActive: currentRoute.startsWith(item.route),
        onTap: onExpand,
      );
    }
    return Theme(
      data: Theme.of(context).copyWith(
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
      ),
      child: ExpansionTile(
        leading: Icon(item.icon,
            color: isExpanded ? SmColors.primaryGlow : Colors.white70,
            size: 20),
        title: Text(
          item.label,
          style: TextStyle(
            color: isExpanded ? Colors.white : Colors.white70,
            fontSize: 14,
            fontWeight: isExpanded ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        trailing: Icon(
          isExpanded ? Icons.expand_less : Icons.expand_more,
          color: Colors.white54,
          size: 18,
        ),
        initiallyExpanded: isExpanded,
        onExpansionChanged: (_) => onExpand(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 14),
        childrenPadding: const EdgeInsets.only(left: 16),
        children: item.children
            .map((child) => _SidebarNavItem(
                  item: child,
                  collapsed: false,
                  isActive: currentRoute == child.route,
                  onTap: () => onNavigate(child.route),
                ))
            .toList(),
      ),
    );
  }
}

class _SidebarFooter extends StatelessWidget {
  final bool collapsed;
  final String userName;
  final String userRole;
  final String? avatarUrl;
  final VoidCallback? onLogout;

  const _SidebarFooter({
    required this.collapsed,
    required this.userName,
    required this.userRole,
    this.avatarUrl,
    this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: collapsed ? 12 : 16,
        vertical: 16,
      ),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1), width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment:
            collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: SmColors.primary,
            backgroundImage:
                avatarUrl != null ? NetworkImage(avatarUrl!) : null,
            child: avatarUrl == null
                ? Text(
                    userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          if (!collapsed) ...[
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    userName,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    userRole,
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.logout, color: Colors.white38, size: 18),
              onPressed: onLogout,
              tooltip: 'Cerrar sesión',
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// 2. SmToast — Toast/Snackbar
// ─────────────────────────────────────────

/// Tipos de toast disponibles.
enum SmToastType { success, error, warning, info }

/// Toast estilizado que reemplaza Sonner / react-hot-toast.
///
/// ```dart
/// SmToast.show(
///   context,
///   message: 'Perfil actualizado',
///   description: 'Los cambios se guardaron correctamente.',
///   type: SmToastType.success,
/// );
/// ```
class SmToast {
  static void show(
    BuildContext context, {
    required String message,
    String? description,
    SmToastType type = SmToastType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final colors = {
      SmToastType.success: SmColors.primary,
      SmToastType.error: SmColors.destructive,
      SmToastType.warning: SmColors.accent,
      SmToastType.info: const Color(0xFF3B82F6),
    };
    final icons = {
      SmToastType.success: Icons.check_circle_outline,
      SmToastType.error: Icons.error_outline,
      SmToastType.warning: Icons.warning_amber_outlined,
      SmToastType.info: Icons.info_outline,
    };

    final color = colors[type]!;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: duration,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        padding: EdgeInsets.zero,
        backgroundColor: Colors.transparent,
        elevation: 0,
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF1A2E1A)
                : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Icon(icons[type], color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      message,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    if (description != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        description,
                        style: const TextStyle(
                            fontSize: 12, color: SmColors.mutedForeground),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 3. SmSearchCommand — Búsqueda global
// ─────────────────────────────────────────

/// Modelo de item buscable.
class SmSearchItem {
  final String id;
  final String title;
  final String? subtitle;
  final IconData icon;
  final String category;

  const SmSearchItem({
    required this.id,
    required this.title,
    this.subtitle,
    required this.icon,
    required this.category,
  });
}

/// Barra de búsqueda con autocompletar, agrupada por categoría.
/// Reemplaza `cmdk` (Command palette).
///
/// ```dart
/// SmSearchCommand(
///   items: [
///     SmSearchItem(id: '1', title: 'Carlos', category: 'Estudiantes', icon: Icons.person),
///     SmSearchItem(id: '2', title: 'Sub-17', category: 'Equipos', icon: Icons.group),
///   ],
///   onSelect: (item) => context.go('/students/${item.id}'),
/// )
/// ```
class SmSearchCommand extends StatelessWidget {
  final List<SmSearchItem> items;
  final String hint;
  final void Function(SmSearchItem item) onSelect;

  const SmSearchCommand({
    super.key,
    required this.items,
    required this.onSelect,
    this.hint = 'Buscar estudiantes, equipos, eventos...',
  });

  @override
  Widget build(BuildContext context) {
    return SearchAnchor(
      builder: (context, controller) => SearchBar(
        hintText: hint,
        leading: const Icon(Icons.search, color: SmColors.primary),
        onTap: () => controller.openView(),
        onChanged: (_) => controller.openView(),
        elevation: const WidgetStatePropertyAll(0),
        backgroundColor: WidgetStatePropertyAll(
            Theme.of(context).colorScheme.surfaceContainerLow),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: SmColors.border),
          ),
        ),
      ),
      suggestionsBuilder: (context, controller) {
        final q = controller.text;
        final filtered = q.isEmpty
            ? items
            : items
                .where((i) =>
                    i.title.toLowerCase().contains(q.toLowerCase()) ||
                    (i.subtitle?.toLowerCase().contains(q.toLowerCase()) ??
                        false))
                .toList();

        // Agrupar por categoría
        final grouped = <String, List<SmSearchItem>>{};
        for (final item in filtered) {
          grouped.putIfAbsent(item.category, () => []).add(item);
        }

        final tiles = <Widget>[];
        grouped.forEach((category, categoryItems) {
          tiles.add(Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text(
              category.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: SmColors.mutedForeground,
                letterSpacing: 1.2,
              ),
            ),
          ));
          for (final item in categoryItems) {
            tiles.add(ListTile(
              leading: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: SmColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Icon(item.icon, color: SmColors.primary, size: 18),
              ),
              title: Text(item.title, style: const TextStyle(fontSize: 14)),
              subtitle: item.subtitle != null
                  ? Text(item.subtitle!, style: const TextStyle(fontSize: 12))
                  : null,
              onTap: () {
                controller.closeView(item.title);
                onSelect(item);
              },
            ));
          }
        });

        if (tiles.isEmpty) {
          tiles.add(const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
              child: Text('Sin resultados',
                  style: TextStyle(color: SmColors.mutedForeground)),
            ),
          ));
        }

        return tiles;
      },
    );
  }
}
