# Spec — Débito automático de mensualidades (tarjeta, Nequi, Bancolombia)

**Estado:** v0.2 — para revisión. **No hay código.** No se escribe SQL de F1 hasta aprobar
esta versión (regla del repo), ni antes de que Wompi responda las preguntas 1 y 8 de §17.

- Las decisiones **[CONFIRMADA]** vienen de la revisión del 2026-09-29.
- Las **[PROPUESTA]** requieren visto bueno.
- Las **[ESCUELA]** son configuración de cada escuela, no decisión de SportMaps.

**Fecha:** 2026-09-29 · **Plan:** `docs/plan-debito-automatico.md`
**Reemplaza:** el diseño implícito en `20260512000001…20260701000001`, que nunca se aplicó y no se puede aplicar tal cual (§3).

### Cambios v0.1 → v0.2

| Qué | Cambio |
|---|---|
| D4 + D6 | Se reescriben juntas sobre una tabla de **ciclos** (`autopay_cycles`, §4.3). Nunca se debita sin aviso previo ni por encima de lo anunciado. Los omitidos no consumen intento. |
| D7 | **Cambia el ancla.** `open_month` genera **un cobro por atleta y por periodo**, no por inscripción, y el cobro no guarda `enrollment_id` (verificado con `pg_get_functiondef` el 2026-09-29). La suscripción pasa a ser **por atleta y escuela**. Pide re-confirmación. |
| D8 | Botón "Ya pagué este mes". Regla para checkouts abandonados, con consulta a Wompi. `create-session` no choca con un débito vivo. Detector de cobro doble con incidente y suspensión. Sección de devoluciones (§12). |
| D10 | `autopay_enabled` = solo "ofrecer". Nuevo `autopay_debits_paused` por escuela, interruptor global en `platform_config` y alertas mínimas. Todo entra en F1/F2. |
| D12 | Cuenta los ciclos que terminan sin débito por tope o por medio no disponible. |
| D13 | El `void` de la fuente se hace solo si ninguna otra suscripción viva la usa. |
| D14 | **Nueva.** Solo se debitan periodos desde `first_period`; lo vencido nunca entra al débito programado. |
| §4 | `phone_hash` pasa a ser HMAC con secreto en vault. Tablas nuevas `autopay_cycles` y `autopay_incidents`. |
| §7 | Reconsulta de PENDING en minutos, con un barrido cada 15 min y alerta a las 24 h. |
| §17 | Preguntas 8, 9 y 10. Las 1 y 8 condicionan el arranque de F1. |

---

## 0. Qué es y qué no es

El acudiente (o el atleta adulto) autoriza **una vez** un medio de pago. Cada mes, cuando la
escuela ya generó la mensualidad, SportMaps le avisa cuánto y cuándo va a debitar. En esa fecha
la debita y el pago queda registrado y conciliado sin que nadie cargue un comprobante.

- **Es:** cobrar automáticamente **la mensualidad que ya existe** en `payments`.
- **No es:** un generador de cobros, un monto propio de la suscripción, un cobro de deudas ni
  una decisión de precio.
- **La escuela decide si lo ofrece.** SportMaps construye la herramienta y le da material para
  ofrecerla. Radio cero al desplegar: nada se prende solo.

---

## 1. Decisiones de producto

| # | Decisión | Estado |
|---|---|---|
| **D1** | **Solo Wompi en v1.** Mercado Pago sigue apagado (SEG-23) y su cobro automático solo admite tarjeta. PSE y Bre-B no admiten débito recurrente. | [CONFIRMADA] |
| **D2** | **El débito cobra el `payments` de mensualidad del periodo y nunca crea uno.** El monto es `payments.amount`, con descuentos de hermano y beca ya aplicados por `open_month`, más el recargo según D3. | [CONFIRMADA] |
| **D3** | **Recargo en el débito:** `igual al pago en línea` (usa `online_fee_pct`) o `sin recargo`. Default: igual al pago en línea. El default para el piloto de Dynasty se decide después de §15. | [CONFIRMADA] · [ESCUELA] |
| **D4** | **Calendario del ciclo** (§5.1). El aviso sale en `max(fecha de generación del cobro, due_date − N − 2 días)`. El primer intento es `max(due_date − N, notice_sent_at + 2 días)`. Los reintentos van a +1 y +3 días del primero. **Nunca se debita sin `notice_sent_at`** ni por encima de `announced_total`. N lo fija la escuela (default 3). | [CONFIRMADA con cambios] · N = [ESCUELA] |
| **D5** | **Tope por suscripción.** Al activar, el padre acepta un tope (default: valor actual + 20%, editable). Si el total del mes lo supera, no se anuncia débito: se avisa que hay que pagar manual o subir el tope. | [CONFIRMADA] |
| **D6** | **Aviso previo y recibo.** Aviso 2 días antes del primer intento, con monto, fecha, medio y el botón "Ya pagué este mes / no debitar esta vez" (D8). Recibo después. Si el total cambia hacia arriba después del aviso, se re-anuncia y se esperan otros 2 días. | [CONFIRMADA con cambios] |
| **D7** | **Una suscripción por atleta y escuela** (antes: por inscripción). `open_month` genera un solo cobro de mensualidad por atleta y por periodo, aunque el atleta tenga varias inscripciones activas. La suscripción cubre **la mensualidad de ese atleta en esa escuela**, cualquiera sea su plan o equipo. La activa el acudiente con cuenta vinculado al menor (`children.parent_id`) o el atleta adulto sobre sí mismo. Un mismo medio sirve para varios hijos. Los atletas sin cuenta quedan fuera. | **[PROPUESTA — re-confirmar]** |
| **D8** | **Si ya se pagó, no se debita.** El claim solo toma cobros `pending`. El aviso trae el botón "Ya pagué este mes" (solo el pagador con sesión), que omite el ciclo sin contar como fallo. Los checkouts manuales siguen la regla de §7.3. Hay un detector de cobro doble (§8.3) y un procedimiento de devolución (§12). | [CONFIRMADA con cambios] |
| **D9** | **Pausa, baja y cambio de plan.** Un mes pausado no tiene cobro (`open_month` lo excluye), así que no hay nada que debitar. La baja del atleta cancela la suscripción. Si el atleta queda sin ninguna inscripción activa en la escuela, también se cancela. El cambio de plan no la afecta: cobra el monto nuevo si cabe en el tope. | [CONFIRMADA] |
| **D10** | **Tres controles distintos.** `autopay_enabled` (escuela) = **solo ofrecer**: controla altas nuevas y la UI de familia, y el claim no lo lee. `autopay_debits_paused` (escuela) = frena los débitos de esa escuela, con aviso a las familias activas. `platform_config['autopay_kill_switch']` = frena todos los débitos de la plataforma con un UPDATE, sin deploy. Apagar la oferta no toca las suscripciones activas. | [CONFIRMADA con cambios] |
| **D11** | **La fuente de pago pertenece al comercio que la creó.** La fuente guarda su comercio y el cobro exige que coincida con el comercio vigente de la escuela; si no, fail-closed y cancelación con `merchant_changed`. | [CONFIRMADA] |
| **D12** | **Suspensión.** Dos ciclos seguidos que terminan **sin débito** pasan la suscripción a `suspended`: fallo de Wompi en los 3 intentos, `over_max_amount` o `token_not_available`. El mensaje depende del motivo (subir el tope o actualizar el medio). Un ciclo pagado **por cualquier vía** reinicia el contador. `manual_checkout_open` y `parent_skip` no cuentan. | [CONFIRMADA con cambios] |
| **D13** | **Cancelación.** El padre cancela cuando quiera, con efecto inmediato. La fuente se anula en Wompi (`void`) **solo si ninguna otra suscripción viva la usa**. La escuela puede cancelar la de una familia. La baja de cuenta del padre cancela todas y anula sus fuentes. | [CONFIRMADA con condición] |
| **D14** | **Qué se debita al activar.** La suscripción guarda `first_period` y solo se toman cobros con periodo ≥ `first_period`. Por defecto es el periodo **siguiente al último cobro de mensualidad ya generado** para el atleta en la escuela. En el paso 3 del alta, el padre puede marcar expresamente "Debitar también la mensualidad de <mes>" si ese cobro está `pending` y **no vencido**; en ese caso `first_period` es ese mes. **Lo `overdue` nunca entra al débito programado.** Pagar lo vencido es una acción aparte, explícita y con confirmación, fuera del débito. | [CONFIRMADA] |

