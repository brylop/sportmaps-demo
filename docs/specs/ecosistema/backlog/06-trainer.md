# Backlog 06 — Entrenador independiente (`personal_trainer`)

> Frente del plan maestro del ecosistema ([plan-maestro-ecosistema-2026-10.md](../../../plan-maestro-ecosistema-2026-10.md)).
> Estudio de rol: [roles-entrenadores-bienestar.md](../roles-entrenadores-bienestar.md).
> Versión final del 14-oct-2026, con las correcciones del revisor aplicadas (ver §6).
> Es un plan: no se ha escrito SQL ni código. Las migraciones se escriben solo cuando su plan esté aprobado.

**Decisiones del dueño que este backlog da por tomadas (14-oct-2026)**

- El entrenador independiente paga **$59.000/mes** (E2). No hay plan anual con descuento: la landing ya lo muestra como `monthlyOnly`.
- El coach de escuela es **gratis** dentro del plan de la escuela (E4).
- **Todo piloto es gratis por un mes.**
- No se cobra comisión al cliente final. Los recargos solo existen si los configura quien cobra.
- **La mora no cancela inscripciones.** No hay cancelación automática por falta de pago.
- La landing solo publica lo que ya corre en la app.

---

## 1. Resumen y estado actual verificado

El entrenador independiente funciona como una **micro-escuela propia**: una fila de `schools` con `school_type='personal_trainer'`, creada en el onboarding. Tiene:

- 9 routers del BFF montados en `bff/src/index.ts:476-488`;
- 11 páginas en `frontend/src/pages/trainer/`;
- sus rutas en `App.tsx` (~1066-1079; el archivo tiene cambios sin commitear de otra sesión, así que el número se mueve).

De lo que hoy no es una escuela, es lo más completo que tenemos para cobrar. Aun así, **no se le puede vender**, por estas razones:

1. **No puede comprar su plan.** Ninguna capa tiene un plan de entrenador:
   - el CHECK de `plan_code` solo admite códigos de academia;
   - `generate_school_subscription_invoice` tiene fijos los precios de academia;
   - `/mi-plan` muestra `ACADEMY_TIERS`.
2. **Ya tiene una prueba gratis que vence y lo bloquea, y no tiene salida.** Toda micro-escuela nace con `plan_code='starter'`, `status='trialing'` y 30 días de prueba (trigger `create_default_school_subscription`). Al vencer, DIN-4 responde **402 `trial_expired`** en las mutaciones con `x-school-id`. Algunos de los 11 entrenadores que existen (5 con atletas activos) pueden estar bloqueados hoy sin ningún plan que comprar para salir.
3. Las pantallas de **Planes** y **Pagos** son envoltorios de 21 líneas sobre pantallas de escuela. `PaymentsAutomationPage` tiene 3.292 líneas.
4. **La biomecánica no tiene pantalla** del lado del entrenador.
5. **Faltan dos cosas para el cliente:** recordatorios por WhatsApp y una pantalla «Hoy».

Además, la facturación SaaS del entrenador **ya estaba planeada en BLQ-10** (`docs/ROADMAP.md:1717`, [spec](../../facturacion-saas-multirol-comprobantes.md)), con otro diseño: `owner_type='vendor'`, motor de precios por combo y Coach Pro a $99k. Este backlog lo cita y le pide al dueño que elija (decisión **D-01**) antes de escribir la migración.

### Estado por capacidad

