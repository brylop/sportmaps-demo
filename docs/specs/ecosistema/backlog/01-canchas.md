# Backlog 01 — SportMaps Canchas (F1–F6)

> Frente: **SportMaps Canchas** · Versión final con las correcciones del revisor aplicadas · 14-oct-2026
> Fuentes: `docs/plan-maestro-ecosistema-2026-10.md`, `docs/plan-agresivo-canchas-2026-10.md`,
> `docs/specs/reservas-canchas-plan-unificado-2026-10.md`, `docs/specs/reservas-canchas-f0-plan-migraciones.md`,
> `docs/specs/ecosistema/roles-*.md`, `docs/ROADMAP.md`.
>
> **Este backlog reemplaza el track de reservas del ROADMAP** (`BLQ-1`, `CONC-4`, `CAR-3` en lo que toca a reservas, `CAR-6`)
> y la memoria `project_reservations_module`. No se abre un track paralelo: la tarea CAN-P0-07 reescribe esas entradas para que apunten a `CAN-*`.

---

## 1. Resumen y estado actual verificado

La base de Canchas (F0) está aplicada y commiteada en `be1a51c4`, con cuatro migraciones del 14-oct: la guarda de seguridad M0, el rol
`facility_manager`, `facility_occupancy` con `EXCLUDE`, `guest_bookers`, columnas y estados nuevos en `facility_reservations`,
`payment_category 'reserva'`, `expirar_holds()` (sin programar) y el gating por el addon `reservations`.

**Encima de la base no hay nada construido.** Faltan las RPCs de disponibilidad, reserva, pago, cancelación y reprogramación. El BFF no tiene
`Idempotency-Key`, `requireEntitlement` ni el prefijo `RSV`. Tampoco existen las rutas `/reservar/:slug` ni `/r/:token`, la agenda en grilla
ni el flujo `reserva` del bot. El rol `facility_manager` no aparece en ningún archivo del frontend ni del BFF.

Hay **tres trampas técnicas** que bloquean F1 y que este backlog resuelve antes de escribir RPCs:

1. **La guarda M0 se dispara dentro de las RPCs `SECURITY DEFINER`** cuando las llama un usuario autenticado: `auth.uid()` no es nulo y
   `pg_trigger_depth()` vale 1. Le pasa al INSERT (la reserva nace `pending` y con el precio recalculado) y también al UPDATE de
   confirmar, cancelar y reprogramar («solo puedes cancelar tu reserva», línea 90). La guarda gemela de `reservation_payments`
   (línea 120 en adelante) tiene el mismo problema. Al invitado no lo afecta porque entra por el BFF con `service_role`. → CAN-P1-01.
2. **Un venue nunca pierde las reservas:** `has_entitlement('reservations')` devuelve true para `school_type = 'venue'` sin mirar el addon
   (`20261014153542:59`). Por eso un `trial_ends_at` en el addon sería decorativo. → CAN-P0-09 y CAN-P1-03.
3. **`hour_bank_reservations` no tiene cancha ni franja**: solo tiene `reservation_date` y `minutes` (ROADMAP MOD-21 D-11), y MOD-35 sigue abierto.
   El banco de horas **no** escribe ocupación en F1 y las tiqueteras no se apoyan en él. → CAN-P1-07 y CAN-P4-04.

**Oferta comercial (cerrada por el dueño):** queda **una sola**, el **piloto gratis por un mes**. Desaparece «3 meses Pro gratis a los primeros 50»
de la landing, del kit de marketing y de la app.

### Estado por capacidad

| Capacidad | Estado | Evidencia |
|---|---|---|
| Guarda de seguridad M0 (el cliente no edita precio ni estado, anon queda fuera, I3 cerrado) | Funciona, **pero bloquea las RPCs de jugador** | `supabase/migrations/20261014152937_reservas_guarda_seguridad_m0.sql:47-48, 61-96, 120-150`; el commit `be1a51c4` dice que se verificó en vivo |
| Ocupación única con `EXCLUDE` (cero dobles reservas) | Parcial | `20261014153538` crea `facility_occupancy` con EXCLUDE gist, pero ninguna RPC, clase ni torneo escribe en ella. Siguen vivos el índice `facility_reservations_unique_active_slot` y el trigger `fn_check_facility_reservation_overlap`. **El cuerpo de la función no está versionado**, aunque sí hay un `ALTER FUNCTION` en `20260831095348:76` y está documentada en `20260828232516:11`. Según MOD-29, protege las reservas manuales del owner |
| Columnas nuevas de `facility_reservations` (starts_at/ends_at, hold, idempotency_key, channel, guest_booker_id, payment_id, price_snapshot, recurrence_id) y estados nuevos | Parcial | `20261014153538` las agrega con backfill; ningún código las usa |
| Lectores viejos | **Riesgo** | `useFacilityReservations.ts:413` (`getBookedSlots`, `.in('status',['pending','confirmed'])`) y `AttendanceSupervisionPage.tsx:331/471` (`.eq('status','confirmed')`) no ven `hold`, así que mostrarán como libres franjas que ya están apartadas |
| `guest_bookers` (reserva sin cuenta) | Parcial | La tabla existe con RLS y sin grants. No hay OTP por WhatsApp: `public-booking.routes.ts` solo manda OTP por correo para las clases de cortesía |
| Gating por addon `reservations` | Funciona en la base y el BFF; **el menú no lo usa** | `20261014153542`. `me.routes.ts:33-48` devuelve el valor de `v_school_entitlements` (la línea 63 es solo el fallback fail-closed cuando no hay fila). En el frontend solo lo consumen `AdminSubscriptionsPage.tsx:904` y un comentario en `SchoolSetupPage.tsx:124` (ROADMAP CAR-3) |
| `schools.school_type = 'venue'` | Funciona | `20261014153542:38-44` ya agrega el CHECK con los 9 valores vivos más `venue`; `crear_venue` no tiene que volver a crearlo (se confirma por nombre en CAN-P0-01) |
| Gating de venue | **Trampa** | `has_entitlement` le da reservas a `school_type='venue'` sin addon (`20261014153542:10, 55-63`) |
| Rol `facility_manager` | Parcial | Enum en `20261014153533`. 0 apariciones en `frontend/src` y `bff/src`: no está en `RegisterPage.tsx:33 INSTITUTION_ROLES`, `DashboardRouter`, `ProtectedRoute` ni `navigation.ts` |
| RPCs `disponibilidad_canchas` / `reservar_cancha` / `confirmar_pago_reserva` / `cancelar_reserva` / `reprogramar_reserva` | No existe | Sin resultados en `supabase/migrations` ni en `bff/src` |
| `submit_facility_booking(_v2)` | **Puerta viva** | No las llama nadie en el frontend ni en el BFF, pero siguen vivas con `search_path=public` (plan F0 §1, líneas 26 y 179). Si M7 no las revoca, saltan las RPCs nuevas |
| Patrones reutilizables | Existe | `public_booking_confirm_reservation` y `session_booking_reschedule` (RPC atómica con advisory lock, MOD-29/SEG-20); cancelar y reprogramar con correo en `reservations-admin.routes.ts` |
| `expirar_holds` programado | Parcial | La función existe (M6) y no tiene `cron.schedule` |
| Revocar la escritura directa (M7) | Solo en spec | Con JWT de usuario escriben `useFacilityReservations.ts:215/264` y `FacilityReservationModal.tsx:97`. Con `service_role` escriben `reservations-admin.routes.ts:89/140` (update) y `:406` (delete) y `session-bookings.ts:2427/2562`; M7 no los rompe. `OwnerReservationModal.tsx` **no** escribe en la tabla |
| Doble tabla de pagos | **Por decidir** | Se cobrará en `payments` (`payment_category 'reserva'`), pero sigue viva `reservation_payments` con el trigger `sync_reservation_payment_status` y su guarda M0 |
| Agregaciones de ingreso | No incluye `reserva` | Las tres rutas (`cash_ledger`, kpis, `useDashboardStatsReal`) y el censo de los 13 caminos que crean `payments` no contemplan `reserva` |
| BFF `Idempotency-Key` + `requireEntitlement` | No existe | `bff/src/middlewares/` no tiene ninguno; solo `mercadopago.service.ts` manda `X-Idempotency-Key` |
| Pagos RSV Wompi/MP | No existe | `wompi.service.ts:117` prefixMap sin RSV y `routes/wompi.ts:278-284` HANDLERS sin RSV. Se pueden reutilizar `wompi-link-con-monto.service.ts`, `payment-provider.resolver.ts` y `webhook-events.service.ts` |
| Transferencia + comprobante OCR | Parcial | `ocr.service.ts` y `receipt-verdict.ts` funcionan para mensualidades, sin conexión con reservas |
| `/reservar/:slug` y `/r/:token` | No existe | `App.tsx:353` solo tiene `/agendar/:slug`, que es para clases de cortesía |
| Agenda en grilla | No existe | `SchoolFacilitiesPage.tsx:481-631` muestra pestañas con listas |
| Onboarding «Club / Canchas» + toggle híbrido | No existe | `RegisterPage.tsx` y `SchoolSetupPage.tsx` no ofrecen venue |
| Bot: flujo `reserva` | No existe | `whatsapp_conversation_flows_flow_check` (`20261007095911:293`) solo admite `factura_electronica` y `venta` |
| Pago dividido, reglas por segmento, waitlist, no-show, adicionales, caja, reportes | Solo en spec | Plan unificado §2.3.1–2.3.5 |
| Planes de Canchas en la app | No existe | `saas-plans.ts` no los tiene, y otra sesión lo está editando |
| Landing `/canchas` | Parcial: se presenta como **prelanzamiento** | `Canchas.tsx:59` LAUNCH_LABEL «Lanzamiento: noviembre 2026» y una FAQ en la línea 227. El problema es que ofrece como plan vendible funciones sin fecha y que **«3 meses Pro gratis a los primeros 50» aparece en 8 lugares** (62, 227, 262, 283, 309, 350, 483, 581-593) |
| `mapData.ts` | Datos inventados | `courts` (líneas 304-451) trae **10 canchas ficticias** con teléfonos y direcciones inventados. `academies`, `trainers` y `events` siguen el mismo patrón, y `allMapLocations`/`mapStats` (1056-1089) los suman |