---

## 2. Lo que ya existe y se reutiliza

| Pieza | Dónde | Uso |
|---|---|---|
| Resolver de pasarela por escuela (`payment_mode`, `payment_provider_secrets`, fail-closed) | `bff/src/services/payment-provider.resolver.ts` | **Única** fuente de credenciales. En `aggregator` devuelve las llaves de ENV (`WOMPI_PUBLIC_KEY`, etc.) |
| Checkout de escuela: `payment_links` + referencia `SCH-` + recargo | `bff/src/routes/payments.routes.ts:145-360` | El débito crea su enlace con el mismo helper |
| Webhook que concilia `SCH-` (`payment_splits`, notificaciones, `already_processed`) | `bff/src/routes/wompi.ts` (`handleSchoolPayment`) | El pago aprobado se concilia por el mismo camino |
| `uq_payment_links_one_pending_per_payment` | base viva | Un solo enlace pendiente por cobro |
| `open_month` (vía `generate_monthly_charges`, 06:30 UTC) | base viva | Un cobro `pending` por atleta y periodo con `payment_category='mensualidad'`, `period_year/month` explícitos, `due_date = LEAST(payment_cutoff_day, fin de mes)`, sin pausados. Es lo que el débito cobra |
| `payment_tokens`, `pending_card_saves`, `payment_consents` | base viva | Se reutilizan después de F0 y se amplían (§4.1) |
| `createPaymentSource`, `voidPaymentSource`, `signIntegrity` | `bff/src/services/wompi.service.ts` | Con credenciales explícitas |
| `platform_config (key, value jsonb)` | base viva | Aloja el interruptor global (D10) |
| Vault (`vault.secrets`; hoy solo `notif_dispatch_secret`) | base viva | Secreto del cron y del HMAC de teléfonos |
| Sentry (`SENTRY_DSN`) | `bff/src/instrument.ts` | Canal de alertas (§10.2) |
| Despachador de notificaciones (in-app + push) | memoria `project_notifications_unified` | Avisos a padres y escuela |

---

## 3. Lo que hay hoy y por qué no se reutiliza tal cual

Verificado el 2026-09-29 contra la base viva y el repo.

**Base.**
- No existen `recurring_subscriptions`, `recurring_charge_attempts`, `pause_`/`resume_`/`cancel_recurring_subscription`, el cron ni la Edge Function desplegada.
- La `create_recurring_subscription` de 8 argumentos la puede ejecutar `PUBLIC`/`anon`/`authenticated`.
- Las migraciones viejas fallan (FK a `programs`) y en orden cronológico hacen retroceder H-06.

**Seguridad (F0).**
- `payment_tokens` tiene `payment_tokens_owner_all` FOR ALL a `public` sin WITH CHECK (I3) y GRANT de escritura a anon/authenticated.
- `pending_card_saves` y `payment_consents` tienen GRANT completo a anon/authenticated (solo las frena la RLS SELECT).
- Sigue viva la sobrecarga vieja de `save_payment_token` (11 argumentos, `search_path=public`), **llamada desde el BFF** en `mercadopago.ts:760` y `:903` (ver plan, F0).

**Backend.**

