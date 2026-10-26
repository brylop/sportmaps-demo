// ============================================================================
// Estado de onboarding con el que el Dashboard decide si manda al asistente de
// la escuela (/onboarding/school).
//
// Había un bucle de redirecciones /dashboard ⇄ /onboarding/school (la pantalla
// «parpadeaba» cada ~0,45 s) para quien es DUEÑO de una escuela y además
// MIEMBRO de otra (p. ej. dueño de un club y acudiente en otro):
//   · El servidor (get_onboarding_status) elige la escuela por la membresía más
//     reciente y contesta con el estado de ESA escuela (p. ej. «completed»).
//   · El Dashboard, antes de que el servidor respondiera, ya usaba el respaldo
//     (la escuela que el usuario posee, p. ej. «in_progress») y redirigía al
//     asistente; el asistente leía «completed» del servidor y volvía al
//     Dashboard, que se remontaba y repetía todo.
//
// Regla: mientras el servidor no haya respondido NO se decide nada. Con su
// respuesta, manda el servidor; el respaldo solo cubre el caso en que el
// servidor no trae estado (falló o el usuario aún no tiene escuela en su vista).
// ============================================================================
export function resolveOnboardingGateStatus(args: {
  /** true mientras el Dashboard aún espera la respuesta de get_onboarding_status. */
  loading: boolean;
  /** onboarding_status que devolvió el servidor (null si no trajo). */
  serverStatus: string | null | undefined;
  /** onboarding_status de la escuela que el usuario posee (consulta directa). */
  fallbackStatus: string | null | undefined;
}): string | null {
  if (args.loading) return null;
  return args.serverStatus ?? args.fallbackStatus ?? null;
}
