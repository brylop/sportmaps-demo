// ============================================================
// SportMaps — Login + Explore Screens
// ============================================================
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../widgets/direct/direct_components.dart';
import '../widgets/custom/sidebar_toast_search.dart';
import '../widgets/adaptable/adaptable_components.dart';
import '../widgets/custom/map_calendar_widget.dart';
import '../theme/sportmaps_theme.dart';

// ════════════════════════════════════════════════════════════
// EXPLORE SCREEN
// ════════════════════════════════════════════════════════════
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _activeFilter = 'Todos';
  final _filters = ['Todos', 'Academias', 'Canchas', 'Eventos', 'Entrenadores'];

  final _markers = [
    const SmMarkerData(
      position: LatLng(4.711, -74.072),
      title: 'Academia Bogotá FC',
      subtitle: '247 estudiantes · Activa',
      color: Color(0xFF248223),
      icon: Icons.stadium,
    ),
    const SmMarkerData(
      position: LatLng(4.730, -74.050),
      title: 'Cancha Norte',
      subtitle: 'Disponible · Fútbol 11',
      color: Color(0xFF3B82F6),
      icon: Icons.sports_soccer,
    ),
    const SmMarkerData(
      position: LatLng(4.695, -74.085),
      title: 'Torneo Sub-14',
      subtitle: '15 Mar 2026 · 8:00 AM',
      color: Color(0xFFFB9F1E),
      icon: Icons.emoji_events,
    ),
    const SmMarkerData(
      position: LatLng(4.720, -74.065),
      title: 'Coach Carlos García',
      subtitle: 'Fútbol · Categoría Sub-16',
      color: Color(0xFF8B5CF6),
      icon: Icons.person,
    ),
  ];

  final _searchItems = [
    const SmSearchItem(
        id: '1',
        title: 'Academia Bogotá FC',
        subtitle: 'Bogotá · 247 estudiantes',
        icon: Icons.stadium,
        category: 'Academias'),
    const SmSearchItem(
        id: '2',
        title: 'Cancha Norte',
        subtitle: 'Disponible · Fútbol 11',
        icon: Icons.sports_soccer,
        category: 'Canchas'),
    const SmSearchItem(
        id: '3',
        title: 'Coach Carlos García',
        subtitle: 'Especialidad: Sub-16',
        icon: Icons.person,
        category: 'Entrenadores'),
    const SmSearchItem(
        id: '4',
        title: 'Torneo Sub-14 Regional',
        subtitle: '15 Mar 2026',
        icon: Icons.emoji_events,
        category: 'Eventos'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers: [
        SliverAppBar(
          floating: true, snap: true, expandedHeight: 130,
          backgroundColor: Theme.of(context).colorScheme.surface,
          surfaceTintColor: Colors.transparent,
          title: const Text('Explorar', style: TextStyle(fontWeight: FontWeight.bold)),
          flexibleSpace: FlexibleSpaceBar(
            background: Padding(padding: const EdgeInsets.fromLTRB(16, 60, 16, 12),
              child: SmSearchCommand(items: _searchItems, hint: 'Buscar academias, canchas, eventos...',
                onSelect: (item) => SmToast.show(context, message: 'Seleccionado: ${item.title}', type: SmToastType.info))),
          ),
        ),
        SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList(delegate: SliverChildListDelegate([
          SmScrollArea(scrollDirection: Axis.horizontal, showScrollbar: false,
            child: Row(children: _filters.map((f) {
              final isActive = f == _activeFilter;
              return Padding(padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(f), selected: isActive,
                  onSelected: (_) => setState(() => _activeFilter = f),
                  selectedColor: SmColors.primary.withValues(alpha: 0.12),
                  checkmarkColor: SmColors.primary,
                  labelStyle: TextStyle(
                    color: isActive ? SmColors.primary : SmColors.mutedForeground,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                    fontSize: 13),
                  side: BorderSide(color: isActive ? SmColors.primary : SmColors.border),
                ),
              );
            }).toList())),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(color: SmColors.muted, borderRadius: BorderRadius.circular(10)),
            child: TabBar(controller: _tabController,
              indicator: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(8),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4)]),
              indicatorPadding: const EdgeInsets.all(3), indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              tabs: const [Tab(icon: Icon(Icons.map_outlined, size: 16), text: 'Mapa'),
                          Tab(icon: Icon(Icons.list_outlined, size: 16), text: 'Lista')],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(height: 420, child: TabBarView(controller: _tabController, children: [
            SmMapView(markers: _markers, height: 400, initialCenter: const LatLng(4.711, -74.072), initialZoom: 13),
            ListView.separated(physics: const NeverScrollableScrollPhysics(), itemCount: _markers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _ExploreListItem(marker: _markers[i])),
          ])),
          const SizedBox(height: 20),
          Text('En tu zona', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          GridView.count(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.6,
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            children: const [
              SmStatCard(title: 'Academias', value: '24', icon: Icons.stadium_outlined),
              SmStatCard(title: 'Canchas', value: '47', icon: Icons.sports_soccer_outlined, iconColor: Color(0xFF3B82F6), subtitle: '12 disponibles'),
              SmStatCard(title: 'Eventos hoy', value: '3', icon: Icons.event_outlined, iconColor: SmColors.accent),
              SmStatCard(title: 'Entrenadores', value: '89', icon: Icons.person_outline, iconColor: Color(0xFF8B5CF6)),
            ]),
          const SizedBox(height: 24),
        ]))),
      ]),
    );
  }
}

