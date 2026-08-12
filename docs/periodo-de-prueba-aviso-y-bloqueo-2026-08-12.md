# Periodo de prueba — aviso con contador y bloqueo al vencer

**Fecha:** 2026-08-12 · **Rama:** `develop` · **Estado:** código listo, **migración y datos sin aplicar**

---

## 1. La decisión

| # | Decisión | Origen |
|---|---|---|
**D1** | La prueba se cuenta desde **`schools.created_at`**, no desde la fecha del backfill. | Dueño del producto, 2026-08-12 |
**D2** | El parque actual recibió **2 meses**. El registro nuevo nace con **1 mes** (trigger). | ídem |
**D3** | El super admin fija el periodo por escuela: **N meses desde el registro** o **fecha exacta**. Sin SQL a mano. | Pedido explícito |
**D4** | Al vencer: **aviso con contador** → **bloqueo** (solo lectura). | ídem |
**D5** | **Solo tres exenciones**, y ven el aviso sin inhabilitarse: **Dynasty** (se le muestra "vence hoy"), las cuentas **demo/pruebas** (`account_type`) y **GYM RM** (pendiente de validar con el cliente). | ídem |
**D6** | **Todo el resto de vencidas se inhabilita**, incluidas las 7 que están operando hoy: THE BLAIR TEAM (17.7M), Felipe Rincón (10.4M), SPIRIT ALL STARS (99 inscripciones), ORIGINAL BOXING STYLE, Fit And Fight, Mendieta Coach y Jhon Cruz. | Decisión explícita, 2026-08-12 |
**D7** | La escuela inhabilitada lo está **para todos sus usuarios por igual**, incluidos los padres. **Consecuencia asumida:** un padre con cuota pendiente en escuela bloqueada recibe 402 al intentar pagar. | ídem |
**D8** | El **contador** lo ve solo quien decide (dueño / admin). El **bloqueo** lo ven todos, con texto según el rol: si a un padre le van a fallar las acciones, tiene que saber por qué en vez de ver errores sueltos. | ídem |

Que la fecha de corte del club de patinaje fuera el **20 de agosto** no era un dato suelto: se
registró el **20 de junio** y 20-jun + 2 meses = 20-ago. Dynasty se registró el 13-jun, de ahí que
"hoy vencería". La regla explica las dos fechas, y por eso quedó como regla y no como constante.

---

## 2. Por qué no bastaba con prender un banner

Auditado hoy sobre las 364 escuelas (`scripts/audit-trial-2meses-2026-08-12.mjs`):

| Hallazgo | Dato |
|---|---|
`trial_ends_at` no sirve como disparador | Vencido en casi todas: Dynasty 2026-06-27, patinaje 2026-07-04. Se calculó con `now() + 30d` el día del backfill, no desde el registro. |
El `status` tampoco | **178** escuelas quedaron en `active` tras un UPDATE masivo del 2026-07-21 — `active` ahí no significa "cliente pagando" (0 de 213 suscripciones tienen `payment_provider`). |
Faltan filas | **151** escuelas no tienen fila en `school_subscriptions`. **Resuelto al aplicar:** son exactamente las entidades informativas del mapa (79 `federation` + 62 `institute` + 10 `association`), que un trigger no versionado prohíbe suscribir. Ninguna escuela SaaS real está sin fila. |
Nada bloqueaba | No existía cron de expiración, `EntitlementGate` estaba montado en 1 sola página, y `/me/entitlements` respondía `active` cuando faltaba la fila (fail-open). |

Con ese dato, cualquier cron le pega a quien no debe. Por eso el trabajo fue **volver el trial un
dato real** y recién encima colgar el aviso y el bloqueo.

---

## 3. Qué se construyó

### Base de datos — `20260812125503_periodo_de_prueba_aviso_y_bloqueo.sql`

- **`schools.account_type`** (`real|test|demo`, `text + CHECK`) + backfill desde `is_demo`. Es el
  gate que evita que el cron bloquee nuestras propias cuentas de prueba. `is_demo` no se toca.
- **`school_subscriptions.blocking_exempt` / `blocking_exempt_reason` / `trial_months`.**
  Separa el **estado** ("la prueba venció") de la **consecuencia** ("se bloquea"): Dynasty queda en
  `trial_expired`, que es la verdad y por eso ve el aviso, con `blocking_exempt=true` para no cortarle nada.
- **`school_is_operational(school_id)`** — fuente única del bloqueo. La usan el BFF y (pendiente) las
  policies de RLS. Nunca bloquea `account_type<>'real'` ni exentas.
- **Trigger de registro** reescrito: 1 mes calendario contado desde `created_at` (antes: 30 días
  fijos desde `now()`), con `trial_months=1` explícito.
- **`expire_trials()` + cron diario 09:10 UTC** — marca `trial_expired` y apaga solo los addons que
  había regalado el trial (`metadata.via='trial_grant'`), no los comprados.
- **`v_school_entitlements`** expone `trial_ends_at` (con fallback registro + 1 mes),
  `is_operational`, `blocking_exempt`, `account_type`, `trial_months` y **`has_subscription_row`**
  — sin este último el consumidor no podía distinguir "starter de verdad" de "no hay fila", que era
  el agujero del fail-open.