| Capacidad | Estado | Evidencia |
|---|---|---|
| Onboarding (crea la micro-escuela, `school_settings`, `trainer_profiles` y el owner en `school_staff`) | Funciona | `bff/src/routes/trainer/onboarding.ts:15-224`; `TrainerOnboarding.tsx`; el guard `RequirePersonalTrainer.tsx` manda a `/trainer/onboarding` |
| Clientes: ficha, metas, estadísticas, medidas, progreso, invitaciones | Funciona | `bff/src/routes/trainer/clients.ts` (736 líneas; el scoping `assertClientInSchool` se cerró en SEG-4 el 2026-09-02); `TrainerClients.tsx`, `TrainerClientProfile.tsx` + `tabs/*` |
| Rutinas, planes de sesión y catálogo wger | Funciona | `trainer/routines.ts`, `wger.ts`, `training-plans.ts`; `TrainerRoutines.tsx`, `BlockBuilder.tsx` |
| Disponibilidad y sesiones PT (reserva, asistencia, no-show) | Funciona | `trainer/availability.ts` (`coach_availability`, `trainer_session_plans`); `athlete/training.ts:397-658` |
| Perfil público `/entrenador/:userId` | Funciona | `App.tsx:422`; `TrainerPublicProfile.tsx`, `TrainerProfileEditor.tsx`; `trainer/profile.ts` |
| **Prueba de 30 días al nacer + bloqueo al vencer (DIN-4)** | **Funciona, pero sin salida para el entrenador** | `20260519000001_school_subscriptions_signup_trigger.sql:13-16,39,73`; `20260812150627_entidades_informativas_no_se_bloquean.sql:45`; `bff/src/index.ts:309` (`requireOperationalSchool`); `bff/src/middlewares/requireOperationalSchool.ts:9-15` |
| RPC de admin para la prueba | Funciona | `admin_set_trial` y `admin_extend_trial` en `20260826110449_fix_null_guard_bypass_admin_rpcs.sql:91-123, 828-873`; `TrialStatusBanner` |
| Comprar su plan (Coach Pro) en `/mi-plan` | **Roto** | `MiPlanPage.tsx:210` (`ACADEMY_TIERS`); `saas-plans.ts:760` (`qs.set('role','escuela')`); CHECK de `plan_code` en `20260713000007:28-29`; a `PlanCode` en `upgrade-requests.routes.ts:20` le falta `'start'` |
| Procesar la solicitud de plan | **Parcial** | `rpc_process_upgrade_request` fuerza `status='active'` y su CASE manda todo lo que no sea starter/enterprise a `'pro'` (`20260826110449:1063-1078`). El BFF solo la llama (`upgrade-requests.routes.ts:184`) y toma el `school_id` del body |
| Facturación SaaS del plan del entrenador | No existe | `generate_school_subscription_invoice` (`20260929183752:118-123`); a `ACADEMY_PLAN_NAMES` le falta el entrenador |
| Paquetes para sus clientes con pantalla propia | Parcial | `TrainerPlans.tsx`: envoltorio de 21 líneas sobre `OfferingsPage` |
| Cobro a sus clientes por su propia pasarela | Parcial | `TrainerPayments.tsx` envuelve `PaymentsAutomationPage`; `trainer/workspace.ts:54` solo guarda banco/Nequi/Daviplata. Connected Accounts = DIN-6 (~85 %, solo MP) |
| Biomecánica del entrenador | Parcial | `trainer/biomech.ts`: 11 rutas; el frontend solo hace GET de capturas (`tabs/ClientProgressTab.tsx:67`). La revocación de permisos ya existe del lado del atleta (`athlete/biomech.ts:228,245,265`). `MiPlanPage.tsx:239-243` oculta el addon en staging. Hoy el GET de capturas solo corre si `ent.addons.biomech` (`ClientProgressTab.tsx:65`): sin addon ni se lista |
| «Hoy» del cliente | Parcial | `GET /athlete/training/today` (`athlete/training.ts:8`); `lib/athlete/queries.ts:355`; no hay pantalla única ni pago integrado |
| Recordatorios por WhatsApp de sesiones PT | No existe | No hay job PT. `fn_pt_routine_reminder` y `_2h` son in-app y se crearon fuera del repo (solo un ALTER en `20260831095348:82`). Patrón reutilizable: `maintenance.job.ts:908-917` |
| Menú del entrenador que también es coach de un club | Roto | `AppSidebar.tsx:62-66` fuerza `profile.role='personal_trainer'`. Se cruza con UX-13(d) (`ROADMAP:1368`) |
| Menú del entrenador sin residuos de escuela | Roto | `navigation.ts` (~866 y ~900): «Facturación» `/mi-plan` aparece dos veces; ~893: «Mis Inscripciones» (`/enrollments`) |
| Entitlements para `personal_trainer` | Parcial | `useEntitlements.ts:23,135` solo admite `'academy'\|'venue'\|'hybrid'` |
| Auth de los 9 routers del BFF | Parcial | Solo 7 van detrás de `requireTrainerAuth`; `trainerProfileRouter` (público a propósito) y `trainerWgerRouter` («temporalmente sin auth») no. Único gate real de escritura: `requireOperationalSchool` (402) |
| Router wger | **Expuesto sin auth** | `bff/src/index.ts:477-478` («temporalmente sin auth»); `/exercises/cache/export` y `/cache/status` son públicos (`wger.ts:738,778,800,811`) |
| Landing de entrenadores | Casi lista (copia de trabajo de otra sesión, sin commitear) | `RolePricingSection.tsx:258-301`: Coach Pro $59.000 `monthlyOnly`, sin Coach Elite, **sin Free Coach**, `WHATSAPP_IA_PROXIMAMENTE`, entrenador de escuela gratis. Faltan «1er mes gratis» y el deep-link `role=entrenador` en `useUpgradeContext.ts` |
| Policies de las tablas del entrenador | Sin verificar | `coach_availability`, `trainer_session_plans`, `trainer_profiles`, grants de biomecánica: nadie ha listado sus `pg_policies` ni confirmado `user_staff_school_ids()` frente a `user_school_ids()` |
| CRM + agentes IA del profesional independiente | Solo spec | `docs/specs/profesionales-independientes-agentes-ia.md` |
| QA automatizado del entrenador | Parcial | Solo `frontend/e2e/qa-discovery/entrenador*.spec.ts` (exploratorio) |

---

## 2. Fases

Cada fase va en su propia rama, con revisión entre fases. Va full-stack: DB + RLS + RPC + BFF + frontend + QA.

**Reglas de migración, para todas las fases:**

- La migración se crea con `npm run migrations:new -- <slug>` y se commitea junto a `supabase/migrations_ledger.json`. Las migraciones son inmutables.
- **Una sola sesión** aplica, por una vía que deje rastro, y en **un solo lote con bienestar** cuando coincidan.
- `gen types` se corre solo al final del lote.
- Para verificar se consulta `pg_constraint` o `pg_proc` filtrando por nombre. Nada de `list_tables` ni `get_advisors` como sondeo.
- Después de cada migración: `npm run migrations:check` y `npm run seguridad:invariantes` en verde.
- Toda función nueva lleva `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE` explícito y `REVOKE` de `anon`.
- Los estados van como `text + CHECK`.
- Las policies de escritura usan `user_staff_school_ids()`; nunca `user_school_ids()`.

### P0 — Sacar a los entrenadores del bloqueo y hacer comprable Coach Pro

**Objetivo**

- Ningún entrenador activo queda bloqueado sin salida.
- El piloto gratis de 1 mes se arma **sobre la prueba de DIN-4 que ya existe**; no se inventa un mecanismo nuevo.
- Coach Pro a $59.000 se puede pedir desde `/mi-plan` y se factura bien al terminar el piloto.