---

## 2. Fases

**Reglas que valen para todas las fases** (CLAUDE.md del repo):

- Las migraciones son inmutables. Las nuevas se crean con `npm run migrations:new -- <slug>` y se commitean junto al ledger. **Una sola sesión aplica migraciones**, siempre por CLI. `gen types` se corre una vez al final de cada lote. No se usan `list_tables` ni `get_advisors` como sondeo.
- Toda creación de varias filas va en una RPC transaccional `SECURITY DEFINER` con `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE` explícito y `REVOKE` explícito a `anon` y `authenticated` cuando corresponda. Los estados se modelan con `text + CHECK`. Las policies no se consultan a sí mismas.
- Para escribir: `user_staff_school_ids()`. Para lo que otorga permisos (tarifas, políticas, roles): `user_admin_school_ids()`. **`user_school_ids()` nunca se usa para escribir.**
- Cada feature es full-stack (DB + RLS + RPC + BFF + frontend + QA), con una rama por fase y revisión entre fases. **No se escribe SQL hasta que el dueño apruebe el plan de migraciones.**
- Los jobs no tienen N+1 (leen en lote con `.in()`) y son idempotentes entre los 3 BFF.
- Se commitea solo lo propio, con índice temporal: otras sesiones están editando `migrations_ledger.json`, `saas-plans.ts` y la landing.
- Commit no es deploy: cada fase cierra con el deploy de los 3 BFF y un smoke del chunk o de la ruta viva. Los pushes se agrupan por el cupo de Vercel.
- **La mora y los bloqueos por deuda nunca tocan inscripciones ni accesos de la academia.** No se cobra comisión al jugador. Los recargos solo existen si los configura el club.

### P0 — Arranque y desbloqueo

**Objetivo:** dejar resuelto todo lo que bloquea F1 sin tocar todavía la base. Esto incluye las decisiones de modelo, el plan de migraciones aprobado, F0 reverificada, los middlewares, el club piloto, la landing honesta, el ROADMAP consolidado y las plantillas de Meta solicitadas.
**Semanas:** semana 1 (15–21 oct) · hito H1.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P0-01 | Reverificar F0 en vivo y documentar la definición viva del trigger y el índice viejos | db | `docs/specs/reservas-canchas-f0-plan-migraciones.md` | No | — | Se hace en una sola sesión, con consultas filtradas por nombre (`pg_proc`, `pg_constraint`, `pg_indexes`, `pg_policies`). En `BEGIN…ROLLBACK`, dos ocupaciones solapadas dan 23P01 y las franjas 8–9 y 9–10 pasan. Con `set local role anon`, `facility_occupancy`, `guest_bookers` y `facility_reservations` dan error de permiso. Queda copiado el cuerpo vivo de `fn_check_facility_reservation_overlap` y de `facility_reservations_unique_active_slot`, con referencia a `20260831095348:76` y `20260828232516:11`. Se confirma qué ve `has_entitlement` para un venue. `npm run seguridad:invariantes` sale sin CRÍTICAS | S |
| CAN-P0-02 | ADR de modelo previo a F1 | db | `docs/specs/reservas-canchas-f1-adr.md` | No | CAN-P0-01 | El documento cierra cinco puntos. (a) **Tabla de pagos que manda**: `payments` con `payment_category 'reserva'`, con plan de deprecación de `reservation_payments` y de su trigger `sync_reservation_payment_status` (o la razón para conservarla). (b) **Gating del venue**: el venue depende del addon (se cambia la rama `venue` de `has_entitlement`) o el tier y el trial viven en `school_subscriptions`. Al vencer el piloto se **degrada a Gratis** y nunca se bloquea. (c) **Rol del dueño en `school_members`**: `'owner'` con `profiles.role = facility_manager`, para no quedar fuera de `user_admin_school_ids()` ni de las RPCs que filtran `sm.role IN ('owner','admin')` (`20261014113038:421,649`). (d) Destino de `submit_facility_booking(_v2)`: revocar o borrar en M16. (e) Dónde se hace cumplir el tope de canchas del tier: al activar `rental_enabled` o al crear la facility, **no** al reservar. El dueño lo aprueba | M |
| CAN-P0-03 | Plan de migraciones F1 para aprobación (sin SQL) | db | `docs/specs/reservas-canchas-f1-plan-migraciones.md` | No | CAN-P0-02 | Lista en orden M8–M16: la guarda para RPCs, las tablas de soporte, el tope del tier y el gating del venue, disponibilidad, reservar, ciclo de vida, ocupación de clases y retiro del trigger e índice viejos (sin banco de horas), cron, y M7 con `submit_facility_booking`. Cada migración trae su radio, su verificación y sus policies línea por línea. El dueño lo aprueba antes de la primera línea de SQL | M |
| CAN-P0-04 | Middlewares `requireIdempotencyKey` y `requireEntitlement` | bff | `bff/src/middlewares/requireIdempotencyKey.ts`, `requireEntitlement.ts` y sus `.test.ts` | No | — | Un POST sin header responde 400 `IDEMPOTENCY_KEY_REQUIRED` y una key que no es UUID ni wamid también responde 400. `requireEntitlement('reservations')` lee `v_school_entitlements` una sola vez por request y responde 403 `ENTITLEMENT_REQUIRED`. Los tests de vitest pasan | S |
| CAN-P0-05 | Conseguir el club piloto (cancha sintética, D12) con acuerdo de piloto gratis 1 mes | ventas | `docs/marketing/canchas/08-prospeccion.md`, `06-ventas-whatsapp.md` | No | — | Queda registrado un club con nombre, ciudad, número de canchas, si tiene Wompi propio y un contacto. El acuerdo escrito dice: **1 mes gratis de Canchas Pro**, sin cobro automático al terminar, a cambio de video y caso de estudio. Arranque objetivo: 6-nov | M |
| CAN-P0-06 | Landing `/canchas` honesta con una sola oferta | landing | Landing `frontend/src/pages/Canchas.tsx` y `frontend/src/data/mapData.ts` | No | frente:landing-honesta | **Se reemplazan las 8 menciones** de «3 meses / primeros 50» (62, 227, 262, 283, 309, 350, 483, 581-593) por «Piloto gratis por un mes», incluidos el mensaje prellenado de WhatsApp (62) y la meta description (283). Cada función queda marcada como «disponible» o «próximamente (fecha)»; bot, pago dividido, combinadas y reglas de socio van como próximamente. **Se vacía `courts` completo (304-451)** y se revisan `academies`, `trainers`, `events`, `allMapLocations` y `mapStats` (1056-1089). Se coordina con la sesión que edita la landing y se commitean **solo esos dos archivos** con índice temporal | S |
| CAN-P0-07 | Consolidar el ROADMAP y la memoria en este backlog | docs | `docs/ROADMAP.md`, memoria `project_reservations_module` | No | CAN-P0-03 | `BLQ-1` apunta a CAN-P0…P5 como su desglose. `CONC-4` se cierra contra CAN-P1-05 y CAN-P1-08. `CAR-6` se cierra contra CAN-P3-01. `CAR-3` queda como prerrequisito de CAN-P2-05. `MOD-35` y `MOD-29` quedan referenciados. Hay un solo roadmap de reservas | XS |
| CAN-P0-08 | Contrato de API de Canchas (OpenAPI) | bff | `docs/api/openapi.yaml` | No | CAN-P0-03 | Incluye `/api/v1/canchas/*` y `/api/v1/public/canchas/*` con esquemas, `409 SLOT_TAKEN` con `alternatives[3]`, `400 IDEMPOTENCY_KEY_REQUIRED`, `403 ENTITLEMENT_REQUIRED` y los estados del comprobante | S |
| CAN-P0-09 | Kit de marketing alineado a la oferta única | ventas | `docs/marketing/canchas/*` | No | — | No queda ninguna mención de «primeros 50» ni de «3 meses» (lo verifica un grep). Los guiones de WhatsApp ofrecen el piloto gratis de 1 mes | XS |
| CAN-P0-11 | Pasarela real del club piloto (quién conecta Wompi o MP) | ventas | `docs/pilotos/canchas-club-piloto.md` | No | CAN-P0-05 | Queda escrito quién conecta la pasarela del club (Connected Accounts, ~85 %) y con qué credenciales **propias del club**, nunca las MP de dev (son de producción). Se confirma si el club tiene Wompi con webhook o si arranca solo con transferencia y comprobante. El plazo se cuenta desde la fecha del acuerdo | S |
| CAN-P0-10 | Pedir a Meta las plantillas de OTP y de recordatorio de reserva | bot | `docs/specs/reservas-canchas-plan-unificado-2026-10.md` (D16) | No | — | Se envían la plantilla de autenticación (OTP de 6 dígitos) y las de confirmación y recordatorio en la cuenta que decida D16, y su estado queda registrado. Plan B documentado: OTP por correo (Resend) | XS |

