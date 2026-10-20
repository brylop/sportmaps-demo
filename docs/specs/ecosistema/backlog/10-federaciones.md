# Backlog 10 — Federaciones y ligas

> Frente: **Federaciones y ligas** · Versión final con las correcciones del revisor · 14-oct-2026
> Fuentes: `docs/plan-maestro-ecosistema-2026-10.md`, `docs/specs/ecosistema/roles-organizadores-federaciones.md`, `docs/plan-agresivo-canchas-2026-10.md`, `docs/specs/reservas-canchas-plan-unificado-2026-10.md`, `docs/ROADMAP.md`.
> Este frente va **después** del organizador v2 (plan maestro, línea 94: «Necesita organizador v2 funcionando»). P0 y P1 pueden avanzar antes. P2-02, P2-05 y P3-04 quedan **bloqueadas** hasta que el organizador v2 esté vivo. **P3-01 ya no depende de él**: corre sobre `/school-tournament`, que funciona.
> **Reconciliación:** este archivo es el único plan del frente. Reemplaza cualquier plan paralelo con IDs distintos. Los ítems de grupos + eliminatoria, roster por Excel y pago de inscripción son de `08-organizador.md` y `09-torneos.md`; aquí solo se consumen o se verifican.

---

## 1. Resumen y estado actual verificado

Hoy no hay ningún producto para federaciones ni para ligas. La verificación se hizo en el código, sin consultar la base:

- Las 89 filas de `schools` con `school_type` `federation` o `association` son fichas del mapa importadas de OSM.
- `is_informational_entity(p_school_type text)` las deja fuera del trial y de las suscripciones. Es `IMMUTABLE` y `LANGUAGE sql`, y solo recibe el tipo, no la fila.
- El trigger que bloquea de verdad el INSERT en `school_subscriptions` es `prevent_gov_entity_subscription()`. Vive en la base y **no está versionado** en el repo.
- No existen tablas `league_*`, de afiliación, de temporada ni de licencia. Las coincidencias de «season» son de NIV y de `plan_type`.
- No hay rol, menú ni rutas BFF de liga. Tampoco hay forma de reclamar una ficha ni de asignarle un admin.

Lo que se reusa:

- El motor de torneos de escuela, que funciona de punta a punta.
- Los carnés digitales con QR.
- `facility_occupancy`, de la F0 de Canchas aplicada el 14-oct.
- El addon `tournaments`, que se lee con `has_entitlement`.

**Decisiones del dueño que aplican aquí (14-oct):**

- Todo piloto es **gratis por un mes**.
- No hay comisión al cliente final. Los recargos solo los decide quien cobra.
- **La mora no cancela inscripciones ni afiliaciones.**
- La landing solo publica lo que corre en la app.

| Capacidad | Estado | Evidencia |
|---|---|---|
| Fichas de federaciones y asociaciones en el mapa | Funciona | `frontend/src/components/explore/ExploreMapInteractive.tsx:33-41,147,203`; 79 federation + 10 association (`supabase/migrations/20260813170814_mapeo_school_type_a_modulos.sql:10-11`) |
| Federación o liga como cliente SaaS | No existe | `is_informational_entity(p_school_type text)` IMMUTABLE en `20260812150627_entidades_informativas_no_se_bloquean.sql:7-10,38-51`; trigger `prevent_gov_entity_subscription()` vivo **sin versionar**; `has_academy=false` en `v_school_entitlements` (`20261014153542`) |
| Trial de una ficha OSM | Roto si se habilita sin más | `v_school_entitlements` usa `COALESCE(sub.trial_ends_at, s.created_at + '1 mon')` (`20261014153542_reservas_f0_gating_por_addon.sql:87`). Como `created_at` es viejo, la ficha nace con el trial vencido |
| Admin humano de una ficha / reclamar ficha | No existe | grep `claim_school`/`school_claim` vacío. `/school-tournament` exige `requireRole('school','school_admin')` y `req.schoolId` (`bff/src/routes/events.route.ts:284`) |
| Afiliación club→liga, temporadas, vigencias | No existe | Sin tablas `league_*`, de afiliación ni de temporada en `supabase/migrations` |
| Registro federado de jugadores o licencias | No existe | `event_team_members` (`20260901114532:122`) solo guarda `full_name`, `document_number`, `birth_year` y `age_validation` por torneo |
| Carné digital con QR y verificación pública | Funciona (de escuela) | `athlete_id_cards` (`20260424000002`), `verify_athlete_id_card_public`, `/c/:qrToken` (App.tsx:346), plantilla «Federación» en `CardTemplatesManager.tsx:88`. La fila pertenece a una escuela |
| Torneo multi-escuela (anfitrión + invitadas) | Funciona | `events.route.ts:284`, `:710-778` invitaciones, `:781-976` delegaciones y comprobantes, `:1212` enroll; migraciones `20260903130451`, `20260903131025` |
| Fixture liga/copa, marcador, tarjetas, tabla, resultados públicos | Funciona | `events.route.ts:1373` generate-fixtures, `:1449` PATCH match, `:1535` standings, `:1589` public-results; `tournament_match_events.type` con yellow/red (`20260716000002:46`) |
| Generación de fixture transaccional | Roto (frágil) | `events.route.ts:1388-1400`: delete + insert sueltos sin transacción |
| Validación del formato de fixture | Roto (silencioso) | `events.route.ts:1389`: todo lo que no es `copa` se vuelve `liga` (un `grupos_eliminatoria` pasaría como liga sin error). `:1390` borra los partidos `scheduled` de la categoría al regenerar, lo que choca con partidos ya reservados en cancha. `grupos` ya está en el CHECK (`20260716000002:17-18`) pero no se genera |
| Sanciones automáticas | No existe | Las tarjetas se registran, pero no hay tabla ni regla de suspensión |
| Partidos asignados a canchas sin choques | No existe | `tournament_matches` solo tiene `venue text` y `scheduled_at` (`20260716000002:24-41`). `facility_occupancy.source_kind` ∈ rental/class/event/blackout/hour_bank (`20261014153538:31,41`) |
| Rol organizador (base del organizador v2) | Roto, pero **no bloquea a la liga** | `POST /api/v1/events` (`events.route.ts:114`, `requireRole('organizer')`) no envía `creator_id`/`creator_role`. La liga usa `/school-tournament` (`creator_role='school'`, `:323-324`), que funciona. El organizador v2 solo se necesita para roster por Excel, pago y grupos |
| Landing `Federaciones.tsx` | Ya limpia (verificar en el despliegue) | Verificado el 14-oct: el grep de `50+`, `1,000+`, `100K+`, `500+`, licencia, renov y registro federado en `src/pages/Federaciones.tsx` devuelve 0, y `git status` del repo de la landing sale limpio (último commit del archivo: `ed7eb1f`). **Falta confirmar** el chunk desplegado y `public/llms-full.txt:27` («gestión de afiliados, torneos y certificaciones») |
| Landing: planes Federación Pro / Nacional | Parcial (la tarjeta ya está limpia y commiteada) | `RolePricingSection.tsx:331-358` ya dice «Piloto para ligas 2027 — un mes gratis», sin precio. **Quedan**: `PlansComparisonTable.tsx:38-39` («Carnetización nacional», «Módulo de arbitraje») y `:51` (columnas «Federación Pro», «Nacional»); `src/lib/combos.ts:36` (comentario con «Federación Pro»); `ComboFinder.tsx:55,112` (opción «Federación / Liga» con combos, contrastar con lo que corre); `RolePricingSection.tsx:236,246` y `src/config/saas-plans.ts:234` («Holdings y federaciones»); `public/llms-full.txt:27,49`. El comentario de `RolePricingSection.tsx:24` («Desde $1.200.000») es solo un ejemplo de prop |
| Formularios de contacto de la landing | Parcial | La edge function `submit-provider-application` no está en ningún repo (la landing no tiene `supabase/functions`). La invocan **seis** formularios: Federaciones, Bienestar, Marcas, Proveedores, Servicios y PartnerProvider. Tienen fallback a WhatsApp (`whatsappFallback.ts`) |
| Federaciones en los planes de la app | Parcial (**duplicado de INF-10**) | `frontend/src/config/saas-plans.ts:236`, `MiPlanPage.tsx:627`, `SchoolRegister.tsx:303` sin importadores (`ROADMAP.md:1344`) |
| Tarifario de facturación multi-rol | Desactualizado | BLQ-10 (`ROADMAP.md:1717`) todavía incluye «Federación Pro $549k» |

