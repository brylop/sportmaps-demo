# Backlog 11 · Familias (acudiente)

Versión final, 14-oct-2026. Incluye las correcciones del revisor (sección 6). Plan antes de código: nada de SQL se escribe sin plan de migración aprobado.

## 1. Resumen y estado actual verificado

El acudiente ya tiene lo básico: hijos, pagos con atajo «Pagar ahora», informe mensual (correo, aviso en la app, push por trigger), carnets, calendario y avisos. Lo que falta es el hábito: entra solo a pagar (27 % activo por semana, cifra por re-medir, ver FAM-20). La familia es gratis siempre. El comprador de todo este frente es la escuela o el club, no la familia.

Mensaje central: el Inicio del acudiente (ROADMAP UX-15, ⚪ en `docs/ROADMAP.md:1370`, mockup I, J, K) es la misma pieza que FAM-12 a FAM-18. No es trabajo nuevo: hay que ejecutarlo desde esa fila y marcar ambas.

| Capacidad | Estado | Evidencia |
|---|---|---|
| Inicio del acudiente (UX-15) | Parcial | `DashboardPage.tsx:418-447` sigue con 4 stat cards genéricas; «Pagar ahora» en 540-560; torneos arriba. ROADMAP UX-15 en ⚪. |
| Conteo de pagos pendientes | Parcial | `useDashboardStatsReal.ts:321-328` cuenta `pending, overdue, partial, awaiting_approval` con `.eq('parent_id')`. El `awaiting_approval` se incluyó a propósito tras el reporte de Athletic League del 09-25 («mismo criterio que isUnpaid»). Los cobros con `parent_id` NULL no aparecen. El número de consultas en serie (4-5) NO está verificado: medir en DevTools. |
| Explorar en producción | Apagado por diseño | `feature-flags.ts:5`: `SHOW_EXPLORE = import.meta.env.DEV`. El comentario del archivo dice: visible en dev y preview/develop con `VITE_SHOW_EXPLORE=true`; en staging/prod queda oculto. Prenderlo en prod es decisión de producto (D1), no un bug. El flag lo usan Hero, SportMapsFooter, DemoQuickLinks, `pages/Dashboard.tsx`, `MobileBottomNav.tsx:18` y `navigation.ts:295`: prender el global expone Explorar en landing y footer. |
| Explorar: categoría Canchas | No existe | `useExplorarGlobal.ts` consulta `service_listings`, `events`, `search_schools`, `trainer_profiles`, `products`. |
| Chat / Mensajes del acudiente | Roto | `MobileBottomNav.tsx:22` (parent) → `/messages`. `navigation.ts` tiene «Mensajes» en las líneas 376, 432 y 647 (verificar cuál es de `role=parent`). Tabla `messages` sin mensajes en 90 días. La barra de `school` ya cambió su Chat al buzón de WhatsApp (`MobileBottomNav.tsx:29-33`): copiar ese patrón. |
| Barra Inicio · Calendario · Hijos · Pagos · Más | No existe | La barra parent tiene Inicio, Hijos, Pagos, Tienda y Chat. |
| Mis pagos con secciones | Parcial | `MyPaymentsPage.tsx:658` «Nuevo Pago» como botón principal. `?pay=auto` con un cobro funciona. |
| Selector con un solo hijo | Parcial | `AttendancePage.tsx:146`, `AcademicProgressPage.tsx:517` piden «Elegir deportista...». |
| Informe mensual: correo, in-app y push | Funciona | `report-delivery.service.ts:145` (`deliverPublishedReports`); push por trigger del despachador. Los enlaces ya apuntan a `/children/:id/reports/:reportId` (líneas 236 correo, 251 in-app). Falta verificar solo el push. |
| Informe: marca de «visto» | Existe | `athlete_reports.viewed_at` (primera apertura, `20260731161043:102`) y RPC `mark_report_viewed` (solo destinatario; `viewed_at` + `view_count`, `20260801093452`). Ya hay agregación `leidos` por equipo. `reportsQueries.ts:163` la llama. Falta tarjeta en el Inicio. |
| Portal de informes sin login | Solo spec | `docs/specs/informe-atleta-link-publico.md` (v0.1). Ninguna migración de `athlete_report_share_links`. El spec puede estar desactualizado en lo del deep-link: ejecutar desde el spec, no reescribirlo. |
| Push y despachador unificado | Parcial | `notifications-dispatch.job.ts` apagado salvo `NOTIF_DISPATCH_ENABLED='true'`; validado en dev, falta prod. Solo 24 % de acudientes con push. |
| Resumen semanal para familias | No existe | `bot-resumen-semanal.job.ts` es un correo interno a SportMaps, no sirve. |
| Calendario familiar y avisos | Funciona | Migraciones `20260925134721`, `20261006104254`, `20260925140545`; ruta `/calendar`. |
| Hijos, progreso, asistencia, informes, carnets | Funciona | `App.tsx:532-566`, `my-cards` (802). Ficha del hijo sin pestañas. |
| Reservar cancha desde la app | No existe | Solo `/agendar/:slug` (clases). Canchas F0 aplicada el 14-oct (`facility_occupancy` con EXCLUDE, `guest_bookers`, addon `reservations`, rol `facility_manager`); falta F1 (motor) y F3 (`/reservar/:slug`). |
| Landing de familias honesta | Parcial | `Deportistas.tsx` promete scouts y highlights (42-43), «Comunicación directa con el coach» (49) y «comunícate con su coach» (185). Las líneas 89 y 175 ya dicen «próximamente». La cita «Google / Apple» NO se pudo confirmar en `Deportistas.tsx`: re-verificar en toda la landing antes de FAM-05. |