### P1 — Motor de reservas F1

**Objetivo:** que la base y las RPCs sean el único punto de escritura, con pruebas de concurrencia en el gemelo local. Incluye los endpoints del BFF y la migración de escritores y lectores viejos para poder hacer M7.
**Semanas:** semana 2 (22–28 oct).

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P1-01 | M8: la guarda M0 deja pasar las escrituras de las RPCs | db | `supabase/migrations/<ts>_reservas_f1_guarda_rpc.sql`, ledger | Sí | CAN-P0-03 | Se decide primero si **todas** las escrituras van por el BFF con `service_role` (la guarda ya pasa porque `auth.uid()` es nulo) o si también hay RPCs llamadas con JWT de usuario (staff o jugador logueado, bot, jobs con otro rol); el GUC cubre ese segundo caso. La bypass usa un **GUC local** (`set_config('sportmaps.rpc_reservas','on',true)`) que fijan solo las RPCs nuevas. **No** se usa `current_user`, porque abriría la guarda a cualquier función definer. Cubre INSERT y UPDATE (confirmar, reprogramar, no_show y cancelar desde una RPC de jugador) y la guarda gemela de `reservation_payments`. En `BEGIN…ROLLBACK`, un atleta simulado que reserva conserva `hold` y el precio de la tarifa, y el UPDATE directo de `payment_status` sigue fallando | S |
| CAN-P1-02 | M9: tablas de soporte | db | `<ts>_reservas_f1_tablas_soporte.sql` | Sí | CAN-P1-01 | Crea `facility_rates` (audience text+CHECK), `festivos_colombia` 2026–2027, `facility_blackouts` y `cancellation_policies` (100/50/0, D10), y agrega a `facilities` las columnas `slot_step_min`, `allowed_durations`, `hold_minutes` y `transfer_hold_minutes`. Lectura de staff con `user_staff_school_ids`, escritura con `user_admin_school_ids`, sin GRANT a anon y sin self-recursion | M |
| CAN-P1-03 | M10: tope de canchas por tier y gating del venue según el ADR | db | `<ts>_reservas_f1_tier_y_gating.sql` | Sí | CAN-P1-02, CAN-P0-02 | El tope (Gratis ≤2, Pro ≤5, Club sin tope) se hace cumplir **al activar `rental_enabled` o al crear la facility**. Una sede que ya está por encima del tope conserva lo que tiene y no puede activar más. `has_entitlement` del venue queda como decidió el ADR. Al vencer el trial se degrada a Gratis y nunca bloquea reservas ya hechas. El tier y el trial tienen CHECK | S |
| CAN-P1-04 | M11: RPC `disponibilidad_canchas` | db | `<ts>_reservas_f1_disponibilidad.sql` | Sí | CAN-P1-03 | `STABLE SECURITY DEFINER` con search_path fijo. `GRANT EXECUTE` a `authenticated` y `service_role`; anon entra por el BFF. Calcula el precio final con tarifa, festivo y audiencia. Ignora los holds vencidos, respeta blackouts, anticipación, horario y duraciones, no expone quién reservó y valida `has_entitlement` | M |
| CAN-P1-05 | M12: RPC `reservar_cancha` | db | `<ts>_reservas_f1_reservar.sql` | Sí | CAN-P1-04 | En una sola transacción: advisory lock por (facility, día), siguiendo el patrón de `public_booking_confirm_reservation`. Con la misma key devuelve la misma fila. Libera los holds vencidos, inserta con `price_snapshot` y la ocupación `hold` (o `active` si la crea el staff), devuelve `{reserva, monto, abono_minimo, expira, token}` y traduce 23P01 a `SLOT_TAKEN`. Rechaza al invitado sin pago en línea (D7). **No** valida el tope de canchas | L |
| CAN-P1-06 | M13: RPCs del ciclo de vida | db | `<ts>_reservas_f1_ciclo_de_vida.sql` | Sí | CAN-P1-05 | `confirmar_pago_reserva` es idempotente: si el hold venció y la franja ya está tomada, pasa a `pending_reconciliation` y nunca pierde el pago. `cancelar_reserva` aplica la política y libera. `reprogramar_reserva` ocupa lo nuevo antes de soltar lo viejo y reutiliza el patrón de `session_booking_reschedule`. `marcar_asistencia` y `crear_blackout` devuelven los choques sin pisarlos. Cada RPC tiene `GRANT EXECUTE` explícito y valida al actor con `user_staff_school_ids` o con el token del invitado | L |
| CAN-P1-07 | M14: las clases escriben ocupación y se retiran el trigger e índice viejos | db | `<ts>_reservas_f1_ocupacion_clases.sql` | Sí | CAN-P1-06, CAN-P0-01 | Las `attendance_sessions` futuras con cancha escriben `class`, y una clase choca con un alquiler. **El banco de horas queda fuera** (no tiene cancha ni franja; MOD-21 D-11 y MOD-35). El trigger y el índice viejos se eliminan solo después de compararlos con el cuerpo vivo de CAN-P0-01 y de confirmar que la protección de las reservas manuales del owner (MOD-29) queda cubierta por la ocupación. El backfill no deja filas sobrantes | M |
| CAN-P1-08 | M15: `expirar_holds` con pg_cron cada minuto | db | `<ts>_reservas_f1_cron_holds.sql` | Sí | CAN-P1-05 | Existe el job `canchas-expirar-holds` con `* * * * *`. Hace un solo UPDATE en lote y un hold vencido se libera en menos de 2 min | XS |
| CAN-P1-09 | Pruebas de concurrencia y seguridad del motor **en el gemelo local Docker** | qa | `supabase/tests/canchas_f1/concurrencia.sql`, `README.md` (carpeta nueva), `scripts/rls-pruebas-negativas.mjs` | No | CAN-P1-06, CAN-P1-07 | Corren en el gemelo local, **no contra la base compartida**, para no quemar Disk IO. 50 llamadas a la misma franja: gana 1 y las 49 restantes reciben `SLOT_TAKEN`. La misma key ×10 crea 1 fila. Un pago tardío termina en `confirmed` o en `pending_reconciliation`. Un `facility_manager` del club A no ve el club B. Anon ve 0. Contra la base viva se corren solo `seguridad:invariantes` y `seguridad:rls-negativas` | M |
| CAN-P1-10 | Endpoints del BFF, admin y públicos | bff | `bff/src/routes/canchas-admin.routes.ts`, `canchas-publico.routes.ts`, `bff/src/services/canchas.service.ts`, `bff/src/index.ts` | No | CAN-P0-04, CAN-P0-08, CAN-P1-06 | Cumplen el OpenAPI. Los POST de reservar y cobrar pasan por `requireIdempotencyKey` y las rutas admin por `requireEntitlement`. `SLOT_TAKEN` trae 3 alternativas. La disponibilidad pública tiene caché de 60 s y rate limit por IP. El token es opaco y se valida en la RPC | L |
| CAN-P1-11 | OTP del invitado por WhatsApp con correo de respaldo y anti-abuso | bff | `canchas-publico.routes.ts`, `bff/src/services/canchas-otp.service.ts` | No | CAN-P1-10, CAN-P0-10 | Si la plantilla de Meta no está aprobada o falla, el código sale por Resend. Máximo 3 códigos cada 10 min por número, rate limit por IP y tope de holds por número e IP. Sin bypass de depuración desplegado (SEG-20). Queda lleno `guest_bookers.verified_phone_at` | M |
| CAN-P1-12 | Pasar los escritores directos a RPCs | frontend | `frontend/src/hooks/useFacilityReservations.ts`, `frontend/src/components/school/FacilityReservationModal.tsx`, `bff/src/routes/reservations-admin.routes.ts`, `bff/src/routes/session-bookings.ts`, `bff/src/routes/public-booking.routes.ts`, `bff/src/jobs/` | No | CAN-P1-10 | **Primero un censo completo** con grep global de `facility_reservations` y de `submit_facility_booking` en `frontend/src`, `bff/src` (rutas, servicios y jobs) y `supabase/migrations`; el censo queda en el PR y M16 no se escribe sin él. **Prerrequisito duro de M7**: los escritores con JWT de usuario (`useFacilityReservations.ts:215/264`, `FacilityReservationModal.tsx:97`). Un grep de `.from('facility_reservations').insert/.update` en `frontend/src` da 0. **Por consistencia**, aunque usan `service_role`: `reservations-admin.routes.ts:89/140/406` y `session-bookings.ts:2427/2562` llaman a las RPCs. Se arregla `completeReservation`, que manda `status 'completed'` a `session_bookings` (MOD-29), o como mínimo no se empeora. El flujo pedir → aprobar sigue funcionando en la app corriendo | M |
| CAN-P1-13 | Pasar los lectores viejos a la ocupación | frontend | `frontend/src/hooks/useFacilityReservations.ts:413`, `frontend/src/pages/AttendanceSupervisionPage.tsx:331/471` | No | CAN-P1-04 | `getBookedSlots` lee `disponibilidad_canchas` o `facility_occupancy`. La supervisión de asistencia considera los estados nuevos. Una franja en `hold` se ve ocupada en la UI vieja | S |
| CAN-P1-14 | M16 (M7): revocar la escritura directa y cerrar `submit_facility_booking(_v2)` | db | `<ts>_reservas_m7_revocar_escritura.sql` | Sí | CAN-P1-12, CAN-P1-09, CAN-P1-17 | `REVOKE INSERT, UPDATE, DELETE` a `authenticated` y `anon`, y `DROP` de las policies de escritura después de listarlas todas en `pg_policies`. `submit_facility_booking` y `_v2` quedan revocadas de `authenticated` y `anon` (o eliminadas, según el ADR). El INSERT directo falla, la RPC funciona y `seguridad:invariantes` no muestra violaciones nuevas | S |
| CAN-P1-15 | Cierre del lote F1: `gen types` una vez y ledger | ops | `frontend/src/integrations/supabase/types.ts`, `supabase/migrations_ledger.json` | No | CAN-P1-14 | `gen types` se corre una sola vez y `migrations:check` queda en verde. M8–M16 se aplicaron por CLI desde una sola sesión y están en `schema_migrations` | XS |
| CAN-P1-16 | Deploy de los 3 BFF y smoke postdeploy | ops | — | No | CAN-P1-15 | Las rutas `/api/v1/canchas/*` responden en los 3 BFF (verificado contra la ruta viva, no contra `/health`). Commit con índice temporal y pushes agrupados | XS |
| CAN-P1-17 | Barrido de seguridad del flujo público (estilo SEG-20) y vistas públicas | bff | `bff/src/routes/canchas-publico.routes.ts`, `bff/src/services/canchas.service.ts`, `<ts>_canchas_vistas_publicas.sql`, `scripts/rls-pruebas-negativas.mjs` | Sí | CAN-P1-10 | Se revisa contra la lista de SEG-20 (ROADMAP) y `public-booking.routes.ts`: identificación por teléfono siempre filtrada por escuela, ningún `debug_code`, rate limit con `ipKeyGenerator`, token opaco validado en la RPC, sin enumeración por `/r/:token` ni por `/reservar/:slug`, y caché de disponibilidad con la escuela en la llave. Lo que la página pública muestra (nombre, tarifas, «precio desde») sale de **vistas con columnas publicables**, no de policies. Pruebas negativas: un `facility_manager` del club A no lee ni escribe el club B, anon solo ve las vistas, y `npm run seguridad:invariantes` corre **después de cada migración** del lote, no solo al final | M |

