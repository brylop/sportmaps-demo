// ============================================================
// SportMaps — Supabase Data Providers (Riverpod)
// Teams · Students · Events · Attendance · Notifications
// Reemplaza: react-query hooks + Supabase client calls
// ============================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'auth_provider.dart';

// ════════════════════════════════════════════════════════════
// MODELOS
// ════════════════════════════════════════════════════════════

class SmTeam {
  final String id;
  final String name;
  final String sport;
  final String category; // Sub-14, Sub-16, etc.
  final String? coachId;
  final String? coachName;
  final String? logoUrl;
  final int playerCount;
  final String schoolId;
  final bool active;

  const SmTeam({
    required this.id,
    required this.name,
    required this.sport,
    required this.category,
    this.coachId,
    this.coachName,
    this.logoUrl,
    required this.playerCount,
    required this.schoolId,
    required this.active,
  });

  factory SmTeam.fromMap(Map<String, dynamic> m) => SmTeam(
        id: m['id'] as String,
        name: m['name'] as String,
        sport: m['sport'] as String? ?? 'Fútbol',
        category: m['category'] as String? ?? '',
        coachId: m['coach_id'] as String?,
        coachName: m['coach_name'] as String?,
        logoUrl: m['logo_url'] as String?,
        playerCount: m['player_count'] as int? ?? 0,
        schoolId: m['school_id'] as String,
        active: m['active'] as bool? ?? true,
      );
}

class SmStudent {
  final String id;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final DateTime? birthDate;
  final String? teamId;
  final String? teamName;
  final String schoolId;
  final double attendanceRate;
  final String? guardianId;

  const SmStudent({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    this.birthDate,
    this.teamId,
    this.teamName,
    required this.schoolId,
    required this.attendanceRate,
    this.guardianId,
  });

  String get fullName => '$firstName $lastName'.trim();
  String get initials {
    final p = fullName.split(' ');
    return p.length >= 2
        ? '${p.first[0]}${p.last[0]}'.toUpperCase()
        : p.first[0].toUpperCase();
  }

  factory SmStudent.fromMap(Map<String, dynamic> m) => SmStudent(
        id: m['id'] as String,
        firstName: m['first_name'] as String? ?? '',
        lastName: m['last_name'] as String? ?? '',
        avatarUrl: m['avatar_url'] as String?,
        birthDate: m['birth_date'] != null
            ? DateTime.tryParse(m['birth_date'] as String)
            : null,
        teamId: m['team_id'] as String?,
        teamName: m['team_name'] as String?,
        schoolId: m['school_id'] as String,
        attendanceRate: (m['attendance_rate'] as num?)?.toDouble() ?? 0,
        guardianId: m['guardian_id'] as String?,
      );
}

class SmEvent {
  final String id;
  final String title;
  final String? description;
  final DateTime startDate;
  final DateTime? endDate;
  final String? location;
  final double? lat;
  final double? lng;
  final String type; // tournament, training, match, other
  final String? teamId;
  final String schoolId;
  final bool isPublic;
  final int? capacity;
  final int registeredCount;

  const SmEvent({
    required this.id,
    required this.title,
    this.description,
    required this.startDate,
    this.endDate,
    this.location,
    this.lat,
    this.lng,
    required this.type,
    this.teamId,
    required this.schoolId,
    required this.isPublic,
    this.capacity,
    required this.registeredCount,
  });

  bool get isFull => capacity != null && registeredCount >= capacity!;
  bool get isUpcoming => startDate.isAfter(DateTime.now());
  bool get isPast => startDate.isBefore(DateTime.now());

  factory SmEvent.fromMap(Map<String, dynamic> m) => SmEvent(
        id: m['id'] as String,
        title: m['title'] as String,
        description: m['description'] as String?,
        startDate: DateTime.parse(m['start_date'] as String),
        endDate: m['end_date'] != null
            ? DateTime.tryParse(m['end_date'] as String)
            : null,
        location: m['location'] as String?,
        lat: (m['lat'] as num?)?.toDouble(),
        lng: (m['lng'] as num?)?.toDouble(),
        type: m['type'] as String? ?? 'other',
        teamId: m['team_id'] as String?,
        schoolId: m['school_id'] as String,
        isPublic: m['is_public'] as bool? ?? false,
        capacity: m['capacity'] as int?,
        registeredCount: m['registered_count'] as int? ?? 0,
      );
}

