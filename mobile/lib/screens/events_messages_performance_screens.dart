// ============================================================
// SportMaps — Events + Messages + Performance Screens
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

// ════════════════════════════════════════════════════════════
// EVENTS SCREEN
// ════════════════════════════════════════════════════════════
class EventsScreen extends ConsumerStatefulWidget {
  const EventsScreen({super.key});
  @override ConsumerState<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends ConsumerState<EventsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  String _filterType = 'Todos';
  static const _types = ['Todos', 'Torneo', 'Entrenamiento', 'Partido', 'Otro'];

  @override void initState() { super.initState(); _tabs = TabController(length: 2, vsync: this); }
  @override void dispose()   { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(eventsProvider);
    final role        = ref.watch(currentRoleProvider);
    final canCreate   = role == SmUserRole.admin || role == SmUserRole.schoolAdmin || role == SmUserRole.coach;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: NestedScrollView(
        headerSliverBuilder: (_,__) => [
          SliverAppBar(
            floating: true, snap: true,
            title: const Text('Eventos', style: TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              if (canCreate) IconButton(
                icon: const Icon(Icons.add),
                onPressed: () => _showCreate(context),
              ),
            ],
            bottom: TabBar(controller: _tabs, tabs: const [Tab(text:'Lista'), Tab(text:'Calendario')]),
          ),
        ],
        body: TabBarView(controller: _tabs, children: [
          _listTab(eventsAsync, canCreate),
          _calendarTab(eventsAsync),
        ]),
      ),
    );
  }

  Widget _listTab(AsyncValue<List<SmEvent>> eventsAsync, bool canCreate) =>
    Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16,12,16,4),
        child: SmScrollArea(scrollDirection:Axis.horizontal, showScrollbar:false,
          child: Row(children: _types.map((t) {
            final active = t == _filterType;
            return Padding(padding: const EdgeInsets.only(right:8),
              child: FilterChip(
                label: Text(t), selected: active,
                onSelected: (_) => setState(() => _filterType = t),
                selectedColor: SmColors.primary.withValues(alpha: 0.12),
                checkmarkColor: SmColors.primary,
                labelStyle: TextStyle(color: active ? SmColors.primary : SmColors.mutedForeground,
                    fontWeight: active ? FontWeight.w600 : FontWeight.normal),
              ));
          }).toList())),
      ),
      Expanded(child: eventsAsync.when(
        loading: () => ListView(padding:const EdgeInsets.all(16), children:
            List.generate(4, (_) => const Padding(padding:EdgeInsets.only(bottom:10),
                child:SmSkeleton(height:120, borderRadius: 12)))),
        error: (e,_) => SmEmptyState(icon:Icons.error_outline, title:'Error', description:e.toString()),
        data: (events) {
          final filtered = _filterType=='Todos' ? events
              : events.where((e) => e.type.toLowerCase()==_filterType.toLowerCase()).toList();
          if (filtered.isEmpty) {
            return SmEmptyState(
              icon: Icons.event_outlined,
              title: 'Sin eventos',
              description: _filterType != 'Todos'
                  ? 'No hay eventos de tipo "$_filterType"'
                  : 'No hay eventos próximos.',
              actionLabel: canCreate ? 'Crear evento' : null,
              onAction: canCreate ? () => _showCreate(context) : null,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: filtered.length,
            separatorBuilder: (_,__) => const SizedBox(height:10),
            itemBuilder: (_,i) => _EventCard(event:filtered[i]),
          );
        },
      )),
    ]);

  Widget _calendarTab(AsyncValue<List<SmEvent>> eventsAsync) {
    final events = eventsAsync.valueOrNull ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children:[
        SmCalendar(
          events: {
            for (final e in events)
              DateTime(e.startDate.year, e.startDate.month, e.startDate.day):
                  [e.title],
          },
        ),
        const SizedBox(height:16),
        if (events.isNotEmpty) ...[
          Text('Próximos eventos', style:Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
          const SizedBox(height:12),
          ...events.take(5).map((e) => Padding(padding:const EdgeInsets.only(bottom:10),
              child: _EventCard(event:e))),
        ],
      ]),
    );
  }

  void _showCreate(BuildContext ctx) => SmBottomSheet.show<void>(
    ctx, initialSize: 0.75,
    builder: (c,_) => _CreateEventForm(onCreated: () => Navigator.of(c).pop()),
  );
}

