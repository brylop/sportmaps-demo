# Torneos EXTERNOS — registro liviano, Excel y pago dual

**Estado:** aprobado por el usuario (alcance completo), pendiente de escribir código. 2026-09-03.
**Reemplaza el "sin implementar" de** `docs/tournaments-enrollment-flow.md` (2026-07-13) — ese doc queda como la fuente del DISEÑO de producto; este spec es el plan de EJECUCIÓN contra la base real de hoy, con el requisito de concurrencia que agregó el usuario.

## Motivo

Un anfitrión (ej. Besser) quiere invitar academias externas a un torneo. Dos casos tienen que convivir:
- **Escenario 1 — la academia NO tiene cuenta en SportMaps.** Debe poder inscribirse **solo para ese torneo**, sin volverse cliente del SaaS completo.
- **Escenario 2 — la academia YA es cliente SportMaps.** Reusa su propio roster.

Y un requisito no funcional explícito del usuario: **que no se sature ni duplique cuando muchas academias se inscriben a la vez.**

## Lo que ya existe y NO hay que tocar (verificado en la auditoría anterior + hoy)

- `POST /school-tournaments/:id/enroll` — el endpoint de inscripción de delegación YA hace `UPSERT` sobre `event_delegations` (que tiene `UNIQUE(event_id, school_id)`) — la idempotencia a nivel "una escuela no puede inscribirse dos veces al mismo torneo" **ya está resuelta a nivel de base de datos**. No es un endpoint nuevo: la academia externa, una vez que tenga SU cuenta (aunque sea liviana), usa el mismo camino que ya usaría una escuela cliente (Escenario 2).
- El pago manual por comprobante a nivel de delegación completa (`school_pays`) — construido y funcional (`record-payment`, `delegations/mine/payment`, verificación).
- Categorías/fases de precio — construido, sirve igual para interno y externo.
- Panel del anfitrión (aprobar/rechazar delegación) — construido.

**Lo que falta de verdad, y es TODO lo que hay que construir:**

1. `event_invitations` (tabla nueva) + link de invitación + página pública de aterrizaje.
2. Registro liviano de escuela (crear cuenta mínima sin el onboarding completo) — Escenario 1.
3. Carga de roster por Excel (bulk, con `dry_run`).
4. Pago **por familia individual** (`parent_pays` a nivel de integrante) — hoy `event_delegation_payments` tiene las columnas (`team_member_id`, `payer_profile_id`) pero **ningún endpoint las usa**.
5. Concurrencia/idempotencia explícita en cada punto de escritura nuevo (no solo confiar en que "ya no debería pasar").

## Diseño de concurrencia (requisito del usuario) — dónde puede doler y cómo se cierra

| Punto de escritura | Riesgo si dos requests llegan a la vez | Cierre |
|---|---|---|
| Crear invitación con token | Colisión de token | `token` generado server-side con `gen_random_uuid()`, `UNIQUE` — Postgres rechaza la colisión (probabilidad nula igual, pero el constraint es gratis) |
| Academia abre el link y crea su cuenta liviana | Dos coordinadores de la MISMA academia, casi a la vez, crean DOS escuelas separadas | **No hay backstop de base de datos posible** (son dos personas, dos intenciones legítimas de "crear cuenta"). Mitigación: antes de crear, buscar por email/teléfono de contacto ya registrado como escuela — si existe, ofrecer "¿ya tenés cuenta? iniciá sesión" en vez de crear otra. Es una ayuda de UX, no una garantía — mismo patrón de duplicados ya documentado en `project_duplicate_athlete_identities`. Se lo aviso al usuario explícitamente: esto no se resuelve 100% con base de datos, es un límite real. |
| Enroll de delegación (`event_delegations`) | Doble submit del wizard, o reintento de red | **Ya resuelto** — `UPSERT ... ON CONFLICT (event_id, school_id)`, existente. |
| Carga de Excel — insertar roster | Doble submit del mismo archivo | Cada fila del Excel se inserta con una clave natural `(delegation_id, doc_number)` — `UNIQUE` parcial nueva en `event_team_members` para que reprocesar el mismo Excel actualice en vez de duplicar. |
| Pago por familia (`parent_pays`) | Dos familias pagando al mismo tiempo, o la misma familia pagando dos veces por doble click | `UNIQUE(team_member_id)` parcial en `event_delegation_payments` sobre estados no terminales — un integrante no puede tener dos cobros pendientes a la vez, mismo patrón que `uniq_payment_active_period_per_child` pero para este contexto. |
| Muchas delegaciones inscribiéndose al mismo torneo a la vez | Ninguno especial — cada delegación es una fila independiente, no hay contador compartido que se pise (a diferencia de, ej., cupos de un QR con `scan_count`) | Si el torneo tiene `capacity` con cupo limitado de delegaciones, ahí sí hace falta `SELECT ... FOR UPDATE` sobre un contador — **a definir si el usuario quiere límite de cupo de delegaciones** (hoy `capacity` es de atletas totales, no de delegaciones). |