| # | Defecto | Dónde |
|---|---|---|
| B1 | RPCs con `auth.uid()` llamadas con `service_role` devuelven siempre `auth_required` | `recurring.routes.ts:79,215,228,245`, `payment-tokens.routes.ts:66` |
| B2 | El cron no manda el header CSRF y recibe 403 | `run-recurring-charges/index.ts:40-43` vs `index.ts:367` |
| B3 | Wompi cobra, pide aceptación y hace `void` con las llaves de ENV y no con las del comercio | `recurring-charges.service.ts:363`, `payment-tokens.routes.ts:105,225` |
| B4 | Credenciales leídas de la columna deprecada `school_payment_providers.access_token` | `recurring-charges.service.ts:72-83` |
| B5 | Un PENDING cuenta como fallo; el reintento con referencia nueva produce doble cobro | `recurring-charges.service.ts:284-287,356,373` |
| B6 | Inserta un `payments` nuevo en vez de liquidar el pendiente; el índice lo rechaza y queda la tarjeta cobrada sin pago | `recurring-charges.service.ts:154-183` |
| B7 | El webhook no reconcilia `SUB-` | `wompi.ts:52,264` |
| B8 | El claim no es un lock real | `claim_due_*` |
| B9 | No mira pausa, inscripción ni baja | runner y claim |
| B10 | Monto congelado en la suscripción | mig. `140000:301-330` |
| B11 | `GET /recurring/vendor/subscriptions` con `service_role` expone todo (hoy da 500) | `recurring.routes.ts:171-201` |
| B12 | `save-intent` no ata la referencia al usuario (riesgo de secuestro de tarjeta) | `20260522130000:437-444` |
| B13 | Sin notificaciones; logs con `req.body` completo | `mercadopago.ts:808` |
| B14 | Sin tests | — |

**Frontend.**
- No hay flujo real: `MyPaymentsPage.tsx:499` fija las suscripciones en vacío y el Cancelar de la 568 es falso.
- No hay tokenización Wompi.
- Hay textos que prometen lo que no existe: `MyPaymentsPage.tsx:650,719-739`, `AccountDeletionCard.tsx`, `PrivacyPage.tsx:475`.

**`payment_links` no caduca solo.** Hay 59 enlaces `pending` y **los 59 tienen `expires_at` vencido**. No existe ningún cron que los expire; `create-session` solo expira los viejos del mismo cobro al crear uno nuevo. Esto importa para D8 (§7.3).

**Wompi.** `GET /v1/merchants/{public_key}` se apaga el 2026-10-31; el reemplazo es `GET /merchants/info` con `x-merchant-public-key`.

---

## 4. Modelo de datos

Estados en `text + CHECK`. FKs de negocio a `profiles(id)`. Toda escritura por RPC
`SECURITY DEFINER` con `SET search_path = pg_catalog, public, pg_temp` y REVOKE explícito de
`PUBLIC`, `anon` y `authenticated`.

### 4.1 `payment_tokens` (existe; se amplía, después de F0)

| Columna nueva | Tipo | Para qué |
|---|---|---|
| `payment_method_type` | CHECK (`CARD`,`NEQUI`,`BANCOLOMBIA_TRANSFER`,`DAVIPLATA`) | Ya existe sin CHECK; se normaliza a mayúsculas |
| `status` | CHECK (`pending_authorization`,`available`,`declined`,`voided`,`error`) | Nequi y Bancolombia nacen pendientes |
| `provider_token_id` | text | Id del token para consultar su estado |
| `provider_merchant_id` | text NOT NULL en filas nuevas | Comercio que creó la fuente (`data.id` de `/merchants/info`) — D11 |
| `school_id` | uuid FK | Escuela en cuyo comercio se creó |
| `display_label` | text | "Visa •••• 4242", "Nequi •••• 5678" |
| `phone_hmac` | text | **HMAC-SHA256** del celular con un secreto en vault (`autopay_phone_hmac_key`). No es sha256 pelado: con los últimos 4 dígitos guardados, un celular colombiano se recupera por fuerza bruta al instante |
| `authorized_at`, `voided_at` | timestamptz | Auditoría |

- **Índice:** único parcial `(user_id, school_id, provider_payment_source_id) WHERE status='available'`.
- **Datos existentes:** las 2 filas actuales (inservibles) pasan a `voided`.

### 4.2 `recurring_subscriptions` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `school_id` | uuid NOT NULL FK | |
| `payer_user_id` | uuid NOT NULL FK `profiles` | Quien consintió |
| `child_id` / `athlete_user_id` | uuid FK (XOR) | El atleta (D7) |
| `payment_token_id` | uuid NOT NULL FK | |
| `consent_id` | uuid NOT NULL FK `payment_consents` | |
| `max_amount` | numeric(12,2) NOT NULL CHECK > 0 | D5 |
| `first_period_year` / `first_period_month` | smallint NOT NULL | D14 |
| `status` | CHECK (`active`,`suspended`,`cancelled`) | |
| `cycles_without_debit` | smallint NOT NULL DEFAULT 0 | D12 |
| `suspend_reason` | CHECK (`provider_declined`,`over_max_amount`,`token_not_available`,`duplicate_charge`) | |
| `cancel_reason` | CHECK (`parent`,`school`,`athlete_inactive`,`no_active_enrollment`,`token_voided`,`account_deleted`,`merchant_changed`) | |
| timestamps | | |

- **Unicidad:** único parcial `(school_id, coalesce(child_id, athlete_user_id)) WHERE status IN ('active','suspended')`.

### 4.3 `autopay_cycles` (nueva) — una fila por cobro

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `payment_id` | uuid NOT NULL **UNIQUE** FK `payments` | |
| `subscription_id` | uuid NOT NULL FK | |
| `announced_total` | numeric(12,2) | Base + recargo anunciado en el aviso |
| `notice_sent_at` | timestamptz | Sin esto no hay intento (D4) |
| `first_attempt_on` | date | `max(due_date − N, notice_sent_at::date + 2)` |
| `next_attempt_on` | date | |
| `attempts_used` | smallint NOT NULL DEFAULT 0 CHECK 0..3 | Solo intentos **reales** |
| `state` | CHECK (`scheduled`,`noticed`,`in_progress`,`paid`,`skipped`,`exhausted`,`cancelled`) | |
| `skip_reason` | CHECK (`parent_skip`,`paid_elsewhere`,`manual_checkout_open`,`over_max_amount`,`token_not_available`,`merchant_mismatch`,`debits_paused`,`kill_switch`) | |
| `renotice_count` | smallint DEFAULT 0 | Veces que se re-anunció por subida de monto |
| timestamps | | |

Los `skipped` viven **aquí**, no en los intentos: no consumen `attempt_no`.
`manual_checkout_open`, `debits_paused` y `kill_switch` son **transitorios**: el ciclo vuelve a
`noticed` cuando la condición desaparece. `parent_skip` y `paid_elsewhere` son finales.

