// ============================================================
// SportMaps — Finance Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:sportmaps/widgets/direct/direct_components.dart';
import 'package:sportmaps/widgets/adaptable/adaptable_components.dart';
import 'package:sportmaps/widgets/custom/sidebar_toast_search.dart';
import 'package:sportmaps/widgets/custom/charts_widget.dart';
import 'package:sportmaps/theme/sportmaps_theme.dart';

enum PaymentStatus { paid, pending, overdue, cancelled }
extension PaymentStatusX on PaymentStatus {
  String get label => switch (this) {
    PaymentStatus.paid      => 'Pagado',
    PaymentStatus.pending   => 'Pendiente',
    PaymentStatus.overdue   => 'Vencido',
    PaymentStatus.cancelled => 'Cancelado',
  };
  Color get color => switch (this) {
    PaymentStatus.paid      => const Color(0xFF22C55E),
    PaymentStatus.pending   => const Color(0xFFFB9F1E),
    PaymentStatus.overdue   => const Color(0xFFEF4444),
    PaymentStatus.cancelled => const Color(0xFF9CA3AF),
  };
  SmBadgeVariant get badge => switch (this) {
    PaymentStatus.paid      => SmBadgeVariant.primary,
    PaymentStatus.pending   => SmBadgeVariant.warning,
    PaymentStatus.overdue   => SmBadgeVariant.destructive,
    PaymentStatus.cancelled => SmBadgeVariant.outline,
  };
}

class SmPayment {
  final String id, studentName, concept;
  final String? avatarUrl;
  final double amount;
  final PaymentStatus status;
  final DateTime dueDate;
  final DateTime? paidDate;
  const SmPayment({required this.id, required this.studentName,
      this.avatarUrl, required this.concept, required this.amount,
      required this.status, required this.dueDate, this.paidDate});
}

final _mockPayments = [
  SmPayment(id:'1', studentName:'Carlos García',   concept:'Mensualidad Marzo',   amount:80000,  status:PaymentStatus.paid,    dueDate:DateTime(2026,3,5),  paidDate:DateTime(2026,3,3)),
  SmPayment(id:'2', studentName:'Ana Martínez',    concept:'Mensualidad Marzo',   amount:80000,  status:PaymentStatus.paid,    dueDate:DateTime(2026,3,5),  paidDate:DateTime(2026,3,5)),
  SmPayment(id:'3', studentName:'Luis Rodríguez',  concept:'Mensualidad Marzo',   amount:80000,  status:PaymentStatus.pending, dueDate:DateTime(2026,3,10)),
  SmPayment(id:'4', studentName:'María López',     concept:'Kit Deportivo',       amount:120000, status:PaymentStatus.pending, dueDate:DateTime(2026,3,15)),
  SmPayment(id:'5', studentName:'Pedro Sánchez',   concept:'Mensualidad Febrero', amount:80000,  status:PaymentStatus.overdue, dueDate:DateTime(2026,2,5)),
  SmPayment(id:'6', studentName:'Sofía Torres',    concept:'Inscripción Torneo',  amount:45000,  status:PaymentStatus.paid,    dueDate:DateTime(2026,3,1),  paidDate:DateTime(2026,2,28)),
  SmPayment(id:'7', studentName:'Diego Herrera',   concept:'Mensualidad Marzo',   amount:80000,  status:PaymentStatus.pending, dueDate:DateTime(2026,3,10)),
  SmPayment(id:'8', studentName:'Valentina Ruiz',  concept:'Mensualidad Febrero', amount:80000,  status:PaymentStatus.overdue, dueDate:DateTime(2026,2,5)),
];

