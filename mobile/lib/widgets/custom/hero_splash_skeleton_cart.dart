// ============================================================
// SportMaps — Hero + WelcomeSplash + Skeleton + CartDrawer
//
// Componentes:
//   1. SmHeroSection       — Landing hero con gradiente animado
//   2. SmWelcomeSplash     — Modal role-aware de bienvenida
//   3. SmSkeleton          — Shimmer loading placeholder
//   4. SmStatCardSkeleton  — Skeleton específico para StatCard
//   5. SmActivityListSkeleton — Skeleton para listas
//   6. SmCartDrawer        — Bottom sheet de carrito de compras
// ============================================================

import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// 1. SmHeroSection — Landing Hero
// ─────────────────────────────────────────

/// Estadística para mostrar en el hero.
class SmHeroStat {
  final String value;
  final String label;
  const SmHeroStat({required this.value, required this.label});
}

/// Sección hero fullscreen con gradiente animado, texto con ShaderMask,
/// CTAs y estadísticas. Reemplaza `Hero.tsx`.
///
/// ```dart
/// SmHeroSection(
///   title: 'Gestiona tu',
///   highlightedWord: 'Academia',
///   subtitle: 'La plataforma integral para clubes deportivos.',
///   onPrimaryAction: () => context.go('/register'),
///   stats: [
///     SmHeroStat(value: '500+', label: 'Academias'),
///     SmHeroStat(value: '10K+', label: 'Atletas'),
///     SmHeroStat(value: '98%', label: 'Satisfacción'),
///   ],
/// )
/// ```
class SmHeroSection extends StatefulWidget {
  final String title;
  final String highlightedWord;
  final String subtitle;
  final VoidCallback onPrimaryAction;
  final VoidCallback? onSecondaryAction;
  final String primaryLabel;
  final String? secondaryLabel;
  final List<SmHeroStat> stats;

  const SmHeroSection({
    super.key,
    required this.title,
    required this.highlightedWord,
    required this.subtitle,
    required this.onPrimaryAction,
    this.onSecondaryAction,
    this.primaryLabel = 'Iniciar Actividad',
    this.secondaryLabel = 'Ver Demo',
    this.stats = const [],
  });

  @override
  State<SmHeroSection> createState() => _SmHeroSectionState();
}

