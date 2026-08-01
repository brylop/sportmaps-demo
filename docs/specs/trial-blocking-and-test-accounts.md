# Spec — Bloqueo por fin de prueba + separación de cuentas reales vs de pruebas

**Estado:** propuesta, pendiente de aprobación. **Sin código todavía** (convención: plan antes de migraciones).
**Fecha:** 2026-07-31
**Alcance:** `school_subscriptions`, `school_addons`, `schools`, `profiles`, gating BFF, consola super admin.

---

## 1. Por qué

Dos necesidades que se cruzan:

1. **Modelo de prueba real.** La escuela que se registra debe arrancar con **todos los módulos abiertos** durante **un mes**. Al vencerse, **se bloquea todo** y para reactivar **tiene que hablar con nosotros** (no hay autoservicio de pago todavía).
2. **Separar lo real de lo de pruebas.** Hoy no se distingue de forma confiable, así que cualquier cron de bloqueo que se prenda le pegaría también a las cuentas con las que probamos. Esto es prerrequisito, no un extra.

Todo lo operable debe quedar en manos del **super admin** desde el panel, sin SQL a mano.

---

## 2. Estado actual (auditado 2026-07-31)

### 2.1 El trial existe pero al revés de lo que queremos

El único lugar que crea la suscripción es el trigger `AFTER INSERT ON schools` →
`create_default_school_subscription()` en `supabase/migrations/20260519000001_school_subscriptions_signup_trigger.sql:60`.

La escuela nueva nace en:

```
plan_code='starter', tier='free', status='trialing', trial_ends_at = now() + interval '30 days'
```

O sea **arranca en el plan más pobre**, no con todo abierto. Y `school_addons` queda vacío,
así que ninguno de los 11 módulos está activo durante la "prueba".

### 2.2 Los números del trial no coinciden entre sí

| Número | Dónde vive | ¿Se usa? |
|---|---|---|
30 días | trigger de signup (DB) | ✅ único real |
14 días (7 Elite) | `trialDays` en `frontend/src/config/saas-plans.ts:193` + landing | ❌ decorativo |
2 meses gratis | landing (`PricingHeroSection`, `RolePricingCard`) | No es trial: es el descuento anual (~13-15%) |
"Sin trial" | landing `Planes.tsx:395` | Contradice al resto |

### 2.3 No hay bloqueo — cinco eslabones, cuatro flojos

1. **No existe cron de expiración.** Los 8 `cron.schedule` del repo son cobros recurrentes, mora,
   recordatorios y glosas. La propia migración lo admite: *"el cron de Fase 6 marcará
   `status='trial_expired'`"* — Fase 6 nunca se hizo.
   Estado real de la BD: **209 suscripciones** → 177 `active`, 27 `grandfathered`, 5 `trialing`;
   **3 de esas 5 tienen `trial_ends_at` vencido y siguen en `trialing`**.
2. El frontend se cubre solo: `useEntitlements.ts:160` deriva `isTrialExpired` también cuando
   `status='trialing'` con fecha pasada. El estado *se detecta* sin cron.
3. **El candado casi no está montado:** `<EntitlementGate>` solo se usa en **una** página
   (`SchoolEquipmentPage.tsx`).
4. Donde está, es suave a propósito: `EntitlementGate.tsx:72-79` **deja pasar toda feature con
   `minTier='starter'`** cuando el trial expiró. Y el fallback default `modal` renderiza el
   contenido detrás con `opacity-30 pointer-events-none` — la data ya viajó al cliente.
5. **El BFF no valida el status.** `/me/entitlements` solo devuelve la vista. El único gate
   server-side real es el addon `tournaments` en `events.route.ts:292`. Peor: si falta la fila en
   `school_subscriptions`, el fallback responde `subscription_status: 'active'`
   (`me.routes.ts:50`) → acceso abierto.

Único endurecimiento real vía RLS con `status IN ('active','trialing')`: branding
(`20260528000001`) y dominios custom (`20260529000002`).