class _EventCard extends StatelessWidget {
  final SmEvent event;
  const _EventCard({required this.event});

  static const _typeColors = {
    'tournament': Color(0xFF8B5CF6),
    'training':   Color(0xFF22C55E),
    'match':      Color(0xFF3B82F6),
    'other':      Color(0xFF9CA3AF),
  };
  static const _typeIcons = {
    'tournament': Icons.emoji_events_outlined,
    'training':   Icons.fitness_center_outlined,
    'match':      Icons.sports_soccer_outlined,
    'other':      Icons.event_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final color = _typeColors[event.type] ?? SmColors.primary;
    final icon  = _typeIcons[event.type]  ?? Icons.event_outlined;
    return SmCard(
      child: Row(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Container(width:50, padding:const EdgeInsets.symmetric(vertical:8),
          decoration:BoxDecoration(color:color.withValues(alpha: 0.1), borderRadius:BorderRadius.circular(10)),
          child:Column(children:[
            Text('${event.startDate.day}',
                style:TextStyle(color:color, fontWeight:FontWeight.bold, fontSize:20)),
            Text(_month(event.startDate.month),
                style:TextStyle(color:color, fontSize:11)),
          ])),
        const SizedBox(width:14),
        Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
          Row(children:[
            Icon(icon, size:14, color:color),
            const SizedBox(width:4),
            SmBadge(label:_typeLabel(event.type), variant:SmBadgeVariant.secondary),
            if (event.isPublic)...[const SizedBox(width:4), const SmBadge(label:'Público', variant:SmBadgeVariant.outline)],
          ]),
          const SizedBox(height:4),
          Text(event.title, style:const TextStyle(fontWeight:FontWeight.w700, fontSize:14)),
          if (event.location != null)
            Row(children:[
              const Icon(Icons.location_on_outlined, size:12, color:SmColors.mutedForeground),
              const SizedBox(width:2),
              Text(event.location!, style:const TextStyle(fontSize:12, color:SmColors.mutedForeground)),
            ]),
          const SizedBox(height:6),
          Row(children:[
            const Icon(Icons.schedule_outlined, size:12, color:SmColors.mutedForeground),
            const SizedBox(width:4),
            Text(_fmtTime(event.startDate),
                style:const TextStyle(fontSize:12, color:SmColors.mutedForeground)),
            if (event.capacity != null)...[
              const SizedBox(width:12),
              const Icon(Icons.people_outline, size:12, color:SmColors.mutedForeground),
              const SizedBox(width:4),
              Text('${event.registeredCount}/${event.capacity}',
                  style:TextStyle(fontSize:12,
                      color: event.isFull ? const Color(0xFFEF4444) : SmColors.mutedForeground)),
            ],
          ]),
        ])),
      ]),
    );
  }
  String _month(int m) => ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m];
  String _fmtTime(DateTime d) => '${d.hour.toString().padLeft(2,'0')}:${d.minute.toString().padLeft(2,'0')}';
  String _typeLabel(String t) => switch(t) {
    'tournament' => 'Torneo', 'training' => 'Entrenamiento', 'match' => 'Partido', _ => 'Otro'
  };
}

