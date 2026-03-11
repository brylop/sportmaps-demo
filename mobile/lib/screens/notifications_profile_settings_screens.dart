// ============================================================
// SportMaps — Notifications + Profile + Settings Screens
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../providers/data_providers.dart';
import '../providers/theme_provider.dart';
import '../widgets/direct/direct_components.dart';
import '../widgets/adaptable/adaptable_components.dart';
import '../widgets/custom/sidebar_toast_search.dart';
import '../widgets/custom/hero_splash_skeleton_cart.dart';
import 'package:sportmaps/platform/sm_adaptive_widgets.dart';
import '../theme/sportmaps_theme.dart';
import '../navigation/sm_routes.dart';
import 'package:go_router/go_router.dart';

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ════════════════════════════════════════════════════════════
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);
    final notifier   = ref.read(notificationsProvider.notifier);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers: [
        SliverAppBar(
          floating: true, snap: true,
          title: Row(children: [
            const Text('Notificaciones', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(width: 8),
            Consumer(builder: (_, ref, __) {
              final count = ref.watch(unreadNotificationsProvider);
              if (count == 0) {
                return const SizedBox.shrink();
              }
              return SmBadge(label: '$count', variant: SmBadgeVariant.destructive);
            }),
          ]),
          actions: [
            TextButton(
              onPressed: () => notifier.markAllRead(),
              child: const Text('Marcar todo leído'),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(delegate: SliverChildListDelegate([
            notifAsync.when(
              loading: () => Column(children: List.generate(5, (_) =>
                  const Padding(padding: EdgeInsets.only(bottom:10),
                    child: SmSkeleton(height:80, borderRadius: 12)))),
              error: (e,_) => SmEmptyState(icon:Icons.error_outline, title:'Error', description:e.toString()),
              data: (notifs) {
                // Agrupar por "hoy" vs "anteriores"
                final today = notifs.where((n) =>
                    n.createdAt.day == DateTime.now().day).toList();
                final earlier = notifs.where((n) =>
                    n.createdAt.day != DateTime.now().day).toList();

                if (today.isEmpty && earlier.isEmpty) {
                  return const SmEmptyState(
                    icon: Icons.notifications_none_outlined,
                    title: 'Sin notificaciones',
                    description: 'Aquí aparecerán tus alertas y avisos importantes.',
                  );
                }
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (today.isNotEmpty) ...[
                    Padding(padding: const EdgeInsets.only(bottom:8),
                      child: Text('Hoy', style: Theme.of(context).textTheme.labelLarge?.copyWith(color:SmColors.mutedForeground))),
                    ...today.map((n) => _NotifTile(notif:n, onTap:() => notifier.markRead(n.id))),
                    const SizedBox(height:16),
                  ],
                  if (earlier.isNotEmpty) ...[
                    Padding(padding: const EdgeInsets.only(bottom:8),
                      child: Text('Anteriores', style: Theme.of(context).textTheme.labelLarge?.copyWith(color:SmColors.mutedForeground))),
                    ...earlier.map((n) => _NotifTile(notif:n, onTap:() => notifier.markRead(n.id))),
                  ],
                ]);
              },
            ),
          ])),
        ),
      ]),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final SmNotification notif;
  final VoidCallback onTap;
  const _NotifTile({required this.notif, required this.onTap});

  static const _icons = {
    'info':    Icons.info_outline,
    'success': Icons.check_circle_outline,
    'warning': Icons.warning_amber_outlined,
    'alert':   Icons.notification_important_outlined,
  };
  static const _colors = {
    'info':    Color(0xFF3B82F6),
    'success': Color(0xFF22C55E),
    'warning': Color(0xFFFB9F1E),
    'alert':   Color(0xFFEF4444),
  };

  @override
  Widget build(BuildContext context) {
    final icon  = _icons[notif.type]  ?? Icons.circle_notifications_outlined;
    final color = _colors[notif.type] ?? SmColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: notif.read
              ? Theme.of(context).colorScheme.surface
              : color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: notif.read ? SmColors.border : color.withValues(alpha: 0.25),
          ),
        ),
        child: Row(children: [
          Container(width:42, height:42,
            decoration: BoxDecoration(color:color.withValues(alpha: 0.1), shape:BoxShape.circle),
            child: Icon(icon, color:color, size:20)),
          const SizedBox(width:12),
          Expanded(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
            Text(notif.title,
                style: TextStyle(fontWeight: notif.read ? FontWeight.w500 : FontWeight.w700, fontSize:14)),
            const SizedBox(height:2),
            Text(notif.body,
                maxLines:2, overflow:TextOverflow.ellipsis,
                style: const TextStyle(fontSize:12, color:SmColors.mutedForeground, height:1.4)),
            const SizedBox(height:4),
            Text(_timeAgo(notif.createdAt),
                style: const TextStyle(fontSize:11, color:SmColors.mutedForeground)),
          ])),
          if (!notif.read)
            Container(width:8, height:8, margin:const EdgeInsets.only(left:8),
              decoration: BoxDecoration(color:color, shape:BoxShape.circle)),
        ]),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return 'hace ${diff.inMinutes} min';
    }
    if (diff.inHours < 24) {
      return 'hace ${diff.inHours}h';
    }
    if (diff.inDays < 7) {
      return 'hace ${diff.inDays}d';
    }
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ════════════════════════════════════════════════════════════
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _editing = false;
  late TextEditingController _firstCtrl, _lastCtrl;

  @override
  void initState() {
    super.initState();
    final p = ref.read(currentProfileProvider);
    _firstCtrl = TextEditingController(text: p?.firstName ?? '');
    _lastCtrl  = TextEditingController(text: p?.lastName  ?? '');
  }

  @override
  void dispose() { _firstCtrl.dispose(); _lastCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentProfileProvider);
    if (profile == null) {
      return const SizedBox.shrink();
    }
    _firstCtrl.text = profile.firstName;
    _lastCtrl.text = profile.lastName;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 220, pinned: true,
          actions: [
            TextButton(
              onPressed: () async {
                if (_editing) {
                  await ref.read(authProvider.notifier).updateProfile(
                    firstName: _firstCtrl.text.trim(),
                    lastName:  _lastCtrl.text.trim(),
                  );
                  if (!context.mounted) {
                    return;
                  }
                  SmToast.show(context,
                      message: 'Perfil actualizado', type: SmToastType.success);
                }
                setState(() => _editing = !_editing);
              },
              child: Text(_editing ? 'Guardar' : 'Editar',
                  style: const TextStyle(color: SmColors.primary, fontWeight: FontWeight.w600)),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(gradient: LinearGradient(
                begin:Alignment.topLeft, end:Alignment.bottomRight,
                colors:[Color(0xFF0A1F0A), Color(0xFF248223)],
              )),
              child: SafeArea(child: Column(mainAxisAlignment:MainAxisAlignment.center, children:[
                const SizedBox(height:40),
                Stack(alignment:Alignment.bottomRight, children:[
                  SmAvatar(name:profile.fullName, imageUrl:profile.avatarUrl,
                      size:80, backgroundColor:Colors.white.withValues(alpha: 0.2)),
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: SmColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color:Colors.white, width:2),
                    ),
                    child: const Icon(Icons.camera_alt, color:Colors.white, size:14),
                  ),
                ]),
                const SizedBox(height:12),
                Text(profile.fullName,
                    style:const TextStyle(color:Colors.white, fontWeight:FontWeight.bold, fontSize:20)),
                const SizedBox(height:4),
                SmBadge(label:profile.role.label, variant:SmBadgeVariant.secondary),
              ])),
            ),
          ),
        ),

        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(delegate: SliverChildListDelegate([

            // Completitud del perfil
            if (!profile.profileComplete)
              Padding(
                padding: const EdgeInsets.only(bottom:16),
                child: SmProfileCompletionBanner(
                  completionPercent: 65,
                  pendingItems: const ['Foto de perfil', 'Teléfono', 'Información deportiva'],
                  onCompleteProfile: () {},
                ),
              ),

            // Info personal
            SmCard(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
              Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children:[
                Text('Información personal',
                    style:Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
              ]),
              const SizedBox(height:16),
              if (_editing) ...[
                Row(children:[
                  Expanded(child:SmInput(label:'Nombre',   controller:_firstCtrl)),
                  const SizedBox(width:12),
                  Expanded(child:SmInput(label:'Apellido', controller:_lastCtrl)),
                ]),
              ] else ...[
                _ProfileRow(icon:Icons.person_outline, label:'Nombre',  value:profile.fullName),
                _ProfileRow(icon:Icons.mail_outline,   label:'Email',   value:profile.email),
                _ProfileRow(icon:Icons.badge_outlined,  label:'Rol',     value:profile.role.label),
                if (profile.schoolId != null)
                  const _ProfileRow(icon:Icons.school_outlined, label:'Academia', value:'Academia SportMaps'),
              ],
            ])),

            const SizedBox(height:16),

            // Estadísticas rápidas
            GridView.count(
              crossAxisCount:2, mainAxisSpacing:12, crossAxisSpacing:12,
              childAspectRatio:1.8, shrinkWrap:true, physics:const NeverScrollableScrollPhysics(),
              children: const [
                SmStatCard(title:'Miembro desde', value:'Mar 2025', icon:Icons.calendar_today_outlined, subtitle:'1 año'),
                SmStatCard(title:'Sesiones', value:'148', icon:Icons.fitness_center_outlined, iconColor:Color(0xFF8B5CF6)),
              ],
            ),

            const SizedBox(height:16),

            // Seguridad
            SmCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
              Text('Seguridad', style:Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
              const SizedBox(height:12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.lock_outline, color:SmColors.mutedForeground),
                title: const Text('Cambiar contraseña'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await ref.read(authProvider.notifier).resetPassword(profile.email);
                  if (context.mounted) {
                    SmToast.show(context,
                      message:'Email enviado', description:'Revisa tu bandeja de entrada',
                      type:SmToastType.success);
                  }
                },
              ),
              const SmSeparator(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.security_outlined, color:SmColors.mutedForeground),
                title: const Text('Autenticación de dos para factores'),
                trailing: SmAdaptiveSwitch(value:false, onChanged:(_){}),
              ),
            ])),

            const SizedBox(height:16),

            // Cerrar sesión
            SmButton(
              label: 'Cerrar sesión',
              variant: SmButtonVariant.destructive,
              fullWidth: true,
              icon: Icons.logout_outlined,
              onPressed: () async {
                final confirmed = await SmAdaptiveDialog.confirm(context,
                    title: 'Cerrar sesión',
                    message: '¿Estás seguro de que quieres salir?',
                    confirmText: 'Salir', destructive: true);
                if (confirmed == true && context.mounted) {
                  await ref.read(authProvider.notifier).signOut();
                  if (context.mounted) {
                  if (context.mounted) {
                    context.go(SmRoutes.login);
                  }
                  }
                }
              },
            ),
            const SizedBox(height:24),
          ])),
        ),
      ]),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final IconData icon; final String label, value;
  const _ProfileRow({required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical:6),
    child: Row(children:[
      Icon(icon, size:18, color:SmColors.mutedForeground),
      const SizedBox(width:10),
      Text('$label: ', style:const TextStyle(color:SmColors.mutedForeground, fontSize:13)),
      Expanded(child:Text(value, style:const TextStyle(fontWeight:FontWeight.w500, fontSize:13),
          overflow:TextOverflow.ellipsis)),
    ]),
  );
}