### Reglas transversales de este frente

- Toda RPC nueva: `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE` explícito, `REVOKE` explícito a `anon`/`public`, salvo las del portal público (a `anon` por diseño).
- Escritura con `user_staff_school_ids()`; lo que otorga permisos con `user_admin_school_ids()`; nunca `user_school_ids()` para escribir.
- Una sola sesión aplica migraciones. `types.ts` se regenera una sola vez al final de cada lote. Sin `list_tables` ni `get_advisors` como sondeo.
- Jobs sin N+1 (`.in('id', ids)`). Los tres BFF comparten base.
- Quién paga: cuatro caminos (memoria «quién paga»). Toda lectura de cobros del acudiente cubre `parent_id` NULL de sus hijos.
- La mora no cancela inscripciones. Nada en este frente propone cancelación por falta de pago.
- Copy en español de Colombia, tuteo; sin «vos» ni «che».
- Coordinación obligatoria con la sesión paralela: `ElegirRolPage.tsx`, `roleContexts.ts` (spec `cambio-de-rol-atleta-acudiente.md`, toca `AuthContext` y `useSchoolContext`) y `multisede-selector-y-sede-del-atleta.md` (afecta el selector de hijo/sede de FAM-16). Commitear solo lo propio con índice temporal; agrupar pushes (cupo Vercel: 4 despliegues por push).
- Todo piloto es gratis por un mes, con fecha de fin registrada.

## 2. Fases

Tamaños: XS < 2 h, S ≤ 1 día, M 2-3 días.

### P0 · Quitar lo roto y decidir Explorar (semana 1, 15-21 oct)

Objetivo: que el acudiente no vea nada muerto, que vea bien lo que debe y que la landing no prometa lo que no existe. Explorar solo se prende cuando el dueño decida D1 y D2.

