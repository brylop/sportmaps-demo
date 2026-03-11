// ============================================================
// SportMaps — Router FINAL
// GoRouter + ShellRoute + SmAdaptiveScaffold + guards de rol
// Todas las pantallas reales conectadas — sin stubs
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'sm_routes.dart';

import '../providers/auth_provider.dart';
import '../providers/data_providers.dart';
import 'package:sportmaps/platform/sm_adaptive_scaffold.dart';

// Pantallas públicas
import '../screens/login_explore_screens.dart';

// Pantallas autenticadas
import '../screens/dashboard_screen.dart';
import '../screens/teams_attendance_screens.dart';
import '../screens/children_screen.dart';
import '../screens/finance_screen.dart';
import '../screens/notifications_profile_settings_screens.dart';
import '../screens/events_messages_performance_screens.dart';

export 'sm_routes.dart'; // SmRoutes — fuente única de rutas

// ─────────────────────────────────────────
// ROUTER PROVIDER
// ─────────────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final authAsync = ref.watch(authProvider);

  return GoRouter(
    initialLocation: SmRoutes.landing,
    debugLogDiagnostics: false,

    redirect: (context, state) {
      final path = state.uri.path;
      if (authAsync.isLoading) {
        return null;
      }

      final authState  = authAsync.valueOrNull;
      final isLoggedIn = authState is SmAuthAuthenticated;

      final publicPaths = {
        SmRoutes.landing, SmRoutes.login,
        SmRoutes.register, SmRoutes.forgotPassword,
      };
      final isPublic = publicPaths.contains(path) ||
          path.startsWith('/s/') || path.startsWith('/event/') ||
          path.startsWith('/invite');

      if (!isLoggedIn && !isPublic) {
        return SmRoutes.login;
      }
      if (isLoggedIn && (path == SmRoutes.login ||
           path == SmRoutes.landing || path == SmRoutes.register)) {
        return SmRoutes.dashboard;
      }
      if (isLoggedIn &&
          authState.profile.role == SmUserRole.coach &&
          !authState.profile.profileComplete &&
          path != '/profile/wizard') {
        return '/profile/wizard';
      }

      return null;
    },

    routes: [
      // ── PÚBLICAS ─────────────────────────────────────────
      GoRoute(path: SmRoutes.landing,
          builder: (_, __) => const _LandingPage()),
      GoRoute(path: SmRoutes.login,
          builder: (_, __) => _LoginPageWrapper()),
      GoRoute(path: SmRoutes.register,
          builder: (_, __) => const _RegisterPage()),
      GoRoute(path: SmRoutes.forgotPassword,
          builder: (_, __) => const _ForgotPasswordPage()),
      GoRoute(path: SmRoutes.invite,
          builder: (_, s) =>
              _InvitePage(code: s.uri.queryParameters['invite'] ?? '')),
      GoRoute(path: SmRoutes.schoolSlug,
          builder: (_, s) =>
              _SchoolPublicPage(slug: s.pathParameters['slug']!)),
      GoRoute(path: SmRoutes.eventSlug,
          builder: (_, s) =>
              _EventPublicPage(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/profile/wizard',
          builder: (_, __) => const _ProfileWizardPage()),

      // ── SHELL AUTENTICADO ─────────────────────────────────
      ShellRoute(
        builder: (context, state, child) =>
            _AuthShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(path: SmRoutes.dashboard,
              builder: (_, __) => const DashboardPage()),
          GoRoute(path: SmRoutes.explore,
              builder: (_, __) => const ExploreScreen()),
          GoRoute(path: SmRoutes.profile,
              builder: (_, __) => const ProfileScreen()),
          GoRoute(path: SmRoutes.notifications,
              builder: (_, __) => const NotificationsScreen()),
          GoRoute(path: SmRoutes.settings,
              builder: (_, __) => const SettingsScreen()),

          GoRoute(path: SmRoutes.messages,
              builder: (_, __) => const MessagesScreen()),
          // Nota: MessageThreadScreen se navega con Navigator.push desde MessagesScreen
          // ya que usa SmMockThread (tipo interno). Deep link por thread ID pendiente.

          GoRoute(path: SmRoutes.children,
              builder: (_, __) => const ChildrenScreen(),
              routes: [
                GoRoute(path: ':id',
                    builder: (_, s) =>
                        _ChildWrapper(id: s.pathParameters['id']!),
                    routes: [
                      GoRoute(path: 'progress',
                          builder: (_, s) =>
                              _ChildWrapper(id: s.pathParameters['id']!)),
                    ]),
              ]),

          GoRoute(path: SmRoutes.teams,
              builder: (_, __) => const TeamsScreen(),
              routes: [
                GoRoute(path: ':id',
                    builder: (_, s) =>
                        _TeamDetailPage(id: s.pathParameters['id']!)),
              ]),

          GoRoute(path: SmRoutes.attendance,
              redirect: (ctx, _) => _guardRoles(ctx,
                  [SmUserRole.coach, SmUserRole.admin, SmUserRole.schoolAdmin]),
              builder: (_, __) => const AttendanceScreen()),

          GoRoute(path: SmRoutes.events,
              builder: (_, __) => const EventsScreen(),
              routes: [
                GoRoute(path: ':id',
                    builder: (_, s) =>
                        _EventDetailPage(id: s.pathParameters['id']!)),
              ]),

          GoRoute(path: SmRoutes.finance,
              redirect: (ctx, _) => _guardRoles(ctx,
                  [SmUserRole.admin, SmUserRole.schoolAdmin, SmUserRole.superAdmin]),
              builder: (_, __) => const FinanceScreen()),
          GoRoute(path: SmRoutes.checkout,
              builder: (_, __) => const _CheckoutPage()),

          GoRoute(path: SmRoutes.performance,
              builder: (_, __) => const PerformanceScreen()),

          GoRoute(path: SmRoutes.schools,
              redirect: (ctx, _) => _guardRoles(
                  ctx, [SmUserRole.admin, SmUserRole.superAdmin]),
              builder: (_, __) => const _SchoolsAdminPage(),
              routes: [
                GoRoute(path: ':id',
                    builder: (_, s) =>
                        _SchoolDetailPage(id: s.pathParameters['id']!)),
              ]),
          GoRoute(path: SmRoutes.users,
              redirect: (ctx, _) => _guardRoles(
                  ctx, [SmUserRole.admin, SmUserRole.superAdmin]),
              builder: (_, __) => const _UsersAdminPage()),
          GoRoute(path: SmRoutes.training,
              redirect: (ctx, _) =>
                  _guardRoles(ctx, [SmUserRole.coach, SmUserRole.admin]),
              builder: (_, __) => const _TrainingPage()),
        ],
      ),
    ],

    errorBuilder: (_, state) => _ErrorPage(error: state.error),
  );
});