### 4.4 `recurring_charge_attempts` (nueva) — solo intentos reales contra Wompi

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `cycle_id` | uuid NOT NULL FK | |
| `payment_id` | uuid NOT NULL FK | |
| `payment_link_id` | uuid FK | Enlace `SCH-` del intento |
| `attempt_no` | smallint NOT NULL CHECK 1..3 | |
| `status` | CHECK (`processing`,`pending_provider`,`approved`,`declined`,`error`) | |
| `amount` | numeric(12,2) | ≤ `announced_total`, garantizado por la RPC |
| `provider_reference`, `provider_transaction_id` | text | |
| `error_code` | text | Normalizado; nunca la respuesta cruda |
| `lease_until` | timestamptz | |
| `next_check_at` | timestamptz | Reconsulta de PENDING (§7.5) |
| timestamps | | |

- **Unicidad:** `(cycle_id, attempt_no)`; único parcial `(payment_id) WHERE status IN ('processing','pending_provider')`.

### 4.5 `autopay_incidents` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `kind` | CHECK (`duplicate_charge`,`cron_missed`,`stale_lease`,`stale_pending`,`merchant_mismatch`) | |
| `school_id`, `payment_id`, `subscription_id` | uuid | Los que apliquen |
| `provider_transaction_id` | text | La transacción sobrante, en un `duplicate_charge` |
| `amount` | numeric(12,2) | |
| `state` | CHECK (`open`,`refund_requested`,`refunded`,`credited`,`dismissed`) | §12 |
| `resolution_note`, `resolved_by`, `resolved_at` | | |
| `created_at` | | |

### 4.6 `payment_links` (+2 columnas)

- `origin` text NOT NULL DEFAULT `'checkout'` CHECK (`checkout`,`autopay`).
- `recurring_attempt_id` uuid FK.

### 4.7 Configuración

- **`school_settings`:**
  - `autopay_enabled` boolean DEFAULT false: ofrecer.
  - `autopay_debits_paused` boolean DEFAULT false: frenar débitos.
  - `autopay_surcharge_mode` CHECK (`same_as_online`,`none`) DEFAULT `same_as_online`.
  - `autopay_days_before_due` smallint DEFAULT 3 CHECK 0..10.
- **`platform_config`:** fila `autopay_kill_switch` con `{"debits_enabled": true}`. El claim la lee en cada corrida; apagarla es `UPDATE platform_config SET value='{"debits_enabled":false}' WHERE key='autopay_kill_switch'`.
- **Vault:**
  - `autopay_cron_secret`: el cron → BFF.
  - `autopay_phone_hmac_key`: el HMAC de teléfonos. El BFF lo lee al arrancar desde su ENV, cargado con el mismo valor; nunca va en el repo.

---

## 5. RPCs

Todas `SECURITY DEFINER` con el `search_path` fijo. **Reciben `p_user_id` / `p_actor_id`**
porque el BFF las llama con `service_role` (B1). REVOKE de `PUBLIC`/`anon`/`authenticated` y
GRANT solo a `service_role`.

| RPC | Qué hace |
|---|---|
| `autopay_register_token(...)` | Crea o actualiza un medio. El dueño es siempre `p_user_id`; sin `ON CONFLICT` que cambie el dueño (B12) |
| `autopay_mark_token(p_token_id, p_status)` | Transiciones válidas del medio |
| `autopay_create_subscription(p_user_id, p_school_id, p_athlete, p_token_id, p_max_amount, p_consent_id, p_include_current_period bool)` | Alta. Valida: `autopay_enabled`; atleta con inscripción activa en la escuela; `p_user_id` es acudiente del menor o el atleta adulto; token del usuario, `available` y de esa escuela; tope ≥ total vigente. Calcula `first_period` (D14): el siguiente al último cobro de mensualidad del atleta, o el actual si `p_include_current_period` y ese cobro está `pending` y no vencido |
| `autopay_cancel_subscription(p_actor_id, p_subscription_id, p_reason)` | Pagador o admin (`user_admin_school_ids()` **evaluado para `p_actor_id`**). Devuelve si la fuente quedó sin uso, para que el BFF decida el `void` (D13) |
| `autopay_parent_skip(p_user_id, p_cycle_id)` | "Ya pagué este mes". Solo el pagador; solo si el ciclo está en `scheduled`/`noticed` → `skipped`/`parent_skip`. Registra quién y cuándo, y avisa a la escuela para que concilie |
| `autopay_plan_cycles(p_today)` | Crea o actualiza los ciclos del día y decide qué avisos salir (§5.1, pasos A y B) |
| `autopay_mark_noticed(p_cycle_id, p_announced_total)` | La llama el BFF **después** de enviar el aviso; recién ahí existe `notice_sent_at` |
| `autopay_claim_due(p_limit, p_lease_seconds)` | En una transacción: elige los ciclos a debitar hoy e inserta el intento `processing` con lease (§5.1, paso C) |
| `autopay_finish_attempt(p_attempt_id, p_status, p_tx_id, p_error_code)` | Idempotente. Actualiza el ciclo (`paid`/`exhausted`) y `cycles_without_debit`/suspensión (D12) |
| `autopay_record_incident(...)` | Registra un incidente y, si es `duplicate_charge`, suspende la suscripción |
| `autopay_attempts_for(p_actor_id, p_subscription_id)` | Lectura de intentos para el pagador o el admin (§6) |

### 5.1 Regla del ciclo (fecha Bogotá)

**A. Planificar.** Por cada suscripción `active` y cada cobro `p` que cumpla todo esto:
- `payment_category='mensualidad'`, **`status='pending'`** (nunca `overdue`, D14).
- Del atleta y la escuela de la suscripción.
- Periodo ≥ `first_period`.

se crea el ciclo si no existe (`state='scheduled'`), con `first_attempt_on` provisional
`= due_date − N`.

**B. Avisar.** Un ciclo `scheduled` o que requiera re-aviso recibe aviso hoy si
`hoy ≥ max(p.created_at::date, due_date − N − 2)`. Antes de avisar:
- Se calcula `total = base + recargo`. Si `total > max_amount` → `skipped`/`over_max_amount`, aviso "supera tu tope" y cuenta para D12.
- Si el token no está `available` → `skipped`/`token_not_available`, aviso y cuenta para D12.
- Si todo bien, el BFF envía el aviso y llama `autopay_mark_noticed(total)` → `state='noticed'`, `announced_total=total`, `first_attempt_on = max(due_date − N, hoy + 2)`, `next_attempt_on = first_attempt_on`.

