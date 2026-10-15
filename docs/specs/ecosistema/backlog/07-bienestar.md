# Backlog 07 — Bienestar (`wellness_professional`)

> Frente: **Bienestar (fisioterapia, nutrición, psicología deportiva)** · Versión final con las correcciones del revisor · 14-oct-2026
> Fuentes: `docs/plan-maestro-ecosistema-2026-10.md` (§2.2, §3, E3), `docs/specs/ecosistema/roles-entrenadores-bienestar.md`, `docs/specs/profesionales-salud-fisioterapia.md`, `docs/specs/facturacion-saas-multirol-comprobantes.md` (BLQ-10), `docs/specs/profesionales-independientes-agentes-ia.md`, `docs/plan-agresivo-canchas-2026-10.md`, `docs/specs/reservas-canchas-plan-unificado-2026-10.md`, `docs/ROADMAP.md`.
> Este backlog **reemplaza a BLQ-5 «Wellness Pro W1–W5»** (`docs/ROADMAP.md:1713`). Ver la tarea BW-P0-8.

**Decisiones del dueño que aplican aquí (14-oct):**

- Bienestar cuesta **$59.000/mes** y sube a **~$119.000** cuando exista el cobro dentro de la app (F4).
- **Todo piloto es gratis por un mes.**
- **No hay comisión al paciente.** Los recargos solo existen si el profesional los configura.
- **La mora no cancela nada:** ni citas, ni pacientes, ni acceso a historias clínicas.
- La landing solo publica lo que corre en la app.

**Reglas técnicas que rigen todas las tareas** (CLAUDE.md del repo):

