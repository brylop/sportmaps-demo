// ============================================================
// SportMaps — Auth Providers (Riverpod + Supabase)
// Reemplaza: AuthContext.tsx + useAuth hook + react-query auth
// ============================================================

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ─────────────────────────────────────────
// MODELOS
// ─────────────────────────────────────────
enum SmUserRole {
  superAdmin,
  admin,
  schoolAdmin,
  coach,
  parent,
  student,
  referee,
  medical,
  analyst,
  sponsor,
  guest,
}

extension SmUserRoleX on SmUserRole {
  String get label => switch (this) {
        SmUserRole.superAdmin => 'Super Admin',
        SmUserRole.admin => 'Administrador',
        SmUserRole.schoolAdmin => 'Admin Academia',
        SmUserRole.coach => 'Entrenador',
        SmUserRole.parent => 'Padre/Tutor',
        SmUserRole.student => 'Atleta',
        SmUserRole.referee => 'Árbitro',
        SmUserRole.medical => 'Médico',
        SmUserRole.analyst => 'Analista',
        SmUserRole.sponsor => 'Patrocinador',
        SmUserRole.guest => 'Invitado',
      };

  static SmUserRole fromString(String? s) => switch (s) {
        'super_admin' => SmUserRole.superAdmin,
        'admin' => SmUserRole.admin,
        'school_admin' => SmUserRole.schoolAdmin,
        'coach' => SmUserRole.coach,
        'parent' => SmUserRole.parent,
        'student' => SmUserRole.student,
        'referee' => SmUserRole.referee,
        'medical' => SmUserRole.medical,
        'analyst' => SmUserRole.analyst,
        'sponsor' => SmUserRole.sponsor,
        _ => SmUserRole.guest,
      };
}

class SmUserProfile {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final SmUserRole role;
  final String? avatarUrl;
  final String? schoolId;
  final bool profileComplete;
  final DateTime createdAt;

  const SmUserProfile({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.avatarUrl,
    this.schoolId,
    required this.profileComplete,
    required this.createdAt,
  });

  String get fullName => '$firstName $lastName'.trim();
  String get initials {
    final parts = fullName.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.first.isNotEmpty ? parts.first[0].toUpperCase() : '?';
  }

  factory SmUserProfile.fromMap(Map<String, dynamic> map) => SmUserProfile(
        id: map['id'] as String,
        email: map['email'] as String? ?? '',
        firstName: map['first_name'] as String? ?? '',
        lastName: map['last_name'] as String? ?? '',
        role: SmUserRoleX.fromString(map['role'] as String?),
        avatarUrl: map['avatar_url'] as String?,
        schoolId: map['school_id'] as String?,
        profileComplete: map['profile_complete'] as bool? ?? false,
        createdAt: DateTime.tryParse(map['created_at'] as String? ?? '') ??
            DateTime.now(),
      );

  SmUserProfile copyWith({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    bool? profileComplete,
  }) =>
      SmUserProfile(
        id: id,
        email: email,
        firstName: firstName ?? this.firstName,
        lastName: lastName ?? this.lastName,
        role: role,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        schoolId: schoolId,
        profileComplete: profileComplete ?? this.profileComplete,
        createdAt: createdAt,
      );
}

// ─────────────────────────────────────────
// AUTH STATE
// ─────────────────────────────────────────
sealed class SmAuthState {
  const SmAuthState();
}

class SmAuthLoading extends SmAuthState {
  const SmAuthLoading();
}

class SmAuthUnauthenticated extends SmAuthState {
  const SmAuthUnauthenticated();
}

class SmAuthAuthenticated extends SmAuthState {
  final SmUserProfile profile;
  const SmAuthAuthenticated(this.profile);
}

class SmAuthError extends SmAuthState {
  final String message;
  const SmAuthError(this.message);
}

// ─────────────────────────────────────────
// SUPABASE CLIENT PROVIDER
// ─────────────────────────────────────────
final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

// ─────────────────────────────────────────
// AUTH NOTIFIER
// Reemplaza: AuthContext.tsx + useSignIn + useSignOut hooks
// ─────────────────────────────────────────
final authProvider =
    AsyncNotifierProvider<SmAuthNotifier, SmAuthState>(SmAuthNotifier.new);

class SmAuthNotifier extends AsyncNotifier<SmAuthState> {
  SupabaseClient get _sb => ref.read(supabaseClientProvider);

  @override
  Future<SmAuthState> build() async {
    // Verificar que Supabase esté configurado correctamente
    const url = String.fromEnvironment('SUPABASE_URL');
    if (url.contains('YOUR_PROJECT') || url.isEmpty) {
      debugPrint('⚠️  Supabase no configurado — modo demo activo');
      debugPrint('   Ejecuta con: flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co --dart-define=SUPABASE_ANON_KEY=xxx');
      return const SmAuthUnauthenticated();
    }

    try {
      // Escuchar cambios de sesión en tiempo real
      _sb.auth.onAuthStateChange.listen((data) {
        _handleAuthEvent(data.event, data.session);
      });

      // Comprobar sesión existente al iniciar
      final session = _sb.auth.currentSession;
      if (session == null) return const SmAuthUnauthenticated();

      return _fetchProfile(session.user.id);
    } catch (e) {
      debugPrint('Auth init error: $e');
      return const SmAuthUnauthenticated();
    }
  }