El *grace period* está igual de hueco: el banner de "3 días" se dispara con `status='past_due'`,
pero nada en el repo pone `past_due` ni cuenta esos días.

### 2.4 La separación real/pruebas no es confiable

- `is_demo` existe (`NOT NULL DEFAULT false`) en 10 tablas desde el esquema base
  (`20260217000001`): `schools`, `profiles`, `children`, `teams`, `calendar_events`,
  `athlete_stats`, `children_stats`, `health_records`, `training_logs`, `wellness_appointments`.
  **Nada financiero lo tiene**: `payments`, `enrollments`, `expenses`, `school_subscriptions`, no.
- Conteos: 30 escuelas `is_demo=true` / 330 `false`; 18 perfiles `true` / 727 `false`.
- **El flag está mal mantenido**: la escuela llamada literalmente `pruebas demo` tiene
  `is_demo=false`. Nadie lo escribe en el signup — solo los seeds de la rama demo.
- **Un solo consumidor lo respeta** en toda la app: el mapa público
  (`ExploreMapInteractive.tsx:98`, `.eq('is_demo', false)`). Analytics, crons, cobros y
  mensajería lo ignoran.
- El panel admin **no puede distinguirlas**: `admin_list_schools_global` no devuelve `is_demo`.
- Las demos quedaron `enterprise`/`grandfathered` en el backfill de `20260513000007:289`, por eso
  nunca muestran estados de trial. Cómodo, y a la vez esconde el problema.

### 2.5 "Se activa pero uno mira y no se activó" — causa raíz (auditado)

El toggle **sí escribe**: `school_addons` tiene filas con `metadata->>'via' = 'admin_toggle'`
recientes (p. ej. `VOLK FIT CLUB / tournaments` y 10 addons de `Escuela Demo SportMaps` del
2026-07-31). El problema no es la escritura, son tres cosas distintas:

1. **El panel no relee: update optimista.** `toggleAddon` (`AdminSubscriptionsPage.tsx:95`)
   actualiza el estado local y nunca vuelve a consultar la BD. El panel muestra ON porque lo
   *asumió*, no porque lo *verificó*. Es el problema inverso al reportado y hace imposible
   distinguir "se guardó" de "no se guardó".
2. **Prender el módulo no lo hace aparecer en la app.** El sidebar solo consulta
   `hasAddon('store')` (`AppSidebar.tsx:126`). Torneos, Contabilidad, Facturación, Nutrición,
   Biomecánica, Control de acceso, White-label y WhatsApp **no cambian nada visible** al
   activarlos. Ahí es donde "uno mira y no se activó" es literal.
3. **Caché de 5 minutos.** `useEntitlements` usa `staleTime: 5 * 60 * 1000`; el módulo recién
   activado no aparece hasta que expire o haya recarga dura. (`bff/src/utils/authCache.ts`,
   sin commitear, puede sumar otra capa.)

#### 2.5.1 Hallazgo grave: `v_school_entitlements` miente en silencio

Probado contra la misma escuela y el mismo instante:

| Lector | Respuesta |
|---|---|
`service_role` | HTTP 200 · `enterprise` / `active` / 10 módulos en `true` |
sin privilegio | **HTTP 200** · `starter` / `free` / **`active`** / **todos los módulos en `false`** |

La vista es `security_invoker = true`. `schools` tiene `FOR SELECT USING (true)`, así que la fila
**siempre** vuelve; pero `school_subscriptions` y `school_addons` están gateadas a
`is_school_admin(school_id) OR is_super_admin()`. Cuando el lector no pasa, el `LEFT JOIN` da NULL
y los `COALESCE` **inventan** `starter/free/active`, y cada `EXISTS` de addons da `false`.
**No hay error: hay una respuesta falsa.** Doble riesgo: *fail-open* en el status (afirma `active`
cuando en realidad no sabe) y *fail-closed* en los módulos.

