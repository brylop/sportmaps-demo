/**
 * Alta del débito automático (y «Cambiar medio»). Dos pasos, sin pantallas de
 * paso: 1) de dónde debitamos, 2) confirmar. Spec: docs/specs/debito-automatico.md §11.1.
 *
 * - Tarjeta: se tokeniza en el navegador contra Wompi (tokenizarTarjeta); el
 *   número nunca pasa por SportMaps.
 * - Nequi: el pagador acepta UNA vez en su app; aquí se espera con polling.
 * - Medio guardado: no se registra de nuevo; el alta va con consentId 'reuse'
 *   y el BFF reutiliza el último consentimiento de ese token.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle, ArrowLeft, Bell, CheckCircle2, CreditCard, Loader2, Lock, Smartphone, Wallet, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import {
  activarDebito, actualizarDebito, getEstadoMedio, getSetup, iniciarNequi, registrarTarjeta, tokenizarTarjeta,
  type AltaResultado, type DeportistaDebito, type MedioGuardado, type SetupDebito,
} from '@/lib/api/autopay';
import {
  diaMes, formatearNumeroTarjeta, nombreMes, parseMonto, parseVencimiento, plural, tarjetaValida,
  telefonoNequiValido, textoErrorAlta, topePorDefecto, unirNombres, validarTope,
} from './debito-utils';

type Medio =
  | { kind: 'saved'; tokenId: string; label: string }
  | { kind: 'nequi' }
  | { kind: 'card' };

type Paso = 'medio' | 'confirmar' | 'espera' | 'listo';

interface Pendiente { tokenId: string; consentId: string; label: string; startedAt: number; kind: 'nequi' | 'card' }

export interface ActivarDebitoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'activate' | 'change_method';
  schoolId: string;
  schoolName: string;
  /** Recargo que se suma al débito (solo informativo). */
  surchargePct?: number;
  /** Atletas que pueden activar (modo activate). */
  athletes: DeportistaDebito[];
  /** Medios guardados de la familia (se filtran por escuela aquí). */
  methods: MedioGuardado[];
  /** Modo change_method: la suscripción a la que se le cambia el medio. */
  subscriptionId?: string;
  currentTokenId?: string;
  /** Se llama cuando algo cambió (para recargar la tarjeta). */
  onDone: () => void;
}

const SETUP_TTL_MS = 50 * 60 * 1000;
const NEQUI_TIMEOUT_MS = 10 * 60 * 1000;
const NEQUI_RECHAZO = 'Nequi no aprobó la autorización. Intenta de nuevo o usa otro medio.';
const ERROR_GENERICO = 'No pudimos completar el proceso. Intenta de nuevo en un momento.';