**C. Debitar.** Un ciclo entra al claim hoy si cumple todo esto:
1. `platform_config.autopay_kill_switch.debits_enabled = true`. Si no, el claim no devuelve nada.
2. `school_settings.autopay_debits_paused = false`.
3. `state='noticed'`, `notice_sent_at` no nulo y `hoy ≥ next_attempt_on`.
4. `p.status='pending'`. Si ya está `paid`/`awaiting_approval`/`partial` → `skipped`/`paid_elsewhere`, y eso reinicia D12. Si pasó a `cancelled` → `cancelled`.
5. El total recalculado ≤ `announced_total`. Si subió: re-aviso (vuelve al paso B) y **ningún intento**.
6. Mismo comercio (D11), o `skipped`/`merchant_mismatch` + incidente.
7. Sin intento vivo (`processing`/`pending_provider`) y `attempts_used < 3`.
8. Regla de checkout manual (§7.3).

Se toma con `FOR UPDATE SKIP LOCKED` sobre `autopay_cycles`, y el `INSERT` del intento va en la
misma transacción, con `attempts_used += 1`. Después de un intento fallido,
`next_attempt_on = first_attempt_on + 1` y luego `+ 3`. Con `attempts_used = 3` y fallo →
`exhausted`: el cobro queda como cualquier pendiente y sigue su curso normal (vence, mora si la
escuela la tiene).

### 5.2 Ganchos en funciones existentes

- `set_school_athlete_status(... false)` → cancela la suscripción del atleta (`athlete_inactive`) y sus ciclos abiertos.
- Si al cancelar o terminar una inscripción el atleta queda **sin ninguna inscripción activa** en la escuela → `no_active_enrollment`. Antes de F1 hay que inventariar todos los caminos que cancelan inscripciones: la RPC de baja, el cambio de plan y la limpieza de duplicados.
- Baja de cuenta → cancela todas (`account_deleted`) y hace `void` de las fuentes.

---

## 6. RLS y permisos

| Tabla | Lectura | Escritura |
|---|---|---|
| `payment_tokens` | Dueño | Solo RPC |
| `recurring_subscriptions` | Pagador; admin de la escuela (`school_id = ANY((select user_admin_school_ids())::uuid[])`) | Solo RPC |
| `autopay_cycles` | Igual que la suscripción, vía función `SECURITY DEFINER` (sin subselect a otra tabla con RLS) | Solo RPC |
| `recurring_charge_attempts` | Vía `autopay_attempts_for` | Solo RPC |
| `autopay_incidents` | Admin de plataforma; el admin de la escuela ve los de su escuela | Solo RPC |
| `payment_consents`, `pending_card_saves` | Dueño | Solo RPC |

- El coach no ve nada de esto.
- Sin `FOR ALL` (I3).

---

## 7. Motor (BFF)

`bff/src/services/autopay.service.ts`, nuevo. `recurring-charges.service.ts` queda solo para
vendors, fuera de alcance.

### 7.1 Corridas

| Cron (pg_cron → `net.http_post` → BFF, secreto desde vault) | Hora UTC | Qué |
|---|---|---|
| `autopay-daily` | 12:00 (07:00 Bogotá), después de `generate-monthly-charges-daily` 06:30 | Planificar, avisar y debitar (§5.1 A-B-C) |
| `autopay-sweep` | cada 15 min | Reconsultar PENDING, leases vencidos y alertas (§7.5, §10.2) |

- Los dos endpoints se montan **fuera** de `requireCsrfHeader` (B2) y comparan el secreto en tiempo constante.
- Cada corrida escribe un latido en `platform_config['autopay_heartbeat']`.

### 7.2 Por cada intento reclamado

1. **Credenciales:** `resolveProvider({ schoolId, preferredProvider: 'wompi' })` y `merchant_id` desde `GET /merchants/info` (en caché por llave pública). Nunca las llaves de ENV salvo que el resolver las devuelva (`aggregator`).
2. **Enlace:** `payment_links` con `origin='autopay'`, referencia `SCH-…` (mismo helper que `create-session`) y `gross = amount del intento`.
3. **Cobro:** `POST /v1/transactions` con `payment_source_id`, `amount_in_cents`, `reference`, `customer_email` y `signature` (y `acceptance_token` si la doc lo exige, pregunta 7). `installments`/`recurrent` **solo para CARD**.
4. **Resultado:**
   - `APPROVED` síncrono → conciliar con la **misma función** que usa `handleSchoolPayment`, que es idempotente por `payment_splits`, y después `finish_attempt(approved)`.
   - `PENDING` → `pending_provider`, `next_check_at = now() + 2 min`.
   - `DECLINED`/`ERROR` → `finish_attempt(declined|error)` y el enlace pasa a `declined`/`failed`.
   - Timeout sin respuesta → queda `processing`; el barrido reconsulta **por referencia** con la llave privada antes de decidir nada.

### 7.3 Checkouts manuales y el débito (D8)

Regla del paso C.8, sobre el `payment_links` `pending` de origen `checkout` del mismo cobro:
- **Creado hace menos de 2 h** → el ciclo queda `skipped`/`manual_checkout_open` (transitorio, sin consumir intento) y se reintenta en la próxima corrida.
- **Más viejo** → consultar en Wompi, **por su referencia y con las credenciales del resolver**, si tiene transacción. Si no tiene ninguna, o solo `DECLINED`/`ERROR`/`VOIDED` → se expira el enlace y el débito sigue. Si tiene `PENDING` o `APPROVED` → `skipped`/`manual_checkout_open`. En el caso de `APPROVED`, además se dispara la conciliación de ese pago, porque es un webhook que se perdió.
- Como hoy **no hay ningún proceso que expire enlaces** (59 pendientes, todos vencidos), esta consulta es la que los limpia en el camino del débito. Un cron general de expiración queda como mejora aparte, fuera de este spec.

