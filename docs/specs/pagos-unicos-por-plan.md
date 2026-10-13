# Pagos únicos por plan (lista configurable) — spec + plan por fases

> Estado: **SPEC, pendiente de aprobación** · 2026-10-10 · Autor: Brayan Steven Lopez (con Claude)
> Reemplaza las dos columnas fijas `offering_plans.registration_fee` / `insurance_fee` por una
> **lista configurable de pagos únicos por plan**. Sin código ni migraciones todavía: plan antes de código.
> Base: `dreamers-reglas-completas-plan.md` (F-B), migraciones `20261005214245`, `20261005214248`,
> `20261005214250`, `20261010124934` (exoneración por alta, **escrita pero NO aplicada**, ver §2.3).
>
> **Nota cruzada (2026-10-10).** `docs/specs/cobros-multiples.md` (aprobado, rev. 3) **reemplaza** de este spec:
> «Agregar cobro» (§5.4 `create_one_time_charge`, §6.1 `POST …/charges`, §7.3 y la **F3**, que queda eliminada) y
> `payments.client_request_id` / `uq_payments_client_request` (la idempotencia vive en `charge_batches`). Además
> «Registrar pago» (§9.3, P14) se convierte en el modal único **«Cobros y pagos»** (genera, registra pagos y aplica
> descuentos auditados en `payment_adjustments`); P6 (cambiar el monto de una fila de la lista) se resuelve con un
> descuento con motivo, no editando el valor. F0 es la misma en los dos specs y la construye un solo agente.

---

## 1. Problema

1. **Dos columnas fijas no alcanzan.** Hoy un plan solo sabe cobrar «Inscripción» y «Seguro». Las escuelas
   cobran además uniforme, kit, carnet, póliza de otra aseguradora, «derechos de federación», etc. Como no
   hay dónde ponerlos, terminan creando **planes** llamados «Inscripción», «Seguro», «Matrícula Golf»… que
   cobran como mensualidad recurrente (por eso existe `PAGO_UNICO_NO_ES_PLAN`, `bff/src/utils/pagosUnicos.ts`).
2. **La frecuencia está escondida en el código.** La inscripción se cobra en cada alta y el seguro con dedupe
   de 365 días porque así está escrito en `emit_enrollment_fees`. La escuela no lo ve ni lo puede cambiar
   (p. ej. «el uniforme, una sola vez en la vida del atleta»).
3. **El personal no puede crear un cobro suelto** a un atleta existente («se le olvidó cobrarle el seguro»,
   «pidió otra camiseta») sin pasar por un alta o por una venta de tienda.
4. **Las categorías de «cobro único» están en tres listas distintas** que ya divergen:
   - `fn_extend_enrollment_on_payment_paid` excluye `inscripcion, seguro, excedente`.
   - `open_month` excluye esas tres **más** `articulos, torneo, clase_extra, vacacional, viaje`.
   - BFF `ONE_OFF_PAYMENT_CATEGORIES` (`bff/src/services/enrollmentBilling.ts:22`) = las tres primeras.
   - **Ninguna excluye `otro`.** Un pago único de categoría `otro` con `offering_plan_id` puesto **daría
     vigencia** al pagarse y haría que `open_month` se saltara la mensualidad del mes. Con la lista
     configurable este hueco deja de ser latente: hay que cerrarlo antes de abrir la lista (§4.4).
5. **Los cobros del alta de Dreamers nacen sin pagador.** Los 6 cobros `inscripcion`/`seguro` vivos
   (3 + 3, creados 2026-10-10) son de menores **sin acudiente vinculado** (`children.parent_id` NULL) →
   `parent_id` NULL → impagables online hasta que se vincule el acudiente (`trg_backfill_payment_payer_on_link`
   lo completa). No es un bug de este módulo, pero el QA debe cubrirlo (§10).

## 2. Estado actual medido (base viva `luebjarufsiadojhvxgi`, 2026-10-10, solo lectura)

### 2.1 Radio
| Medida | Valor |
|---|---|
| Planes (`offering_plans`) en total | **158** en **25** escuelas |
| Planes con `registration_fee > 0` o `insurance_fee > 0` | **22**, todos de **Dreamers Gymnastics** (22 activos; 120.000 / 150.000 en los 22) |
| Escuelas afectadas por la migración de datos | **1** (Dreamers). Dojo Fénix ya quedó en NULL (decisión 2026-10-05) |
| Planes de Dreamers sin fee | 6: `PGP4x1` (activo — ¿olvido? ver P5), `CPP1x1`, `CPG1x2` (clases sueltas, excluidos a propósito), `Inscripcion`, `Seguro de accidentes`, `Banco de Horas — TEST` (inactivos) |
| Inscripciones de Dreamers | 6 activas, 4 canceladas |
| Cobros `inscripcion` / `seguro` existentes | 3 + 3, todos Dreamers, `pending`, `one_time`, `period_uniqueness_exempt = true`, **parent_id NULL** |
| Otros cobros únicos | Club Campestre Demo (prueba): 1 `articulos`, 2 `torneo`; Dynasty: 1 `otro` (pagado, `period_uniqueness_exempt = false`) |
| Planes con nombre de pago único | Dreamers `Inscripcion`, `Seguro de accidentes` (inactivos); Club Campestre Demo: 7 «Matrícula <deporte>» activos (**escuela de prueba: no se tocan**) |
| Escuelas con llaves restringidas (`payment_accounts[].only_for`) | **1**: Dynasty |
| QR de inscripción activos | 12 (Dreamers: 0) |
| Inscripciones creadas últimos 30 días | 162 (todas las escuelas) |

### 2.2 Restricciones vivas relevantes
- `payments_payment_category_check`: `NULL | mensualidad | inscripcion | articulos | torneo | otro | seguro | excedente | clase_extra | vacacional | viaje`.
  **No hace falta extenderlo**: uniforme/kit = `articulos`; carnet/federación/póliza externa = `otro` o `seguro`.
- `payments_payment_type_check`: `one_time | subscription`. **Ojo:** `emitPlanCharge` crea las mensualidades con
  `payment_type = 'one_time'` (`enrollmentBilling.ts:151`). `payment_type` **no** separa mensualidad de pago único;
  lo que separa es `payment_category` (ver memoria `project_payment_type_not_reliable`).
- Índices `uniq_payment_active_period_per_{child,adult,unreg}` excluyen `period_uniqueness_exempt = true`.
- `payments` **no tiene** `created_by` ni llave de idempotencia; `audit_logs(school_id, profile_id, table_name, record_id, action, old_data, new_data)` sí existe.
- No existe tabla de pagos únicos por plan: hoy viven solo en las dos columnas de `offering_plans`.

### 2.3 Trabajo en curso que este spec debe absorber
- **Migración `20261010124934_alta_exonerar_inscripcion_seguro.sql`** (sin commitear, **no aplicada**: la firma viva
  de `emit_enrollment_fees` sigue siendo la de 9 argumentos). Agrega `p_waive_registration` / `p_waive_insurance`
  y `waive_registration_fee` / `waive_insurance_fee` en el elemento `{"kind":"enrollment_fees"}`.
- BFF: `waive_registration_fee` / `waive_insurance_fee` en `POST /students/create-one` (`students-create-one.route.ts:98`),
  `POST /enrollments` (`enrollments.ts:47`) y `POST /students/first-payment-preview` (`:1261`); helpers
  `waivedFeeCategories`, `cancelWaivedFeeRows` (red de seguridad si la migración no está viva),
  `auditEnrollmentFeeWaiver` (`enrollmentBilling.ts:284-350`, acción `enrollment_fees_waived`).
- Frontend: checkboxes «No cobrar» en `CreateChildModal` / `CreateAdultAthleteModal`; editor de plan con campos
  Inscripción/Seguro + «Aplicar a todos» (`OfferingsManagement.tsx:1138`, `:1459`; BFF `POST /offerings/one-time-fees/apply`,
  `offerings.ts:581`); bloqueo de nombres de plan tipo «Inscripción/Seguro» (`utils/pagosUnicos.ts`).

**Cómo migra limpio** (§5.3): los flags booleanos se vuelven un caso particular de `waived_fee_ids uuid[]`.
El BFF traduce `waive_registration_fee` → «el id de la fila de la lista con `legacy_key = 'registration_fee'`»
durante la convivencia, y la exoneración se audita con la misma acción `enrollment_fees_waived` (nuevo
`new_data.waived_fee_ids`). Recomendación: **aplicar `20261010124934` tal cual** (es pequeña y ya tiene tests)
y que la F1 de este spec la reemplace; no reescribirla.

### 2.4 Hallazgo en el preview
`POST /students/first-payment-preview` (`students-create-one.route.ts:1300-1307`) suma `insurance_fee` **sin** el
dedupe de 365 días: si el atleta ya pagó seguro este año, la pantalla promete un total mayor al que se cobra.
La F2 lo arregla con una sola función de cálculo compartida entre preview y alta (§5.2).

---

## 3. Decisiones (usuario, 2026-10-10)

