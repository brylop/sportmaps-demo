/**
 * Equipos › Evaluar.
 *   1. Entrenos cerrados sin evaluar (últimos 14 días) → «Evaluar».
 *   2. Informe mensual del equipo: avance y, si la escuela deja publicar al profe
 *      (decisión 3, school_settings.reports_release_by = 'coach'), «Publicar los N»
 *      en lote (BFF publish-team) con 8 s para Deshacer. Si no, se dice quién publica.
 *   3. Entrenos recientes y si quedaron evaluados, con el informe del entreno del mes.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { bffClient } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { InlineError, SectionSkeleton, EmptyNote, Pill } from '@/components/parent/v2/hijos/parts';
import { diaCorto, diaLargo, nombreMes, type RutasCoachV2 } from '../coachV2Logic';
import { useInformesDelMes, useSesionesRecientes } from '../useCoachV2Data';
import { useAccionConDeshacer } from '../useAccionConDeshacer';

interface Props {
  schoolId: string;
  teamId: string;
  equipo: string;
  hoy: Date;
  rutas: RutasCoachV2;
}

export function EvaluarTab({ schoolId, teamId, equipo, hoy, rutas }: Props) {
  const sesiones = useSesionesRecientes([teamId], hoy, 14);
  const year = hoy.getFullYear();
  const month = hoy.getMonth() + 1;
  const informes = useInformesDelMes(schoolId, year, month);
  const qc = useQueryClient();
  const { programar } = useAccionConDeshacer();
  const [publicando, setPublicando] = useState(false);

  const cerradas = (sesiones.data ?? []).filter((s) => s.cerrada);
  const sinEvaluar = cerradas.filter((s) => !s.evaluada);
  const inf = informes.data?.equipos.find((e) => e.teamId === teamId) ?? null;
  const puedePublicar = !!informes.data?.puedePublicar;

  const publicar = () => {
    if (!inf || inf.listos <= 0) return;
    const n = inf.listos;
    setPublicando(true);
    programar(
      `publicar:${teamId}:${year}-${month}`,
      `Vas a publicar ${n} informes. Les llegan a las familias en unos segundos.`,
      async () => {
        try {
          const r = await bffClient.post<{ results: { resultado: string; detalle: string | null }[] }>(
            '/api/v1/school/reports/publish-team',
            { year, month, team_id: teamId },
          );
          const resultados = r?.results ?? [];
          const errores = resultados.filter((x) => x.resultado === 'error');
          const publicados = resultados.length ? resultados.length - errores.length : n;
          if (errores.length) console.error('[informes] publish-team con errores', errores);
          // El aviso de éxito sale solo cuando el servidor confirmó.
          if (publicados > 0) toast.success(`Publicamos ${publicados} ${publicados === 1 ? 'informe' : 'informes'}. Las familias ya pueden verlos.`);
          if (errores.length) {
            toast.error(`${errores.length === 1 ? '1 informe no se publicó' : `${errores.length} informes no se publicaron`}. Revisa que tengan la nota del equipo e inténtalo de nuevo.`);
          }
        } catch (e) {
          console.error('[informes] publish-team', e);
          toast.error('No pudimos publicar los informes. Revisa tu conexión e inténtalo de nuevo.');
        } finally {
          setPublicando(false);
          qc.invalidateQueries({ queryKey: ['coach-v2', 'informes'] });
        }
      },
      () => setPublicando(false),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {sesiones.isLoading ? (
        <SectionSkeleton rows={2} label="Cargando entrenos" />
      ) : sesiones.isError ? (
        <InlineError message="No pudimos traer los entrenos recientes." onRetry={() => sesiones.refetch()} />
      ) : (
        sinEvaluar.slice(0, 3).map((s) => (
          <Link
            key={s.id}
            to={rutas.evaluar(s.id)}
            className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-foreground active:scale-[0.97] motion-reduce:active:scale-100 dark:border-amber-800 dark:bg-amber-950/30"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-semibold">Entreno {diaCorto(s.fecha, hoy) === 'hoy' ? 'de hoy' : diaCorto(s.fecha, hoy) === 'ayer' ? 'de ayer' : `del ${diaCorto(s.fecha, hoy)}`} sin evaluar</span>
              <span className="text-xs text-muted-foreground">Solo los que vinieron · 1 minuto</span>
            </span>
            <span className="flex h-touch items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background">Evaluar</span>
          </Link>
        ))
      )}

      <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4" aria-label="Informe mensual">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Informe de {nombreMes(month)}</h3>
          {inf && <span className="text-xs text-muted-foreground">{inf.publicados} de {inf.total} publicados</span>}
        </div>
        {informes.isLoading ? (
          <SectionSkeleton rows={1} label="Cargando el informe del mes" />
        ) : informes.isError ? (
          <InlineError message="No pudimos traer el informe del mes." onRetry={() => informes.refetch()} />
        ) : !inf || inf.total === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay informes de {nombreMes(month)} para {equipo}. La escuela los genera a fin de mes.</p>
        ) : (
          <>
            <Progress value={inf.total ? ((inf.publicados + inf.listos) / inf.total) * 100 : 0} className="h-2.5" aria-label="Avance del informe" />
            <p className="text-sm text-muted-foreground">
              {inf.listos > 0 ? `${inf.listos} listos para publicar` : 'Nada listo para publicar'}
              {inf.faltanNota > 0 ? ` · ${inf.faltanNota} sin escribir` : ''}.
            </p>
            {puedePublicar && inf.listos > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="h-12 rounded-xl">
                  <Link to={rutas.informeMensual}>{inf.faltanNota > 0 ? `Completar ${inf.faltanNota}` : 'Ver informes'}</Link>
                </Button>
                <Button className="h-12 rounded-xl font-semibold" disabled={inf.listos === 0 || publicando} onClick={publicar}>
                  {publicando ? 'Publicando…' : `Publicar los ${inf.listos}`}
                </Button>
              </div>
            ) : (
              <>
                <Button asChild variant="outline" className="h-12 rounded-xl">
                  <Link to={rutas.informeMensual}>{inf.faltanNota > 0 ? 'Escribir la nota del equipo' : 'Ver informes'}</Link>
                </Button>
                {!puedePublicar && (
                  <p className="text-xs text-muted-foreground">En tu escuela publica la administración. Tú escribes la nota del equipo.</p>
                )}
              </>
            )}
          </>
        )}
      </section>

      <span className="pl-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Entrenos recientes</span>
      {sesiones.isLoading || sesiones.isError ? null : cerradas.length === 0 ? (
        <EmptyNote>No hay entrenos con lista en las últimas dos semanas.</EmptyNote>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {cerradas.slice(0, 6).map((s) => (
            <li key={s.id} className="border-t first:border-t-0">
              <Link to={rutas.evaluar(s.id)} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted/40">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base">{diaLargo(s.fecha)}</span>
                </span>
                {s.evaluada ? <Pill tone="good">Evaluado</Pill> : <Pill tone="neutral">Sin evaluar</Pill>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to={rutas.informeEntreno} className="flex min-h-touch items-center justify-between rounded-2xl border bg-card px-4 text-sm font-semibold text-primary">
        Informe del entreno para todo el equipo <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