class _CreateEventForm extends ConsumerStatefulWidget {
  final VoidCallback onCreated;
  const _CreateEventForm({required this.onCreated});
  @override ConsumerState<_CreateEventForm> createState() => _CreateEventFormState();
}
class _CreateEventFormState extends ConsumerState<_CreateEventForm> {
  final _key = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _loc = TextEditingController();
  String _type = 'training';
  bool _public = false, _loading = false;
  final DateTime _date = DateTime.now().add(const Duration(days: 7));
  @override
  Widget build(BuildContext context) => Padding(
    padding:EdgeInsets.only(left:24,right:24,top:8,bottom:MediaQuery.viewInsetsOf(context).bottom+24),
    child:Form(key:_key, child:Column(mainAxisSize:MainAxisSize.min, crossAxisAlignment:CrossAxisAlignment.start, children:[
      Text('Nuevo evento', style:Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.bold)),
      const SizedBox(height:20),
      SmInput(label:'Título', hint:'Copa Interna 2026', controller:_title,
          validator:(v)=>v==null||v.isEmpty?'Requerido':null),
      const SizedBox(height:16),
      SmSelect<String>(label:'Tipo', value:_type,
        options:['training','tournament','match','other'].map((t)=>SmSelectOption(value:t,
            label:switch(t){'training'=>'Entrenamiento','tournament'=>'Torneo','match'=>'Partido',_=>'Otro'})).toList(),
        onChanged:(v)=>setState(()=>_type=v??_type)),
      const SizedBox(height:16),
      SmInput(label:'Lugar (opcional)', hint:'Cancha Norte', controller:_loc, prefixIcon:Icons.location_on_outlined),
      const SizedBox(height:16),
      SmSwitch(value:_public, label:'Evento público', description:'Visible en el mapa para todos',
          onChanged:(v)=>setState(()=>_public=v)),
      const SizedBox(height:24),
      SmButton(label:'Crear evento', variant:SmButtonVariant.primary, fullWidth:true, loading:_loading,
        onPressed: () async {
          if (!_key.currentState!.validate()) {
            return;
          }
          setState(() => _loading = true);
          try {
            await ref.read(eventsProvider.notifier).createEvent(
                title: _title.text.trim(),
                startDate: _date,
                type: _type,
                location: _loc.text.isEmpty ? null : _loc.text.trim(),
                isPublic: _public);
            if (mounted) {
              widget.onCreated();
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

// ════════════════════════════════════════════════════════════
// MESSAGES SCREEN
// ════════════════════════════════════════════════════════════
class SmMockThread { final String id,name,lastMsg,time; final int unread; final bool online;
  const SmMockThread({required this.id,required this.name,required this.lastMsg,required this.time,required this.unread,required this.online}); }

const _mockThreads = <SmMockThread>[
  SmMockThread(id:'1', name:'Coach Torres',        lastMsg:'Recuerda el entrenamiento mañana a las 7am', time:'10:30', unread:2, online:true),
  SmMockThread(id:'2', name:'Ana García (Mamá)',   lastMsg:'Muchas gracias por la info 🙏',               time:'9:15',  unread:0, online:false),
  SmMockThread(id:'3', name:'Equipo Sub-14',       lastMsg:'Luis: ¡Nos vemos en la cancha!',              time:'Ayer',  unread:5, online:true),
  SmMockThread(id:'4', name:'Admin Academia',      lastMsg:'Recuerda verificar los pagos pendientes',    time:'Mar',  unread:1, online:false),
  SmMockThread(id:'5', name:'Dr. Ramírez (Médico)',lastMsg:'El informe médico está listo',               time:'Mar',  unread:0, online:false),
];

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override State<MessagesScreen> createState() => _MessagesScreenState();
}
class _MessagesScreenState extends State<MessagesScreen> {
  String _search = '';
  @override
  Widget build(BuildContext context) {
    final threads = _search.isEmpty ? _mockThreads
        : _mockThreads.where((t)=>t.name.toLowerCase().contains(_search.toLowerCase())).toList();
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers:[
        SliverAppBar(floating:true, snap:true,
          title:const Text('Mensajes', style:TextStyle(fontWeight:FontWeight.bold)),
          actions:[IconButton(icon:const Icon(Icons.edit_outlined), onPressed:(){})],
        ),
        SliverPadding(padding:const EdgeInsets.all(16), sliver:SliverList(delegate:SliverChildListDelegate([
          SmInput(hint:'Buscar conversación...', prefixIcon:Icons.search,
              onChanged:(v)=>setState(()=>_search=v)),
          const SizedBox(height:16),
          if (threads.isEmpty)
            const SmEmptyState(icon:Icons.chat_bubble_outline, title:'Sin resultados', description:'Intenta otro nombre')
          else
            ...threads.map((t) => _ThreadTile(
                thread: t,
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => MessageThreadScreen(thread: t))))),
        ]))),
      ]),
    );
  }
}

class _ThreadTile extends StatelessWidget {
  final SmMockThread thread; final VoidCallback onTap;
  const _ThreadTile({required this.thread, required this.onTap});
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Padding(padding:const EdgeInsets.symmetric(vertical:10, horizontal:4), child:Row(children:[
      Stack(clipBehavior:Clip.none, children:[
        SmAvatar(name:thread.name, size:48),
        if (thread.online)
          Positioned(right:0,bottom:0,
            child:Container(width:12, height:12,
              decoration:BoxDecoration(color:const Color(0xFF22C55E), shape:BoxShape.circle,
                  border:Border.all(color:Colors.white, width:2)))),
      ]),
      const SizedBox(width:12),
      Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children:[
          Text(thread.name, style:const TextStyle(fontWeight:FontWeight.w600, fontSize:14)),
          Text(thread.time, style:const TextStyle(fontSize:11, color:SmColors.mutedForeground)),
        ]),
        const SizedBox(height:2),
        Row(children:[
          Expanded(child:Text(thread.lastMsg, maxLines:1, overflow:TextOverflow.ellipsis,
              style:TextStyle(fontSize:12, color:thread.unread>0?SmColors.foreground:SmColors.mutedForeground,
                  fontWeight:thread.unread>0?FontWeight.w500:FontWeight.normal))),
          if (thread.unread>0) Container(margin:const EdgeInsets.only(left:8),
            padding:const EdgeInsets.symmetric(horizontal:6, vertical:2),
            decoration:BoxDecoration(color:SmColors.primary, borderRadius:BorderRadius.circular(10)),
            child:Text('${thread.unread}', style:const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold))),
        ]),
      ])),
    ])),
  );
}

