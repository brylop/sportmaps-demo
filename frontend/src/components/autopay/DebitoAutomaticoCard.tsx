/**
 * Mis Pagos → «Débito automático» (F3). Reemplaza la tarjeta falsa de
 * «Suscripciones Activas». Spec: docs/specs/debito-automatico.md §11.1.
 *
 * Deep links: ?autopay=activar abre el alta; ?autopay_skip=<cycleId> abre
 * «Ya pagué este mes» para ese ciclo. Los avisos enlazan a /my-payments#debito.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, CalendarClock, Loader2, Repeat, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import {
  actualizarDebito, cancelarDebito, yaPague,
  type DeportistaDebito, type MiDebito, type SuscripcionFamilia,
} from '@/lib/api/autopay';
import { ActivarDebitoDialog } from './ActivarDebitoDialog';
import {
  elegiblesPorEscuela, fechaCorta, mostrarSeccionDebito, nombreMes, parseMonto, textoSuspension,
  tieneDebito, validarTope,
} from './debito-utils';

interface CardProps {
  data: MiDebito | null;
  reload: () => void | Promise<void>;
  /** Escuela cuyo alta está abierta (lo controla la página para que el banner también la abra). */
  activarSchoolId: string | null;
  onActivarSchoolIdChange: (schoolId: string | null) => void;
}

type Fila = DeportistaDebito & { subscription: SuscripcionFamilia };

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        tone === 'ok' && 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
        tone === 'warn' && 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        tone === 'muted' && 'bg-muted text-muted-foreground border-border',
      )}
    >
      {children}
    </span>
  );
}