  void _handleAuthEvent(AuthChangeEvent event, Session? session) {
    switch (event) {
      case AuthChangeEvent.signedIn:
        if (session != null) {
          _fetchProfile(session.user.id).then(
            (s) => state = AsyncValue.data(s),
          );
        }
      case AuthChangeEvent.signedOut:
        state = const AsyncValue.data(SmAuthUnauthenticated());
      case AuthChangeEvent.tokenRefreshed:
        // No action needed — session already updated
        break;
      default:
        break;
    }
  }

  Future<SmAuthState> _fetchProfile(String userId) async {
    try {
      final data =
          await _sb.from('profiles').select().eq('id', userId).single();
      return SmAuthAuthenticated(SmUserProfile.fromMap(data));
    } catch (e) {
      debugPrint('[Auth] Error fetching profile: $e');
      return SmAuthError(e.toString());
    }
  }

  // ── Acciones públicas ─────────────────────────────────

  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    state = const AsyncValue.loading();
    try {
      final res = await _sb.auth.signInWithPassword(
        email: email,
        password: password,
      );
      if (res.user == null) {
        throw Exception('Usuario no encontrado');
      }
      final profile = await _fetchProfile(res.user!.id);
      state = AsyncValue.data(profile);
    } on AuthException catch (e) {
      state = AsyncValue.data(SmAuthError(_mapAuthError(e.message)));
    } catch (e) {
      state = AsyncValue.data(SmAuthError(e.toString()));
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required SmUserRole role,
  }) async {
    state = const AsyncValue.loading();
    try {
      final res = await _sb.auth.signUp(
        email: email,
        password: password,
        data: {
          'first_name': firstName,
          'last_name': lastName,
          'role': role.name,
        },
      );
      if (res.user == null) {
        throw Exception('Error al crear cuenta');
      }

      // Crear perfil en tabla profiles
      await _sb.from('profiles').upsert({
        'id': res.user!.id,
        'email': email,
        'first_name': firstName,
        'last_name': lastName,
        'role': role.name,
        'profile_complete': false,
        'created_at': DateTime.now().toIso8601String(),
      });

      final profile = await _fetchProfile(res.user!.id);
      state = AsyncValue.data(profile);
    } on AuthException catch (e) {
      state = AsyncValue.data(SmAuthError(_mapAuthError(e.message)));
    } catch (e) {
      state = AsyncValue.data(SmAuthError(e.toString()));
    }
  }

  Future<void> signOut() async {
    await _sb.auth.signOut();
    state = const AsyncValue.data(SmAuthUnauthenticated());
  }

  Future<void> resetPassword(String email) async {
    await _sb.auth.resetPasswordForEmail(
      email,
      redirectTo: kIsWeb
          ? 'https://sportmaps.app/reset-password'
          : 'sportmaps://reset-password',
    );
  }

  Future<void> updateProfile({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    bool? profileComplete,
  }) async {
    final current = state.value;
    if (current is! SmAuthAuthenticated) {
      return;
    }

    final updates = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
      if (firstName != null) 'first_name': firstName,
      if (lastName != null) 'last_name': lastName,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
      if (profileComplete != null) 'profile_complete': profileComplete,
    };

    await _sb.from('profiles').update(updates).eq('id', current.profile.id);

    state = AsyncValue.data(
      SmAuthAuthenticated(current.profile.copyWith(
        firstName: firstName,
        lastName: lastName,
        avatarUrl: avatarUrl,
        profileComplete: profileComplete,
      )),
    );
  }

  String _mapAuthError(String msg) => switch (msg.toLowerCase()) {
        String m when m.contains('invalid login') =>
          'Correo o contraseña incorrectos',
        String m when m.contains('email not confirmed') =>
          'Confirma tu correo antes de continuar',
        String m when m.contains('user already registered') =>
          'Ya existe una cuenta con este correo',
        String m when m.contains('password') =>
          'La contraseña no cumple los requisitos mínimos',
        _ => msg,
      };
}

// ─────────────────────────────────────────
// HELPERS — acceso rápido en widgets
// ─────────────────────────────────────────

/// Retorna el perfil si está autenticado, null si no
final currentProfileProvider = Provider<SmUserProfile?>((ref) {
  final auth = ref.watch(authProvider).valueOrNull;
  if (auth is SmAuthAuthenticated) {
    return auth.profile;
  }
  return null;
});

/// Retorna true si hay sesión activa
final isAuthenticatedProvider = Provider<bool>((ref) {
  final auth = ref.watch(authProvider).valueOrNull;
  return auth is SmAuthAuthenticated;
});

/// Rol del usuario actual
final currentRoleProvider = Provider<SmUserRole>((ref) {
  final profile = ref.watch(currentProfileProvider);
  return profile?.role ?? SmUserRole.guest;
});