**Semanas:** semana 1 (15–21 oct). PT-P0-04 y lo que depende de ella quedan bloqueadas hasta que el dueño cierre D-01 y D-02.

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| PT-P0-01 | Medir el estado real de los 11 entrenadores | db (solo lectura) | — (consulta puntual, la hace la sesión que aplica migraciones) | No | — | De cada micro-escuela `personal_trainer` se registra: `is_operational`, `status`, `trial_ends_at`, `plan_code`, `account_type`, `blocking_exempt` y si tiene clientes activos. Se mide también `SELECT DISTINCT plan_code` en `school_subscriptions` y `plan_upgrade_requests` para conocer el radio del cambio de CHECK. Todo filtrado por `school_type`, sin listados generales. El resultado queda anotado en este archivo (§1). | XS |
| PT-P0-02 | Desbloqueo inmediato = arranque del piloto | ops (datos) | — (usa `admin_extend_trial` / `admin_set_trial`, que ya existen) | No | PT-P0-01, D-03 | Los entrenadores con clientes activos que estén bloqueados o por vencer quedan con prueba extendida 30 días (piloto gratis), con motivo registrado en el `jsonb` de auditoría que ya escribe `admin_set_trial`. Verificación: con la cuenta del entrenador, una mutación con `x-school-id` deja de devolver 402. No se borra ni se modifica ningún otro dato. | XS |
| PT-P0-03 | Plan de migración «planes por rol» (documento, sin SQL) | db | `docs/specs/planes-por-rol-mi-plan.md` (nuevo) | No | D-01, D-02, frente:bienestar | El dueño lo aprueba. Define: (a) el modelo elegido en D-01; (b) los códigos `coach_pro` y el de bienestar en la **misma** migración; (c) los CHECK nuevos de `school_subscriptions.plan_code` y `plan_upgrade_requests.requested_plan_code`; (d) el precio de 5.900.000 centavos; (e) el cambio en `rpc_process_upgrade_request` (ver PT-P0-04); (f) la guarda plan↔`school_type` en SQL; (g) el radio de impacto medido en PT-P0-01. | XS |
| PT-P0-04 | Migración: `coach_pro` + precio + trial al procesar + guarda plan↔tipo | db | `supabase/migrations/<nuevo>_planes_por_rol.sql` (`npm run migrations:new -- planes_por_rol`), `supabase/migrations_ledger.json` | **Sí** | PT-P0-03 | (1) DROP/ADD de los dos CHECK, con `coach_pro` (y el código de bienestar). (2) `CREATE OR REPLACE` de `generate_school_subscription_invoice` con `WHEN 'coach_pro' THEN 5900000`. (3) `CREATE OR REPLACE` de `rpc_process_upgrade_request`: para `coach_pro` deja `plan_code='coach_pro'`; si la escuela no ha usado su mes de piloto, `status='trialing'` y `trial_ends_at = now() + 30 días` (reusa la lógica de `admin_set_trial`); si ya lo usó, `active`. El tier sale de un mapeo explícito y no del `'pro'` por defecto. (4) La RPC rechaza `coach_pro` en una escuela que no es `personal_trainer`, y los planes de academia en una que sí lo es. Lleva `search_path` fijo y `GRANT EXECUTE` explícito. Se verifica con `pg_constraint` / `pg_proc` filtrado. Checks e invariantes en verde. | S |
| PT-P0-05 | BFF `upgrade-requests`: códigos, propiedad y nombres de factura | bff | `bff/src/routes/upgrade-requests.routes.ts`, `bff/src/services/saasInvoicing.constants.ts`, `bff/src/services/saasInvoicing.constants.test.ts`, test nuevo de `upgrade-requests` | No | PT-P0-04 | `PlanCode` incluye `'start'` (bug actual; no se rompen las solicitudes de academia en curso) y `'coach_pro'`. `POST /upgrade-requests` solo acepta un `school_id` donde el usuario es owner o admin (`user_admin_school_ids()`); hay test de acceso cruzado entre 2 micro-escuelas → 403. Hay 400 por incompatibilidad plan↔tipo, como espejo de la guarda en SQL. `ACADEMY_PLAN_NAMES.coach_pro = 'Coach Pro'`. El PDF y el correo dicen «Plan Coach Pro $59.000». | S |
| PT-P0-06 | `TRAINER_TIERS` en `saas-plans.ts` | frontend | `frontend/src/config/saas-plans.ts` | No | PT-P0-04, D-02 | `TRAINER_TIERS` incluye `coach_pro` ($59.000, `trialDays: 30`) y, **solo si D-02 dice que existe**, el Free Coach. Se agrega `tiersForSchoolType(type)`. `buildLandingPlansUrl` (`:751-760`) acepta `role='entrenador'`. Se hace sobre el commit de la otra sesión que hoy edita el archivo; se cuida el CRLF. `tsc` sin errores. | S |
| PT-P0-07 | `useEntitlements` reconoce `personal_trainer` | frontend | `frontend/src/hooks/useEntitlements.ts` | No | — | `schoolType` incluye `'personal_trainer'` y lo devuelve para la micro-escuela (verificado con la cuenta QA del entrenador en dev). | XS |
| PT-P0-08 | `/mi-plan` del entrenador | frontend | `frontend/src/pages/MiPlanPage.tsx`, `frontend/src/components/billing/TrainerPlanGrid.tsx` (nuevo) | No | PT-P0-05, PT-P0-06, PT-P0-07 | Un entrenador ve Coach Pro a $59.000/mes, sus «clientes activos», el estado de la prueba («Prueba gratis hasta <fecha>») y el CTA «Probar 1 mes gratis» o «Activar Coach Pro», que crea la solicitud `coach_pro` (200). No aparece ningún tier de academia. Una escuela sigue viendo exactamente su grilla actual. | M |
| PT-P0-09 | Banner de prueba y pantalla 402 con vocabulario de entrenador | frontend | `TrialStatusBanner` (componente existente), pantalla o toast del 402 `trial_expired` | No | PT-P0-08 | Para `personal_trainer` el texto habla de «tu negocio» y de «clientes» (no de «escuela» ni de «deportistas») y lleva a `/mi-plan` → Coach Pro. Se verifica qué rutas `/trainer/*` reciben 402 (las que usan `fetch` sin `x-school-id` quizá no, y `OfferingsPage` / `PaymentsAutomationPage` sí); el resultado se anota aquí. | S |
| PT-P0-10 | Admin de plataforma: procesar `coach_pro` | frontend + bff | `frontend/src/pages/AdminSubscriptionsPage.tsx`, `bff/src/routes/upgrade-requests.routes.ts` (`/:id/process`) | No | PT-P0-04, PT-P0-05, D-04 | El super admin ve las solicitudes `coach_pro`. Al procesarlas queda `plan_code='coach_pro'` en prueba de 30 días (o `active` si ya usó el piloto), con la fecha del primer cobro visible. El ciclo `saas-billing-cycle` no factura durante la prueba. Al terminar, la factura sale por $59.000 y se paga como dice D-04 (mientras tanto: transferencia + comprobante, igual que las escuelas hoy). El super admin recibe un aviso por cada solicitud `coach_pro` nueva. | S |
| PT-P0-11 | Landing: completar lo que falta | landing | `Landing_page/.../RolePricingSection.tsx`, `Landing_page/.../hooks/useUpgradeContext.ts` | No | frente:landing, PT-P0-05 | Coach Pro dice «1er mes gratis». `/planes?role=entrenador` envía `requested_plan_code='coach_pro'`. **No se reescribe** lo que la otra sesión ya dejó: precio de $59k, sin Elite, WhatsApp IA «próximamente», separación entre entrenador de escuela e independiente. Se hace coordinado con esa sesión o sobre su commit. | XS |
| PT-P0-12 | Una sola verdad de precios: Tarifario, BLQ-10 y ROADMAP | docs | Hoja «Tarifario Oficial» del xlsx (`sportmaps-combinaciones-modulos (2).xlsx`), `docs/specs/facturacion-saas-multirol-comprobantes.md`, `docs/ROADMAP.md` (BLQ-10) | No | D-01 | El Tarifario Oficial (fuente única según D-FAC-1) y el spec de BLQ-10 dicen Coach Pro $59.000 y reflejan lo que se resolvió en D-01. No queda ningún documento con $99k para el independiente. | XS |
| PT-P0-13 | QA real: de la prueba a Coach Pro, de punta a punta | qa | `frontend/e2e/mi-plan-entrenador.spec.ts` (nuevo) | No | PT-P0-08, PT-P0-09, PT-P0-10, PT-P0-11 | Playwright en Pixel 7 y desktop: el entrenador QA ve el banner → `/mi-plan` muestra Coach Pro → solicita → el admin procesa → `/mi-plan` dice «Coach Pro · prueba hasta <fecha>». Regresión: la escuela QA sigue viendo sus tiers. Capturas reales en `docs/capturas/`. El BFF local se apaga al terminar. | S |