export function DebitoAutomaticoCard({ data, reload, activarSchoolId, onActivarSchoolIdChange }: CardProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [cancelando, setCancelando] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topeEdit, setTopeEdit] = useState<{ fila: Fila; value: string } | null>(null);
  const [cambioMedio, setCambioMedio] = useState<Fila | null>(null);
  const [skip, setSkip] = useState<{ cycleId: string; mes: string; name: string } | null>(null);

  const visible = mostrarSeccionDebito(data);
  const grupos = useMemo(() => (data ? elegiblesPorEscuela(data) : []), [data]);
  const escuelas = useMemo(() => new Map((data?.schools ?? []).map((s) => [s.schoolId, s])), [data]);
  const filas = useMemo(
    () => (data?.athletes ?? []).filter((a) => tieneDebito(a) || !!escuelas.get(a.schoolId)?.offered),
    [data, escuelas],
  );

  // ── Deep links ────────────────────────────────────────────────────────────
  const linksHechos = useRef(false);
  useEffect(() => {
    if (!data || linksHechos.current) return;
    const activar = searchParams.get('autopay');
    const skipId = searchParams.get('autopay_skip');
    if (!activar && !skipId) return;
    linksHechos.current = true;
    setSearchParams((prev) => { prev.delete('autopay'); prev.delete('autopay_skip'); return prev; }, { replace: true });

    if (activar === 'activar' && grupos.length > 0) {
      onActivarSchoolIdChange(grupos[0].schoolId);
    }
    if (skipId) {
      const a = data.athletes.find((x) => x.subscription?.nextDebit?.cycleId === skipId);
      const nd = a?.subscription?.nextDebit;
      if (a && nd?.skippable) {
        setSkip({ cycleId: nd.cycleId, mes: nombreMes(nd.periodMonth), name: a.name });
      } else {
        toast({ title: 'Ese débito ya no se puede saltar', description: 'Revisa el estado de tus pagos abajo.' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al llegar los datos
  }, [data]);

  // Los avisos enlazan a #debito; la sección llega después de la carga, así que el
  // scroll nativo del hash no alcanza.
  const scrollHecho = useRef(false);
  useEffect(() => {
    if (!visible || scrollHecho.current || window.location.hash !== '#debito') return;
    scrollHecho.current = true;
    requestAnimationFrame(() => document.getElementById('debito')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [visible]);

  // El grupo se congela al abrir el alta: al terminar, reload() deja a esos
  // deportistas con débito y `grupos` ya no los trae. Si se derivara en cada
  // render, el diálogo se desmontaba antes de mostrar «Débito automático activo»
  // (lo encontró el recorrido en la app real contra el gemelo).
  const [grupoCongelado, setGrupoCongelado] = useState<(typeof grupos)[number] | null>(null);
  useEffect(() => {
    if (!activarSchoolId) { setGrupoCongelado(null); return; }
    setGrupoCongelado((prev) => (prev?.schoolId === activarSchoolId ? prev : grupos.find((g) => g.schoolId === activarSchoolId) ?? null));
  }, [activarSchoolId, grupos]);
  const grupoActivo = grupoCongelado;

  if (!data || !visible) return null;


  const confirmarCancelar = async (fila: Fila) => {
    setBusy(true);
    try {
      await cancelarDebito(fila.subscription.id);
      toast({ title: 'Débito cancelado', description: `Los próximos cobros de ${fila.name} los pagas desde Mis Pagos.` });
      setCancelando(null);
      await reload();
    } catch {
      toast({ title: 'No pudimos cancelar el débito', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const guardarTope = async () => {
    if (!topeEdit) return;
    const valor = parseMonto(topeEdit.value);
    if (validarTope(valor, topeEdit.fila.currentTotal) || valor === null) return;
    setBusy(true);
    try {
      const r = await actualizarDebito(topeEdit.fila.subscription.id, { maxAmount: valor });
      toast({
        title: r?.reactivated ? 'Tope actualizado y débito reactivado' : 'Tope actualizado',
        description: `No debitaremos más de ${formatCurrency(valor)} al mes por ${topeEdit.fila.name}.`,
      });
      setTopeEdit(null);
      await reload();
    } catch {
      toast({ title: 'No pudimos cambiar el tope', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirmarSkip = async () => {
    if (!skip) return;
    setBusy(true);
    try {
      await yaPague(skip.cycleId);
      toast({ title: `Listo, no debitaremos ${skip.mes}`, description: 'La escuela revisará tu pago.' });
      setSkip(null);
      await reload();
    } catch {
      toast({ title: 'No pudimos registrarlo', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const topeError = topeEdit ? validarTope(parseMonto(topeEdit.value), topeEdit.fila.currentTotal) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Repeat className="h-5 w-5 text-primary" />
          Débito automático
        </CardTitle>
        <CardDescription>
          Pagamos la mensualidad por ti cada mes. Te avisamos 2 días antes y lo cancelas cuando quieras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {filas.map((a) => {
          const sub = tieneDebito(a) ? a.subscription : null;
          const fila = sub ? (a as Fila) : null;
          const nd = sub?.nextDebit ?? null;
          return (
            <div key={a.key} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold truncate">{a.name}</p>
                {!sub && <Pill tone="muted">Sin débito</Pill>}
                {sub?.status === 'active' && <Pill tone="ok">Activo</Pill>}
                {sub?.status === 'suspended' && <Pill tone="warn">Suspendido</Pill>}
              </div>

              {sub && (
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    {sub.method.label} · Tope {formatCurrency(sub.maxAmount)}
                  </p>
                  {sub.status === 'suspended' ? (
                    <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      {textoSuspension(sub.suspendReason)}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                      {nd?.date
                        ? <span>Próximo débito: <span className="font-medium">{fechaCorta(nd.date)}{nd.total !== null ? ` · ${formatCurrency(nd.total)}` : ''}</span></span>
                        : <span className="text-muted-foreground">Te avisaremos 2 días antes</span>}
                    </p>
                  )}
                </div>
              )}

              {fila && cancelando === sub!.id ? (
                <div className="rounded-md bg-muted/60 p-3 space-y-2">
                  <p className="text-sm">
                    ¿Cancelar el débito de {a.name}? Los próximos cobros los pagas desde Mis Pagos.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void confirmarCancelar(fila)}>
                      {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Sí, cancelar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancelando(null)}>No</Button>
                  </div>
                </div>
              ) : fila && (
                <div className="flex flex-wrap gap-2">
                  {nd?.skippable && sub!.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => setSkip({ cycleId: nd.cycleId, mes: nombreMes(nd.periodMonth), name: a.name })}
                    >
                      Ya pagué este mes
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={sub!.suspendReason === 'over_max_amount' ? 'default' : 'outline'}
                    onClick={() => setTopeEdit({ fila, value: String(sub!.maxAmount) })}
                  >
                    Cambiar tope
                  </Button>
                  <Button
                    size="sm"
                    variant={sub!.suspendReason === 'token_not_available' || sub!.suspendReason === 'provider_declined' ? 'default' : 'outline'}
                    onClick={() => setCambioMedio(fila)}
                  >
                    Cambiar medio
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setCancelando(sub!.id)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {grupos.map((g) => (
          <Button key={g.schoolId} className="w-full" onClick={() => onActivarSchoolIdChange(g.schoolId)}>
            <Repeat className="h-4 w-4 mr-2" />
            Activar débito automático{grupos.length > 1 ? ` · ${g.schoolName}` : ''}
          </Button>
        ))}
      </CardContent>

      {/* Alta */}
      {grupoActivo && (
        <ActivarDebitoDialog
          open={!!grupoActivo}
          onOpenChange={(o) => { if (!o) onActivarSchoolIdChange(null); }}
          mode="activate"
          schoolId={grupoActivo.schoolId}
          schoolName={grupoActivo.schoolName}
          surchargePct={escuelas.get(grupoActivo.schoolId)?.surchargePct ?? 0}
          athletes={grupoActivo.athletes}
          methods={data.methods}
          onDone={() => void reload()}
        />
      )}

      {/* Cambiar medio */}
      {cambioMedio && (
        <ActivarDebitoDialog
          open={!!cambioMedio}
          onOpenChange={(o) => { if (!o) setCambioMedio(null); }}
          mode="change_method"
          schoolId={cambioMedio.schoolId}
          schoolName={escuelas.get(cambioMedio.schoolId)?.schoolName ?? 'la escuela'}
          athletes={[]}
          methods={data.methods}
          subscriptionId={cambioMedio.subscription.id}
          currentTokenId={cambioMedio.subscription.method.tokenId}
          onDone={() => void reload()}
        />
      )}

      {/* Cambiar tope */}
      <Dialog open={!!topeEdit} onOpenChange={(o) => { if (!o && !busy) setTopeEdit(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar tope</DialogTitle>
            <DialogDescription>
              Lo máximo que debitaremos al mes por {topeEdit?.fila.name}. Si la mensualidad lo supera, no la debitamos y te avisamos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tope-edit">Tope por mes</Label>
            <Input
              id="tope-edit"
              inputMode="numeric"
              autoFocus
              value={topeEdit?.value ?? ''}
              onChange={(e) => setTopeEdit((t) => (t ? { ...t, value: e.target.value.replace(/\D/g, '') } : t))}
            />
            {topeEdit?.fila.currentTotal != null && (
              <p className="text-xs text-muted-foreground">Mensualidad actual: {formatCurrency(topeEdit.fila.currentTotal)}</p>
            )}
            {topeError && <p className="text-xs text-destructive">{topeError}</p>}
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!!topeError || busy} onClick={() => void guardarTope()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar tope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ya pagué este mes */}
      <Dialog open={!!skip} onOpenChange={(o) => { if (!o && !busy) setSkip(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Ya pagaste {skip?.mes}?</DialogTitle>
            <DialogDescription>
              No debitaremos {skip?.mes}{skip?.name ? ` de ${skip.name}` : ''}. La escuela revisará tu pago.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" disabled={busy} onClick={() => setSkip(null)}>Volver</Button>
            <Button disabled={busy} onClick={() => void confirmarSkip()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sí, ya pagué
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Banner «después de pagar» ───────────────────────────────────────────────

const bannerKey = (userId: string) => `sm_autopay_banner_dismissed:${userId}`;

function leerDescartado(userId: string): boolean {
  try { return window.localStorage.getItem(bannerKey(userId)) === '1'; } catch { return false; }
}

/**
 * Invita a activar el débito desde donde la familia ya paga. Se muestra si hay un
 * deportista que puede activarlo y la familia no lo descartó (localStorage por usuario).
 */
export function DebitoSugerenciaBanner({ data, userId, onActivar }: {
  data: MiDebito | null;
  userId: string | undefined;
  onActivar: (schoolId: string) => void;
}) {
  const [descartado, setDescartado] = useState(() => (userId ? leerDescartado(userId) : true));
  useEffect(() => { if (userId) setDescartado(leerDescartado(userId)); }, [userId]);

  const grupos = data ? elegiblesPorEscuela(data) : [];
  if (!userId || descartado || grupos.length === 0) return null;

  const descartar = () => {
    setDescartado(true);
    try { window.localStorage.setItem(bannerKey(userId), '1'); } catch { /* sin storage: solo esta vez */ }
  };

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 pr-10">
      <Sparkles className="h-5 w-5 text-primary shrink-0 hidden sm:block" />
      <p className="text-sm flex-1">
        ¿No quieres volver a hacer esto cada mes? Activa el débito automático: te avisamos 2 días antes de cada cobro.
      </p>
      <Button size="sm" className="shrink-0" onClick={() => onActivar(grupos[0].schoolId)}>
        Activar débito automático
      </Button>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={descartar}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