---

## 2. Fases

Reglas que aplican a **todas** las fases. Vienen del `CLAUDE.md` del repo:

- **Migraciones:**
  - Son inmutables y se crean con `npm run migrations:new -- <slug>`. El `.sql` se commitea junto a `supabase/migrations_ledger.json`, y `npm run migrations:check` tiene que quedar en verde.
  - **El plan de migraciones de cada fase se aprueba antes de escribir SQL.**
  - **Una sola sesión** aplica el lote, por una vía que deje rastro (CLI o `apply_migration`).
  - `types.ts` se regenera **una vez al cierre de cada lote**.
  - Para sondear la base no se usan `list_tables` ni `get_advisors`. Las consultas van filtradas por nombre (`pg_policies`, `pg_proc`).
- **Funciones y RPC:**
  - Toda función lleva `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE` explícito y `REVOKE` explícito de `anon` y `authenticated` cuando aplique.
  - Crear varias filas = RPC transaccional `SECURITY DEFINER`.
- **Esquema:**
  - Los estados se modelan con `text + CHECK`, nunca con `CREATE TYPE`.
  - Las FK de negocio apuntan a `profiles(id)`.
- **RLS:**
  - Ninguna policy hace self-recursion.
  - La escritura operativa usa `user_staff_school_ids()`. Lo que otorga permisos usa `user_admin_school_ids()`. **Nunca** se escribe con `user_school_ids()`.
  - `npm run seguridad:invariantes` tiene que dar 0 críticos al cerrar cada lote.
- **Entrega:**
  - Full-stack por feature (DB + RLS + RPC + BFF + frontend + QA), con una rama por fase sobre `develop`.
  - Los jobs se escriben sin N+1 (`.in('id', ids)`).

### P0 — Dejar de prometer y elegir la liga piloto

**Objetivo:** que nada publicado prometa funciones de federación que no existen, y que haya una liga real comprometida y un spec aprobado (con la vía técnica elegida) antes de escribir SQL.
**Semanas:** semana 1 (14 al 18 de oct). P0-05 y P0-06 pueden seguir hasta la semana 3.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| FED-P0-01 | **Verificación, no edición:** confirmar que la landing de `/federaciones` ya no promete cifras ni licencias. Si algo falta, se corrige. Es el mismo ítem que el plan maestro, línea 55, y que D.5 del spec del ecosistema | landing | `Landing_page/.../frontend/src/pages/Federaciones.tsx`, `public/llms-full.txt:27`, `scripts/prerender.mjs` | No | frente:landing | Un grep de `50+\|1,000+\|100K+\|500+\|renovaciones automáticas\|registro federado\|federados con licencias` en `Federaciones.tsx`, en el build prerenderizado y en el chunk desplegado de `/federaciones` devuelve 0. `llms-full.txt:27` pasa a describir solo lo que corre (o «piloto 2027»). Se revisa con `git log`, no con `git status` | XS |
| FED-P0-02 | Landing: quitar lo que **queda** de «Federación Pro», «Nacional» y promesas de federación en comparativa, combos y textos | landing | `src/components/sections/Pricing/PlansComparisonTable.tsx:38-39,51`, `src/lib/combos.ts:36`, `src/components/sections/Pricing/ComboFinder.tsx:55,112`, `src/components/common/cards/RolePricingSection.tsx:236,246`, `src/config/saas-plans.ts:234`, `public/llms-full.txt:27,49` | No | frente:landing | Ni el repo ni el chunk desplegado de `/planes` y `/federaciones` contienen `Federación Pro`, `federacion-completa`, `Carnetización nacional`, `Módulo de arbitraje`, `API gobierno`, `549.000` ni `1.200.000` (se excluye el comentario de ejemplo de `RolePricingSection.tsx:24`). Los beneficios de la tarjeta («fixture, tabla pública, cobro con comprobante») se contrastan con lo que corre de verdad. Un solo commit; se confirma antes con `git log` que no haya cambios en curso de otra sesión | S |
| FED-P0-03 | Verificar los formularios que usan la edge function `submit-provider-application` (no está en ningún repo): **los seis**, empezando por Federaciones, Bienestar y Marcas | landing | `src/components/forms/FederacionesRegistroForm.tsx`, `BienestarRegistroForm.tsx`, `MarcasRegistroForm.tsx` (y `ProveedoresRegistroForm.tsx`, `ServiciosRegistroForm.tsx`, `PartnerProviderForm.tsx`), `src/lib/whatsappFallback.ts` | No | — | Con la landing corriendo se envía cada formulario y queda una de dos cosas: la fila del lead en la tabla de la función desplegada (consultada por nombre) o el envío directo al WhatsApp comercial +57 320 268 3539. Ningún envío se pierde en silencio. Se versiona la función en un repo o se retira la llamada | S |
| FED-P0-04 | **Duplicada de INF-10** (`ROADMAP.md:1344`), que ya pide borrar `SchoolRegister.tsx`. Es lo único realmente pendiente: el archivo sigue existiendo, ofrece `federacion` (`:303`) y nadie lo importa, así que borrarlo es seguro. El tagline de `saas-plans.ts:236` y `MiPlanPage.tsx:627` se decide junto con la landing (`saas-plans.ts:234`) en un solo cambio de texto | frontend | `frontend/src/components/pages/SchoolRegister.tsx`, `frontend/src/config/saas-plans.ts:236`, `frontend/src/pages/MiPlanPage.tsx:627` | No | INF-10 | Al cerrar INF-10: `SchoolRegister.tsx` borrado, `tsc --noEmit` limpio y `grep -i federac` en los tres archivos sin promesas. Se marca INF-10 como cerrado en el ROADMAP. Este frente no lo ejecuta aparte | XS |
| FED-P0-05 | Descubrimiento: elegir la liga piloto (regional, un deporte, 8 a 30 clubes) y levantar su proceso actual con 2 entrevistas | ventas | `docs/specs/ecosistema/roles-organizadores-federaciones.md` (anexo) | No | — | El dueño nombra la liga, con contacto y deporte. Queda documentado su ciclo real: fechas de temporada, documentos por jugador, cuota de afiliación, reglamento de tarjetas, cómo resuelve hoy las disputas y cuántos de sus clubes ya son escuelas en SportMaps | S |
| FED-P0-06 | Spec «Ligas piloto 2027» con las decisiones resueltas y el plan de migraciones para aprobar | db (spec) | `docs/specs/ligas-piloto-2027.md`, `docs/ROADMAP.md` | No | FED-P0-05 | El spec fija los puntos de la tabla de abajo. Tiene la **aprobación explícita del dueño** antes de cualquier SQL. Se agregan al ROADMAP las filas FED-* de este backlog (hoy no hay ninguna) | M |

