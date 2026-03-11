// ============================================================
// SportMaps — Dashboard Screen (pantalla real)
// Usa: SmStatCard, SmActivityTile, SmQuickAction, SmEmptyState,
//      SmProgress, SmBadge, SmCarousel (adaptable),
//      SmLineChart (custom), SmSkeleton
// ============================================================

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../widgets/direct/direct_components.dart';
import '../widgets/custom/charts_widget.dart';
import '../widgets/custom/hero_splash_skeleton_cart.dart';
import '../widgets/adaptable/adaptable_components.dart';
import '../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// MODELOS de datos del Dashboard
// ─────────────────────────────────────────
class DashboardData {
  final int totalStudents;
  final int activeTeams;
  final double attendanceRate;
  final int upcomingEvents;
  final List<ActivityItem> recentActivity;
  final List<FlSpot> attendanceSpots;
  final List<AnnouncementItem> announcements;
  final int profileCompletion;

  const DashboardData({
    required this.totalStudents,
    required this.activeTeams,
    required this.attendanceRate,
    required this.upcomingEvents,
    required this.recentActivity,
    required this.attendanceSpots,
    required this.announcements,
    required this.profileCompletion,
  });
}

class ActivityItem {
  final String title;
  final String subtitle;
  final String timeAgo;
  final IconData icon;
  final Color? color;
  const ActivityItem({
    required this.title,
    required this.subtitle,
    required this.timeAgo,
    required this.icon,
    this.color,
  });
}

class AnnouncementItem {
  final String title;
  final String body;
  final String date;
  final String author;
  const AnnouncementItem({
    required this.title,
    required this.body,
    required this.date,
    required this.author,
  });
}

