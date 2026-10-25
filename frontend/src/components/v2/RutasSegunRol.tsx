/**
 * Rutas que comparten varios roles y que en la V2 muestran otra pantalla según
 * quién entra. Cada una respeta el interruptor de su rol: con la reversa
 * (VITE_*_V2=false) se ve la pantalla de siempre.
 *
 * El rol es el activo en la escuela (multirol) y, si no hay, el del perfil:
 * el mismo criterio del layout (pestanasDeRol) y de PerfilSegunRol.
 */
import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useRolActivo } from '@/hooks/useRolActivo';
import { ACUDIENTE_V2, DEPORTISTA_V2, ENTRENADOR_V2 } from '@/lib/feature-flags';

const ParentMorePage = lazy(() => import('@/pages/ParentMorePage'));
const AthleteMorePage = lazy(() => import('@/components/athlete/v2/AthleteMorePage'));
const AthleteTrainingV2 = lazy(() => import('@/components/athlete/v2/AthleteTrainingV2'));
const AthleteProgressV2 = lazy(() => import('@/components/athlete/v2/AthleteProgressV2'));
const AthleteCardV2 = lazy(() => import('@/components/athlete/v2/AthleteCardV2'));
const AthletePaymentsV2 = lazy(() => import('@/components/athlete/v2/AthletePaymentsV2'));

const CoachTeamsV2 = lazy(() => import('@/components/coach/v2/CoachTeamsV2'));
const CoachEvaluateV2 = lazy(() => import('@/components/coach/v2/CoachEvaluateV2'));
const CoachSessionsV2 = lazy(() => import('@/components/coach/v2/CoachSessionsV2'));
const CoachAttendanceV2 = lazy(() => import('@/components/coach/v2/CoachAttendanceV2'));
const CoachMorePage = lazy(() => import('@/components/coach/v2/CoachMorePage'));
const TrainingPlansPage = lazy(() => import('@/pages/TrainingPlansPage'));
const CoachAttendancePage = lazy(() => import('@/pages/CoachAttendancePage'));

const TrainingPage = lazy(() => import('@/pages/TrainingPage'));
const TeamsPage = lazy(() => import('@/pages/TeamsPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const MyAthleteCardsPage = lazy(() => import('@/pages/MyAthleteCardsPage'));
const AthletePaymentsPage = lazy(() => import('@/pages/AthletePaymentsPage'));


const esDeportistaV2 = (rol: string | null) => DEPORTISTA_V2 && rol === 'athlete';

/** /mas — la quinta pestaña de cada rol V2. */
export function MasSegunRol() {
  const rol = useRolActivo();
  if (ACUDIENTE_V2 && rol === 'parent') return <ParentMorePage />;
  if (esDeportistaV2(rol)) return <AthleteMorePage />;
  if (ENTRENADOR_V2 && rol === 'coach') return <CoachMorePage />;
  return <Navigate to="/dashboard" replace />;
}

/** /training — Entrenos del deportista V2; los demás, la pantalla de siempre. */
export function EntrenosSegunRol() {
  return esDeportistaV2(useRolActivo()) ? <AthleteTrainingV2 /> : <TrainingPage />;
}

/** /stats — Progreso del deportista V2. */
export function ProgresoSegunRol() {
  return esDeportistaV2(useRolActivo()) ? <AthleteProgressV2 /> : <StatsPage />;
}

/**
 * /training/todo y /stats/todo — las pantallas completas de siempre, para el
 * deportista V2: sesiones con su entrenador personal, actividad libre,
 * historial, planes propios y estadísticas por pestaña. La V2 las resume; no
 * las reemplaza (no se pierde ningún módulo).
 */
export function EntrenamientosCompletos() {
  return <TrainingPage />;
}
export function EstadisticasCompletas() {
  return <StatsPage />;
}

/** /my-cards — Carnet del deportista V2; el acudiente y los demás, la lista de carnets. */
export function CarnetSegunRol() {
  return esDeportistaV2(useRolActivo()) ? <AthleteCardV2 /> : <MyAthleteCardsPage />;
}

/** /athlete-payments — Pagos del deportista adulto V2 (el menor ve que los maneja su acudiente). */
export function PagosDeportistaSegunRol() {
  return esDeportistaV2(useRolActivo()) ? <AthletePaymentsV2 /> : <AthletePaymentsPage />;
}

const esEntrenadorV2 = (rol: string | null) => ENTRENADOR_V2 && rol === 'coach';

/** /teams — Equipos del entrenador V2 (Deportistas · Partidos y convocatorias · Evaluar). */
export function EquiposSegunRol() {
  return esEntrenadorV2(useRolActivo()) ? <CoachTeamsV2 /> : <TeamsPage />;
}

/** /coach/evaluar/:sessionId — evaluar al equipo en una pantalla (entrenador V2). */
export function EvaluarEquipoRuta() {
  const { sessionId } = useParams();
  if (!sessionId) return <Navigate to="/teams" replace />;
  return <CoachEvaluateV2 sessionId={sessionId} volverHref="/teams" />;
}

/**
 * /training-plans — Sesiones del entrenador V2 (Hoy · Semana · Plan del mes,
 * modo cancha). Crear y editar sesiones o el plan sigue en la planificación
 * completa, que vive en /training-plans/planificar.
 */
export function SesionesSegunRol() {
  return esEntrenadorV2(useRolActivo())
    ? <CoachSessionsV2 rutaPlanificacion="/training-plans/planificar" />
    : <TrainingPlansPage />;
}

/** /training-plans/planificar — la planificación completa de siempre (para todos los roles). */
export function PlanificacionCompleta() {
  return <TrainingPlansPage />;
}

/** /coach-attendance — Asistencia del entrenador V2 (lista sin señal + historial). */
export function AsistenciaSegunRol() {
  return esEntrenadorV2(useRolActivo()) ? <CoachAttendanceV2 /> : <CoachAttendancePage />;
}
