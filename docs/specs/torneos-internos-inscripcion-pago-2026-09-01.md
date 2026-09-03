# Inscripción y pago para torneos/ligas INTERNAS de una escuela

**Estado:** propuesto, pendiente de aprobación de alcance. 2026-09-01.
**Motivo:** Besser (`759eee9d-05cb-4958-b84a-2560f77e3683`) necesita armar su liga interna con inscripción y cobro funcionando de verdad para demo — en un intento anterior falló. Auditoría (turno anterior) confirmó que el bloqueo es determinístico, no intermitente.

## Causa raíz confirmada

`bff/src/routes/events.route.ts:916` — el único endpoint de inscripción a torneos (`POST /school-tournaments/:id/enroll`) rechaza siempre `tournament_scope==='internal'`:

```ts
if (ev.tournament_scope === 'internal')
  return res.status(400).json({ error: 'Un torneo interno no admite inscripción de delegaciones externas.' });
```

Es correcto que lo rechace — ese endpoint es para que OTRA escuela se inscriba como delegación. El problema es que **no existe ningún otro endpoint** para que un padre/atleta se inscriba a la liga interna de su propia escuela. Tampoco existe la pantalla: `SchoolTournamentDetailPage.tsx:299` deshabilita el tab "Inscritos" cuando `isInternal`.

## Esto ya estaba decidido, nunca se construyó

`docs/tournaments-enrollment-flow.md:70` (decisiones cerradas 2026-07-13):

> **Torneos internos de la escuela:** por defecto `parent_pays` **hacia la propia escuela** → reusa el cobro escuela→familia existente (`payments`/recurring), **no marketplace**.

O sea: el cobro de una liga interna **no** debe pasar por `event_delegation_payments` (esa tabla es para escuela-vs-escuela, con 0 filas usadas nunca en producción). Debe pasar por la misma tabla `payments` que ya cobra mensualidades y matrícula, con el mismo patrón de checkout (`PaymentCheckoutModal.tsx`) o registro manual (`RegisterCashPaymentModal.tsx`).

## Hallazgos que acotan el alcance

1. **`event_teams`/`event_team_members` exigen ≥2 equipos por categoría para generar fixtures** (`events.route.ts:1078`), y ese esquema está diseñado para competencias de porras/danza (`kit_type`, `accommodation`, `routine_max_seconds`) — no encaja natural con una liga de fútbol de una sola escuela. Formar "equipos" a partir de inscripciones individuales es una decisión de producto aparte (¿al azar? ¿las arma el coach?) que no estaba pedida.
2. **8 de las 9 tablas del módulo no tienen `CREATE TABLE` en el repo** (deriva sin versionar, confirmado por grep + drift-check en vivo) — antes de tocarlas hay que versionarlas con una migración baseline, por la regla de migraciones inmutables del repo.
3. `event_registrations` (la tabla pensada para inscripción individual, ver decisión D1) tiene un bug real y separado: el endpoint genérico `POST /:id/register` (torneos de organizador externo, no de escuela) escribe en columnas `category_id`/`package_choice` que **no existen** en la tabla — 500 garantizado. No lo toco en este plan (es otro subsistema), pero no debo copiar ese endpoint como plantilla.
4. Ninguna tabla del módulo tiene hoy una policy RLS para "esto es mi propio hijo/soy yo" — todo el RLS existente es dueño-de-escuela o dueño-del-evento. Necesita una RPC `SECURITY DEFINER` (mismo patrón que `submit_qr_signup`/`claim_orphan_children`), no policies sueltas.

## Decisión del usuario (2026-09-01) — alcance COMPLETO, no MVP reducido

Confirmado: entra inscripción + pago + que la escuela arme equipos + partidos/resultados + compartir resultados por correo y WhatsApp + entrada al padre por tarjeta en Dashboard + push + correo. Construido **genérico** (no hay nada específico de Besser ni de fútbol en el diseño) para poder ofrecerlo después a otros deportes/escuelas.

Cómo se resuelve el hueco de "equipos" (hallazgo 1 de arriba) sin inventar un modelo nuevo: **inscripción individual primero, la escuela arma los equipos después.** El padre se inscribe a una categoría (sin elegir equipo). Cuando el cupo/plazo cierra, la escuela usa una pantalla nueva para repartir a los inscritos pagados en N equipos de esa categoría (ej. "Equipo Rojo"/"Equipo Azul") — eso llena `event_teams`/`event_team_members` con `child_id`/`profile_id` reales, y a partir de ahí **se reusan tal cual** `generate-fixtures`, `matches` y `standings` (ya construidos y ya probados para el caso externo — cero cambios de backend ahí).