// ─────────────────────────────────────────
// GUARD DE ROL
// ─────────────────────────────────────────
String? _guardRoles(BuildContext context, List<SmUserRole> allowed) {
  final container = ProviderScope.containerOf(context);
  final profile   = container.read(currentProfileProvider);
  if (profile == null) {
    return SmRoutes.login;
  }
  if (!allowed.contains(profile.role)) {
    return SmRoutes.dashboard;
  }
  return null;
}

// ─────────────────────────────────────────
// AUTH SHELL
// ─────────────────────────────────────────
class _AuthShell extends ConsumerWidget {
  final String location;
  final Widget child;
  const _AuthShell({required this.location, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider);
    final role    = profile?.role ?? SmUserRole.guest;
    final unread  = ref.watch(unreadNotificationsProvider);
    final dests   = _destsForRole(role);
    final routes  = _routesForRole(role);

    int idx = 0;
    for (int i = 0; i < routes.length; i++) {
      if (location.startsWith(routes[i])) {
        idx = i;
        break;
      }
    }

    return SmAdaptiveScaffold(
      destinations:          dests,
      selectedIndex:         idx,
      title:                 _titleFor(location),
      onDestinationSelected: (i) => context.go(routes[i]),
      appBarActions: [
        _NotifBell(count: unread),
        _AvatarButton(profile: profile),
        const SizedBox(width: 4),
      ],
      body: child,
    );
  }

