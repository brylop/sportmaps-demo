// ============================================================
// SportMaps — Teams Screen + Attendance Screen
// Pantallas reales conectadas a Riverpod + Supabase
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sportmaps/providers/auth_provider.dart';
import 'package:sportmaps/providers/data_providers.dart';
import 'package:sportmaps/navigation/sm_routes.dart';
import 'package:sportmaps/widgets/direct/direct_components.dart';
import 'package:sportmaps/widgets/adaptable/adaptable_components.dart';
import 'package:sportmaps/widgets/custom/sidebar_toast_search.dart';
import 'package:sportmaps/widgets/custom/hero_splash_skeleton_cart.dart';
import 'package:sportmaps/theme/sportmaps_theme.dart';
import 'package:sportmaps/platform/sm_adaptive_widgets.dart';

// ════════════════════════════════════════════════════════════
// TEAMS SCREEN
// ════════════════════════════════════════════════════════════
class TeamsScreen extends ConsumerStatefulWidget {
  const TeamsScreen({super.key});

  @override
  ConsumerState<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends ConsumerState<TeamsScreen> {
  String _search = '';
  String _filterSport = 'Todos';
  final bool _loading = false;

  static const _sports = ['Todos', 'Fútbol', 'Baloncesto', 'Voleibol', 'Natación'];

  @override
  Widget build(BuildContext context) {
    final teamsAsync = ref.watch(teamsProvider);
    final role       = ref.watch(currentRoleProvider);
    final canCreate  = role == SmUserRole.admin ||
                       role == SmUserRole.schoolAdmin ||
                       role == SmUserRole.superAdmin;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: RefreshIndicator(
        color: SmColors.primary,
        onRefresh: () => ref.read(teamsProvider.notifier).refresh(),
        child: CustomScrollView(
          slivers: [
            // ── AppBar ──────────────────────────────────
            SliverAppBar(
              floating: true,
              snap: true,
              title: const Text('Equipos',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              actions: [
                if (canCreate)
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: () => _showCreateTeamSheet(context),
                    tooltip: 'Nuevo equipo',
                  ),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([

                  // ── Buscador ──────────────────────────
                  SmInput(
                    hint: 'Buscar equipos...',
                    prefixIcon: Icons.search,
                    onChanged: (v) => setState(() => _search = v.toLowerCase()),
                  ),
                  const SizedBox(height: 12),

                  // ── Filtro de deporte ──────────────────
                  SmScrollArea(
                    scrollDirection: Axis.horizontal,
                    showScrollbar: false,
                    child: Row(
                      children: _sports.map((s) {
                        final active = s == _filterSport;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(s),
                            selected: active,
                            onSelected: (_) =>
                                setState(() => _filterSport = s),
                            selectedColor:
                                SmColors.primary.withValues(alpha: 0.12),
                            labelStyle: TextStyle(
                              color: active
                                  ? SmColors.primary
                                  : SmColors.mutedForeground,
                              fontWeight: active
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Lista de equipos ───────────────────
                  teamsAsync.when(
                    loading: () => Column(
                      children: List.generate(
                        4,
                        (_) => const Padding(
                          padding: EdgeInsets.only(bottom: 10),
                          child: SmSkeleton(height: 88,
                              borderRadius: 12),
                        ),
                      ),
                    ),
                    error: (e, _) => SmEmptyState(
                      icon: Icons.error_outline,
                      title: 'Error al cargar',
                      description: e.toString(),
                      actionLabel: 'Reintentar',
                      onAction: () async {
                        // Assuming `_loading` is a state variable in this context,
                        // and `ref.read(teamsProvider.notifier)` is the `notifier`.
                        if (_loading) {
                          return;
                        }
                        await ref.read(teamsProvider.notifier).refresh();
                      },
                    ),
                    data: (teams) {
                      final filtered = teams.where((t) {
                        final matchesSearch = _search.isEmpty ||
                            t.name.toLowerCase().contains(_search) ||
                            t.category.toLowerCase().contains(_search);
                        final matchesSport = _filterSport == 'Todos' ||
                            t.sport == _filterSport;
                        return matchesSearch && matchesSport;
                      }).toList();

                      if (filtered.isEmpty) {
                        if (_search.isNotEmpty) {
                          return const SmEmptyState(
                            icon: Icons.groups_outlined,
                            title: 'Sin resultados',
                            description: 'Intenta con otro término de búsqueda',
                          );
                        }
                        return SmEmptyState(
                          icon: Icons.groups_outlined,
                          title: 'Sin equipos aún',
                          description: 'Crea tu primer equipo para comenzar',
                          actionLabel: canCreate ? 'Crear equipo' : null,
                          onAction: canCreate
                              ? () => _showCreateTeamSheet(context)
                              : null,
                        );
                      }

                      return Column(
                        children: filtered
                            .map((t) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _TeamCard(
                                    team: t,
                                    onTap: () => context
                                        .go('${SmRoutes.teams}/${t.id}'),
                                    onDelete: canCreate
                                        ? () => _confirmDelete(context, t)
                                        : null,
                                  ),
                                ))
                            .toList(),
                      );
                    },
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateTeamSheet(BuildContext context) {
    SmBottomSheet.show<void>(
      context,
      initialSize: 0.6,
      builder: (ctx, _) => _CreateTeamForm(
        onCreated: (_) => Navigator.of(ctx).pop(),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, SmTeam team) async {
    final confirmed = await SmAdaptiveDialog.confirm(
      context,
      title: 'Eliminar equipo',
      message:
          '¿Estás seguro de eliminar "${team.name}"? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      destructive: true,
    );
    if (confirmed == true) {
      await ref.read(teamsProvider.notifier).deleteTeam(team.id);
      if (context.mounted) {
        SmToast.show(context,
            message: 'Equipo eliminado',
            type: SmToastType.success);
      }
    }
  }
}

// ── Team Card ────────────────────────────────────────────────
class _TeamCard extends StatelessWidget {
  final SmTeam team;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  const _TeamCard({
    required this.team,
    required this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return SmCard(
      onTap: onTap,
      child: Row(
        children: [
          // Logo / avatar
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: SmColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: team.logoUrl != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(team.logoUrl!, fit: BoxFit.cover),
                  )
                : const Icon(Icons.groups,
                    color: SmColors.primary, size: 26),
          ),
          const SizedBox(width: 14),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        team.name,
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    SmBadge(
                      label: team.category,
                      variant: SmBadgeVariant.secondary,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.sports_soccer,
                        size: 13, color: SmColors.mutedForeground),
                    const SizedBox(width: 4),
                    Text(team.sport,
                        style: const TextStyle(
                            fontSize: 12,
                            color: SmColors.mutedForeground)),
                    const SizedBox(width: 12),
                    const Icon(Icons.people,
                        size: 13, color: SmColors.mutedForeground),
                    const SizedBox(width: 4),
                    Text('${team.playerCount} atletas',
                        style: const TextStyle(
                            fontSize: 12,
                            color: SmColors.mutedForeground)),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(children: [
                    const Icon(Icons.people_outline, size: 14, color: SmColors.mutedForeground),
                    const SizedBox(width: 4),
                    Text('${team.playerCount} Atletas', style: const TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
                  ]),
                ),
                if (team.coachName != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.person_outline,
                          size: 13, color: SmColors.mutedForeground),
                      const SizedBox(width: 4),
                      Text(team.coachName!,
                          style: const TextStyle(
                              fontSize: 12,
                              color: SmColors.mutedForeground)),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // Actions
          Column(
            children: [
              const Icon(Icons.chevron_right, color: SmColors.mutedForeground),
              if (onDelete != null) ...[
                const SizedBox(height: 4),
                InkWell(
                  onTap: onDelete,
                  borderRadius: BorderRadius.circular(4),
                  child: const Icon(Icons.delete_outline,
                      size: 18, color: SmColors.destructive),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ── Create Team Form ─────────────────────────────────────────
class _CreateTeamForm extends ConsumerStatefulWidget {
  final void Function(SmTeam) onCreated;
  const _CreateTeamForm({required this.onCreated});

  @override
  ConsumerState<_CreateTeamForm> createState() => _CreateTeamFormState();
}

class _CreateTeamFormState extends ConsumerState<_CreateTeamForm> {
  final _formKey   = GlobalKey<FormState>();
  final _nameCtrl  = TextEditingController();
  String _sport    = 'Fútbol';
  String _category = 'Sub-14';
  bool _loading    = false;

  final _sports     = ['Fútbol', 'Baloncesto', 'Voleibol', 'Natación', 'Atletismo'];
  final _categories = ['Sub-8', 'Sub-10', 'Sub-12', 'Sub-14', 'Sub-16', 'Sub-18', 'Adultos'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 8,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Nuevo equipo',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            SmInput(
              label: 'Nombre del equipo',
              hint: 'Ej: Tigres Sub-14',
              controller: _nameCtrl,
              validator: (v) =>
                  v == null || v.isEmpty ? 'Ingresa el nombre' : null,
            ),
            const SizedBox(height: 16),
            SmSelect<String>(
              label: 'Deporte',
              value: _sport,
              options: _sports
                  .map((s) => SmSelectOption(value: s, label: s))
                  .toList(),
              onChanged: (v) => setState(() => _sport = v ?? _sport),
            ),
            const SizedBox(height: 16),
            SmSelect<String>(
              label: 'Categoría',
              value: _category,
              options: _categories
                  .map((c) => SmSelectOption(value: c, label: c))
                  .toList(),
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            const SizedBox(height: 24),
            SmButton(
              label: 'Crear equipo',
              variant: SmButtonVariant.primary,
              fullWidth: true,
              loading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _loading = true);
    try {
      final team = await ref.read(teamsProvider.notifier).createTeam(
            name:     _nameCtrl.text.trim(),
            sport:    _sport,
            category: _category,
          );
      if (team != null && mounted) {
        SmToast.show(context,
            message: 'Equipo creado',
            description: team.name,
            type: SmToastType.success);
        widget.onCreated(team);
      }
    } catch (e) {
      if (mounted) {
        SmToast.show(context,
            message: 'Error al crear equipo',
            type: SmToastType.error);
      }
    } finally {
      if (mounted) {
      setState(() => _loading = false);
    }
    }
  }
}

// ════════════════════════════════════════════════════════════
// ATTENDANCE SCREEN
// ════════════════════════════════════════════════════════════
class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  SmTeam? _selectedTeam;
  // En producción generarías/seleccionarías el ID de sesión real
  final String _sessionId = 'session-${DateTime.now().toIso8601String().substring(0, 10)}';

  @override
  Widget build(BuildContext context) {
    final teams = ref.watch(teamsProvider).valueOrNull ?? [];

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            title: const Text('Asistencia',
                style: TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              if (_selectedTeam != null)
                TextButton.icon(
                  onPressed: _markAll,
                  icon: const Icon(Icons.done_all, size: 16),
                  label: const Text('Todos presentes'),
                  style: TextButton.styleFrom(
                      foregroundColor: SmColors.primary),
                ),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([

                // ── Selector de equipo ─────────────────
                SmSelect<SmTeam>(
                  label: 'Selecciona un equipo',
                  value: _selectedTeam,
                  hint: 'Elegir equipo...',
                  options: teams
                      .map((t) => SmSelectOption(
                            value: t,
                            label: '${t.name} · ${t.category}',
                            icon: Icons.groups_outlined,
                          ))
                      .toList(),
                  onChanged: (t) => setState(() => _selectedTeam = t),
                ),

                const SizedBox(height: 16),

                if (_selectedTeam == null)
                  const SmEmptyState(
                    icon: Icons.fact_check_outlined,
                    title: 'Selecciona un equipo',
                    description: 'Elige un equipo para tomar asistencia de la sesión de hoy.',
                  )
                else
                  _AttendanceList(
                    teamId:    _selectedTeam!.id,
                    sessionId: _sessionId,
                  ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _markAll() async {
    if (_selectedTeam == null) {
      return;
    }
    await ref
        .read(attendanceProvider(AttendanceParams(
          teamId:    _selectedTeam!.id,
          sessionId: _sessionId,
        )).notifier)
        .markAll(true);
    if (mounted) {
      SmToast.show(context,
          message: 'Todos marcados como presentes',
          type: SmToastType.success);
    }
  }
}

class _AttendanceList extends ConsumerWidget {
  final String teamId;
  final String sessionId;

  const _AttendanceList({
    required this.teamId,
    required this.sessionId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params     = AttendanceParams(teamId: teamId, sessionId: sessionId);
    final attendAsync = ref.watch(attendanceProvider(params));
    final students   = ref.watch(studentsByTeamProvider(teamId));

    // Si no hay registros de asistencia, inicializar con todos los estudiantes
    final records = attendAsync.valueOrNull ?? [];
    final presentCount = records.where((r) => r.present).length;
    final total        = records.isEmpty ? students.length : records.length;

    return Column(
      children: [
        // ── Stats barra ────────────────────────────────
        if (total > 0)
          SmCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Asistencia de hoy',
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    Text(
                      '$presentCount / $total',
                      style: const TextStyle(
                          color: SmColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SmProgress(
                  value: total > 0 ? presentCount / total : 0,
                  showPercent: true,
                ),
              ],
            ),
          ),

        const SizedBox(height: 12),

        // ── Lista ─────────────────────────────────────
        attendAsync.when(
          loading: () => const SmActivityListSkeleton(itemCount: 6),
          error:   (e, _) => SmEmptyState(
            icon: Icons.error_outline,
            title: 'Error',
            description: e.toString(),
          ),
          data: (records) {
            if (records.isEmpty) {
              // Mostrar todos los estudiantes del equipo sin registro aún
              return Column(
                children: students
                    .map((s) => _AttendanceTile(
                          name:      s.fullName,
                          avatarUrl: s.avatarUrl,
                          initials:  s.initials,
                          present:   false,
                          onToggle: (v) => ref
                              .read(attendanceProvider(params).notifier)
                              .markAttendance(
                                studentId: s.id,
                                present: v,
                              ),
                        ))
                    .toList(),
              );
            }

            return Column(
              children: records
                  .map((r) => _AttendanceTile(
                        name:      r.studentName,
                        avatarUrl: r.avatarUrl,
                        initials:  r.studentName.isNotEmpty
                            ? r.studentName.split(' ').map((w) => w[0]).take(2).join().toUpperCase()
                            : '?',
                        present:   r.present,
                        onToggle:  (v) => ref
                            .read(attendanceProvider(params).notifier)
                            .markAttendance(
                              studentId: r.studentId,
                              present:   v,
                            ),
                      ))
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

class _AttendanceTile extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final String initials;
  final bool present;
  final ValueChanged<bool> onToggle;

  const _AttendanceTile({
    required this.name,
    this.avatarUrl,
    required this.initials,
    required this.present,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: present
            ? SmColors.primary.withValues(alpha: 0.05)
            : Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: present
              ? SmColors.primary.withValues(alpha: 0.3)
              : SmColors.border,
        ),
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: SmAvatar(
          imageUrl: avatarUrl,
          name: name,
          size: 40,
          backgroundColor:
              present ? SmColors.primary : SmColors.mutedForeground,
        ),
        title: Text(
          name,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: present
                ? Theme.of(context).colorScheme.onSurface
                : SmColors.mutedForeground,
          ),
        ),
        subtitle: Text(
          present ? 'Presente' : 'Ausente',
          style: TextStyle(
            color: present ? SmColors.primary : SmColors.destructive,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: SmAdaptiveSwitch(
          value: present,
          onChanged: onToggle,
          activeColor: SmColors.primary,
        ),
      ),
    );
  }
}
