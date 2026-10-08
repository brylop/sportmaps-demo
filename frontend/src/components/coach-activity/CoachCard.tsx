/**
 * Tarjeta de un entrenador en "Seguimiento deportivo": semáforo en palabras,
 * última actividad en lenguaje humano y los 4 números de la semana grandes.
 */
import { ChevronRight } from 'lucide-react';
import { STATUS_META, type CoachActivity, type CoachStatus } from './types';
import { lastActivityText, mesocycleSummary } from './format';

export function StatusBadge({ status }: { status: CoachStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

function BigNumber({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium leading-snug">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

export function CoachCard({ coach, onOpen }: { coach: CoachActivity; onOpen: () => void }) {
  const meso = mesocycleSummary(coach);
  const titular = coach.teams.filter((t) => t.role === 'titular');
  const adicional = coach.teams.filter((t) => t.role === 'adicional');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/30
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold leading-snug break-words">{coach.full_name}</p>
          <p className="text-xs text-muted-foreground">{lastActivityText(coach.last_activity_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={coach.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      {coach.teams.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground break-words">
          {titular.length > 0 && <>Titular: <span className="text-foreground">{titular.map((t) => t.name).join(', ')}</span></>}
          {titular.length > 0 && adicional.length > 0 && ' · '}
          {adicional.length > 0 && <>Apoya: <span className="text-foreground">{adicional.map((t) => t.name).join(', ')}</span></>}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Sin equipos asignados</p>
      )}
      {!coach.has_account && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">No tiene cuenta en la app: sus evaluaciones no se pueden atribuir.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BigNumber value={coach.sessions_planned_week} label="Sesiones planificadas" />
        <BigNumber
          value={coach.attendance_sessions_week}
          label="Listas tomadas"
          hint={coach.days_with_list > 0 ? `en ${coach.days_with_list} día${coach.days_with_list === 1 ? '' : 's'}` : undefined}
        />
        <BigNumber
          value={coach.evaluations_week.athletes}
          label="Deportistas evaluados"
          hint={coach.mesocycle_evaluations_week > 0 ? `+ ${coach.mesocycle_evaluations_week} de rúbrica` : undefined}
        />
        <BigNumber value={meso.value} label="Cumplimiento del mesociclo" hint={meso.hint} />
      </div>
    </button>
  );
}
