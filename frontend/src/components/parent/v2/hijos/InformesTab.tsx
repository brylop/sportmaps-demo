import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Trophy, Users } from 'lucide-react';
import { useChildReports } from './useHijosData';
import { MESES, currentTeam, firstName, type Hijo } from './hijosUtils';
import { EmptyNote, InlineError, Pill, Section, SectionSkeleton } from './parts';

function LinkRow({ to, icon, title, sub, badge }: { to: string; icon: ReactNode; title: string; sub?: string; badge?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-touch items-center gap-3 border-t px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {badge}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export function InformesTab({ hijo }: { hijo: Hijo }) {
  const { data: reports, isLoading, isError, refetch } = useChildReports(hijo.id);
  const team = currentTeam(hijo);
  const coach = team?.coach?.full_name?.trim();
  const deProfe = coach ? `De profe ${firstName(coach)}` : 'De la escuela';
  const nombre = firstName(hijo.full_name);

  const [latest, ...older] = reports ?? [];
  const monthName = (m: number) => MESES[m - 1] ?? '';

  return (
    <div className="space-y-4">
      {isLoading ? (
        <SectionSkeleton rows={2} label="Cargando los informes" />
      ) : isError ? (
        <InlineError message="No pudimos cargar los informes mensuales." onRetry={() => refetch()} />
      ) : !latest ? (
        <EmptyNote icon={<FileText className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no hay informes mensuales de {nombre}.</p>
          <p className="mt-1">Cuando el profe publique el informe del mes, aparecerá aquí.</p>
        </EmptyNote>
      ) : (
        <Link
          to={`/children/${hijo.id}/reports/${latest.id}`}
          className="flex min-h-touch items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              Informe de {monthName(latest.period_month)} {latest.period_year}
            </span>
            <span className="block text-xs text-muted-foreground">
              {deProfe}
              {!latest.viewed_at && ' · nuevo'}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-primary">Abrir</span>
        </Link>
      )}

      <Section>
        {team && (
          <LinkRow
            to={`/children/${hijo.id}/post-entreno-informe`}
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            title="Lo que trabajó el equipo"
            sub={`Informe del entreno · ${team.name}`}
          />
        )}
        {older.slice(0, 4).map((r) => (
          <LinkRow
            key={r.id}
            to={`/children/${hijo.id}/reports/${r.id}`}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            title={`Informe de ${monthName(r.period_month)} ${r.period_year}`}
            sub={deProfe}
            badge={!r.viewed_at ? <Pill tone="info">Nuevo</Pill> : undefined}
          />
        ))}
        <LinkRow
          to={`/children/${hijo.id}/partidos`}
          icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
          title="Informes de partidos"
          sub={`Cómo le fue a ${nombre} en los partidos`}
        />
        {(reports?.length ?? 0) > 1 && (
          <LinkRow
            to={`/children/${hijo.id}/reports`}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            title="Todos los informes mensuales"
            sub={`${reports!.length} publicados`}
          />
        )}
      </Section>
    </div>
  );
}