Puntos que fija el spec de FED-P0-06:

| # | Qué fija |
|---|---|
| 1 | **La vía para habilitar la liga.** **(a)**: pasar la ficha a `club`/`hybrid` con `admin_set_school_type` y sumar el addon. Así no se tocan la función ni el trigger. **(b)**: conservar `federation`, con una función nueva por `school_id` `STABLE` y versionando antes el trigger vivo. Recomendada: (a) |
| 2 | Cómo se asigna el **admin humano** y cómo se verifica su identidad |
| 3 | El modelo de temporada, afiliación y licencia con `text+CHECK` |
| 4 | El helper de alcance de cada policy, incluido un helper de **lectura cruzada** liga→clubes |
| 5 | La RPC transaccional que cubre cada alta de varias filas |
| 6 | El reglamento de sanciones del piloto |
| 7 | Cómo emite la liga un carné de un atleta de otro club: tabla puente o dueño de la fila |
| 8 | `source_kind` del partido en `facility_occupancy`: `event` con `source_id=match_id`, o un valor nuevo |
| 9 | Responsable del dato y autorización del acudiente (Ley 1581) |
| 10 | **Identidad del jugador entre clubes.** `UNIQUE(temporada, documento)` trata el documento como identidad, pero el repo ya documenta identidades de atleta duplicadas (`unregistered_athletes`). El spec define de dónde sale la identidad federada, cómo se normaliza el documento (tipo + número) y qué pasa si el mismo menor tiene dos fichas |
| 11 | **Matriz de notificaciones:** evento, destinatario, canal (in-app, push, correo, WhatsApp) y plantilla, para invitación de afiliación, aprobación o rechazo de jugador, sanción aplicada o anulada y partido programado o movido |
| 12 | **Gobernanza de sanciones:** quién puede anular, auditoría (quién, cuándo, motivo), apelación y qué pasa con sanciones que cruzan torneos o temporadas |
| 13 | **Permiso de canchas del club:** modelo explícito con el que un club afiliado autoriza a la liga a reservar sus canchas, alineado con el EXCLUDE de `facility_occupancy` y el gate por addon de Canchas |
| 14 | **Criterios de éxito, de salida y acuerdo del piloto** (qué métricas deciden la conversión) y autorización escrita para usar el caso en la landing |

**Criterio de aceptación de cada migración del frente (no solo del cierre de P1):** revisión línea por línea de las policies antes de aplicar; `set local role anon` devuelve 0 filas; simulación de JWT con `user_admin_school_ids()` frente a `user_staff_school_ids()` para cada tabla nueva; `npm run seguridad:invariantes` con 0 críticos.

### P1 — La liga como cliente: admin, temporada y afiliación de clubes