export function ActivarDebitoDialog(props: ActivarDebitoDialogProps) {
  const {
    open, onOpenChange, mode, schoolId, schoolName, surchargePct = 0,
    athletes, methods, subscriptionId, currentTokenId, onDone,
  } = props;
  const { toast } = useToast();

  const [paso, setPaso] = useState<Paso>('medio');
  const [medio, setMedio] = useState<Medio | null>(null);
  const [phone, setPhone] = useState('');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', holder: '' });
  const [setup, setSetup] = useState<SetupDebito | null>(null);
  const [setupError, setSetupError] = useState(false);
  const setupAt = useRef(0);
  const setupUsado = useRef(false);

  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [topes, setTopes] = useState<Record<string, string>>({});
  const [editandoTope, setEditandoTope] = useState<Record<string, boolean>>({});
  const [incluirMes, setIncluirMes] = useState(true);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [resultados, setResultados] = useState<{ ok: string[]; fallos: { name: string; texto: string }[]; medio: string } | null>(null);

  const guardados = useMemo(
    () => methods.filter((m) => m.schoolId === schoolId && m.tokenId !== currentTokenId),
    [methods, schoolId, currentTokenId],
  );

  const cargarSetup = useCallback(async (): Promise<SetupDebito | null> => {
    try {
      const s = await getSetup(schoolId);
      setSetup(s);
      setupAt.current = Date.now();
      setupUsado.current = false;
      setSetupError(false);
      return s;
    } catch {
      setSetupError(true);
      return null;
    }
  }, [schoolId]);

  // Al abrir: todo limpio y setup fresco (los tokens de aceptación son de un solo uso y duran 1 h).
  useEffect(() => {
    if (!open) return;
    setPaso('medio');
    setMedio(null);
    setPhone('');
    setCard({ number: '', exp: '', cvc: '', holder: '' });
    setSeleccion(Object.fromEntries(athletes.map((a) => [a.key, true])));
    setTopes(Object.fromEntries(athletes.map((a) => [a.key, String(topePorDefecto(a) ?? '')])));
    setEditandoTope(Object.fromEntries(athletes.map((a) => [a.key, topePorDefecto(a) === null])));
    setIncluirMes(true);
    setAceptaTerminos(false);
    setAceptaDatos(false);
    setError(null);
    setPendiente(null);
    setResultados(null);
    void cargarSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);

  const setupVigente = async (): Promise<SetupDebito | null> => {
    if (setup && !setupUsado.current && Date.now() - setupAt.current < SETUP_TTL_MS) return setup;
    return cargarSetup();
  };

  const seleccionados = athletes.filter((a) => seleccion[a.key]);
  const conMesEnCurso = seleccionados.find((a) => a.currentPeriod);
  const vencidas = seleccionados.reduce((n, a) => n + (a.overdueCount || 0), 0);
  const erroresTope = Object.fromEntries(
    athletes.map((a) => [a.key, validarTope(parseMonto(topes[a.key] ?? ''), a.currentTotal)]),
  );
  const medioNuevo = medio?.kind === 'nequi' || medio?.kind === 'card';
  const pideConsentimiento = mode === 'activate' || medioNuevo;
  const consentimientoOk = !pideConsentimiento || (aceptaTerminos && aceptaDatos);

  const errorMedio = (): string | null => {
    if (!medio) return 'Elige de dónde debitamos.';
    if (medio.kind === 'nequi' && !telefonoNequiValido(phone)) return 'Escribe tu celular de Nequi: 10 dígitos y empieza por 3.';
    if (medio.kind === 'card') return tarjetaValida(card);
    return null;
  };

  const etiquetaMedio = (): string => {
    if (!medio) return '';
    if (medio.kind === 'saved') return medio.label;
    if (medio.kind === 'nequi') return `Nequi •••• ${phone.replace(/\D/g, '').slice(-4)}`;
    return `Tarjeta •••• ${card.number.replace(/\D/g, '').slice(-4)}`;
  };

  // ── Último paso común: con el token listo, activar o cambiar el medio ────
  const finalizar = async (tokenId: string, consentId: string, label: string) => {
    if (mode === 'change_method') {
      if (!subscriptionId) return;
      try {
        const r = await actualizarDebito(subscriptionId, { tokenId });
        toast({
          title: r?.reactivated ? 'Medio actualizado y débito reactivado' : 'Medio de pago actualizado',
          description: `Los próximos débitos se harán de tu ${label}.`,
        });
        onDone();
        onOpenChange(false);
      } catch {
        setError(ERROR_GENERICO);
        setPaso('medio');
      }
      return;
    }
    try {
      const { results } = await activarDebito({
        schoolId,
        tokenId,
        consentId,
        athletes: seleccionados.map((a) => ({
          childId: a.childId ?? undefined,
          athleteUserId: a.athleteUserId ?? undefined,
          maxAmount: parseMonto(topes[a.key] ?? '') ?? 0,
        })),
        includeCurrentPeriod: !!conMesEnCurso && incluirMes,
      });
      const porKey = new Map(athletes.map((a) => [a.key, a.name]));
      const lista: AltaResultado[] = Array.isArray(results) ? results : [];
      setResultados({
        ok: lista.filter((r) => r.ok).map((r) => porKey.get(r.key) ?? 'tu deportista'),
        fallos: lista.filter((r) => !r.ok).map((r) => ({ name: porKey.get(r.key) ?? 'Deportista', texto: textoErrorAlta(r.error) })),
        medio: label,
      });
      setPaso('listo');
      onDone();
    } catch {
      setError(ERROR_GENERICO);
      setPaso('confirmar');
    }
  };
  const finalizarRef = useRef(finalizar);
  finalizarRef.current = finalizar;

  // ── Espera de la autorización (Nequi, o una tarjeta que quedó pendiente) ─
  useEffect(() => {
    if (paso !== 'espera' || !pendiente || !open) return;
    let parado = false;
    let timer: ReturnType<typeof setTimeout>;
    const volver = (msg: string) => {
      parado = true;
      setError(msg);
      setPendiente(null);
      setPaso('medio');
    };
    const tick = async () => {
      if (parado) return;
      try {
        const r = await getEstadoMedio(pendiente.tokenId);
        if (parado) return;
        if (r.status === 'available') {
          parado = true;
          await finalizarRef.current(pendiente.tokenId, pendiente.consentId, r.label || pendiente.label);
          return;
        }
        if (r.status === 'declined' || r.status === 'error' || r.status === 'voided') {
          volver(pendiente.kind === 'nequi' ? NEQUI_RECHAZO : 'La pasarela no aprobó la tarjeta. Intenta de nuevo o usa otro medio.');
          return;
        }
      } catch {
        // Falla de red: se reintenta en el próximo tick.
      }
      if (Date.now() - pendiente.startedAt > NEQUI_TIMEOUT_MS) {
        volver('No recibimos la autorización a tiempo. Intenta de nuevo o usa otro medio.');
        return;
      }
      timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 3000);
    return () => { parado = true; clearTimeout(timer); };
  }, [paso, pendiente, open]);

  // ── Enviar (paso 2 en activate; paso 1 en change_method) ────────────────
  const enviar = async () => {
    setError(null);
    const em = errorMedio();
    if (em) { setError(em); return; }
    if (!medio) return;
    setBusy(true);
    try {
      if (medio.kind === 'saved') {
        await finalizar(medio.tokenId, 'reuse', medio.label);
        return;
      }
      const s = await setupVigente();
      if (!s) { setError('No pudimos conectar con la pasarela de la escuela. Intenta de nuevo.'); return; }
      const acc = {
        acceptanceToken: s.acceptance.acceptanceToken,
        personalDataAuthToken: s.acceptance.personalDataAuthToken,
        acceptancePermalink: s.acceptance.acceptancePermalink,
        personalDataPermalink: s.acceptance.personalDataPermalink,
      };
      if (medio.kind === 'card') {
        const exp = parseVencimiento(card.exp);
        if (!exp) return;
        const tok = await tokenizarTarjeta(s, {
          number: card.number, cvc: card.cvc.trim(), expMonth: exp.expMonth, expYear: exp.expYear, holder: card.holder.trim(),
        });
        if ('error' in tok) { setError(tok.error); return; }
        setupUsado.current = true;
        const creado = await registrarTarjeta({
          schoolId, cardToken: tok.token, ...acc,
          brand: tok.brand ?? undefined, lastFour: tok.lastFour, expMonth: exp.expMonth, expYear: exp.expYear,
        });
        if (creado.status === 'available') {
          await finalizar(creado.tokenId, creado.consentId, creado.label || etiquetaMedio());
        } else {
          setPendiente({ tokenId: creado.tokenId, consentId: creado.consentId, label: creado.label || etiquetaMedio(), startedAt: Date.now(), kind: 'card' });
          setPaso('espera');
        }
        return;
      }
      // Nequi
      setupUsado.current = true;
      const creado = await iniciarNequi({ schoolId, phone: phone.replace(/\D/g, ''), ...acc });
      if (creado.status === 'available') {
        await finalizar(creado.tokenId, creado.consentId, creado.label || etiquetaMedio());
      } else {
        setPendiente({ tokenId: creado.tokenId, consentId: creado.consentId, label: creado.label || etiquetaMedio(), startedAt: Date.now(), kind: 'nequi' });
        setPaso('espera');
      }
    } catch {
      setupUsado.current = true;
      setError(ERROR_GENERICO);
    } finally {
      setBusy(false);
    }
  };

  const continuar = () => {
    const em = errorMedio();
    if (em) { setError(em); return; }
    setError(null);
    setPaso('confirmar');
  };

  const elegirGuardado = (m: MedioGuardado) => {
    setMedio({ kind: 'saved', tokenId: m.tokenId, label: m.label });
    setError(null);
    // Activar: un toque en un medio guardado ya lleva a confirmar.
    if (mode === 'activate') setPaso('confirmar');
  };

  const puedeActivar =
    seleccionados.length > 0 &&
    seleccionados.every((a) => !erroresTope[a.key]) &&
    consentimientoOk &&
    !busy;

  // ── Render ───────────────────────────────────────────────────────────────

  const consentimiento = pideConsentimiento && (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Checkbox id="ad-terminos" checked={aceptaTerminos} onCheckedChange={(v) => setAceptaTerminos(v === true)} className="mt-0.5" />
        <Label htmlFor="ad-terminos" className="text-sm font-normal leading-snug">
          Acepto los{' '}
          {setup?.acceptance.acceptancePermalink ? (
            <a href={setup.acceptance.acceptancePermalink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              términos y condiciones de Wompi
            </a>
          ) : 'términos y condiciones de Wompi'}
        </Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="ad-datos" checked={aceptaDatos} onCheckedChange={(v) => setAceptaDatos(v === true)} className="mt-0.5" />
        <Label htmlFor="ad-datos" className="text-sm font-normal leading-snug">
          Autorizo el{' '}
          {setup?.acceptance.personalDataPermalink ? (
            <a href={setup.acceptance.personalDataPermalink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              tratamiento de mis datos personales
            </a>
          ) : 'tratamiento de mis datos personales'}
        </Label>
      </div>
    </div>
  );

  const opcion = (activa: boolean, onClick: () => void, icon: ReactNode, titulo: string, sub?: string) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        activa ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
      )}
    >
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="font-medium text-sm">{titulo}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </button>
  );

  const pasoMedio = (
    <div className="space-y-3">
      {guardados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tus medios guardados</p>
          {guardados.map((m) => (
            <div key={m.tokenId}>
              {opcion(
                medio?.kind === 'saved' && medio.tokenId === m.tokenId,
                () => elegirGuardado(m),
                m.type === 'NEQUI' ? <Smartphone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />,
                m.label,
              )}
            </div>
          ))}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">O uno nuevo</p>
        </div>
      )}

      {opcion(medio?.kind === 'nequi', () => { setMedio({ kind: 'nequi' }); setError(null); }, <Smartphone className="h-4 w-4" />, 'Nequi', 'Autorizas una sola vez desde tu app')}
      {medio?.kind === 'nequi' && (
        <div className="space-y-1.5 pl-1">
          <Label htmlFor="ad-phone">Celular de Nequi</Label>
          <Input
            id="ad-phone"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="300 123 4567"
            value={phone}
            maxLength={12}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))}
          />
        </div>
      )}

      {opcion(medio?.kind === 'card', () => { setMedio({ kind: 'card' }); setError(null); }, <CreditCard className="h-4 w-4" />, 'Tarjeta débito o crédito')}
      {medio?.kind === 'card' && (
        <div className="space-y-2 pl-1">
          <div className="space-y-1.5">
            <Label htmlFor="ad-num">Número de la tarjeta</Label>
            <Input
              id="ad-num"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: formatearNumeroTarjeta(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ad-exp">Vence (MM/AA)</Label>
              <Input
                id="ad-exp"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                maxLength={5}
                value={card.exp}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCard((c) => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-cvc">CVC</Label>
              <Input
                id="ad-cvc"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={card.cvc}
                onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-holder">Nombre en la tarjeta</Label>
            <Input
              id="ad-holder"
              autoComplete="cc-name"
              value={card.holder}
              onChange={(e) => setCard((c) => ({ ...c, holder: e.target.value }))}
            />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Los datos de la tarjeta van directo a la pasarela; SportMaps no los guarda.
          </p>
        </div>
      )}

      {mode === 'change_method' && consentimiento}
    </div>
  );

  const pasoConfirmar = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setPaso('medio'); setError(null); }}
        className="w-full flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Wallet className="h-4 w-4 shrink-0" />
          <span className="truncate">Debitaremos de tu {etiquetaMedio()}</span>
        </span>
        <span className="text-primary text-xs font-medium shrink-0">Cambiar</span>
      </button>

      <div className="space-y-2">
        {athletes.map((a) => {
          const err = erroresTope[a.key];
          const tope = parseMonto(topes[a.key] ?? '');
          return (
            <div key={a.key} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`ad-a-${a.key}`}
                  checked={!!seleccion[a.key]}
                  onCheckedChange={(v) => setSeleccion((s) => ({ ...s, [a.key]: v === true }))}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`ad-a-${a.key}`} className="font-medium">{a.name}</Label>
                  <p className="text-xs text-muted-foreground">
                    {a.currentTotal !== null
                      ? <>Mensualidad actual: {formatCurrency(a.currentTotal)}</>
                      : 'Todavía no tiene mensualidad generada'}
                  </p>
                  {seleccion[a.key] && (
                    editandoTope[a.key] ? (
                      <div className="mt-1.5 space-y-1">
                        <Label htmlFor={`ad-t-${a.key}`} className="text-xs">Tope por mes</Label>
                        <Input
                          id={`ad-t-${a.key}`}
                          inputMode="numeric"
                          className="h-8 max-w-[180px]"
                          value={topes[a.key] ?? ''}
                          placeholder="$0"
                          onChange={(e) => setTopes((t) => ({ ...t, [a.key]: e.target.value.replace(/\D/g, '') }))}
                        />
                        {err && topes[a.key]
                          ? <p className="text-xs text-destructive">{err}</p>
                          : err ? <p className="text-xs text-muted-foreground">{err}</p>
                          : <p className="text-xs text-muted-foreground">Si un mes la mensualidad supera este valor, no la debitamos y te avisamos.</p>}
                      </div>
                    ) : (
                      <p className="text-xs mt-0.5">
                        Tope por mes: <span className="font-medium">{tope !== null ? formatCurrency(tope) : '—'}</span>{' '}
                        <button
                          type="button"
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={() => setEditandoTope((s) => ({ ...s, [a.key]: true }))}
                        >
                          Cambiar
                        </button>
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {surchargePct > 0 && (
          <p className="text-xs text-muted-foreground">Incluye el recargo del pago en línea ({surchargePct} %).</p>
        )}
      </div>

      {conMesEnCurso?.currentPeriod && (
        <div className="flex items-start gap-2">
          <Checkbox id="ad-mes" checked={incluirMes} onCheckedChange={(v) => setIncluirMes(v === true)} className="mt-0.5" />
          <Label htmlFor="ad-mes" className="text-sm font-normal leading-snug">
            Debitar también la mensualidad de {nombreMes(conMesEnCurso.currentPeriod.periodMonth)} (vence el {diaMes(conMesEnCurso.currentPeriod.dueDate)})
          </Label>
        </div>
      )}

      {vencidas > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Tienes {plural(vencidas, 'mensualidad vencida', 'mensualidades vencidas')}. El débito no las cobra: págalas desde Mis Pagos.
          </span>
        </div>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4 shrink-0" />
        Te avisaremos 2 días antes de cada débito.
      </p>

      {consentimiento}
    </div>
  );

  const pasoEspera = pendiente && (
    <div className="py-6 text-center space-y-4">
      <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
      {pendiente.kind === 'nequi' ? (
        <p className="text-sm">
          Abre Nequi y acepta la suscripción de <span className="font-medium">{schoolName}</span>. Solo lo autorizas esta vez;
          los débitos de cada mes no te piden nada más.
        </p>
      ) : (
        <p className="text-sm">Estamos confirmando tu tarjeta con la pasarela…</p>
      )}
      <Button variant="ghost" size="sm" onClick={() => { setPendiente(null); setPaso('medio'); }}>
        Usar otro medio
      </Button>
    </div>
  );

  const pasoListo = resultados && (
    <div className="space-y-4 py-2">
      {resultados.ok.length > 0 ? (
        <div className="text-center space-y-2">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
          <p className="text-lg font-semibold">Débito automático activo</p>
          <p className="text-sm text-muted-foreground">
            Cada mes te avisaremos cuánto y cuándo debitaremos la mensualidad de {unirNombres(resultados.ok)} de tu {resultados.medio}.
            Puedes cancelarlo cuando quieras aquí.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <XCircle className="h-12 w-12 mx-auto text-destructive" />
          <p className="text-lg font-semibold">No pudimos activar el débito</p>
        </div>
      )}
      {resultados.fallos.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {resultados.fallos.map((f, i) => (
            <li key={i}>{f.name}: {f.texto}.</li>
          ))}
        </ul>
      )}
    </div>
  );

  const titulo = mode === 'change_method'
    ? 'Cambiar medio de pago'
    : paso === 'confirmar' ? 'Confirmar'
      : paso === 'listo' ? 'Débito automático'
        : paso === 'espera' ? (pendiente?.kind === 'nequi' ? 'Esperando tu autorización en Nequi' : 'Confirmando tu tarjeta')
          : '¿De dónde debitamos?';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && busy) return; onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paso === 'confirmar' && mode === 'activate' && (
              <button type="button" aria-label="Volver" onClick={() => { setPaso('medio'); setError(null); }} className="-ml-1 p-1 rounded hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {titulo}
          </DialogTitle>
          {paso === 'medio' && (
            <DialogDescription>
              {mode === 'change_method'
                ? 'Elige el medio del que debitaremos de ahora en adelante.'
                : `Débito automático de la mensualidad en ${schoolName}.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {setupError && paso !== 'listo' && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span>No pudimos conectar con la pasarela de la escuela.</span>
            <Button size="sm" variant="outline" onClick={() => void cargarSetup()}>Reintentar</Button>
          </div>
        )}

        {paso === 'medio' && pasoMedio}
        {paso === 'confirmar' && pasoConfirmar}
        {paso === 'espera' && pasoEspera}
        {paso === 'listo' && pasoListo}

        {error && paso !== 'listo' && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}

        {paso === 'medio' && mode === 'activate' && medioNuevo && (
          <DialogFooter>
            <Button className="w-full" onClick={continuar}>Continuar</Button>
          </DialogFooter>
        )}
        {paso === 'medio' && mode === 'change_method' && (
          <DialogFooter>
            <Button className="w-full" disabled={!medio || !consentimientoOk || busy} onClick={() => void enviar()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar medio
            </Button>
          </DialogFooter>
        )}
        {paso === 'confirmar' && (
          <DialogFooter>
            <Button className="w-full" disabled={!puedeActivar} onClick={() => void enviar()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Activar débito automático
            </Button>
          </DialogFooter>
        )}
        {paso === 'listo' && (
          <DialogFooter>
            {resultados && resultados.ok.length === 0 ? (
              <Button className="w-full" variant="outline" onClick={() => setPaso('confirmar')}>Volver</Button>
            ) : (
              <Button className="w-full" onClick={() => onOpenChange(false)}>Listo</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