### P2 — Cobro, canales (app y bot) y piloto

**Objetivo:** H2, paridad con Controla Cancha (30-oct), y H3, el piloto cobrando por WhatsApp y Wompi con un club real (6-nov), **gratis por un mes**.
**Semanas:** semanas 2–4 (26 oct–6 nov) · hitos H2 y H3.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P2-01 | Pagos RSV en Wompi y MP | bff | `bff/src/services/wompi.service.ts`, `bff/src/routes/wompi.ts`, `bff/src/routes/mercadopago.ts`, `wompi-link-con-monto.service.ts`, `bff/src/services/canchas-pagos.service.ts` | No | CAN-P1-06, CAN-P1-10, CAN-P0-02 | `RSV-…` es estable por reserva y `HANDLERS.RSV` llama a `confirmar_pago_reserva`. MP con `X-Idempotency-Key`. Siempre la pasarela de la escuela, fail-closed. Un webhook repetido no duplica (test estilo `wompi.doble-pago`). El pago va **solo** a `payments` con `payment_category 'reserva'`, y `reservation_payments` no recibe filas nuevas (ADR) | M |
| CAN-P2-02 | Transferencia con comprobante OCR para reservas | bff | `bff/src/services/canchas-comprobante.service.ts`, `ocr.service.ts`, `receipt-verdict.ts`, `receipt-approval.service.ts`, `receipt-context.service.ts`, `whatsapp-receipt-matching.service.ts`, `<ts>_reservas_f2_comprobante.sql` | Sí | CAN-P2-01 | **Antes de escribir código se lee cada uno de esos servicios** y se deja por escrito qué se reutiliza y qué no (hoy están acoplados a `payments.parent_id/child_id`, ver BLQ-10). El match de la cuenta destino usa **las cuentas de la sede** y respeta la lección «cuenta enmascarada = `DESTINO_NO_COINCIDE`» (igualdad exacta): el caso de cuenta enmascarada va a `needs_review`, no a `rejected`. **No se escribe en `payments` hasta que la reserva se confirma**, para que `payment_date` sea el día en que aprueba el club y no el de la subida. Hold de 15 min para mandar el comprobante. Estados: `validated` (confirma), `needs_review` (hasta 24 h y nunca después del inicio), `not_receipt`, `duplicate`, `rejected` con motivo y `expired`. `receipt_status` es text+CHECK. El staff puede dar más tiempo | L |
| CAN-P2-03 | Conciliación de pagos tardíos y devoluciones registradas | bff | `canchas-admin.routes.ts`, `bff/src/services/canchas-conciliacion.service.ts` | No | CAN-P2-01 | Bandeja de `pending_reconciliation` con aviso al admin. Las acciones reasignar, saldo a favor (registro) y devolución manual dejan `refund_status` y auditoría. Ningún pago queda sin reserva | M |
| CAN-P2-04 | `reserva` en las agregaciones de ingreso | db | RPC de kpis y `cash_ledger`, `frontend/src/hooks/useDashboardStatsReal.ts`, `<ts>_ingresos_incluyen_reserva.sql` | Sí | CAN-P2-01 | Las tres rutas de ingreso suman `reserva`, o la excluyen a propósito y lo documentan. El dashboard de una escuela híbrida de prueba cuadra con una consulta manual. Se actualiza el censo de los 13 caminos que crean `payments` | S |
| CAN-P2-05 | Alta «Club / Canchas» (`facility_manager`) con RPC `crear_venue` | frontend | `frontend/src/pages/RegisterPage.tsx` (`INSTITUTION_ROLES`), `OnboardingRolePage.tsx`, `frontend/src/App.tsx`, `DashboardRouter`, `ProtectedRoute`, `frontend/src/config/navigation.ts`, `<ts>_canchas_alta_venue.sql` | Sí | CAN-P1-15, CAN-P0-02 | `crear_venue` (SECURITY DEFINER, transaccional) crea `schools(school_type='venue')`, el tier free, `school_members.role = 'owner'` (ADR) y las políticas por defecto. Se cablea el menú a `has_reservations`, `has_academy` y `has_billing`, que es la parte de reservas de **CAR-3**. Menú propio: Agenda, Canchas, Tarifas, Pagos, Mi plan. El rol se registra en el catálogo de roles (`school_admin`, no `admin`). **Prueba negativa:** un `facility_manager` no ve atletas, menores ni pagos de la academia en una escuela híbrida. Llega a la agenda en menos de 5 min | L |
| CAN-P2-06 | Asistente de configuración de la sede | frontend | `frontend/src/pages/canchas/VenueOnboardingPage.tsx`, `TarifasTab.tsx`, `PoliticasTab.tsx` | No | CAN-P2-05 | Al terminar hay al menos 1 cancha `rental_enabled`, horario, tarifa (pico, valle, festivo) y método de pago. La política se explica en una línea con un ejemplo. Funciona a 375 px | M |
| CAN-P2-07 | Toggle «Alquilar mis canchas» para academias (híbrido) | frontend | `frontend/src/pages/SchoolFacilitiesPage.tsx`, `canchas-admin.routes.ts` | No | CAN-P2-05 | Solo lo ve el admin (`user_admin_school_ids`). Activa el addon free sin cambiar `school_type` ni el dashboard. Las clases ya bloquean horas | S |
| CAN-P2-08 | Agenda en grilla canchas × horas | frontend | `frontend/src/pages/canchas/AgendaCanchasPage.tsx`, `frontend/src/components/canchas/GrillaOcupacion.tsx`, `frontend/src/hooks/useAgendaCanchas.ts` | No | CAN-P1-10 | Un color por tipo (alquiler, clase, evento, bloqueo, hold). Walk-in o reserva por llamada con la Idempotency-Key generada al abrir el resumen. Si dos pestañas toman la misma franja, la segunda ve `SLOT_TAKEN` con alternativas. Al crear un bloqueo se muestran las reservas con las que choca | L |
| CAN-P2-09 | Cancha fija semanal | db | `<ts>_reservas_recurrencias.sql`, `frontend/src/pages/canchas/CanchaFijaTab.tsx` | Sí | CAN-P1-06 | `generar_recurrencia` crea las reservas por RPC transaccional y devuelve los choques sin pisarlos. Cancelar una fecha no afecta las demás | M |
| CAN-P2-10 | Página pública `/reservar/:slug` | frontend | `frontend/src/pages/booking/PublicCourtBookingPage.tsx`, `App.tsx` | No | CAN-P1-11, CAN-P2-01, CAN-P2-02 | En el celular: deporte → día (14 días, festivos marcados) → hora con precio final → nombre y WhatsApp → código → resumen con la política → pago. Un doble tap da la misma reserva. Sin cuota al jugador; el recargo aparece solo si el club lo configuró | L |
| CAN-P2-11 | Página de estado `/r/:token` | frontend | `frontend/src/pages/booking/ReservaEstadoPage.tsx`, `App.tsx` | No | CAN-P2-10 | Muestra el estado y el comprobante en vivo (polling de 3 s solo mientras está en revisión). Antes de cancelar dice «Te devolvemos $X…». Reprogramar dentro de la ventana no cobra de nuevo. El recibo viene desglosado. Un token inválido da 404 | M |
| CAN-P2-12 | Bandejas de comprobantes y «por conciliar», con Llegó / No llegó | frontend | `frontend/src/pages/canchas/BandejaReservasPage.tsx` | No | CAN-P2-02, CAN-P2-03 | Cada acción pasa por una RPC y queda auditada | M |
| CAN-P2-13 | Notificaciones de reserva por el despachador unificado | bff | `bff/src/jobs/canchas-recordatorios.job.ts`, `bff/src/services/notification.service.ts` | No | CAN-P1-10, CAN-P0-10 | Escriben en `notification_deliveries` (`20260722000002`). Confirmación, recordatorios a 24 h y 2 h, y avisos al admin. Lectura en lote con `.in()` y dedupe por reserva y tipo entre los 3 BFF. Respetan el cupo de Resend y de WhatsApp. Sin plantilla aprobada, salen por correo y push | M |
| CAN-P2-14 | Planes de Canchas en `/mi-plan` y facturación al terminar el piloto | frontend | `frontend/src/config/saas-plans.ts`, `frontend/src/pages/MiPlanPage.tsx` | No | frente:mi-plan-por-rol, CAN-P1-03 | El `facility_manager` ve Gratis ≤2, Pro $99k ≤5 y Club $199k, no los planes de academia. Al vencer el mes, la facturación SaaS que suma addons puede cobrar el tier elegido. Si el club no elige, queda en Gratis. El tope lo hace cumplir la base. Se coordina con la otra sesión y se commitea con índice temporal | M |
| CAN-P2-15 | Bot: ampliar el CHECK de flujos a `reserva` | db | `<ts>_whatsapp_flujo_reserva.sql` | Sí | CAN-P1-15 | Solo amplía el CHECK. `venta` y `factura_electronica` siguen en verde | XS |
| CAN-P2-16 | Bot: flujo determinista de reserva y tool `get_court_availability` | bot | `bff/src/services/whatsapp-reserva-canchas.service.ts`, `whatsapp-bot.service.ts`, `llm.service.ts`, `bff/src/services/whatsapp-reserva-canchas.test.ts` | No | CAN-P2-15, CAN-P2-01, CAN-P2-02 | El LLM solo detecta la intención; el resto son listas interactivas hasta el pago y el comprobante. La key es el wamid del «Confirmo» (si Meta reentrega, sigue habiendo 1 reserva). Respeta `ai_enabled` y el horario, y los casos de plata los atiende una persona. Cancelar o cambiar usa las RPCs. El costo va a llm-usage | L |
| CAN-P2-17 | Deploy y verificación de punta a punta del webhook RSV en el BFF desplegado | ops | — | No | CAN-P2-01, CAN-P2-16 | Los webhooks y crons solo corren en prod, así que se verifica ahí: un pago sandbox RSV llega al BFF desplegado, confirma la reserva y es idempotente ante el reintento. Se confirma que la pasarela del club piloto tiene webhook configurado (hoy Dynasty no lo tiene). Smoke postdeploy en los 3 BFF | S |
| CAN-P2-18 | QA real end-to-end H2/H3 con la app corriendo | qa | `docs/qa/canchas-h2-h3-evidencia.md`, `docs/capturas/canchas/` | No | CAN-P2-08, CAN-P2-10, CAN-P2-11, CAN-P2-16 | En una escuela de prueba (`account_type='test'`): alta → configuración → reserva desde el celular → Wompi sandbox (**nunca** las credenciales MP de dev, que son de producción) → confirmado. También: comprobante real y uno duplicado, reserva por bot **probada en un celular real** con el número de prueba, web y bot a la vez (gana 1, con dos sesiones desde la app), **pago tardío con hold vencido en Wompi sandbox** (termina en `confirmed` o `pending_reconciliation`, nunca pierde el pago), revisión visual a 375 px de `/reservar/:slug` y `/r/:token`, y cancelar y reprogramar. Prueba negativa del `facility_manager`. Capturas reales. El BFF local se apaga al terminar | L |
| CAN-P2-19 | Manual del club y términos del piloto | ventas | `docs/manuales/` (patrón único de PDFs), `docs/pilotos/canchas-club-piloto.md` | No | CAN-P2-18 | Manual con capturas reales (2 versiones + Sportbot). Términos escritos: 1 mes gratis, sin cobro automático, al vencer pasa a Gratis o al plan que elija | S |
| CAN-P2-21 | Sin comisión al jugador y recargo solo del club | bff | `bff/src/services/canchas-pagos.service.ts`, `wompi-link-con-monto.service.ts`, `PoliticasTab.tsx` | No | CAN-P2-01 | Un test fija que el monto del link Wompi o MP es exactamente `precio + recargo configurado por el club`, sin ninguna comisión de SportMaps. El recargo online (`online_surcharge`) es del club, está apagado por defecto y el club lo ve y lo decide. La plata va siempre a la pasarela del club, fail-closed | S |
| CAN-P2-22 | Medición mínima de Disk IO antes del piloto | ops | `docs/qa/canchas-h2-h3-evidencia.md` | No | CAN-P1-16, CAN-P2-13 | Con la disponibilidad pública, el bot y el job de recordatorios corriendo, `query_logs` filtrado por esas consultas no muestra bucles ni N+1, y la caché de disponibilidad pega más del 80 %. Sin esto no se activa el piloto (CAN-P4-09 repite la medición con más carga) | S |
| CAN-P2-20 | Activar el piloto gratis de 1 mes con el club piloto | ventas | `docs/pilotos/canchas-club-piloto.md` | No | CAN-P0-05, CAN-P0-11, CAN-P2-17, CAN-P2-18, CAN-P2-19, CAN-P2-22 | Sede creada con el dueño en su celular, en tier Pro con trial de +1 mes según el ADR. El botón «Reservar» de Google Business apunta a `/reservar/:slug`. Primera reserva real pagada antes del 6-nov. Tablero semanal (ver §3) | M |