- Las migraciones son inmutables y se crean con `npm run migrations:new -- <slug>`.
- **Una sola sesión aplica migraciones**, por una vía que deje rastro. `gen types` corre una vez, al final de cada lote.
- No se usan `list_tables` ni `get_advisors` como sondeo: se consulta `pg_proc` o `pg_policies` filtrando por nombre.
- Crear varias filas va en una RPC `SECURITY DEFINER` transaccional, con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE` explícito. También se revoca explícitamente a `anon` y `authenticated` donde corresponde.
- Los estados van como `text + CHECK`, nunca con `CREATE TYPE`.
- Las policies no se leen a sí mismas (sin self-recursion). La escritura usa `user_staff_school_ids()`; lo que otorga permisos, `user_admin_school_ids()`. **Nunca** se escribe con `user_school_ids()`.
- Cada feature es full-stack: DB, RLS, RPC, BFF, frontend y QA, con una rama por fase. **El plan de migraciones se aprueba antes de escribir SQL.**
- Los jobs no hacen N+1.
- Cada cambio de RLS cierra con `npm run seguridad:invariantes` y `npm run seguridad:rls-clinicas`.

---

## 1. Resumen y estado actual verificado

La parte clínica (F0–F3) está construida:

- Pacientes y consentimientos versionados (Ley 1581).
- Agenda con antisolape.
- Historia clínica inmutable (Res. 1995).
- Lesiones y vuelta al juego.
- Semáforo de disponibilidad que ve el coach.
- Ejercicios en casa.

Las migraciones `20261006094145`, `…94147`, `…94149` y `20261006111003` están en el repo. Las rutas están cableadas en `App.tsx` (384, 896, 913-973) y el menú en `navigation.ts:555-584`.

**Lo que impide venderlo no es lo clínico:**

1. **El profesional no puede pagarnos.** «Facturación» lleva a `/mi-plan`, que le contesta «Esta sección no es para tu cuenta». Además, el tarifario oficial (BLQ-10 / D-FAC-1) todavía dice Wellness Pro $149k.
2. **La landing está a medio corregir y sin commitear.** Otra sesión ya dejó Bienestar en $59.000. Lo que sigue prometiendo «pagos integrados» y «WhatsApp IA» es la tarjeta **«Servicios»**, que se dirige al mismo consultorio.
3. **El profesional no tiene cómo cobrarle al paciente.**
4. **No hay perfil ni agenda pública del profesional.** Tampoco hay un directorio para familias: «Explorar Bienestar» abre métricas corporales.
5. **La escuela no puede vincular a «su fisio».** Además, los atletas sin cuenta (`unregistered_athletes`) no pueden ser pacientes.
6. **Nutrición es una maqueta.**

| Capacidad | Estado | Evidencia |
|---|---|---|
| Onboarding del profesional y verificación por el admin de plataforma | Funciona, con una salvedad | `pages/onboarding/WellnessOnboarding.tsx` (`/onboarding/wellness`, App.tsx:384); `bff/src/routes/marketplace-admin.routes.ts` + `AdminMarketplaceModerationPage`. El spec registra **3 de 6 perfiles wellness sin `vendor_profiles`**: hay que verificar que el onboarding lo crea (BW-P0-2), porque la pasarela y el perfil público cuelgan de él |
| Pacientes (atleta de escuela vía invitación al acudiente, o externo) + consentimientos versionados | Funciona | `pages/clinical/PatientsPage.tsx`, `ClinicalInviteAcceptPage.tsx`; RPCs `create_clinical_invite`/`accept_clinical_invite`/`grant_clinical_consents` en `20261006094147` (292-553); `lib/clinical/api.ts` |
| Paciente desde `unregistered_athletes` (atleta sin cuenta) | No existe | `clinical_patients.unregistered_athlete_id` existe con UNIQUE (`20261006094147:48,76,80`), pero las RPCs de invitación lo ponen en NULL (`:511`, `:522`). El guard está en `:113-121` |
| Agenda, disponibilidad, excepciones, antisolape y recordatorio a 24 h (in-app/push) | Funciona | `pages/clinical/AvailabilityPage.tsx`, `WellnessSchedulePage` (`/schedule`); `validate_appointment_no_overlap` + `service_availability_exceptions` en `20261006094145`; pg_cron `wellness-appointment-reminders` **cada 15 min** (`20261006094147:831`) |
| Aviso al profesional de una cita nueva | Funciona | Trigger `fn_wellness_appointment_notify` (`20261006094147:610-671`). `request_service_appointment` crea la cita como `pending` o `courtesy` (`:677-760`) |
| Historia clínica inmutable (episodios, SOAP, CIE-10, adjuntos, PDF, log de acceso) | Funciona | `pages/clinical/PatientDetailPage.tsx`, `PatientRecordPrintPage.tsx`; tablas `clinical_episodes/notes/diagnoses/attachments/access_log` en `20261006094147` |
| Lesiones, vuelta al juego, ejercicios en casa, vista del acudiente y disponibilidad para el coach | Funciona | `20261006094149` (`athlete_injuries`, `exercise_*`, `get_school_athlete_availability`); `/salud` → `MyHealthPage.tsx`; `/disponibilidad-medica` → `SchoolAvailabilityPage.tsx` (App.tsx:969) |
| Gates I7 (`20261006111003_profesionales_gates_i7`) vivos en la base | Por verificar (los documentos se contradicen) | El encabezado del spec dice «Pendiente aplicar 20261006111003» (`profesionales-salud-fisioterapia.md:3`). El ROADMAP (`:108-113`) declara entregado «F0–F3 + i7» en `origin/main`. Que esté en main no prueba que esté vivo: BW-P0-2 |
| `create_service_checkout` (checkout de servicios viejo) | Por verificar | Solo aparece en `20260417000003_unified_marketplace_payments.sql`. Hay ~82 migraciones sin registro que sí están aplicadas, así que **no se puede afirmar que no esté vivo** sin `pg_proc`. Lo llama `POST /checkout/service`, detrás de `requireStoreEnabled` (`bff/src/routes/marketplace-checkout.routes.ts:84,93`) |
| Plan del profesional comprable en `/mi-plan` | Roto | El nav «Facturación» → `/mi-plan` (`navigation.ts:582`). `MiPlanPage.tsx:188-191` limita `canManagePlan` a roles de escuela, y en `:256-262` dice «Esta sección no es para tu cuenta». BLQ-10 está «sin ejecutar» y su tarifario oficial (xlsx + D-FAC-1) dice Wellness Pro **$149k** con descuento por combo |
| Landing de bienestar honesta | Parcial, sin commitear (otra sesión) | En la **copia de trabajo**: `RolePricingSection.tsx:302-329` ya dice Wellness Pro $59.000, sin «Clínica», con «Cobro de consultas dentro de la app: próximamente» y `WHATSAPP_IA_PROXIMAMENTE`; `Bienestar.tsx:175` y `BienestarModule.tsx:61` también en $59.000. En **HEAD** todavía están 149000 (328-329) y Clínica 379000 (346-347). Lo que sigue mal en la copia de trabajo es la tarjeta **«Servicios»** (`RolePricingSection.tsx:417-470`): Servicio Pro $109k, «Agenda online + pagos integrados» (:445), «WhatsApp IA: confirmaciones y seguimiento» (:447), «Hasta 10 clientes» (:432) y «Reseñas verificadas». La landing tiene 30 archivos modificados sin commitear |
| Nombre del plan | Inconsistente | El plan original decía «Bienestar Individual» y la landing dice «Wellness Pro». Se unifica en BW-P0-1 y BW-P0-3 |
| Cobro del profesional a su paciente (F4) | No existe | `wellness_appointments` ya tiene `price`/`payment_status`/`is_courtesy` (`20261006094145:53-57`). No hay libro de cobros del profesional |
| Paquetes de sesiones / créditos | No existe | grep `paquete\|packages` en `2026100609414*` sin resultados |
| Pasarela propia (Wompi/MP) del profesional | Parcial: el BFF existe y falta la UI | `bff/src/routes/payment-providers.routes.ts:224-320` ya tiene `GET/POST /payment-providers/vendor/:vendorId`. Verifica el dueño (`req.user.id === vendorId`) o admin global y cifra los secretos (`vendorSecretsEnc`). El resolver está en `payment-provider.resolver.ts:9-10,45`. `vendor_payment_provider_secrets` se crea en `20261003230013:75` (en `:15` y `:90` hay un ALTER sobre `vendor_payment_providers`, que no nace ahí). **La única UI llama a `/school/`**: `SportMapsPaySettings.tsx:151`, `SchoolStoreSettingsPage.tsx` |
| Perfil público y agenda pública del profesional | No existe | Existen `/entrenador/:userId` y `/agendar/:slug` (canchas). `/vendor/public-profile` es la vista privada de edición (App.tsx:896). Las rutas `salud` y `salud/invitacion/:token` ya están ocupadas (App.tsx:959-967) |
| Directorio de profesionales para familias | No existe (y la etiqueta engaña) | «Explorar Bienestar» del menú del acudiente (`navigation.ts:318`) lleva a `/wellness` → `AthleteWellnessPage` → `WellnessModule`: métricas corporales con `useBodyMetrics` (`WellnessModule.tsx:138`), no un directorio |
| Fisio de la escuela (vínculo escuela↔profesional) | No existe | No hay tabla, RPC ni pantalla. La escuela solo ve `/disponibilidad-medica` |
| Marketplace de servicios con pago (F5) | No existe | `store_enabled()=false` (`20261002125959`); no existe `services_marketplace_enabled`; `MarketplacePage` manda los servicios al carrito; la policy de `vendor_reviews` exige un pedido de producto |
| Nutrición | Maqueta | `NutritionPage.tsx:22` `mockPlans=[]` (`/nutrition`, App.tsx:953-957, solo wellness/admin/super_admin por URL). **No hay ítem de nutrición en `navigation.ts`.** `docs/specs/nutricion-atletas-independientes.md` es una «propuesta, sin código» |
| Recordatorio de cita por WhatsApp | No existe | `send_wellness_appointment_reminders` solo envía in-app/push. El canal WhatsApp está atado a la escuela y ningún club está conectado. Se cruza con `profesionales-independientes-agentes-ia.md` («propuesta, sin código») |
| Límite del plan Free | No existe | `clinical_patients` (`20261006094147:41`) no tiene gate por plan y en la base no existe un plan por rol. La landing dice «Hasta 10 clientes» (servicios) y el plan original decía 5 pacientes: se decide en BW-P0-3 |
| Adopción | Casi nula | 6 perfiles wellness y ningún uso clínico real al 06-oct (spec) |

---

## 2. Fases

Convenciones:

- **Tamaños:** XS menos de medio día, S 1 día, M 2-3 días, L 4-6 días.
- **Migración «sí»:** la tarea crea un `.sql` nuevo con `npm run migrations:new` y lo commitea junto al ledger. Solo la aplica la sesión única de migraciones, después del plan aprobado de su fase.
- **Frentes:** `frente:landing`, `frente:planes-multirol` (BLQ-10), `frente:whatsapp`, `frente:familias` (Explorar).

### P0 — Urgente: vendible y honesto esta semana

**Objetivo:** que solo se publique lo que corre, que el precio de $59k quede en **una sola fuente** alineada con BLQ-10, que el profesional pueda pedir su piloto gratis desde `/mi-plan` y que el recorrido clínico quede probado en la app corriendo.

**Semanas:** semana 1 (14-18 oct). **Rama:** `feat/bienestar-p0`.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| BW-P0-1 | Landing: **coordinar y commitear** lo que ya hizo la otra sesión en bienestar y completar lo que falta: «Primer mes gratis», el límite Free decidido en BW-P0-3, un nombre único («Wellness Pro» en todas partes) y la decisión sobre la tarjeta **«Servicios»** (retirarla o fusionarla con bienestar) | landing | `Landing_page/…/frontend/src/components/common/cards/RolePricingSection.tsx` (302-329 bienestar; 417-470 servicios), `pages/Bienestar.tsx`, `components/modules/BienestarModule.tsx`, `config/saas-plans.ts`, `public/llms-full.txt` | No | frente:landing, BW-P0-3 (nombre, Free y precio) | Primero se pregunta a la sesión que tiene los 30 archivos M. Se commitea **solo lo propio con índice temporal**, sin pisar sus cambios. `grep -iE 'pagos integrados\|WhatsApp IA\|24/7\|200\+\|1\.500\|149000\|379000\|Hasta 10 clientes\|Reseñas verificadas'` sobre esos archivos **incluida la tarjeta servicios** no encuentra nada de bienestar o servicios, salvo textos con «próximamente». La tarjeta dice $59.000/mes, «Primer mes gratis», «Historia clínica Res. 1995 + consentimiento del acudiente Ley 1581» y «sin comisión al paciente». El build de la landing pasa | S |
| BW-P0-2 | Verificar la base viva, solo lectura y por nombre: (a) gates I7 (`prosrc` de `get_clinical_invite`, `unlog_exercise_done`); (b) si `create_service_checkout` existe en `pg_proc`; (c) que el onboarding crea `vendor_profiles` (los 3 de 6 perfiles sin fila); (d) **todas** las policies y los GRANT de `vendor_profiles` frente a `anon` (la auditoría del 02-oct registró `bank_data` visible para anon) | qa | `supabase/migrations/20261006111003_profesionales_gates_i7.sql`, `docs/specs/profesionales-salud-fisioterapia.md`, `docs/ROADMAP.md`, `frontend/src/pages/onboarding/WellnessOnboarding.tsx` | No (si I7 falta, se aplica la migración que ya existe, desde la sesión única y por la vía con rastro) | — | Consultas puntuales a `pg_proc`/`pg_policies`, sin `list_tables` ni `get_advisors`. `npm run seguridad:rls-clinicas` da 53/53 y `seguridad:invariantes` no tiene CRÍTICAS en tablas clínicas. Se corrige el documento que esté mal (encabezado del spec **o** ROADMAP) con la fecha. Se registra si `create_service_checkout` está vivo, como insumo de BW-P2-3. `set local role anon; select … from vendor_profiles` documenta qué columnas se ven. Si el onboarding no crea `vendor_profile`, se abre un bug con archivo:línea, que bloquea BW-P1-6 y BW-P2-4 | S |
| BW-P0-3 | **Alinear el precio con BLQ-10 (decisión del dueño):** actualizar D-FAC-1 y el tarifario oficial (`sportmaps-combinaciones-modulos (2).xlsx`) de Wellness Pro $149k a $59k, definir cómo entra en el descuento por combo, fijar el límite Free (5 pacientes activos o 10 clientes, uno solo) y el nombre único | producto | `docs/specs/facturacion-saas-multirol-comprobantes.md`, `docs/ROADMAP.md` (BLQ-10), tarifario xlsx | No | frente:planes-multirol | La decisión queda escrita en el spec de BLQ-10 con fecha 14-oct. El xlsx y D-FAC-1 dicen $59.000. Queda un **único** límite Free, que se usa en la landing, en `/mi-plan` y en BW-P1-9. Ninguna otra tarea de precio arranca sin esto | XS |
| BW-P0-4 | `/mi-plan` para `wellness_professional`: mostrar Free y Wellness Pro $59.000/mes con «primer mes gratis», leyendo de **`frontend/src/config/saas-plans.ts` extendido** (sin crear `role-plans.ts`). Un botón abre `wa.me/573202683539` con mensaje prellenado (id del profesional). **Puente con rastro:** cada activación se anota en `docs/pilotos/bienestar-activaciones.md` hasta que exista BLQ-10 | frontend | `frontend/src/pages/MiPlanPage.tsx` (188-191, 256-262), `frontend/src/config/saas-plans.ts` | No | BW-P0-3, frente:planes-multirol | Antes se coordina con la sesión que tiene `saas-plans.ts` modificado (16+/14-) y se commitea solo lo propio. Logueado como wellness_professional, `/mi-plan` ya no dice «Esta sección no es para tu cuenta». Los roles de escuela ven `ACADEMY_TIERS` igual que antes. El precio es idéntico al de la landing porque sale de la misma constante. tsc y build pasan. El registro manual tiene responsable (super_admin) y columnas: profesional, fecha de alta, fin del piloto, estado | S |
| BW-P0-5 | Honestidad dentro de la app: `NutritionPage` muestra «Próximamente» sin botones muertos, y el ítem del acudiente **«Explorar Bienestar»** cambia de etiqueta («Mi bienestar» / «Métricas corporales») porque hoy no es un directorio | frontend | `frontend/src/pages/NutritionPage.tsx`, `frontend/src/config/navigation.ts:318` | No | — | `/nutrition` muestra una tarjeta «Próximamente», sin «Nuevo plan» ni «Nutrición completa». La etiqueta del acudiente ya no promete encontrar profesionales. Build pasa. (El menú no tiene ítem de nutrición: no hay nada más que quitar) | XS |
| BW-P0-6 | QA real del recorrido completo del fisio en la app corriendo (independiente + acudiente + coach) | qa | `frontend/src/pages/clinical/*`, `components/marketplace/ServiceBookingModal.tsx`, `pages/wellness/MyAppointmentsPage.tsx`, `pages/vendor/VendorDashboardPage.tsx` | No | BW-P0-2 | Con cuentas `@rls-pruebas-negativas.invalid`, en frontend + BFF local apuntando a dev, se completa sin error: onboarding (verificando que se crea el `vendor_profile`) → servicio → disponibilidad → paciente hijo de un acudiente → invitación aceptada con consentimiento → cita confirmada, **comprobando que llega el aviso al profesional por el trigger que ya existe** → nota SOAP + addendum → lesión «restringido» → el coach ve solo el semáforo en `/disponibilidad-medica` → el acudiente ve plan y ejercicios en `/salud` → cancelación por RPC. Capturas en `docs/capturas/bienestar-qa-2026-10/` y bugs con archivo:línea. **No se purgan datos:** las cuentas de prueba quedan. `purge_clinical_test_data` solo corre con service_role y las eliminaciones las maneja el usuario. El BFF local se apaga al terminar | M |
| BW-P0-7 | Kit comercial «Fisio de la escuela» + **cuenta demo** de profesional con datos `is_demo` + guion de demo para el equipo comercial | ventas | `docs/manuales/_src/bienestar-fisio-escuela/` (nuevo), `docs/manuales/comercial/fisio-de-la-escuela.pdf` (nuevo), `docs/manuales/comercial/guion-demo-bienestar.md` (nuevo) | No | BW-P0-6, BW-P0-3 | El PDF usa capturas reales de BW-P0-6 (patrón único de PDFs), sin cifras ni personas inventadas. Dice $59.000 y «primer mes gratis, sin permanencia, sin comisión al paciente». La cuenta demo no toca datos reales y queda dentro del seed `is_demo`. El guion recorre solo lo que corre hoy | S |
| BW-P0-8 | Marcar BLQ-5 «Wellness Pro W1–W5» como **reemplazado** por este backlog, para que no queden dos líneas de trabajo abiertas | docs | `docs/ROADMAP.md:1713` | No | — | BLQ-5 apunta a `docs/specs/ecosistema/backlog/07-bienestar.md`, con estado «reemplazado 14-oct» | XS |

### P1 — Fisio de la escuela, verificación, agenda pública y piloto

**Objetivo:**

- Que una escuela pueda vincular a su fisio y que el fisio cargue a sus atletas en lote, **incluidos los que no tienen cuenta**.
- Que cada profesional **verificado** tenga una página pública para agendar.
- Que el ciclo del piloto quede automatizado.
- Arrancar el piloto gratis con 3 a 5 profesionales.

**Semanas:** 2 a 4. **Rama:** `feat/bienestar-p1`. **Lote de migraciones:** BW-P1-1, -2, -5, -6, -8 y -9. Las aplica una sola sesión y `gen types` corre una vez al final.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| BW-P1-0 | Plan de migraciones P1 para aprobar antes de escribir SQL. Cubre: vínculo escuela↔profesional y su **función de alcance de lectura**; **cómo entra un atleta sin cuenta** (`unregistered_athletes`); verificación mínima ReTHUS; slug público y la revisión completa de `vendor_profiles` frente a anon; recordatorio WhatsApp como extensión del cron que ya existe; límite Free sobre el catálogo de BLQ-10; **retención y derechos ARCO** cuando el profesional deja de pagar o se da de baja | db | `docs/specs/profesionales-p1-plan-migraciones.md` (nuevo) | No | BW-P0-2, BW-P0-3 | Cada tabla lleva `text + CHECK`, cada policy va por comando con `WITH CHECK` y cada RPC con `search_path` y GRANT/REVOKE explícitos (también a `anon` y `authenticated`). Incluye el radio de impacto. Decide: (1) un atleta sin cuenta entra con consentimiento por enlace al teléfono del acudiente, o con una invitación que crea la cuenta, **sin violar `VINCULO_SOLO_POR_INVITACION`**; (2) el vínculo nunca da lectura clínica a la escuela; (3) la Res. 1995 obliga a conservar la historia, así que **el plan Free ni la falta de pago bloquean el acceso a historias ya creadas**; (4) el recordatorio por WhatsApp se reconcilia con `profesionales-independientes-agentes-ia.md` y queda un solo canal. La aprobación del dueño queda registrada antes de BW-P1-1 | M |
| BW-P1-1 | Migración: `school_professional_links` (`school_id`, `professional_id` → `profiles`, `status text CHECK (invited/active/revoked)`) + RPCs `invite_school_professional` / `accept_school_professional_link` / `revoke_school_professional_link` (SECURITY DEFINER) | db | `supabase/migrations/<npm run migrations:new -- bienestar_vinculo_escuela_profesional>.sql`, `supabase/migrations_ledger.json` | Sí | BW-P1-0 | Invitar y revocar exigen `user_admin_school_ids()`. Aceptar solo lo puede el profesional invitado. La lectura del vínculo usa la función decidida en BW-P1-0 (staff o admin de la escuela, y el propio profesional), **nunca `user_school_ids()`**. `rls-pruebas-clinicas.mjs` afirma que ni `user_school_ids()` ni el vínculo dan lectura clínica: un admin de escuela lee 0 filas de `clinical_notes`. `migrations:check` e invariantes limpios. Sin self-recursion | M |
| BW-P1-2 | RPC transaccional `create_clinical_patients_from_roster(school_id, child_ids[], unregistered_athlete_ids[])`: crea pacientes + invitaciones o solicitudes de consentimiento en una transacción | db | `supabase/migrations/<bienestar_pacientes_desde_roster>.sql` | Sí | BW-P1-1 | Solo opera con un vínculo `active` con esa escuela y con atletas de matrícula activa. Para `unregistered_athlete_ids` aplica el mecanismo de consentimiento de BW-P1-0 y llena `unregistered_athlete_id`, sin escribir `child_id` fuera de la vía de invitación. Si un atleta falla, no queda ningún paciente a medias (rollback). Prueba de concurrencia: dos llamadas iguales no duplican pacientes (UNIQUE `:76,80`) | M |
| BW-P1-3 | Frontend escuela: «Profesionales de salud» (invitar al fisio por correo o WhatsApp, ver el vínculo activo, revocar), junto a Disponibilidad médica | frontend | `frontend/src/pages/clinical/SchoolProfessionalsPage.tsx` (nuevo), `App.tsx`, `config/navigation.ts`, `lib/clinical/api.ts` | No | BW-P1-1 | El dueño o admin de la escuela invita y el coach no ve el botón. El profesional acepta desde el enlace y la escuela lo ve activo. Aparece en **los dos árboles de menú** (`school` y `school_admin`). tsc y build pasan | M |
| BW-P1-4 | Frontend fisio: selector de escuela vinculada en Pacientes → elegir equipo o atletas (con y sin cuenta) → crear pacientes e invitaciones en lote; estado del consentimiento por atleta | frontend | `frontend/src/pages/clinical/PatientsPage.tsx`, `components/clinical/ImportRosterDialog.tsx` (nuevo), `lib/clinical/api.ts` | No | BW-P1-2 | Un fisio vinculado importa un equipo de 20, **incluidos los atletas sin cuenta**, en una sola acción. Cada atleta muestra «consentimiento pendiente» o «firmado». La historia no se abre sin consentimiento vigente (el error de la RPC se traduce con `clinicalErrorMessage`). Los errores de carga se muestran como error, nunca como tabla vacía | M |
| BW-P1-5 | Migración: **verificación mínima ReTHUS** (número de tarjeta profesional o registro ReTHUS, `verification_status text CHECK (pending/verified/rejected)`, quién y cuándo verificó) + flujo de verificación en la moderación del admin de plataforma | db | `supabase/migrations/<bienestar_verificacion_rethus_minima>.sql`, `bff/src/routes/marketplace-admin.routes.ts`, `frontend/src/pages/admin/AdminMarketplaceModerationPage.tsx` | Sí | BW-P1-0 | Solo un admin de plataforma (`platform_admins`, no `profiles.role`) cambia el estado a `verified`. El aviso de «nuevo profesional por verificar» llega a `platform_admins`. Un profesional sin `verified` no puede ser público (lo exige BW-P1-6) | M |
| BW-P1-6 | Migración: slug público en `vendor_profiles` + vista `v_wellness_professional_publico` (solo columnas publicables) + `get_public_professional(slug)`, **solo para profesionales con ReTHUS `verified`** | db | `supabase/migrations/<bienestar_perfil_publico_slug>.sql` | Sí | BW-P1-5, BW-P0-2 (d) | Antes de crear la vista se listan **todas** las policies de `vendor_profiles` y se cierra lo que BW-P0-2 haya encontrado expuesto a anon (`bank_data`). anon lee solo las columnas publicables de profesionales verificados. `set local role anon` sobre `vendor_profiles` no expone documentos ni `bank_data`. Si la vista es `security_invoker`, se mide que no dé timeout (patrón LATERAL). El slug es UNIQUE y su formato kebab-case se valida por CHECK | S |
| BW-P1-7 | Página pública **`/profesional/:slug`** con servicios, precio de referencia, horarios libres (`get_available_slots`) y «Agendar» (login con redirect → `request_service_appointment`) | frontend | `frontend/src/pages/public/ProfessionalPublicPage.tsx` (nuevo), `App.tsx`, `pages/vendor/VendorPublicProfilePage.tsx`, `components/marketplace/ServiceBookingModal.tsx` | No | BW-P1-6 | La ruta **no** usa el prefijo `/salud` (ocupado por `MyHealthPage` y `salud/invitacion/:token`, App.tsx:959-967). Un visitante sin sesión ve la página y los horarios. Al agendar va al login y vuelve al mismo horario. En QA se **verifica** (no se construye) que la cita nace `pending` y que llega el aviso por `fn_wellness_appointment_notify`. Hay un botón «Copiar mi enlace» en `/vendor/public-profile`. Funciona a 360 px sin scroll horizontal y con fechas en hora Colombia | M |
| BW-P1-8 | Recordatorio de cita por WhatsApp con plantilla (sin agente) desde el número de SportMaps y con opt-in del paciente, **extendiendo `send_wellness_appointment_reminders`** y el pg_cron que ya corre cada 15 min, sin un sondeo nuevo | bff | `bff/src/jobs/wellness-reminders.ts` (nuevo, si BW-P1-0 decide que el envío va por el BFF), `supabase/migrations/<bienestar_recordatorio_whatsapp_optin>.sql` | Sí | frente:whatsapp, BW-P1-0, BW-P0-6 | No se suma otro sondeo a la base: el cron que ya existe marca lo que hay que enviar y **un solo BFF** (prod) lo envía en lote con `.in()`, sin N+1. Es idempotente: un solo envío por cita. Respeta el opt-in. Se prueba en dev contra un número de QA. La plantilla queda aprobada en Meta. Queda un solo canal, conciliado con el spec de agentes IA | M |
| BW-P1-9 | Migración + gate: límite Free (el valor único de BW-P0-3) y estado del plan del profesional (`trial_ends_at` del piloto), **leídos del catálogo multirol de BLQ-10** | db | `supabase/migrations/<bienestar_plan_rol_y_limite_free>.sql`, `frontend/src/pages/clinical/PatientsPage.tsx` | Sí | frente:planes-multirol (BLQ-10 F1), BW-P1-0 | Con plan Free, crear un paciente activo por encima del límite devuelve `LIMITE_PLAN_FREE` y la UI ofrece el plan. Con piloto o plan activo no hay límite. **Los pacientes existentes y sus historias nunca se bloquean, ocultan ni borran**: solo se impide crear nuevos. El estado sale del catálogo de BLQ-10 (`owner_type`/`owner_id`), sin un camino aparte | M |
| BW-P1-10 | Avisos del ciclo del piloto: el **día 25** llega la oferta de $59.000 y **al vencer** pasa a Free, por in-app, push y correo (Resend) | bff | `bff/src/jobs/` (job diario existente o uno nuevo en un solo BFF), `bff/src/services/` de notificaciones y correo | No | BW-P1-9 | Corre en lote y en un solo BFF. Es idempotente: un aviso por profesional y por hito. Al vencer **no se bloquea nada**: se aplica el límite Free a los pacientes nuevos. Mientras BW-P1-9 no esté vivo, el super_admin manda los avisos a mano desde `docs/pilotos/bienestar-activaciones.md` | S |
| BW-P1-11 | QA real de P1: escuela → fisio → importar roster (con y sin cuenta) → el acudiente firma → verificación ReTHUS → página pública → reserva; RLS negativas de los objetos nuevos | qa | `scripts/seguridad/rls-pruebas-clinicas.mjs` (casos nuevos), `docs/capturas/bienestar-p1/` | No | BW-P1-3, BW-P1-4, BW-P1-7, BW-P1-9 | `rls-clinicas` pasa con los casos nuevos: un admin de escuela no lee clínica, `user_school_ids()` no abre nada, un fisio no vinculado no importa el roster, anon no lee columnas privadas y un profesional no verificado no es público. Invariantes limpios. El recorrido queda grabado con capturas en la app corriendo. No se purgan datos | M |
| BW-P1-12 | **Piloto gratis 1 mes:** 3 a 5 profesionales (al menos 1 fisio de una escuela cliente), con alta acompañada y métricas semanales | ventas | `docs/pilotos/bienestar-piloto-2026-10.md` (nuevo), `docs/pilotos/bienestar-activaciones.md` | No | BW-P0-4, BW-P0-7, BW-P1-11, BW-P1-9 (o registro manual si BLQ-10 no está) | La lista la nombra el dueño. Si BW-P1-9 está vivo, cada profesional queda con `trial_ends_at = alta + 30 días`; si no, se lleva **a mano** en `docs/pilotos/` con la misma fecha. Ver la sección 3 | S |

### P2 — F4: cobro del profesional con su cuenta conectada

**Objetivo:** que el profesional cobre sesiones y paquetes con su propia pasarela (Wompi o MP) o registre efectivo y transferencias. Todo sin comisión al paciente y con los ingresos reales en su panel. Habilita subir el plan a ~$119.000.

**Semanas:** 4 a 8. **Rama:** `feat/bienestar-p2-f4`. **Lote de migraciones:** BW-P2-1 y BW-P2-6.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| BW-P2-0 | Diseño y plan de migraciones F4: libro propio del profesional (sin `school_id`) que reusa `vendor_payment_providers`/`_secrets`; censo frente a los 13 caminos que crean `payments` | db | `docs/specs/profesionales-f4-cobro-plan-migraciones.md` (nuevo), `docs/specs/profesionales-salud-fisioterapia.md` | No | BW-P1-0, BW-P1-12 (al menos 2 semanas de piloto con uso real) | Decide que el cobro **no** entra en `payments` (no se abre el camino nº 14) y lo justifica: D1 (el custodio es el profesional) y las 3 agregaciones de ingreso. Define `professional_charges`, `service_packages` y `patient_package_balances` con estados `text + CHECK`, el flujo crédito → consumo, la conciliación del webhook, los reembolsos y que no hay recargo salvo que el profesional lo configure. **Ninguna mora cancela citas.** Resuelve si el efectivo y la transferencia van desde el día 1 (decisión abierta). Lo aprueba el dueño antes de BW-P2-1 | M |
| BW-P2-1 | Migración F4: `service_packages`, `patient_package_balances`, `professional_charges` + RPCs `create_professional_charge`, `purchase_package` (transaccional) y consumo de crédito al completar la cita (`FOR UPDATE`) | db | `supabase/migrations/<bienestar_f4_cobro_paquetes>.sql`, `supabase/migrations_ledger.json` | Sí | BW-P2-0 | El saldo de créditos solo se muta en RPCs SECURITY DEFINER con `SELECT … FOR UPDATE`. Prueba de concurrencia: completar dos citas en paralelo con un crédito restante consume uno solo. El paciente o acudiente solo lee sus cobros, y el profesional solo escribe los suyos. I1-I4 limpios. `gen types` una sola vez, al final del lote | L |
| BW-P2-2 | BFF de pasarela del profesional, **reducido a lo que falta**: validar las credenciales contra la pasarela antes de guardarlas (sandbox en dev) + tests del resolver para el caso vendor profesional. Los endpoints `/payment-providers/vendor/:vendorId`, la verificación del dueño y el cifrado **ya existen** | bff | `bff/src/routes/payment-providers.routes.ts:224-320`, `bff/src/services/payment-provider.resolver.ts` | No | BW-P2-0, BW-P0-2 (c) | Unas credenciales inválidas se rechazan antes de persistir. Los secretos nunca vuelven al cliente (test). Los tests unitarios del resolver cubren al vendor profesional (`vendor_profile` de un wellness_professional) | S |
| BW-P2-3 | BFF: checkout de cobro o paquete del profesional (`POST /checkout/professional-charge`, sin el gate `store_enabled`) + webhook idempotente en Wompi y MP, por prefijo de referencia y con verificación de monto | bff | `bff/src/routes/marketplace-checkout.routes.ts`, `bff/src/routes/wompi.ts`, `bff/src/routes/mercadopago.ts`, `bff/src/services/webhook-events.service.ts` | No | BW-P2-1, BW-P2-2 | El pago va a la cuenta del profesional, nunca al comercio de SportMaps. Un webhook repetido no duplica el crédito (test tipo `wompi.doble-pago.test.ts`). Un monto que no coincide se rechaza y queda auditado. `/checkout/service` se retira o se redirige según lo que BW-P0-2 haya encontrado de `create_service_checkout` en la base | L |
| BW-P2-4 | Frontend profesional: «Cobros» (**UI para configurar la pasarela** sobre `/payment-providers/vendor/:vendorId`, crear un cobro o paquete, enviar el enlace por WhatsApp, registrar efectivo o transferencia si BW-P2-0 lo aprueba, saldo de créditos por paciente) + ingresos reales en Inicio | frontend | `frontend/src/pages/clinical/ProfessionalBillingPage.tsx` (nuevo), `components/settings/VendorPaymentSettings.tsx` (nuevo, separado de `SportMapsPaySettings`, que llama a `/school/`), `pages/vendor/VendorDashboardPage.tsx`, `config/navigation.ts`, `lib/clinical/billing.ts` (nuevo) | No | BW-P2-3 | El profesional configura su pasarela sandbox, crea un paquete de 10 sesiones y comparte el enlace. Después del pago ve los créditos del paciente, y al completar una cita el saldo baja. «Ingresos (30 días)» sale de `professional_charges` pagados, no de `orders`. Los errores de carga se muestran como error, nunca como tabla vacía | L |
| BW-P2-5 | Frontend paciente o acudiente: página pública de pago `/pago-salud/:token` y botón «Pagar» en `/salud` y en Mis citas | frontend | `frontend/src/pages/public/ProfessionalChargePublicPage.tsx` (nuevo), `pages/clinical/MyHealthPage.tsx`, `pages/wellness/MyAppointmentsPage.tsx`, `App.tsx` | No | BW-P2-3 | El acudiente paga el cobro de su hijo desde el celular sin comisión agregada. El estado pasa a «pagado» por el webhook, no por el cliente. El token no permite enumerar otros cobros (RPC SECURITY DEFINER que recibe el token, sin policy `…_by_token`) | M |
| BW-P2-6 | Factura electrónica del profesional (Factus, `owner_type` profesional), opcional por cobro | bff | `bff/src/services/invoicing.service.ts`, `bff/src/services/invoice-provider.resolver.ts`, `supabase/migrations/<bienestar_f4_factura_profesional>.sql` | Sí | BW-P2-3 | Un profesional con su resolución de facturación configurada emite la factura de un cobro pagado. Sin configuración, la opción no aparece. `invoicing.authz.test.ts` cubre que otro usuario no puede facturar a su nombre | M |
| BW-P2-7 | QA real de F4 en sandbox (Wompi y MP) + pruebas de concurrencia y RLS negativas de cobros | qa | `bff/src/routes/*.test.ts`, `docs/capturas/bienestar-f4/` | No | BW-P2-4, BW-P2-5 | Se recorre pago aprobado, rechazado, webhook duplicado y reembolso **solo en sandbox**. Antes se verifica que las credenciales MP de dev no sean de producción (la memoria dice que el `APP_USR-` de dev es de producción). Pruebas negativas: un paciente no ve cobros de otro y un profesional no ve los de otro. `seguridad:invariantes` limpio | M |
| BW-P2-8 | Subir el plan a ~$119.000 con «Pagos integrados» real: tarifario de BLQ-10 + landing + `/mi-plan` + aviso de 30 días a los clientes activos; los del piloto conservan el precio pactado | ventas | tarifario BLQ-10, `Landing_page/…/RolePricingSection.tsx`, `frontend/src/config/saas-plans.ts` | No | BW-P2-7, frente:planes-multirol | «Pagos integrados» solo aparece después de que BW-P2-7 esté aprobado. El precio es idéntico en el tarifario, la landing y `/mi-plan` (una sola fuente). El correo de aviso sale con 30 días de anticipación y ningún cliente existente ve el cambio antes de esa fecha | S |

### P3 — F5 marketplace, nutrición y extras

**Objetivo:** abrir los servicios al público con pago anticipado, reseñas y un directorio para familias, y convertir nutrición y psicología en módulos reales.

**Semanas:** 8 a 12. **Rama:** `feat/bienestar-p3-f5`. **Lote de migraciones:** BW-P3-1, -2, -4, -5 y -6.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| BW-P3-1 | Migración F5: flag `services_marketplace_enabled` (separado de `store_enabled`), `book_service_appointment` con pago anticipado y reembolso según `cancellation_policy_hours` | db | `supabase/migrations/<bienestar_f5_marketplace_servicios>.sql` | Sí | BW-P2-7 | Con el flag apagado nada cambia. Con el flag encendido, la reserva queda `pending_payment` y se confirma solo por webhook. Una cancelación dentro de la ventana reembolsa una sola vez (prueba de concurrencia). El antisolape sigue garantizado con advisory lock | L |
| BW-P3-2 | Reseñas atadas a una cita `completed` (corrige la policy de `vendor_reviews`, que hoy exige un pedido de producto) | db | `supabase/migrations/<bienestar_f5_resenas_servicios>.sql`, `frontend/src/pages/wellness/MyAppointmentsPage.tsx` | Sí | BW-P3-1 | Solo reseña quien tuvo una cita completada, y una vez por cita. Se listan **todas** las policies de `vendor_reviews` y ninguna permisiva deja otra vía de inserción | S |
| BW-P3-3 | Frontend F5: `ServiceBookingModal` con pago, `MarketplacePage` sin mandar servicios al carrito, categoría «Salud y bienestar» en Explorar como **directorio real** para familias (aquí vuelve a tener sentido el ítem «Explorar Bienestar») | frontend | `frontend/src/components/marketplace/ServiceBookingModal.tsx`, `pages/MarketplacePage.tsx`, `pages/ExplorarGlobalPage.tsx`, `config/navigation.ts:318` | No | BW-P3-1, frente:familias | Un acudiente encuentra al fisio en Explorar (con `SHOW_EXPLORE` activo en prod), reserva y paga en sandbox, y la cita aparece confirmada en las dos agendas. Ningún servicio entra al carrito de productos. Solo se listan profesionales verificados | M |
| BW-P3-4 | Verificación ReTHUS completa: re-verificación al cambiar datos sensibles (tarjeta, especialidad, documentos), vencimiento y trazabilidad (complementa la versión mínima de BW-P1-5) | bff | `bff/src/routes/marketplace-admin.routes.ts`, `frontend/src/pages/admin/AdminMarketplaceModerationPage.tsx`, `supabase/migrations/<bienestar_f5_reverificacion_rethus>.sql` | Sí | BW-P1-5, BW-P3-1 | Cambiar la tarjeta profesional lo devuelve a `pending` y lo saca de `/profesional/:slug` y de Explorar hasta que lo verifiquen de nuevo. El aviso va a `platform_admins`, no a `profiles.role` | M |
| BW-P3-5 | Nutrición del profesional: plan nutricional por paciente (objetivo, kcal, macros, pautas) como tipo de episodio o nota clínica; el registro de comida del atleta queda como decisión de producto aparte | db | `docs/specs/nutricion-atletas-independientes.md`, `supabase/migrations/<bienestar_nutricion_plan_paciente>.sql`, `frontend/src/pages/NutritionPage.tsx`, `pages/clinical/PatientDetailPage.tsx` | Sí | BW-P0-5, BW-P1-11 | Un nutricionista crea un plan para su paciente con consentimiento vigente. El plan es inmutable con addendum, igual que las notas. El acudiente lo ve en `/salud`. `NutritionPage` deja de tener datos mock. Los cálculos se hacen en la base o en el BFF, no en el navegador | L |
| BW-P3-6 | Psicología deportiva: plantilla de nota y valoración propia (no se comparte con el coach más allá del semáforo) | frontend | `frontend/src/pages/clinical/PatientDetailPage.tsx`, `supabase/migrations/<bienestar_plantilla_psicologia>.sql` | Sí | BW-P1-11 | El profesional de tipo «psicología» ve su plantilla. El coach y la escuela siguen sin leer ningún contenido (pruebas RLS negativas) | M |
| BW-P3-7 | Consulta virtual simple: enlace de videollamada del profesional (Meet o Zoom) en citas con `modality='virtual'`, sin prometer videollamada integrada | frontend | `frontend/src/pages/clinical/AvailabilityPage.tsx`, `pages/wellness/MyAppointmentsPage.tsx` | No | BW-P0-6 | `meeting_url` (columna que ya existe) se edita y se muestra solo al paciente de esa cita, desde 15 minutos antes. La landing dice «enlace a tu videollamada», no «videollamada integrada» | S |
| BW-P3-8 | QA real de F5 + piloto gratis de 1 mes del marketplace de servicios con 3 profesionales verificados | qa | `docs/pilotos/bienestar-marketplace-piloto.md` (nuevo), `docs/capturas/bienestar-f5/` | No | BW-P3-3, BW-P3-4 | Recorrido público completo en sandbox. Piloto de 30 días sin cobro del plan, con métricas de reservas, pagos y reseñas. La decisión de encender `services_marketplace_enabled` en prod la toma el dueño | M |

---

## 3. Piloto gratis 1 mes

**Piloto A: Bienestar clínico (BW-P1-12), semanas 3 a 7**

**A quién:**

- De 3 a 5 profesionales: fisio, nutricionista y psicólogo deportivo.
- Al menos uno debe ser **el fisio de una escuela cliente** (Besser, Dynasty o Monster), vinculado con BW-P1-1.
- La lista la nombra el dueño.

**Condiciones:**

- 30 días gratis, sin permanencia y sin comisión al paciente.
- Alta acompañada (videollamada de 30 min + guion de BW-P0-7).
- Si no convierte, al vencer pasa a Free sin perder nada: sus pacientes y sus historias quedan intactos.

**Qué se mide (semanal, en `docs/pilotos/bienestar-piloto-2026-10.md`):**

- Pacientes activos y cuántos vienen del roster de la escuela.
- Consentimientos firmados frente a pendientes.
- Notas clínicas firmadas.
- Citas creadas, completadas y canceladas, y cuántas entraron por `/profesional/:slug`.
- Lesiones registradas y consultas del coach a `/disponibilidad-medica`.
- Recordatorios por WhatsApp enviados frente a inasistencias (si BW-P1-8 está vivo).
- Bugs reportados y tiempo de respuesta.

**Ciclo:**

- **Día 25:** oferta de $59.000/mes (BW-P1-10, o a mano).
- **Día 30:** se registra si convierte. Si no convierte, se anota el motivo.

**Criterio de éxito:**

- Al menos **3 de 5** profesionales usan la historia clínica cada semana (cada uno con ≥ 1 nota firmada por semana).
- Al menos **2** convierten a pago.
- El fisio de la escuela tiene ≥ 70 % de los consentimientos del roster firmados.
- **Cero** incidentes de privacidad: ninguna lectura clínica de la escuela o del coach fuera del semáforo.
- Si 2 o más profesionales piden cobrarle al paciente dentro de la app, se confirma la demanda de F4 (P2).

**Piloto B: Marketplace de servicios (BW-P3-8), semanas 10 a 14**

- **A quién:** 3 profesionales verificados con ReTHUS.
- **Qué se mide:** reservas desde Explorar o el enlace público, pagos anticipados, cancelaciones y reembolsos, y reseñas.
- **Criterio de éxito:** ≥ 10 reservas pagadas en el mes, sin reembolsos duplicados ni pagos al comercio equivocado.

---

## 4. Decisiones abiertas

1. **Tarifario y BLQ-10:** el tarifario oficial (xlsx + D-FAC-1) todavía dice Wellness Pro $149k con descuento por combo. ¿Se actualiza a $59k, y cómo entra Wellness Pro en el motor de combos? Bloquea BW-P0-3 y BW-P0-4.
2. **Tarjeta «Servicios» de la landing** (Servicio Pro $109k, «Hasta 10 clientes»): ¿se retira o se fusiona con bienestar? ¿El límite Free es de 5 pacientes activos o de 10 clientes?
3. **Nombre único del plan:** ¿«Wellness Pro» o «Bienestar Individual»?
4. **Piloto:** ¿qué 3 a 5 profesionales entran y cuál es el fisio de la escuela cliente (Besser, Dynasty o Monster)?
5. **Fisio contratado por la escuela:** ¿se incluye en el plan Pro/Elite de la escuela (como el coach de escuela, que es gratis) o paga sus $59k aparte?
6. **Atletas sin cuenta:** ¿el consentimiento va por un enlace al teléfono del acudiente sin cuenta, o por una invitación que le crea la cuenta? (Se decide en BW-P1-0.)
7. **F4:** ¿se permite registrar efectivo o transferencia sin pasarela desde el día 1, o solo pasarela?
8. **Factura electrónica del profesional:** ¿obligatoria u opcional (BW-P2-6)?
9. **Nutrición:** ¿primero el plan nutricional del profesional (BW-P3-5) o el registro de comida del atleta independiente (spec existente)? ¿Con qué proveedor de datos de alimentos?
10. **Retención y derechos ARCO:** cuando un profesional se da de baja, ¿quién custodia la historia los años que exige la Res. 1995 y cómo se le entrega copia al paciente?
11. **WhatsApp del profesional:** ¿el recordatorio sale siempre del número de SportMaps, o se espera al canal propio del profesional que propone `profesionales-independientes-agentes-ia.md`?

---

## 5. Riesgos

- **Archivos compartidos con otras sesiones.** La landing tiene 30 archivos M sin commitear y `frontend/src/config/saas-plans.ts` de la app también está modificado. Commitear sin coordinar pisa trabajo ajeno. Siempre se commitea solo lo propio con índice temporal y antes se pregunta a la otra sesión.
- **Fuentes de precio paralelas.** Hoy conviven el xlsx, la landing y `saas-plans.ts`. Cualquier tabla nueva (como el `role-plans.ts` que se descartó) sería una cuarta fuente. Todo precio sale de una sola constante alineada con BLQ-10.
- **BLQ-10 sin ejecutar.** Mientras no exista, el plan de $59k se cobra a mano (comprobante o WhatsApp) y el límite Free y `trial_ends_at` no tienen dónde vivir. Mitigación: registro manual con responsable en `docs/pilotos/bienestar-activaciones.md`.
- **El camino nº 14 de `payments`.** Si F4 escribe en `payments` por `school_id`, rompe D1 (el custodio es el profesional) y las 3 agregaciones de ingreso. Va en un libro propio.
- **Secreto profesional frente a la escuela.** El vínculo «fisio de la escuela» no puede abrir lectura clínica. Basta una policy permisiva extra, o una que use `user_school_ids()` sobre una tabla clínica, para romper la garantía. Por eso hay pruebas negativas en cada fase.
- **Perfiles de salud públicos sin verificar.** Se mitiga con BW-P1-5 antes de BW-P1-6 y BW-P1-7.
- **`vendor_profiles` expuesto a anon** (`bank_data`, según la auditoría del 02-oct). Publicar un slug sin cerrar eso amplía la fuga.
- **Disk IO (una sola base para dev, stg y prod; Supabase es Pro desde el 14-oct, pero el plan de optimización sigue vigente).** Las migraciones de cada fase se aplican desde una sola sesión y `gen types` corre al final del lote. El recordatorio WhatsApp extiende el cron de 15 min que ya existe, en vez de sumar otro sondeo, y se envía desde un solo BFF.
- **Pasarelas.** QA solo en sandbox. Las credenciales MP de dev son de producción según la memoria: se verifican antes de BW-P2-7.
- **Adopción casi nula** (6 perfiles y ningún uso clínico real al 06-oct). Sin el piloto acompañado, F4 se construiría sin demanda probada. Por eso BW-P2-0 depende de 2 semanas de piloto con uso.
- **Retención legal.** Bloquear el acceso a las historias por falta de pago incumpliría la Res. 1995 y la regla de que «la mora no cancela». El límite Free solo frena lo nuevo.
- **Dos canales de WhatsApp para profesionales.** BW-P1-8 y el spec de agentes IA pueden terminar construyendo dos canales si no se concilian en BW-P1-0.

---

## 6. Correcciones del revisor que se aplicaron

| # | Corrección | Dónde quedó |
|---|---|---|
| 1 | La landing en la copia de trabajo ya está en $59k, sin «Clínica» y con «próximamente». Lo que sigue prometiendo de más es la tarjeta **«Servicios»** | BW-P0-1 pasa a «coordinar y commitear» y suma «primer mes gratis», el límite Free, el nombre único y la decisión sobre «Servicios». El grep de aceptación cubre servicios. Tabla de estado actualizada |
| 2 | Crear `role-plans.ts` abría una cuarta fuente de precios que duplicaba BLQ-10 ($149k en el tarifario) | Nueva BW-P0-3 (alinear el tarifario y D-FAC-1 con BLQ-10). BW-P0-4 extiende `saas-plans.ts` y depende de BLQ-10. Se eliminaron `role-plans.ts` y `RolePlanCard` |
| 3 | El spec y el ROADMAP se contradicen sobre gates I7 | BW-P0-2 verifica con `pg_proc` por nombre y corrige el documento que esté mal |
| 4 | Que `create_service_checkout` «no está vivo» no se puede afirmar sin consultar la base | Queda como «por verificar» en BW-P0-2 (b). BW-P2-3 actúa según el resultado |
| 5 | El BFF de la pasarela del vendedor ya existe (endpoints, verificación del dueño, cifrado) y la cita de migración estaba mal | BW-P2-2 se reduce a validar credenciales y a los tests del resolver. La UI pasa a BW-P2-4. Cita corregida (`_secrets` en `:75`, ALTER en `:15`/`:90`) |
| 6 | `/salud/:slug` choca con rutas que ya existen | Se fija `/profesional/:slug` (BW-P1-7) |
| 7 | El roster ignoraba a los atletas sin cuenta | BW-P1-0 decide el mecanismo. BW-P1-2 recibe `unregistered_athlete_ids` sin violar `VINCULO_SOLO_POR_INVITACION`. BW-P1-4 los importa |
| 8 | Purgar con `purge_clinical_test_data` contradice que el usuario maneja las eliminaciones (y la RPC solo corre con service_role) | BW-P0-6 y BW-P1-11: las cuentas de prueba quedan y no se purga |
| 9 | La página pública salía en P1 y la verificación ReTHUS recién en P3 | Nueva BW-P1-5 (ReTHUS mínimo). BW-P1-6 y BW-P1-7 exigen `verified`. BW-P3-4 queda solo para la re-verificación |
| 10 | `trial_ends_at` depende de BLQ-10 y el piloto no lo listaba | BW-P1-12 depende de BW-P1-9 o lleva el registro a mano en `docs/pilotos/` |
| 11 | Que ningún menú prometa nutrición ya se cumple | BW-P0-5 se reduce a «Próximamente» en `NutritionPage` (más la etiqueta engañosa del acudiente, faltante 1) |
| 12 | El aviso de cita nueva ya existe (trigger) | BW-P1-7 lo verifica en QA. BW-P0-6 también lo comprueba |

**Faltantes del revisor que se incorporaron:**

| Faltante | Dónde quedó |
|---|---|
| «Explorar Bienestar» abre métricas, no un directorio | BW-P0-5 (etiqueta) y BW-P3-3 (directorio real) |
| Dos ofertas en la landing (bienestar y servicios) con límites distintos | BW-P0-1, BW-P0-3 y decisión 2 |
| Alinear $59k con BLQ-10 y el xlsx | BW-P0-3 y decisión 1 |
| Activación manual sin rastro | Registro en `docs/pilotos/bienestar-activaciones.md` (BW-P0-4) |
| Avisos del día 25 y del vencimiento; al vencer pasa a Free sin bloquear | BW-P1-10 |
| El onboarding debe crear `vendor_profile` | BW-P0-2 (c) y BW-P0-6 |
| Exposición de `vendor_profiles` a anon, todas sus policies, rendimiento `security_invoker` | BW-P0-2 (d) y BW-P1-6 |
| El cron de 15 min ya existe | BW-P1-8 lo extiende, sin sondeo nuevo y desde un solo BFF |
| Función de alcance del vínculo y afirmaciones en `rls-pruebas-clinicas.mjs` | BW-P1-1 y BW-P1-11 |
| Retención y derechos ARCO | BW-P1-0 (3), BW-P1-9, riesgos y decisión 10 |
| Guion de demo y cuenta demo `is_demo` | BW-P0-7 |

**Duplicados resueltos:**

| Duplicado | Cómo se resolvió |
|---|---|
| Landing ya trabajada por otra sesión | BW-P0-1 coordina en lugar de rehacer |
| BW-P0-3/BW-P1-8 originales frente a BLQ-10 | Ahora dependen del catálogo de BLQ-10, sin camino aparte |
| Endpoints de pasarela del vendedor | Se reusan (BW-P2-2 reducido) |
| WhatsApp frente al spec de agentes IA | Se concilian en BW-P1-0 (un solo canal) |
| Aviso de cita nueva | Se verifica, no se construye |
| BLQ-5 | Se marca como reemplazado (BW-P0-8) |