### P1 — Negocio propio: pantallas propias, cobro a sus clientes y piloto con entrenadores reales

**Objetivo**

- El entrenador gestiona paquetes y cobros con pantallas y vocabulario propios.
- Cobra por su pasarela conectada, sin comisión al cliente y sin que la mora cancele nada.
- Se cierra el hueco de seguridad de wger.
- Se corre el piloto gratis de 1 mes con entrenadores reales.

**Semanas:** 2–3 (22 oct – 4 nov).

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| PT-P1-01 | «Mis paquetes»: pantalla propia sobre la API de offerings | frontend | `frontend/src/pages/trainer/TrainerPlans.tsx`, `frontend/src/components/trainer/TrainerPackageForm.tsx` (nuevo) | No | — | El entrenador crea, edita y archiva paquetes (sesiones, vigencia en días, precio, modalidad) sin ver equipos, categorías, matrícula ni «deportistas». Usa los mismos endpoints de offerings. El paquete aparece en su perfil público y al invitar a un cliente. | M |
| PT-P1-02 | «Cobros a clientes»: vista simplificada | frontend | `frontend/src/pages/trainer/TrainerPayments.tsx`, `frontend/src/components/trainer/TrainerChargesList.tsx` (nuevo), `SportMapsPaySettings.tsx` (reuso) | No | PT-P1-03 | No renderiza `PaymentsAutomationPage`. Muestra cobros pendientes por cliente, permite aprobar o rechazar comprobantes, generar un enlace de pago y conectar la pasarela. No hay botón de cancelación por mora. Sin recargo, salvo que el entrenador lo configure. | M |
| PT-P1-03 | Verificar Connected Accounts en una micro-escuela | bff | `bff/src/routes/payment-providers.routes.ts`, `bff/src/services/payment-provider.resolver.ts`, `bff/src/routes/wompi.ts`, `bff/src/routes/mercadopago.ts` | No | DIN-6 (dependencia, no trabajo nuevo) | Con la cuenta QA del entrenador: se conecta la pasarela en sandbox, se genera un cobro y el cliente lo paga. El webhook lo marca `approved` en su micro-escuela y el dinero va a su cuenta. Fail-closed: sin cuenta conectada no aparece el pago en línea, y no hay fallback a credenciales ENV de otra escuela. Tests del resolver en verde. | M |
| PT-P1-04 | Validar `/workspace/payment-settings` | bff | `bff/src/routes/trainer/workspace.ts` | No | — | Responde 400 a números con formato inválido y a `payment_methods` fuera de la lista permitida. Test unitario. | XS |
| PT-P1-05 | La mora no toca a los clientes del entrenador | bff + db (lectura) | `bff/src/jobs/maintenance.job.ts` y los jobs de mora/expiración; migración sin commitear `20261014130128_mora_no_cancela_reactiva_y_detector_autocierra.sql` (solo se lee) | No | — | Se confirma, con un test o con la lectura del código, que ningún cron expira ni cancela inscripciones de una micro-escuela `personal_trainer` por falta de pago, en línea con «la mora no cancela». Si alguno lo hace, se abre una tarea con su propio plan de migración. | S |
| PT-P1-06 | Cerrar el router wger sin auth | bff | `bff/src/index.ts:477-478`, `bff/src/routes/trainer/wger.ts` | No | — | `/exercises/cache/export`, `/cache/status` y toda ruta que escriba o exporte quedan detrás de `requireTrainerAuth` (o solo para super admin). Solo `search` e `info` siguen públicas, si el perfil público las necesita. Test: sin token → 401. | XS |
| PT-P1-07 | Entrenador que también es coach de un club: selector de contexto | frontend | `frontend/src/components/AppSidebar.tsx`, `frontend/src/hooks/useSchoolContext.ts` | No | Cruce con UX-13(d) | Un usuario con `profile.role='personal_trainer'` y membresía activa de coach en otra escuela cambia entre «Mi negocio» y «<Club>». El menú y `currentUserRole` siguen a la entidad activa. Un super admin sigue viéndose como super admin. Se coordina con UX-13(d) para no hacer dos veces el mismo trabajo. | S |
| PT-P1-08 | Vocabulario «clientes» y menú sin residuos | frontend | `frontend/src/pages/trainer/TrainerDashboard.tsx`, `TrainerClients.tsx`, `frontend/src/config/navigation.ts` (~866–905) | No | PT-P1-01, PT-P1-02 | Ningún texto visible del espacio del entrenador dice «escuela», «deportistas» ni «matrícula». Se quita el «Facturación» `/mi-plan` repetido (queda uno) y «Mis Inscripciones» `/enrollments`. El menú queda: Mis paquetes · Cobros a clientes · Mi plan. | S |
| PT-P1-09 | Avisos del piloto y de la primera factura | bff | `bff/src/jobs/maintenance.job.ts` (o el despachador de notificaciones), plantillas de correo | No | PT-P0-10 | El entrenador recibe un aviso al iniciar el piloto, otro a D-7 y otro a D-1 de su fin, y el correo de la primera factura de Coach Pro. Lectura por lote (`.in`, sin N+1); idempotente (un aviso por hito). Kill-switch por variable `DISABLE_*`. | S |
| PT-P1-10 | QA real: cobro al cliente + regresión de menú | qa | `frontend/e2e/entrenador-cobro-cliente.spec.ts` (nuevo), `frontend/e2e/sidebar-roles.spec.ts` (nuevo) | No | PT-P1-01, PT-P1-02, PT-P1-03, PT-P1-07 | E2E en dev con 2 cuentas (entrenador y cliente) y pasarela sandbox: paquete → invitación → cobro → pago → aprobado. Verifica el scoping entre micro-escuelas. Regresión de `AppSidebar` con super admin, `personal_trainer` puro y `personal_trainer` + coach de club. Capturas reales. | M |
| PT-P1-11 | Piloto gratis 1 mes con entrenadores reales | ventas | `docs/pilotos/piloto-coach-pro-2026-10.md` (nuevo) | No | PT-P0-13, PT-P1-10 | Ver §3. Arranca con los entrenadores desbloqueados en PT-P0-02. No se menciona públicamente a nadie sin su permiso. | S |
| PT-P1-12 | Kit de contenido honesto (3 piezas) | contenido | `docs/manuales/_src/entrenador-independiente/` (nuevo) | No | PT-P1-10 | Las piezas: «Perfil público en 5 minutos», «Rutina → el cliente la ejecuta → ves su progreso» y «Cobrar en pesos sin Stripe». Capturas reales (patrón único de PDFs) y cero cifras inventadas. | S |
| PT-P1-13 | *(Condicional a D-02)* Límite de clientes del plan gratis o de la prueba | bff + frontend | `bff/src/routes/trainer/clients.ts`, `frontend/src/pages/trainer/tabs/TrainerInvitationsTab.tsx` | No | D-02 | **Solo si D-02 define un límite.** Al invitar o activar el cliente N+1 responde 402 `plan_limit`, con el CTA «Activa Coach Pro». Los clientes que ya existen no se desactivan. Si no hay Free Coach ni límite durante la prueba, la tarea se cierra sin código. | S |
| PT-P1-14 | Auditar policies y permisos de las tablas del entrenador | db (solo lectura) + bff | `pg_policies` de `coach_availability`, `trainer_session_plans`, `trainer_profiles`, grants de biomecánica; `bff/src/routes/trainer/*` | No (si hay hallazgos, plan de migración aparte) | — | Se listan las policies **por tabla** (nunca todo el catálogo) y se confirma que ninguna escritura usa `user_school_ids()` ni `FOR ALL` sin `WITH CHECK`. `npm run seguridad:invariantes` en verde. Tests de acceso cruzado entre 2 micro-escuelas para los routers `clients`, `routines`, `availability`, `training-plans` y `workspace` (403/404). El resultado se anota en §1. | S |
| PT-P1-15 | Estado de la cuenta al terminar el piloto sin pagar | bff + frontend | `bff/src/middlewares/requireOperationalSchool.ts` (lectura), `TrialStatusBanner`, `/mi-plan` | No | PT-P0-09, D-08 | Se define y se prueba qué ve el entrenador al vencer sin pagar: lectura y exportación siguen abiertas (los GET pasan), las mutaciones dan 402 con salida a Coach Pro. **Nunca** se desactivan clientes ni se cancelan inscripciones o paquetes de sus clientes. | S |

