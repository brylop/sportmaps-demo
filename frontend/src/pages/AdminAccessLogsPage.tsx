import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, DoorOpen, Cpu } from 'lucide-react';

interface AccessEvent {
  id: string;
  school_id: string;
  school_name: string;
  direction: 'entry' | 'exit';
  access_granted: boolean;
  denial_reason?: string;
  check_in_method?: string;
  zk_user_id?: number;
  occurred_at: string;
  user_name: string;
  turnstile_devices?: { device_name?: string; serial_number?: string };
}

interface DeviceLog {
  id: number;
  sn: string | null;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: string;
}

const DENIAL_LABEL: Record<string, string> = {
  no_enrollment: 'Sin inscripción',
  payment_overdue: 'Pago vencido',
  enrollment_expired: 'Inscripción vencida',
  unknown_user: 'Usuario desconocido',
  device_error: 'Error dispositivo',
};

const EVENT_BADGE: Record<string, string> = {
  handshake: 'bg-blue-500/10 text-blue-600 border-blue-200',
  attlog_batch: 'bg-amber-500/10 text-amber-600 border-amber-200',
  getrequest: 'bg-violet-500/10 text-violet-600 border-violet-200',
  devicecmd: 'bg-green-500/10 text-green-600 border-green-200',
  operlog: 'bg-slate-500/10 text-slate-600 border-slate-200',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Bogota',
  });
}

export default function AdminAccessLogsPage() {
  const [tab, setTab] = useState<'events' | 'device'>('events');
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<{ events: AccessEvent[] }>('/api/v1/admin/access-logs/events?limit=200');
      setEvents(data.events || []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<{ logs: DeviceLog[] }>('/api/v1/admin/access-logs/device-log?limit=200');
      setLogs(data.logs || []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'events') loadEvents();
    else loadLogs();
  }, [tab, loadEvents, loadLogs]);

  const refresh = () => (tab === 'events' ? loadEvents() : loadLogs());

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Logs de Acceso</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control de acceso (torniquetes ZKTeco) — vista de plataforma
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'events' | 'device')}>
        <TabsList>
          <TabsTrigger value="events" className="gap-2"><DoorOpen className="h-4 w-4" /> Eventos de acceso</TabsTrigger>
          <TabsTrigger value="device" className="gap-2"><Cpu className="h-4 w-4" /> Debug dispositivo</TabsTrigger>
        </TabsList>

        {/* ── Eventos de acceso ─────────────────────────────────────────── */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eventos de acceso — todas las escuelas ({events.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Escuela</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Dir.</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Dispositivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sin eventos</TableCell></TableRow>
                  ) : events.map((e) => (
                    <TableRow key={e.id} className={!e.access_granted ? 'bg-destructive/5' : ''}>
                      <TableCell className="tabular-nums whitespace-nowrap text-xs">{fmt(e.occurred_at)}</TableCell>
                      <TableCell className="text-xs">{e.school_name}</TableCell>
                      <TableCell className="font-medium">{e.user_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{e.direction === 'entry' ? 'Entrada' : 'Salida'}</Badge>
                      </TableCell>
                      <TableCell>
                        {e.access_granted
                          ? <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Concedido</Badge>
                          : <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">{DENIAL_LABEL[e.denial_reason ?? ''] ?? e.denial_reason ?? 'Denegado'}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.check_in_method ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.turnstile_devices?.device_name ?? e.turnstile_devices?.serial_number ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Debug dispositivo ─────────────────────────────────────────── */}
        <TabsContent value="device">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tráfico del protocolo ADMS ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Sin tráfico registrado</TableCell></TableRow>
                  ) : logs.map((l) => (
                    <TableRow key={l.id} className={l.event_type === 'error' ? 'bg-destructive/5' : ''}>
                      <TableCell className="tabular-nums whitespace-nowrap text-xs">{fmt(l.created_at)}</TableCell>
                      <TableCell className="text-xs font-mono">{l.sn ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${EVENT_BADGE[l.event_type] ?? ''}`}>{l.event_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground break-all">{JSON.stringify(l.detail)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