### P3 — Diferenciales y lanzamiento

**Objetivo:** H5, lo que Controla Cancha no tiene, y H4, la salida comercial con la landing honesta.
**Semanas:** semanas 4–7 (9–27 nov) · hitos H4 y H5.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P3-01 | Canchas combinadas o divisibles (reemplaza **CAR-6**) | db | `<ts>_reservas_canchas_combinadas.sql` | Sí | CAN-P1-15 | Reservar la F8 escribe una ocupación por cada F5 física, y al revés. La disponibilidad lo refleja. En concurrencia entre la combinada y una hija gana 1. Sirve también para los carriles de piscina (Carmel) | M |
| CAN-P3-02 | Reglas por segmento | db | `<ts>_reservas_reglas_segmento.sql`, `frontend/src/pages/canchas/ReglasTab.tsx` | Sí | CAN-P1-15 | Segmentos public, member, family y staff (text+CHECK). Gana la regla más estricta, los topes cuentan por familia, el staff puede saltarlas con registro y la disponibilidad oculta lo que no se puede tomar | L |
| CAN-P3-03 | Pago dividido entre jugadores | bff | `<ts>_reservas_pago_dividido.sql`, `bff/src/services/canchas-pago-dividido.service.ts`, `ReservaEstadoPage.tsx` | Sí | CAN-P2-01, CAN-P2-16 | Las partes se crean por RPC transaccional y cada jugador recibe su link. Es un saldo de cancha, **separado de la mora y de `late_fee_enabled`**: no cancela nada ni genera recargos. Lo que no se pagó queda como saldo del organizador en la sede. El bloqueo para volver a reservar con saldo pendiente **es configurable por el club (apagado por defecto)** y nunca toca inscripciones ni accesos de la academia | L |
| CAN-P3-04 | Lista de espera por turnos de 15 min | bot | `<ts>_reservas_waitlist.sql`, `bff/src/jobs/canchas-waitlist.job.ts` | Sí | CAN-P2-16 | Gana el primero que paga y no hay cobro automático. El job va en lote y es idempotente entre los 3 BFF | M |
| CAN-P3-05 | No-show con strikes y disputa | db | `<ts>_reservas_no_show_strikes.sql`, `ReservaEstadoPage.tsx` | Sí | CAN-P2-12 | N faltas en 60 días → pago anticipado durante 30 días. **El club lo configura y puede apagarlo.** La disputa queda registrada. Solo afecta las reservas de cancha: nunca cancela inscripciones, no cobra automático y no toca la academia | M |
| CAN-P3-06 | Aviso inmediato cuando el club bloquea una hora vendida | bot | `bff/src/services/canchas-bloqueo-aviso.service.ts` | No | CAN-P2-13, CAN-P1-06 | Menos de 1 min, por WhatsApp o push, con otra hora o saldo a favor | S |
| CAN-P3-07 | Roles de recepción y contador | frontend | `<ts>_canchas_roles_recepcion.sql`, `frontend/src/config/navigation.ts` | Sí | CAN-P2-05 | Recepción: agenda del día, check-in y efectivo. Contador: solo lee y exporta. Invitar como admin exige `user_admin_school_ids`. Prueba negativa: recepción no edita tarifas | M |
| CAN-P3-08 | QA real de diferenciales y regresión del motor | qa | `supabase/tests/canchas_f1/concurrencia.sql`, `docs/qa/canchas-h5-evidencia.md` | No | CAN-P3-01…05 | Pago dividido con 3 números de prueba, socio contra público con dos sesiones, waitlist y no-show con disputa. Concurrencia reejecutada en el gemelo local. `seguridad:invariantes` limpio | M |
| CAN-P3-09 | Lanzamiento H4: landing con lo que ya corre | landing | Landing `Canchas.tsx` | No | CAN-P2-20, frente:landing-honesta | Solo aparece como disponible lo verificado en CAN-P2-18 y CAN-P3-08. Video real con permiso. La oferta dice «piloto gratis 1 mes». Sin cifras ni testimonios inventados | S |