### P2 — Experiencia del cliente: «Hoy» y recordatorios por WhatsApp

**Objetivo:** que el cliente vea en una sola pantalla su rutina de hoy, su próxima sesión y lo que debe pagar, y que reciba un recordatorio por WhatsApp antes de cada sesión.

**Semanas:** 3–5 (29 oct – 18 nov).

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| PT-P2-01 | Ampliar `GET /athlete/training/today` | bff | `bff/src/routes/athlete/training.ts`, `frontend/src/lib/athlete/queries.ts` | No | PT-P1-03 | La respuesta incluye `next_pt_session {fecha, entrenador, modalidad}` y `pending_charge {monto, concepto, enlace_pago \| null}`. Lectura por lote con `.in()`. Un test confirma que solo devuelve datos de las micro-escuelas donde el usuario es cliente. | S |
| PT-P2-02 | Pantalla «Hoy» del cliente | frontend | `frontend/src/pages/athlete/ClientTodayPage.tsx` (nuevo), `App.tsx`, `config/navigation.ts`, `components/athlete/SessionExecution.tsx` (reuso) | No | PT-P2-01 | En Pixel 7 y en una sola pantalla: la rutina de hoy con «Empezar» y «Marcar hecho», la próxima sesión con «Cancelar/Reprogramar» y el cobro pendiente con «Pagar». Si la única membresía del usuario es una micro-escuela `personal_trainer`, «Hoy» es su inicio. Para los miembros de escuelas no cambia nada. | M |
| PT-P2-03 | Versionar en el repo las funciones PT creadas fuera del ledger | db | `supabase/migrations/<nuevo>_versionar_fn_pt_reminders.sql` | **Sí** | PT-P0-04 (mismo lote serial) | Se lee el `prosrc` vivo de `fn_pt_routine_reminder`, `fn_pt_routine_reminder_2h` y `fn_pt_session_auto_complete` desde `pg_proc`, filtrando por nombre. La migración las recrea idénticas, con su `search_path` y sus triggers. El diff de `prosrc` queda vacío salvo el formato. | S |
| PT-P2-04 | Tabla de idempotencia `pt_session_reminders` | db | `supabase/migrations/<nuevo>_pt_session_reminders.sql` | **Sí** | PT-P2-03 | Columnas: `session_plan_id` (FK), `kind text CHECK IN ('24h','2h')`, `channel text CHECK`, `status text CHECK`, `sent_at`, con `UNIQUE (session_plan_id, kind)`. RLS: lectura para el staff de la micro-escuela vía `user_staff_school_ids()`; escritura solo `service_role`. Si el toggle de PT-P2-07 necesita una columna nueva en `school_settings`, va en esta misma migración. Plan aprobado antes de escribir; invariantes en verde. | S |
| PT-P2-05 | Job de recordatorio de sesión PT por WhatsApp (plantilla, sin agente) | bff | `bff/src/jobs/pt-session-reminders.job.ts` (nuevo), `maintenance.job.ts`, `crons-solo-en-render.ts`, `services/whatsapp-plantillas.service.ts` | No | PT-P2-04, D-06 | Cada 15 minutos toma en un solo lote las sesiones de las próximas 24 h y 2 h. Reclama con `INSERT … ON CONFLICT DO NOTHING` y envía la plantilla solo a clientes con opt-in. Kill-switch `DISABLE_PT_REMINDERS_CRON`. Corre solo en Render. Tests: dos BFF a la vez = 1 envío; sin opt-in = no se envía. Disk IO: una sola consulta por corrida, con rango de fecha indexado; se mide el costo y se enciende primero con el kill-switch en OFF en los 3 BFF. | M |
| PT-P2-06 | Plantilla Meta `recordatorio_sesion_entrenador` | ops | `bff/src/jobs/whatsapp-plantillas-sync.job.ts` | No | D-06 | Queda APPROVED en el WABA elegido, en español, con variables de nombre, entrenador, fecha y hora, y botones «Confirmo» / «Necesito reprogramar». | XS |
| PT-P2-07 | Toggle de recordatorios del entrenador | frontend + bff | `frontend/src/pages/trainer/TrainerAvailability.tsx`, `bff/src/routes/trainer/workspace.ts` | No | PT-P2-05 | El entrenador activa o desactiva los recordatorios y elige 24 h, 2 h o ambos. Se muestra cuántos se enviaron esta semana. | XS |
| PT-P2-08 | QA real: «Hoy» + recordatorio recibido | qa | `frontend/e2e/cliente-hoy.spec.ts` (nuevo) | No | PT-P2-02, PT-P2-05, PT-P2-06 | Con una sesión agendada a 2 h, el job (corrido a mano en local y luego apagado) envía 1 mensaje a un teléfono de prueba, y una segunda corrida no reenvía. El spec de «Hoy» pasa en Pixel 7. No se usa el número de producción. | S |

