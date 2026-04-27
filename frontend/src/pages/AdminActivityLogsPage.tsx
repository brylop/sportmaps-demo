import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Activity, CreditCard, Database, BarChart3, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

type SchoolOption = { id: string; name: string };

const PAGE_SIZE = 50;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminActivityLogsPage() {
  const { toast } = useToast();

  // Global filters
  const [from, setFrom] = useState<string>(isoDaysAgo(7).slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [schoolId, setSchoolId] = useState<string>('all');
  const [schools, setSchools] = useState<SchoolOption[]>([]);

  // Section data
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fromIso = useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
  const toIso = useMemo(() => new Date(`${to}T23:59:59`).toISOString(), [to]);

  useEffect(() => {
    void loadSchools();
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [from, to]);

  async function loadSchools() {
    const { data, error } = await supabase.rpc('admin_list_schools_for_filter' as any);
    if (error) {
      toast({ title: 'Sin acceso', description: error.message, variant: 'destructive' });
      return;
    }
    setSchools(((data as any[]) || []) as SchoolOption[]);
  }

  async function loadSummary() {
    setSummaryLoading(true);
    const { data, error } = await supabase.rpc('admin_activity_summary' as any, {
      p_from: fromIso,
      p_to: toIso,
    });
    if (error) {
      toast({ title: 'Error cargando resumen', description: error.message, variant: 'destructive' });
      setSummary(null);
    } else {
      setSummary(data);
    }
    setSummaryLoading(false);
  }

  const filterSchoolId = schoolId === 'all' ? null : schoolId;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Logs y actividad global
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Observabilidad de toda la plataforma — solo lectura. Las escuelas siguen gestionando sus pagos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSummary} disabled={summaryLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${summaryLoading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </header>

      {/* Filtros globales */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="school">Escuela</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger id="school">
                <SelectValue placeholder="Todas las escuelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las escuelas</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <SummaryGrid summary={summary} loading={summaryLoading} />

      {/* Tabs */}
      <Tabs defaultValue="payments">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Pagos</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="audit"><Database className="h-4 w-4 mr-1.5" />Auditoría</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1.5" />Analítica</TabsTrigger>
          <TabsTrigger value="events"><Trophy className="h-4 w-4 mr-1.5" />Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentsTab fromIso={fromIso} toIso={toIso} schoolId={filterSchoolId} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab fromIso={fromIso} toIso={toIso} schoolId={filterSchoolId} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab fromIso={fromIso} toIso={toIso} schoolId={filterSchoolId} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab fromIso={fromIso} toIso={toIso} />
        </TabsContent>
        <TabsContent value="events">
          <EventTelemetryTab fromIso={fromIso} toIso={toIso} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen (KPIs)
// ─────────────────────────────────────────────────────────────────────────────
function SummaryGrid({ summary, loading }: { summary: any; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando resumen…
        </CardContent>
      </Card>
    );
  }
  if (!summary) return null;

  const kpis: Array<{ label: string; value: string | number }> = [
    { label: 'Pagos aprobados', value: summary.payments_paid_count ?? 0 },
    { label: 'Pagos pendientes', value: summary.payments_pending_count ?? 0 },
    { label: 'Monto recaudado', value: formatCurrency(Number(summary.payments_paid_amount || 0)) },
    { label: 'Eventos billing', value: summary.billing_events_count ?? 0 },
    { label: 'Inscripciones nuevas', value: summary.new_enrollments ?? 0 },
    { label: 'Usuarios nuevos', value: summary.new_users ?? 0 },
    { label: 'Escuelas activas', value: summary.active_schools ?? 0 },
    { label: 'Eventos UI', value: summary.analytics_events_count ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{k.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic paginated tab helper
// ─────────────────────────────────────────────────────────────────────────────
function usePagedRpc(
  rpcName: string,
  params: Record<string, any>,
  deps: any[]
) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const { data, error } = await supabase.rpc(rpcName as any, {
        ...params,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setRows([]);
        setTotal(0);
      } else {
        setRows(((data as any)?.rows ?? []) as any[]);
        setTotal(Number((data as any)?.total ?? 0));
      }
      setLoading(false);
    }
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, page]);

  return { rows, total, loading, page, setPage };
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (n: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>{total} registros</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>{page + 1} / {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments tab
// ─────────────────────────────────────────────────────────────────────────────
function PaymentsTab({ fromIso, toIso, schoolId }: { fromIso: string; toIso: string; schoolId: string | null }) {
  const [status, setStatus] = useState<string>('all');
  const [method, setMethod] = useState<string>('all');

  const params = {
    p_school_id: schoolId,
    p_status: status === 'all' ? null : status,
    p_method: method === 'all' ? null : method,
    p_from: fromIso,
    p_to: toIso,
  };

  const { rows, total, loading, page, setPage } = usePagedRpc(
    'admin_list_payments',
    params,
    [schoolId, status, method, fromIso, toIso]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos globales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="awaiting_approval">Por validar</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="rejected">Rechazado</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
              <SelectItem value="pse">PSE</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Sin registros en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Escuela</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Atleta</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Aprobado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.school_name || '—'}</TableCell>
                  <TableCell className="text-xs">{r.parent_name || '—'}</TableCell>
                  <TableCell className="text-xs">{r.child_name || '—'}</TableCell>
                  <TableCell className="text-xs font-medium">{formatCurrency(Number(r.amount || 0))}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.payment_method || '—'}</TableCell>
                  <TableCell className="text-xs">{r.approved_by_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager page={page} total={total} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing tab
// ─────────────────────────────────────────────────────────────────────────────
function BillingTab({ fromIso, toIso, schoolId }: { fromIso: string; toIso: string; schoolId: string | null }) {
  const [status, setStatus] = useState<string>('all');
  const params = {
    p_school_id: schoolId,
    p_status: status === 'all' ? null : status,
    p_from: fromIso,
    p_to: toIso,
  };
  const { rows, total, loading, page, setPage } = usePagedRpc(
    'admin_list_billing_events',
    params,
    [schoolId, status, fromIso, toIso]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Eventos de billing</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-1/2"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="awaiting_approval">Por validar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Sin eventos en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Escuela</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Debido</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Mora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pasarela</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.school_name || '—'}</TableCell>
                  <TableCell className="text-xs">{r.event_type}</TableCell>
                  <TableCell className="text-xs">{r.due_date}</TableCell>
                  <TableCell className="text-xs">{formatCurrency(Number(r.amount_due || 0))}</TableCell>
                  <TableCell className="text-xs">{formatCurrency(Number(r.amount_paid || 0))}</TableCell>
                  <TableCell className="text-xs">{formatCurrency(Number(r.late_fee_amount || 0))}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.gateway || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={page} total={total} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit logs tab
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab({ fromIso, toIso, schoolId }: { fromIso: string; toIso: string; schoolId: string | null }) {
  const [tableName, setTableName] = useState<string>('');
  const [action, setAction] = useState<string>('all');
  const params = {
    p_school_id: schoolId,
    p_table: tableName.trim() || null,
    p_action: action === 'all' ? null : action,
    p_from: fromIso,
    p_to: toIso,
  };
  const { rows, total, loading, page, setPage } = usePagedRpc(
    'admin_list_audit_logs',
    params,
    [schoolId, tableName, action, fromIso, toIso]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Auditoría DB</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Input placeholder="Tabla (ej. payments, enrollments)" value={tableName} onChange={(e) => setTableName(e.target.value)} />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Sin auditoría en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Escuela</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.school_name || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {r.actor_name || '—'}
                    {r.actor_role ? <span className="text-muted-foreground"> ({r.actor_role})</span> : null}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.table_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.action}</Badge></TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[200px]">{r.record_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={page} total={total} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics tab
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const [eventType, setEventType] = useState<string>('');
  const params = {
    p_event_type: eventType.trim() || null,
    p_user_id: null,
    p_from: fromIso,
    p_to: toIso,
  };
  const { rows, total, loading, page, setPage } = usePagedRpc(
    'admin_list_analytics_events',
    params,
    [eventType, fromIso, toIso]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Eventos UI / analytics</CardTitle></CardHeader>
      <CardContent>
        <Input
          placeholder="Tipo de evento (ej. page_view, button_click)"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="mb-4 md:max-w-md"
        />

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Sin eventos en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">
                    {r.user_name || '—'}
                    {r.user_role ? <span className="text-muted-foreground"> ({r.user_role})</span> : null}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.event_type}</TableCell>
                  <TableCell className="text-xs truncate max-w-[280px]">{r.page_url || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={page} total={total} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event telemetry tab
// ─────────────────────────────────────────────────────────────────────────────
function EventTelemetryTab({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const [eventType, setEventType] = useState<string>('all');
  const params = {
    p_event_type: eventType === 'all' ? null : eventType,
    p_event_id: null,
    p_from: fromIso,
    p_to: toIso,
  };
  const { rows, total, loading, page, setPage } = usePagedRpc(
    'admin_list_event_telemetry',
    params,
    [eventType, fromIso, toIso]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Telemetría de eventos deportivos</CardTitle></CardHeader>
      <CardContent>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="md:max-w-md mb-4"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="event_created">event_created</SelectItem>
            <SelectItem value="event_viewed">event_viewed</SelectItem>
            <SelectItem value="link_shared">link_shared</SelectItem>
            <SelectItem value="registration_created">registration_created</SelectItem>
            <SelectItem value="registration_approved">registration_approved</SelectItem>
          </SelectContent>
        </Select>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Sin telemetría en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.event_title || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{r.event_type}</TableCell>
                  <TableCell className="text-xs">{r.user_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={page} total={total} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