**`create-session` ante un débito vivo:** si el cobro tiene un `payment_links` `pending` de origen `autopay`, o un intento `processing`/`pending_provider`, responde **409 controlado** (`code: 'autopay_in_progress'`, "Tu débito automático de este mes está en proceso. Si se rechaza te avisamos para que pagues por aquí.") sin tocar el índice único. Si el ciclo está solo `noticed`, el checkout manual sigue permitido y gana: el paso C.4 lo detecta como `paid_elsewhere`.

### 7.4 Idempotencia

Referencia `SCH-` única por intento; intento único por `(cycle_id, attempt_no)`. Si Wompi
rechaza una referencia repetida, se resuelve consultando la transacción existente.

### 7.5 Barrido (`autopay-sweep`, cada 15 min)

- `pending_provider` con `next_check_at` vencido → `GET /transactions/{id}`. Si sigue PENDING, el próximo `next_check_at` avanza con backoff (2 min, 10 min, 30 min y luego cada hora). **Los tiempos finales se fijan midiendo en sandbox** cuánto tarda un PENDING en resolverse por medio (F2).
- `pending_provider` de más de 24 h → incidente `stale_pending` y alerta.
- `processing` con lease vencido → reconsulta por referencia. Si no hay transacción → `error`/`lease_expired` sin consumir el ciclo; si la hay → se toma su estado. Siempre incidente `stale_lease`.

### 7.6 Logs

Solo ids, estados y códigos. Nunca cuerpos de petición, números, celulares ni respuestas crudas.

---

## 8. Webhooks (Wompi)

### 8.1 `transaction.updated` con referencia `SCH-`

Sin cambios de fondo. Si el enlace es `origin='autopay'` → `autopay_finish_attempt` con el
estado final.

### 8.2 `nequi_token.updated` / `bancolombia_transfer_token.updated`

Hoy se ignoran (`wompi.ts:153`).
- El token se busca por `provider_token_id` y las credenciales por su `school_id`.
- La firma se verifica con el `events_secret` de **ese** comercio (`SHA256(propiedades en el orden recibido + timestamp + secreto)`).
- `APPROVED` → `POST /v1/payment_sources` + `autopay_register_token(available)`.
- `DECLINED` → `autopay_mark_token(declined)`.

### 8.3 Detector de cobro doble

Si llega una transacción `APPROVED` (por webhook, barrido o respuesta síncrona) para un
`payments` que **ya está `paid`** con **otra** transacción o referencia:
- **No** termina solo en `already_processed`.
- Se llama `autopay_record_incident('duplicate_charge', ...)`: queda el incidente con la transacción sobrante y el monto, se **suspende** la suscripción (`duplicate_charge`), se alerta (§10.2) y se avisa a la escuela y al padre ("Detectamos dos pagos de la mensualidad de octubre de Sofía. La escuela va a gestionar la devolución de uno.").
- Aplica a cualquier combinación: débito + checkout en línea, o dos intentos. El test 2 de F1 lo cubre.
- **Red diaria:** `autopay-daily` revisa los pagos de las últimas 72 h con más de una transacción `APPROVED` en `payment_splits`/`payment_links` para el mismo `payment_id`, y crea el incidente si falta.
- **Límite conocido:** un pago por transferencia o en efectivo que la escuela todavía no registró **no es detectable** por el sistema. Para eso está el botón "Ya pagué este mes" (D8), y la escuela registra ese pago como **saldo a favor** o devolución (§12).

---

## 9. Medios de pago

Fuente: https://docs.wompi.co/docs/colombia/fuentes-de-pago/ (2026-09-29).

| Medio | Fase | Flujo |
|---|---|---|
| **Tarjeta** | F3 | `POST /v1/tokens/cards` en el cliente con la llave pública del comercio (la tarjeta no pasa por el BFF) → `POST /v1/payment_sources` (llave privada) → `AVAILABLE`. El cumplimiento PCI de tokenizar en formulario propio está en la pregunta 10; si Wompi recomienda otra captura, se cambia en F3. 3DS en fuentes queda fuera de v1 (requiere activación) |
| **Nequi** | F4 | `POST /v1/tokens/nequi` → el padre acepta en su app → polling de `GET /v1/tokens/nequi/{id}` cada 3 s hasta 10 min + evento → fuente `NEQUI`. **Si Nequi pide aprobación en cada cobro (pregunta 8), no sirve como débito** y se replantea F4 |
| **Bancolombia** | F4 | `POST /v1/tokens/bancolombia_transfer` con `type_auth: "TOKEN"` → `authorization_url` → polling + evento → fuente `BANCOLOMBIA_TRANSFER`. La doc dice que con token `APPROVED` los cobros no piden autenticación |
| **Daviplata** | F6 | Requiere activación comercial. OTP (3 min, 2 reenvíos, 2 intentos), una sola tokenización por pagador y comercio |
| PSE, Bre-B, Mercado Pago | — | Fuera (D1) |

---

## 10. Avisos y alertas

### 10.1 A la familia y a la escuela

In-app + push + correo. WhatsApp solo con opt-in (`wa_can_send_template`). Español, de tú, sin voseo.

| Momento | A quién | Texto base |
|---|---|---|
| Alta | Padre | "Listo. Cada mes te avisaremos cuánto y cuándo debitaremos la mensualidad de Sofía de tu Nequi •••• 5678. Puedes cancelarlo cuando quieras en Mis Pagos." |
| **Aviso previo (D6)** | Padre | "El jueves 8 de octubre debitaremos $157.500 de tu Nequi •••• 5678 por la mensualidad de octubre de Sofía." Botones: **"Ya pagué este mes"** y "Ver detalle" |
| Re-aviso por subida | Padre | "La mensualidad de octubre de Sofía cambió a $165.000. La debitaremos el sábado 10 de octubre." |
| "Ya pagué este mes" | Escuela | "La familia de Sofía dice que ya pagó octubre. Revisa y registra el pago." |
| Aprobado | Padre + escuela | El recibo que ya sale por el webhook |
| Falló un intento | Padre | "No pudimos debitar la mensualidad de octubre de Sofía. Lo intentaremos otra vez el viernes. Si prefieres, págala ahora." + `/my-payments?pay=<id>` |
| Ciclo agotado | Padre + escuela | "La mensualidad de octubre de Sofía quedó pendiente. Págala desde Mis Pagos." |
| Supera el tope | Padre | "Este mes la mensualidad de Sofía ($210.000) supera el tope que autorizaste ($180.000), así que no la debitaremos. Págala desde Mis Pagos o sube el tope." |
| Suspendida | Padre + escuela | Según el motivo: actualizar el medio, subir el tope o cobro doble |
| Débitos frenados por la escuela | Padre | "La escuela pausó los débitos automáticos por ahora. Este mes paga desde Mis Pagos." |
| Cobro doble | Padre + escuela | Ver §8.3 |