### P4 — Operación completa y descubrimiento

**Objetivo:** H6, con adicionales, caja, reportes y tiqueteras, el mapa con clubes reales, y torneos y familias conectados a Canchas.
**Semanas:** semanas 7–8 (23 nov–4 dic) · hito H6.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P4-01 | Adicionales desde el catálogo de tienda v2 | bff | `<ts>_reservas_adicionales.sql`, `canchas-pagos.service.ts` | Sí | frente:tienda, CAN-P2-01 | Se cobran en el mismo pago RSV. El stock se descuenta solo en una RPC con `FOR UPDATE`. El recibo los desglosa | M |
| CAN-P4-02 | Caja por sede sobre el módulo contable | bff | `canchas-admin.routes.ts`, `<ts>_canchas_caja.sql` | Sí | frente:contabilidad, CAN-P3-07 | Cierre diario con `owner_type`/`owner_id`. Exporta CSV y cuadra con los `payments 'reserva'` del día | M |
| CAN-P4-03 | Reportes de ocupación, ingreso por cancha-hora y no-show | frontend | `frontend/src/pages/canchas/ReportesCanchasPage.tsx`, `<ts>_canchas_reportes_rpc.sql` | Sí | CAN-P3-05 | Excluyen canceladas y expiradas, cuadran con una consulta manual, cargan en menos de 2 s y no hacen polling | M |
| CAN-P4-04 | Tiqueteras de N horas con ocupación propia | db | `<ts>_canchas_tiqueteras.sql` | Sí | CAN-P1-15 | Saldo de horas por jugador y club, descontado **dentro de `reservar_cancha`** en la misma transacción, con ocupación `rental` y franja. **No** se apoya en `hour_bank_reservations`, que no tiene cancha ni franja y tiene MOD-35 abierto. La extensión del banco de horas queda como decisión de producto aparte | M |
| CAN-P4-05 | Endpoint público de venues con caché | bff | `bff/src/routes/explorar.routes.ts`, `canchas-publico.routes.ts` | No | CAN-P2-10 | Solo clubes con reservas activas, con «precio desde» y URL. Cache-Control para CDN. Sin disponibilidad en vivo | S |
| CAN-P4-06 | Landing: mapa con clubes reales, `/clubes/:slug` y `/canchas/:ciudad` | landing | Landing `components/map/InteractiveMap.tsx`, `data/mapData.ts`, `App.tsx`, sitemap, `llms.txt` | No | CAN-P4-05, frente:landing-honesta | Sin datos de ejemplo. Si el club no tiene reservas, «Reservar» lleva al lead. Pasa la prueba de resultados enriquecidos. Se coordina con la sesión que edita `sitemap.xml`, `llms.txt` y `prerender.mjs` (hoy hay cambios ajenos) y se commitea con índice temporal | L |
| CAN-P4-07 | Torneos ocupan cancha sin choques | db | `<ts>_torneos_ocupan_cancha.sql` | Sí | frente:torneos, CAN-P1-07 | `schedule_tournament_match` escribe `event` y un choque dice contra qué reserva fue. La grilla lo pinta | M |
| CAN-P4-08 | Botón «Reservar cancha» para familias y atletas | frontend | `frontend/src/pages/MyEnrollmentsPage.tsx`, `ExplorarGlobalPage.tsx` | No | frente:familias, CAN-P2-10 | Con sesión no pide OTP y aplica la tarifa member. «Mis Reservas» muestra los estados nuevos | S |
| CAN-P4-09 | QA real H6 y revisión de Disk IO | qa | `docs/qa/canchas-h6-evidencia.md` | No | CAN-P4-01, CAN-P4-03, CAN-P4-06 | `query_logs` no muestra consultas en bucle, la caché pega más del 80 % y queda el costo de LLM por reserva | M |
| CAN-P4-10 | Conversión del piloto al vencer el mes gratis | ventas | `docs/pilotos/canchas-club-piloto.md` | No | CAN-P2-20 | Aviso una semana antes, con el uso real. El club elige Pro, Club o Gratis. **Si no elige, se degrada a Gratis sin cobro ni bloqueo y sin perder datos.** Caso de estudio publicado con permiso | S |