**Objetivo:** que una liga real entre a SportMaps con un admin humano que inicia sesión, tenga trial vigente, abra su temporada y afilie a sus clubes (escuelas existentes o nuevas) con estado y vigencia.
**Semanas:** 3 a 5. No arranca sin FED-P0-05 y FED-P0-06 cerrados.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| FED-P1-00 | *(Solo si el spec elige la vía (b))* Versionar el trigger vivo `prevent_gov_entity_subscription()` tal como está, leído de `pg_proc` filtrando por nombre | db | `supabase/migrations/<nuevo>_versionar_prevent_gov_entity_subscription.sql`, `supabase/migrations_ledger.json` | Sí (condicional) | FED-P0-06 | El cuerpo versionado es idéntico al de `pg_proc.prosrc`. Aplicarlo no cambia el comportamiento: una federation sigue rechazando el INSERT en `school_subscriptions` | S |
| FED-P1-01 | RPC `admin_enable_league(school_id)`, solo para super_admin. En **una transacción**: (a) `admin_set_school_type` a tipo cliente, (b) addon `league` + `tournaments` en `school_addons` y (c) **crear la `school_subscriptions` con `trial_ends_at = now() + interval '1 month'`**, sin factura | db | `supabase/migrations/<nuevo>_ligas_p1_habilitar_liga.sql`, `supabase/migrations_ledger.json` | Sí | FED-P0-06 (FED-P1-00 si es la vía b) | `SECURITY DEFINER`, `search_path` fijo, exige `is_super_admin()`, REVOKE de anon/authenticated y GRANT solo a quien corresponde. **No se toca `is_informational_entity()`** (es `IMMUTABLE` y solo recibe el tipo): las otras 88 fichas siguen exentas, lo que se comprueba consultando 3 de ellas. `v_school_entitlements` de la liga muestra el trial vigente hasta alta + 1 mes. Pasa `migrations:check`. Ningún INSERT de signup se rompe. Ni el cron de cobro ni el correo de cobro generan nada durante el trial de la liga | M |
| FED-P1-02 | **Admin humano de la liga:** RPC `admin_assign_school_admin(school_id, profile_id)` para super_admin (owner/school_admin sobre la fila) con verificación previa documentada (llamada y documento del representante legal) | db + bff | `supabase/migrations/<nuevo>_ligas_p1_asignar_admin.sql`, `bff/src/routes/admin*.ts` | Sí | FED-P1-01 | El admin de la liga inicia sesión y **`req.schoolId` resuelve a la liga**. `POST /school-tournament` responde 2xx con su sesión. Una cuenta sin asignar recibe 403. Queda registrado quién asignó y cuándo. Se puede revocar | M |
| FED-P1-03 | Tablas `league_seasons` y `league_affiliations` (liga→club, estado `text+CHECK` pending/active/suspended/expired, vigencia por temporada, cuota informativa) con RLS | db | `supabase/migrations/<nuevo>_ligas_p1_temporadas_afiliaciones.sql`, `supabase/migrations_ledger.json` | Sí | FED-P1-01 | FK a `schools` y `profiles`, `UNIQUE(season_id, club_school_id)`. Leen el staff de la liga y el staff del club afiliado. Escribe solo el admin de la liga (`user_admin_school_ids()`), sin self-recursion. Invariantes sin I1-I4 nuevos y `set local role anon` → 0 filas. **Ningún estado (`suspended`, `expired`) se mueve solo por mora ni por cron**: solo por acción manual de la liga o fin de vigencia declarado por ella | M |
| FED-P1-04 | Helper `user_league_admin_ids()` (`SECURITY DEFINER`, `STABLE`) para la **lectura cruzada** de la liga sobre sus clubes afiliados activos: `event_team_members`, `athlete_id_cards` y registros | db | `supabase/migrations/<nuevo>_ligas_p1_helper_lectura_cruzada.sql` | Sí | FED-P1-03 | Se usa solo en policies `FOR SELECT`. Una prueba demuestra que el admin de la liga **no** puede escribir en tablas del club. No hay recursión. Nunca se revoca a `authenticated` (lo invocan las policies). GRANT EXECUTE explícito | S |
| FED-P1-05 | RPCs transaccionales `league_open_season`, `league_invite_club` (token, mismo patrón que `event_invitations`), `league_claim_affiliation` y `league_set_affiliation_status` (con motivo) | db | `supabase/migrations/<nuevo>_ligas_p1_rpcs_afiliacion.sql` (patrón de `20260903130451`) | Sí | FED-P1-03 | Cada RPC tiene `SECURITY DEFINER`, `search_path` fijo y GRANT explícito. El claim lo hace un **admin del club** (`user_admin_school_ids()`, lección de `20260903131025`). Un test de concurrencia muestra que dos claims del mismo token dan una sola afiliación. El cambio de estado guarda quién, cuándo y por qué | M |
| FED-P1-06 | BFF `league.routes.ts`: `/api/v1/leagues/:id/seasons`, `/affiliations`, `/invitations`, `/claim`, con gate `has_entitlement(league)` y lecturas en lote | bff | `bff/src/routes/league.routes.ts`, `bff/src/index.ts`, `docs/api/openapi.yaml` | No | FED-P1-05 | Las rutas solo llaman RPCs. Los tests cubren 403 para coach, parent, admin de otro club y una escuela sin addon. Sin N+1. `openapi.yaml` actualizado | M |
| FED-P1-07 | Frontend: panel de liga con temporada, clubes afiliados con estado, invitar club por enlace o WhatsApp y aceptar la invitación desde la escuela. **La sección «Liga» va en los dos árboles de menú** (school y school_admin), gateada por addon | frontend | `frontend/src/config/navigation.ts` (ambos árboles), `frontend/src/App.tsx`, `frontend/src/pages/league/LeagueDashboardPage.tsx`, `LeagueClubsPage.tsx`, `LeagueInvitationClaimPage.tsx` | No | FED-P1-06 | El admin de la liga ve «Liga» entre por el árbol que entre. Una escuela sin el addon no la ve. El admin de un club se afilia en un paso. Español de Colombia, sin voseo. Sin scroll horizontal a 360 px | L |
| FED-P1-08 | Notificaciones por el despachador existente: invitación de club, afiliación aceptada y suspendida. Plantilla de WhatsApp o correo para clubes **sin cuenta** | bff | `bff/src/services/notification.service.ts`, plantillas de correo/WhatsApp | No | FED-P1-05 | Cada evento genera un aviso in-app/push al staff correcto. Un club sin cuenta recibe el enlace por correo o WhatsApp. Sin envíos duplicados | S |
| FED-P1-09 | Cierre del lote P1: aplicar desde **una sola sesión**, regenerar `types.ts` una vez, `migrations:check` y `seguridad:invariantes` | ops | `frontend/src/integrations/supabase/types.ts` | No | FED-P1-01..05 | Una sola regeneración. `tsc --noEmit` limpio en frontend y BFF. Invariantes con 0 críticos | XS |
| FED-P1-10 | QA real P1: liga de prueba + 3 clubes de prueba (uno sin cuenta), en la app corriendo. Incluye la **línea base de regresión** de los torneos de escuela vivos (Besser, Monster) | qa | `docs/qa/ligas-p1.md` | No | FED-P1-07, FED-P1-08, FED-P1-09 | Con capturas pasan: alta de la liga, asignar admin, login, abrir temporada, invitar, reclamar y suspender. Las pruebas negativas fallan como se espera (anon, padre del club, coach y admin de otro club). `v_school_entitlements` muestra el trial correcto. Queda guardado el recorrido base de un torneo de escuela para comparar en P3. No se borran datos de prueba | M |

### P2 — Carnetización federada