| Id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tam. |
|---|---|---|---|---|---|---|---|
| FAM-00 | Cerrar D1 y D2 con el dueño (qué se ve de Explorar en prod y si el acudiente ve Escuelas) | decisión | este documento | No | — | Decisión escrita en la sección 4 con fecha. Sin ella, FAM-01 y FAM-02 no arrancan. | XS |
| FAM-01 | Flag propio para Explorar del acudiente (`VITE_SHOW_EXPLORE_PARENT`), sin abrir el flag global | frontend | `lib/feature-flags.ts`, `.env.example`, `MobileBottomNav.tsx`, `config/navigation.ts`, `vercel.json` raíz (solo verificar que no pise env) | No | FAM-00 | `SHOW_EXPLORE` (landing, footer, Hero, DemoQuickLinks) queda como hoy. Nuevo `SHOW_EXPLORE_PARENT = DEV \|\| VITE_SHOW_EXPLORE_PARENT === 'true'` gobierna solo la hoja «Más» y el menú del parent. Se configura por ambiente según D1. Se verifica en el chunk desplegado, no con `/health`. Un solo push agrupado. | XS |
| FAM-02 | Auditar categorías de Explorar contra datos reales; ocultar vacías o sin respaldo | frontend | `useExplorarGlobal.ts`, `ExplorarGlobalPage.tsx` | No | FAM-01 | Con la cuenta `qa.athletic@sportmaps.co`, cada categoría devuelve datos reales o se oculta; nunca tarjetas demo. Productos sigue gated por `useStoreEnabled`. Escuelas se oculta para `role=parent` si D2 así lo decide. | S |
| FAM-03 | Sacar «Chat»/«Mensajes» del acudiente y poner «Escribir al club» | frontend | `MobileBottomNav.tsx`, `config/navigation.ts` (líneas 376/432/647: identificar la de parent), `MyChildrenPage.tsx` | No | D3 | `role=parent` no ve `/messages` ni en barra ni en menú; las otras líneas de `navigation.ts` no se tocan salvo que sean del parent. La ruta `/messages` sigue existiendo. «Escribir al club» reutiliza el patrón del bloque `school` y abre `wa.me/<número según D3>` con texto «Hola, soy acudiente de <hijo>». Sin número, el ítem no se muestra. Verificado a 360 px. | S |
| FAM-04 | Un solo criterio de «pendiente» (helper `paymentCartera`/`isUnpaid`) y «En revisión» aparte | frontend | `lib/paymentCartera`, `useDashboardStatsReal.ts`, `DashboardPage.tsx`, `MyPaymentsPage.tsx` | No | — | Inicio, Mis pagos y (luego) la RPC cuentan igual desde un único helper. El CTA «Tienes N pagos pendientes» cuenta `pending, overdue, partial`; `awaiting_approval` se muestra como «N en revisión del club», sin botón de pagar. El comentario del código documenta que esto revisa la decisión del 09-25 y por qué (el comprobante ya subido no es una deuda para el papá, pero sigue visible). Test de unidad: 1 vencido + 1 en revisión → CTA 1, revisión 1. | XS |
| FAM-05 | Landing `Deportistas.tsx`: solo lo que corre | landing | `Landing_page/.../pages/Deportistas.tsx` | No | frente 03-landing | Alcance reducido a lo que sigue prometido: scouts y highlights (42-43), «Comunicación directa con el coach» (49, se reemplaza por «Escribe al club por WhatsApp») y «comunícate con su coach» (185). Las líneas 89 y 175 ya dicen «próximamente»: se dejan. Se re-verifica «Google / Apple» en toda la landing y se retira si existe. Se agregan beneficios reales: informe mensual, carnet digital, calendario con avisos, pago con comprobante. Se coordina con la sesión que edita la landing. Grep sin coincidencias de `scouts\|highlights\|Google / Apple`. | S |
| FAM-06 | Actualizar `docs/ROADMAP.md`: UX-15 y fila de fase 4 como la misma pieza que FAM-12..18 | docs | `docs/ROADMAP.md` | No | — | Una sola verdad: la fila UX-15 enlaza este backlog y la fila de fase 4 «Inicio del acudiente» deja de figurar como bloqueada por dependencias externas. | XS |
| FAM-07 | QA real P0 | qa | `docs/qa/familias-p0.md`, `docs/capturas/familias-p0/` | No | FAM-01..04 | En develop desplegado, 360 px y escritorio, cuenta acudiente de Athletic League: Explorar según D1; sin Chat; «Escribir al club» abre WhatsApp; el conteo coincide con `/my-payments`. Capturas reales. BFF local apagado al terminar. | S |

### P1 · Inicio del acudiente (UX-15) completo (semanas 2-3, 22 oct - 4 nov)

Objetivo: el Inicio responde en una pantalla y con una sola llamada qué debo, qué está en revisión, cómo va mi hijo, cuándo entrena, qué dice el club y si hay informe nuevo. La barra baja a 5 destinos. Explorar va en la hoja «Más», no en la barra (resuelve la contradicción entre UX-15(b) y el plan maestro).

