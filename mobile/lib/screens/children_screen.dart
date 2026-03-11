// ============================================================
// SportMaps — Children / Students Screen + Progress Detail
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/auth_provider.dart';
import '../providers/data_providers.dart';
import '../widgets/direct/direct_components.dart';
import '../widgets/adaptable/adaptable_components.dart';
import '../widgets/custom/charts_widget.dart';
import '../widgets/custom/map_calendar_widget.dart';
import '../widgets/custom/hero_splash_skeleton_cart.dart';
import '../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// CHILDREN LIST SCREEN
// ─────────────────────────────────────────
class ChildrenScreen extends ConsumerStatefulWidget {
  const ChildrenScreen({super.key});
  @override ConsumerState<ChildrenScreen> createState() => _ChildrenScreenState();
}

class _ChildrenScreenState extends ConsumerState<ChildrenScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final studentsAsync = ref.watch(studentsProvider);
    final role          = ref.watch(currentRoleProvider);
    final canCreate     = role != SmUserRole.parent && role != SmUserRole.student;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: RefreshIndicator(
        color: SmColors.primary,
        onRefresh: () => ref.read(studentsProvider.notifier).refresh(),
        child: CustomScrollView(slivers: [
          SliverAppBar(
            floating: true, snap: true,
            title: Text(role == SmUserRole.parent ? 'Mis hijos' : 'Estudiantes',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              if (canCreate)
                IconButton(icon: const Icon(Icons.person_add_outlined),
                    onPressed: () => _showCreateSheet(context)),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              SmInput(hint: 'Buscar estudiante...', prefixIcon: Icons.search,
                  onChanged: (v) => setState(() => _search = v.toLowerCase())),
              const SizedBox(height: 16),
              studentsAsync.when(
                loading: () => Column(children: List.generate(4, (_) =>
                    const Padding(padding: EdgeInsets.only(bottom: 10),
                      child: SmSkeleton(height: 90,
                        borderRadius: 12)))),
                error: (e, _) => SmEmptyState(icon: Icons.error_outline, title: 'Error',
                    description: e.toString(), actionLabel: 'Reintentar',
                    onAction: () => ref.read(studentsProvider.notifier).refresh()),
                data: (students) {
                  final filtered = _search.isEmpty ? students
                      : students.where((s) => s.fullName.toLowerCase().contains(_search)).toList();
                  if (filtered.isEmpty) {
                    return SmEmptyState(
                      icon: Icons.school_outlined,
                      title: _search.isNotEmpty ? 'Sin resultados' : 'Sin estudiantes',
                      description: _search.isNotEmpty
                          ? 'Intenta con otro nombre'
                          : 'Agrega el primer estudiante',
                      actionLabel: canCreate ? 'Agregar estudiante' : null,
                      onAction: canCreate ? () => _showCreateSheet(context) : null,
                    );
                  }
                  return Column(children: filtered.map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _StudentCard(student: s,
                        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                            builder: (_) => StudentProgressScreen(student: s)))),
                  )).toList());
                },
              ),
            ])),
          ),
        ]),
      ),
    );
  }

  void _showCreateSheet(BuildContext context) => SmBottomSheet.show<void>(
    context, initialSize: 0.65,
    builder: (ctx, _) => _CreateStudentForm(onCreated: (_) => Navigator.of(ctx).pop()),
  );
}

class _StudentCard extends StatelessWidget {
  final SmStudent student;
  final VoidCallback onTap;
  const _StudentCard({required this.student, required this.onTap});