class _SmHeroSectionState extends State<SmHeroSection>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _glowController;
  late Animation<double> _fadeAnim;
  late Animation<double> _slideAnim;
  late Animation<double> _glowAnim;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 700));
    _glowController =
        AnimationController(vsync: this, duration: const Duration(seconds: 2))
          ..repeat(reverse: true);

    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);
    _slideAnim = Tween<double>(begin: 30, end: 0).animate(
        CurvedAnimation(parent: _fadeController, curve: Curves.easeOut));
    _glowAnim = Tween<double>(begin: 0.4, end: 1.0).animate(
        CurvedAnimation(parent: _glowController, curve: Curves.easeInOut));

    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(gradient: SmGradients.heroBackground),
      child: AnimatedBuilder(
        animation: Listenable.merge([_fadeAnim, _glowAnim]),
        builder: (_, __) => FadeTransition(
          opacity: _fadeAnim,
          child: Transform.translate(
            offset: Offset(0, _slideAnim.value),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
              child: Column(
                children: [
                  // ── Título con texto gradiente ──
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: const TextStyle(
                        fontSize: 40,
                        fontWeight: FontWeight.bold,
                        height: 1.2,
                        color: Colors.white,
                      ),
                      children: [
                        TextSpan(text: '${widget.title} '),
                        WidgetSpan(
                          child: ShaderMask(
                            shaderCallback: (bounds) => LinearGradient(
                              colors: [
                                Color.lerp(SmColors.primaryGlow,
                                    SmColors.primary, _glowAnim.value)!,
                                SmColors.accent,
                              ],
                            ).createShader(bounds),
                            child: Text(
                              widget.highlightedWord,
                              style: const TextStyle(
                                fontSize: 40,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Subtítulo ──
                  Text(
                    widget.subtitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white70,
                      height: 1.6,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Botones CTA ──
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 16,
                    runSpacing: 12,
                    children: [
                      _GradientButton(
                        label: widget.primaryLabel,
                        onTap: widget.onPrimaryAction,
                      ),
                      if (widget.onSecondaryAction != null &&
                          widget.secondaryLabel != null)
                        OutlinedButton(
                          onPressed: widget.onSecondaryAction,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white38),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 32, vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          child: Text(widget.secondaryLabel!),
                        ),
                    ],
                  ),

                  // ── Stats ──
                  if (widget.stats.isNotEmpty) ...[
                    const SizedBox(height: 48),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: widget.stats
                          .map((s) => Column(
                                children: [
                                  Text(
                                    s.value,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    s.label,
                                    style: const TextStyle(
                                        color: Colors.white54, fontSize: 12),
                                  ),
                                ],
                              ))
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón con gradiente marca (verde → naranja).
class _GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _GradientButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          splashColor: Colors.white24,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 2. SmWelcomeSplash — Modal role-aware
// ─────────────────────────────────────────

/// Modal de bienvenida con animación de escala + fade y glow pulsante.
/// Reemplaza `WelcomeSplash.tsx`.
///
/// ```dart
/// SmWelcomeSplash.show(
///   context,
///   userName: 'Carlos',
///   role: 'coach',
///   onContinue: () => context.go('/dashboard'),
/// );
/// ```
class SmWelcomeSplash {
  static Future<void> show(
    BuildContext context, {
    required String userName,
    required String role,
    required VoidCallback onContinue,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      transitionDuration: const Duration(milliseconds: 400),
      transitionBuilder: (_, anim, __, child) {
        return FadeTransition(
          opacity: anim,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.85, end: 1.0)
                .animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
            child: child,
          ),
        );
      },
      pageBuilder: (_, __, ___) => _WelcomeSplashDialog(
        userName: userName,
        role: role,
        onContinue: onContinue,
      ),
    );
  }
}

class _WelcomeSplashDialog extends StatelessWidget {
  final String userName;
  final String role;
  final VoidCallback onContinue;

  const _WelcomeSplashDialog({
    required this.userName,
    required this.role,
    required this.onContinue,
  });

  String get _roleMessage {
    return switch (role) {
      'admin' => '¡Tienes acceso completo al sistema!',
      'coach' => 'Gestiona tus equipos y atletas.',
      'parent' => 'Sigue el progreso de tus hijos.',
      'student' || 'athlete' => '¡Bienvenido al equipo!',
      _ => 'Explora todas las funciones.',
    };
  }

  IconData get _roleIcon {
    return switch (role) {
      'admin' => Icons.admin_panel_settings,
      'coach' => Icons.sports,
      'parent' => Icons.family_restroom,
      'student' || 'athlete' => Icons.school,
      _ => Icons.person,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0A1F0A), Color(0xFF1a3d1a)],
          ),
          borderRadius: BorderRadius.circular(40),
          border: Border.all(
              color: SmColors.primary.withValues(alpha: 0.3), width: 1.5),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Ícono con glow pulsante
            _PulsingGlowIcon(icon: _roleIcon),

            const SizedBox(height: 24),

            Text(
              '¡Bienvenido, $userName!',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 8),

            Text(
              _roleMessage,
              style: const TextStyle(color: Colors.white70, fontSize: 15),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 32),

            SizedBox(
              width: double.infinity,
              child: _GradientButton(
                label: 'Comenzar',
                onTap: () {
                  Navigator.of(context).pop();
                  onContinue();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PulsingGlowIcon extends StatefulWidget {
  final IconData icon;
  const _PulsingGlowIcon({required this.icon});

  @override
  State<_PulsingGlowIcon> createState() => _PulsingGlowIconState();
}

class _PulsingGlowIconState extends State<_PulsingGlowIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _ctrl =
        AnimationController(vsync: this, duration: const Duration(seconds: 2))
          ..repeat(reverse: true);
    _glow = Tween<double>(begin: 8, end: 20)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _glow,
      builder: (_, __) => Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [SmColors.primary, SmColors.primaryGlow],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: SmColors.primary.withValues(alpha: 0.6),
              blurRadius: _glow.value,
              spreadRadius: _glow.value / 3,
            ),
          ],
        ),
        child: Icon(widget.icon, color: Colors.white, size: 36),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 3. SmSkeleton — Shimmer loading
// ─────────────────────────────────────────

/// Skeleton shimmer genérico. Reemplaza el componente `Skeleton` de shadcn/ui.
///
/// ```dart
/// SmSkeleton(width: 200, height: 20) // título
/// SmSkeleton(width: double.infinity, height: 14) // párrafo
/// ```
class SmSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SmSkeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius = 6,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF1E3A1E) : const Color(0xFFE8F0E8),
      highlightColor:
          isDark ? const Color(0xFF2A4A2A) : const Color(0xFFF3F7F3),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Skeleton para una tarjeta de estadísticas del dashboard.
///
/// ```dart
/// if (isLoading)
///   Column(children: List.generate(4, (_) => const SmStatCardSkeleton()))
/// ```
class SmStatCardSkeleton extends StatelessWidget {
  const SmStatCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SmSkeleton(width: 100, height: 14),
                SmSkeleton(width: 36, height: 36, borderRadius: 8),
              ],
            ),
            SizedBox(height: 12),
            SmSkeleton(width: 80, height: 28),
            SizedBox(height: 8),
            SmSkeleton(width: 120, height: 12),
          ],
        ),
      ),
    );
  }
}