  List<SmNavDestinationDef> _destsForRole(SmUserRole role) =>
      switch (role) {
        SmUserRole.admin || SmUserRole.superAdmin => const [
          SmNavDestinationDef(icon: Icons.dashboard_outlined,    selectedIcon: Icons.dashboard,    label: 'Panel'),
          SmNavDestinationDef(icon: Icons.school_outlined,       selectedIcon: Icons.school,       label: 'Escuelas'),
          SmNavDestinationDef(icon: Icons.people_outline,        selectedIcon: Icons.people,       label: 'Usuarios'),
          SmNavDestinationDef(icon: Icons.attach_money_outlined, selectedIcon: Icons.attach_money, label: 'Finanzas'),
          SmNavDestinationDef(icon: Icons.settings_outlined,     selectedIcon: Icons.settings,     label: 'Config'),
        ],
        SmUserRole.coach => const [
          SmNavDestinationDef(icon: Icons.dashboard_outlined,  selectedIcon: Icons.dashboard,  label: 'Inicio'),
          SmNavDestinationDef(icon: Icons.groups_outlined,     selectedIcon: Icons.groups,     label: 'Equipos'),
          SmNavDestinationDef(icon: Icons.fact_check_outlined, selectedIcon: Icons.fact_check, label: 'Asistencia'),
          SmNavDestinationDef(icon: Icons.bar_chart_outlined,  selectedIcon: Icons.bar_chart,  label: 'Stats'),
          SmNavDestinationDef(icon: Icons.chat_bubble_outline, selectedIcon: Icons.chat_bubble,label: 'Mensajes'),
        ],
        SmUserRole.parent => const [
          SmNavDestinationDef(icon: Icons.home_outlined,         selectedIcon: Icons.home,         label: 'Inicio'),
          SmNavDestinationDef(icon: Icons.child_care_outlined,   selectedIcon: Icons.child_care,   label: 'Mis hijos'),
          SmNavDestinationDef(icon: Icons.event_outlined,        selectedIcon: Icons.event,        label: 'Eventos'),
          SmNavDestinationDef(icon: Icons.receipt_long_outlined, selectedIcon: Icons.receipt_long, label: 'Pagos'),
          SmNavDestinationDef(icon: Icons.chat_bubble_outline,   selectedIcon: Icons.chat_bubble,  label: 'Mensajes'),
        ],
        SmUserRole.schoolAdmin => const [
          SmNavDestinationDef(icon: Icons.dashboard_outlined,    selectedIcon: Icons.dashboard,    label: 'Panel'),
          SmNavDestinationDef(icon: Icons.groups_outlined,       selectedIcon: Icons.groups,       label: 'Equipos'),
          SmNavDestinationDef(icon: Icons.school_outlined,       selectedIcon: Icons.people,       label: 'Estudiantes'),
          SmNavDestinationDef(icon: Icons.attach_money_outlined, selectedIcon: Icons.attach_money, label: 'Finanzas'),
          SmNavDestinationDef(icon: Icons.event_outlined,        selectedIcon: Icons.event,        label: 'Eventos'),
        ],
        _ => const [
          SmNavDestinationDef(icon: Icons.dashboard_outlined,  selectedIcon: Icons.dashboard,  label: 'Inicio'),
          SmNavDestinationDef(icon: Icons.explore_outlined,    selectedIcon: Icons.explore,    label: 'Explorar'),
          SmNavDestinationDef(icon: Icons.groups_outlined,     selectedIcon: Icons.groups,     label: 'Equipos'),
          SmNavDestinationDef(icon: Icons.chat_bubble_outline, selectedIcon: Icons.chat_bubble,label: 'Mensajes'),
          SmNavDestinationDef(icon: Icons.person_outline,      selectedIcon: Icons.person,     label: 'Perfil'),
        ],
      };

  List<String> _routesForRole(SmUserRole role) => switch (role) {
    SmUserRole.admin || SmUserRole.superAdmin =>
      [SmRoutes.dashboard, SmRoutes.schools,  SmRoutes.users,
       SmRoutes.finance,   SmRoutes.settings],
    SmUserRole.coach =>
      [SmRoutes.dashboard, SmRoutes.teams,    SmRoutes.attendance,
       SmRoutes.performance, SmRoutes.messages],
    SmUserRole.parent =>
      [SmRoutes.dashboard, SmRoutes.children, SmRoutes.events,
       SmRoutes.finance,   SmRoutes.messages],
    SmUserRole.schoolAdmin =>
      [SmRoutes.dashboard, SmRoutes.teams,    SmRoutes.children,
       SmRoutes.finance,   SmRoutes.events],
    _ =>
      [SmRoutes.dashboard, SmRoutes.explore,  SmRoutes.teams,
       SmRoutes.messages,  SmRoutes.profile],
  };