Hoy solo la muerde `AdminSubscriptionsPage` (único lector desde el browser, y funciona porque los
3 perfiles `admin`/`super_admin` pasan el guard); el BFF usa service_role y por eso
`/me/entitlements` sí dice la verdad. **Pero en F3 el bloqueo va a depender de este status**: si
un lector degradado ve `active`, el bloqueo no se aplica. Hay que arreglarlo antes.

Contexto para valorarlo: `is_super_admin()` acepta `role IN ('admin','super_admin')` y hay 3
perfiles así (`spoortmaps+admin@gmail.com` super_admin, `demo.admin@sportmaps.co` y
`spiritfontibon@gmail.com` admin). `is_school_admin()` exige fila `school_members` con
`role IN ('owner','admin')` y `status='active'`: 359 de 360 escuelas cumplen — la única huérfana
es `NPC`.

### 2.6 Lo que ya existe de super admin (se reusa, no se reinventa)

Páginas: `AdminPanelPage`, `AdminSchoolsGlobalPage`, `AdminSubscriptionsPage`, `AdminUsersPage`,
`AdminUpgradeRequestsPage`, `AdminAnalyticsPage`, `AdminActivityLogsPage`, `AdminAccessLogsPage`.

RPCs con guard `is_super_admin()`: `admin_set_school_plan(school, plan, status)`,
`admin_set_school_addon(school, key, enabled, price)`, `admin_list_schools_global`,
`admin_list_users`, `admin_list_billing_events`, `admin_list_audit_logs`, `admin_global_counts`.

Dato clave: **`admin_set_school_plan` ya acepta `p_status`** — la UI lo hardcodea a `'active'`
(`AdminSubscriptionsPage.tsx:104`). Gran parte del backend de reactivación ya está.

Entitlements: `v_school_entitlements` (security_invoker) calcula `has_<addon>` con un `EXISTS`
contra `school_addons` por cada uno de los 11 addons, y `has_academy`/`has_reservations`/
`has_wallet` **desde `schools.school_type`, no desde el plan**.

---

## 3. Decisiones