### P3 — Biomecánica con pantalla (diferencial de Coach Pro)

**Objetivo:** que el entrenador vea, anote y compare las capturas biomecánicas de su cliente usando las 11 rutas que ya existen. Solo entonces se anuncia.

**Semanas:** 5–7 (12 nov – 2 dic).

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| PT-P3-01 | Auditar el scoping de las 11 rutas de biomecánica | bff | `bff/src/routes/trainer/biomech.ts`, `bff/src/routes/athlete/biomech.ts` | No | — | Cada ruta verifica que la captura o el cliente pertenece a `req.schoolId`, incluidas baselines y grants. Tests de acceso cruzado entre 2 micro-escuelas → 403/404. | S |
| PT-P3-02 | Pestaña «Técnica» en la ficha del cliente | frontend | `TrainerClientProfile.tsx`, `tabs/ClientTechniqueTab.tsx` (nuevo), `components/biomech/BiomechAnnotator.tsx` (nuevo), `BiomechResultCard.tsx` | No | PT-P3-01, D-05 | El entrenador lista las capturas, crea, edita y borra anotaciones sobre un fotograma, compara contra la línea base y adjunta la captura como evidencia de una habilidad. Funciona en el celular. El gate (addon `biomech` o `coach_pro`) sale de D-05. | L |
| PT-P3-03 | Permisos de biomecánica visibles y revocables | frontend (+ bff solo si aplica al acudiente) | Ajustes de privacidad en `frontend/src/pages/athlete/`, `ClientTechniqueTab.tsx`; si aplica al acudiente: una ruta nueva del lado del padre | No | PT-P3-02 | Es frontend sobre el backend que ya existe (`athlete/biomech.ts:228,245,265`: GET, POST y DELETE de grants). El cliente ve quién tiene acceso y lo revoca; desde ese momento el entrenador recibe 403. Si el acudiente de un menor debe poder revocar, se agrega la ruta del lado del padre (las de hoy usan `requireAthleteAuth`), con un test de que solo es para el acudiente de ese menor. | S |
| PT-P3-04 | Quitar el ocultamiento de biomech en staging | frontend | `frontend/src/pages/MiPlanPage.tsx:239-243` | No | PT-P3-02 | El filtro `isStaging` se cambia por un flag explícito para poder hacer QA. Producción no cambia. | XS |
| PT-P3-05 | QA real de biomecánica | qa | `frontend/e2e/entrenador-biomecanica.spec.ts` (nuevo) | No | PT-P3-02, PT-P3-03 | Con 2 cuentas: el cliente sube una captura, el entrenador la anota y la compara, y el cliente revoca el acceso. Capturas reales. | S |
| PT-P3-06 | Publicar «Técnica» en la landing | landing | `Landing_page/.../RolePricingSection.tsx` | No | PT-P3-05, frente:landing | La viñeta aparece solo cuando el QA real está en verde y la función se ve en producción. | XS |

### P4 — Crecimiento (no se anuncia hasta que exista)

**Objetivo:** capacidades para un plan superior, que se arman solo si las señales del piloto las justifican.

**Semanas:** después del 2 de diciembre.

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| PT-P4-01 | Entrenadores en Explorar, con reserva de primera sesión | frontend + bff | `frontend/src/pages/ExplorarGlobalPage.tsx`, `frontend/src/lib/feature-flags` (`SHOW_EXPLORE`), `bff/src/routes/explorar.routes.ts`, `TrainerPublicProfile.tsx` | No | frente:familias | Con `SHOW_EXPLORE` activo en producción, un visitante filtra entrenadores por deporte y ciudad y reserva una primera sesión que cae en la disponibilidad del entrenador. | M |
| PT-P4-02 | Biblioteca de ejercicios con video propio | frontend + db | `components/trainer/ExerciseSearchInput.tsx`, `bff/src/routes/trainer/wger.ts` | **Sí** (más adelante) | PT-P3-02 | Primero se aprueban un spec y un plan de migración: tabla de ejercicios propios + bucket privado con compresión, por el límite de archivos del plan Free. Recién entonces se escribe código. | L |
| PT-P4-03 | Agente de agenda por WhatsApp | bot | `docs/specs/profesionales-independientes-agentes-ia.md` | No | PT-P2-05 | Se actualiza el spec con las decisiones cerradas y se mide la cuota de Groq y de Meta. No se anuncia «WhatsApp IA» hasta que un piloto agende sesiones reales por el bot. | XL |
| PT-P4-04 | Evaluar un plan superior (web propia + analítica) | ventas | `docs/plan-maestro-ecosistema-2026-10.md` | No | PT-P1-11 | Decisión documentada de ir o no ir, con las métricas del piloto. | S |