| # | Decisión |
|---|---|
| D1 | Inscripción, seguro, uniforme, etc. son **pagos únicos**, nunca planes. |
| D2 | Cada escuela configura **su lista por plan**: nombre, monto, categoría (valores de `payments.payment_category`) y frecuencia `cada_inscripcion` \| `una_vez_cada_12_meses` \| `una_sola_vez_por_atleta`. |
| D3 | En el alta, cada fila → **su propio cobro pendiente** (`one_time`, `period_uniqueness_exempt`, `parent_id` correcto, categoría), **atómico** con la inscripción. |
| D4 | En el formulario de alta el personal puede **«No cobrar X»** por fila, para esa alta; el resumen muestra el total real del primer cobro. |
| D5 | **«Agregar cobro»** en la ficha del atleta: desde la lista del plan o libre (categoría + monto + vencimiento + nota); auditable; idempotente contra doble clic. |
| D6 | Interruptor opcional por escuela: **cobrar automáticamente** en el alta vs. **solo sugerir**. |
| D7 | Dreamers (22 planes, 120.000 / 150.000) migra **sin cambio de comportamiento**. Club Campestre Demo es de prueba: **sin cambios de datos** planeados. |
| D8 | Los cobros se ven para el personal (ficha, pagos, cartera) y para acudientes/atletas (sus pagos/checkout); el enrutamiento de llaves por categoría (`only_for`) funciona. |

Decisiones de diseño propuestas en este spec (a confirmar en §12):
- **D9** La frecuencia se evalúa por **atleta + escuela + fila de la lista** (no por categoría), salvo la compatibilidad
  del seguro legado, que hoy deduplica por **categoría** (§5.2).
- **D10** La lista vive en una tabla hija `plan_one_time_fees`, no en `jsonb`: necesita FK desde `payments`, índices y RLS.
- **D11** Las columnas `registration_fee` / `insurance_fee` se **congelan** (solo lectura) en F1 y se **eliminan** en F6,
  no antes de 30 días sin lectores.

---

## 4. Modelo de datos

### 4.1 Tabla `public.plan_one_time_fees`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `school_id` | `uuid NOT NULL` FK → `schools(id)` `ON DELETE CASCADE` | Denormalizado para RLS sin JOIN (y sin recursión). |
| `offering_plan_id` | `uuid NOT NULL` FK → `offering_plans(id)` `ON DELETE CASCADE` | |
| `name` | `text NOT NULL` | `CHECK (length(btrim(name)) BETWEEN 1 AND 80)` |
| `amount` | `numeric(12,2) NOT NULL` | `CHECK (amount > 0)` (0 = no existe la fila; `payments_amount_positive` lo exige igual) |
| `category` | `text NOT NULL` | `CHECK (category IN ('inscripcion','seguro','articulos','torneo','otro','viaje','vacacional'))` — **sin** `mensualidad`, `excedente`, `clase_extra` (no son pagos únicos de alta). Subconjunto de `payments_payment_category_check`. |
| `frequency` | `text NOT NULL` | `CHECK (frequency IN ('cada_inscripcion','una_vez_cada_12_meses','una_sola_vez_por_atleta'))` (text + CHECK, no enum) |
| `is_active` | `boolean NOT NULL DEFAULT true` | Archivar en vez de borrar cuando ya hay cobros que la referencian. |
| `sort_order` | `smallint NOT NULL DEFAULT 0` | Orden en el resumen del alta. |
| `legacy_key` | `text NULL` | `CHECK (legacy_key IS NULL OR legacy_key IN ('registration_fee','insurance_fee'))`. Marca las filas creadas por el backfill; permite traducir los flags `waive_*` y comparar contra las columnas durante la convivencia. |
| `created_by` / `updated_by` | `uuid NULL` FK → `profiles(id)` | |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Trigger `updated_at` estándar. |

Índices:
- `ix_plan_otf_plan (offering_plan_id) WHERE is_active` — lectura en el alta.
- `ix_plan_otf_school (school_id)` — RLS y listado de la escuela.
- `uq_plan_otf_legacy (offering_plan_id, legacy_key) WHERE legacy_key IS NOT NULL` — backfill idempotente.
- `uq_plan_otf_name (offering_plan_id, lower(btrim(name))) WHERE is_active` — evita «Seguro» dos veces en el mismo plan.

Integridad:
- Trigger `BEFORE INSERT OR UPDATE` (`SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`) que exige
  `school_id = (SELECT school_id FROM offering_plans WHERE id = NEW.offering_plan_id)`. Sin esto un admin de A
  podría colgar una fila de un plan de B (la policy solo mira `NEW.school_id`).
- Límite blando: máximo 10 filas activas por plan (validado en BFF y en la RPC de guardado).

### 4.2 Columnas nuevas en `payments`
| Columna | Tipo | Para qué |
|---|---|---|
| `one_time_fee_id` | `uuid NULL` FK → `plan_one_time_fees(id)` `ON DELETE SET NULL` | Trazabilidad fila de lista → cobro; base del dedupe por frecuencia y del predicado «es pago único» (§4.4). |
| `created_by` | `uuid NULL` FK → `profiles(id)` | Quién creó el cobro manual («Agregar cobro»). NULL = automático/histórico. |
| `client_request_id` | `uuid NULL` | Idempotencia de «Agregar cobro». |
| `notes` | `text NULL` `CHECK (length(notes) <= 500)` | Nota del cobro manual (visible al personal; ¿al acudiente? → P7). |

Índices:
- `uq_payments_client_request (school_id, client_request_id) WHERE client_request_id IS NOT NULL` — doble clic = mismo cobro.
- `ix_payments_one_time_fee (one_time_fee_id, child_id, user_id, unregistered_athlete_id) WHERE one_time_fee_id IS NOT NULL AND status <> 'cancelled'` — dedupe por frecuencia.

Sin cambios en `payments_payment_category_check`.

### 4.3 `school_settings.one_time_fees_mode`
`text NOT NULL DEFAULT 'auto' CHECK (one_time_fees_mode IN ('auto','sugerir'))`.
- `auto` = hoy (Dreamers): la lista se cobra en el alta salvo lo exonerado.
- `sugerir` = el formulario muestra las filas **desmarcadas**; solo se cobran las que el personal marque.
  Los caminos sin formulario (QR, invitación, foto de matrícula aprobada automáticamente) **no cobran nada** en modo `sugerir`.
- Default `auto` porque con 0 filas en la lista es exactamente lo de hoy para las 24 escuelas sin fees.

### 4.4 Un solo predicado de «pago único» (cierra el hueco de `otro`)
Función `public.es_pago_unico(p_category text, p_one_time_fee_id uuid) RETURNS boolean IMMUTABLE`
(`SET search_path = pg_catalog, public, pg_temp`):
`p_one_time_fee_id IS NOT NULL OR COALESCE(p_category,'') IN ('inscripcion','seguro','excedente','articulos','torneo','clase_extra','vacacional','viaje')`.
- La usan `fn_extend_enrollment_on_payment_paid` (hoy 3 categorías) y `open_month` (hoy 8): **las dos quedan iguales**.
  Para `fn_extend…` esto **amplía** la exclusión a `articulos/torneo/clase_extra/vacacional/viaje` con `offering_plan_id`:
  medir antes cuántos cobros así existen (esperado: 0 con plan; Club Campestre los tiene sin plan → verificar).
- `otro` sigue fuera de la lista por categoría (Dynasty tiene 1 `otro` histórico que es mensualidad mal clasificada → P8),
  pero **todo cobro emitido desde la lista lleva `one_time_fee_id`**, así que nunca da vigencia ni ocupa período.
- BFF: `ONE_OFF_PAYMENT_CATEGORIES` pasa a ser la misma lista de 8 y `PLAN_PERIOD_CHARGE_FILTER` añade
  `one_time_fee_id.is.null` (un cambio o baja de plan nunca anula un pago único).
- `GRANT EXECUTE … TO authenticated, service_role` (es IMMUTABLE y sin datos; la usan triggers y vistas).

### 4.5 RLS de `plan_one_time_fees` (línea por línea)
`ALTER TABLE … ENABLE ROW LEVEL SECURITY;` — sin `FORCE` (las RPCs `SECURITY DEFINER` del dueño escriben).

| Policy | Cmd | Roles | USING / WITH CHECK | Por qué |
|---|---|---|---|---|
| `potf_select_members` | SELECT | `authenticated` | `USING (school_id = ANY ((SELECT public.user_school_ids())))` | Lectura para cualquier miembro: el acudiente necesita ver qué se le cobrará; el coach ve el resumen. Solo lectura → `user_school_ids()` es correcto (I2 no aplica). Envuelto en `(SELECT …)` (memoria `project_rls_helpers_not_wrapped`). |
| `potf_select_public` | SELECT | `anon` | `USING (is_active AND EXISTS (SELECT 1 FROM public.offering_plans op WHERE op.id = offering_plan_id AND op.is_active))` | **Solo si P3 = sí** (mostrar los pagos únicos en la página pública / QR). Montos de planes activos ya son públicos (`offering_plans_select_public`). Sin datos personales → no viola I1. Si P3 = no, esta policy no se crea y el QR los lee vía RPC. |
| `potf_insert_admin` | INSERT | `authenticated` | `WITH CHECK (school_id = ANY ((SELECT public.user_admin_school_ids())))` | Configurar precios es **configuración** → admin, no staff (coach no fija cobros). Mismo nivel que `offering_plans_insert_admin` (`is_school_admin`). |
| `potf_update_admin` | UPDATE | `authenticated` | `USING (school_id = ANY ((SELECT public.user_admin_school_ids()))) WITH CHECK (school_id = ANY ((SELECT public.user_admin_school_ids())))` | `WITH CHECK` explícito: impide mover la fila a otra escuela. |
| `potf_delete_admin` | DELETE | `authenticated` | `USING (school_id = ANY ((SELECT public.user_admin_school_ids())))` | Borrado físico solo si ningún cobro la referencia (el FK es `SET NULL`, pero el BFF archiva con `is_active=false` si hay cobros). |

