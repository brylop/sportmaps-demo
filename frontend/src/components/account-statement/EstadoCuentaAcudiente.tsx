/**
 * Estado de cuenta del hijo — vista del ACUDIENTE (rediseño V2).
 *
 * Una frase («Sofía debe $ 765.000» / «Sofía está al día») y un botón que lleva
 * al ÚNICO flujo de pago (/my-payments, con `?pay=<id>` si es un solo cobro).
 * Debajo, los meses con su estado en palabras; cada mes se abre para ver sus
 * cobros. «Imprimir» es secundario.
 *
 * La escuela (y el deportista adulto) siguen viendo la pantalla de siempre en
 * AccountStatementPage: este componente solo se monta para el acudiente.
 *
 * Montos: el saldo es summary.total_open de la RPC; los valores por cobro son
 * los de la base, para mostrar. Nada se calcula aquí para cobrar.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import {
  agruparPorMes, resumenCuenta, estadoCobro, detalleCobro, valorCobro, tituloCobro, primerNombre,
  ABRE_CHECKOUT, type CobroCuenta, type MesCuenta,
} from './estadoCuentaModel';
import { ChipEstado } from '@/components/common/ChipEstado';
import { printStatement, type StatementData } from './statementPrint';

const MESES_VISIBLES = 12;

export interface EstadoCuentaAcudienteViewProps {
  state: 'loading' | 'error' | 'ready';
  statement?: StatementData;
  cobros?: CobroCuenta[];
  months: number;
  onRetry: () => void;
  onPrint: () => void;
  now?: Date;
}

/** Solo presenta (probado aparte). */
export function EstadoCuentaAcudienteView({ state, statement, cobros = [], months, onRetry, onPrint, now }: EstadoCuentaAcudienteViewProps) {
  const ahora = useMemo(() => now ?? new Date(), [now]);
  const meses = useMemo(() => agruparPorMes(cobros, ahora), [cobros, ahora]);
  const [abiertos, setAbiertos] = useState<Set<string> | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  if (state === 'loading') {
    return (
      <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-nav-safe" aria-busy="true" aria-label="Cargando el estado de cuenta">
        <Skeleton className="h-8 w-4/5 rounded-lg" />
        <Skeleton className="h-5 w-3/5 rounded-lg" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (state === 'error' || !statement) {
    return (
      <div className="mx-auto w-full max-w-page-narrow pb-nav-safe">
        <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-base font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            No pudimos cargar el estado de cuenta
          </p>
          <p className="text-sm text-muted-foreground">
            Esto no quiere decir que esté al día. Revisa tu conexión e inténtalo de nuevo.
          </p>
          <Button variant="outline" className="min-h-touch rounded-xl" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const nombre = statement.athlete_name;
  const resumen = resumenCuenta(nombre, Number(statement.summary.total_open || 0), cobros, formatCurrency, ahora);
  // Por defecto queda abierto el mes más reciente que tenga algo pendiente.
  const abiertosEfectivos = abiertos ?? new Set(meses.filter((m) => m.estado.label !== 'Pagado').slice(0, 1).map((m) => m.key));
  const toggle = (key: string) => {
    const next = new Set(abiertosEfectivos);
    if (next.has(key)) next.delete(key); else next.add(key);
    setAbiertos(next);
  };
  const visibles = verTodos ? meses : meses.slice(0, MESES_VISIBLES);

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-5 pb-nav-safe">
      <section aria-label="Resumen" className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Estado de cuenta</p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{resumen.titulo}</h1>
          {resumen.subtitulo && <p className="text-base text-muted-foreground">{resumen.subtitulo}</p>}
        </div>
        {resumen.boton && (
          <Button asChild className="h-14 w-full rounded-2xl text-lg font-semibold active:scale-[0.97] motion-reduce:active:scale-100">
            <Link to={resumen.boton.href}>{resumen.boton.label}</Link>
          </Button>
        )}
      </section>

      <section aria-label="Mes a mes" className="space-y-1.5">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Mes a mes</h2>
        {meses.length === 0 ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="font-semibold">Aún no hay cobros</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando la escuela le genere un cobro a {primerNombre(nombre)}, aparece aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {visibles.map((m, i) => (
              <FilaMes
                key={m.key}
                mes={m}
                primero={i === 0}
                abierto={abiertosEfectivos.has(m.key)}
                onToggle={() => toggle(m.key)}
                nombre={nombre}
                now={ahora}
              />
            ))}
          </div>
        )}
        {!verTodos && meses.length > MESES_VISIBLES && (
          <Button variant="link" className="min-h-touch h-auto w-full text-sm font-semibold" onClick={() => setVerTodos(true)}>
            Ver meses anteriores
          </Button>
        )}
      </section>

      <section aria-label="Más opciones" className="space-y-3">
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Desde que entró: {formatCurrency(Number(statement.summary.total_expected || 0))} en cobros
          {' · '}{formatCurrency(Number(statement.summary.total_settled || 0))} pagados
          {Number(statement.summary.total_late_fees || 0) > 0 && ` · ${formatCurrency(Number(statement.summary.total_late_fees))} de recargo por mora`}.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" className="min-h-touch rounded-xl">
            <Link to="/my-payments">Ver todos los pagos</Link>
          </Button>
          <Button variant="ghost" className="min-h-touch rounded-xl" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            Imprimir
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Al imprimir salen los últimos {months} meses.</p>
      </section>
    </div>
  );
}

function FilaMes({
  mes, primero, abierto, onToggle, nombre, now,
}: { mes: MesCuenta; primero: boolean; abierto: boolean; onToggle: () => void; nombre: string; now: Date }) {
  const panelId = `mes-${mes.key}`;
  return (
    <div className={cn(!primero && 'border-t')}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{mes.titulo}</span>
          <span className="text-xs text-muted-foreground">
            {mes.cobros.length === 1 ? '1 cobro' : `${mes.cobros.length} cobros`}
          </span>
        </span>
        <ChipEstado {...mes.estado} />
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', abierto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {abierto && (
        <ul id={panelId} className="space-y-2 bg-muted/30 px-4 pb-4 pt-1">
          {mes.cobros.map((c) => (
            <FilaCobro key={c.id} cobro={c} nombre={nombre} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaCobro({ cobro, nombre, now }: { cobro: CobroCuenta; nombre: string; now: Date }) {
  const estado = estadoCobro(cobro, now);
  const pagable = ABRE_CHECKOUT.includes(cobro.status);
  const irAPagos = cobro.status === 'partial' || cobro.status === 'glosado';
  return (
    <li className="rounded-xl border bg-card px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold">{tituloCobro(cobro, nombre)}</span>
          <span className={cn('text-xs', estado.tono === 'peligro' ? 'text-destructive' : 'text-muted-foreground')}>
            {detalleCobro(cobro, now)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="whitespace-nowrap text-sm font-bold">{formatCurrency(valorCobro(cobro))}</span>
          <ChipEstado {...estado} />
        </span>
      </div>
      {(pagable || irAPagos) && (
        <Link
          to={pagable ? `/my-payments?pay=${cobro.id}` : '/my-payments'}
          className="mt-1 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary"
        >
          {pagable ? 'Pagar este cobro' : cobro.status === 'glosado' ? 'Responder a la escuela' : 'Pagar el saldo'}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

/** Sin `child_id` en la URL: que la familia elija a cuál hijo. */
function ElegirHijo() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['estado-cuenta-hijos', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('id, full_name').eq('parent_id', user!.id).order('full_name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; full_name: string }>;
    },
  });
  if (isLoading) return <EstadoCuentaAcudienteView state="loading" months={12} onRetry={() => {}} onPrint={() => {}} />;
  if (isError) return <EstadoCuentaAcudienteView state="error" months={12} onRetry={() => void refetch()} onPrint={() => {}} />;
  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-nav-safe">
      <h1 className="text-2xl font-bold leading-tight tracking-tight">¿De quién quieres ver el estado de cuenta?</h1>
      {data && data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {data.map((h, i) => (
            <Link
              key={h.id}
              to={`/estado-cuenta?child_id=${h.id}`}
              className={cn('flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-muted/50', i > 0 && 'border-t')}
            >
              <span className="flex-1 text-base">{h.full_name}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Aún no tienes deportistas vinculados</p>
          <Button asChild variant="outline" className="mt-3 min-h-touch rounded-xl">
            <Link to="/children">Ir a mis hijos</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export interface EstadoCuentaAcudienteProps {
  schoolId: string | null | undefined;
  childId: string | undefined;
  months: number;
  /** El contexto de escuela aún está cargando (sin escuela todavía no es un error). */
  schoolLoading?: boolean;
}

export function EstadoCuentaAcudiente({ schoolId, childId, months, schoolLoading = false }: EstadoCuentaAcudienteProps) {
  const { toast } = useToast();

  // Misma RPC y misma llave de caché que la vista de la escuela.
  const statement = useQuery({
    queryKey: ['account-statement', schoolId, childId, undefined, undefined, months],
    enabled: !!schoolId && !!childId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_athlete_account_statement', {
        p_school_id: schoolId,
        p_child_id: childId,
        p_user_id: null,
        p_unregistered_athlete_id: null,
        p_months: months,
      });
      if (error) throw error;
      return data as StatementData;
    },
  });

  // Los cobros del hijo en esa escuela (mismo alcance que la RPC), para el
  // detalle por mes y para saber a qué cobro lleva «Pagar».
  const cobros = useQuery({
    queryKey: ['estado-cuenta-cobros', schoolId, childId],
    enabled: !!schoolId && !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, status, amount, amount_paid, concept, due_date, payment_date, period_year, period_month, created_at')
        .eq('school_id', schoolId!)
        .eq('child_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CobroCuenta[];
    },
  });

  if (!childId) return <ElegirHijo />;

  const state: 'loading' | 'error' | 'ready' =
    !schoolId
      ? (schoolLoading ? 'loading' : 'error')
      : statement.isError || cobros.isError
        ? 'error'
        : statement.data && cobros.data
          ? 'ready'
          : 'loading';

  return (
    <EstadoCuentaAcudienteView
      state={state}
      statement={statement.data}
      cobros={cobros.data}
      months={months}
      onRetry={() => { void statement.refetch(); void cobros.refetch(); }}
      onPrint={() => {
        if (!statement.data) return;
        if (!printStatement(statement.data, months)) {
          toast({
            title: 'No se pudo abrir la impresión',
            description: 'Tu navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio o ábrelo desde el navegador del celular.',
          });
        }
      }}
    />
  );
}