// ════════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ════════════════════════════════════════════════════════════
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final notifier  = ref.read(themeModeProvider.notifier);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers: [
        const SliverAppBar(
          floating: true, snap: true,
          title: Text('Configuración', style: TextStyle(fontWeight:FontWeight.bold)),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(delegate: SliverChildListDelegate([

            _SettingsSection(title:'Apariencia', children:[
              _SettingsTile(
                icon:Icons.palette_outlined, label:'Tema',
                trailing: SegmentedButton<ThemeMode>(
                  style: SegmentedButton.styleFrom(
                    selectedBackgroundColor: SmColors.primary.withValues(alpha: 0.1),
                    selectedForegroundColor: SmColors.primary,
                    visualDensity: VisualDensity.compact,
                  ),
                  segments: const [
                    ButtonSegment(value:ThemeMode.light,  icon:Icon(Icons.light_mode_outlined, size:16)),
                    ButtonSegment(value:ThemeMode.system,  icon:Icon(Icons.brightness_auto,     size:16)),
                    ButtonSegment(value:ThemeMode.dark,   icon:Icon(Icons.dark_mode_outlined,  size:16)),
                  ],
                  selected: {themeMode},
                  onSelectionChanged: (s) => notifier.setMode(s.first),
                ),
              ),
            ]),

            const SizedBox(height:16),

            _SettingsSection(title:'Notificaciones', children:[
              _SwitchTile(label:'Nuevos eventos',       icon:Icons.event_outlined,              value:true,  onChanged:(_){}),
              _SwitchTile(label:'Recordatorios',        icon:Icons.alarm_outlined,               value:true,  onChanged:(_){}),
              _SwitchTile(label:'Mensajes nuevos',      icon:Icons.chat_bubble_outline,          value:true,  onChanged:(_){}),
              _SwitchTile(label:'Pagos pendientes',     icon:Icons.attach_money_outlined,        value:true,  onChanged:(_){}),
              _SwitchTile(label:'Actualizaciones de app', icon:Icons.system_update_outlined,    value:false, onChanged:(_){}),
            ]),

            const SizedBox(height:16),

            _SettingsSection(title:'Privacidad', children:[
              _SwitchTile(label:'Perfil público',       icon:Icons.visibility_outlined,          value:true,  onChanged:(_){}),
              _SwitchTile(label:'Mostrar estadísticas', icon:Icons.bar_chart_outlined,           value:true,  onChanged:(_){}),
              _NavTile(   label:'Política de privacidad', icon:Icons.policy_outlined,            onTap:(){}),
              _NavTile(   label:'Términos y condiciones', icon:Icons.description_outlined,       onTap:(){}),
            ]),

            const SizedBox(height:16),

            _SettingsSection(title:'Soporte', children:[
              _NavTile(label:'Centro de ayuda',  icon:Icons.help_outline,       onTap:(){}),
              _NavTile(label:'Reportar problema', icon:Icons.bug_report_outlined, onTap:(){}),
              _NavTile(label:'Calificar la app', icon:Icons.star_outline,        onTap:(){}),
            ]),

            const SizedBox(height:16),

            // Versión
            Center(child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(children:[
                Container(width:48, height:48,
                  decoration:BoxDecoration(gradient:const LinearGradient(colors:[Color(0xFF248223),Color(0xFFFB9F1E)]),
                      borderRadius:BorderRadius.circular(12)),
                  child:const Icon(Icons.map_outlined, color:Colors.white, size:24)),
                const SizedBox(height:8),
                const Text('SportMaps', style:TextStyle(fontWeight:FontWeight.bold, fontSize:16)),
                const Text('Versión 1.0.2 (Build 42)', style:TextStyle(color:SmColors.mutedForeground, fontSize:12)),
              ]),
            )),
            const SizedBox(height:24),
          ])),
        ),
      ]),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title; final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom:12),
    child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
      Padding(padding:const EdgeInsets.only(left:4, bottom:8),
        child: Text(title.toUpperCase(), style:const TextStyle(fontSize:11, fontWeight:FontWeight.bold, letterSpacing:0.5, color:SmColors.mutedForeground))),
      SmCard(padding:EdgeInsets.zero, child:Column(children:children)),
    ]),
  );
}