class SmAttendanceRecord {
  final String id;
  final String studentId;
  final String studentName;
  final String? avatarUrl;
  final String sessionId;
  final DateTime date;
  final bool present;
  final String? note;

  const SmAttendanceRecord({
    required this.id,
    required this.studentId,
    required this.studentName,
    this.avatarUrl,
    required this.sessionId,
    required this.date,
    required this.present,
    this.note,
  });

  factory SmAttendanceRecord.fromMap(Map<String, dynamic> m) =>
      SmAttendanceRecord(
        id: m['id'] as String,
        studentId: m['student_id'] as String,
        studentName: m['student_name'] as String? ?? '',
        avatarUrl: m['avatar_url'] as String?,
        sessionId: m['session_id'] as String,
        date: DateTime.parse(m['date'] as String),
        present: m['present'] as bool? ?? false,
        note: m['note'] as String?,
      );
}

class SmNotification {
  final String id;
  final String title;
  final String body;
  final String type; // info, success, warning, alert
  final bool read;
  final DateTime createdAt;
  final String? actionUrl;

  const SmNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.read,
    required this.createdAt,
    this.actionUrl,
  });

  factory SmNotification.fromMap(Map<String, dynamic> m) => SmNotification(
        id: m['id'] as String,
        title: m['title'] as String,
        body: m['body'] as String,
        type: m['type'] as String? ?? 'info',
        read: m['read'] as bool? ?? false,
        createdAt: DateTime.parse(m['created_at'] as String),
        actionUrl: m['action_url'] as String?,
      );
}

// ════════════════════════════════════════════════════════════
// TEAMS PROVIDER
// ════════════════════════════════════════════════════════════
final teamsProvider =
    AsyncNotifierProvider<TeamsNotifier, List<SmTeam>>(TeamsNotifier.new);

class TeamsNotifier extends AsyncNotifier<List<SmTeam>> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);

  @override
  Future<List<SmTeam>> build() async {
    final profile = ref.watch(currentProfileProvider);
    if (profile == null) {
      return [];
    }
    return _fetchTeams(profile);
  }

  Future<List<SmTeam>> _fetchTeams(SmUserProfile profile) async {
    var query = _sb
        .from('teams')
        .select('*, profiles!coach_id(first_name, last_name)')
        .eq('school_id', profile.schoolId ?? '')
        .eq('active', true);

    // Coach solo ve sus equipos
    if (profile.role == SmUserRole.coach) {
      query = query.eq('coach_id', profile.id);
    }

    final data = await query.order('name') as List<dynamic>;
    return data.map((m) {
      final map = m as Map<String, dynamic>;
      final coach = map['profiles'] as Map<String, dynamic>?;
      return SmTeam.fromMap({
        ...map,
        if (coach != null)
          'coach_name': '${coach['first_name']} ${coach['last_name']}',
      });
    }).toList();
  }

  Future<void> refresh() async {
    final profile = ref.read(currentProfileProvider);
    if (profile == null) {
      return;
    }
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchTeams(profile));
  }

  Future<SmTeam?> createTeam({
    required String name,
    required String sport,
    required String category,
    String? coachId,
  }) async {
    final profile = ref.read(currentProfileProvider);
    if (profile == null) {
      return null;
    }

    final data = await _sb
        .from('teams')
        .insert({
          'name': name,
          'sport': sport,
          'category': category,
          'coach_id': coachId ?? profile.id,
          'school_id': profile.schoolId,
          'active': true,
        })
        .select()
        .single();

    final team = SmTeam.fromMap(data);
    state = AsyncValue.data([...state.value ?? [], team]);
    return team;
  }

  Future<void> deleteTeam(String teamId) async {
    await _sb.from('teams').delete().eq('id', teamId);
    state = AsyncValue.data(
      (state.value ?? []).where((t) => t.id != teamId).toList(),
    );
  }
}

// Selector — equipo por ID
final teamByIdProvider = Provider.family<SmTeam?, String>((ref, id) {
  return ref
      .watch(teamsProvider)
      .valueOrNull
      ?.firstWhere((t) => t.id == id, orElse: () => throw StateError(''));
});

// ════════════════════════════════════════════════════════════
// STUDENTS PROVIDER
// ════════════════════════════════════════════════════════════
final studentsProvider =
    AsyncNotifierProvider<StudentsNotifier, List<SmStudent>>(
        StudentsNotifier.new);