| # | Decisión | Nota |
|---|---|---|
**D1** | Trial = **`now() + interval '1 month'`** (mes calendario, no 30 días fijos) con **acceso total**: `plan_code='elite'`, `tier='pro'`, y los **11 addons** insertados como `enabled` en `school_addons`. `status='trialing'`. | "cuando se acabe el mes" literal. Un mes calendario es lo que la escuela entiende.
**D2** | Al vencer → `status='trial_expired'` → **bloqueo duro**: solo lectura + `/mi-plan`. Ninguna escritura (cobros, inscripciones, asistencia, gastos, mensajería). | Decisión explícita del dueño del producto.
**D3** | **La reactivación es manual por super admin.** No hay checkout de autoservicio en este alcance. La pantalla de bloqueo lleva a un canal de contacto. | Se apoya en `admin_set_school_plan` que ya existe.
**D4** | Marcado con columna nueva `account_type text NOT NULL DEFAULT 'real' CHECK (account_type IN ('real','test','demo'))` en `schools` y `profiles`. `is_demo` **no se toca** (lo consume el mapa público). Backfill: `is_demo=true → account_type='demo'`. | `text + CHECK`, no `CREATE TYPE` (convención del repo).
**D5** | `account_type <> 'real'` ⇒ **exenta del cron de expiración y del bloqueo**, **excluida de métricas admin**, y **excluida de crons financieros y de mensajería**. | *Asunción mía* — no la confirmaste explícitamente. Es lo que hace que puedas probar sin que se te venza nada encima. Si algo de esto no lo quieres, se ajusta antes de F0.
**D6** | Quién marca: **toggle del super admin** en el panel + selector al crear escuela. **Nunca** auto-detección por dominio de correo. | Frágil y sorpresivo.
**D7** | `past_due` / grace period **queda fuera** de este alcance. | No hay cobro automático que falle todavía.
**D8** | **Nada retroactivo.** El trial nuevo aplica solo a escuelas creadas después de F1. Las 177 `active` y 27 `grandfathered` no se tocan. Las 3 `trialing` vencidas se resuelven a mano desde el panel. | Gate G1.
**D9** | El trial **no cambia `school_type`**. Una escuela `academy` no gana Reservas ni Wallet durante la prueba, porque eso es identidad de negocio, no entitlement. | Ver §2.5. Si quieres que la prueba también abra Reservas, es una decisión aparte (cambiar `school_type` a `hybrid` es invasivo).
**D11** | **El panel de super admin muestra estado verificado, nunca optimista.** Tras cada toggle se relee la fuente y se pinta lo que la BD respondió; si difiere de lo pedido, se muestra en rojo con el motivo. Además se ve, por escuela: plan, status, `trial_ends_at`, días restantes, `account_type` y la lista de módulos con **desde dónde** se activó (`via`: `trial_grant` / `admin_toggle` / seed) y **cuándo**. | Requisito explícito: "debe mostrarse en super admin que efectivamente están activados".
**D12** | `v_school_entitlements` deja de degradar en silencio: los `COALESCE` inventados se quitan y el acceso al detalle real pasa por RPC `SECURITY DEFINER` con guard (o la vista se vuelve `security_definer` con su propio filtro). Sin privilegio ⇒ error o fila vacía, **nunca** un `starter/active` falso. | Ver §2.5.1. Prerrequisito de F3: el bloqueo se apoya en este status.
**D13** | Activar un módulo tiene que **verse en la app**: el sidebar y las rutas pasan a consultar el addon correspondiente (hoy solo `store`), y el toggle invalida la caché de entitlements (`staleTime` + `authCache`) para que el efecto sea inmediato, no en 5 minutos. | Sin esto, "activado" en el panel y "activado" para la escuela siguen siendo cosas distintas.
**D10** | Se alinean los números: `trialDays` del catálogo y los textos de la landing pasan a **1 mes**, y se borra el "Sin trial" contradictorio. | Sin esto seguimos prometiendo 14 días y dando otra cosa.

---

## 4. Arquitectura

### 4.1 Base de datos

Migraciones nuevas (ledger vía `npm run migrations:new -- <slug>`, `search_path` fijo,
`GRANT EXECUTE` explícito por RPC):

1. **`account_type`** en `schools` y `profiles` + índices parciales
   (`WHERE account_type <> 'real'`) + backfill desde `is_demo`.
2. **Reemplazo de `create_default_school_subscription()`**: plan `elite`, tier `pro`,
   `trial_ends_at = now() + interval '1 month'`, e `INSERT` de los 11 addons en `school_addons`
   con `metadata->>'via' = 'trial_grant'` (para saber después cuáles quitar).
   Idempotente (`ON CONFLICT DO NOTHING`).
3. **`expire_trials()`** `SECURITY DEFINER` + `cron.schedule` diario:
   ```
   UPDATE school_subscriptions ss SET status='trial_expired', updated_at=now()
   FROM schools s
   WHERE ss.school_id = s.id
     AND ss.status = 'trialing'
     AND ss.trial_ends_at < now()
     AND s.account_type = 'real'      -- G-TEST
   ```
   Al expirar, **apaga los addons con `via='trial_grant'`** (no los comprados) y registra en
   auditoría. Devuelve `jsonb` con el conteo para el panel.
4. **RPCs de super admin** (todas con `is_super_admin()` + `audit_trigger_func`):
   - `admin_set_account_type(p_school_id, p_account_type)` — y su variante para `profiles`.
   - `admin_extend_trial(p_school_id, p_days)` — corre `trial_ends_at` y devuelve el nuevo valor.
   - `admin_expire_trial_now(p_school_id)` — para probar el bloqueo sin esperar.
   - `admin_reactivate_school(p_school_id, p_plan_code, p_addons jsonb)` — el "hablaron con
     nosotros y pagaron": pone `status='active'`, plan y addons en una sola transacción.
   - `admin_list_trials(p_status, p_account_type, p_limit, p_offset)` — el listado de la consola.
   - `admin_list_schools_global`: agregar `account_type` y `subscription_status` al `SELECT`
     (hoy no los devuelve).