### P5 — Crecimiento

**Objetivo:** F6, con monedero, check-in con auto-liberación, acceso físico y número de plataforma.
**Semanas:** desde dic 2026.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| CAN-P5-01 | Saldo a favor o monedero por club | db | `<ts>_canchas_monedero.sql` | Sí | CAN-P2-03 | Débito atómico al reservar. Se ve en `/r/:token` y en el perfil. Reemplaza la devolución manual de CAN-P2-03 | L |
| CAN-P5-02 | Check-in QR con auto-liberación a los 15 min | bff | `bff/src/jobs/canchas-auto-liberar.job.ts` | No | CAN-P3-04 | El club lo activa si quiere. Libera la franja y avisa a la lista de espera. Job en lote | M |
| CAN-P5-03 | Acceso o luces disparados por la reserva (ZKTeco, BLQ-2) | bff | `bff/src/routes/bridge.routes.ts` | No | frente:control-acceso | Abre en la franja ±10 min en la sede de prueba | L |
| CAN-P5-04 | Número de plataforma que busca cancha entre clubes | bot | `bff/src/routes/whatsapp-plataforma.routes.ts` | No | CAN-P4-05, CAN-P2-16 | Devuelve 3 clubes con link. El cobro siempre es del club | M |

---

## 3. Piloto gratis por un mes

| | |
|---|---|
| **A quién** | Un club de canchas sintéticas (D12), idealmente con Wompi propio y WhatsApp. Como segunda opción, una academia híbrida que active «Alquilar mis canchas». |
| **Qué recibe** | Canchas Pro (hasta 5 canchas) gratis por 1 mes: agenda, `/reservar/:slug`, `/r/:token`, transferencia con OCR, Wompi y bot (si tiene WhatsApp conectado). |
| **Al terminar** | Aviso una semana antes. Elige Pro, Club o Gratis. **No hay cobro automático; si no elige, se degrada a Gratis** y conserva sus datos y reservas. |
| **Qué se mide (tablero semanal)** | Reservas totales y por canal (web, bot, staff). % pagadas en línea o validadas por OCR. % de comprobantes en `needs_review`. Tiempo hasta confirmar. Dobles reservas (debe ser 0). Pagos en `pending_reconciliation`. Costo de LLM por reserva. Horas que el dueño dice ahorrar. |
| **Criterio de éxito** | 0 dobles reservas. ≥ 60 % de las reservas del club pasan por SportMaps al final del mes. ≥ 70 % se pagan en línea o se validan sin intervención. El dueño acepta un plan pago o autoriza el caso de estudio. Costo de LLM por reserva por debajo del umbral que fije CAN-P4-09. |

---

## 4. Decisiones abiertas

> **Cerrada (14-oct):** una sola oferta, el **piloto gratis por un mes**. «3 meses gratis a los primeros 50» se retira de la landing, el kit y la app.

1. **ADR CAN-P0-02:** gating del venue (que dependa del addon o vivir en `school_subscriptions`), la tabla de pagos que manda (`payments` o `reservation_payments`) y el rol `owner` en `school_members` para el dueño del venue.
2. **D3:** ¿canchas combinadas en P3, como propone el backlog, o adelantadas a F1? La landing ya las nombra; quedan como «próximamente».
3. **D4/D5/D6:** franjas cada 30 min, hold de 10 min en línea, 15 min para mandar el comprobante y hasta 24 h en revisión. Efecty no se ofrece.
4. **D7:** el invitado sin cuenta solo reserva con pago en línea o abono, nunca con «pago en sede».
5. **D10/D11:** política por defecto 100 % hasta 24 h / 50 % hasta 6 h / 0 % después. Mientras no exista el monedero, la devolución se registra como saldo a favor.
6. **D13/D14:** plazo del pago dividido (2 h antes) y sanción por no-show (2 faltas en 60 días). Ambas quedan **configurables y apagables por el club**.
7. **D16:** ¿la plantilla OTP sale de la cuenta de plataforma o de la de cada club?
8. **D17:** ¿lista de espera por turnos de 15 min por WhatsApp o aviso a todos por push?
9. ¿El plan Gratis (≤2 canchas) incluye `/reservar/:slug` con transferencia y aprobación manual pero sin OCR? Es lo que dice la landing.
10. ¿El banco de horas debe tener cancha y franja algún día? Hoy queda fuera de Canchas (MOD-21 D-11 y MOD-35).

---

## 5. Riesgos

