/**
 * Equipos › Partidos y convocatorias.
 *
 * Próximo partido (match_results) → convocatoria:
 *   - sin convocatoria: cuadrícula para quitar/sumar (arranca con los del último
 *     partido, o con todos) y «Convocar…», que guarda con `save_match_roster`
 *     tras 8 s con Deshacer. Con B2 aplicado, esa misma RPC avisa a las familias.
 *   - con convocatoria: cuántos van / no van / sin responder (RPC `callup_status`,
 *     B2; sin la RPC solo se ve cuántos quedaron convocados).
 *   - si la convocatoria ya tiene posiciones de la pizarra, NO se reescribe desde
 *     acá (save_match_roster borraría las posiciones): se cambia en la pizarra.
 * «Armar la alineación en la pizarra» abre el LineupModal de siempre.
 * Resultados: los partidos jugados, con enlace a /results para contar cómo fue.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LineupModal } from '@/components/school/LineupModal';
import { InlineError, SectionSkeleton, EmptyNote } from '@/components/parent/v2/hijos/parts';
import {
  armarConvocatoria,
  claveConvocado,
  contarRespuestas,
  diaLargo,
  horaDePartido,
  nombreCorto,
  proximoPartido,
  refuerzosDe,
  resultadoDe,
  sujetoDe,
  type Partido,
  type RutasCoachV2,
} from '../coachV2Logic';
import { useConvocatoria, useDeportistasEquipo, useNombresConvocados, usePartidosEquipo, useRespuestasConvocatoria } from '../useCoachV2Data';
import { useAccionConDeshacer } from '../useAccionConDeshacer';

interface Props {
  schoolId: string;
  teamId: string;
  equipo: string;
  hoy: Date;
  rutas: RutasCoachV2;
}

const TONO_RES = {
  gana: 'bg-primary/10 text-primary',
  pierde: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  empata: 'bg-muted text-foreground',
} as const;

export function PartidosTab({ schoolId, teamId, equipo, hoy, rutas }: Props) {
  const partidos = usePartidosEquipo(teamId);
  const [pizarra, setPizarra] = useState<Partido | null>(null);

  if (partidos.isLoading) return <SectionSkeleton rows={4} label="Cargando partidos" />;
  if (partidos.isError) return <InlineError message="No pudimos traer los partidos." onRetry={() => partidos.refetch()} />;

  const lista = partidos.data ?? [];
  const prox = proximoPartido(lista, hoy);
  const jugados = lista.filter((p) => resultadoDe(p)).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {prox ? (
        <ProximoPartido schoolId={schoolId} teamId={teamId} partido={prox} todos={lista} onPizarra={() => setPizarra(prox)} />
      ) : (
        <EmptyNote>
          <p className="font-semibold text-foreground">No hay partidos programados.</p>
          <p className="mt-1">Cuando la escuela (o tú) programe uno, aquí convocas y ves quién va.</p>
          <Button asChild variant="outline" className="mt-3 min-h-touch rounded-xl"><Link to={rutas.resultados}>Ir a Resultados</Link></Button>
        </EmptyNote>
      )}

      <span className="pl-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Resultados</span>
      {jugados.length === 0 ? (
        <EmptyNote>Todavía no hay resultados de {equipo}.</EmptyNote>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {jugados.map((p) => {
            const r = resultadoDe(p)!;
            return (
              <li key={p.id} className="flex min-h-16 items-center gap-3 border-t px-4 py-2 first:border-t-0">
                <span className={cn('flex h-9 min-w-14 items-center justify-center rounded-xl px-2 text-base font-bold', TONO_RES[r.tono])}>{r.marcador}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base">{r.frase}</span>
                  <span className="text-xs text-muted-foreground">{diaLargo(p.fecha)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link to={rutas.resultados} className="flex min-h-touch items-center justify-between rounded-2xl border bg-card px-4 text-sm font-semibold text-primary">
        Contar cómo fue un partido <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>

      {pizarra && (
        <LineupModal
          open
          onClose={() => setPizarra(null)}
          teamId={teamId}
          teamName={equipo}
          sourceType="team_match"
          sourceId={pizarra.id}
          matchLabel={`vs ${pizarra.rival} · ${diaLargo(pizarra.fecha)}`}
        />
      )}
    </div>
  );
}

function ProximoPartido({ schoolId, teamId, partido, todos, onPizarra }: {
  schoolId: string; teamId: string; partido: Partido; todos: Partido[]; onPizarra: () => void;
}) {
  const qc = useQueryClient();
  const deportistas = useDeportistasEquipo(schoolId, teamId);
  const conv = useConvocatoria(partido.id);
  const respuestas = useRespuestasConvocatoria(conv.data?.id ?? null);
  // Base para arrancar: los convocados del último partido jugado.
  const anterior = todos.find((p) => p.id !== partido.id && p.fecha < partido.fecha) ?? null;
  const convAnterior = useConvocatoria(conv.data === null ? anterior?.id ?? null : null);
  const { programar } = useAccionConDeshacer();

  const [editando, setEditando] = useState(false);
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [enviada, setEnviada] = useState(false);

  const roster = useMemo(() => deportistas.data ?? [], [deportistas.data]);
  const claveSujeto = claveConvocado;
  // Convocados de ESTE partido que no están en el roster activo (refuerzos de otra
  // categoría o inactivos sumados en la pantalla clásica): se conservan y se
  // muestran aparte; solo salen si el profe los quita.
  const refuerzos = useMemo(() => refuerzosDe(roster, conv.data?.players ?? []), [roster, conv.data]);
  const nombres = useNombresConvocados(schoolId, refuerzos);

  // Selección inicial: convocatoria actual (con refuerzos) > la del partido anterior (solo roster) > todos.
  useEffect(() => {
    if (sel || !deportistas.data || conv.isLoading) return;
    if (conv.data === null && anterior && convAnterior.isLoading) return;
    const todosKeys = roster.map((d) => claveSujeto(sujetoDe(d)));
    const actual = conv.data?.players ?? [];
    if (actual.length) { setSel(new Set(actual.map(claveSujeto))); return; }
    const base = convAnterior.data?.players ?? null;
    const set = base?.length ? new Set(base.map(claveSujeto).filter((k) => todosKeys.includes(k))) : new Set(todosKeys);
    setSel(set);
  }, [sel, deportistas.data, conv.isLoading, conv.data, convAnterior.data, convAnterior.isLoading, anterior, roster, claveSujeto]);

  const tienePizarra = (conv.data?.players ?? []).some((p) => p.x != null || p.y != null || !!p.slot_label);
  const hayConvocatoria = !!conv.data && (conv.data.players?.length ?? 0) > 0;
  const avisaFamilias = respuestas.data?.disponible === true;
  const n = sel?.size ?? 0;
  const hora = horaDePartido(partido);

  const convocar = () => {
    if (!sel || n === 0) return;
    const p_players = armarConvocatoria(roster, sel, conv.data?.players ?? []);
    const familias = p_players.length;
    setEnviada(true);
    setEditando(false);
    programar(
      `convocar:${partido.id}`,
      avisaFamilias ? `Vas a convocar a ${familias}. Avisaremos a sus familias.` : `Vas a convocar a ${familias}.`,
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).rpc('save_match_roster', { p_match: partido.id, p_players });
        if (error) {
          setEnviada(false);
          console.error('[convocatoria] save_match_roster', error);
          toast.error('No pudimos guardar la convocatoria. Revisa tu conexión e inténtalo de nuevo.');
          return;
        }
        toast.success(avisaFamilias ? `Avisamos a ${familias} familias. Pueden responder «Va» o «No va».` : `Convocaste a ${familias} deportistas.`);
        qc.invalidateQueries({ queryKey: ['coach-v2', 'convocatoria', partido.id] });
        qc.invalidateQueries({ queryKey: ['coach-v2', 'partidos-proximos'] });
      },
      () => setEnviada(false),
    );
  };

  const mostrarCuadricula = !tienePizarra && (editando || (!hayConvocatoria && !enviada));
  const cuenta = respuestas.data?.disponible ? contarRespuestas(respuestas.data.filas) : null;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Próximo partido">
        <div className="flex flex-col gap-1 bg-foreground px-4 py-3.5 text-background">
          <span className="text-xs opacity-75">Próximo partido{partido.tipo ? ` · ${partido.tipo}` : ''}</span>
          <span className="text-lg font-bold">Contra {partido.rival}</span>
          <span className="text-sm opacity-90">{[diaLargo(partido.fecha), hora, partido.lugar].filter(Boolean).join(' · ')}</span>
        </div>

        {deportistas.isLoading || conv.isLoading ? (
          <div className="p-4"><SectionSkeleton rows={2} label="Cargando la convocatoria" /></div>
        ) : deportistas.isError || conv.isError ? (
          <div className="p-4"><InlineError message="No pudimos traer la convocatoria." onRetry={() => { deportistas.refetch(); conv.refetch(); }} /></div>
        ) : mostrarCuadricula ? (
          <>
            <div className="flex flex-col gap-0.5 px-4 pb-1.5 pt-3">
              <span className="text-base font-semibold">Convocados: {n} de {roster.length + refuerzos.length}</span>
              <span className="text-xs text-muted-foreground">
                {hayConvocatoria ? 'Así quedó la convocatoria.' : convAnterior.data?.players?.length ? 'Arranca con los del último partido.' : 'Arranca con todos.'} Toca para quitar o sumar.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-2 pb-2 md:grid-cols-3">
              {roster.map((d) => {
                const k = claveSujeto(sujetoDe(d));
                const on = !!sel?.has(k);
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setSel((s) => { const x = new Set(s ?? []); if (on) x.delete(k); else x.add(k); return x; })}
                    className={cn(
                      'flex min-h-touch items-center gap-2 rounded-xl border-2 px-2.5 text-left text-sm font-medium',
                      on ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                      {on && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    <span className="truncate">{nombreCorto(d.nombre)}</span>
                  </button>
                );
              })}
              {refuerzos.map((r) => {
                const k = claveSujeto(r);
                const on = !!sel?.has(k);
                const nombre = nombres.data?.get(k);
                return (
                  <button
                    key={k}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    data-testid="convocado-refuerzo"
                    onClick={() => setSel((s) => { const x = new Set(s ?? []); if (on) x.delete(k); else x.add(k); return x; })}
                    className={cn(
                      'flex min-h-touch items-center gap-2 rounded-xl border-2 border-dashed px-2.5 text-left text-sm font-medium',
                      on ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                      {on && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate">{nombre ? nombreCorto(nombre) : 'Deportista'}</span>
                      <span className="text-[11px] font-normal opacity-80">Refuerzo</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {refuerzos.length > 0 && (
              <p className="px-4 pb-1 text-xs text-muted-foreground">
                Los refuerzos no son de este equipo (otra categoría o inactivos). Siguen convocados salvo que los quites.
              </p>
            )}
            {partido.nota && (
              <p className="mx-4 mb-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">{partido.nota}</p>
            )}
            <div className="px-4 pb-4 pt-2">
              <Button className="h-14 w-full rounded-2xl text-base font-semibold" disabled={n === 0} onClick={convocar}>
                {avisaFamilias ? `Convocar y avisar a ${n} familias` : `Convocar a ${n}`}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5 px-4 py-3.5">
            <p className="flex items-center gap-2 text-base font-semibold text-primary">
              <Check className="h-5 w-5" aria-hidden />
              {conv.data?.players.length ?? n} convocados{avisaFamilias ? ' · familias avisadas' : ''}
            </p>
            {cuenta && (
              <div className="grid grid-cols-3 gap-2" data-testid="respuestas-convocatoria">
                <Cifra n={cuenta.van} txt="van" tono="bg-primary/10 text-primary" />
                <Cifra n={cuenta.noVan} txt="no van" tono="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300" />
                <Cifra n={cuenta.sinResponder} txt="sin responder" tono="bg-muted text-foreground" />
              </div>
            )}
            {tienePizarra ? (
              <p className="text-xs text-muted-foreground">Esta convocatoria tiene posiciones en la pizarra: cámbiala desde la pizarra para no perderlas.</p>
            ) : (
              <Button variant="outline" className="h-12 rounded-xl" onClick={() => { setSel(new Set((conv.data?.players ?? []).map((p) => claveSujeto(p)))); setEditando(true); }}>
                Cambiar convocatoria{avisaFamilias ? ' (avisa el cambio)' : ''}
              </Button>
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onPizarra}
        className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 text-left active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <span className="flex-1 text-base font-medium">Armar la alineación en la pizarra</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>
    </>
  );
}

function Cifra({ n, txt, tono }: { n: number; txt: string; tono: string }) {
  return (
    <div className={cn('flex flex-col rounded-xl p-2.5', tono)}>
      <span className="text-lg font-bold">{n}</span>
      <span className="text-xs">{txt}</span>
    </div>
  );
}