class _ExploreListItem extends StatelessWidget {
  final SmMarkerData marker;
  const _ExploreListItem({required this.marker});
  @override
  Widget build(BuildContext context) => SmCard(onTap: () {}, child: Row(children: [
    Container(width: 48, height: 48, decoration: BoxDecoration(color: marker.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
      child: Icon(marker.icon, color: marker.color, size: 22)),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(marker.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
      if (marker.subtitle != null) ...[
        Text(marker.subtitle!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SmColors.mutedForeground)),
      ],
    ])),
    const Icon(Icons.chevron_right, color: SmColors.mutedForeground),
  ]));
}

// ════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ════════════════════════════════════════════════════════════
class LoginScreen extends StatefulWidget {
  final VoidCallback? onRegisterTap, onForgotTap;
  final Future<void> Function(String email, String password)? onLogin;
  const LoginScreen({super.key, this.onRegisterTap, this.onForgotTap, this.onLogin});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController(), _passCtrl = TextEditingController();
  bool _loading = false;
  bool _rememberMe = false;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }
  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _loading = true);
    try {
      await widget.onLogin?.call(_emailCtrl.text, _passCtrl.text);
    } catch (e) {
      if (mounted) {
        SmToast.show(context,
            message: 'Error al iniciar sesión',
            description: e.toString(),
            type: SmToastType.error);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0A1F0A), Color(0xFF164016)])),
      child: SafeArea(child: FadeTransition(opacity: _fadeAnim, child: SingleChildScrollView(child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height - MediaQuery.paddingOf(context).top),
        child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const SizedBox(height: 32),
          _buildLogo(context),
          const SizedBox(height: 40),
          Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 30, offset: const Offset(0, 10))]),
            child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Iniciar sesión', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('Bienvenido de vuelta a SportMaps', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SmColors.mutedForeground)),
              const SizedBox(height: 24),
              SmInput(
                label: 'Correo electrónico',
                hint: 'tu@email.com',
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.mail_outline,
                textInputAction: TextInputAction.next,
                validator: (v) {
                  if (v == null || v.isEmpty) {
                    return 'Ingresa tu correo';
                  }
                  if (!v.contains('@')) {
                    return 'Correo inválido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              SmPasswordInput(
                controller: _passCtrl,
                validator: (v) {
                  if (v == null || v.isEmpty) {
                    return 'Ingresa tu contraseña';
                  }
                  if (v.length < 6) {
                    return 'Mínimo 6 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                SmCheckbox(value: _rememberMe, label: 'Recordarme', onChanged: (v) => setState(() => _rememberMe = v!)),
                TextButton(onPressed: widget.onForgotTap, child: const Text('¿Olvidaste tu contraseña?', style: TextStyle(fontSize: 12))),
              ]),
              const SizedBox(height: 20),
              SmButton(label: 'Iniciar sesión', variant: SmButtonVariant.hero, fullWidth: true, loading: _loading, onPressed: _submit),
              const SizedBox(height: 16),
              const SmSeparator(label: 'o continúa con'),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _SocialButton(label: 'Google', icon: Icons.g_mobiledata, onTap: () {})),
                const SizedBox(width: 12),
                Expanded(child: _SocialButton(label: 'Apple', icon: Icons.apple, onTap: () {})),
              ]),
            ])),
          ),
          const SizedBox(height: 24),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('¿No tienes cuenta?', style: TextStyle(color: Colors.white70)),
            TextButton(onPressed: widget.onRegisterTap, child: const Text('Regístrate', style: TextStyle(color: Color(0xFF3FA53D), fontWeight: FontWeight.bold))),
          ]),
          const SizedBox(height: 24),
        ]))))),
      ),
    ),
  );

  Widget _buildLogo(BuildContext context) => Column(children: [
    Container(width: 64, height: 64, decoration: BoxDecoration(gradient: SmGradients.brand, borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: SmColors.primary.withValues(alpha: 0.4), blurRadius: 20, offset: const Offset(0, 8))]),
      child: const Icon(Icons.sports, color: Colors.white, size: 32)),
    const SizedBox(height: 16),
    ShaderMask(shaderCallback: (bounds) => SmGradients.brand.createShader(bounds),
      child: const Text('SportMaps', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold))),
    const SizedBox(height: 4),
    const Text('Ecosistema deportivo integral', style: TextStyle(color: Colors.white60, fontSize: 13)),
  ]);
}

class _SocialButton extends StatelessWidget {
  final String label; final IconData icon; final VoidCallback onTap;
  const _SocialButton({required this.label, required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(onPressed: onTap, icon: Icon(icon, size: 18), label: Text(label),
    style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.onSurface, side: const BorderSide(color: SmColors.border),
      padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
  );
}