5. **RLS de bloqueo** en las tablas de escritura crítica (`payments`, `enrollments`, `attendance`,
   `expenses`, `notifications`, …): las policies `INSERT`/`UPDATE` suman
   `AND public.school_is_operational(school_id)`, helper `SECURITY DEFINER` que devuelve
   `false` solo cuando `status='trial_expired'` **y** `account_type='real'`.
   Revisión línea por línea antes de aplicar (convención del repo).

### 4.2 BFF

- **Middleware `requireOperationalSchool`** montado en todas las rutas de mutación
  (`POST`/`PATCH`/`PUT`/`DELETE`) con `x-school-id`: lee entitlements (con el cache de
  `authCache.ts`), y si `subscription_status='trial_expired'` responde
  **`402 { code: 'trial_expired', contact: {...} }`**. `GET` sigue pasando (solo lectura).
- **Cerrar el agujero del fallback**: cuando no hay fila en `school_subscriptions`,
  `/me/entitlements` debe responder `trial_expired` (fail-closed), no `active`
  (`me.routes.ts:50`). Es el mismo criterio fail-closed que ya usamos en connected accounts.
- Endpoint `GET /api/v1/admin/trials` para la consola (o RPC directa; decidir en F5).

### 4.3 Frontend

- `useEntitlements`: exponer `isBlocked = isTrialExpired && !isTestAccount`.
- `EntitlementGate`: modo **hard** — cuando `isBlocked`, el fallback ya no es `modal`
  semitransparente sino la pantalla de bloqueo. Quitar la excepción de `minTier='starter'`
  (`EntitlementGate.tsx:72-79`) para el caso `trial_expired`.
- **Pantalla de bloqueo** ("Tu mes de prueba terminó — hablemos"): qué conserva (sus datos
  intactos), CTA a WhatsApp/correo comercial, y acceso solo a `/mi-plan` y logout.
  Se monta en el layout de escuela, no página por página, para que no queden huecos.
- Banner de días restantes durante el trial (ya existe el cálculo en `MiPlanPage`, falta subirlo
  al layout).
- Badge visible `PRUEBA` / `DEMO` en las páginas admin cuando `account_type <> 'real'`.
- **Consola de trials** (nueva pestaña en el panel admin): tabla con escuela, `account_type`,
  plan, status, `trial_ends_at`, días restantes; filtros por estado y por tipo de cuenta;
  acciones por fila → extender N días, expirar ya, reactivar con plan, marcar como prueba.
  Se apoya en `usePagedRpc` + `Pager` (el patrón de `AdminActivityLogsPage`, que es la referencia
  de tablas del repo).

### 4.4 Auditoría

Toda RPC de super admin y el cron escriben en `audit_logs` vía `audit_trigger_func` con actor,
antes/después y `via`. La consola muestra el historial por escuela (reusa
`admin_list_audit_logs`).

---

## 5. Fases (una rama por fase, revisión entre cada una)