| Id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tam. |
|---|---|---|---|---|---|---|---|
| FAM-10 | Plan de migración de `get_parent_home()` (aprobado antes del SQL) | db | `docs/specs/familias-inicio-acudiente.md` | No | FAM-04 | Define firma y JSON: `por_pagar[]`, `en_revision[]`, `hijos[{id,nombre,equipo,coach,proximo_entreno,asistencia_mes}]`, `avisos[]`, `informe_nuevo` (informes con `viewed_at IS NULL`). Cubre los cuatro caminos de pagador, incluido `parent_id` NULL. `SECURITY DEFINER` filtrado por `auth.uid()`, `search_path` fijo, `GRANT` a `authenticated`, `REVOKE` a `anon`/`public`, sin helpers RLS por fila. Presupuesto de IO: una llamada por apertura, `staleTime` ≥ 60 s, sin polling ni realtime. Aprobado por el dueño. | S |
| FAM-11 | Migración `get_parent_home()` + pruebas de aislamiento | db | `supabase/migrations/<migrations:new -- parent_home_rpc>.sql`, `supabase/migrations_ledger.json` | Sí | FAM-10 | Aplicada por la única sesión de migraciones, con rastro. Simulando `request.jwt.claims` de dos acudientes, cada uno ve solo sus hijos y cobros. Matriz de pagador: cobro con `parent_id` propio, con `parent_id` NULL de su hijo, de otro acudiente (no aparece), anon (error de permiso). `pg_proc.proconfig` con `search_path`. `npm run seguridad:invariantes` sin críticos. `types.ts` al final del lote. | M |
| FAM-12 | `ParentHome` reemplaza las stat cards | frontend | `components/parent/ParentHome.tsx`, `hooks/useParentHome.ts`, `DashboardPage.tsx`, `OpenTournamentsCard.tsx` | No | FAM-11, FAM-04 | Orden: Por pagar (monto, vencimiento, «Pagar ahora», «Ya pagué: subir comprobante»); En revisión; tarjeta por hijo; avisos del club; torneos abajo. Una sola llamada de datos (DevTools). Estado vacío con «Registrar hijo». Sin cambios para otros roles. Test de componente (patrón `BuzonFase1.test.tsx`) con 0, 1 y 2 hijos y con cobro sin pagador. | M |
| FAM-13 | Barra Inicio · Calendario · Hijos · Pagos · Más (hoja) | frontend | `MobileBottomNav.tsx`, `ParentMoreSheet.tsx` | No | FAM-01, FAM-03 | 5 ítems. «Más»: Explorar (según flag), Carnets, Salud, Mis inscripciones, Mis eventos, Tienda/Mis compras (con `showStore`), Escribir al club, Configuración. Safe-area del notch, no tapa checkout, 360 px, foco y etiquetas accesibles (`aria-label`, objetivo táctil ≥ 44 px). | S |
| FAM-14 | Menú lateral del acudiente reordenado | frontend | `config/navigation.ts` | No | FAM-03 | «Dashboard» → «Inicio»; «Mensajes» fuera; Explorar en Principal (según flag); sin íconos repetidos; gates `requiresStore`/`buyerStore` intactos. | XS |
| FAM-15 | Mis pagos: Por pagar / En revisión del club / Pagados | frontend | `MyPaymentsPage.tsx` | No | FAM-04, D4 | Tres secciones con contador. «Nuevo pago» según D4. `?pay=auto` intacto. Solo presentación: no se tocan montos ni estados. | S |
| FAM-16 | Sin «Elegir deportista» con un solo hijo | frontend | `AttendancePage.tsx`, `AcademicProgressPage.tsx` | No | coordinar con multisede | Un hijo: preseleccionado sin selector. Dos o más: arranca en el primero. Compatible con el selector de sede del spec multisede. | XS |
| FAM-17 | Hijos: «Familia SportMaps» + ficha con pestañas Resumen · Asistencia · Informes | frontend | `MyChildrenPage.tsx`, `ChildProgressPage.tsx`, `ChildAttendancePage.tsx`, `ChildReportsPage.tsx` | No | — | «Registrar hijo» es la acción principal. Pestañas reutilizan las páginas existentes sin duplicar consultas. Caben a 360 px, con teclado y lector de pantalla (rol `tablist`). Las rutas `/children/:id/*` siguen vivas para correo y push. | M |
| FAM-18 | Mis inscripciones: título, tarjetas en 0, pestañas | frontend | `MyEnrollmentsPage.tsx` | No | — | Título en una línea a 360 px; tarjetas en 0 ocultas; pestañas sin cortarse. | XS |
| FAM-19 | QA real P1 (tres perfiles) | qa | `docs/qa/familias-p1.md`, `docs/capturas/familias-p1/` | No | FAM-12..18 | En develop: (a) 1 hijo y 1 cobro vencido; (b) 2 hijos en escuelas distintas; (c) cobro con `parent_id` NULL. El Inicio coincide con `/my-payments` y `/children`. Menos de 2 s hasta el Inicio útil en 4G simulado. Sin errores de consola. Capturas reales. | M |
| FAM-20 | Línea base de uso, reproducible | ops | `docs/metricas/familias-uso.md` | No | — | Se guarda la consulta exacta (puntual por tabla), la fecha y la definición de «activo» (propuesta: al menos una sesión autenticada en la ventana). Las cifras 394 vinculados, 42 % en 30 días, 27 % en 7 días, 24 % push, 26 % PWA se re-miden con esa consulta antes del despliegue y se repiten a las 2 y 4 semanas. | XS |

### P2 · Informe como momento del mes, portal y ciclo semanal (semanas 3-5, 29 oct - 18 nov)