**Objetivo:** que cada club inscriba a sus jugadores en la liga con autorización del acudiente, que la liga valide documento y edad, y que el jugador tenga un carné de la liga verificable por QR sin exponer datos de menores.
**Semanas:** 6 a 8. P2-02 y P2-05 quedan bloqueadas por el organizador v2.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| FED-P2-00 | Datos de menores (Ley 1581): definir el responsable del dato (liga o club), el texto de autorización del acudiente y la retención. Se apoya en el patrón de consentimiento del módulo de bienestar | contenido / legal | `docs/specs/ligas-piloto-2027.md` (sección datos personales) | No | FED-P0-06 | Hay texto de autorización aprobado por el dueño. Queda definido qué ve la liga, qué ve el público y cuánto tiempo se guarda, y se cierra el punto 10 del spec (identidad federada entre clubes y documento duplicado). El carné público se audita contra `verify_athlete_id_card_public` para no exponer documento ni fecha de nacimiento. Sin esto P2-01 no se aplica | S |
| FED-P2-01 | Tabla `league_player_registrations` (temporada, club, `child_id`/`profile_id`, documento, fecha de nacimiento, categoría, estado `text+CHECK` pending/approved/rejected/suspended, motivo, **autorización del acudiente con fecha**) con `UNIQUE(temporada, documento)` | db | `supabase/migrations/<nuevo>_ligas_p2_registro_jugadores.sql`, `supabase/migrations_ledger.json` | Sí | FED-P1-03, FED-P2-00 | El constraint rechaza un mismo documento en dos clubes. El club escribe sus pendientes con `user_staff_school_ids()` y aprueba solo la liga (`user_admin_school_ids()` de la liga). La liga lee con `user_league_admin_ids()`. Anon no lee la fecha de nacimiento. No se aprueba sin autorización. I1-I4 limpios | M |
| FED-P2-02 | RPC `league_register_players_bulk` (lote desde los atletas del club o desde Excel, con `dry_run`) y `league_review_registration` | db | `supabase/migrations/<nuevo>_ligas_p2_rpcs_registro.sql` | Sí | FED-P2-01, **frente:organizadores (roster por Excel) — BLOQUEADA** | Todo o nada. El `dry_run` devuelve errores por fila sin escribir. Reusa el parser del organizador v2; si no existe, deja la interfaz compatible | L |
| FED-P2-03 | Carné de la liga: **tabla puente** (o el modelo de propiedad que elija el spec) para que la liga emita el carné de un atleta de otro club sobre `athlete_id_cards`, más una RPC pública de verificación con columnas publicables | db | `supabase/migrations/<nuevo>_ligas_p2_carnet_federado.sql`, `frontend/src/pages/AthleteCardPublicPage.tsx`, `frontend/src/components/cards/CardTemplatesManager.tsx` | Sí | FED-P2-01 | La verificación devuelve solo nombre, foto, club, categoría, temporada, vigencia y estado. No devuelve documento completo ni fecha de nacimiento. Un suspendido se ve «No habilitado» en rojo. El carné de escuela no cambia (regresión) | M |
| FED-P2-04 | BFF + frontend: inscripción desde el club (elegir atletas o Excel) y bandeja de revisión de la liga con filtro por club y categoría | frontend + bff | `bff/src/routes/league.routes.ts`, `frontend/src/pages/league/LeaguePlayersReviewPage.tsx`, `frontend/src/pages/school/SchoolLeagueRegistrationPage.tsx`, `docs/api/openapi.yaml` | No | FED-P2-02, FED-P2-03 | Un club inscribe 25 jugadores en menos de 3 minutos. La liga aprueba en lote. Consultas con `.in()`, sin N+1 | L |
| FED-P2-05 | Cuota de afiliación o carné: el club paga a la liga por comprobante, reusando el motor de pagos de delegación. Sin comisión de SportMaps | bff + db | `supabase/migrations/<nuevo>_ligas_p2_cuota_afiliacion.sql`, `bff/src/routes/league.routes.ts` | Sí | FED-P2-04, **frente:organizadores — BLOQUEADA** | El monto lo fija la liga. Registrar o no registrar el pago **no cambia** el estado de la afiliación ni bloquea a nadie por mora: la liga decide a mano. Los recargos, si existen, los configura la liga | M |
| FED-P2-06 | Notificaciones: jugador aprobado o rechazado (con motivo) y carné emitido, por el despachador existente | bff | `bff/src/services/notification.service.ts` | No | FED-P2-04 | El staff del club y el acudiente (si tiene cuenta) reciben el aviso. Sin N+1 en envíos por lote | S |
| FED-P2-07 | Cierre del lote P2: una sola sesión aplica, `types.ts` una vez, `openapi.yaml`, `migrations:check` e invariantes | ops | `frontend/src/integrations/supabase/types.ts`, `docs/api/openapi.yaml` | No | FED-P2-01..05 | `tsc --noEmit` limpio y 0 críticos | XS |
| FED-P2-08 | QA real P2: 2 clubes, 40 jugadores, un documento duplicado entre clubes y verificación del carné desde el celular | qa | `docs/qa/ligas-p2.md` | No | FED-P2-06, FED-P2-07 | Pasa con capturas en el celular. El duplicado se rechaza con un mensaje claro. El QR de un suspendido muestra el estado correcto en una sesión anónima. Una prueba de anon no ve fechas de nacimiento. 0 críticos | M |

### P3 — Torneo de temporada multi-club con sanciones y canchas