class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});
  @override ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  @override void initState() { super.initState(); _tabs = TabController(length: 3, vsync: this); }
  @override void dispose()   { _tabs.dispose(); super.dispose(); }

  double get _totalPaid    => _mockPayments.where((p) => p.status==PaymentStatus.paid).fold(0,(s,p)=>s+p.amount);
  double get _totalPending => _mockPayments.where((p) => p.status==PaymentStatus.pending||p.status==PaymentStatus.overdue).fold(0,(s,p)=>s+p.amount);
  int    get _overdueCount => _mockPayments.where((p) => p.status==PaymentStatus.overdue).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      body: NestedScrollView(
        headerSliverBuilder: (_,__) => [
          SliverAppBar(
            floating: true, snap: true,
            title: const Text('Finanzas', style: TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              IconButton(icon: const Icon(Icons.download_outlined), onPressed: () => SmToast.show(context, message: 'Exportando PDF...', type: SmToastType.info)),
              IconButton(icon: const Icon(Icons.add), onPressed: () => _showRegister(context)),
            ],
            bottom: TabBar(controller: _tabs, tabs: const [Tab(text:'Resumen'), Tab(text:'Pagos'), Tab(text:'Pendientes')]),
          ),
        ],
        body: TabBarView(controller: _tabs, children: [_summary(), _history(), _pending()]),
      ),
    );
  }

  Widget _summary() => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(children: [
      GridView.count(crossAxisCount:2, mainAxisSpacing:12, crossAxisSpacing:12, childAspectRatio:1.4, shrinkWrap:true, physics:const NeverScrollableScrollPhysics(),
        children: [
          SmStatCard(title:'Recaudado (Mar)', value:_fmt(_totalPaid),    icon:Icons.trending_up,      iconColor:const Color(0xFF22C55E), trend:'+8% vs Feb',   trendUp:true),
          SmStatCard(title:'Por cobrar',      value:_fmt(_totalPending), icon:Icons.pending_outlined,  iconColor:const Color(0xFFFB9F1E), subtitle:'${_mockPayments.where((p)=>p.status==PaymentStatus.pending).length} pagos'),
          SmStatCard(title:'Vencidos',        value:'$_overdueCount pagos',icon:Icons.warning_amber_outlined, iconColor:const Color(0xFFEF4444), trend:'Acción requerida', trendUp:false),
          SmStatCard(title:'Estudiantes',     value:'${_mockPayments.map((p)=>p.studentName).toSet().length}', icon:Icons.people_outline, subtitle:'Con plan activo'),
        ],
      ),
      const SizedBox(height:20),
      SmCard(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children:[
          Text('Ingresos mensuales', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
          const SmBadge(label:'2026', variant:SmBadgeVariant.outline),
        ]),
        const SizedBox(height:4),
        const Text('Últimas 6 meses', style: TextStyle(fontSize: 12, color: SmColors.mutedForeground)),
        const SizedBox(height:16),
        SizedBox(height:160, child: SmBarChart(
          barGroups: [680,720,695,810,755,880].asMap().entries.map((e) => smBarGroup(x: e.key, value: e.value.toDouble()/10)).toList(),
          bottomLabels: const ['Oct','Nov','Dic','Ene','Feb','Mar'],
        )),
        const SizedBox(height:8),
        Row(mainAxisAlignment:MainAxisAlignment.spaceAround,
          children: ['Oct','Nov','Dic','Ene','Feb','Mar'].map((m) => Text(m, style:const TextStyle(fontSize:10, color:SmColors.mutedForeground))).toList()),
      ])),
      const SizedBox(height:20),
      SmCard(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Text('Distribución pagos', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight:FontWeight.bold)),
        const SizedBox(height:16),
        SizedBox(height:180, child: SmPieChart(sections: [
          PieChartSectionData(value:_totalPaid, title:'Pagado', color:const Color(0xFF22C55E), radius:60, titleStyle:const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold)),
          PieChartSectionData(value:_mockPayments.where((p)=>p.status==PaymentStatus.pending).fold<double>(0.0,(s,p)=>s + p.amount), title:'Pendiente', color:const Color(0xFFFB9F1E), radius:55, titleStyle:const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold)),
          PieChartSectionData(value:_mockPayments.where((p)=>p.status==PaymentStatus.overdue).fold<double>(0.0,(s,p)=>s + p.amount), title:'Vencido', color:const Color(0xFFEF4444), radius:50, titleStyle:const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold)),
        ])),
      ])),
    ]),
  );

  Widget _history() {
    final paid = _mockPayments.where((p)=>p.status==PaymentStatus.paid).toList();
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: paid.length,
      separatorBuilder: (_,__) => const SizedBox(height:8),
      itemBuilder: (_,i) => _PaymentTile(payment:paid[i]),
    );
  }

  Widget _pending() {
    final list = _mockPayments
        .where((p)=>p.status==PaymentStatus.pending||p.status==PaymentStatus.overdue)
        .toList()..sort((a, b) {
          if (a.status == PaymentStatus.overdue && b.status != PaymentStatus.overdue) {
            return -1;
          }
          if (b.status == PaymentStatus.overdue && a.status != PaymentStatus.overdue) {
            return 1;
          }
          return a.dueDate.compareTo(b.dueDate);
        });
    if (list.isEmpty) {
      return const SmEmptyState(
          icon: Icons.check_circle_outline,
          title: '¡Todo al día!',
          description: 'No hay pagos pendientes ni vencidos.');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      separatorBuilder: (_,__) => const SizedBox(height:8),
      itemBuilder: (_,i) => _PaymentTile(payment:list[i], showAction:true,
          onMarkPaid:() => SmToast.show(context, message:'Pago registrado', description:'${list[i].studentName} — ${_fmt(list[i].amount)}', type:SmToastType.success)),
    );
  }

  void _showRegister(BuildContext ctx) => SmBottomSheet.show<void>(ctx, initialSize:0.55,
    builder: (c,_) => _RegisterForm(onSaved:() => Navigator.of(c).pop()));

  String _fmt(double v) {
    if (v >= 1000000) {
      return '\$${(v / 1000000).toStringAsFixed(1)}M';
    }
    if (v >= 1000) {
      return '\$${(v / 1000).toStringAsFixed(0)}k';
    }
    return '\$${v.toStringAsFixed(0)}';
  }
}

