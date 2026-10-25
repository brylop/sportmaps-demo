/**
 * Todos los informes mensuales de un hijo — acudiente V2.
 * Misma fuente que la pestaña Informes (athlete_reports publicados).
 */
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { useAthleteReports } from '@/hooks/useAthleteReports';
import { firstName } from '@/components/parent/v2/hijos/hijosUtils';
import { EmptyNote, InlineError, Pill, Section, SectionSkeleton } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, PaginaHijo, VolverLegado } from '@/components/parent/hijo-detalle/HijoDetalle';
import { useHijoBasico } from '@/components/parent/hijo-detalle/useHijoDetalle';
import { plural, reportTitle } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

export default function ChildReportsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: child } = useHijoBasico(id);
  const { data: reports, isLoading, isError, refetch } = useAthleteReports('child', id);
  const nombre = child?.full_name ? firstName(child.full_name) : null;

  return (
    <PaginaHijo>
      <VolverLegado to="/children" label="Volver a Hijos" />
      <CabeceraHijo
        titulo={nombre ? `Informes de ${nombre}` : 'Informes mensuales'}
        sub={reports && reports.length > 0 ? `${plural(reports.length, 'informe publicado', 'informes publicados')} por la escuela.` : 'El resumen que el profe publica cada mes.'}
      />

      {isLoading ? (
        <SectionSkeleton rows={3} label="Cargando los informes" />
      ) : isError ? (
        <InlineError message="No pudimos cargar los informes mensuales. Revisa tu conexión e intenta de nuevo." onRetry={() => refetch()} />
      ) : !reports || reports.length === 0 ? (
        <EmptyNote icon={<FileText className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no hay informes mensuales{nombre ? ` de ${nombre}` : ''}.</p>
          <p className="mt-1">Cuando el profe publique el informe del mes, aparecerá aquí.</p>
        </EmptyNote>
      ) : (
        <Section>
          {reports.map((r) => (
            <Link
              key={r.id}
              to={`/children/${id}/reports/${r.id}`}
              className="flex min-h-touch items-center gap-3 border-t px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{reportTitle(r.period_month, r.period_year)}</span>
              {r.viewed_at ? <span className="text-xs text-muted-foreground">Visto</span> : <Pill tone="info">Nuevo</Pill>}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </Section>
      )}
    </PaginaHijo>
  );
}