### 10.2 Alertas operativas

Canal: **Sentry** (`captureMessage` con nivel `error` y tag `autopay`; ya está instalado en
`bff/src/instrument.ts`) más una notificación in-app a los admins de plataforma. Si el equipo
prefiere otro canal (correo a soporte, Slack), se cambia solo el adaptador.

| Alerta | Condición |
|---|---|
| `cron_missed` | `autopay_heartbeat` sin actualizar después de 12:30 UTC, o el barrido sin correr en 45 min |
| `stale_lease` | Intento `processing` con lease vencido |
| `stale_pending` | `pending_provider` de más de 24 h |
| `duplicate_charge` | §8.3 |
| `merchant_mismatch` | D11 |

---

## 11. Frontend

### 11.1 Familia

**Mis Pagos.** La sección "Débito automático" reemplaza la tarjeta falsa (`MyPaymentsPage.tsx:715-759`).
- Por atleta: estado, medio (`display_label`), tope, próximo débito anunciado.
- Acciones: activar, cambiar medio, cambiar tope y cancelar.
- Solo se ve si la escuela tiene `autopay_enabled`, o si la familia ya tiene una suscripción activa.

**Alta, en 4 pasos:**
1. Atleta.
2. Medio: tarjeta, Nequi (con pantalla de espera: "Abre Nequi y acepta la suscripción de <escuela>") o Bancolombia.
3. Condiciones:
   - Valor actual, recargo si aplica y tope editable.
   - Explicación: "Te avisaremos 2 días antes de cada débito".
   - La casilla **"Debitar también la mensualidad de <mes>"**, solo si hay un cobro `pending` no vencido (D14).
   - Una nota si hay cobros vencidos: "Tienes <n> mensualidades vencidas; el débito no las cobra. Págalas desde Mis Pagos."
4. Consentimiento: dos casillas sin premarcar, con los enlaces a los PDF de Wompi.

**Aviso previo.** El botón "Ya pagué este mes" abre una confirmación dentro de la app
("No debitaremos octubre. La escuela revisará tu pago.") y llama `autopay_parent_skip`.

**Puntos de entrada:** la pantalla de pago aprobado, Mis Pagos y el enlace que comparte la escuela.

**Textos a corregir:** `MyPaymentsPage.tsx:650`, `AccountDeletionCard.tsx`, `AccountDeletionPage.tsx`, `PrivacyPage.tsx:475`.

### 11.2 Escuela

**`SportMapsPaySettings.tsx`:**
- "Ofrecer débito automático a las familias" (`autopay_enabled`).
- "Pausar los débitos de este mes" (`autopay_debits_paused`), con confirmación: "Se avisará a las <n> familias con débito activo".
- Recargo en el débito (D3) y días antes del vencimiento (D4).

**Panel "Débito automático":**
- Familias activas, suspendidas y canceladas.
- Ciclos del mes por estado, con su motivo.
- "Ya pagué" reportados por familias, pendientes de registrar.
- Incidentes de cobro doble y la acción de resolverlos (§12).
- Porcentaje de mensualidades pagadas por débito.

**Material:** botón "Invitar a las familias" con texto listo para WhatsApp y correo, y el enlace `/my-payments#debito`.

---

## 12. Devolución de un cobro doble

**Hecho que corrige una premisa:** en modo `aggregator`, las llaves de ENV del ambiente donde
opera Dynasty son las **del comercio de Dynasty** (`1298966`), no de SportMaps (memoria
`project_env_payment_credentials`). En los dos modos la plata del débito entra al **comercio de
la escuela**. SportMaps no recibe ni retiene ese dinero, así que **no puede devolverlo desde su
cuenta**.

**[PROPUESTA] — pendiente de la pregunta 9 a Wompi:**
1. **Quién devuelve:** el titular del comercio, es decir, la escuela. SportMaps le deja el caso listo en el panel (incidente con la transacción sobrante, monto, familia y fecha) y la acompaña.
2. **Por qué vía:** la anulación o reembolso de Wompi desde el dashboard del comercio, si Wompi lo permite para esa transacción y ese medio. Para Nequi y Bancolombia hay que confirmar si se puede reversar (pregunta 9). Si no se puede, la escuela devuelve por transferencia.
3. **Alternativa, si la familia prefiere:** dejar el cobro sobrante como **saldo a favor** del mes siguiente. Hoy no existe un modelo de saldo a favor en `payments`, así que hay que diseñarlo, y queda **fuera de este spec**. Mientras no exista, la vía es la devolución.
4. **Cómo se refleja en SportMaps:**
   - El pago del mes queda `paid` con la transacción que llegó primero.
   - La transacción sobrante no crea otro `payments`: vive en el incidente.
   - La escuela marca el incidente `refund_requested` → `refunded` con una nota y el comprobante de la devolución.
   - Si Wompi hace la reversa, su evento (`transaction.updated` con `VOIDED`) cierra el incidente solo.
   - El `payment_splits` del pago bueno no se toca; el de la transacción sobrante, si el webhook alcanzó a crearlo, se revierte con un registro negativo trazable.
5. **Lista antes del piloto (F6)**, con la respuesta de Wompi incorporada.

---

## 13. Seguridad y cumplimiento

- La tarjeta se tokeniza en el cliente. De Nequi y Daviplata se guardan los últimos 4 dígitos y el HMAC.
- **Habeas Data:** `GET /merchants/info` del comercio de la escuela en el momento del alta. `payment_consents` guarda el token, el permalink, la IP, el user-agent, la fecha y el `user_id`.
- Fail-closed en credenciales y comercio (D11), y los tres interruptores (D10).
- **IDOR:** `user_id` del JWT; el vínculo padre↔atleta↔escuela se valida en la base; el panel usa `user_admin_school_ids()`. B11 se desmonta en F2.
- `npm run seguridad:invariantes` en verde al cerrar F0, F1 y F5.
- Hay que corregir `mercadopago.ts:808`, que loguea `req.body` completo.