class StudentsNotifier extends AsyncNotifier<List<SmStudent>> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);

  @override
  Future<List<SmStudent>> build() async {
    final profile = ref.watch(currentProfileProvider);
    if (profile == null) {
      return [];
    }
    return _fetch(profile);
  }

  Future<List<SmStudent>> _fetch(SmUserProfile profile) async {
    // Padre: solo sus hijos
    if (profile.role == SmUserRole.parent) {
      final data = await _sb
          .from('students')
          .select('*, teams(name)')
          .eq('guardian_id', profile.id)
          .order('first_name') as List<dynamic>;
      return _map(data);
    }

    // Coach: estudiantes de sus equipos
    if (profile.role == SmUserRole.coach) {
      final data = await _sb
          .from('students')
          .select('*, teams!inner(name, coach_id)')
          .eq('teams.coach_id', profile.id)
          .order('first_name') as List<dynamic>;
      return _map(data);
    }

    // Admin / SchoolAdmin: todos los de la escuela
    final data = await _sb
        .from('students')
        .select('*, teams(name)')
        .eq('school_id', profile.schoolId ?? '')
        .order('first_name') as List<dynamic>;
    return _map(data);
  }

  List<SmStudent> _map(List<dynamic> data) => data.map((m) {
        final row = m as Map<String, dynamic>;
        final team = row['teams'] as Map<String, dynamic>?;
        return SmStudent.fromMap({
          ...row,
          if (team != null) 'team_name': team['name'],
        });
      }).toList();

  Future<void> refresh() async {
    final p = ref.read(currentProfileProvider);
    if (p == null) {
      return;
    }
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetch(p));
  }

  Future<SmStudent?> createStudent({
    required String firstName,
    required String lastName,
    String? teamId,
    DateTime? birthDate,
  }) async {
    final profile = ref.read(currentProfileProvider);
    if (profile == null) {
      return null;
    }

    final data = await _sb
        .from('students')
        .insert({
          'first_name': firstName,
          'last_name': lastName,
          'school_id': profile.schoolId,
          'team_id': teamId,
          if (birthDate != null) 'birth_date': birthDate.toIso8601String(),
        })
        .select()
        .single();

    final student = SmStudent.fromMap(data);
    state = AsyncValue.data([...state.value ?? [], student]);
    return student;
  }
}

// Estudiantes filtrados por equipo
final studentsByTeamProvider =
    Provider.family<List<SmStudent>, String>((ref, teamId) {
  return ref
          .watch(studentsProvider)
          .valueOrNull
          ?.where((s) => s.teamId == teamId)
          .toList() ??
      [];
});

// ════════════════════════════════════════════════════════════
// EVENTS PROVIDER
// ════════════════════════════════════════════════════════════
final eventsProvider =
    AsyncNotifierProvider<EventsNotifier, List<SmEvent>>(EventsNotifier.new);

class EventsNotifier extends AsyncNotifier<List<SmEvent>> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);

  @override
  Future<List<SmEvent>> build() async {
    final profile = ref.watch(currentProfileProvider);
    if (profile == null) {
      return [];
    }
    return _fetch(profile);
  }

  Future<List<SmEvent>> _fetch(SmUserProfile profile) async {
    final now = DateTime.now().toIso8601String();
    final data = await _sb
        .from('events')
        .select()
        .eq('school_id', profile.schoolId ?? '')
        .gte('start_date', now)
        .order('start_date') as List<dynamic>;
    return data.map((m) => SmEvent.fromMap(m as Map<String, dynamic>)).toList();
  }

  Future<void> refresh() async {
    final p = ref.read(currentProfileProvider);
    if (p == null) {
      return;
    }
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetch(p));
  }

  Future<SmEvent?> createEvent({
    required String title,
    required DateTime startDate,
    required String type,
    String? description,
    String? location,
    double? lat,
    double? lng,
    bool isPublic = false,
    int? capacity,
  }) async {
    final profile = ref.read(currentProfileProvider);
    if (profile == null) {
      return null;
    }

    final data = await _sb
        .from('events')
        .insert({
          'title': title,
          'description': description,
          'start_date': startDate.toIso8601String(),
          'type': type,
          'school_id': profile.schoolId,
          'location': location,
          'lat': lat,
          'lng': lng,
          'is_public': isPublic,
          'capacity': capacity,
        })
        .select()
        .single();

    final event = SmEvent.fromMap(data);
    state = AsyncValue.data([...state.value ?? [], event]);
    return event;
  }
}