Objetivo: darle al acudiente razones para abrir la app que no sean pagar. Lote de migraciones de P2: solo FAM-33 y FAM-36 (FAM-32 ya no necesita migración).

| Id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tam. |
|---|---|---|---|---|---|---|---|
| FAM-30 | Despachador unificado en producción con kill-switch | ops | `notifications-dispatch.job.ts`, `crons-solo-en-render.ts` | No | — | `NOTIF_DISPATCH_ENABLED=true` solo en el BFF de prod de Render. Plan de rollback escrito: apagar el flag o un `DISABLE_*` equivalente corta el envío sin desplegar. Aviso de prueba a la cuenta QA llega por push en menos de 2 min. `notification_deliveries` sin filas `failed` a las 24 h. Lote de 50 sin N+1. Vigilancia las primeras 48 h por posibles ráfagas. | S |
| FAM-31 | Tarjeta «Informe de <mes> listo» en el Inicio y verificación del push | frontend/bff | `ParentHome.tsx`, `report-delivery.service.ts` | No | FAM-12 | El correo y el in-app ya enlazan a `/children/:id/reports/:reportId`; se verifica que el push (trigger del despachador) use la misma ruta y se corrige si no. La tarjeta sale de `informe_nuevo` de `get_parent_home` (`viewed_at IS NULL`). Tests de `report-delivery` verdes. | S |
| FAM-32 | Marca de «visto»: verificar y reutilizar (sin migración) | frontend | `ChildReportDetailPage.tsx`, `reportsQueries.ts`, `MonthlyReportsPage.tsx` | No | FAM-11 | Se confirma que el detalle llama a `mark_report_viewed` y que la tarjeta desaparece al abrirlo. El % de informes vistos por equipo para la escuela reutiliza la agregación `leidos` existente. No se crea columna ni RPC. | XS |
| FAM-33 | Portal por link público: DB + RPC (desde el spec `informe-atleta-link-publico.md`, §1-2) | db | `supabase/migrations/<migrations:new -- athlete_report_share_links>.sql` | Sí | plan aprobado | Plan de migración aprobado primero. Tabla con RLS activa y 0 policies. `get_athlete_report_portal(token)` `SECURITY DEFINER`, devuelve solo el snapshot publicado (sin pagos ni asistencia). Crear/revocar link con `user_staff_school_ids()`. Pruebas: `set local role anon; select count(*)` da 0; token inválido y token revocado no filtran datos; una escuela no puede crear links de otra; padres y atletas no pueden crear. Invariantes I1-I4 limpios. | M |
| FAM-34 | Portal: toggle de la escuela + página pública `/i/:token` | frontend | `AthleteReportPortalPublicPage.tsx`, `App.tsx`, `MonthlyReportsPage.tsx` | No | FAM-33, D5 | Fuera de `ProtectedRoute`, molde `AthleteCardPublicPage`; `noindex`/`X-Robots-Tag`. Solo el histórico de informes. La escuela activa o revoca y revocar invalida de inmediato. Token inválido: «Enlace no disponible». Opt-in por escuela y por atleta. Test e2e de revocación. | M |
| FAM-35 | Plan del resumen semanal «Semana de <hijo>» | docs | `docs/specs/familias-ciclo-semanal.md` | No | — | Aprobado: hora (D6), contenido (entrenos, cambios de horario, cobro próximo), un solo contacto comercial al día por familia (el transaccional no cuenta), clave de idempotencia familia+semana, opt-out, tipo de notificación y plantilla con copy en español de Colombia, filas por corrida y consultas en lote. | S |
| FAM-36 | Migración: preferencia de resumen semanal + idempotencia | db | `supabase/migrations/<migrations:new -- familia_resumen_semanal>.sql` | Sí | FAM-35 | Preferencia en la tabla de preferencias existente o columna `text + CHECK` (sin `CREATE TYPE`). `UNIQUE (user_id, iso_week)` en el registro de envíos. Va en el mismo lote que FAM-33 para regenerar `types.ts` una vez. | S |
| FAM-37 | Job semanal de familias | bff | `jobs/familia-resumen-semanal.job.ts`, `.test.ts`, `maintenance.job.ts` | No | FAM-30, FAM-36 | Solo Render prod; kill-switch `DISABLE_*`. Lee por lote con `.in('id', ids)`. Segunda corrida en la misma semana no duplica (test). Respeta el opt-out. Familia sin entrenos: no envía; familia con 2 hijos: un solo mensaje. Inserta en `notifications`; el push sale por el trigger. | M |
| FAM-38 | Preferencias de notificación y push en contexto | frontend | `SettingsPage.tsx`, `PushPermissionBanner.tsx`, `ParentHome.tsx` | No | FAM-36 | Toggles de Resumen semanal, Informe mensual y Cobros. El permiso de push se pide tras un momento de valor (primer informe visto o pago aprobado), no al entrar. iOS sin PWA muestra la guía «Agregar a inicio». | S |
| FAM-39 | QA real P2 | qa | `docs/qa/familias-p2.md`, `docs/capturas/familias-p2/` | No | FAM-31..38 | Informe de prueba en la escuela QA: llegan push y correo con deep-link correcto; se marca visto y la tarjeta desaparece; el link público abre sin sesión y deja de abrir al revocarlo; el job semanal a mano envía una notificación por familia y la segunda corrida 0. No se gasta cuota de Groq de prod. | M |