// ─────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  bool _isLoading = true;
  DashboardData? _data;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    // Simula llamada a Supabase
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (!mounted) {
      return;
    }
    setState(() {
      _isLoading = false;
      _data = const DashboardData(
        totalStudents: 247,
        activeTeams: 12,
        attendanceRate: 87.4,
        upcomingEvents: 5,
        recentActivity: [
          ActivityItem(
            title: 'Nueva inscripción',
            subtitle: 'Carlos García se unió al equipo Sub-14',
            timeAgo: 'hace 5 min',
            icon: Icons.person_add_outlined,
            color: Color(0xFF248223),
          ),
          ActivityItem(
            title: 'Asistencia registrada',
            subtitle: 'Entrenamiento categoría Sub-16 — 18/20',
            timeAgo: 'hace 1h',
            icon: Icons.fact_check_outlined,
            color: Color(0xFFFB9F1E),
          ),
          ActivityItem(
            title: 'Pago recibido',
            subtitle: 'Mensualidad Marzo — Ana Martínez',
            timeAgo: 'hace 2h',
            icon: Icons.attach_money_outlined,
            color: Color(0xFF3B82F6),
          ),
          ActivityItem(
            title: 'Evento creado',
            subtitle: 'Copa Interna 2026 — Sábado 15 Mar',
            timeAgo: 'ayer',
            icon: Icons.event_outlined,
            color: Color(0xFF8B5CF6),
          ),
        ],
        attendanceSpots: [
          FlSpot(0, 82),
          FlSpot(1, 78),
          FlSpot(2, 85),
          FlSpot(3, 90),
          FlSpot(4, 83),
          FlSpot(5, 87),
          FlSpot(6, 87),
        ],
        announcements: [
          AnnouncementItem(
            title: 'Torneo Regional Sub-16',
            body:
                'Inscripciones abiertas para el torneo regional. Fecha límite 20 de marzo.',
            date: '10 Mar',
            author: 'Admin',
          ),
          AnnouncementItem(
            title: 'Mantenimiento de canchas',
            body:
                'Las canchas 2 y 3 estarán fuera de servicio el viernes 14 de marzo.',
            date: '8 Mar',
            author: 'Coordinación',
          ),
        ],
        profileCompletion: 65,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: RefreshIndicator(
        color: SmColors.primary,
        onRefresh: _loadData,
        child: CustomScrollView(
          slivers: [
            // ── AppBar ────────────────────────────────────
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Theme.of(context).colorScheme.surface,
              surfaceTintColor: Colors.transparent,
              title: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: SmGradients.brand,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child:
                        const Icon(Icons.sports, color: Colors.white, size: 16),
                  ),
                  const SizedBox(width: 8),
                  const Text('Dashboard',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              actions: [
                SmNotificationBell(
                  unreadCount: 3,
                  onTap: () {},
                ),
                SmAvatar(
                  name: 'Miguel Torres',
                  size: 32,
                  onTap: () {},
                ),
                const SizedBox(width: 8),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Bienvenida ──────────────────────────
                  _buildGreeting(context),
                  const SizedBox(height: 20),

                  // ── Completion Banner (si aplica) ───────
                  if (!_isLoading &&
                      (_data?.profileCompletion ?? 100) < 80) ...[
                    SmProfileCompletionBanner(
                      completionPercent: _data?.profileCompletion ?? 0,
                      pendingItems: const [
                        'Agregar foto de perfil',
                        'Completar información del club',
                        'Verificar número de teléfono',
                      ],
                      onCompleteProfile: () {},
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── KPI Stats ───────────────────────────
                  _isLoading ? _buildStatsSkeleton() : _buildStatsGrid(context),
                  const SizedBox(height: 20),

                  // ── Acciones rápidas ────────────────────
                  _buildQuickActions(context),
                  const SizedBox(height: 20),

                  // ── Gráfica de asistencia ────────────────
                  _buildAttendanceChart(context),
                  const SizedBox(height: 20),

                  // ── Actividad reciente ───────────────────
                  _buildRecentActivity(context),
                  const SizedBox(height: 20),

                  // ── Anuncios ─────────────────────────────
                  _buildAnnouncements(context),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── SECCIONES ──────────────────────────────────────────────

  Widget _buildGreeting(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Buenos días'
        : hour < 18
            ? 'Buenas tardes'
            : 'Buenas noches';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$greeting, Miguel 👋',
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          'Aquí está el resumen de tu academia hoy',
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: SmColors.mutedForeground),
        ),
      ],
    );
  }

  Widget _buildStatsSkeleton() {
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(4, (_) => const SmStatCardSkeleton()),
    );
  }

  Widget _buildStatsGrid(BuildContext context) {
    final d = _data!;
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        SmStatCard(
          title: 'Estudiantes',
          value: '${d.totalStudents}',
          icon: Icons.people_outline,
          trend: '+12 este mes',
          trendUp: true,
          onTap: () {},
        ),
        SmStatCard(
          title: 'Equipos activos',
          value: '${d.activeTeams}',
          icon: Icons.groups_outlined,
          iconColor: const Color(0xFF3B82F6),
          subtitle: 'En 4 categorías',
          onTap: () {},
        ),
        SmStatCard(
          title: 'Asistencia',
          value: '${d.attendanceRate}%',
          icon: Icons.fact_check_outlined,
          iconColor: const Color(0xFF8B5CF6),
          trend: '+2.1% vs. semana anterior',
          trendUp: true,
          onTap: () {},
        ),
        SmStatCard(
          title: 'Próximos eventos',
          value: '${d.upcomingEvents}',
          icon: Icons.event_outlined,
          iconColor: SmColors.accent,
          subtitle: 'En los próximos 7 días',
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Acciones rápidas',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SmQuickAction(
              icon: Icons.person_add_outlined,
              label: 'Nuevo estudiante',
              color: SmColors.primary,
              onTap: () {},
            ),
            SmQuickAction(
              icon: Icons.groups_outlined,
              label: 'Crear equipo',
              color: const Color(0xFF3B82F6),
              onTap: () {},
            ),
            SmQuickAction(
              icon: Icons.event_outlined,
              label: 'Crear evento',
              color: const Color(0xFF8B5CF6),
              onTap: () {},
            ),
            SmQuickAction(
              icon: Icons.attach_money_outlined,
              label: 'Registrar pago',
              color: SmColors.accent,
              onTap: () {},
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAttendanceChart(BuildContext context) {
    return SmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Asistencia semanal',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SmBadge(
                label: '87.4% promedio',
                variant: SmBadgeVariant.secondary,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Últimas 7 sesiones',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: SmColors.mutedForeground),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 160,
            child: _isLoading
                ? const SmSkeleton(height: 160)
                : SmLineChart(
                    label: 'Asistencia %',
                    spots: _data?.attendanceSpots ?? [],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentActivity(BuildContext context) {
    return SmCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Actividad reciente',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
              TextButton(
                onPressed: () {},
                child: const Text('Ver todo'),
              ),
            ],
          ),
          const SmSeparator(),
          const SizedBox(height: 4),
          if (_isLoading)
            const SmActivityListSkeleton(itemCount: 4)
          else if (_data!.recentActivity.isEmpty)
            const SmEmptyState(
              icon: Icons.timeline_outlined,
              title: 'Sin actividad reciente',
              description: 'Las acciones de tu academia aparecerán aquí.',
            )
          else
            ..._data!.recentActivity.map((item) => SmActivityTile(
                  title: item.title,
                  subtitle: item.subtitle,
                  timeAgo: item.timeAgo,
                  icon: item.icon,
                  iconColor: item.color,
                  onTap: () {},
                )),
        ],
      ),
    );
  }

  Widget _buildAnnouncements(BuildContext context) {
    if (_isLoading || _data == null) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Anuncios',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ..._data!.announcements.map((a) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SmCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(a.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                        ),
                        SmBadge(label: a.date, variant: SmBadgeVariant.outline),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(a.body,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SmColors.mutedForeground,
                              height: 1.5,
                            )),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        SmAvatar(name: a.author, size: 20),
                        const SizedBox(width: 6),
                        Text(a.author,
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: SmColors.mutedForeground)),
                      ],
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}