  @override
  Widget build(BuildContext context) => SmCard(
    onTap: onTap,
    child: Row(children: [
      SmAvatar(name: student.fullName, imageUrl: student.avatarUrl, size: 50,
          showBadge: student.attendanceRate >= 90,
          badgeColor: const Color(0xFF22C55E)),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        if (student.teamName != null)
          Row(children: [
            const Icon(Icons.groups_outlined, size: 13, color: SmColors.mutedForeground),
            const SizedBox(width: 4),
            Text(student.teamName!, style: const TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
          ]),
        const SizedBox(height: 6),
        Row(children: [
          _StatChip(label: '${student.attendanceRate.toStringAsFixed(0)}%',
              icon: Icons.fact_check_outlined,
              color: student.attendanceRate >= 80 ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
          const SizedBox(width: 8),
          if (student.birthDate != null)
            _StatChip(
              label: '${DateTime.now().year - student.birthDate!.year} años',
              icon: Icons.cake_outlined,
              color: SmColors.mutedForeground,
            ),
        ]),
      ])),
      const Icon(Icons.chevron_right, color: SmColors.mutedForeground),
    ]),
  );
}

class _StatChip extends StatelessWidget {
  final String label; final IconData icon; final Color color;
  const _StatChip({required this.label, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 12, color: color),
    const SizedBox(width: 3),
    Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w500)),
  ]);
}

class _CreateStudentForm extends ConsumerStatefulWidget {
  final void Function(SmStudent) onCreated;
  const _CreateStudentForm({required this.onCreated});
  @override ConsumerState<_CreateStudentForm> createState() => _CreateStudentFormState();
}
class _CreateStudentFormState extends ConsumerState<_CreateStudentForm> {
  final _key = GlobalKey<FormState>();
  final _first = TextEditingController(), _last = TextEditingController();
  bool _loading = false;
  String? _teamId;

  @override
  Widget build(BuildContext context) {
    final teams = ref.watch(teamsProvider).valueOrNull ?? [];
    return Padding(
      padding: EdgeInsets.only(left:24, right:24, top:8, bottom:MediaQuery.viewInsetsOf(context).bottom+24),
      child: Form(key:_key, child: Column(mainAxisSize:MainAxisSize.min, crossAxisAlignment:CrossAxisAlignment.start, children:[
        Text('Nuevo estudiante', style:Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.bold)),
        const SizedBox(height:20),
        Row(children:[
          Expanded(child: SmInput(label:'Nombre', hint:'Carlos', controller:_first,
              validator:(v)=>v==null||v.isEmpty?'Requerido':null)),
          const SizedBox(width:12),
          Expanded(child: SmInput(label:'Apellido', hint:'García', controller:_last,
              validator:(v)=>v==null||v.isEmpty?'Requerido':null)),
        ]),
        const SizedBox(height:16),
        if (teams.isNotEmpty)
          SmSelect<String>(label:'Equipo (opcional)', value:_teamId,
            hint: 'Sin equipo',
            options: teams.map((t)=>SmSelectOption(value:t.id, label:'${t.name} · ${t.category}')).toList(),
            onChanged:(v)=>setState(()=>_teamId=v)),
        const SizedBox(height:24),
        SmButton(label:'Agregar estudiante', variant:SmButtonVariant.primary, fullWidth:true, loading:_loading,
          onPressed: () async {
            if (!_key.currentState!.validate()) {
              return;
            }
            setState(()=>_loading=true);
            try {
              final s = await ref.read(studentsProvider.notifier).createStudent(
                firstName: _first.text.trim(), lastName: _last.text.trim(), teamId: _teamId);
              if (s != null && mounted) {
                widget.onCreated(s);
              }
            } finally {
              if (mounted) {
                setState(() => _loading = false);
              }
            }
          }),
      ])),
    );
  }
}

// ─────────────────────────────────────────
// STUDENT PROGRESS DETAIL SCREEN
// ─────────────────────────────────────────
class StudentProgressScreen extends StatefulWidget {
  final SmStudent student;
  const StudentProgressScreen({super.key, required this.student});
  @override State<StudentProgressScreen> createState() => _StudentProgressScreenState();
}