// Próximos 7 días
final upcomingEventsProvider = Provider<List<SmEvent>>((ref) {
  final now = DateTime.now();
  final week = now.add(const Duration(days: 7));
  return ref
          .watch(eventsProvider)
          .valueOrNull
          ?.where((e) => e.startDate.isAfter(now) && e.startDate.isBefore(week))
          .toList() ??
      [];
});

// ════════════════════════════════════════════════════════════
// ATTENDANCE PROVIDER
// ════════════════════════════════════════════════════════════

// Parámetro para filtrar por sesión
class AttendanceParams {
  final String teamId;
  final String sessionId;
  const AttendanceParams({required this.teamId, required this.sessionId});
  @override
  bool operator ==(Object other) =>
      other is AttendanceParams &&
      other.teamId == teamId &&
      other.sessionId == sessionId;
  @override
  int get hashCode => Object.hash(teamId, sessionId);
}

final attendanceProvider = AsyncNotifierProviderFamily<AttendanceNotifier,
    List<SmAttendanceRecord>, AttendanceParams>(
  AttendanceNotifier.new,
);

class AttendanceNotifier
    extends FamilyAsyncNotifier<List<SmAttendanceRecord>, AttendanceParams> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);

  @override
  Future<List<SmAttendanceRecord>> build(AttendanceParams arg) async {
    final data = await _sb
        .from('attendance')
        .select('*, students(first_name, last_name, avatar_url)')
        .eq('session_id', arg.sessionId)
        .order('student_name') as List<dynamic>;

    return data.map((m) {
      final row = m as Map<String, dynamic>;
      final student = row['students'] as Map<String, dynamic>?;
      return SmAttendanceRecord.fromMap({
        ...row,
        if (student != null) ...{
          'student_name': '${student['first_name']} ${student['last_name']}',
          'avatar_url': student['avatar_url'],
        },
      });
    }).toList();
  }

  Future<void> markAttendance({
    required String studentId,
    required bool present,
    String? note,
  }) async {
    final sessionId = arg.sessionId;

    await _sb.from('attendance').upsert({
      'session_id': sessionId,
      'student_id': studentId,
      'present': present,
      'date': DateTime.now().toIso8601String(),
      if (note != null) 'note': note,
    }, onConflict: 'session_id,student_id');

    // Actualizar estado local sin re-fetch
    state = AsyncValue.data(
      (state.value ?? []).map((r) {
        if (r.studentId == studentId) {
          return SmAttendanceRecord(
            id: r.id,
            studentId: r.studentId,
            studentName: r.studentName,
            avatarUrl: r.avatarUrl,
            sessionId: r.sessionId,
            date: DateTime.now(),
            present: present,
            note: note ?? r.note,
          );
        }
        return r;
      }).toList(),
    );
  }

  Future<void> markAll(bool present) async {
    final records = state.value ?? [];
    await Future.wait(records.map(
      (r) => markAttendance(studentId: r.studentId, present: present),
    ));
  }
}

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS PROVIDER (con Realtime)
// ════════════════════════════════════════════════════════════
final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<SmNotification>>(
        NotificationsNotifier.new);