  String _titleFor(String loc) => switch (loc) {
    String l when l.startsWith('/dashboard')    => 'Dashboard',
    String l when l.startsWith('/explore')      => 'Explorar',
    String l when l.startsWith('/teams')        => 'Equipos',
    String l when l.startsWith('/children')     => 'Estudiantes',
    String l when l.startsWith('/events')       => 'Eventos',
    String l when l.startsWith('/messages')     => 'Mensajes',
    String l when l.startsWith('/finance')      => 'Finanzas',
    String l when l.startsWith('/schools')      => 'Escuelas',
    String l when l.startsWith('/users')        => 'Usuarios',
    String l when l.startsWith('/attendance')   => 'Asistencia',
    String l when l.startsWith('/performance')  => 'Rendimiento',
    String l when l.startsWith('/profile')      => 'Perfil',
    String l when l.startsWith('/settings')     => 'Configuración',
    String l when l.startsWith('/notifications')=> 'Notificaciones',
    _ => 'SportMaps',
  };
}

// ─────────────────────────────────────────
// APPBAR WIDGETS
// ─────────────────────────────────────────
class _NotifBell extends ConsumerWidget {
  final int count;
  const _NotifBell({required this.count});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Stack(
    clipBehavior: Clip.none,
    children: [
      IconButton(
        icon: Icon(count > 0
            ? Icons.notifications : Icons.notifications_outlined),
        onPressed: () => context.go(SmRoutes.notifications),
        tooltip: 'Notificaciones',
      ),
      if (count > 0) Positioned(top: 6, right: 6,
        child: Container(
          padding: const EdgeInsets.all(3),
          decoration: const BoxDecoration(
              color: Color(0xFFFB9F1E), shape: BoxShape.circle),
          constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
          child: Text(count > 99 ? '99+' : '$count',
            style: const TextStyle(color: Colors.white, fontSize: 9,
                fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        )),
    ],
  );
}

class _AvatarButton extends ConsumerWidget {
  final SmUserProfile? profile;
  const _AvatarButton({this.profile});
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      GestureDetector(
        onTap: () => context.go(SmRoutes.profile),
        child: Padding(padding: const EdgeInsets.only(right: 4),
          child: CircleAvatar(radius: 16,
            backgroundColor: const Color(0xFF248223),
            backgroundImage: profile?.avatarUrl != null
                ? NetworkImage(profile!.avatarUrl!) : null,
            child: profile?.avatarUrl == null
                ? Text(profile?.initials ?? '?',
                    style: const TextStyle(color: Colors.white,
                        fontSize: 11, fontWeight: FontWeight.bold))
                : null)),
      );
}

// ─────────────────────────────────────────
// WRAPPER: child detail por ID desde URL
// ─────────────────────────────────────────
class _ChildWrapper extends ConsumerWidget {
  final String id;
  const _ChildWrapper({required this.id});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final students = ref.watch(studentsProvider).valueOrNull ?? [];
    final student  = students.where((s) => s.id == id).firstOrNull;
    if (student == null) {
      return Scaffold(
          appBar: AppBar(),
          body: const Center(child: CircularProgressIndicator()));
    }
    return StudentProgressScreen(student: student);
  }
}

// ─────────────────────────────────────────
// PÁGINAS PÚBLICAS
// ─────────────────────────────────────────
class _LandingPage extends StatelessWidget {
  const _LandingPage();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF0A1F0A), Color(0xFF248223)],
      )),
      child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 80, height: 80,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(20)),
          child: const Icon(Icons.sports, color: Colors.white, size: 44)),
        const SizedBox(height: 20),
        const Text('SportMaps', style: TextStyle(color: Colors.white,
            fontSize: 34, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Gestión deportiva integral',
            style: TextStyle(color: Colors.white70, fontSize: 15)),
        const SizedBox(height: 48),
        SizedBox(width: 260, child: ElevatedButton(
          onPressed: () => context.go(SmRoutes.login),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF248223),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: const Text('Iniciar sesión',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        )),
        const SizedBox(height: 12),
        SizedBox(width: 260, child: OutlinedButton(
          onPressed: () => context.go(SmRoutes.register),
          style: OutlinedButton.styleFrom(foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white38),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: const Text('Crear cuenta', style: TextStyle(fontSize: 15)),
        )),
      ])),
    ),
  );
}