class MessageThreadScreen extends StatefulWidget {
  final SmMockThread thread;
  const MessageThreadScreen({super.key, required this.thread});
  @override State<MessageThreadScreen> createState() => _MessageThreadScreenState();
}
class _MessageThreadScreenState extends State<MessageThreadScreen> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  final _msgs = [
    const _ChatMsg(text:'Hola, ¿cómo van los entrenamientos?', mine:false, time:'9:00'),
    const _ChatMsg(text:'¡Muy bien! El equipo está mejorando mucho esta semana', mine:true, time:'9:05'),
    const _ChatMsg(text:'Perfecto. Recuerden que mañana entrenamos a las 7am en la cancha 2', mine:false, time:'9:10'),
    const _ChatMsg(text:'Entendido, estaremos allí 💪', mine:true, time:'9:12'),
    const _ChatMsg(text:'Recuerda el entrenamiento mañana a las 7am', mine:false, time:'10:30'),
  ];
  @override void dispose() { _ctrl.dispose(); _scroll.dispose(); super.dispose(); }
  void _send() {
    if (_ctrl.text.trim().isEmpty) {
      return;
    }
    setState(() => _msgs.add(_ChatMsg(text: _ctrl.text.trim(), mine: true, time: 'Ahora')));
    _ctrl.clear();
    Future.delayed(const Duration(milliseconds: 100), () {
      _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar:AppBar(
      title:Row(children:[
        SmAvatar(name:widget.thread.name, size:36),
        const SizedBox(width:10),
        Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
          Text(widget.thread.name, style:const TextStyle(fontSize:15, fontWeight:FontWeight.w600)),
          if (widget.thread.online)
            const Text('En línea', style:TextStyle(fontSize:11, color:Color(0xFF22C55E))),
        ]),
      ]),
    ),
    body:Column(children:[
      Expanded(child:ListView.builder(
        controller:_scroll,
        padding:const EdgeInsets.all(16),
        itemCount:_msgs.length,
        itemBuilder:(_,i)=>_MsgBubble(msg:_msgs[i]),
      )),
      Container(
        padding:const EdgeInsets.fromLTRB(16,8,8,16),
        decoration:BoxDecoration(color:Theme.of(context).colorScheme.surface,
            border:const Border(top:BorderSide(color:SmColors.border))),
        child:Row(children:[
          Expanded(child:TextField(controller:_ctrl,
            decoration:InputDecoration(hintText:'Escribe un mensaje...', border:OutlineInputBorder(borderRadius:BorderRadius.circular(24), borderSide:BorderSide.none),
                filled:true, fillColor:SmColors.muted, contentPadding:const EdgeInsets.symmetric(horizontal:16, vertical:10)),
            onSubmitted:(_)=>_send(), textInputAction:TextInputAction.send)),
          const SizedBox(width:8),
          CircleAvatar(backgroundColor:SmColors.primary, radius:22,
            child:IconButton(icon:const Icon(Icons.send, color:Colors.white, size:18), onPressed:_send)),
        ]),
      ),
    ]),
  );
}
class _ChatMsg { final String text, time; final bool mine; const _ChatMsg({required this.text, required this.time, required this.mine}); }
class _MsgBubble extends StatelessWidget {
  final _ChatMsg msg;
  const _MsgBubble({required this.msg});
  @override
  Widget build(BuildContext context) => Padding(
    padding:const EdgeInsets.only(bottom:8),
    child:Align(alignment:msg.mine?Alignment.centerRight:Alignment.centerLeft,
      child:ConstrainedBox(constraints:BoxConstraints(maxWidth:MediaQuery.sizeOf(context).width*0.72),
        child:Container(
          padding:const EdgeInsets.symmetric(horizontal:14, vertical:10),
          decoration:BoxDecoration(
            color:msg.mine?SmColors.primary:Theme.of(context).colorScheme.surfaceContainerHigh,
            borderRadius:BorderRadius.only(
              topLeft:const Radius.circular(16), topRight:const Radius.circular(16),
              bottomLeft:Radius.circular(msg.mine?16:4), bottomRight:Radius.circular(msg.mine?4:16)),
          ),
          child:Column(crossAxisAlignment:CrossAxisAlignment.end, children:[
            Text(msg.text, style:TextStyle(color:msg.mine?Colors.white:Theme.of(context).colorScheme.onSurface, fontSize:14, height:1.4)),
            const SizedBox(height:2),
            Text(msg.time, style:TextStyle(color:msg.mine?Colors.white70:SmColors.mutedForeground, fontSize:10)),
          ]),
        ))),
  );
}