**Objetivo:** que la liga corra su campeonato de temporada con los clubes afiliados, solo con jugadores habilitados, con suspensiones automáticas y con partidos en canchas sin choques, sin regresión en los torneos de escuela.
**Semanas:** 9 a 11. Va después del organizador v2, que está en las semanas 5 a 8.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| FED-P3-00 | RPC transaccional `tournament_generate_fixture(event_id, format, ...)` que borra los partidos `scheduled`, libera su ocupación y vuelve a crearlos en una sola transacción. El BFF responde **400 ante un formato desconocido** (hoy `:1389` degrada todo a `liga`) y se define qué pasa con las reservas de `facility_occupancy` al regenerar | db + bff | `supabase/migrations/<nuevo>_torneos_fixture_transaccional.sql`, `bff/src/routes/events.route.ts:1373-1400` | Sí | FED-P1-09 (coordinar con frente:organizadores si ya lo tomó) | `format=xyz` → 400. Regenerar no deja partidos huérfanos. La regresión de los torneos de Besser y Monster da el mismo resultado que la línea base de P1 | M |
| FED-P3-01 | Torneo de liga sobre el motor de school-tournament: `events.league_season_id` + RPC `league_seed_delegations`, que crea en una transacción una delegación por club afiliado activo | db | `supabase/migrations/<nuevo>_ligas_p3_torneo_de_temporada.sql`, `bff/src/routes/events.route.ts` | Sí | FED-P1-02, FED-P1-05 (**ya no depende del organizador v2**: usa `/school-tournament`) | El admin de la liga, con `req.schoolId` resuelto, crea el torneo por `/school-tournament`. Las delegaciones se crean en una sola transacción y nada se crea desde el cliente | M |
| FED-P3-02 | Roster restringido: `event_team_members` solo acepta jugadores con registro `approved` en la temporada. La categoría se valida por fecha de nacimiento | db + bff | `supabase/migrations/<nuevo>_ligas_p3_roster_habilitados.sql`, `bff/src/routes/events.route.ts:1212` | Sí | FED-P2-01, FED-P3-01 | Enroll rechaza a un jugador no habilitado o de otro club con 422 y su nombre. `age_validation` queda `valid` o `invalid` según el spec. Los torneos de escuela sin liga no cambian (regresión) | M |
| FED-P3-03 | Sanciones automáticas: `tournament_sanctions` + reglas por torneo (N amarillas o roja directa = M fechas) calculadas desde `tournament_match_events`, con bloqueo en la planilla y anulación manual con motivo y auditoría | db + bff + frontend | `supabase/migrations/<nuevo>_ligas_p3_sanciones.sql`, `bff/src/routes/events.route.ts` (`:1449` PATCH match, `:1505` rosters), `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` | Sí | FED-P3-01 | Una roja en PATCH match crea la sanción en la misma transacción. Rosters marca al suspendido y el BFF rechaza un gol o una tarjeta suya. La liga anula con motivo y queda quién y cuándo. Test de concurrencia con dos PATCH simultáneos y prueba de que corregir o borrar una tarjeta ya registrada revierte la sanción, según el punto 12 del spec | L |
| FED-P3-04 | Grupos + eliminatoria y desempates (DG, enfrentamiento directo, fair play). **Lo hace el frente organizadores** (`roles-organizadores-federaciones.md:27`; plan maestro línea 27). Aquí solo se verifica con datos de liga. Reusa el valor `grupos` del CHECK existente (`20260716000002:17-18`), **sin migración propia** | qa (verificación) | `bff/src/routes/events.route.ts` | No | frente:organizadores — BLOQUEADA, FED-P3-00 | Con datos de la liga, la tabla aplica los desempates en el orden configurado. Si los desempates necesitan columna, la migración la crea el frente organizadores | S |
| FED-P3-05 | Partidos de la liga en canchas: `tournament_matches.facility_id` + `starts_at`/`ends_at`, con la reserva en `facility_occupancy` creada y liberada **dentro de la RPC de P3-00** y en una RPC de reprogramación | db + bff | `supabase/migrations/<nuevo>_torneos_partidos_en_canchas.sql`, `bff/src/routes/events.route.ts` | Sí | FED-P3-00, FED-P3-01, frente:canchas | Dos partidos en la misma cancha y franja se rechazan por el EXCLUDE con un mensaje legible. Al mover un partido se libera la franja anterior en la misma transacción. `source_kind` según el spec (`event` + `source_id=match_id`, o un valor nuevo agregado al CHECK). Las canchas de un club afiliado se usan solo con el permiso explícito del club (punto 13 del spec) y con el addon de Canchas activo | M |
| FED-P3-06 | Página pública de la liga: calendario de la temporada, tabla, goleadores, sancionados y clubes afiliados, con imagen OG para WhatsApp | frontend + bff | `frontend/src/pages/events/TournamentResultsPage.tsx`, `frontend/src/pages/league/LeaguePublicPage.tsx`, `bff/src/routes/league.routes.ts` | No | FED-P3-03 | Carga sin sesión. Lee de una vista o RPC con columnas publicables (nunca de una policy `USING(true)`) y no expone documentos ni fechas de nacimiento. La vista previa en WhatsApp funciona. **Presupuesto de Disk IO:** tabla, goleadores y sancionados salen de una vista o RPC con caché (CDN o vista materializada), nunca consultas sin caché por visita | M |
| FED-P3-07 | Notificaciones de sanción y documento de operación y soporte: qué hace la liga si un club disputa una sanción o un rechazo, quién anula y con qué rastro | bff + contenido | `bff/src/services/notification.service.ts`, `docs/specs/ligas-piloto-2027.md` (anexo de operación) | No | FED-P3-03 | El club recibe el aviso de la sanción. El documento describe el flujo de disputa y la auditoría, y la liga lo aprueba | S |
| FED-P3-08 | Cierre del lote P3: una sola sesión aplica, `types.ts` una vez, `openapi.yaml`, `migrations:check` e invariantes | ops | `frontend/src/integrations/supabase/types.ts`, `docs/api/openapi.yaml` | No | FED-P3-00..05 | `tsc --noEmit` limpio y 0 críticos | XS |
| FED-P3-09 | QA real P3: temporada con 4 clubes, 2 categorías, 3 fechas jugadas, una roja y una acumulación de amarillas | qa | `docs/qa/ligas-p3.md` | No | FED-P3-02..08 | En la app corriendo: el suspendido no juega la fecha siguiente, la tabla y los goleadores coinciden con un cálculo a mano y no hay choque de cancha. **Los torneos de Besser y Monster no tienen regresión** frente a la línea base de P1. 0 críticos | M |

### P4 — Piloto gratis 1 mes y venta asistida

**Objetivo:** poner a operar a la liga real un mes sin costo, con criterios de éxito fijados antes de empezar, y decidir con datos si se convierte en el primer cliente de Federaciones.
**Semanas:** 12 a 16.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| FED-P4-00 | Fijar **antes del alta** los criterios de éxito y la fecha de corte (ver §3) | ventas | `docs/specs/ligas-piloto-2027.md` | No | FED-P0-05 | El dueño firma los umbrales, los criterios de salida, la fecha de corte y el acuerdo del piloto con la liga (incluida la autorización escrita para el caso en la landing). Todo está escrito antes de FED-P4-01 | XS |
| FED-P4-01 | Alta del piloto con `admin_enable_league` (trial de 30 días, sin cobro) y `admin_assign_school_admin` para el admin real | ops | `docs/specs/ligas-piloto-2027.md`, `docs/ROADMAP.md` | No | FED-P3-09, FED-P4-00 | **`v_school_entitlements` de la liga muestra `trial_ends_at = alta + 1 mes`**. No sale ninguna factura antes. El admin real entra con su cuenta y `req.schoolId` resuelve a la liga. Queda en el ROADMAP quién y cuándo | S |
| FED-P4-02 | Onboarding asistido: cargar la temporada, invitar a todos los clubes, guía PDF con capturas reales (2 versiones + Mapi) para la liga y los clubes | contenido | `docs/manuales/_src/liga-piloto/`, `docs/manuales/liga-piloto.pdf` | No | FED-P4-01 | Manual con capturas de la app corriendo, sin mockups. Al menos el 70 % de los clubes queda afiliado en la primera semana | M |
| FED-P4-03 | Tablero del piloto para el dueño: clubes afiliados, jugadores carnetizados, partidos registrados, sanciones aplicadas y tiempo ahorrado según la liga, **contra los umbrales de P4-00** | bff | `bff/src/routes/league.routes.ts`, `docs/specs/ligas-piloto-2027.md` | No | FED-P4-01 | Un endpoint de super_admin devuelve las 5 métricas con consultas agregadas, sin N+1 ni job por minuto, y muestra si cada umbral se cumple. Corte semanal documentado | S |
| FED-P4-04 | Decisión comercial en la fecha de corte: precio por liga (venta asistida, sin precio público) y SKU en facturación multi-rol. **Retirar o actualizar «Federación Pro $549k» en BLQ-10** | ventas | `frontend/src/config/saas-plans.ts`, `docs/specs/facturacion-saas-multirol-comprobantes.md`, `docs/ROADMAP.md` (BLQ-10) | No | FED-P4-03, frente:facturacion-saas | El dueño aprueba el precio con los datos del piloto. El SKU se puede cobrar antes de publicarlo. BLQ-10 ya no tiene $549k. Sin comisión al jugador ni al club | S |
| FED-P4-05 | Landing: publicar Federaciones con lo que corre de verdad (afiliación, carné QR, torneo de temporada, sanciones) y el caso real si la liga lo autoriza | landing | `Landing_page/.../src/pages/Federaciones.tsx`, `src/components/common/cards/RolePricingSection.tsx` | No | FED-P4-04, frente:landing | Cada función publicada se puede mostrar en vivo. Las cifras salen de FED-P4-03 o no se publican. El testimonio tiene autorización escrita. Se verifica en el chunk desplegado. Hay acuerdo del piloto firmado (FED-P4-00) | S |
| FED-P4-06 | QA de cierre del piloto: recorrido completo con el admin real de la liga y 2 clubes, en el celular | qa | `docs/qa/ligas-piloto-cierre.md` | No | FED-P4-02 | Sesión grabada o con capturas, con lista de fricciones priorizada. Cero bloqueantes abiertos. 0 críticos en invariantes | S |