class _LoginPageWrapper extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => LoginScreen(
    onRegisterTap: () => context.go(SmRoutes.register),
    onForgotTap:   () => context.go(SmRoutes.forgotPassword),
    onLogin: (email, password) =>
        ref.read(authProvider.notifier).signIn(email: email, password: password),
  );
}

class _RegisterPage extends ConsumerStatefulWidget {
  const _RegisterPage();
  @override ConsumerState<_RegisterPage> createState() => _RegisterPageState();
}
class _RegisterPageState extends ConsumerState<_RegisterPage> {
  final _key = GlobalKey<FormState>();
  final _e = TextEditingController(), _p = TextEditingController();
  final _f = TextEditingController(), _l = TextEditingController();
  SmUserRole _role = SmUserRole.parent;
  bool _loading = false;
  @override void dispose() { _e.dispose();_p.dispose();_f.dispose();_l.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Crear cuenta')),
    body: SingleChildScrollView(padding: const EdgeInsets.all(24),
      child: Form(key: _key, child: Column(children: [
        Row(children: [
          Expanded(child: TextFormField(controller: _f,
            decoration: const InputDecoration(labelText: 'Nombre'),
            validator: (v) => v!.isEmpty ? 'Requerido' : null)),
          const SizedBox(width: 12),
          Expanded(child: TextFormField(controller: _l,
            decoration: const InputDecoration(labelText: 'Apellido'),
            validator: (v) => v!.isEmpty ? 'Requerido' : null)),
        ]),
        const SizedBox(height: 16),
        TextFormField(controller: _e,
          decoration: const InputDecoration(labelText: 'Email'),
          keyboardType: TextInputType.emailAddress,
          validator: (v) => v!.isEmpty ? 'Requerido' : null),
        const SizedBox(height: 16),
        TextFormField(controller: _p,
          decoration: const InputDecoration(labelText: 'Contraseña'),
          obscureText: true,
          validator: (v) => v!.length < 6 ? 'Mínimo 6 caracteres' : null),
        const SizedBox(height: 16),
        DropdownButtonFormField<SmUserRole>(
          initialValue: _role,
          decoration: const InputDecoration(labelText: 'Soy...'),
          items: [SmUserRole.parent, SmUserRole.coach,
                  SmUserRole.student, SmUserRole.referee]
              .map((r) => DropdownMenuItem(value: r, child: Text(r.label)))
              .toList(),
          onChanged: (v) => setState(() => _role = v ?? _role)),
        const SizedBox(height: 28),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: _loading ? null : () async {
            if (!_key.currentState!.validate()) {
              return;
            }
            setState(() => _loading = true);
            try {
              await ref.read(authProvider.notifier).signUp(
                email: _e.text.trim(), password: _p.text,
                firstName: _f.text.trim(), lastName: _l.text.trim(), role: _role);
            } finally {
              if (mounted) {
                setState(() => _loading = false);
              }
            }
          },
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF248223),
              foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: _loading
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Registrarme',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        )),
        const SizedBox(height: 12),
        TextButton(onPressed: () => context.go(SmRoutes.login),
            child: const Text('¿Ya tienes cuenta? Inicia sesión')),
      ])),
    ),
  );
}

class _ForgotPasswordPage extends ConsumerStatefulWidget {
  const _ForgotPasswordPage();
  @override ConsumerState<_ForgotPasswordPage> createState() => _ForgotState();
}
class _ForgotState extends ConsumerState<_ForgotPasswordPage> {
  final _c = TextEditingController();
  bool _sent = false, _loading = false;
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Recuperar contraseña')),
    body: Padding(padding: const EdgeInsets.all(24),
      child: _sent
          ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.mark_email_read_outlined, size: 72, color: Color(0xFF248223)),
              const SizedBox(height: 16),
              const Text('¡Email enviado!',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
              const SizedBox(height: 8),
              Text('Revisa tu bandeja en ${_c.text}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF627D62))),
              const SizedBox(height: 24),
              TextButton(onPressed: () => context.go(SmRoutes.login),
                  child: const Text('Volver al inicio de sesión')),
            ])
          : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Text('Ingresa tu email para recibir\nun enlace de recuperación.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF627D62))),
              const SizedBox(height: 24),
              TextFormField(controller: _c,
                decoration: const InputDecoration(labelText: 'Email',
                    prefixIcon: Icon(Icons.mail_outline)),
                keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 20),
              SizedBox(width: double.infinity, child: ElevatedButton(
                onPressed: _loading ? null : () async {
                  setState(() => _loading = true);
                  await ref.read(authProvider.notifier).resetPassword(_c.text.trim());
                  if (mounted) {
                    setState(() {
                      _loading = false;
                      _sent = true;
                    });
                  }
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF248223),
                    foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: _loading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Enviar enlace', style: TextStyle(fontWeight: FontWeight.bold)),
              )),
            ]),
    ),
  );
}