/// Skeleton para lista de actividades.
class SmActivityListSkeleton extends StatelessWidget {
  final int itemCount;
  const SmActivityListSkeleton({super.key, this.itemCount = 5});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        itemCount,
        (i) => const Padding(
          padding: EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              SmSkeleton(width: 40, height: 40, borderRadius: 20),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SmSkeleton(width: 180, height: 14),
                    SizedBox(height: 6),
                    SmSkeleton(width: 80, height: 11),
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
// 4. SmCartDrawer — Bottom Sheet de carrito
// ─────────────────────────────────────────

/// Modelo de item del carrito.
class SmCartItem {
  final String id;
  final String name;
  final String description;
  final double price;
  int quantity;

  SmCartItem({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.quantity = 1,
  });
}

/// Bottom sheet de carrito con DraggableScrollableSheet.
/// Reemplaza `CartDrawer` del frontend React.
///
/// ```dart
/// SmCartDrawer.show(
///   context,
///   items: cartItems,
///   onQuantityChange: (item, qty) => cartNotifier.updateQty(item.id, qty),
///   onRemove: (item) => cartNotifier.remove(item.id),
///   onCheckout: () => context.push('/checkout'),
/// );
/// ```
class SmCartDrawer extends StatefulWidget {
  final List<SmCartItem> items;
  final void Function(SmCartItem, int) onQuantityChange;
  final void Function(SmCartItem) onRemove;
  final VoidCallback onCheckout;

  const SmCartDrawer({
    super.key,
    required this.items,
    required this.onQuantityChange,
    required this.onRemove,
    required this.onCheckout,
  });

  /// Muestra el CartDrawer como modal bottom sheet.
  static Future<void> show(
    BuildContext context, {
    required List<SmCartItem> items,
    required void Function(SmCartItem, int) onQuantityChange,
    required void Function(SmCartItem) onRemove,
    required VoidCallback onCheckout,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SmCartDrawer(
        items: items,
        onQuantityChange: onQuantityChange,
        onRemove: onRemove,
        onCheckout: onCheckout,
      ),
    );
  }

  @override
  State<SmCartDrawer> createState() => _SmCartDrawerState();
}

class _SmCartDrawerState extends State<SmCartDrawer> {
  double get _total =>
      widget.items.fold(0, (sum, i) => sum + i.price * i.quantity);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: isDark ? SmColors.darkCard : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // ── Handle ──
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 16),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // ── Título ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Carrito',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Badge(
                    label: Text('${widget.items.length}'),
                    backgroundColor: SmColors.primary,
                    child: const Icon(Icons.shopping_cart_outlined),
                  ),
                ],
              ),
            ),

            const Divider(height: 24),

            // ── Lista de items ──
            Expanded(
              child: widget.items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shopping_cart_outlined,
                              size: 48,
                              color: SmColors.mutedForeground
                                  .withValues(alpha: 0.5)),
                          const SizedBox(height: 12),
                          const Text('Tu carrito está vacío',
                              style:
                                  TextStyle(color: SmColors.mutedForeground)),
                        ],
                      ),
                    )
                  : ListView.separated(
                      controller: controller,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: widget.items.length,
                      separatorBuilder: (_, __) => const Divider(height: 16),
                      itemBuilder: (_, i) => _CartItemTile(
                        item: widget.items[i],
                        onQuantityChange: (q) =>
                            widget.onQuantityChange(widget.items[i], q),
                        onRemove: () => widget.onRemove(widget.items[i]),
                      ),
                    ),
            ),

            // ── Footer: total + checkout ──
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isDark ? SmColors.darkCard : Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(
                        '\$${_total.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                          color: SmColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed:
                          widget.items.isEmpty ? null : widget.onCheckout,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: SmColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text(
                        'Proceder al Pago',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  final SmCartItem item;
  final void Function(int) onQuantityChange;
  final VoidCallback onRemove;

  const _CartItemTile({
    required this.item,
    required this.onQuantityChange,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14)),
              Text(item.description,
                  style: const TextStyle(
                      fontSize: 12, color: SmColors.mutedForeground)),
              const SizedBox(height: 4),
              Text('\$${item.price.toStringAsFixed(2)}',
                  style: const TextStyle(
                      color: SmColors.primary, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.remove, size: 16),
              onPressed: item.quantity > 1
                  ? () => onQuantityChange(item.quantity - 1)
                  : onRemove,
              style: IconButton.styleFrom(
                backgroundColor: SmColors.muted,
                minimumSize: const Size(32, 32),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text('${item.quantity}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
            IconButton(
              icon: const Icon(Icons.add, size: 16),
              onPressed: () => onQuantityChange(item.quantity + 1),
              style: IconButton.styleFrom(
                backgroundColor: SmColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(32, 32),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