---

## 3. Piloto gratis 1 mes

- **A quién:** una liga regional real, de un deporte, con 8 a 30 clubes. Sale de FED-P0-05. Se prefiere una con varios clubes que ya sean escuelas en SportMaps.
- **Qué incluye sin costo, 30 días:**
  - Addon `league` + `tournaments`.
  - Afiliación de clubes y carnés de la liga.
  - Torneo de temporada con sanciones y canchas.
  - Onboarding asistido.
- **Los clubes afiliados no pagan nada** por estar en la liga. Sin comisión a jugadores ni a familias.
- **Al vencer el mes:**
  - No se cancela nada automáticamente ni se bloquean datos por mora.
  - El dueño decide con el tablero (FED-P4-03) y la liga elige si sigue con venta asistida.

**Qué se mide (corte semanal):**

1. Clubes afiliados sobre el total de clubes de la liga.
2. Jugadores carnetizados (registros aprobados).
3. Partidos registrados con marcador en la app.
4. Sanciones calculadas automáticamente y cuántas se anularon a mano. Esto mide la calidad de la regla.
5. Tiempo que la liga dice ahorrar frente a su proceso actual (entrevista al cierre).

**Criterio de éxito.** Los umbrales finales los firma el dueño en FED-P4-00. Propuesta:

- ≥ 70 % de los clubes afiliados en la semana 1.
- ≥ 60 % de los jugadores del torneo carnetizados en la app.
- ≥ 80 % de los partidos del mes con marcador cargado.
- Cero incidentes de datos de menores expuestos.
- Que la liga diga que **pagaría** (con un rango de precio) en la entrevista de cierre.

Si se cumplen 4 de 5, se crea el SKU (FED-P4-04).

---

## 4. Decisiones abiertas

1. ¿Qué liga real hace el piloto (deporte, región, número de clubes) y quién de SportMaps la acompaña?
2. Vía técnica para habilitar la liga:
   - **(a)** cambiar la ficha a `club`/`hybrid` con `admin_set_school_type` + addon (recomendada: no toca la función IMMUTABLE ni el trigger sin versionar).
   - **(b)** conservar `federation`, con una función nueva por `school_id` y versionando antes `prevent_gov_entity_subscription()`.
3. ¿Habilitar la ficha OSM existente o crear una fila nueva y dejar la ficha solo en el mapa?
4. ¿Cómo se verifica que quien pide ser admin de la liga la representa de verdad (documento, llamada, carta)?
5. ¿El carné de la liga reemplaza o convive con el carné de escuela? ¿Se emite con tabla puente o con cambio de dueño de la fila?
6. Responsable del dato de los menores (¿liga o club?) y texto de autorización del acudiente (Ley 1581).
7. ¿La cuota de afiliación o carné se cobra dentro de SportMaps por comprobante en P2, o la liga la sigue cobrando por fuera durante el piloto?
8. Reglamento de sanciones del piloto: ¿cuántas amarillas suspenden y cuántas fechas da la roja directa? ¿Lo configura cada torneo?
9. ¿La liga programa partidos en canchas de clubes afiliados (con autorización del club) o solo en canchas propias o alquiladas? ¿Con qué `source_kind`?
10. Precio después del piloto: ¿por liga, por club afiliado o por jugador carnetizado? (Venta asistida, sin precio público hasta cerrar el mes gratis.)
11. Umbrales de éxito y fecha de corte del piloto (FED-P4-00).

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| El organizador v2 se atrasa y bloquea P2-02, P2-05 y P3-04 | P0 y P1 avanzan solos. Si el organizador v2 no está en la semana 8, se construyen versiones mínimas propias con la misma interfaz |
| Tocar `is_informational_entity()` o el trigger sin versionar vuelve a meter las 89 fichas en el trial o rompe el signup (ya pasó: crear una federación tumbaba el INSERT) | Vía (a), que no toca nada de eso. Si se elige (b), primero se versiona el trigger tal como está vivo |
| La ficha OSM nace con el trial vencido (`created_at + 1 mon`) | `admin_enable_league` crea la `school_subscriptions` con `now() + 1 mes` en la misma transacción, y la QA lo verifica en `v_school_entitlements` |
| Nadie puede operar la liga porque la ficha no tiene dueño | FED-P1-02 (admin humano con verificación) es requisito de todo lo demás |
| Datos personales de menores en carnés y páginas públicas: RLS filtra filas, no columnas | Vistas o RPC con columnas publicables, nunca `USING(true)`. Autorización del acudiente antes de P2-01 |
| La lectura cruzada liga→clubes abre escritura por error o recursa | Helper `SECURITY DEFINER` solo en policies `FOR SELECT`, con una prueba explícita de que no da escritura |
| Sanciones mal calculadas generan conflicto real entre clubes | Anulación manual con motivo y auditoría, documento de disputa (FED-P3-07) y métrica de anulaciones en el piloto |
| El fixture se regenera con delete + insert sueltos y deja ocupaciones o sanciones huérfanas | FED-P3-00 lo pasa a RPC transaccional antes de enganchar canchas o sanciones |
| Regresión en los torneos de escuela vivos (Besser, Monster) por tocar enroll, PATCH match y generate-fixtures | Línea base en FED-P1-10 y comparación en FED-P3-00, P3-02 y P3-09 |
| Supabase Free compartida entre dev, stg y prod: cada DDL recarga PostgREST y quema Disk IO | Una sola sesión aplica cada lote, `types.ts` se regenera una vez por lote y no se sondea el catálogo |
| Cambios de landing sin desplegar o pisados por otra sesión | Antes de cada commit se confirma con `git log` y se verifica en el chunk desplegado, no solo con grep local |
| Los leads de la landing se pierden porque la edge function no está versionada (afecta a seis formularios) | FED-P0-03 |
| Rutas públicas de la liga queman Disk IO | Caché y vista o RPC con columnas publicables (FED-P3-06) |
| Se espera que algo cambie solo cuando un club no paga | Regla fija: la mora no cancela ni suspende afiliaciones; solo decide la liga a mano |
| Se construye en abstracto sin una liga comprometida | P1 no arranca sin FED-P0-05 cerrado |

