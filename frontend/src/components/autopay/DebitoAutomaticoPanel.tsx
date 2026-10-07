/**
 * Finanzas → Pagos → pestaña «Débito automático» (F3, escuela).
 * Spec: docs/specs/debito-automatico.md §11.2 y §12.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, CheckCircle2, Copy, Loader2, PauseCircle, Repeat, Save, ShieldAlert, Users, Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  cancelarDebitoEscuela, getPanelDebito, guardarAjustesDebito, resolverIncidente,
  type AjustesDebito, type IncidentePanel, type PanelDebito,
} from '@/lib/api/autopay';
import { TEXTO_INVITACION, estadoFila, fechaCorta, nombreMes, type TonoEstado } from './debito-utils';

const TONO: Record<TonoEstado, string> = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  info: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  warn: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  bad: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  muted: 'bg-muted text-muted-foreground border-border',
};

const MOTIVO_SUSPENSION: Record<string, string> = {
  over_max_amount: 'supera el tope',
  token_not_available: 'medio no disponible',
  provider_declined: 'la pasarela rechazó',
  duplicate_charge: 'cobro doble',
};

const SEGMENTOS = [
  { key: 'paid', label: 'Pagados', color: 'bg-emerald-500' },
  { key: 'noticed', label: 'Avisados', color: 'bg-sky-500' },
  { key: 'inProgress', label: 'Debitando', color: 'bg-amber-500' },
  { key: 'paidElsewhere', label: 'Pagaron por otro medio', color: 'bg-violet-500' },
  { key: 'noDebit', label: 'Sin débito', color: 'bg-zinc-400' },
  { key: 'scheduled', label: 'Programados', color: 'bg-slate-300 dark:bg-slate-600' },
] as const;

const INCIDENTE_TEXTO: Record<Exclude<IncidentePanel['kind'], 'duplicate_charge'>, string> = {
  cron_missed: 'Los débitos de hoy no corrieron a tiempo. Ya lo estamos revisando.',
  stale_lease: 'Un débito quedó a medio procesar. Ya lo estamos revisando.',
  stale_pending: 'Un débito lleva más de un día esperando respuesta de la pasarela.',
  merchant_mismatch: 'La cuenta Wompi de la escuela cambió; los débitos de la cuenta anterior quedaron frenados.',
};

type EstadoResolucion = 'refund_requested' | 'refunded' | 'credited' | 'dismissed';

export function DebitoAutomaticoPanel({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const [panel, setPanel] = useState<PanelDebito | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesDebito | null>(null);
  const [onlineFeePct, setOnlineFeePct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmarPausa, setConfirmarPausa] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPanelDebito(schoolId);
      setPanel(p);
      setAjustes(p.settings);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void cargar(); }, [cargar]);

  // % del recargo del pago en línea, solo para la etiqueta del select.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.from('school_settings').select('online_fee_pct').eq('school_id', schoolId).maybeSingle();
        const pct = (data as { online_fee_pct?: number | null } | null)?.online_fee_pct;
        if (vivo && typeof pct === 'number') setOnlineFeePct(pct);
      } catch { /* solo afecta la etiqueta */ }
    })();
    return () => { vivo = false; };
  }, [schoolId]);

  const guardar = async (body: AjustesDebito, mensaje?: string) => {
    setSaving(true);
    try {
      const r = await guardarAjustesDebito(schoolId, body);
      toast({
        title: mensaje ?? 'Ajustes guardados',
        description: r?.notified ? `Avisamos a ${r.notified} ${r.notified === 1 ? 'familia' : 'familias'}.` : undefined,
      });
      setConfirmarPausa(false);
      await cargar();
    } catch {
      toast({ title: 'No pudimos guardar los ajustes', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const invitar = async () => {
    try {
      await navigator.clipboard.writeText(TEXTO_INVITACION);
      toast({ title: 'Invitación copiada', description: 'Pégala en WhatsApp o en un correo a las familias.' });
    } catch {
      toast({ title: 'No pudimos copiar el texto', description: TEXTO_INVITACION });
    }
  };

  const resolver = async (inc: IncidentePanel, state: EstadoResolucion) => {
    setBusyRow(inc.id);
    try {
      await resolverIncidente(schoolId, inc.id, { state });
      toast({ title: 'Listo', description: 'Guardamos cómo se resolvió.' });
      await cargar();
    } catch {
      toast({ title: 'No pudimos guardarlo', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setBusyRow(null);
    }
  };

  const cancelarFila = async (subscriptionId: string) => {
    setBusyRow(subscriptionId);
    try {
      await cancelarDebitoEscuela(schoolId, subscriptionId);
      toast({ title: 'Débito cancelado', description: 'Avisamos a la familia para que pague desde Mis Pagos.' });
      setCancelando(null);
      await cargar();
    } catch {
      toast({ title: 'No pudimos cancelar el débito', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setBusyRow(null);
    }
  };

  if (loading && !panel) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!panel || !ajustes) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <Repeat className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
          <p className="font-semibold">El débito automático no está disponible por ahora</p>
          <p className="text-sm text-muted-foreground">
            {loadError ? 'No pudimos cargar la información. Intenta de nuevo en un momento.' : 'Todavía no hay información para mostrar.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  const { kpis, rows, gatewayReady } = panel;
  const dirty = JSON.stringify(ajustes) !== JSON.stringify(panel.settings);
  const totalCiclos = SEGMENTOS.reduce((n, s) => n + (kpis.cycles[s.key] || 0), 0);
  const incidentes = panel.incidents
    .filter((i) => i.state === 'open' || i.state === 'refund_requested')
    .sort((a, b) => Number(b.kind === 'duplicate_charge') - Number(a.kind === 'duplicate_charge'));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Repeat className="h-5 w-5 text-primary" /> Débito automático</h2>
          <p className="text-sm text-muted-foreground">Las familias autorizan una vez y la mensualidad se debita cada mes, con aviso 2 días antes.</p>
        </div>
        <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => void invitar()} disabled={!gatewayReady || !ajustes.offered}>
          <Copy className="h-4 w-4" /> Invitar a las familias
        </Button>
      </div>

      {!gatewayReady && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Para ofrecer débito automático necesitas tu cuenta Wompi conectada en SportMaps Pay.
        </div>
      )}

      {/* ── Incidentes: el cobro doble va primero ─────────────────────── */}
      {incidentes.map((inc) => inc.kind === 'duplicate_charge' ? (
        <div key={inc.id} className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              La mensualidad de <span className="font-semibold">{inc.athleteName ?? 'un deportista'}</span> entró dos veces.
              {inc.amount !== null && <> Sobran <span className="font-semibold">{formatCurrency(inc.amount)}</span>.</>}
              {inc.state === 'refund_requested' && ' Ya pediste la devolución.'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {inc.state === 'open' && (
              <Button size="sm" variant="outline" disabled={busyRow === inc.id} onClick={() => void resolver(inc, 'refund_requested')}>Pedí la devolución</Button>
            )}
            <Button size="sm" variant="outline" disabled={busyRow === inc.id} onClick={() => void resolver(inc, 'refunded')}>Devolución hecha</Button>
            <Button size="sm" variant="outline" disabled={busyRow === inc.id} onClick={() => void resolver(inc, 'credited')}>Dejar como saldo a favor</Button>
            <Button size="sm" variant="ghost" disabled={busyRow === inc.id} onClick={() => void resolver(inc, 'dismissed')}>Descartar</Button>
          </div>
        </div>
      ) : (
        <div key={inc.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{INCIDENTE_TEXTO[inc.kind]}{inc.athleteName ? ` (${inc.athleteName})` : ''}</span>
        </div>
      ))}

      {/* ── «Ya pagué» reportados ─────────────────────────────────────── */}
      {panel.parentSkips.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Familias que dicen que ya pagaron</CardTitle>
            <CardDescription>No se les debitó ese mes. Revisa y registra el pago.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {panel.parentSkips.map((s) => (
              <p key={s.cycleId} className="text-sm rounded-md border px-3 py-2">
                <span className="font-medium">{s.athleteName}</span> dice que ya pagó {nombreMes(s.periodMonth)}. Revisa y registra el pago.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Familias activas', value: String(kpis.active), icon: Users },
          { label: 'Suspendidas', value: String(kpis.suspended), icon: PauseCircle },
          { label: 'Mensualidades por débito', value: `${Math.round(kpis.pctByDebit || 0)} %`, icon: Repeat },
          { label: 'Debitado este mes', value: formatCurrency(kpis.debitedThisMonth || 0), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</p>
              <p className="text-lg sm:text-2xl font-bold truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Ciclos del mes ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Este mes</CardTitle>
          <CardDescription>Cómo van las mensualidades con débito automático.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalCiclos > 0 ? (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Ciclos del mes por estado">
                {SEGMENTOS.map((s) => {
                  const n = kpis.cycles[s.key] || 0;
                  return n > 0 ? <div key={s.key} className={s.color} style={{ width: `${(n / totalCiclos) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {SEGMENTOS.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', s.color)} />
                    {s.label} <span className="font-semibold">{kpis.cycles[s.key] || 0}</span>
                  </span>
                ))}
              </div>
            </>
          ) : rows.length > 0 && (
            <p className="text-sm text-muted-foreground">Este mes todavía no hay débitos programados.</p>
          )}

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
              <p className="font-medium">Todavía ninguna familia tiene débito automático</p>
              <p className="text-sm text-muted-foreground">
                {!gatewayReady
                  ? 'Cuando conectes tu cuenta Wompi podrás ofrecerlo a las familias.'
                  : ajustes.offered
                    ? 'Comparte la invitación para que lo activen desde Mis Pagos.'
                    : 'Actívalo en los ajustes de abajo y comparte la invitación con las familias.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deportista</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Medio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Próximo intento</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const est = estadoFila(r.status, r.cycle);
                    return (
                      <TableRow key={r.subscriptionId}>
                        <TableCell className="font-medium whitespace-nowrap">{r.athleteName}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.payerName}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{r.method}</TableCell>
                        <TableCell>
                          <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONO[est.tone])}>
                            {est.label}{r.status === 'suspended' && r.suspendReason ? ` · ${MOTIVO_SUSPENSION[r.suspendReason] ?? ''}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {r.cycle?.announcedTotal != null ? formatCurrency(r.cycle.announcedTotal) : '—'}
                          <p className="text-[11px] text-muted-foreground">Tope {formatCurrency(r.maxAmount)}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r.cycle?.nextAttemptOn ? fechaCorta(r.cycle.nextAttemptOn) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {r.status === 'cancelled' ? null : cancelando === r.subscriptionId ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-xs mr-1">¿Cancelar?</span>
                              <Button size="sm" variant="destructive" className="h-7" disabled={busyRow === r.subscriptionId} onClick={() => void cancelarFila(r.subscriptionId)}>
                                {busyRow === r.subscriptionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sí'}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => setCancelando(null)}>No</Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setCancelando(r.subscriptionId)}>
                              Cancelar débito
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ajustes ────────────────────────────────────────────────────── */}
      <Card className={cn(!gatewayReady && 'opacity-60')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ajustes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="ad-offered" className="font-medium">Ofrecer débito automático a las familias</Label>
              <p className="text-xs text-muted-foreground">Si lo apagas, nadie nuevo puede activarlo. Los que ya lo tienen siguen.</p>
            </div>
            <Switch
              id="ad-offered"
              checked={ajustes.offered}
              disabled={!gatewayReady || saving}
              onCheckedChange={(v) => setAjustes({ ...ajustes, offered: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="ad-paused" className="font-medium">Pausar los débitos</Label>
                <p className="text-xs text-muted-foreground">Mientras esté pausado no debitamos a nadie; las familias pagan desde Mis Pagos.</p>
              </div>
              <Switch
                id="ad-paused"
                checked={ajustes.paused || confirmarPausa}
                disabled={!gatewayReady || saving}
                onCheckedChange={(v) => {
                  if (v && !panel.settings.paused) setConfirmarPausa(true);
                  else { setConfirmarPausa(false); setAjustes({ ...ajustes, paused: v }); }
                }}
              />
            </div>
            {confirmarPausa && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Vamos a avisar a las {kpis.active} {kpis.active === 1 ? 'familia' : 'familias'} con débito activo que paguen desde Mis Pagos.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={saving} onClick={() => void guardar({ ...ajustes, paused: true }, 'Débitos pausados')}>
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Pausar y avisar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setConfirmarPausa(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Recargo en el débito</Label>
              <Select
                value={ajustes.surchargeMode}
                disabled={!gatewayReady || saving}
                onValueChange={(v) => setAjustes({ ...ajustes, surchargeMode: v as AjustesDebito['surchargeMode'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_as_online">
                    Igual al pago en línea{onlineFeePct !== null ? ` (${onlineFeePct} %)` : ''}
                  </SelectItem>
                  <SelectItem value="none">Sin recargo</SelectItem>
                </SelectContent>
              </Select>
              {ajustes.surchargeMode === 'none' && (
                <p className="text-xs text-muted-foreground">Sin recargo, la comisión de la pasarela la asume la escuela.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Días antes del vencimiento</Label>
              <Select
                value={String(ajustes.daysBeforeDue)}
                disabled={!gatewayReady || saving}
                onValueChange={(v) => setAjustes({ ...ajustes, daysBeforeDue: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d === 0 ? 'El mismo día del vencimiento' : `${d} ${d === 1 ? 'día' : 'días'} antes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">La familia recibe el aviso 2 días antes del débito.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="gap-2 w-full sm:w-auto" disabled={!gatewayReady || !dirty || saving} onClick={() => void guardar(ajustes)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar ajustes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