class _SettingsTile extends StatelessWidget {
  final IconData icon; final String label; final Widget? trailing;
  const _SettingsTile({required this.icon, required this.label, this.trailing});
  @override
  Widget build(BuildContext context) => ListTile(
    leading:Icon(icon, color:SmColors.mutedForeground, size:20),
    title:Text(label, style:const TextStyle(fontSize:14)),
    trailing:trailing,
  );
}

class _SwitchTile extends StatefulWidget {
  final String label; final IconData icon; final bool value; final ValueChanged<bool> onChanged;
  const _SwitchTile({required this.label, required this.icon, required this.value, required this.onChanged});
  @override State<_SwitchTile> createState() => _SwitchTileState();
}
class _SwitchTileState extends State<_SwitchTile> {
  late bool _val;
  @override void initState() { super.initState(); _val = widget.value; }
  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(widget.icon, color: SmColors.mutedForeground, size: 20),
    title: Text(widget.label, style: const TextStyle(fontSize: 14)),
    trailing: SmAdaptiveSwitch(value:_val, onChanged:(bool v){ setState(()=>_val=v); widget.onChanged(v); }),
  );
}

class _NavTile extends StatelessWidget {
  final String label; final IconData icon; final VoidCallback onTap;
  const _NavTile({required this.label, required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    leading:Icon(icon, color:SmColors.mutedForeground, size:20),
    title:Text(label, style:const TextStyle(fontSize:14)),
    trailing:const Icon(Icons.chevron_right, color:SmColors.mutedForeground),
    onTap:onTap,
  );
}