### P3 · Reservar cancha desde la app (semanas 4-7, 5 nov - 2 dic; atada a Canchas F1, F3 y F5)

Objetivo: el acudiente (y el atleta adulto, según D7) reserva en la cancha de su escuela con precio de socio y topes por familia, o en clubes desde Explorar. Si Canchas se corre, P3 se corre con ella. Se revisan las decisiones abiertas D1-D17 del plan unificado de Canchas antes de arrancar y se reflejan aquí las que afecten política de cancelación y precio de socio.

| Id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tam. |
|---|---|---|---|---|---|---|---|
| FAM-50 | «Reservar cancha» en Más e Inicio con gate por addon | frontend | `ParentMoreSheet.tsx`, `ParentHome.tsx`, `hooks/useMySchoolReservations.ts` | No | FAM-13, Canchas F3 | Con addon `reservations` y al menos una cancha publicada en la escuela del hijo, lleva a `/reservar/:slug` con sesión (booker parent, sin `guest_bookers`). Si no, a Explorar › Canchas. Sin canchas en el ecosistema, no aparece. | S |
| FAM-51 | Explorar › Canchas con el endpoint público de venues | frontend | `useExplorarGlobal.ts`, `ExplorarGlobalPage.tsx` | No | FAM-02, Canchas F5 | Lista clubes con reservas activas (nombre, ciudad, «precio desde», deporte) desde el endpoint de venues, sin tablas privadas desde el cliente. Cada tarjeta abre `/reservar/:slug`. Lista vacía: categoría oculta. | S |
| FAM-52 | Mis reservas (listar y cancelar) | frontend | `MisReservasPage.tsx`, `App.tsx`, `navigation.ts` | No | Canchas F1 | Lista reservas de la familia por RPC/BFF de Canchas; cancelar por RPC mostrando la política antes. Ningún UPDATE directo a `facility_reservations`. Prueba de aislamiento: un acudiente no ve ni cancela reservas de otra familia. | M |
| FAM-53 | Precio de socio y tope por familia visibles | frontend | `PublicFacilityBookingPage.tsx` | No | Canchas F1 | Con inscripción activa en la escuela dueña, se muestra la tarifa del segmento family/member y «X de Y reservas activas de tu familia» calculado por la RPC (`facility_booking_rules`). El frontend no calcula precios. Sin recargo de SportMaps; solo los que decida el club. | S |
| FAM-54 | Aviso de reserva confirmada y recordatorio 3 h antes | bff | `notification.service.ts` | No | FAM-30, Canchas F1 | In-app y push al confirmar; recordatorio idempotente por reserva (transaccional, no cuenta en el tope de 1 contacto comercial al día). Kill-switch. | S |
| FAM-55 | QA real P3 y concurrencia desde la app | qa | `docs/qa/familias-p3.md` | No | FAM-50..54 | Dos acudientes reservan la misma franja a la vez: uno gana, el otro recibe 409 con mensaje claro (EXCLUDE de `facility_occupancy`). Tope por familia con 2 hijos. Cancelar dentro de política libera la franja. Capturas reales en móvil. | M |
| FAM-56 | Piloto gratis 1 mes: Inicio + Reservar cancha | ventas | `docs/pilotos/familias-canchas-piloto.md` | No | FAM-55 | Ver sección 3. | S |
| FAM-57 | Landing: «Reserva canchas» solo cuando esté vivo | landing | `Deportistas.tsx` | No | FAM-55, frente 03-landing | Aparece después de que FAM-55 pase en prod, con deep-link a la app, sin cifras que no salgan de la medición. | XS |

### P4 · Aliados, medición y venta a la escuela (semanas 6-8, 19 nov - 4 dic)

