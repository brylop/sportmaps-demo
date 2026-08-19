import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { EstadoFichaStaff } from '@/hooks/useCoachStaffId';

interface Props {
  estado: EstadoFichaStaff;
  onReintentar?: () => void;
  /** Qué deja de funcionar sin la ficha. Ej: "tus equipos para pasar lista". */
  queSePierde?: string;
}

/**
 * Aviso para cuando NO se pudo resolver la ficha de `school_staff` del usuario.
 *
 * Todas las pantallas de entrenador filtran su contenido por `staffId`
 * (`teams.coach_id`, `team_coaches.coach_id` y `attendance_sessions.coach_id`
 * son FK a `school_staff.id`, nunca al `auth.uid()`). Si la ficha no resuelve,
 * el filtro no matchea nada y la pantalla queda vacía — indistinguible de "no
 * tienes nada asignado". Este componente rompe esa ambigüedad.
 *
 * No renderiza nada mientras carga ni cuando la ficha resolvió bien.
 */
export function AvisoFichaStaff({ estado, onReintentar, queSePierde = 'tu contenido asignado' }: Props) {
  if (estado === 'ok' || estado === 'cargando') return null;

  const esError = estado === 'error';

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {esError ? 'No pudimos cargar tu ficha de entrenador' : 'No tienes ficha de entrenador en esta escuela'}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {esError
            ? `Hubo un problema al consultar tu ficha, así que ${queSePierde} no se puede mostrar. Lo que ves abajo está incompleto — no es que no tengas nada asignado.`
            : `Tu cuenta no está vinculada a una ficha de staff en esta escuela, así que no podemos mostrar ${queSePierde}. Pídele a la administración que te vincule.`}
        </p>
        {esError && onReintentar && (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
