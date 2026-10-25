import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, Check, X, CheckCheck, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * F-E — docs/specs/dreamers-reglas-completas-plan.md (D8).
 *
 * Cargos por horas de más del banco de horas: el cron de las 03:00 deja
 * sugerencias al cerrar cada periodo; el owner las confirma (se crea el cobro
 * a la familia, vence a 5 días) o las descarta. Nada se cobra solo.
 *
 * «Cobrar todos» confirma de una vez las sugeridas elegibles (el BFF omite las de
 * inscripciones inactivas y las del dueño). En «Automatización» el owner fija los
 * topes de la confirmación automática (NULL = apagada) y los escalones de aviso de
 * saldo; nada de eso cambia hasta que se guarde.
 *
 * Solo owner (el BFF responde 403 al resto — acá solo se oculta, no se
 * duplica la regla). Sin banco de horas en la escuela, no se renderiza.
 * Con la función apagada se muestra solo el interruptor; con la función
 * prendida y sin sugerencias, el interruptor en una línea.
 */

interface OverageSettings {
  hours_plan_enabled: boolean;
  hour_bank_overage_charges_enabled: boolean;
  hours_billing_rounding: 'none' | 'hour_up';
  overage_auto_confirm_max_hours?: number | null;
  overage_auto_confirm_max_amount?: number | null;
  balance_notice_steps?: number[];
  balance_notice_email_enabled?: boolean;
}

/** Escalones que la escuela puede activar (% de horas que le quedan al atleta). */
export const ESCALONES_DISPONIBLES = [50, 20, 10, 0] as const;
const ETIQUETA_ESCALON: Record<number, string> = { 50: 'Mitad (50 %)', 20: 'Quedan pocas (20 %)', 10: 'Una clase más (10 %)', 0: 'Se acabaron (0 %)' };

/** Cuerpo del PATCH de automatización: vacío = null (apagado) y escalones ordenados de mayor a menor. */
export function cuerpoDeAutomatizacion(f: { maxHoras: string; maxMonto: string; steps: number[]; correo: boolean }) {
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  return {
    overage_auto_confirm_max_hours: num(f.maxHoras),
    overage_auto_confirm_max_amount: num(f.maxMonto),
    balance_notice_steps: [...f.steps].sort((a, b) => b - a),
    balance_notice_email_enabled: f.correo,
  };
}

interface OverageCharge {
  id: string;
  athlete_name: string;
  plan_name: string | null;
  period_start: string | null;
  included_minutes: number;
  consumed_minutes: number;
  overage_minutes: number;
  billable_hours: number;
  hourly_rate: number;
  amount: number;
  rounding: string;
}