| Id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tam. |
|---|---|---|---|---|---|---|---|
| FAM-70 | Tarjeta «Beneficio de aliados» (gratis 1 mes para la marca piloto) | frontend | `AllyBenefitCard.tsx`, `ParentHome.tsx` | No | FAM-12, frente marcas | Un beneficio activo del frente de marcas. Vistas y clics agregados, sin `user_id` en el reporte a la marca y sin segmentar por menores. La escuela puede apagarlo. No aparece sin beneficio activo. | S |
| FAM-71 | SportPoints F0: medir participación | db | `docs/specs/sportpoints-fidelizacion.md`, `supabase/migrations/<migrations:new -- sportpoints_f0_eventos>.sql` | Sí | FAM-32, FAM-38 | Plan aprobado antes del SQL. Eventos (acceso directo, push, informe abierto, pago a tiempo) por RPC `SECURITY DEFINER` idempotente por (usuario, tipo, día); sin escritura directa del cliente. Premia participación, nunca rendimiento del niño. Reporte semanal por escuela. Prueba de aislamiento entre usuarios. | M |
| FAM-72 | Contenido para acudientes (3 piezas) | contenido | `docs/marketing/familias/` | No | FAM-19, FAM-05 | «Cómo leer el informe mensual», «Checklist de la maleta para entreno y torneo», «Paga la mensualidad en 2 toques», con capturas reales del Inicio nuevo. Se publican después de FAM-05. | S |
| FAM-73 | Pieza de venta para la escuela (el comprador es la escuela) | landing/contenido | `docs/marketing/familias/escuela-*.md`; sección en la landing de escuelas | No | FAM-19, frente 03-landing | Una página o pieza que explique a la escuela qué gana (menos llamadas de cobro, informe visto, familias que vuelven) usando solo funciones vivas y cifras de FAM-20 medidas. Incluye la oferta de piloto gratis 1 mes. | S |

## 3. Piloto gratis por un mes

**Piloto A (desde P1/P2): Inicio nuevo + informe + resumen semanal.** A quién: 1-2 escuelas con acudientes activos (candidata natural: Athletic League por la cuenta QA; la decide el dueño). Costo para la familia: cero siempre.

**Piloto B (P3, FAM-56): Reservar cancha desde la app.** A quién: 1-2 escuelas con canchas propias que nombre el dueño (D8). El addon `reservations` va gratis 30 días con fecha de fin registrada y aviso 7 días antes.

Qué se mide (consulta guardada en FAM-20, mismo criterio de «activo» antes y después):
- Acudientes activos en 7 días en esas escuelas.
- Apertura del informe mensual (`viewed_at`) y tasa de push habilitado.
- Pagos a tiempo (informativo; sin cancelaciones por mora).
- Reservas hechas desde la app (piloto B).

Criterio de éxito: acudientes activos a 7 días de 27 % a 40 % o más en esas escuelas, y al menos 20 reservas desde la app. Firma la decisión de cobro el dueño. Al cierre hay reporte con cifras reales y propuesta de precio (Canchas Gratis hasta 2 canchas, $99k, $199k según tier).

Apagado: si no se firma el cobro al día 30, el addon pasa a su estado gratis sin borrar datos; las reservas ya confirmadas con fecha posterior al vencimiento se respetan hasta su fecha y no se aceptan nuevas por encima del límite gratis. Esto se confirma con el dueño antes de arrancar (D9). Sin comisión al cliente final.

## 4. Decisiones abiertas

| # | Decisión | Recomendación | Dueño |
|---|---|---|---|
| D1 | Qué se ve de Explorar en prod. El flag fue concebido para ocultarlo en staging/prod. | Prender solo `SHOW_EXPLORE_PARENT` en develop y prod después de FAM-02; dejar el flag global como está (la landing no cambia). | Dueño (producto) |
| D2 | ¿El acudiente ve la categoría Escuelas (otras academias)? | Ocultarla para `role=parent` con hijos inscritos. | Dueño |
| D3 | «Escribir al club»: ¿WhatsApp de la escuela por `wa.me`? ¿Con el número conectado a Meta o el teléfono de contacto? | `wa.me` con el teléfono de contacto de la escuela; si no hay, ocultar el ítem. | Dueño |
| D4 | ¿«Nuevo pago» se elimina o queda como acción secundaria para abonos voluntarios? | Acción secundaria, fuera del botón principal. | Dueño |
| D5 | Portal de informes sin login: ¿opt-in para todas las escuelas o solo Club Carmel al inicio? | Opt-in, empezando por Club Carmel. | Dueño |
| D6 | Hora del resumen semanal. | Domingo 6 p. m., hora Colombia. | Dueño |
| D7 | ¿El atleta adulto independiente recibe «Reservar cancha» en P3 o queda para el frente de deportistas? | Frente de deportistas; aquí solo acudiente. | Dueño |
| D8 | Escuelas del piloto de canchas (1-2 con canchas propias). | Las nombra el dueño. | Dueño |
| D9 | Qué pasa con las reservas si el addon vence a los 30 días. | Ver sección 3. | Dueño |
| D10 | Qué cifra decide el cobro y quién firma. | Sección 3 (40 % y 20 reservas); firma el dueño. | Dueño |