---

## 14. Fases y pruebas

**F0 — Hotfix de seguridad** (migración propia; ver plan por la decisión pendiente sobre `save_payment_token`).
- anon/authenticated no pueden hacer INSERT/UPDATE/DELETE en las 3 tablas (42501).
- Ninguna función `SECURITY DEFINER` que toque esas tablas la pueden ejecutar `PUBLIC`/`anon`/`authenticated`.
- Invariantes sin I3 en esas tablas.
- La `create_recurring_subscription` de 8 argumentos ya no existe.

**F1 — Base.** Pruebas de concurrencia y de regla (obligatorias):
1. Dos `autopay_claim_due` simultáneos → un solo intento vivo por cobro.
2. Pago en línea manual aprobado mientras el intento está `processing`, y el débito también aprueba → **incidente `duplicate_charge`**, suscripción suspendida, el cobro `paid` una sola vez.
3. Sin `notice_sent_at` → ningún intento.
4. Total recalculado mayor que `announced_total` → re-aviso y ningún intento.
5. Un `skipped` no consume `attempt_no`.
6. Checkout de menos de 2 h → `manual_checkout_open`. De más de 2 h sin transacción en Wompi (mock) → se expira y el débito corre. Con transacción `PENDING` → `skipped`.
7. `create-session` con un enlace `autopay` vivo → 409 `autopay_in_progress`, sin 500.
8. Oferta apagada con suscripciones activas → siguen debitando. `autopay_debits_paused` → cero intentos. Interruptor global apagado → el claim no devuelve nada.
9. Activar con un cobro `overdue` de un periodo anterior → no se debita. Con la casilla de D14 → se debita solo el `pending` no vencido.
10. Pausa aprobada → no hay cobro ni ciclo. Baja del atleta → suscripción cancelada.
11. Dos ciclos seguidos con `over_max_amount` → `suspended`. `parent_skip` no cuenta. Un pago manual reinicia el contador.
12. El padre A no crea una suscripción para el hijo de B, ni con el token de B. El coach no lee nada del débito.
13. `phone_hmac` no coincide con el sha256 simple del número.

**F2 — Motor.** vitest con Wompi simulado para:
- `APPROVED`, `PENDING` → webhook, `PENDING` → barrido, `DECLINED` ×3 → `exhausted`, timeout con reconsulta.
- Referencia duplicada, `merchant_mismatch`, detector de doble cobro, latido y alertas.
- **Medición en sandbox** de cuánto tarda un PENDING en resolverse por medio, para fijar los tiempos de §7.5.

**F3 — Tarjeta:** QA en celular real contra sandbox (alta, aviso, "Ya pagué", débito, recibo, cancelar).
**F4 — Nequi y Bancolombia:** sandbox y una cuenta real del equipo.
**F5 — Escuela:** radio cero (todo apagado en las 371 escuelas).
**F6 — Piloto:** métricas frente a sep-2026 (62% manual, ~140 registros al mes).

### Antes de aplicar (obligatorio)

- `pg_get_functiondef` de toda función que se toque. `open_month` ya se leyó el 2026-09-29: un cobro por atleta y periodo, `pending`, `mensualidad`, periodo explícito.
- `pg_policies` de cada tabla tocada.
- `npm run migrations:new -- <slug>` y aplicar con rastro.
- Regenerar `types.ts`.
- Invariantes.

---

## 15. Dato de producto: por qué cayeron los pagos en línea de Dynasty

Consulta de solo lectura del 2026-09-29, detalle en el plan. **No es el recargo:
`online_fee_pct` estuvo en 5% todo el periodo. Es un fallo técnico.**
- Desde el 27 de agosto, 10 de los 11 checkouts fallidos de Dynasty generaron transacciones en el **comercio de sandbox de Wompi** (`11981889`), que respondió "La firma es inválida". El comercio real de Dynasty es `1298966`.
- Después de fallar, 7 de esas familias pagaron por transferencia y 3 siguen en mora.
- Desde el 20 de septiembre no hay ningún intento de pago en línea.

D3 queda como está. El default del piloto se decide cuando el checkout esté arreglado y se vea
cuánta gente vuelve a pagar en línea.

---

## 16. Fuera de alcance

- Suscripciones de vendors.
- Mercado Pago recurrente.
- 3DS en fuentes.
- Débito de inscripciones, productos o deudas vencidas (D14).
- Saldo a favor (§12.3).
- Cron general de expiración de `payment_links` (§7.3).
- Atletas sin cuenta.

---

## 17. Preguntas a Wompi

Se mandan ya, en paralelo con F0. **F1 no arranca sin respuesta a la 1 y la 8**, porque definen
si Nequi y Bancolombia son viables. Si no lo son, una F3 solo con tarjeta cubre poco de lo que
motiva el proyecto (en Dynasty, Nequi es el 25% y Bancolombia el 12% de las transferencias), y
se decide si F1-F3 siguen en ese orden.

1. ¿Nequi y Bancolombia recurrentes requieren activación comercial? La doc solo lo dice de Daviplata.
2. ¿Cuánto dura un token Nequi en `PENDING`?
3. ¿Hay evento o forma de enterarse cuando el usuario cancela la suscripción desde la app de Nequi o Bancolombia?
4. ¿Cuánto duran los tokens de aceptación de `/merchants/info`?
5. ¿Datos de sandbox para **tokenizar** Nequi y Bancolombia?
6. ¿Comisión distinta para cobros con fuente de pago?
7. ¿`acceptance_token` es obligatorio en `POST /transactions` con `payment_source_id`?
8. ¿Nequi pide aprobación del padre **en cada cobro** recurrente o solo al tokenizar? ¿Y Bancolombia?
9. Contracargos y devoluciones de transacciones con fuente de pago: cómo funcionan, plazos, si se puede reversar una transacción aprobada de Nequi o Bancolombia, y quién la ejecuta cuando el comercio es de la escuela.
10. Si la tarjeta se tokeniza en un formulario propio con `/v1/tokens/cards`, ¿qué exige Wompi en cumplimiento PCI? ¿Recomiendan otro método de captura?