class _PaymentTile extends StatelessWidget {
  final SmPayment payment;
  final bool showAction;
  final VoidCallback? onMarkPaid;
  const _PaymentTile({required this.payment, this.showAction=false, this.onMarkPaid});

  @override
  Widget build(BuildContext ctx) => SmCard(
    child: Row(children: [
      SmAvatar(name:payment.studentName, size:42),
      const SizedBox(width:12),
      Expanded(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Text(payment.studentName, style:const TextStyle(fontWeight:FontWeight.w600)),
        Text(payment.concept,     style:const TextStyle(fontSize:12, color:SmColors.mutedForeground)),
        const SizedBox(height:4),
        Row(children:[
          SmBadge(label:payment.status.label, variant:payment.status.badge),
          const SizedBox(width:8),
          Text(_fmtDate(payment.status==PaymentStatus.paid ? payment.paidDate! : payment.dueDate),
              style:const TextStyle(fontSize:11, color:SmColors.mutedForeground)),
        ]),
      ])),
      Column(crossAxisAlignment:CrossAxisAlignment.end, children:[
        Text('\$${(payment.amount/1000).toStringAsFixed(0)}k',
            style:TextStyle(fontWeight:FontWeight.bold,
              color:payment.status==PaymentStatus.paid ? const Color(0xFF22C55E)
                  : payment.status==PaymentStatus.overdue ? const Color(0xFFEF4444)
                  : SmColors.foreground)),
        if(showAction&&onMarkPaid!=null)...[
          const SizedBox(height:4),
          GestureDetector(onTap:onMarkPaid,
            child: Container(padding:const EdgeInsets.symmetric(horizontal:8,vertical:3),
              decoration:BoxDecoration(color:SmColors.primary.withValues(alpha: 0.1),
                borderRadius:BorderRadius.circular(6), border:Border.all(color:SmColors.primary.withValues(alpha: 0.3))),
              child:const Text('Pagar', style:TextStyle(fontSize:11, color:SmColors.primary, fontWeight:FontWeight.w600)))),
        ],
      ]),
    ]),
  );
  String _fmtDate(DateTime d) => '${d.day.toString().padLeft(2,'0')}/${d.month.toString().padLeft(2,'0')}/${d.year}';
}

class _RegisterForm extends StatefulWidget {
  final VoidCallback onSaved;
  const _RegisterForm({required this.onSaved});
  @override State<_RegisterForm> createState() => _RegisterFormState();
}
class _RegisterFormState extends State<_RegisterForm> {
  final _key=GlobalKey<FormState>(); final _amt=TextEditingController();
  String _concept='Mensualidad';  final bool _loading = false;
  @override
  Widget build(BuildContext ctx) => Padding(
    padding: EdgeInsets.only(left:24,right:24,top:8,bottom:MediaQuery.viewInsetsOf(ctx).bottom+24),
    child: Form(key:_key, child: Column(mainAxisSize:MainAxisSize.min, crossAxisAlignment:CrossAxisAlignment.start, children:[
      Text('Registrar pago', style:Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.bold)),
      const SizedBox(height:20),
      SmSelect<String>(label:'Concepto', value:_concept,
        options:['Mensualidad','Inscripción','Kit deportivo','Torneo','Otro'].map((c)=>SmSelectOption(value:c,label:c)).toList(),
        onChanged:(v)=>setState(()=>_concept=v??_concept)),
      const SizedBox(height:16),
      SmInput(label:'Monto', hint:'80000', controller:_amt, keyboardType:TextInputType.number,
        prefixIcon:Icons.attach_money, validator:(v)=>v==null||v.isEmpty?'Ingresa el monto':null),
      const SizedBox(height:24),
      SmButton(label:'Guardar', variant:SmButtonVariant.primary, fullWidth:true, loading:_loading,
        onPressed: () {
          if (_key.currentState!.validate()) {
            widget.onSaved();
          }
        }),
    ])),
  );
}