- **RPCs de super admin** (todas con `is_super_admin()`, `search_path` fijo y `GRANT EXECUTE`):
  `admin_set_trial`, `admin_extend_trial`, `admin_expire_trial_now`, `admin_set_blocking_exempt`,
  `admin_set_account_type`, `admin_reactivate_school`, `admin_list_trials`.

### BFF

- **`requireOperationalSchool`** montado en un único punto (`app.use('/api/v1', …)`) para que no
  queden huecos por ruta olvidada. Solo intercepta mutaciones; los `GET` siempre pasan (bloqueado ≠
  sin datos). Responde **402 `trial_expired`** con canal de contacto.
- **Allowlist deliberada:** webhooks, `/me`, `/admin`, `/support`, `upgrade-requests`, y **los pagos
  de las familias** — cortarle el pago al padre castiga a quien no decide, y encima es la plata con
  la que la escuela nos paga.
- `/me/entitlements`: el fallback dejó de responder `active`. Ahora `!data` solo significa "la
  escuela no existe" y responde fail-closed.

### Frontend

- **`TrialStatusBanner`** montado en `AuthLayout` (una vez, no página por página). Cuatro estados:
  contador de días → "vence hoy" → "terminó" (exenta) → "Tu club está inactivo". El contador se
  calcula por **día calendario**, no por horas: si no, un corte a las 23:59 mostraría "1 día" a las
  9 a.m. y el aviso contradiría al calendario.
- `useEntitlements` expone `trialDaysRemaining`, `trialEndsToday`, `trialHasEnded`, `isBlocked`,
  `isBlockingExempt`, `isTestAccount`. **El bloqueo lo decide el servidor**; si el BFF es viejo y no
  manda `is_operational`, no se bloquea nada.
- **Panel de super admin** (`AdminSubscriptionsPage`): bloque "Periodo de prueba" con registro,
  vencimiento, días restantes y meses concedidos; botones 1/2/3/6/12 meses, fecha exacta, +1 mes,
  expirar ya, exentar del bloqueo y marcar real/pruebas/demo. **Relee la BD tras cada cambio** — el
  resto de la página usa update optimista y por eso era imposible distinguir "se guardó" de "no".

---

## 4. Qué falta (y por qué no lo cerré)

| # | Hueco | Estado |
|---|---|---|
**H1** | **RLS no aplica el bloqueo.** El BFF cubre el núcleo, pero el navegador escribe **directo a Supabase en 52 lugares** (más los RPC). Ahí `school_is_operational()` todavía no está cableado en ninguna policy. | El helper ya existe; falta sumarlo a las policies de escritura. La convención del repo exige revisar policies línea por línea antes de aplicar, y hacerlo a ciegas es lo que tumba todo con 403. **Siguiente fase.** |
**H2** | **Migración sin validar por ejecución.** No hay Postgres local, Docker está apagado y no hay cadena de conexión directa. Está revisada a mano contra el esquema real (verifiqué que existen `schools.updated_at`, `school_subscriptions.payment_provider`, `is_super_admin()`, `admin_set_school_plan`). | Aplicar en el SQL editor y leer la salida. |
**H3** | **GYM RM sigue pendiente de validar** con el cliente. Mientras tanto está exenta (PASO 5). Si la validación cierra en bloqueo, se le quita la exención con un botón en el panel — sin SQL. | Decidido: el resto de las vencidas en uso **sí** se inhabilita. |
**H4** | El aviso es in-app. No hay correo ni push al owner. | No estaba en el alcance pedido; el despachador de notificaciones ya existe si se quiere sumar. |

---

## 5. Cómo se despliega

1. Aplicar `supabase/migrations/20260812125503_periodo_de_prueba_aviso_y_bloqueo.sql`. ✅ **aplicada 2026-08-12**
2. Aplicar `supabase/migrations/20260812150627_entidades_informativas_no_se_bloquean.sql`.
3. Correr `scripts/trial-normalizar-periodos-2026-08-12.sql` **paso por paso**, leyendo el PASO 0 y
   el PASO 1 antes de escribir. El PASO 2 quedó **anulado** (ver abajo); el 5 va pegado al 3.
4. Desplegar BFF (Render) y frontend (Vercel).
5. Verificar con el PASO 6 del script: cuántas escuelas quedan bloqueadas, avisadas y exentas.

**El paso 2 es obligatorio, no cosmético.** Sin él, las 151 entidades informativas del mapa quedan
marcadas como bloqueadas: `school_is_operational()` resolvía "sin fila de suscripción" con
`created_at + 1 mes > now()`, y todas se cargaron el 2026-06-09. Hoy no lo sufre ningún usuario
(no tienen cuentas asociadas), pero es un estado falso que ensucia la consola.

---

## 6. Verificación después de aplicar

| Qué | Cómo |
|---|---|
Dynasty ve "vence hoy" y sigue operando | Entrar como owner; `SELECT public.school_is_operational('2d509571-…')` → `true` |
El club de patinaje ve el contador de 8 días | Owner `realbogota@hotmail.com`; vence 2026-08-20 |
El bloqueo aguanta un `curl` | `POST` con JWT de escuela bloqueada → **402** `trial_expired` |
Las demos no se tocan | `admin_list_trials('bloqueadas', 'demo')` → vacío |
Los `GET` siguen pasando | Escuela bloqueada puede leer y exportar |