const cop = (n: number) =>
  `$${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

const hours = (minutes: number) =>
  `${(minutes / 60).toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`;

function monthLabel(periodStart: string | null): string {
  if (!periodStart) return '';
  const [y, m] = periodStart.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-CO', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type PendingAction = { kind: 'confirm' | 'dismiss'; charge: OverageCharge } | null;

export function HourBankOverageCharges() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [action, setAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['hour-bank-overage-settings'],
    queryFn: () => bffClient.get<OverageSettings>('/api/v1/access/hour-bank-overage-settings'),
    staleTime: 60_000,
    retry: false,
  });

  const settings = settingsQuery.data;
  const enabled = !!settings?.hour_bank_overage_charges_enabled;

  // Automatización: el formulario arranca con lo guardado y se reinicia si cambia en el servidor.
  const [maxHoras, setMaxHoras] = useState('');
  const [maxMonto, setMaxMonto] = useState('');
  const [steps, setSteps] = useState<number[]>([]);
  const [correo, setCorreo] = useState(true);
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setMaxHoras(settings.overage_auto_confirm_max_hours == null ? '' : String(settings.overage_auto_confirm_max_hours));
    setMaxMonto(settings.overage_auto_confirm_max_amount == null ? '' : String(settings.overage_auto_confirm_max_amount));
    setSteps(settings.balance_notice_steps ?? []);
    setCorreo(settings.balance_notice_email_enabled !== false);
  }, [settings]);

  const chargesQuery = useQuery({
    queryKey: ['hour-bank-overage-charges', 'suggested'],
    queryFn: () => bffClient.get<{ charges: OverageCharge[] }>('/api/v1/access/hour-bank-overage-charges?status=suggested'),
    staleTime: 30_000,
    retry: false,
    enabled: !!settings?.hours_plan_enabled,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['hour-bank-overage-charges'] });
    queryClient.invalidateQueries({ queryKey: ['hour-bank-overage-settings'] });
  };

  const showError = (title: string, err: unknown) =>
    toast({ title, description: err instanceof BFFError ? err.message : 'Error inesperado', variant: 'destructive' });

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      bffClient.patch('/api/v1/access/hour-bank-overage-settings', { enabled: next }),
    onSuccess: (_d, next) => {
      toast({
        title: next ? 'Cargos por horas de más activados' : 'Cargos por horas de más desactivados',
        description: next
          ? 'Al cerrar cada mes verás aquí los cobros sugeridos para confirmar.'
          : 'Seguirás recibiendo el aviso de saldo excedido, sin cobro sugerido.',
      });
      refresh();
    },
    onError: (err) => showError('No se pudo guardar', err),
  });

  const guardarAuto = useMutation({
    mutationFn: () => bffClient.patch('/api/v1/access/hour-bank-overage-settings', cuerpoDeAutomatizacion({ maxHoras, maxMonto, steps, correo })),
    onSuccess: () => {
      toast({ title: 'Automatización guardada', description: 'Los cambios aplican desde la próxima corrida.' });
      refresh();
    },
    onError: (err) => showError('No se pudo guardar la automatización', err),
  });

  const cobrarTodos = useMutation({
    mutationFn: () => bffClient.post<{ confirmed: number; skipped: { id: string; motivo: string }[]; errors: unknown[] }>(
      '/api/v1/access/hour-bank-overage-charges/confirm-all', {}),
    onSuccess: (r) => {
      const omitidos = r.skipped?.length ?? 0;
      toast({
        title: r.confirmed > 0 ? `${r.confirmed} cobro${r.confirmed === 1 ? '' : 's'} creado${r.confirmed === 1 ? '' : 's'}` : 'No se creó ningún cobro',
        description: omitidos > 0
          ? `${omitidos} quedaron por decidir a mano (inscripción inactiva o cuenta del dueño).`
          : 'Cada familia recibirá el aviso de su cobro.',
      });
      setConfirmAll(false);
      refresh();
    },
    onError: (err) => { showError('No se pudo completar', err); setConfirmAll(false); refresh(); },
  });

  const decide = useMutation({
    mutationFn: async (a: NonNullable<PendingAction>) => {
      if (a.kind === 'confirm') {
        return bffClient.post(`/api/v1/access/hour-bank-overage-charges/${a.charge.id}/confirm`, {});
      }
      return bffClient.post(`/api/v1/access/hour-bank-overage-charges/${a.charge.id}/dismiss`, { reason });
    },
    onSuccess: (_d, a) => {
      toast({
        title: a.kind === 'confirm' ? 'Cobro creado' : 'Cargo descartado',
        description: a.kind === 'confirm'
          ? `${a.charge.athlete_name}: ${cop(a.charge.amount)}, vence en 5 días.`
          : `${a.charge.athlete_name}: no se cobrará.`,
      });
      setAction(null);
      setReason('');
      refresh();
    },
    onError: (err) => {
      showError('No se pudo completar', err);
      setAction(null);
      refresh();
    },
  });

  // 403 (no owner), error o escuela sin banco de horas → nada.
  if (settingsQuery.isError || !settings?.hours_plan_enabled) return null;
  if (chargesQuery.isError) return null;

  const charges = chargesQuery.data?.charges ?? [];

  const toggleRow = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">
        Sugerir cobro por horas de más al cerrar cada mes
        {settings.hours_billing_rounding === 'hour_up' && ' (se redondea a la hora siguiente)'}
      </div>
      <Switch
        checked={enabled}
        disabled={toggle.isPending}
        onCheckedChange={(v) => toggle.mutate(v)}
        aria-label="Cargos por horas de más"
      />
    </div>
  );

  return (
    <Card className={charges.length ? 'border-primary/30' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 text-primary" />
          Horas por encima del plan{charges.length ? ` — por confirmar (${charges.length})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {toggleRow}

        {charges.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 py-2 border-t border-border/30">
            <div className="flex-1 min-w-44">
              <div className="text-sm font-medium">{c.athlete_name}</div>
              <div className="text-xs text-muted-foreground">
                {monthLabel(c.period_start)}{c.plan_name ? ` · ${c.plan_name}` : ''} · usó {hours(c.consumed_minutes)} de {hours(c.included_minutes)}
              </div>
              <div className="text-xs">
                {Number(c.billable_hours).toLocaleString('es-CO', { maximumFractionDigits: 2 })} h × {cop(c.hourly_rate)} ={' '}
                <span className="font-semibold">{cop(c.amount)}</span>
              </div>
            </div>
            <Button size="sm" className="h-8" disabled={decide.isPending} onClick={() => setAction({ kind: 'confirm', charge: c })}>
              <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={decide.isPending} onClick={() => setAction({ kind: 'dismiss', charge: c })}>
              <X className="h-3.5 w-3.5 mr-1" /> Descartar
            </Button>
          </div>
        ))}

        {charges.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30">
            <div className="text-xs text-muted-foreground">
              Total por confirmar: <span className="font-semibold text-foreground">{cop(charges.reduce((s, c) => s + Number(c.amount), 0))}</span>
            </div>
            <Button size="sm" className="h-8" disabled={cobrarTodos.isPending} onClick={() => setConfirmAll(true)} data-testid="cobrar-todos">
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Cobrar todos ({charges.length})
            </Button>
          </div>
        )}

        {enabled && (
          <details className="rounded-lg border border-border/40 p-3" data-testid="automatizacion">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Automatización
            </summary>
            <div className="mt-3 space-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium">Confirmar solos los excedentes pequeños</p>
                <p className="text-xs text-muted-foreground">
                  Cada mañana (8:00) se cobran solos los que cumplan <b>todos</b> los topes que llenes. Dejar vacío = apagado.
                  Lo que supere un tope, las inscripciones inactivas y lo del dueño siguen esperando tu decisión.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="auto-max-horas" className="text-xs">Hasta (horas)</Label>
                    <Input id="auto-max-horas" inputMode="decimal" placeholder="Ej. 2" value={maxHoras} onChange={(e) => setMaxHoras(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="auto-max-monto" className="text-xs">Hasta ($)</Label>
                    <Input id="auto-max-monto" inputMode="numeric" placeholder="Ej. 60000" value={maxMonto} onChange={(e) => setMaxMonto(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Avisos de saldo de horas a las familias</p>
                <p className="text-xs text-muted-foreground">
                  Se avisa una sola vez por escalón y por mes, por la app y por correo (de 8 a. m. a 8 p. m.). Sin marcar nada = sin avisos.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ESCALONES_DISPONIBLES.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={steps.includes(e)}
                        onCheckedChange={(v) => setSteps((prev) => (v === true ? [...new Set([...prev, e])] : prev.filter((x) => x !== e)))}
                        aria-label={ETIQUETA_ESCALON[e]}
                      />
                      {ETIQUETA_ESCALON[e]}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">También por correo</span>
                  <Switch checked={correo} onCheckedChange={setCorreo} aria-label="Avisos de saldo por correo" />
                </div>
              </div>

              <Button size="sm" disabled={guardarAuto.isPending} onClick={() => guardarAuto.mutate()} data-testid="guardar-automatizacion">
                Guardar automatización
              </Button>
            </div>
          </details>
        )}
      </CardContent>

      <AlertDialog open={confirmAll} onOpenChange={(o) => { if (!o && !cobrarTodos.isPending) setConfirmAll(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cobrar todos los excedentes</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán {charges.length} cobro{charges.length === 1 ? '' : 's'} por {cop(charges.reduce((s, c) => s + Number(c.amount), 0))}.
              Cada familia recibirá el aviso con su vencimiento a 5 días. Las inscripciones inactivas y lo del dueño se omiten y
              quedan para decidir a mano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cobrarTodos.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={cobrarTodos.isPending} onClick={(e) => { e.preventDefault(); cobrarTodos.mutate(); }}>
              Cobrar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!action} onOpenChange={(o) => { if (!o) { setAction(null); setReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action?.kind === 'confirm' ? 'Confirmar cobro por horas de más' : 'Descartar cargo sugerido'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action?.kind === 'confirm'
                ? `La familia de ${action.charge.athlete_name} recibirá un cobro de ${cop(action.charge.amount)} (${monthLabel(action.charge.period_start)}), con vencimiento en 5 días.`
                : action
                  ? `No se le cobrará a ${action.charge.athlete_name} por las horas de más de ${monthLabel(action.charge.period_start)}.`
                  : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action?.kind === 'dismiss' && (
            <Textarea
              placeholder="Motivo (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decide.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={decide.isPending}
              onClick={(e) => { e.preventDefault(); if (action) decide.mutate(action); }}
            >
              {action?.kind === 'confirm' ? 'Crear cobro' : 'Descartar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