## 5. Riesgos

1. **Disk IO compartido.** El Inicio lo abre el usuario que más entra. Mitigación: una sola RPC, `staleTime` alto, sin polling, job semanal en lote. Una sola base para dev, stg y prod.
2. **Dos verdades en el ROADMAP.** UX-15 y la fila de fase 4. Mitigación: FAM-06.
3. **Explorar expone otras escuelas** a las familias de una escuela cliente. Mitigación: D2 y flag propio del acudiente.
4. **Cobros con `parent_id` NULL.** Si la RPC no los cubre, el «Por pagar» miente. Mitigación: matriz de pagador en FAM-11 y FAM-19.
5. **Despachador solo validado en dev.** Ráfagas o reintentos al encenderlo en prod. Mitigación: kill-switch, vigilancia 48 h, lote de 50.
6. **P3 depende del calendario de Canchas** (F1, F3, F5) y de sus decisiones D1-D17 abiertas.
7. **Portal público expone datos de menores por token.** RLS deny-all, solo snapshot, `noindex`, revocación inmediata, opt-in. Un error repetiría el caso `payment_links`.
8. **Sesiones paralelas** editando landing, `button.tsx`, `index.css`, `Conversaciones.tsx`, `saas-plans.ts`, y la de cambio de rol (`ElegirRolPage`, `roleContexts`, `AuthContext`, `useSchoolContext`). Commitear solo lo propio.
9. **Push solo en 24 %, PWA en 26 %.** El resumen semanal llega a pocos; se acompaña de in-app y de pedido de push en contexto.
10. **Cupo de Vercel.** 4 despliegues por push: agrupar P0.
11. **Revertir lo del 09-25** (`awaiting_approval` en el conteo): documentar la razón en FAM-04.
12. **Cifras sin fuente.** Las de FAM-20 no son citables hasta re-medirlas con consulta guardada.

## 6. Correcciones del revisor que se aplicaron

1. **Marca de «visto» ya existe** (`viewed_at`, `mark_report_viewed`, agregación `leidos`): FAM-32 pasó a verificación sin migración; FAM-36 queda sola con FAM-33 en el lote.
2. **Explorar en prod es decisión de producto**: nuevo FAM-00 (D1/D2) antes de FAM-01; flag propio del acudiente para no exponer Explorar en landing y footer.
3. **Contador de pagos**: FAM-04 cita `paymentCartera`/`isUnpaid`, unifica criterio en un helper y documenta que revierte lo del 09-25; la cifra de 4-5 consultas queda como «por medir».
4. **Landing**: alcance de FAM-05 reducido a lo que sigue prometido (42-43, 49, 185); se reconocen las líneas 89 y 175 ya honestas; la cita Google/Apple se re-verifica (no se confirmó en `Deportistas.tsx`).
5. **Huella de «Mensajes»** en `navigation.ts` (376, 432, 647): FAM-03 identifica la línea de parent y copia el patrón `school` de `MobileBottomNav.tsx:29-33`.
6. **Duplicados**: FAM-12..18 marcados como UX-15 (mockup I, J, K); FAM-31 reducido a verificar el push (correo e in-app ya enlazan al informe concreto); FAM-33/34 se ejecutan desde el spec existente; P3 enlaza el plan unificado de Canchas y sus D1-D17.
7. **Faltantes añadidos**: dueño por decisión abierta; pruebas de aislamiento y matriz de pagador (FAM-11, 33, 34, 52, 71); tests de componente y e2e (FAM-12, 34, 37); tipo de notificación, copy, kill-switch y rollback (FAM-30, 35, 37, 54); coordinación con cambio de rol y multisede; pieza de venta para la escuela (FAM-73); línea base reproducible (FAM-20); cierre y apagado del piloto (sección 3); accesibilidad y 360 px (FAM-13, 17); tarea de ROADMAP (FAM-06).