## Fases

**Fase 1 — DB.** Tabla `event_invitations` (event_id, token UNIQUE, invited_email NULL, invited_school_name NULL, status CHECK enviada|abierta|registrada|inscrita|pagada|aprobada, created_by, expires_at, claimed_school_id NULL). RPC `create_tournament_invitation(event_id, email?, school_name?)` (host). RPC `claim_invitation_and_create_school(token, school_name, contact_name, contact_email, contact_phone, city)` `SECURITY DEFINER` — busca escuela existente por contact_email antes de crear una nueva (mitigación de duplicados); si no existe, crea `schools` (mínima) + `profiles`/`school_members` role owner para `auth.uid()` (el caller ya se autenticó vía signup normal ANTES de llamar esta RPC — no crea el `auth.users`, solo la escuela y la membresía) + marca la invitación `registrada` con `claimed_school_id`. Índice único parcial en `event_team_members(delegation_id, document_number) WHERE document_number IS NOT NULL`. Índice único parcial en `event_delegation_payments(team_member_id) WHERE status IN (pending, approved) AND team_member_id IS NOT NULL`.

**Fase 2 — BFF.** `POST /school-tournaments/:id/invitations` (host, crea+devuelve el link). `GET /invitations/:token` (público, info del torneo + estado de la invitación). `POST /invitations/:token/claim` (requireAuth — el usuario YA se registró por el `/register` normal con `?return_to=` este flujo — llama la RPC de arriba). Bulk Excel: `POST /school-tournaments/:id/roster/dry-run` y `.../roster/commit` (reusa patrón de `bulkUpload.ts`, trazabilidad por fila). Pago individual: `POST /school-tournaments/:id/team-members/:memberId/payment` (cualquier usuario autenticado que sea `payer_profile_id` o llegue por el link de su integrante) + `PATCH .../payments/:payId` (host verifica, ya existe el patrón).

**Fase 3 — Frontend, aterrizaje público + registro liviano.** Página `/torneos-externos/invitacion/:token`: info del torneo + CTA. Si no hay sesión → al `/register` normal con `return_to` codificado. Si hay sesión sin escuela → pantalla mínima (nombre escuela, ciudad, contacto) → llama `claim`. Si ya tiene escuela (Escenario 2) → salta directo al wizard de inscripción existente.

**Fase 4 — Frontend, wizard de inscripción externa.** Categorías → roster (Excel o manual, reusa componentes de carga masiva de atletas si existen) → documentos → resumen de costo → pago (delegación completa o por familia según `payer_mode`) → envío.

**Fase 5 — Frontend, panel del anfitrión.** Gestionar invitaciones (reenviar/revocar, ver embudo por estado), y para `parent_pays` ver el estado de pago atleta por atleta (no solo el total de la delegación).

**Fase 6 — QA end-to-end.** Probar con 2+ "academias" simuladas inscribiéndose casi a la vez contra el mismo torneo de prueba, confirmar que no se duplica nada.

## Progreso

- [x] Bug cosmético previo (contador "delegación(es)" filtrándose en torneos internos) — corregido en `SchoolTournamentsPage.tsx`.
- [ ] Fase 1 — DB
- [ ] Fase 2 — BFF
- [ ] Fase 3 — Frontend aterrizaje + registro liviano
- [ ] Fase 4 — Frontend wizard de inscripción externa
- [ ] Fase 5 — Frontend panel del anfitrión
- [ ] Fase 6 — QA end-to-end (concurrencia real)