class NotificationsNotifier extends AsyncNotifier<List<SmNotification>> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);
  RealtimeChannel? _channel;

  @override
  Future<List<SmNotification>> build() async {
    final profile = ref.watch(currentProfileProvider);
    if (profile == null) {
      return [];
    }

    final data = await _sb
        .from('notifications')
        .select()
        .eq('user_id', profile.id)
        .order('created_at', ascending: false)
        .limit(50) as List<dynamic>;

    final notifications = data
        .map((m) => SmNotification.fromMap(m as Map<String, dynamic>))
        .toList();

    // Suscribir a nuevas notificaciones en tiempo real
    _subscribeRealtime(profile.id);

    return notifications;
  }

  void _subscribeRealtime(String userId) {
    _channel?.unsubscribe();
    _channel = _sb
        .channel('notifications:$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'notifications',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final newNotif = SmNotification.fromMap(payload.newRecord);
            state = AsyncValue.data([newNotif, ...state.value ?? []]);
          },
        )
        .subscribe();
  }

  Future<void> markRead(String id) async {
    await _sb.from('notifications').update({'read': true}).eq('id', id);

    state = AsyncValue.data(
      (state.value ?? []).map((n) {
        return n.id == id
            ? SmNotification(
                id: n.id,
                title: n.title,
                body: n.body,
                type: n.type,
                read: true,
                createdAt: n.createdAt,
                actionUrl: n.actionUrl,
              )
            : n;
      }).toList(),
    );
  }

  Future<void> markAllRead() async {
    final profile = ref.read(currentProfileProvider);
    if (profile == null) {
      return;
    }

    await _sb
        .from('notifications')
        .update({'read': true})
        .eq('user_id', profile.id)
        .eq('read', false);

    state = AsyncValue.data(
      (state.value ?? [])
          .map((n) => SmNotification(
                id: n.id,
                title: n.title,
                body: n.body,
                type: n.type,
                read: true,
                createdAt: n.createdAt,
                actionUrl: n.actionUrl,
              ))
          .toList(),
    );
  }

  int get unreadCount => (state.value ?? []).where((n) => !n.read).length;
}

// Unread count — usado en AppBar badge
final unreadNotificationsProvider = Provider<int>((ref) {
  return ref
          .watch(notificationsProvider)
          .valueOrNull
          ?.where((n) => !n.read)
          .length ??
      0;
});

// ════════════════════════════════════════════════════════════
// DASHBOARD STATS PROVIDER
// Agrega datos de múltiples tablas para el KPI panel
// ════════════════════════════════════════════════════════════
class DashboardStats {
  final int totalStudents;
  final int activeTeams;
  final double avgAttendance;
  final int upcomingEvents;
  final double revenueMonth;
  final int pendingPayments;

  const DashboardStats({
    required this.totalStudents,
    required this.activeTeams,
    required this.avgAttendance,
    required this.upcomingEvents,
    required this.revenueMonth,
    required this.pendingPayments,
  });
}

final dashboardStatsProvider = FutureProvider<DashboardStats>((ref) async {
  final profile = ref.watch(currentProfileProvider);
  if (profile == null) {
    return const DashboardStats(
        totalStudents: 0,
        activeTeams: 0,
        avgAttendance: 0,
        upcomingEvents: 0,
        revenueMonth: 0,
        pendingPayments: 0);
  }

  final sb = ref.read(supabaseClientProvider);

  // Paralelo: todas las queries al mismo tiempo
  final results = await Future.wait([
    // 0: conteo de estudiantes
    sb.from('students').select('id').eq('school_id', profile.schoolId ?? ''),

    // 1: equipos activos
    sb
        .from('teams')
        .select('id')
        .eq('school_id', profile.schoolId ?? '')
        .eq('active', true),

    // 2: promedio de asistencia
    sb.rpc<double>('get_avg_attendance',
        params: {'school_id': profile.schoolId}),

    // 3: eventos próximos
    sb
        .from('events')
        .select('id')
        .eq('school_id', profile.schoolId ?? '')
        .gte('start_date', DateTime.now().toIso8601String()),

    // 4 & 5: finanzas (solo admin)
    if (profile.role == SmUserRole.admin ||
        profile.role == SmUserRole.schoolAdmin)
      sb.rpc<double>('get_monthly_revenue',
          params: {'school_id': profile.schoolId}),
    if (profile.role == SmUserRole.admin ||
        profile.role == SmUserRole.schoolAdmin)
      sb
          .from('payments')
          .select('id')
          .eq('school_id', profile.schoolId ?? '')
          .eq('status', 'pending'),
  ]);

  final studentsResp = results[0] as List<dynamic>;
  final teamsResp = results[1] as List<dynamic>;
  final avgAtt = results[2] as double?;
  final eventsResp = results[3] as List<dynamic>;

  return DashboardStats(
    totalStudents: studentsResp.length,
    activeTeams: teamsResp.length,
    avgAttendance: avgAtt ?? 0.0,
    upcomingEvents: eventsResp.length,
    revenueMonth: results.length > 4 ? (results[4] as double?) ?? 0.0 : 0.0,
    pendingPayments:
        results.length > 5 ? (results[5] as List<dynamic>).length : 0,
  );
});