---

## 3. Piloto gratis de 1 mes

| | |
|---|---|
| **Mecanismo** | Se reusa la prueba de DIN-4 que ya existe: `admin_extend_trial` / `admin_set_trial` sobre la suscripción de la micro-escuela (PT-P0-02). Los entrenadores nuevos que pidan Coach Pro reciben 30 días de prueba al procesar la solicitud (PT-P0-04). No se crea ningún mecanismo nuevo. Un mes por entrenador, sin repetir. |
| **A quién** | 3 a 5 entrenadores reales. Primero, los 5 `personal_trainer` con atletas activos (ROADMAP, «Mapeo school_type»), empezando por los que estén bloqueados hoy (PT-P0-01). |
| **Qué se mide a 30 días** | Clientes activos por entrenador; sesiones agendadas y realizadas; rutinas asignadas y ejecutadas; cobros emitidos y pagados (cuántos por pasarela conectada y cuántos por comprobante); recordatorios enviados (si P2 ya salió); y si al terminar activan Coach Pro a $59.000. |
| **Criterio de éxito** | Al menos 3 entrenadores con 5 o más clientes activos usando la app cada semana, al menos 1 cobro a sus clientes hecho por la app, y **al menos 2 de cada 5 que pasan a pagar Coach Pro** al terminar el mes. Si no se llega, se revisa el precio o la propuesta antes de abrir P3. |
| **Reglas** | Gratis de verdad durante el mes: no se pide tarjeta. Ninguna comisión al cliente final. La mora de sus clientes no cancela nada. No se menciona públicamente a nadie sin su permiso. |

---

## 4. Decisiones abiertas

| # | Decisión | Bloquea | Recomendación |
|---|---|---|---|
| **D-01** | ¿Cómo se cobra Coach Pro? Tres caminos: **(A)** `plan_code='coach_pro'` en `school_subscriptions` (este backlog: una migración); **(B)** sin `plan_code` nuevo: tier de academia existente + `admin_set_school_custom_price(5.900.000)`, primer mes en $0 (propuesta de `02-plataforma.md`, PT-P0-04 y D-PT-1); **(C)** BLQ-10 completo (`owner_type='vendor'`, motor de combos, $99k). | PT-P0-03, PT-P0-04, PT-P0-12 | **A para el entrenador**, porque ya es una fila de `schools` con prueba, factura y bloqueo funcionando; BLQ-10 sigue para los roles que no son escuela. **B es el puente válido si no se quiere tocar la base esta semana**: no necesita migración, pero deja `/mi-plan` leyendo tiers de academia (`hasTier`, `athleteLimit`, `TierCode` suponen academia) y no resuelve la guarda plan↔tipo. Elegir A o B junto con `02-plataforma.md` para no tener dos diseños; el combo de módulos queda fuera hasta que exista el motor de precios. |
| **D-02** | ¿Existe un **Free Coach**? La landing de la otra sesión ya lo eliminó. | PT-P0-06, PT-P1-13 | **Que no exista.** Hay 1 mes de prueba y luego Coach Pro. Sin límite de clientes durante la prueba. |
| **D-03** | El piloto de los entrenadores actuales: ¿extender la prueba que ya existe (`admin_extend_trial`) o marcarlos `blocking_exempt` con un motivo mientras dura? | PT-P0-02 | Extender la prueba 30 días. `blocking_exempt` es para casos permanentes y se olvida de quitar. |
| **D-04** | ¿Cómo paga Coach Pro el entrenador cuando termina el piloto? Hoy existe la factura PDF + transferencia; BLQ-10 F2.5 propone Wompi a la cuenta de SportMaps. | La parte de cobro de PT-P0-10 | Por ahora, transferencia + comprobante (lo mismo que las escuelas). Wompi recurrente va en BLQ-10 F2.5 y antes hay que verificar que `WOMPI_PRIVATE_KEY` es la cuenta comercial de SportMaps. |
| **D-05** | ¿La biomecánica va incluida en Coach Pro o es el addon `biomech` aparte? | PT-P3-02 | Incluida en Coach Pro: es el diferencial que justifica los $59k. |
| **D-06** | ¿Los recordatorios salen del número de plataforma de SportMaps a nombre del entrenador, o del número propio del entrenador (coexistence)? ¿Quién paga las conversaciones? | PT-P2-05, PT-P2-06 | Número de plataforma con una plantilla de utilidad, y el costo incluido en Coach Pro con un tope mensual. |
| **D-08** | Al vencer el piloto sin pagar: ¿solo lectura (mutaciones con 402) o un modo reducido? | PT-P1-15 | Solo lectura + 402 con salida a Coach Pro. Sin cancelaciones ni desactivar clientes (la mora no cancela). |
| **D-07** | ¿El entrenador nuevo arranca con `account_type='real'`? | PT-P0-02 | Sí, si viene del onboarding público. |

**Cerradas, ya no se preguntan:**

- **Precio anual de Coach Pro:** no hay. La landing lo muestra `monthlyOnly`.
- **Precio:** $59.000 (E2).
- **Coach de escuela:** gratis dentro del plan de la escuela (E4).
- **Coach Elite:** retirado.

---

## 5. Riesgos