class _StudentProgressScreenState extends State<StudentProgressScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  @override void initState() { super.initState(); _tabs = TabController(length: 3, vsync: this); }
  @override void dispose()   { _tabs.dispose(); super.dispose(); }

  // Mock weekly attendance
  final _weeklyAtt = [
    const FlSpot(0, 75), const FlSpot(1, 80), const FlSpot(2, 85),
    const FlSpot(3, 78), const FlSpot(4, 90), const FlSpot(5, 88),
    const FlSpot(6, 87)
  ];

  // Mock performance metrics
  final _metrics = [
    const _PerformanceMetric('Velocidad',   78, Icons.speed_outlined,         Color(0xFF3B82F6)),
    const _PerformanceMetric('Resistencia', 85, Icons.favorite_border,        Color(0xFF22C55E)),
    const _PerformanceMetric('Técnica',     72, Icons.sports_soccer_outlined,  SmColors.primary),
    const _PerformanceMetric('Táctica',     68, Icons.psychology_outlined,     Color(0xFF8B5CF6)),
    const _PerformanceMetric('Actitud',     95, Icons.emoji_emotions_outlined, Color(0xFFFB9F1E)),
  ];

  @override
  Widget build(BuildContext context) {
    final s = widget.student;
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverAppBar(
            expandedHeight: 200, pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                    colors: [Color(0xFF0A1F0A), Color(0xFF248223)],
                  ),
                ),
                child: SafeArea(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const SizedBox(height: 40),
                  SmAvatar(name: s.fullName, imageUrl: s.avatarUrl, size: 72,
                      backgroundColor: Colors.white.withValues(alpha: 0.2)),
                  const SizedBox(height: 12),
                  Text(s.fullName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
                  if (s.teamName != null)
                    Text(s.teamName!, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                ])),
              ),
            ),
            bottom: TabBar(
              controller: _tabs,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              indicatorColor: const Color(0xFFFB9F1E),
              tabs: const [Tab(text: 'Resumen'), Tab(text: 'Asistencia'), Tab(text: 'Rendimiento')],
            ),
          ),
        ],
        body: TabBarView(controller: _tabs, children: [
          _overviewTab(s),
          _attendanceTab(),
          _performanceTab(),
        ]),
      ),
    );
  }

  Widget _overviewTab(SmStudent s) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(children: [
      GridView.count(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12,
          childAspectRatio: 1.5, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        children: [
          SmStatCard(title: 'Asistencia', value: '${s.attendanceRate.toStringAsFixed(0)}%',
              icon: Icons.fact_check_outlined, trend: s.attendanceRate >= 80 ? '+2% vs mes anterior' : '-3%', trendUp: s.attendanceRate >= 80),
          SmStatCard(title: 'Equipo', value: s.teamName ?? 'Sin equipo', icon: Icons.groups_outlined, iconColor: const Color(0xFF3B82F6)),
          const SmStatCard(title: 'Sesiones', value: '24', icon: Icons.calendar_today_outlined, iconColor: Color(0xFF8B5CF6), subtitle: 'Este mes'),
          const SmStatCard(title: 'Progreso', value: '72%', icon: Icons.trending_up, iconColor: Color(0xFFFB9F1E), subtitle: 'Objetivo mensual'),
        ],
      ),
      const SizedBox(height: 20),
      SmCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Información personal', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        _InfoRow(icon: Icons.badge_outlined, label: 'ID', value: s.id.substring(0, 8).toUpperCase()),
        if (s.birthDate != null) _InfoRow(icon: Icons.cake_outlined, label: 'Edad', value: '${DateTime.now().year - s.birthDate!.year} años'),
        if (s.teamName != null)  _InfoRow(icon: Icons.groups_outlined, label: 'Equipo', value: s.teamName!),
      ])),
      const SizedBox(height: 16),
      const SmCalendar(),
    ]),
  );

  Widget _attendanceTab() => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(children: [
      SmCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Tendencia semanal', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        const Text('Últimas 7 semanas', style: TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
        const SizedBox(height: 16),
        SizedBox(height: 160, child: SmLineChart(label: 'Asistencia %', spots: _weeklyAtt)),
      ])),
      const SizedBox(height: 16),
      SmCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Historial de sesiones', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SmBadge(label: 'Marzo 2026', variant: SmBadgeVariant.outline),
        ]),
        const SizedBox(height: 12),
        ..._buildAttendanceHistory(),
      ])),
    ]),
  );

  List<Widget> _buildAttendanceHistory() {
    final sessions = [
      {'date': '10 Mar, Lun', 'present': true,  'note': 'Excelente sesión'},
      {'date': '8 Mar, Sáb',  'present': true,  'note': null},
      {'date': '7 Mar, Vie',  'present': false, 'note': 'Enfermedad'},
      {'date': '5 Mar, Mié',  'present': true,  'note': null},
      {'date': '3 Mar, Lun',  'present': true,  'note': 'Llegó tarde 10 min'},
    ];
    return sessions.map((s) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Container(width: 32, height: 32,
          decoration: BoxDecoration(
            color: (s['present'] as bool) ? const Color(0xFF22C55E).withValues(alpha: 0.1) : const Color(0xFFEF4444).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon((s['present'] as bool) ? Icons.check : Icons.close, size: 16,
              color: (s['present'] as bool) ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s['date'] as String, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
          if (s['note'] != null)
            Text(s['note'] as String, style: const TextStyle(fontSize: 11, color: SmColors.mutedForeground)),
        ])),
        SmBadge(
          label: (s['present'] as bool) ? 'Presente' : 'Ausente',
          variant: (s['present'] as bool) ? SmBadgeVariant.primary : SmBadgeVariant.destructive,
        ),
      ]),
    )).toList();
  }

  Widget _performanceTab() => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(children: [
      SmCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Métricas de rendimiento', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        const Text('Evaluación más reciente — 8 Mar 2026', style: TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
        const SizedBox(height: 16),
        ..._metrics.map((m) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(m.icon, size: 16, color: m.color),
              const SizedBox(width: 8),
              Expanded(child: Text(m.label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13))),
              Text('${m.value}', style: TextStyle(color: m.color, fontWeight: FontWeight.bold, fontSize: 14)),
            ]),
            const SizedBox(height: 6),
            SmProgress(value: m.value / 100, color: m.color),
          ]),
        )),
      ])),
      const SizedBox(height: 16),
      SmCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Notas del entrenador', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        const _NoteCard(date: '8 Mar', author: 'Coach Torres', text: 'Excelente actitud esta semana. Mejorar posicionamiento defensivo en las transiciones.'),
        const _NoteCard(date: '1 Mar', author: 'Coach Torres', text: 'Buena sesión de técnica. Se nota el esfuerzo extra en casa.'),
      ])),
    ]),
  );
}

class _PerformanceMetric {
  final String label; final int value; final IconData icon; final Color color;
  const _PerformanceMetric(this.label, this.value, this.icon, this.color);
}

class _InfoRow extends StatelessWidget {
  final IconData icon; final String label, value;
  const _InfoRow({required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Icon(icon, size: 16, color: SmColors.mutedForeground),
      const SizedBox(width: 8),
      Text('$label: ', style: const TextStyle(fontSize: 13, color: SmColors.mutedForeground)),
      Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
    ]),
  );
}

class _NoteCard extends StatelessWidget {
  final String date, author, text;
  const _NoteCard({required this.date, required this.author, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: SmColors.muted,
      borderRadius: BorderRadius.circular(8),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        SmAvatar(name: author, size: 24),
        const SizedBox(width: 8),
        Text(author, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
        const Spacer(),
        Text(date, style: const TextStyle(fontSize: 11, color: SmColors.mutedForeground)),
      ]),
      const SizedBox(height: 8),
      Text(text, style: const TextStyle(fontSize: 13, height: 1.5)),
    ]),
  );
}
