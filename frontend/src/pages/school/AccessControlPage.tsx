import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DoorOpen,
  DoorClosed,
  Users,
  TrendingUp,
  TrendingDown,
  ShieldX,
  Fingerprint,
  CreditCard,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AccessStats {
  today: string;
  entries_count: number;
  exits_count: number;
  denied_count: number;
  current_occupancy: number;
}

interface AccessEvent {
  id: string;
  direction: 'entry' | 'exit';
  access_granted: boolean;
  denial_reason?: string;
  check_in_method: 'fingerprint' | 'card' | 'manual' | 'pin';
  zk_user_id?: number;
  occurred_at: string;
  user_name: string;
  turnstile_devices?: { device_name: string; direction: string };
}

interface TurnstileDevice {
  id: string;
  serial_number: string;
  device_name: string;
  ip_address: string | null;
  direction: 'entry' | 'exit' | 'both';
  location: string;
  is_active: boolean;
  last_seen_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_ICON: Record<string, React.ReactNode> = {
  fingerprint: <Fingerprint className="h-3.5 w-3.5" />,
  card:        <CreditCard  className="h-3.5 w-3.5" />,
  manual:      <User        className="h-3.5 w-3.5" />,
  pin:         <User        className="h-3.5 w-3.5" />,
};

const DENIAL_LABEL: Record<string, string> = {
  no_enrollment:      'Sin inscripción',
  payment_overdue:    'Pago vencido',
  enrollment_expired: 'Inscripción vencida',
  unknown_user:       'Usuario desconocido',
  device_error:       'Error en dispositivo',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function deviceOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 min
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AccessControlPage() {
  const { toast } = useToast();

  const [stats,        setStats]        = useState<AccessStats | null>(null);
  const [events,       setEvents]       = useState<AccessEvent[]>([]);
  const [devices,      setDevices]      = useState<TurnstileDevice[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLog,   setLoadingLog]   = useState(true);
  const [openingEntry, setOpeningEntry] = useState(false);
  const [openingExit,  setOpeningExit]  = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await bffClient.get<AccessStats>('/api/v1/access/stats');
      setStats(data);
    } catch {
      // silencioso en refresh automático
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const data = await bffClient.get<{ events: AccessEvent[] }>(
        `/api/v1/access/events?limit=30&date=${today}`
      );
      setEvents(data.events || []);
      setLastRefresh(new Date());
    } catch {
      // silencioso
    } finally {
      setLoadingLog(false);
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const data = await bffClient.get<{ devices: TurnstileDevice[] }>('/api/v1/access/devices');
      setDevices(data.devices || []);
    } catch {
      // silencioso
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    loadStats();
    loadEvents();
    loadDevices();
  }, [loadStats, loadEvents, loadDevices]);

  // Auto-refresh cada 15 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
      loadEvents();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadStats, loadEvents]);

  // ── Apertura manual ─────────────────────────────────────────────────────────

  const handleManualOpen = async (direction: 'entry' | 'exit') => {
    const setter = direction === 'entry' ? setOpeningEntry : setOpeningExit;
    setter(true);
    try {
      await bffClient.post('/api/v1/access/manual-open', { direction });
      toast({
        title:       direction === 'entry' ? 'Entrada abierta' : 'Salida abierta',
        description: 'El torniquete abrirá en los próximos segundos.',
      });
      setTimeout(() => { loadStats(); loadEvents(); }, 2000);
    } catch (err: any) {
      const code = err?.code;
      toast({
        title:   'No se pudo abrir',
        description: code === 'NO_IP_CONFIGURED'
          ? 'El dispositivo no tiene IP pública configurada aún. Usa la llave física.'
          : err.message || 'Error al enviar el comando.',
        variant: 'destructive',
      });
    } finally {
      setter(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Control de Acceso</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Torniquete GYM RM — actualizado a las {formatTime(lastRefresh.toISOString())}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => { loadStats(); loadEvents(); loadDevices(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Estado de dispositivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {devices.length === 0 ? (
          <Skeleton className="h-16 col-span-2" />
        ) : (
          devices.map(device => {
            const online = deviceOnline(device.last_seen_at);
            return (
              <div
                key={device.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                {online
                  ? <Wifi className="h-4 w-4 text-green-500 shrink-0" />
                  : <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{device.device_name}</p>
                  <p className="text-xs text-muted-foreground">{device.location}</p>
                </div>
                <Badge
                  variant={online ? 'default' : 'outline'}
                  className={`text-[10px] shrink-0 ${online ? 'bg-green-500/10 text-green-600 border-green-200' : ''}`}
                >
                  {online ? 'En línea' : 'Sin señal'}
                </Badge>
              </div>
            );
          })
        )}
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loadingStats ? (
          [1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  Entradas hoy
                </div>
                <p className="text-3xl font-bold text-green-600">{stats?.entries_count ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-blue-500" />
                  Salidas hoy
                </div>
                <p className="text-3xl font-bold text-blue-600">{stats?.exits_count ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Aforo actual
                </div>
                <p className="text-3xl font-bold">{stats?.current_occupancy ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <ShieldX className="h-3.5 w-3.5 text-destructive" />
                  Denegados
                </div>
                <p className="text-3xl font-bold text-destructive">{stats?.denied_count ?? 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Control manual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Apertura manual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Abre el torniquete directamente desde aquí sin necesidad de huella o tarjeta.
            Requiere IP pública configurada en el dispositivo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 gap-2 h-12"
              onClick={() => handleManualOpen('entry')}
              disabled={openingEntry}
            >
              {openingEntry
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <DoorOpen className="h-4 w-4" />
              }
              Abrir Entrada
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 h-12"
              onClick={() => handleManualOpen('exit')}
              disabled={openingExit}
            >
              {openingExit
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <DoorClosed className="h-4 w-4" />
              }
              Abrir Salida
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log de accesos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registro de accesos — hoy</CardTitle>
            <Badge variant="outline" className="text-xs">
              {events.length} eventos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLog ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin accesos registrados hoy</p>
              <p className="text-xs mt-1">Los eventos aparecerán aquí en tiempo real</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    !event.access_granted ? 'bg-destructive/5' : ''
                  }`}
                >
                  {/* Ícono dirección */}
                  <div className={`shrink-0 rounded-full p-1.5 ${
                    !event.access_granted
                      ? 'bg-destructive/10 text-destructive'
                      : event.direction === 'entry'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {!event.access_granted
                      ? <ShieldX className="h-3.5 w-3.5" />
                      : event.direction === 'entry'
                        ? <TrendingUp className="h-3.5 w-3.5" />
                        : <TrendingDown className="h-3.5 w-3.5" />
                    }
                  </div>

                  {/* Nombre */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.user_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!event.access_granted && event.denial_reason && (
                        <span className="text-xs text-destructive">
                          {DENIAL_LABEL[event.denial_reason] ?? event.denial_reason}
                        </span>
                      )}
                      {event.access_granted && (
                        <span className="text-xs text-muted-foreground">
                          {event.direction === 'entry' ? 'Entrada' : 'Salida'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Método + hora */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">
                      {METHOD_ICON[event.check_in_method] ?? METHOD_ICON.fingerprint}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(event.occurred_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