- **Otra sesión edita sin commitear** `frontend/src/config/saas-plans.ts` y los precios de la landing. PT-P0-06 y PT-P0-11 se hacen sobre su commit o coordinados con ella, nunca encima. El riesgo de choque en `saas-plans.ts` es bajo, porque su diff no toca al entrenador, pero el CRLF rompe los parches multilínea.
- **Una sola base para dev, stg y prod** (plan Free, Disk IO). PT-P0-04, PT-P2-03 y PT-P2-04 van en un lote serial junto con bienestar, aplicado por una sola sesión, con `gen types` solo al final.
- **Recrear el CHECK de `plan_code`** falla si hay filas con códigos fuera de la lista. Se mide antes, en PT-P0-01.
- **`rpc_process_upgrade_request` es compartida con las academias.** Cambiarla puede alterar cómo se procesan las solicitudes de escuela. La migración solo agrega la rama de `coach_pro` y deja el mapeo de academia igual; PT-P0-13 lleva la regresión de una escuela.
- **Entrenadores bloqueados hoy.** Si PT-P0-02 se demora, los que tienen clientes no pueden operar. Por eso va primero y no depende de ninguna migración.
- **Dos verdades de precio** (Tarifario y BLQ-10 a $99k contra la app a $59k) si no se hace PT-P0-12.
- **`POST /upgrade-requests` toma el `school_id` del body.** Sin el test de propiedad de PT-P0-05, un usuario podría pedir un plan para otra escuela.
- **Funciones PT creadas fuera del ledger** (drift). Si se cambian sin versionarlas antes (PT-P2-03), se puede pisar comportamiento vivo.
- **Connected Accounts está al ~85 % y solo con MP.** Si no cierra para micro-escuelas, el cobro en línea del entrenador queda en comprobante manual o Nequi.
- **`AppSidebar`:** cambiar la precedencia del rol puede afectar a super admins y escuelas. PT-P1-10 lleva la regresión con varias cuentas.
- **WhatsApp:** depende de que Meta apruebe la plantilla y del opt-in de cada cliente. Si el QA usa el número de producción, se quema cuota.
- **wger expuesto sin auth** hasta PT-P1-06.
- **Costo de Disk IO del job de recordatorios** (cada 15 min × 3 BFF sobre una sola base): se mide y se enciende gradualmente (PT-P2-05).
- **Dos diseños de cobro** (A aquí, B en `02-plataforma.md`) si D-01 no se cierra antes de tocar la base.
- **Honestidad de la landing:** no se anuncian biomecánica, WhatsApp IA ni web propia hasta que corran en la app.

---

## 6. Correcciones del revisor que se aplicaron

1. **PT-P0-07 original (procesar `coach_pro` → prueba de 30 días sin migración).** No era posible: `rpc_process_upgrade_request` fuerza `status='active'` y su tier por defecto es `'pro'`. Ahora el `CREATE OR REPLACE` de esa RPC, con la prueba, el tier explícito y la guarda plan↔tipo, va dentro de la migración PT-P0-04, y la tarea quedó como PT-P0-10.
2. **El «piloto gratis» no es nuevo.** Toda micro-escuela ya nace con 30 días de prueba y DIN-4 la bloquea al vencer. Se agregaron PT-P0-01 (medir a los 11 entrenadores), PT-P0-02 (desbloquearlos con `admin_extend_trial`) y PT-P0-09 (banner y 402 con vocabulario de entrenador y salida a Coach Pro). §3 monta el piloto sobre ese mecanismo.
3. **El plan duplicaba BLQ-10.** Ahora lo cita: D-01 bloquea la migración, la recomendación queda explícita y PT-P0-12 actualiza el Tarifario Oficial, el spec y el ROADMAP a $59k para que quede una sola verdad (D-FAC-1).
4. **La landing estaba desactualizada en el plan.** La copia de trabajo de la otra sesión ya tiene Coach Pro a $59k, sin Elite, WhatsApp IA «próximamente» y los dos caminos separados. PT-P0-11 se redujo a «1er mes gratis» + el deep-link `role=entrenador`.
5. **Free Coach eliminado en la landing.** El Free Coach queda como D-02 (recomendación: que no exista). El límite de clientes pasó a ser la tarea condicional PT-P1-13, y `TRAINER_TIERS` incluye el Free Coach solo si D-02 lo pide.
6. **D-anual-coach-pro** queda cerrada (sin plan anual) y sale de las decisiones abiertas.
7. **PT-P3-03:** el backend de revocación de grants ya existe del lado del atleta. La tarea quedó como frontend, y la única ruta nueva sería la del acudiente de un menor, si aplica.
8. **PT-P4-01:** la ruta correcta es `frontend/src/pages/ExplorarGlobalPage.tsx`, y el flag `SHOW_EXPLORE` está en `frontend/src/lib/feature-flags`.
9. La cita de `saas-plans.ts` se corrigió a `:760` (`buildLandingPlansUrl` en `:751-760`).
10. **Router wger sin auth:** se agregó PT-P1-06.
11. **Segunda pasada del revisor:** citas corregidas (`App.tsx` ~1066-1079, `MiPlanPage.tsx:239-243`); solo 7 de los 9 routers llevan `requireTrainerAuth` y el gating actual de biomecánica es por addon (relevante para D-05); se agregaron PT-P1-14 (policies y scoping cruzado de los routers del entrenador, no solo biomech), PT-P1-15 (estado al vencer sin pagar, D-08), el aviso al super admin en PT-P0-10, la medición de Disk IO en PT-P2-05, y D-01 pasó a tres caminos para reconciliar con `02-plataforma.md`. La landing ya estaba hecha por la otra sesión y PT-P0-11 ya estaba reducido.
12. **Menú:** PT-P1-08 incluye explícitamente el «Facturación» duplicado y «Mis Inscripciones».

**Faltantes que el revisor señaló, ya incorporados:**

- Interacción con DIN-4: PT-P0-01, PT-P0-02 y PT-P0-09.
- Cómo se paga el plan: D-04, que bloquea la parte de cobro de PT-P0-10.
- Tarifario y BLQ-10: PT-P0-12.
- Test de propiedad de `POST /upgrade-requests`: PT-P0-05.
- Guarda plan↔tipo también en la RPC y en el tier: PT-P0-04.
- Avisos de inicio y fin del piloto y de la primera factura: PT-P1-09.
- Invariantes, checks y lote único con bienestar: reglas de §2 y PT-P0-03.
- Regresión de `/mi-plan` y de `AppSidebar` con capturas: PT-P0-13 y PT-P1-10.
- La mora no cancela en las micro-escuelas: PT-P1-05.
- `account_type` y `blocking_exempt`: D-03 y D-07.

**Duplicados reconocidos:**

- BLQ-10 → D-01.
- DIN-4 → es la base del piloto.
- DIN-6 → dependencia de PT-P1-03, no trabajo nuevo.
- UX-13(d) → se coordina en PT-P1-07.
