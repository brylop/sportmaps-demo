/**
 * Bloque de pausa dentro de la tarjeta de un hijo (lado acudiente).
 * Spec: docs/specs/pausa-vacaciones-enrollments.md §9.2
 *
 * Va por hijo y no a nivel de página porque un acudiente puede tener hijos en
 * escuelas distintas, y la pausa es opt-in POR ESCUELA: una puede tenerla
 * habilitada y la otra no. Resolverlo arriba obligaría a mezclar configs.
 *
 * Los tres estados que puede mostrar:
 *   · sin solicitud   → botón "Solicitar pausa"
 *   · pendiente       → aviso + "Retirar solicitud"
 *   · aprobada        → aviso de en qué meses no se cobra
 * Si la escuela no lo habilitó, o no permite que lo pida el acudiente, o la
 * inscripción no está activa, no se renderiza nada.
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PauseCircle } from 'lucide-react';
import {
  usePauseConfig,
  useMyPauseRequests,
  mesLegible,
  PAUSE_REASON_LABEL,
} from '@/hooks/usePauses';

interface Props {
  child: any;
  /** Inscripción activa del hijo. Si es null no hay nada que pausar. */
  enrollmentId: string | null;
  onSolicitar: (args: { child: any; enrollmentId: string; maxMonths: number }) => void;
  onRetirar: (requestId: string) => void;
  isRetiring?: boolean;
}

export function ChildPauseSection({
  child, enrollmentId, onSolicitar, onRetirar, isRetiring,
}: Props) {
  const { data: config } = usePauseConfig(enrollmentId);
  const { data: requests } = useMyPauseRequests(enrollmentId ? [enrollmentId] : []);

  // Sin inscripción activa, sin config, o escuela que no lo habilita: nada.
  if (!enrollmentId || !config?.enabled || !config?.enrollment_active) return null;

  const pendiente = (requests ?? []).find((r) => r.status === 'pending');
  const aprobada = (requests ?? []).find((r) => r.status === 'approved');

  const rango = (r: { month_from: string; month_to: string }) =>
    r.month_from === r.month_to
      ? mesLegible(r.month_from)
      : `${mesLegible(r.month_from)} a ${mesLegible(r.month_to)}`;

  if (pendiente) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/10 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold">
          <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <span>Pausa solicitada — en revisión</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pediste {PAUSE_REASON_LABEL[pendiente.reason].toLowerCase()} para {rango(pendiente)}.
          La escuela todavía no ha respondido; tus cobros siguen igual mientras tanto.
        </p>
        <Button
          variant="outline" size="sm" className="w-full h-8 text-xs"
          disabled={isRetiring}
          onClick={() => onRetirar(pendiente.id)}
        >
          {isRetiring && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Retirar solicitud
        </Button>
      </div>
    );
  }

  if (aprobada) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/10 p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold">
          <PauseCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
          <span>Pausa aprobada</span>
          <Badge variant="outline" className="text-[9px] py-0 h-4">
            {rango(aprobada)}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No se te cobrará {rango(aprobada)}. Durante la pausa no aparece en la lista de
          asistencia; vuelve el día que la escuela lo reactive.
        </p>
      </div>
    );
  }

  // La escuela habilitó la pausa pero decidió que solo la aplica la
  // administración: no se ofrece el botón, y se dice por qué en vez de callar.
  if (!config.parent_can_request) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Para pausar por vacaciones o lesión, contacta a la escuela.
      </p>
    );
  }

  return (
    <Button
      variant="outline" size="sm" className="w-full"
      onClick={() => onSolicitar({ child, enrollmentId, maxMonths: config.max_months })}
    >
      <PauseCircle className="w-4 h-4 mr-2" />
      Solicitar pausa (vacaciones / lesión)
    </Button>
  );
}