class _InvitePage extends StatelessWidget {
  final String code;
  const _InvitePage({required this.code});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Invitación')),
    body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.card_giftcard_outlined, size: 64, color: Color(0xFF248223)),
      const SizedBox(height: 16),
      const Text('Tienes una invitación',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
      const SizedBox(height: 8),
      Text('Código: $code', style: const TextStyle(color: Color(0xFF627D62))),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: () => context.go(SmRoutes.register),
        style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF248223), foregroundColor: Colors.white),
        child: const Text('Crear cuenta y unirme')),
    ])),
  );
}

class _SchoolPublicPage extends StatelessWidget {
  final String slug;
  const _SchoolPublicPage({required this.slug});
  @override Widget build(BuildContext ctx) =>
      Scaffold(appBar: AppBar(title: Text(slug)), body: Center(child: Text(slug)));
}

class _EventPublicPage extends StatelessWidget {
  final String slug;
  const _EventPublicPage({required this.slug});
  @override Widget build(BuildContext ctx) =>
      Scaffold(appBar: AppBar(title: Text(slug)), body: Center(child: Text(slug)));
}

class _ProfileWizardPage extends StatelessWidget {
  const _ProfileWizardPage();
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: const Text('Completar perfil')),
    body: const Center(child: Text('CoachProfileWizard — conectar')));
}

// ─────────────────────────────────────────
// PÁGINAS ADMIN / DETALLE (esqueletos)
// ─────────────────────────────────────────
class _SchoolsAdminPage extends StatelessWidget {
  const _SchoolsAdminPage();
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: const Text('Escuelas')),
    body: const Center(child: Text('Admin — Escuelas')));
}
class _SchoolDetailPage extends StatelessWidget {
  final String id; const _SchoolDetailPage({required this.id});
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: Text('Escuela $id')), body: Center(child: Text(id)));
}
class _UsersAdminPage extends StatelessWidget {
  const _UsersAdminPage();
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: const Text('Usuarios')),
    body: const Center(child: Text('Admin — Usuarios')));
}
class _TeamDetailPage extends StatelessWidget {
  final String id; const _TeamDetailPage({required this.id});
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: Text('Equipo $id')), body: Center(child: Text(id)));
}
class _EventDetailPage extends StatelessWidget {
  final String id; const _EventDetailPage({required this.id});
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: Text('Evento $id')), body: Center(child: Text(id)));
}
class _CheckoutPage extends StatelessWidget {
  const _CheckoutPage();
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: const Text('Pago')),
    body: const Center(child: Text('Checkout')));
}
class _TrainingPage extends StatelessWidget {
  const _TrainingPage();
  @override Widget build(BuildContext ctx) => Scaffold(
    appBar: AppBar(title: const Text('Entrenamientos')),
    body: const Center(child: Text('Training')));
}

// ─────────────────────────────────────────
// ERROR PAGE
// ─────────────────────────────────────────
class _ErrorPage extends StatelessWidget {
  final Exception? error;
  const _ErrorPage({this.error});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline, size: 64, color: Color(0xFFEF4444)),
      const SizedBox(height: 16),
      const Text('Página no encontrada',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      if (error != null) ...[
        const SizedBox(height: 8),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(error.toString(), textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF627D62)))),
      ],
      const SizedBox(height: 24),
      ElevatedButton.icon(
        onPressed: () => context.go(SmRoutes.dashboard),
        icon: const Icon(Icons.home_outlined),
        label: const Text('Ir al inicio'),
        style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF248223),
            foregroundColor: Colors.white)),
    ])),
  );
}