---

## 6. Correcciones del revisor que se aplicaron

1. **P0 actualizado al estado real de la landing.** La otra sesión ya quitó «Federación Pro» y «Nacional» de `RolePricingSection.tsx` y puso el CTA de piloto gratis de un mes. FED-P0-02 quedó reducido a lo que sigue prometiendo: `ComboFinder.tsx:112-124`, `PlansComparisonTable.tsx:51`, `combos.ts:93`, `RolePricingSection.tsx:236,246`, `saas-plans.ts:234` de la landing y `llms-full.txt:27,49`. Todo va en un commit coordinado y se verifica en el chunk desplegado.
2. **FED-P0-01 enlazado** al plan maestro (línea 55) y a D.5 del spec del ecosistema como el mismo ítem. `llms-full.txt` y `prerender.mjs` se coordinan con la otra sesión.
3. **FED-P0-04 marcado como duplicado** de INF-10 y del plan maestro (línea 61). Este frente solo lo verifica.
4. **FED-P1-01 rehecho.** `is_informational_entity()` es IMMUTABLE y solo ve el tipo, y el trigger `prevent_gov_entity_subscription()` no está versionado. Por eso el spec elige entre la vía (a), `admin_set_school_type` + addon (recomendada), y la vía (b), función nueva por `school_id` + versionar el trigger (FED-P1-00, condicional).
5. **Trial del piloto.** `admin_enable_league` crea la `school_subscriptions` con `trial_ends_at = now() + 1 mes` en la misma transacción, y FED-P4-01 lo verifica en `v_school_entitlements`.
6. **Admin humano de la liga.** Se agregó FED-P1-02, con la aceptación «el admin inicia sesión y `req.schoolId` resuelve a la liga».
7. **FED-P3-04 sin migración.** Reusa `grupos` del CHECK existente, lo construye el frente organizadores y aquí se verifica. Se agregó la validación 400 ante un formato desconocido (FED-P3-00).
8. **Fixture transaccional.** Se agregó FED-P3-00: RPC que borra, libera la ocupación y recrea en una transacción, como requisito de canchas y sanciones. FED-P3-05 define `source_kind` en el spec.
9. **Rutas corregidas:**
   - `frontend/src/pages/school/SchoolTournamentDetailPage.tsx`
   - `frontend/src/pages/events/TournamentResultsPage.tsx`
10. **Bloqueos explícitos** por el organizador v2 en P2-02, P2-05, P3-01 y P3-04, y fechas de P3 movidas después de sus semanas 5 a 8.
11. **Faltantes que se agregaron:**
    - Menú «Liga» en los dos árboles (FED-P1-07).
    - Notificaciones de punta a punta con plantilla para clubes sin cuenta (FED-P1-08, P2-06, P3-07).
    - Consentimiento de menores según la Ley 1581 (FED-P2-00).
    - Helper de lectura cruzada sin escritura (FED-P1-04).
    - Cierre de lote con `types.ts`, `openapi.yaml`, `migrations:check` e invariantes en P1, P2 y P3.
    - Modelo de emisión del carné de otro club (FED-P2-03).
    - Criterios de éxito y fecha de corte antes del piloto (FED-P4-00).
    - Regresión de los torneos de Besser y Monster desde P1.
    - Documento de operación y disputas (FED-P3-07).
12. **Duplicado con BLQ-10.** FED-P4-04 retira o actualiza «Federación Pro $549k» en el tarifario de facturación multi-rol.
13. **Segunda ronda del revisor (14-oct):**
    - **Reconciliación.** Este archivo es el único plan del frente. Grupos + eliminatoria, roster por Excel y pago de inscripción son de `08-organizador.md` y `09-torneos.md`.
    - **Landing verificada.** `Federaciones.tsx` ya está limpia y la tarjeta de `RolePricingSection.tsx` ya dice «Piloto para ligas 2027». El repo de la landing está limpio en git. FED-P0-01 pasó a verificación (XS) y FED-P0-02 se redujo a `PlansComparisonTable.tsx:38-39,51`, `combos.ts:36`, `ComboFinder.tsx:55,112`, `RolePricingSection.tsx:236,246`, `saas-plans.ts:234` y `llms-full.txt:27,49`. Se reformuló el riesgo de «otra sesión sin commitear».
    - **FED-P0-03** cubre los seis formularios que usan la edge function.
    - **FED-P0-04** queda como duplicado de INF-10; lo único pendiente es borrar `SchoolRegister.tsx`.
    - **FED-P3-01 sin dependencia del organizador v2.** P2-02, P2-05 y P3-04 siguen bloqueadas.
    - **Spec ampliado** (puntos 10 a 14): identidad del jugador entre clubes, matriz de notificaciones, gobernanza de sanciones, permiso de canchas del club, y criterios de éxito y acuerdo del piloto.
    - **Aceptación de seguridad por migración**, no solo al cierre de P1.
    - **Sanciones.** Reversión al corregir o borrar una tarjeta (FED-P3-03). Regenerar el fixture define qué pasa con la ocupación (FED-P3-00).
    - **Facturación del piloto.** FED-P1-01 verifica que no salga factura ni correo de cobro, y FED-P1-03 que ningún estado cambie por mora.
    - **Disk IO.** Presupuesto y caché para la página pública (FED-P3-06).
    - **ROADMAP.** FED-P0-06 agrega las filas FED-* (hoy no hay ninguna).