- **Sin `FOR ALL`** (I3). Ninguna policy hace `SELECT FROM plan_one_time_fees` (sin self-recursion).
- GRANTs: `REVOKE ALL ON plan_one_time_fees FROM anon, authenticated;` luego `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated;`
  `GRANT SELECT TO anon` **solo** si P3 = sí. `service_role` completo.
- El frontend **no escribe directo** (aunque la policy lo permita al admin): todo pasa por BFF/RPC para auditar y validar
  el límite por plan. La policy de escritura existe como defensa en profundidad, no como camino.
- Correr `npm run seguridad:invariantes` y `select … from pg_policies where tablename='plan_one_time_fees'` tras aplicar.

### 4.6 Columnas nuevas de `payments`: RLS
No se crean policies nuevas en `payments`. Verificar que ninguna policy de UPDATE para acudiente permita tocar
`created_by`, `one_time_fee_id`, `client_request_id` (listar todas las de `payments` antes de F1; trampa #1).

---

## 5. RPCs

### 5.1 `save_plan_one_time_fees(p_school_id uuid, p_plan_id uuid, p_fees jsonb, p_actor uuid) RETURNS jsonb`
- `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, **solo `service_role`**
  (`REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`). El BFF valida el rol.
- Reemplazo **transaccional** de la lista de un plan (multi-fila → RPC, regla del CLAUDE.md): `SELECT … FOR UPDATE` del plan,
  upsert por `id`, archiva (`is_active=false`) las filas que desaparecen y tienen cobros, borra las que no tienen.
- Valida plan ∈ escuela, ≤ 10 activas, nombres únicos.
- Durante la convivencia (F1–F5) **escribe también** `registration_fee` / `insurance_fee` del plan desde las filas con
  `legacy_key` (para que cualquier lector viejo siga viendo lo mismo). Fila sin `legacy_key` no toca las columnas.
- Devuelve la lista resultante. Audita en `audit_logs` (`action='plan_one_time_fees_saved'`, old/new).
- Variante masiva `apply_one_time_fees_to_plans(p_school_id, p_plan_ids uuid[], p_fees jsonb, p_actor)` para reemplazar
  «Aplicar a todos» (`offerings.ts:581`), misma transacción.

### 5.2 `emit_enrollment_fees` v3 (misma función, nueva firma)
Nueva firma (DROP + CREATE como hizo `20261010124934`, para no crear sobrecarga ambigua):
`emit_enrollment_fees(p_school_id, p_plan_id, p_child_id, p_user_id, p_unreg_id, p_parent_id, p_branch_id, p_due_date, p_person_name, p_waived_fee_ids uuid[] DEFAULT '{}', p_only_fee_ids uuid[] DEFAULT NULL, p_waive_registration boolean DEFAULT false, p_waive_insurance boolean DEFAULT false)`.

- `p_waived_fee_ids`: filas que el personal desmarcó (D4).
- `p_only_fee_ids`: modo `sugerir` — si no es NULL, solo se emiten esas filas.
- `p_waive_registration` / `p_waive_insurance`: compatibilidad con el BFF de hoy; se traducen a las filas `legacy_key`.
- **Fuente de verdad**: `plan_one_time_fees` activas del plan. **Fallback** (F1–F5): si el plan no tiene filas en la lista
  pero sí columnas > 0 (lectura cruzada por si el backfill no corrió), emite como hoy. Tras el backfill el fallback es código muerto
  y se quita en F6.
- `pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || atleta, 0))` igual que hoy (misma llave que
  `create_enrollment_with_payments`).
- `parent_id`: igual que hoy (menor → `children.parent_id`; adulto → `user_id` como pagador implícito).
- Cada fila → `INSERT payments(... payment_type='one_time', payment_category=fee.category, period_uniqueness_exempt=true,
  one_time_fee_id=fee.id, offering_plan_id=p_plan_id, due_date=v_due, period_* explícito desde v_due, concept=fee.name || ' — ' || plan || persona)`.
  **Concepto**: para las filas `legacy_key` se conserva exactamente `'Inscripción — '` / `'Seguro de accidentes — '`
  (D7: Dreamers no ve cambio; el verificador de comprobantes y el bot infieren la categoría también por el texto).

**Dedupe por frecuencia** (atleta = `child_id`, o `user_id` con `child_id IS NULL`, o `unregistered_athlete_id`; siempre en la misma escuela; cobros `status <> 'cancelled'`):

| Frecuencia | Se omite si existe… |
|---|---|
| `cada_inscripcion` | nada (se cobra en cada alta nueva; un **cambio de plan** no es alta → no cobra, D18 vigente) |
| `una_vez_cada_12_meses` | un cobro de **la misma fila** (`one_time_fee_id = fee.id`) con `due_date > v_due - 365`. **Compat. seguro legado**: si la fila tiene `legacy_key='insurance_fee'`, también cuenta cualquier cobro `payment_category='seguro'` de la escuela en 365 días (= regla de hoy; cubre los 3 seguros ya emitidos sin `one_time_fee_id`). |
| `una_sola_vez_por_atleta` | un cobro de la misma fila, sin límite de fecha. ¿Cancelado cuenta? **No** (anulado = no cobrado). ¿Exonerado? ver P4. |

Pregunta de alcance del dedupe: ¿por **fila** o por **categoría** cuando el atleta cambia de plan y el plan nuevo tiene
otro «Seguro»? Propuesta: por fila + regla legado; P2 lo confirma.

- Las filas exoneradas no generan cobro; el rastro queda en `audit_logs` (acción `enrollment_fees_waived`, `new_data.waived_fee_ids` + nombres + montos).
  P4: ¿una exoneración «consume» la frecuencia (p. ej. uniforme exonerado = ya no se le cobra nunca)?
- Devuelve `uuid[]` (igual que hoy) — los ids de cobros creados.

**Función de cálculo compartida** `preview_enrollment_fees(...) RETURNS TABLE(fee_id, name, category, amount, frequency, will_charge boolean, skip_reason text)`
`STABLE SECURITY DEFINER`, solo `service_role`, misma lógica de dedupe **sin** insertar. `emit_enrollment_fees` la llama
internamente → preview y alta no pueden divergir (arregla §2.4).

### 5.3 `create_enrollment_with_payments`
- El elemento `{"kind":"enrollment_fees"}` acepta además `waived_fee_ids` (array de uuid) y `only_fee_ids`; sigue aceptando
  `waive_registration_fee` / `waive_insurance_fee`. Pasa todo a `emit_enrollment_fees` v3.
- Resto idéntico a `20261010124934`.

### 5.4 `create_one_time_charge(p_school_id, p_athlete jsonb, p_fee_id uuid, p_category text, p_amount numeric, p_due_date date, p_concept text, p_notes text, p_actor uuid, p_client_request_id uuid) RETURNS jsonb`
«Agregar cobro» (D5).
- `SECURITY DEFINER`, `search_path` fijo, **solo `service_role`**.
- Atleta debe pertenecer a la escuela (enrollment o ficha en esa escuela); `p_fee_id`, si viene, debe ser de un plan de la escuela
  (y entonces nombre/monto/categoría salen de la fila; el monto puede sobrescribirse → P6).
- `parent_id` resuelto igual que `emit_enrollment_fees` (extraer a `_resolve_payment_payer(...)` interno compartido).
- Idempotencia: `INSERT … ON CONFLICT (school_id, client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING`, y si no
  insertó, `SELECT` del existente y devolver `{payment_id, duplicated: true}`. Dos clics con el mismo `client_request_id`
  → un solo cobro, aun en paralelo.
- `due_date` no puede ser pasada (regla «un cobro nuevo nunca nace vencido»; `enrollmentFeeDueDate`). Período estampado explícito.
- `period_uniqueness_exempt = true`, `payment_type='one_time'`, `created_by = p_actor`, `notes`.
- **No** aplica dedupe por frecuencia (el personal lo pide a mano); el BFF advierte «ya tiene un Seguro este año» (consulta a
  `preview_enrollment_fees`) y pide confirmar.
- Categoría permitida: mismo subconjunto de §4.1. **No** `mensualidad` (para eso está el ciclo; evita duplicar períodos).
- Audita en `audit_logs` (`action='one_time_charge_created'`).

### 5.5 Backfill de Dreamers (y de cualquier plan con columnas > 0)
Migración de **datos** separada de la de esquema (script SQL con dry-run, idempotente por `uq_plan_otf_legacy`):
```
INSERT INTO plan_one_time_fees (school_id, offering_plan_id, name, amount, category, frequency, legacy_key, sort_order)
SELECT school_id, id, 'Inscripción', registration_fee, 'inscripcion', 'cada_inscripcion', 'registration_fee', 0
  FROM offering_plans WHERE COALESCE(registration_fee,0) > 0
UNION ALL
SELECT school_id, id, 'Seguro de accidentes', insurance_fee, 'seguro', 'una_vez_cada_12_meses', 'insurance_fee', 1
  FROM offering_plans WHERE COALESCE(insurance_fee,0) > 0
ON CONFLICT DO NOTHING;
```
Esperado hoy: **44 filas** (22 × 2), todas de Dreamers. Verificación: para cada plan, `preview_enrollment_fees` con un atleta
nuevo devuelve exactamente {120.000 inscripción, 150.000 seguro}, y con un atleta que ya tiene seguro en 365 días omite el seguro.
Los 6 cobros existentes **no se tocan** (sin `one_time_fee_id`); el dedupe legado del seguro los sigue viendo.
No se generaliza a Club Campestre Demo (sin fees en columnas → 0 filas).

### 5.6 Cuándo se eliminan las columnas
- F1: columnas quedan, escritas solo por `save_plan_one_time_fees` (espejo de las filas `legacy_key`). El BFF deja de escribirlas directo.
- F2–F5: ningún lector nuevo; se migran los lectores existentes (`CreateChildModal.tsx:327/339`, `CreateAdultAthleteModal.tsx:338/350`,
  `students-create-one.route.ts:1284`, `OfferingsManagement.tsx`, `useOfferings.ts`, `pagosUnicos.ts`, tipos generados).
- F6 (≥ 30 días después de F5 y `grep` limpio en `bff/src` + `frontend/src` + funciones vivas `pg_proc.prosrc ILIKE '%registration_fee%'`):
  migración que quita el fallback de `emit_enrollment_fees`, el espejo de `save_plan_one_time_fees` y hace
  `ALTER TABLE offering_plans DROP COLUMN registration_fee, DROP COLUMN insurance_fee`. Antes, comprobar
  `20260827172229_niv_f1_offering_plans_horas_inscripcion.sql` y `20260903103757_…` (vistas/funciones que las nombren).

---

## 6. BFF

### 6.1 Rutas
| Ruta | Rol (`requireRole`) | Zod | Notas |
|---|---|---|---|
| `GET /api/v1/offerings/plans/:planId/one-time-fees` | miembro de la escuela (`requireAuth`; filtra por `req.schoolId`) | — | Lista activa ordenada. |
| `PUT /api/v1/offerings/plans/:planId/one-time-fees` | `owner, admin, school_admin` | `OneTimeFeeListSchema` | Llama `save_plan_one_time_fees`. 400 si nombre de plan/fila choca con reglas. |
| `POST /api/v1/offerings/one-time-fees/apply` (existente, `offerings.ts:581`) | igual | v2: `{ plan_ids, fees: OneTimeFee[] , mode: 'replace' \| 'merge' }`; acepta el body viejo (`registration_fee`/`insurance_fee`) y lo traduce a filas `legacy_key` | Llama `apply_one_time_fees_to_plans`. |
| `POST /students/create-one` (existente) | igual que hoy | `+ waived_fee_ids: z.array(uuid).max(20).optional()`, `+ charge_fee_ids` (modo sugerir) | Sigue aceptando `waive_registration_fee`/`waive_insurance_fee`. |
| `POST /enrollments` (existente) | igual que hoy; **coach no puede** exonerar ni asignar plan (ya da 403 al plan) | igual | Pasar a `create_enrollment_with_payments` (hoy hace inserts sueltos + `emitEnrollmentFees` aparte → no atómico, viola D3). |
| `POST /students/first-payment-preview` (existente) | igual | `+ waived_fee_ids`, `+ athlete` (para dedupe) | Devuelve `fees: [{id,name,category,amount,will_charge,skip_reason}]` desde `preview_enrollment_fees`; mantiene `fees.registration_fee/insurance_fee` como derivados durante la convivencia. |
| `POST /api/v1/athletes/:athleteType/:athleteId/charges` (nuevo, «Agregar cobro») | `owner, admin, school_admin` + **staff con permiso de finanzas** (P9). Coach **no** (memoria `project_coach_permissions_audit`: el BFF es el único gate). | `{ fee_id?: uuid, category: enum(subconjunto §4.1), amount: number>0 ≤ 20.000.000, due_date: YYYY-MM-DD ≥ hoy, concept: 1..120, notes?: ≤500, client_request_id: uuid }` | Llama `create_one_time_charge`. 200 con `duplicated:true` en reintento. |
| `GET /api/v1/athletes/:athleteType/:athleteId/charges/suggestions` | igual | — | Filas de la lista de su plan activo con `will_charge` + motivo (para el selector de «Agregar cobro»). |

`athleteType ∈ child|adult|unregistered` (mismo `athleteColFor`). Todas validan que el atleta pertenezca a `req.schoolId`
antes de llamar la RPC (la RPC lo vuelve a validar).

### 6.2 Servicios
- `enrollmentBilling.ts`: `emitEnrollmentFees` acepta `waivedFeeIds` / `onlyFeeIds`; `EnrollmentFeeWaivers` se mantiene y se traduce;
  `cancelWaivedFeeRows` se elimina en F2 (la migración de exoneración ya estará viva). `ONE_OFF_PAYMENT_CATEGORIES` = 8 categorías;
  `PLAN_PERIOD_CHARGE_FILTER` + `one_time_fee_id.is.null`.
- `utils/pagosUnicos.ts`: mensaje de `PAGO_UNICO_NO_ES_PLAN_MSG` → «…configúralos en "Pagos únicos" del plan». Se mantiene el bloqueo de nombres.
- Lectura de `school_settings.one_time_fees_mode` en create-one / enrollments / intake.

### 6.3 Pruebas de BFF (vitest, sin red)
Espejo de `offerings.pagos-unicos.test.ts` y `students-create-one.fee-waivers.test.ts`: traducción `waive_*` → ids; modo sugerir;
coach 403 en `PUT …/one-time-fees` y en `POST …/charges`; `client_request_id` repetido → mismo id; categoría `mensualidad` → 400;
`due_date` pasada → 400; atleta de otra escuela → 404.

---

## 7. Frontend

### 7.1 Editor de plan (`OfferingsManagement.tsx`)
- El bloque «Pagos únicos» (`:1138`) pasa de 2 inputs fijos a **lista editable**: filas `[Nombre] [Monto] [Categoría ▾] [Frecuencia ▾] [🗑]`
  + «Agregar pago único». Categorías con etiqueta humana: Inscripción, Seguro, Uniforme / artículos, Torneo, Viaje, Vacacional, Otro.
  Frecuencias: «En cada inscripción», «Máximo una vez cada 12 meses», «Una sola vez por atleta».
- Plantillas rápidas: «Inscripción» (cada inscripción), «Seguro de accidentes» (12 meses), «Uniforme» (una sola vez).
- Resumen en la tarjeta del plan (`:1745`): `resumenPagosUnicos` recibe la lista (`+ $120.000 Inscripción · + $150.000 Seguro (único)`).
- «Aplicar a todos» (`:1459`): aplica la lista completa a los planes marcados (`replace` o `merge`, con confirmación que muestra qué
  planes cambian). Sigue limitado a `esTarifaMensualActiva`.
- Guardado vía BFF (`PUT …/one-time-fees`), nunca `supabase.from(...).update` directo.

### 7.2 Formulario de alta (`CreateChildModal.tsx`, `CreateAdultAthleteModal.tsx`)
- Hoy leen `registration_fee`/`insurance_fee` directo de `offering_plans` (`:327`, `:338`). Pasan a pedir el preview al BFF con el
  atleta (si ya existe) para traer `will_charge` y motivos («ya pagó seguro el 2026-03-02»).
- Una casilla por fila: modo `auto` → marcadas («No cobrar» = desmarcar); modo `sugerir` → desmarcadas.
- Los checkboxes de exoneración que se están agregando para los dos fees fijos se convierten en las dos primeras filas de la lista
  (mismo componente `FeeWaiverRow`, ahora iterado) — la UI no cambia para Dreamers.
- Resumen: «Primer cobro: mensualidad $X + Inscripción $120.000 + Seguro $150.000 = **$Y**», calculado **por el BFF**.

### 7.3 Ficha del atleta — «Agregar cobro»
- Botón en la pestaña de pagos de la ficha (personal con permiso). Diálogo: pestaña «Del plan» (sugerencias con aviso de dedupe) /
  «Otro cobro» (categoría, monto, vencimiento, concepto, nota).
- `client_request_id = crypto.randomUUID()` generado **al abrir** el diálogo (no al hacer clic), botón deshabilitado mientras envía.
- Tras crear: invalidar las queries de pagos de la ficha, de cartera y de pagos de la escuela.

### 7.4 Vistas del acudiente / atleta
- Sus pagos y checkout muestran cada pago único como fila propia con su concepto y categoría (ver Integraciones §9).
- El tipo `paymentCategory` del checkout debe incluir `seguro` (hoy no).
- Página pública / QR: si P3 = sí, mostrar «Al inscribirte: + Inscripción $…, + Seguro $…».

---

## 8. Caminos de alta: ¿cobran los pagos únicos?

| # | Camino | Dónde | Hoy cobra inscripción/seguro | Propuesto |
|---|---|---|---|---|
| 1 | Alta de menor / adulto / no registrado / atleta existente (4 ramales) | `POST /students/create-one` → `altaConCobros` → `create_enrollment_with_payments` (`students-create-one.route.ts:430-525`) | Sí, atómico | Sí, lista + exoneración por fila + modo sugerir. |
| 2 | Asignar plan desde la ficha / modal de planes | `POST /enrollments` (`enrollments.ts:92`, insert suelto `:647` + `emitEnrollmentFees` `:678`) | Sí, **no atómico** | Sí, migrar a `create_enrollment_with_payments` (D3). |
| 3 | Cambio de plan | `PUT /students/:id`, `POST /enrollments/assign-plan` (`:881`), `PATCH /enrollments/:id` | No (D18) | No. Solo «Agregar cobro» si la escuela quiere. |
| 4 | Alta por foto de hoja de matrícula (WhatsApp / inbox) | `enrollment-intake.routes.ts` → mismo `POST /students/create-one` | Sí (vía #1) | Sí, igual que #1; en modo `sugerir` el revisor marca. |
| 5 | QR / enlace de inscripción | `submit_qr_signup` (frontend `JoinSchoolPublicPage.tsx:397`, rol `authenticated`; versión 13 args solo service_role) | **No** (no lee fees) | **F4**: modo `auto` → llamar `emit_enrollment_fees` dentro de la RPC **solo si la inscripción nace `active`**; si nace `pending` (QR con aprobación), cobrar al **aprobar** (camino #2/#1). Modo `sugerir` → no cobra. Dreamers tiene 0 QR. |
| 6 | Invitación aceptada | `accept_invitation_pro` | No | No (inscribe una ficha que ya pasó por #1). |
| 7 | Clase de prueba → conversión | `trial_class_*_create` crean la clase; «convertida» es solo estado (`trial-classes.ts:156`); la inscripción real va por #1/#2 | Vía #1/#2 | Sí, vía #1/#2. Las RPCs de prueba no cobran pagos únicos. |
| 8 | Cortesía (agenda pública) | `public-booking.routes.ts:861` (insert directo, plan «Cortesía (1 clase)») | No | No (plan de precio 0, no es alta real). |
| 9 | Importación masiva de menores (CSV) | `POST /students` bulk (`students.ts:109`, inserts `:473`) | No | No por defecto (son atletas ya inscritos en papel). Opción futura «cobrar pagos únicos a los importados» → P10. |
| 10 | Migración de atletas no registrados con pagos históricos | `athletes/bulkUpload.ts:88` | No | No (histórico). |
| 11 | Autoinscripción legacy desde la app | `PendingEnrollmentModal.tsx:52`, `usePrograms.ts:78` (insert directo desde el cliente) | No | No; además es deuda: inserts de `enrollments` desde el cliente. Fuera de alcance, registrar en P11. |
| 12 | `process_enrollment_checkout`, `submit_enrollment(_v2)`, `enroll_student`, `claim_child_for_parent` | RPCs; checkout deshabilitado desde 2026-10-05 (`frontend/src/lib/api/checkout.ts`) | No | No. `submit_enrollment(_v2)` siguen con `EXECUTE` a `authenticated` → verificar callers (0 en `frontend/src`) y revocar en otra rama. |

---

## 9. Integraciones (todo lo que toca cobros)

Requisito del usuario: los pagos únicos quedan conectados con **todos** los componentes que tocan cobros.
Auditoría de lectura 2026-10-10 (archivo:línea). Rutas BFF relativas a `bff/src/`; frontend a `frontend/src/`.

**Hallazgo transversal.** Casi nadie lee `payment_category`: clasifican el cobro por **regex sobre el concepto**
(que reconoce inscripción pero no siempre seguro/artículos) o por `payment_type` (que **no** separa mensualidad
de pago único: medido hoy, de 1.284 cobros abiertos, **5 mensualidades** tienen `payment_type='one_time'` y **69**
cobros abiertos tienen categoría NULL y tipo `one_time`). Ya existe el clasificador correcto:
`categoriaDeCobro(payment_category, concept)` en `services/payment-accounts.ts:138` (categoría primero, concepto
de respaldo). **Regla del spec:** todo componente decide «¿es mensualidad?» con `categoriaDeCobro(...)` (BFF) o su
espejo `chargeCategoryOf` en `lib/payment-accounts.ts` alimentado con `payment_category` real, y en SQL con
`es_pago_unico(...)` (§4.4). Una sola lista de categorías en BFF (`CATEGORIAS_COBRO`, completa) y su espejo en
frontend (`CHARGE_CATEGORIES`, `lib/payment-accounts.ts:50` — **hoy le faltan** `clase_extra, vacacional, viaje`;
`parsePaymentAccounts` las borra de `only_for` al guardar, `:185`).

Convención de las tablas: **Hoy** = qué hace con un cobro único `inscripcion`/`seguro` pendiente · **Debe** · **Prueba**.

### 9.1 WhatsApp

| Componente | Hoy | Debe | Prueba |
|---|---|---|---|
| «¿Cuánto debo?» / estado de cuenta del bot — RPC `wa_get_payment_status` (`supabase/migrations/20260911184400_whatsapp_pagos_vistos_y_aviso_resultado.sql:56-67`), texto `services/whatsapp-bot.service.ts:4936` | Lo **incluye** (filtra solo por `parent_id`, escuela, estado), listado por `concept`. No devuelve categoría → el modelo no distingue mensualidad de seguro. **Cobro con `parent_id` NULL no aparece** (menor sin acudiente vinculado: los 6 de Dreamers). | Devolver `payment_category`; respuesta agrupada «Mensualidad … / Pagos únicos: Inscripción $…, Seguro $…». Fallback por `child_id` de los hijos del que escribe (igual que `MyPaymentsPage`). | vitest del formateo + prueba real en escuela QA: acudiente con mensualidad + seguro pendientes pregunta «cuánto debo» → ve ambos con su nombre. |
| Enlaces «Pagar» — `services/whatsapp-enlaces-de-pago.service.ts:79,110-117`; medios de pago `services/whatsapp-medios-de-pago.service.ts:77-85` | Genera enlace para cualquier tipo. `mediosDePago` se llama **sin categoría** → las llaves `only_for` (Nequi de inscripciones de Dynasty) nunca se ofrecen. | Seleccionar `payment_category`, pasar `categoriaDeCobro(...)` por cobro a enlace y medios. | vitest: cobro `inscripcion` + llave `only_for:['inscripcion']` → se ofrece; cobro mensualidad → no. |
| Elegir a qué cobro aplica un comprobante — `services/whatsapp-receipt-matching.service.ts:47-53,74,103`, `services/whatsapp-recuperacion.service.ts:551-555`, `jobs/whatsapp-queue.job.ts:93,763,788,819`, `services/whatsapp-otro-concepto.service.ts:23-30,47-55` | `OtroConcepto` reconoce inscripción, uniforme, torneo, viaje… **pero no `seguro` ni `articulos`**. Pie de foto «seguro» no da pista → cae a match por monto; con **un solo** pendiente se aplica automático (`:103`) → **un comprobante del seguro puede aplicarse a la mensualidad**. | Agregar `seguro` y `articulos` a `OtroConcepto`/`PATRONES`; `payment_category` en `PagoPendiente` y en ambos selects; `conceptoDelCobro` delega en `categoriaDeCobro`. Con 2+ pendientes de categorías distintas y monto ambiguo → a revisión humana, nunca automático. Match exacto por monto contra la fila del pago único (120.000 ≠ mensualidad). | vitest de `elegirPorPista` / `resolverPago`: (a) pie «seguro» + seguro y mensualidad pendientes → seguro; (b) monto = 150.000 → seguro; (c) monto que no casa con ninguno → revisión. QA real: enviar comprobante de prueba a la línea de la escuela QA. |
| Aviso de resultado — `jobs/whatsapp-payment-outcome.job.ts:154-161,265` | Seguro/artículos pagado → plantilla `pago_confirmado` que dice «por la mensualidad de…» (**mal rotulado**). Inscripción sí sale bien. | `payment_category` en `COLUMNAS_PAGO`; decidir con `categoriaDeCobro(cat, concept) !== 'mensualidad'` → `pago_recibido_otro_concepto`. | vitest de `plantillaDelDesenlace` con las 3 categorías. |
| Recordatorios — `services/recordatorios-cobro.service.ts:371-376` | `.eq('payment_type','subscription')`: los pagos únicos **nunca** se recuerdan (y tampoco las 5 mensualidades `one_time`). | Segunda consulta para `es_pago_unico` con plantilla neutra nueva (`recordatorio_*_otro_concepto`, variable `conceptoPago`); la de mensualidad filtra por **categoría** (`categoriaDeCobro = 'mensualidad'`), no por `payment_type`. Plantillas nuevas requieren aprobación de Meta → **fase propia** (F5). | vitest de selección; QA: dry-run del job sobre escuela QA lista el seguro con la plantilla neutra. |
| Informe de cartera — `services/informe-cartera.service.ts:228-232,368-369,639-640` | Sin filtro de tipo: incluye todo en `total`; `esMensualidad` usa la categoría → seguro va a «otros». Respaldo por concepto sin `seguro`. | Cambiar `esMensualidad` por `categoriaDeCobro(...) === 'mensualidad'`; desglose «otros» por categoría (Inscripción, Seguro, Uniforme). | vitest del agrupado. |
| Resumen diario — `jobs/whatsapp-resumen-diario.job.ts:193` | No consulta pagos (el `'inscripcion'` es intención del prospecto). | Nada. | — |
| Plantillas — `services/whatsapp-plantillas.service.ts:88-130,126,140` | Todas las de recordatorio, `pago_confirmado` y `abono_recibido` dicen «la mensualidad». Solo `pago_recibido_otro_concepto` es neutra. | Variantes neutras `abono_recibido_otro_concepto` y recordatorios `*_otro_concepto`; elegir con `categoriaDeCobro`. | Test de que ningún envío con categoría ≠ mensualidad usa una plantilla con «mensualidad» en el texto. |
| Venta suelta por WhatsApp — `services/ventas-servicios.service.ts:209` (`wa_crear_cobro_suelto`) | Ya crea cobros sueltos idempotentes por llave. | Reutilizar su patrón de idempotencia en `create_one_time_charge`; sin cambio funcional. | — |

### 9.2 Pasarelas y checkout

| Componente | Hoy | Debe | Prueba |
|---|---|---|---|
| Wompi — enlace con monto `services/wompi-link-con-monto.service.ts:78-81` → `services/cobro-enlace-publico.service.ts:519-547`; webhook `routes/wompi.ts:346,395-465` | Cobra cualquier pendiente/vencido, sin filtro de categoría; candado de pagador `parent_id || user_id` (con `parent_id` NULL en un menor usa `user_id` NULL → el candado se salta; revisar). Webhook marca pagado sin mirar categoría; tiene guard de doble pago. `cobro-enlace-publico.service.ts:395` **ya** pasa `payment_category` a llaves. | Sin cambio funcional para pagos únicos. Garantizado por §4.4 que pagarlos no da vigencia. Revisar el candado con `parent_id` NULL (crear `parent_id` correcto es la defensa real). | QA sandbox Wompi (escuela QA): pagar un seguro → `paid`, `expires_at` igual, mensualidad intacta. |
| Vigencia — `fn_extend_enrollment_on_payment_paid` (`supabase/migrations/20261005221944_fn_extend_vigencia_viva_mas_cobros_unicos.sql:42-45`) | Excluye solo `inscripcion, seguro, excedente`. **`articulos, torneo, otro, clase_extra, vacacional, viaje` y NULL con `offering_plan_id` dan vigencia al pagarse.** | `es_pago_unico(...)` (§4.4). Además todo cobro de la lista lleva `one_time_fee_id`. | SQL `_smoke`: pagar cobro `otro` con `one_time_fee_id` y plan → `expires_at` no cambia. |
| Mercado Pago / connected accounts — `routes/payments.routes.ts:95-144`; webhook `routes/mercadopago.ts:430-456` | Sin filtro de categoría (bien). **Fuera de alcance pero grave:** el webhook no tiene guard de doble pago y escribe `payment_method:'mercadopago'`, valor que `payments_payment_method_check` no acepta según `wompi.ts:439-441`; el `.update` no revisa el error → podría estar fallando en silencio. | Ticket aparte (P12). Para pagos únicos: nada. | Verificar en BD el CHECK de `payment_method` antes de abrir el ticket. |
| Factus Pay — `services/factus-pay.service.ts:21-22,154` | Solo cliente API; no está cableado a cobros de escuela. | Nada ahora; cuando se cablee, acepta cualquier categoría. | — |
| Lista de pagos del acudiente — `pages/MyPaymentsPage.tsx:212-226` (`payments_with_installments`, `parent_id = yo OR child_id ∈ mis hijos`); atleta adulto `lib/athlete/queries.ts:156` (`get_athlete_payments`) | Muestra los pagos únicos (sin filtro de tipo), también con `parent_id` NULL si el `child_id` es de sus hijos. | Mostrar etiqueta de categoría («Pago único · Seguro») y agrupar «Pagos únicos» bajo la mensualidad. Pasar `p.payment_category` al checkout (`:505`, `:592`, `:812-825`). | Playwright (escuela QA, acudiente QA): ve mensualidad + inscripción + seguro con su rótulo y paga uno. |
| `PaymentCheckoutModal` (`components/payment/PaymentCheckoutModal.tsx:81,105,298,367-372`) | Unión `paymentCategory` **sin `seguro`**; en modo update calcula llaves con `chargeCategoryOf(null, concept)` (ignora la categoría real) → un seguro cuyo concepto no diga «seguro» no ve llaves `only_for`. | Agregar `seguro` (y las 10 categorías del CHECK) a las uniones; prop `paymentCategory` opcional y usarla antes del concepto. | vitest del componente: categoría `seguro` + llave `only_for:['seguro']` → visible. |
| `ParentCheckoutPage` (`pages/ParentCheckoutPage.tsx:208,286-292`) | `chargeCategoryOf(null, concept)`. | Seleccionar `payment_category` y usarla. | Igual que arriba. |
| Débito automático — `autopay_plan_cycles` (`supabase/migrations/20261005133733_autopay_f1_base.sql:663-677`), `routes/autopay.routes.ts:238,507,654`, `services/autopay.service.ts:238,251-303,713-720` | Solo `payment_category='mensualidad'` con período → los pagos únicos **nunca** se debitan. Textos fijos «mensualidad de <período>». | **Propuesta: no debitar pagos únicos en esta fase** (el acudiente autorizó débito de mensualidad; cobrarle 150.000 de seguro sin aviso es otra autorización). Si la escuela lo pide → flag `autopay_includes_one_time` + copy + tope `max_amount` (P13). | Test de regresión: autopay con seguro pendiente no lo toma. |
| Enrutamiento de llaves por categoría — BFF `services/payment-accounts.ts:20,138-158`; frontend `lib/payment-accounts.ts:50-51,82-97,126,185-186`; editor `components/payment/PaymentAccountsEditor.tsx:149-171` | BFF completo. Frontend sin `clase_extra/vacacional/viaje` (y los borra de `only_for` al guardar). El editor tiene **una sola casilla «solo inscripciones»**; `seguro` no se puede elegir; al marcarla **sobrescribe** `only_for` con `['inscripcion']`. | Multiselección de categorías en el editor; sincronizar `CHARGE_CATEGORIES` con BFF; test espejo BFF↔frontend de la lista. Dynasty (única con `only_for`) debe conservar `['inscripcion']` tras guardar. | vitest espejo; Playwright: llave «solo Seguro» aparece al pagar el seguro y no al pagar la mensualidad. |

### 9.3 Manual (personal de la escuela)

| Componente | Hoy | Debe | Prueba |
|---|---|---|---|
| «Registrar pago» — `components/payment/RegisterCashPaymentModal.tsx:240-245,381,411-459`; entrada `pages/SchoolStudentsManagementPage.tsx:263,1323` | Escribe directo desde el navegador. Puede saldar un seguro pendiente (el selector lista todo). Si crea un pago nuevo lo inserta ya `paid`, `one_time`, **sin `payment_category`**. Idempotencia débil (`CASH-${Date.now()}`): doble clic sin período ni comprobante = duplicado. | Selector de categoría (default = la del cobro elegido) y estampar `payment_category`; rótulo de categoría en el selector de pendientes. Mover a BFF con `client_request_id` queda como deuda (P14) — no bloquea este spec. | Playwright (escuela QA): registrar pago en efectivo de un seguro pendiente → ese cobro `paid`, mensualidad intacta. |
| «Agregar cobro» | **No existe** para pendientes sueltos (solo `excedente` vía `routes/attendance.ts:1923` y ventas por WhatsApp). | §5.4 + §6.1 + §7.3. | Concurrencia §10.3 + Playwright. |
| Aprobación de comprobante — `components/payment/ApprovePaymentMethodSheet.tsx:126` → `lib/approvePayment.ts:80-92` | **Aprobar cualquier cobro completo activa las inscripciones `pending` del atleta.** Aprobar solo el seguro o la inscripción de un alta por QR pendiente activa la inscripción con la mensualidad sin pagar. | Activar solo si el cobro aprobado **no** es pago único (`!isOneOffCharge` con la lista ampliada, o mover la activación al mismo guard SQL de vigencia). | vitest de `approvePayment` con categoría `seguro` → no actualiza `enrollments`. |
| Rechazo — `reject_payment_receipt` (`supabase/migrations/20261008165728_rechazo_comprobante_conserva_deuda.sql:129-260`) | Sin lógica de categoría; el cobro vuelve a pendiente/vencido. | Nada. | — |
| Validador de comprobantes (OCR) — `services/receipt-context.service.ts:41-50`, `services/receipt-verdict.ts:320-335`; frontend `hooks/useReceiptValidator.ts:103` | Usa categoría (con respaldo por concepto) para `only_for`; llave restringida a otra categoría → amarillo. Frontend sin `clase_extra/vacacional/viaje`. | Sincronizar la lista del hook. Monto esperado = monto de **la fila** (el seguro no se compara contra la mensualidad). | vitest: comprobante a la llave de inscripciones contra un seguro → amarillo; contra una inscripción → verde. |
| Conciliación bancaria — `reconcile_statement` (`supabase/migrations/20260723000001_bank_reconciliation.sql:155`) | Concilia cualquier `paid` sin mirar categoría. | Nada (correcto). | — |
| Ficha del atleta / cartera del personal — `pages/SchoolStudentsManagementPage.tsx:1168-1188` (`groupOpenDebtByAthlete`, `lib/paymentCartera.ts:91`), `pages/PaymentsAutomationPage.tsx:1062,1084`, `FinancialSummaryCards` / `OverdueAccountsCard` | La deuda abierta **incluye** pagos únicos (a propósito); automatización los separa como `one_off_due`. `isOneOffCharge` no cubre `articulos, torneo, otro`… → pueden tomarse como «el cobro del mes». No hay pestaña de pagos en la ficha. | Ampliar `ONE_OFF_CHARGE_CATEGORIES` en ambas librerías a «todo lo que no es mensualidad» + `one_time_fee_id`. Pestaña/sección «Pagos» en la ficha con «Agregar cobro». | vitest de `groupOpenDebtByAthlete` y del selector «cobro del mes». |

### 9.4 Contabilidad, correos, mora, acceso, tableros

| Componente | Hoy | Debe | Prueba |
|---|---|---|---|
| Contabilidad / CSV — `lib/accounting/csv.ts:78-81`, `pages/AccountingPage.tsx:322`; SQL `COALESCE(payment_category,'sin_categoria')` (`supabase/migrations/20261003202419…:77`) | Rotula seguro, inscripción, excedente; **sin rótulo** `clase_extra, vacacional, viaje` (sale la llave cruda). | Mapa de rótulos completo (una fuente compartida). Columna «Concepto del pago único» = nombre de la fila. | vitest del CSV con las 10 categorías. |
| Facturación electrónica (Factus) — `services/invoicing.service.ts:169-173,413,437,517-524,1316-1350` | Factura **todo** `paid`, pagos únicos incluidos; impuesto por configuración del proveedor, **no por categoría** → seguro y uniforme se gravan igual que la mensualidad. | Mapa de impuesto por categoría en `taxDefaults` (p. ej. seguro = excluido/tercero; uniforme = IVA 19 %) + `payment_category` en el select de `:437`. **Decisión tributaria de la escuela/contador** (P15). Mientras no se decida: sin cambio. | vitest de la línea de factura por categoría (cuando haya decisión). |
| Estado de cuenta mensual por correo — `services/estado-de-cuenta.service.ts:457-460,535,664-666` | Incluye pagos únicos abiertos (bien). Solo se dispara si hay mensualidad del mes (`:535`). Medios de pago con `categoria:'mensualidad'` fijo → la llave de inscripciones no aparece aunque el estado liste una inscripción. | Medios de pago por categoría presente en el estado (unión de llaves aplicables). Disparo: también si hay pagos únicos nuevos del mes (P16). | vitest del armado. |
| Correos de ciclo de pago — `jobs/payment-lifecycle-emails.job.ts:309,382` | «Cobro creado» solo `payment_type='subscription'` → **un seguro/inscripción nueva nunca avisa**. «Vencido» sin filtro → sí avisa. | «Cobro creado» para pagos únicos con plantilla neutra (un correo por alta que agrupe mensualidad + pagos únicos, para no mandar 3 correos). Cambiar el filtro de `payment_type` a categoría. | vitest del job. |
| Mora — `apply_late_fees` (`supabase/migrations/20261005214253…:244-370`) | **Sin filtro de categoría**: un seguro vencido pasa a `overdue` y recibe recargo de mora. | Por defecto **no** aplicar recargo a pagos únicos (`NOT es_pago_unico(...)`); flag por escuela si alguna lo quiere (P17). Dreamers: hoy tiene mora regla día 5 / gracia 0 → **sería un cambio de comportamiento** si sus seguros vencidos ya recibieran recargo; medir antes (0 seguros vencidos hoy). | SQL `_smoke`: seguro vencido no recibe `late_fee_amount`. |
| Vencimiento de inscripción — `fn_expire_overdue_enrollments` (mismo archivo, `:136-215`) | Basado en `expires_at`; un pago único impago no vence la inscripción. | Nada. | — |
| Torniquete — `routes/access-adms.ts:453-467`; `jobs/access-auto-block.job.ts:68-72` | Mira el **último cobro creado** de cualquier categoría: un seguro vencido más reciente que la mensualidad **bloquea**; un pago único pagado más reciente **esconde** una mensualidad vencida. El auto-bloqueo bloquea con cualquier `overdue`. | Decidir por mensualidades (`PLAN_PERIOD_CHARGE_FILTER` ampliado) **salvo** decisión de producto (P18: ¿un seguro impago bloquea?). Propuesta: no bloquea. | vitest de `access-adms` con los dos órdenes de creación. |
| Tableros de ingresos (las tres agregaciones) — vista `cash_ledger` y RPC `school_payment_kpis` (`supabase/migrations/20261003202419…:134-149,175-232`), `hooks/useDashboardStatsReal.ts:116,129,308` | Incluyen todas las categorías (bien); KPIs desglosan `articulos`/`torneo` pero no `inscripcion`/`seguro`. | Agregar `revenue_inscripcion`, `revenue_seguro`, `revenue_otros_unicos` (FILTER) al RPC; la tarjeta muestra «Mensualidades / Pagos únicos». | SQL `_smoke`: suma de desgloses = total. |

---

## 10. Pruebas de concurrencia (fase backend, SQL `_smoke` + vitest)

1. **Doble alta simultánea del mismo atleta** (dos sesiones, `create_enrollment_with_payments` con la misma persona y plan con seguro 12 meses):
   el advisory lock serializa; resultado = 1 enrollment o 409, y **un solo** seguro.
2. **Alta + «Agregar cobro» del seguro en paralelo** para el mismo atleta: la RPC de alta ve el cobro manual (mismo lock en
   `create_one_time_charge`) → el seguro de la lista se omite por dedupe (o, si P2 decide por fila, documentar el resultado esperado).
3. **Doble clic en «Agregar cobro»**: 2 llamadas concurrentes con el mismo `client_request_id` → 1 fila, la segunda devuelve `duplicated:true`.
   Con `client_request_id` distinto → 2 filas (es intencional).
4. **Guardar la lista mientras se inscribe**: `save_plan_one_time_fees` (FOR UPDATE del plan) vs `emit_enrollment_fees` (lee la lista):
   el alta cobra la lista vieja **o** la nueva completa, nunca mezcla (lectura en una sola sentencia dentro de la transacción).
5. **`una_sola_vez_por_atleta` con dos planes**: dos altas concurrentes en planes distintos que comparten fila por `legacy_key`/categoría (según P2).
6. **Cancelar un cobro único y re-inscribir**: el cancelado no cuenta para el dedupe → vuelve a cobrarse.
7. **Pagar un cobro con `one_time_fee_id` y categoría `otro`**: `expires_at` del enrollment **no** cambia; `open_month` sigue emitiendo la mensualidad.

## 11. Plan de QA (solo escuelas de prueba; una sola base para todos los ambientes)

Escuelas: **Club Campestre Demo** (`25a123f0-…`) y la escuela QA de Athletic League (`qa.athletic@sportmaps.co`, memoria). **Nunca Dreamers
para escribir**: en Dreamers solo verificación de lectura (preview con atleta ficticio no persistido, conteo de filas del backfill).

Regla: los ambientes (dev/stg/prod) comparten base. «Ambiente» aquí = **qué BFF/frontend** se ejerce
(dev para F1–F3, staging antes de prod), siempre sobre escuelas de prueba. Pruebas Wompi solo en sandbox.
Antes y después de cada corrida: snapshot de `payments`/`enrollments`/`plan_one_time_fees` de la escuela de prueba
(conteo por categoría y estado) para detectar efectos colaterales. No borrar datos de prueba (los borra el usuario).

### 11.1 Flujos reales
| # | Flujo | Dónde | Esperado |
|---|---|---|---|
| Q1 | Backfill en lectura | Dreamers (solo SELECT) | 44 filas, 22 planes × {Inscripción 120.000 cada_inscripcion, Seguro 150.000 12 meses}; `PGP4x1`, `CPP1x1`, `CPG1x2` sin filas. |
| Q2 | Paridad Dreamers | `preview_enrollment_fees` con ids de atletas de Dreamers (lectura) | Igual a lo que cobraba `emit_enrollment_fees` v2 (incluido: atleta con seguro de 2026-10-10 → seguro omitido). |
| Q3 | Configurar lista | Club Campestre Demo, editor de plan (dev) | Crear Inscripción + Seguro + Uniforme (una sola vez); «Aplicar a todos» a 3 planes; coach no ve el botón (403 en BFF). |
| Q4 | Alta de menor con acudiente | Campestre, `CreateChildModal` | 1 enrollment + mensualidad + 3 pagos únicos, todos con `parent_id` del acudiente, `one_time_fee_id`, exentos; resumen = suma real. |
| Q5 | «No cobrar» | Campestre, alta con Uniforme desmarcado | 2 pagos únicos; `audit_logs.enrollment_fees_waived` con el id del uniforme. |
| Q6 | Re-alta en < 12 meses | Campestre, mismo atleta, cancelar y re-inscribir | Inscripción sí, seguro no (dedupe), uniforme no (una sola vez). Preview lo anuncia con motivo. |
| Q7 | Modo sugerir | Campestre con `one_time_fees_mode='sugerir'` | Casillas desmarcadas; sin marcar = 0 pagos únicos; QR no cobra. Volver a `auto` al terminar. |
| Q8 | «Agregar cobro» | Campestre, ficha del atleta | Desde lista y libre; doble clic = 1 cobro; `created_by` = quien lo hizo; `due_date` pasada rechazada. |
| Q9 | Acudiente paga | acudiente QA (Athletic League) / Campestre, `MyPaymentsPage` → Wompi sandbox | Ve cada pago único rotulado; paga el seguro → `paid`, `expires_at` igual; aviso WhatsApp neutro, no «mensualidad». |
| Q10 | Llave por categoría | Campestre: llave `only_for:['seguro']` | Aparece al pagar el seguro (checkout, bot, estado de cuenta); no en la mensualidad. Validador: comprobante a esa llave contra mensualidad → amarillo. |
| Q11 | Comprobante por WhatsApp | línea de la escuela QA | Pie «seguro» con seguro + mensualidad pendientes → se aplica al seguro. |
| Q12 | Aprobación | Campestre, inscripción `pending` por QR con seguro + mensualidad | Aprobar solo el seguro **no** activa la inscripción; aprobar la mensualidad sí. |
| Q13 | Mora / torniquete | Campestre, seguro vencido (due_date de prueba) | Sin recargo; el torniquete no bloquea por el seguro (si P18 = no bloquea). |
| Q14 | Tableros / CSV / cartera | Campestre | Desglose Mensualidades / Pagos únicos suma el total; CSV rotula las 10 categorías; informe de cartera separa seguro en «otros». |
| Q15 | Regresión «sin lista» | escuela QA sin pagos únicos | Alta idéntica a hoy (0 pagos únicos, mismo total). |
| Q16 | Seguridad | `npm run seguridad:invariantes`; `set local role anon` sobre `plan_one_time_fees`; JWT simulado de acudiente intentando INSERT/UPDATE | Sin críticos; anon 0 filas (o solo activas si P3 = sí); acudiente 0 escrituras. |

Automatización: los casos Q3–Q12 como specs Playwright TypeScript (no scripts sueltos); concurrencia (§10) como `_smoke` SQL + vitest.

## 12. Fases (una rama por fase desde `develop`, revisión entre cada una)

**F0 · Base de categorías (prerrequisito, sin cambio de UI)** — rama `feat/pagos-unicos-f0-base`
- Aplicar `20261010124934` (exoneración) si aún no está viva — es del trabajo en curso; verificar firma de 11 args.
- Migración: `es_pago_unico(...)`; `fn_extend_enrollment_on_payment_paid` y `open_month` la usan (unifica las 3 listas; cierra `otro`/`articulos` dando vigencia). Medir antes cuántos `paid` con plan y categoría `articulos|torneo|clase_extra|vacacional|viaje` existen (pagos futuros solamente, no recalcula).
- BFF/frontend: `ONE_OFF_PAYMENT_CATEGORIES` (8), `CHARGE_CATEGORIES` completo en frontend, `isOneOffCharge` ampliado, test espejo BFF↔frontend↔SQL.
- `approvePayment.ts`: no activar inscripción al aprobar un pago único (§9.3).
- Pruebas: `_smoke` vigencia + vitest. **Radio:** comportamiento de pago de categorías no-mensualidad con plan (medido en la base).

**F1 · Esquema + backfill (sin cambio visible)** — `feat/pagos-unicos-f1-esquema`
- `plan_one_time_fees` + RLS + GRANTs + trigger de coherencia; columnas nuevas de `payments`; `school_settings.one_time_fees_mode` (default `auto`).
- RPCs `save_plan_one_time_fees`, `apply_one_time_fees_to_plans` (con espejo a columnas), `preview_enrollment_fees`, `emit_enrollment_fees` v3 (lista primero, fallback columnas, traducción `waive_*`), `create_enrollment_with_payments` acepta `waived_fee_ids`.
- Script de backfill con dry-run (44 filas Dreamers). Ledger: `npm run migrations:new -- pagos_unicos_lista`.
- Pruebas: concurrencia §10.1, §10.4–§10.7; Q1, Q2, Q15, Q16. **Criterio de salida:** Dreamers cobra byte a byte igual (concepto, monto, categoría, `parent_id`, dedupe).

**F2 · Editor de plan + alta** — `feat/pagos-unicos-f2-alta`
- BFF: `GET/PUT …/one-time-fees`, `apply` v2, create-one/enrollments/preview con `waived_fee_ids`; `POST /enrollments` pasa a `create_enrollment_with_payments` (atómico); quitar `cancelWaivedFeeRows`.
- Frontend: lista en `OfferingsManagement`, filas «No cobrar» en ambos modales, resumen desde el BFF, modo sugerir.
- Pruebas: Q3–Q7, vitest de rutas. **Criterio:** los checkboxes de inscripción/seguro existentes se ven igual en Dreamers.

**F3 · «Agregar cobro» + vistas** — `feat/pagos-unicos-f3-agregar-cobro`
- RPC `create_one_time_charge`, rutas `…/charges` y `…/suggestions`, diálogo en la ficha, sección «Pagos» en la ficha.
- Vistas del acudiente (rótulo, agrupado), checkout con `paymentCategory` real (`PaymentCheckoutModal`, `ParentCheckoutPage`, `MyPaymentsPage`), editor de llaves con multiselección de categorías.
- «Registrar pago» estampa categoría.
- Pruebas: §10.2–§10.3, Q8–Q10, Q12.

**F4 · Caminos de alta restantes** — `feat/pagos-unicos-f4-qr`
- `submit_qr_signup` (ambas firmas + `__interno`): emitir pagos únicos en modo `auto` solo si la inscripción nace activa; si nace pendiente, al aprobar. Mostrar en la página pública (P3).
- Pruebas: QR de la escuela de prueba en dev; Q7 (sugerir no cobra por QR).

**F5 · Integraciones de comunicación y cobranza** — `feat/pagos-unicos-f5-integraciones`
- WhatsApp (§9.1): RPC `wa_get_payment_status` con categoría, enlaces y medios por categoría, `OtroConcepto` con seguro/artículos, aviso de resultado, recordatorios neutros, cartera. Plantillas neutras nuevas → **someter a Meta al inicio de la fase** (tardan).
- Correos: «cobro creado» por categoría; estado de cuenta con llaves por categoría.
- Mora: `apply_late_fees` sin recargo a pagos únicos (según P17). Torniquete y auto-bloqueo por mensualidad (según P18).
- Tableros: desglose en `school_payment_kpis`; CSV/rótulos. Factus por categoría solo si P15 está decidida.
- Pruebas: Q9–Q14 + vitest por componente de §9.

**F6 · Limpieza (≥ 30 días después de F5)** — `chore/pagos-unicos-f6-drop-columnas`
- Quitar fallback y espejo; `DROP COLUMN registration_fee, insurance_fee`; quitar `waive_registration_fee/insurance_fee` del BFF (tras confirmar que el frontend desplegado ya no los manda); regenerar tipos.
- Pruebas: grep limpio en repo y en `pg_proc`; Q2 y Q15 de nuevo.

Orden: F0 → F1 → F2 → F3 → (F4 ∥ F5) → F6. Cada fase: plan de migración aprobado antes de escribirla, revisión línea por línea de RLS,
`npm run migrations:check`, `npm run seguridad:invariantes`, y aplicar por vía con rastro (CLI / `apply_migration`), no por el SQL Editor.
Nada a `main` por iniciativa propia.

## 13. Preguntas abiertas

| # | Pregunta | Propuesta |
|---|---|---|
| P1 | ¿Las 7 categorías permitidas en la lista (`inscripcion, seguro, articulos, torneo, otro, viaje, vacacional`) bastan, o quieren «uniforme» como categoría propia en contabilidad? | Uniforme = `articulos` (sin tocar el CHECK). |
| P2 | Dedupe de frecuencia: ¿por **fila de la lista** o por **categoría**? (Plan A y plan B tienen cada uno su «Seguro»; el atleta cambia de A a B a los 3 meses: ¿se cobra otra vez?) | Por fila, y para `seguro` también por categoría (12 meses), que es la regla de hoy. |
| P3 | ¿Mostrar los pagos únicos en la página pública / QR antes de inscribirse? | Sí (transparencia; montos ya son públicos). Requiere `potf_select_public`. |
| P4 | Una exoneración («No cobrar uniforme») ¿consume la frecuencia `una_sola_vez_por_atleta`? | No: exonerado = no cobrado; se podrá cobrar en una alta futura. |
| P5 | Dreamers `PGP4x1` (activo) no tiene inscripción ni seguro, los otros 22 PG* sí. ¿Olvido o intencional? | Preguntar a Dreamers; el backfill **no** lo toca (cero cambio). |
| P6 | En «Agregar cobro» desde la lista, ¿se puede cambiar el monto? | Sí, con nota obligatoria si difiere. |
| P7 | La nota del cobro manual, ¿la ve el acudiente? | No: nota interna; el acudiente ve el concepto. |
| P8 | Dynasty tiene 1 cobro `otro` pagado de 150.000 sin exención de período: ¿es mensualidad mal clasificada? | Revisar con la escuela; no afecta este spec. |
| P9 | ¿Quién puede «Agregar cobro»: solo owner/admin, o también staff con permiso de finanzas? Coach nunca. | owner/admin/school_admin + quien tenga `can_manage_finances`. |
| P10 | ¿Ofrecer «cobrar pagos únicos a los importados» en la importación masiva? | No en este spec. |
| P11 | Inserts de `enrollments` desde el cliente (`PendingEnrollmentModal.tsx:52`, `usePrograms.ts:78`) y `submit_enrollment(_v2)` con EXECUTE a `authenticated`. | Ticket aparte de seguridad. |
| P12 | Webhook de Mercado Pago sin guard de doble pago y con `payment_method` posiblemente rechazado por el CHECK. | Ticket aparte, prioridad alta (dinero). |
| P13 | ¿El débito automático cobra pagos únicos? | No por ahora. |
| P14 | ¿Mover «Registrar pago» al BFF con idempotencia? | Sí, en otra rama (no bloquea). |
| P15 | Factura electrónica: ¿el seguro es ingreso de la escuela o recaudo para tercero (aseguradora)? ¿IVA del uniforme? | Decisión del contador de cada escuela; hasta entonces sin cambio. |
| P16 | ¿El estado de cuenta mensual se envía si solo hay pagos únicos nuevos? | Sí. |
| P17 | ¿Recargo de mora sobre pagos únicos vencidos? | No por defecto; flag por escuela. |
| P18 | ¿Un pago único impago (seguro) bloquea el torniquete? | No; solo la mensualidad. Confirmar con Dreamers (es quien tiene torniquete). |
| P19 | ¿Se debe impedir borrar una fila de la lista que ya tiene cobros, o archivarla basta? | Archivar (`is_active=false`) automáticamente. |