## Fases (una PR/rama por fase, revisión antes de pasar a la siguiente)

**Fase 1 — Base de datos.** `CREATE TABLE IF NOT EXISTS` baseline para las 8 tablas drift + baseline de las 10 columnas drift de `event_registrations` (cierra la deriva sin cambiar nada vivo, todo `IF NOT EXISTS`/idempotente). RPC `register_for_internal_tournament(p_event_id, p_category_id, p_child_id uuid DEFAULT NULL)` `SECURITY DEFINER` (mismo patrón que `submit_qr_signup`): valida escuela/scope='internal'/registrations_open, valida que `p_child_id` sea hijo del que llama (o que el rol sea `athlete` inscribiéndose a sí mismo), inserta en `event_registrations` con las columnas reales, crea el `payments` pendiente (`concept='Inscripción torneo — <título> — <categoría>'`, sin pasar por `event_delegation_payments`, por la decisión ya citada). RPC `assign_registrants_to_teams(p_event_id, p_category_id, p_assignments jsonb)` (llamada solo por school/school_admin vía BFF) que crea/actualiza `event_teams` + `event_team_members` desde los `event_registrations` pagados/aprobados de esa categoría. Policy SELECT nueva en `event_registrations` para "mi propio hijo o yo mismo". Agregar `'tournament'` al CHECK de `notifications.category` (hoy cerrado a 10 valores sin este, migración chica aparte del mismo tipo que la de soporte).

**Fase 2 — BFF.** Endpoints de registro/pago (`POST .../register`, `GET .../my-registration`), listado de inscritos individuales para la escuela (reemplaza la vista de delegaciones cuando `isInternal`), endpoint de armado de equipos, hook de notificación (reusa el Despachador Unificado ya construido — un `INSERT` en `notifications`, igual que hace `support.routes.ts`) disparado en: publicación del torneo (a todos los padres/atletas de la escuela), equipo asignado, resultado de partido cargado. Endpoint público de solo lectura para resultados/standings (mismo patrón que `/event/:slug` público) para que el link de "compartir" no exija login.

**Fase 3 — Frontend, lado padre.** Tarjeta en el Dashboard (torneos internos abiertos de su escuela), página de inscripción + pago (reusa `PaymentCheckoutModal.tsx` tal cual), vista de "mi equipo y mis partidos", botón "Compartir" en resultados con dos acciones: `wa.me/?text=` (deep link, sin integración nueva de WhatsApp) y "enviar por correo" (reusa Resend, ya integrado).

**Fase 4 — Frontend, lado escuela.** Habilitar el tab "Inscritos" para `isInternal` (tabla de inscripciones individuales, no delegaciones). Pantalla nueva "Armar equipos" (arrastrar/asignar inscritos pagados a N equipos por categoría). El tab "Resultados" ya debería funcionar sin cambios una vez `event_teams` tenga filas (los endpoints de fixtures/matches/standings no distinguen internal/external hoy).

**Fase 5 — Notificaciones + QA end-to-end.** Conectar los tres disparadores de notificación (publicación/equipo asignado/resultado) de punta a punta, probar el flujo completo en una escuela de prueba (Escuela Demo SportMaps) primero, y recién confirmado el happy path activar el addon `tournaments` en Besser y repetir con sus datos reales.

## Progreso

- [x] Fase 1 — DB (aplicada y verificada en vivo 2026-09-02: RPCs, columnas, índice único, policy RLS y notifications.category confirmados en la base)
- [x] Fase 2 — BFF (bff/src/routes/events.route.ts: for-participant, register, individual-registrations, assign-teams, public-results + 3 hooks de notificación; tsc limpio 2026-09-02)
- [x] Fase 3 — Frontend padre (TournamentRegisterPage, TournamentResultsPage, OpenTournamentsCard en Dashboard; tsc limpio frontend+bff 2026-09-02 — falta probar en navegador, no hay dev server corrido)
- [x] Fase 4 — Frontend escuela (tab "Inscritos" habilitado para interno con vista de inscripciones individuales + armado de equipos por categoría en `SchoolTournamentDetailPage.tsx`; tsc limpio 2026-09-02 — falta probar en navegador)
- [ ] Fase 5 — Notificaciones + QA