| Fase | Qué entra | Por qué en este orden |
|---|---|---|
**F0 — Marcado real vs pruebas** | `account_type` + backfill + `admin_set_account_type` + `account_type` en `admin_list_schools_global` + badge y filtro en `AdminSchoolsGlobalPage` / `AdminUsersPage`. | **Va primero**: sin esto, el cron de F2 bloquearía tus propias cuentas de prueba.
**F0.5 — Verdad en el panel** | Quitar el update optimista y releer tras cada cambio (`admin_school_entitlements(p_school_id)`, RPC `SECURITY DEFINER` que devuelve plan + status + trial + addons con `via`/`enabled_at`); arreglar la degradación silenciosa de la vista (D12); cablear sidebar/rutas a los addons e invalidar caché al togglear (D13). | Antes de conceder 11 addons en F1 hay que **poder ver** si quedaron concedidos. Y F3 se apoya en un status que hoy se puede leer falso.
**F1 — Trial "todo abierto"** | Nuevo `create_default_school_subscription` (elite + 11 addons + 1 mes) + alinear `trialDays` y textos de la landing. No retroactivo. | Cambia solo el nacimiento de escuelas nuevas; sin riesgo para las 204 existentes.
**F2 — Cron de expiración** | `expire_trials()` + `cron.schedule` diario + apagado de addons `trial_grant` + auditoría. **Marca el estado, todavía no bloquea.** | Permite ver el estado limpio y corregir datos antes de que el bloqueo tenga consecuencias.
**F3 — Bloqueo server-side** | Middleware `requireOperationalSchool` (402) + `school_is_operational()` en RLS + fail-closed en `/me/entitlements`. Tests de concurrencia. | El bloqueo tiene que ser server-side: el gate del frontend es evitable con curl.
**F4 — UX de bloqueo** | Pantalla "hablemos" + `EntitlementGate` en modo hard + banner de días restantes. | Después del backend, para que la UI no prometa un bloqueo que el servidor no aplica.
**F5 — Consola de trials del super admin** | Tabla + filtros + extender / expirar ya / reactivar, todo auditado. | Cierra el requisito "todo desde mi rol".
**F6 — Aislar cuentas de prueba (opcional)** | Excluir `account_type <> 'real'` de `AdminAnalyticsPage`, `admin_global_counts`, crons financieros (`generate_monthly_charges`, `apply_late_fees`) y mensajería (recordatorios, invitaciones, campañas). | Limpia tus cifras de negocio; no bloquea nada de F0-F5.

---

## 6. Gates duros

| Gate | Regla |
|---|---|
**G-TEST** | El cron y el bloqueo **jamás** tocan `account_type <> 'real'`. Se prueba con un caso por tipo antes de habilitar el cron.
**G-PAGA** | Ninguna escuela `active` ni `grandfathered` cambia de comportamiento. Dynasty y las escuelas que pagan no ven nada nuevo.
**G-SERVER** | El bloqueo se valida en BFF **y** RLS. Un `curl` con el JWT de una escuela bloqueada debe recibir 402/403.
**G-FAILCLOSED** | Sin fila en `school_subscriptions` ⇒ bloqueado, no abierto. Cierra `me.routes.ts:50`.
**G-LECTURA** | Bloqueado nunca significa "sin datos": los `GET` siguen respondiendo y la escuela puede exportar lo suyo.
**G-MIGRA** | Migraciones inmutables + ledger + `search_path` fijo + `GRANT EXECUTE` por RPC + RLS sin self-recursion. Policies revisadas línea por línea.
**G-VERIFY** | Ningún estado se pinta por optimismo. Todo lo que el panel afirma sale de una relectura posterior a la escritura, y el `via`/`enabled_at` de cada módulo queda visible.
**G-NOLIE** | Ninguna lectura de entitlements devuelve un default inventado. Sin privilegio ⇒ error o vacío. Se prueba con un lector sin privilegio antes de cerrar F0.5.
**G-TIPO** | `account_type` es `text + CHECK`, no `CREATE TYPE` (historia de `payments.status`).

---

## 7. Preguntas abiertas

1. **Canal de contacto** de la pantalla de bloqueo: ¿WhatsApp comercial, correo, o formulario que
   cree un `plan_upgrade_request` (tabla que ya existe, `20260514000001`)?
2. **D5** — confirmar los cuatro efectos de `account_type <> 'real'` (§3).
3. **D9** — ¿la prueba debe abrir también Reservas/Wallet? Hoy dependen de `school_type`, no del plan.
4. ¿El bloqueo aplica también a los **usuarios** de la escuela (padres pagando cuotas, atletas
   viendo su carnet) o solo al staff? Recomendación: los padres deben poder **seguir pagando** —
   bloquear el cobro a familias castiga a quien no decide.