- **Guarda M0 dentro de las RPCs:** sin CAN-P1-01, toda reserva de un jugador nace `pending` con el precio recalculado, y confirmar, cancelar y reprogramar fallan. Usar `current_user` como bypass abriría la guarda a cualquier función definer.
- **Venue sin vencimiento:** sin el ADR y CAN-P1-03, el trial es decorativo y el tier no gobierna el acceso.
- **Retirar el trigger y el índice viejos** sin comparar con su cuerpo vivo puede dejar sin protección las reservas manuales del owner (MOD-29) o bloquear de más con los estados nuevos.
- **Lectores viejos** que no ven `hold` muestran franjas apartadas como libres hasta CAN-P1-13.
- **`submit_facility_booking(_v2)`** es una puerta de escritura que salta las RPCs si M16 no la cierra.
- **Doble tabla de pagos** y **agregaciones de ingreso**: los dashboards de la escuela híbrida no cuadran si `reserva` no entra en las tres rutas.
- **Disk IO** (una sola base para dev, stg y prod): la disponibilidad pública, el bot y los jobs por minuto en 3 BFF multiplican las lecturas. Por eso la caché es obligatoria, los jobs van en lote, la concurrencia se prueba en el gemelo local, una sola sesión aplica migraciones y `types.ts` se regenera una vez por lote.
- **La QA toca la base de producción compartida:** escuelas `account_type='test'`, Wompi sandbox y nunca las credenciales MP de dev. Los datos de prueba no se borran (los maneja el usuario).
- **Cobro en línea del piloto:** hoy ningún club tiene webhook Wompi verificado (Dynasty no lo tiene) y los webhooks solo corren en prod. Sin CAN-P2-17 no se puede prometer «primera reserva pagada antes del 6-nov».
- **Plantillas de Meta:** si no se aprueban a tiempo, el OTP y los recordatorios salen por correo, y los clubes sin WhatsApp conectado no tienen bot (hoy ninguno lo tiene).
- **Archivos compartidos con otras sesiones** (`saas-plans.ts`, la landing con 10+ archivos modificados, `migrations_ledger.json`): se coordina y se commitea con índice temporal.
- **Bloqueos por deuda** (pago dividido, no-show): son configurables y no deben tocar inscripciones ni accesos de la academia.
- **Costo del LLM del bot** sin tope: se mide en el piloto antes de abrir Pro a más clubes.
- **Club piloto sin confirmar (D12):** si no aparece en la semana 1, H3 se corre.
- **Fechas apretadas:** P1 y P2 se solapan (22 oct–6 nov). Si F1 se retrasa, H2 y H3 se corren juntos.

---

## 6. Correcciones del revisor aplicadas

| # | Corrección | Dónde se aplicó |
|---|---|---|
| 1 | `me.routes.ts:63` es el fallback fail-closed, no un false fijo: el BFF sí expone `has_reservations` y el que no lo consume es el menú | §1 tabla; CAN-P2-05 (CAR-3) |
| 2 | `hour_bank_reservations` no tiene `facility_id` ni franja | CAN-P1-07 sin banco de horas; CAN-P4-04 con ocupación propia; decisión 10 |
| 3 | La guarda M0 no afecta al invitado (entra con service_role), pero sí al UPDATE de las RPCs y a la guarda de `reservation_payments`; se prefiere un GUC a `current_user` | §1 trampa 1; CAN-P1-01 |
| 4 | La landing se presenta como prelanzamiento; el problema son las 8 menciones de «3 meses / primeros 50» | §1 tabla; CAN-P0-06 con las 8 líneas, el mensaje de WhatsApp y la meta description |
| 5 | `courts` va de la línea 304 a la 451 con 10 canchas ficticias, y `academies`, `trainers`, `events` y `mapStats` siguen el mismo patrón | CAN-P0-06; CAN-P4-06 |
| 6 | Líneas reales de los escritores (89/140/406, `FacilityReservationModal.tsx:97`); `OwnerReservationModal` no escribe; el BFF con service_role no es prerrequisito duro de M7 | §1 tabla; CAN-P1-12 |
| 7 | El trigger viejo tiene ALTER y documentación versionados; lo que falta es el cuerpo | §1 tabla; CAN-P0-01; CAN-P1-07 |
| 8 | Un venue tiene reservas sin addon, así que el trial sería decorativo | §1 trampa 2; CAN-P0-02 (b); CAN-P1-03; degradar a Gratis en CAN-P4-10 |
| 9 | La oferta ya está decidida: una sola, piloto gratis 1 mes | §1; CAN-P0-06; CAN-P0-09; §4 cerrada |
| 10 | El tope de canchas se valida al activar la cancha, no al reservar | CAN-P0-02 (e); CAN-P1-03; CAN-P1-05 sin tope |
| F1 | Lectores viejos que no ven `hold` | CAN-P1-13 |
| F2 | `submit_facility_booking(_v2)` vivas | CAN-P0-02 (d); CAN-P1-14 |
| F3 | Doble tabla de pagos | CAN-P0-02 (a); CAN-P2-01 |
| F4 | `reserva` en las agregaciones de ingreso | CAN-P2-04 |
| F5 | Consolidar el ROADMAP (BLQ-1, CONC-4, CAR-3, CAR-6, MOD-35, MOD-29) y la memoria | Encabezado; CAN-P0-07; CAN-P3-01 reemplaza CAR-6 |
| F6 | MOD-29 `completeReservation` | CAN-P1-12 |
| F7 | `DashboardRouter`, `ProtectedRoute`, `INSTITUTION_ROLES`, catálogo de roles y prueba negativa de menores | CAN-P2-05; CAN-P2-18 |
| F8 | Rol del dueño en `school_members` (`owner`) | CAN-P0-02 (c); CAN-P2-05 |
| F9 | Despachador unificado, cupos y plantillas de Meta | CAN-P0-10; CAN-P2-13 |
| F10 | Verificar el webhook RSV en el BFF desplegado | CAN-P2-17 |
| F11 | Deploy de los 3 BFF y smoke postdeploy | CAN-P1-16; CAN-P2-17; regla general |
| F12 | Landing: commitear solo lo propio; sitemap y llms chocan con otra sesión | CAN-P0-06; CAN-P4-06 |
| F13 | Los bloqueos por deuda son configurables y no tocan inscripciones | CAN-P3-03; CAN-P3-05; regla general |
| F14 | `supabase/tests/canchas_f1/` es nueva; la concurrencia corre en el gemelo local Docker | CAN-P1-09 |
| F15 | Criterio de «vendible»: planes en `/mi-plan`, términos, manual en PDF y facturación al terminar | CAN-P2-14; CAN-P2-19 |
| R1 | La trampa de la guarda es real solo con JWT de usuario; primero se decide si todo va por BFF y el GUC cubre el resto | CAN-P1-01 |
| R2 | El CHECK de `school_type` con `venue` ya existe en `20261014153542`; se verifica por nombre | §1 tabla; CAN-P0-01 |
| R3 | El OCR no se reutiliza sin leer `receipt-approval`, `receipt-context` y `whatsapp-receipt-matching`; match de cuenta destino y `payment_date` | CAN-P2-02 |
| R4 | Censo global de escritores (incluye `public-booking.routes.ts` y jobs) antes de M7 | CAN-P1-12 |
| R5 | Barrido SEG-20, vistas públicas con columnas publicables y `seguridad:invariantes` tras cada migración | CAN-P1-17 |
| R6 | Sin comisión al jugador y recargo solo del club | CAN-P2-21 |
| R7 | Disk IO medido antes del piloto, no en diciembre | CAN-P2-22 |
| R8 | QA real con pago tardío, 375 px, concurrencia desde la app y bot en celular real | CAN-P2-18 |
| R9 | Pasarela real del club piloto, no las credenciales MP de dev | CAN-P0-11 |
| R10 | Pago dividido y no-show separados de la mora (la mora no cancela) | CAN-P3-03; CAN-P3-05 |
| D | Duplicados con el ROADMAP: CONC-4 → CAN-P1-05/08; CAR-6 → CAN-P3-01; MOD-29/SEG-20 se reutilizan los patrones; BLQ-2 → CAN-P5-03 | CAN-P0-07; CAN-P1-05; CAN-P1-06; CAN-P5-03 |