// ════════════════════════════════════════════════════════════
// PERFORMANCE SCREEN
// ════════════════════════════════════════════════════════════
class PerformanceScreen extends ConsumerWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teams = ref.watch(teamsProvider).valueOrNull ?? [];
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: CustomScrollView(slivers:[
        const SliverAppBar(floating:true, snap:true,
          title:Text('Rendimiento', style:TextStyle(fontWeight:FontWeight.bold))),
        SliverPadding(padding:const EdgeInsets.all(16), sliver:SliverList(delegate:SliverChildListDelegate([
          // Asistencia general
          SmCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
            Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children:[
              Text('Asistencia general', style:Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
              const SmBadge(label:'87% promedio', variant:SmBadgeVariant.secondary),
            ]),
            const SizedBox(height:4),
            const Text('Últimas 8 semanas', style: TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
            const SizedBox(height:16),
            const SizedBox(height:160, child:SmLineChart(label:'%', spots:[
              FlSpot(0,82),FlSpot(1,78),FlSpot(2,85),FlSpot(3,90),FlSpot(4,83),FlSpot(5,87),FlSpot(6,89),FlSpot(7,87),
            ])),
          ])),
          const SizedBox(height:16),
          // Por equipo
          Text('Por equipo', style:Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight:FontWeight.bold)),
          const SizedBox(height:12),
          if (teams.isEmpty)
            const SmEmptyState(icon:Icons.groups_outlined, title:'Sin equipos', description:'Crea equipos para ver estadísticas')
          else
            ...teams.map((t) => Padding(padding:const EdgeInsets.only(bottom:10),
              child:SmCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
                Row(children:[
                  const Icon(Icons.groups_outlined, size:18, color:SmColors.primary),
                  const SizedBox(width:8),
                  Expanded(child:Text(t.name, style:const TextStyle(fontWeight:FontWeight.w600))),
                  SmBadge(label:t.category, variant:SmBadgeVariant.outline),
                ]),
                const SizedBox(height:10),
                Row(children:[
                  Expanded(child:_TeamStat(label:'Atletas', value:'${t.playerCount}')),
                  Expanded(child: const _TeamStat(label:'Asistencia', value:'85%')),
                  Expanded(child: const _TeamStat(label:'Sesiones', value:'12')),
                ]),
                const SizedBox(height:10),
                const SmProgress(value:0.85, label:'Asistencia este mes', showPercent:true),
              ])))),
          const SizedBox(height:16),
          // Gráfica barras comparativa
          SmCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
            Text('Sesiones por mes', style:Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
            const SizedBox(height:16),
            SizedBox(height:160, child:SmBarChart(
              barGroups: [20,22,18,24,22,25].asMap().entries.map((e) =>
                smBarGroup(x: e.key, value: e.value.toDouble())).toList(),
              bottomLabels: const ['Oct','Nov','Dic','Ene','Feb','Mar'],
            )),
          ])),
        ]))),
      ]),
    );
  }
}

class _TeamStat extends StatelessWidget {
  final String label, value;
  const _TeamStat({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Column(children:[
    Text(value, style:const TextStyle(fontWeight:FontWeight.bold, fontSize:18, color:SmColors.primary)),
    const SizedBox(height:2),
    Text(label, style:const TextStyle(fontSize:11, color:SmColors.mutedForeground)),
  ]);
}
