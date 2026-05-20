# Plan — Vendor Subscriptions (unificar planes de trainer/wellness/store con escuelas)

> **Estado:** APROBADO para implementar (2026-05-19)
> **Fecha:** 2026-05-19
> **Autor borrador:** brayan.lopez@osigu.com + Claude
> **Estimación final:** ~5 días (incluye backfill + trigger sync + admin endpoint)

---

## 1. Problema

Hoy escuelas y vendors individuales (trainer / wellness / store) viven en modelos paralelos pero asimétricos:

| Concepto | Escuela | Trainer / Wellness / Store |
|---|---|---|
| Tabla de "plan" | `school_subscriptions` | **no existe** |
| Trial 30d en signup | sí (trigger `create_default_school_subscription`) | **no** — solo `vendor_profile(is_active=false)` |
| Vista entitlements | `v_school_entitlements` | no |
| UI gestión plan | `/mi-plan` | no |
| Flujo upgrade | `plan_upgrade_requests` → super_admin | super_admin manual sin tracking |
| Visibilidad sidebar "Mi Tienda" | n/a | `vendor_profile.is_active` |

Resultado: los vendors no tienen tracking de plan, no tienen trial, no tienen UI para autogestionar upgrades, no se puede expirar trial automático. El super_admin tiene que activar todo a mano sin contexto.

---

## 2. Decisiones firmes (tomadas con el owner)

| # | Decisión | Origen |
|---|---|---|
| D1 | Crear tabla **`vendor_subscriptions`** paralela (no reusar `school_subscriptions`) | conversación 2026-05-19 |
| D2 | Mantener al **super_admin como bottleneck manual** para activar planes pagados. Pago vía Wompi/MP en landing es Fase 6, no ahora | conversación 2026-05-19 |
| D3 | Trial 30d activo desde signup. **Durante trial todo está habilitado** (el modelo de negocio aún no cobra comisión a vendors — Fase 6 lo activará) | conversación 2026-05-19 |
| D4 | Los signups nuevos heredan `vendor_profile.is_active = false` hasta que un super_admin lo apruebe. Vinculado al status del subscription | migración 20260519000002 + esta propuesta |

---

## 3. Modelo de datos propuesto

### 3.1 Tabla `vendor_subscriptions`

```sql
CREATE TABLE public.vendor_subscriptions (
    id                                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                           uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_profile_id                 uuid                  REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,

    plan_code                         text        NOT NULL DEFAULT 'starter'
                                                  CHECK (plan_code IN ('starter','crecimiento','profesional','elite','enterprise')),
    tier                              text        NOT NULL DEFAULT 'free'
                                                  CHECK (tier IN ('free','pro','enterprise')),
    status                            text        NOT NULL DEFAULT 'trialing'
                                                  CHECK (status IN ('active','trialing','trial_expired','past_due','cancelled','grandfathered')),
    billing_cycle                     text        NOT NULL DEFAULT 'monthly'
                                                  CHECK (billing_cycle IN ('monthly','annual')),

    trial_ends_at                     timestamptz,
    current_period_start              timestamptz,
    current_period_end                timestamptz,

    payment_provider                  text                  CHECK (payment_provider IN ('wompi','mp','manual')),
    payment_provider_subscription_id  text,

    cancelled_at                      timestamptz,
    cancellation_reason               text,

    metadata                          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at                        timestamptz NOT NULL DEFAULT now(),
    updated_at                        timestamptz NOT NULL DEFAULT now()
);
```

**Diferencias con `school_subscriptions`:**
- Pivot es `user_id` (no `school_id`)
- Trae `vendor_profile_id` opcional para join rápido a capabilities
- `status` default `'trialing'` (vs `'active'` en escuelas) porque vendors arrancan con trial

### 3.2 Tabla `vendor_addons` (opcional, fase 2)

Mismo shape que `school_addons`. Por ahora **no la creamos** — los addons individuales (whatsapp, biomech, etc.) no aplican a vendors hoy. Si en el futuro hace falta, se agrega.

### 3.3 Vista `v_vendor_entitlements`

```sql
CREATE VIEW public.v_vendor_entitlements
WITH (security_invoker = true) AS
SELECT
    vp.user_id,
    vp.id                                                 AS vendor_profile_id,
    vp.vendor_type,
    vp.is_active                                          AS vendor_is_active,
    COALESCE(sub.plan_code, 'starter')                    AS plan_code,
    COALESCE(sub.tier, 'free')                            AS tier,
    COALESCE(sub.status, 'trialing')                      AS subscription_status,
    sub.trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    -- Entitlements derivados del plan + capabilities del vendor_profile
    (vp.capabilities->>'can_sell_products')::boolean      AS has_products,
    (vp.capabilities->>'can_sell_services')::boolean      AS has_services
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_subscriptions sub ON sub.user_id = vp.user_id;
```

### 3.4 Trigger signup

```sql
CREATE FUNCTION public.create_default_vendor_subscription() ...
-- AFTER INSERT ON public.vendor_profiles
-- Inserta vendor_subscriptions con starter/free/trialing/+30d
-- ON CONFLICT (user_id) DO NOTHING
```

**Cuándo dispara:** se engancha al INSERT en `vendor_profiles`, no en `profiles`. Así cuando `auto_create_vendor_profile` crea la fila (inactiva), inmediatamente se crea su subscription con trial.

### 3.5 RLS

Igual que `school_subscriptions`:
- Lectura: el dueño (`user_id = auth.uid()`) + super_admin
- Escritura: solo super_admin / service_role

### 3.6 Integración con `plan_upgrade_requests`

Agregar columna `user_id` opcional (paralela a `school_id`):

```sql
ALTER TABLE public.plan_upgrade_requests
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.plan_upgrade_requests
    ADD CONSTRAINT plan_upgrade_requests_target_check
    CHECK ((school_id IS NOT NULL) OR (user_id IS NOT NULL));
```

Cuando super_admin marca `processed=true` con `user_id IS NOT NULL`:
- Actualiza `vendor_subscriptions` (no `school_subscriptions`)
- Setea `vendor_profiles.is_active = true` si pasa de free a tier pagado

---

## 4. Backend (BFF)

### 4.1 Endpoint nuevo

```
GET /api/v1/me/vendor-entitlements
```

Respuesta:
```json
{
  "user_id": "...",
  "vendor_profile_id": "...",
  "vendor_type": "personal_trainer",
  "vendor_is_active": false,
  "plan_code": "starter",
  "tier": "free",
  "subscription_status": "trialing",
  "trial_ends_at": "2026-06-18T...",
  "current_period_start": null,
  "current_period_end": null,
  "billing_cycle": "monthly",
  "has_products": false,
  "has_services": true
}
```

Reusa el mismo patrón que `/api/v1/me/entitlements` (escuelas).

### 4.2 Endpoint `upgrade-requests`

Ya existe `POST /api/v1/upgrade-requests`. Solo extender el body para que acepte `target: 'school' | 'user'`. Si `target='user'`, guarda `user_id = req.user.id` en vez de `school_id`.

---

## 5. Frontend

### 5.1 Hook nuevo

`frontend/src/hooks/useVendorEntitlements.ts` — paralelo a `useEntitlements` pero contra `/api/v1/me/vendor-entitlements`.

### 5.2 Página nueva

`frontend/src/pages/vendor/MiPlanVendor.tsx` — clon de `MiPlanPage.tsx` adaptado:
- Sin sección de addons (no aplican a vendors hoy)
- "Plan actual" con badge status y trial countdown
- CTA "Mejorar mi plan" → mismo flow a landing con `buildLandingPlansUrl({ userId, currentPlan, returnTo })`
- Si `subscription_status='trialing'` y trial está por vencer → banner naranja
- Si `subscription_status='trial_expired'` → modal bloqueante con CTA "Activar mi plan"

### 5.3 Sidebar

`AppSidebar.tsx` — agregar entrada "Mi Plan" en el grupo "Mi Tienda" (o como ítem independiente para roles `personal_trainer` / `wellness_professional` / `external_vendor`). Solo aparece cuando hay `vendor_profile` (activo o inactivo).

### 5.4 Landing

`buildLandingPlansUrl` ya acepta `schoolId`. Agregar parámetro opcional `userId`. La landing detecta cuál param llegó y envía la solicitud con el `target` correcto al BFF.

---

## 6. Migraciones

Orden propuesto:

1. `2026XXXX_vendor_subscriptions_table.sql` — tabla + índices + RLS + trigger updated_at
2. `2026XXXX_vendor_subscriptions_signup_trigger.sql` — función + trigger en `vendor_profiles`. Backfill defensivo para vendor_profiles existentes que no tengan subscription
3. `2026XXXX_v_vendor_entitlements.sql` — vista + grants
4. `2026XXXX_plan_upgrade_requests_add_user_id.sql` — columna nullable + check constraint
5. Cambio en BFF (rutas + middleware)
6. Cambio en frontend (hook + página + sidebar + landing param)

---

## 7. ¿Qué pasa al expirar el trial (hoy, sin Fase 6)?

Hoy: nada drástico. Un cron job (que **no existe todavía** — lo creamos en este plan o lo dejamos para Fase 6) marcaría `status='trial_expired'`. El frontend mostraría un modal CTA pero **no se bloquea la funcionalidad** hasta Fase 6, porque hoy no hay comisión que cobrar.

En Fase 6 con Wompi/MP integrado:
- Trial expirado → no se pueden recibir pagos vía SportMaps Pay
- Las ventas existentes siguen activas pero las nuevas pasan al modo legacy (P2P por WhatsApp) hasta que active plan pagado

**Recomendación:** crear el cron en este sprint pero sin lógica de bloqueo — solo cambia el `status`. Cuando llegue Fase 6, se le suma la lógica de pasarela.

---

## 8. Decisiones confirmadas (2026-05-19)

- [x] **Crear `vendor_subscriptions` ahora.** Riesgo bajo, beneficio alto (trial empieza a correr, tracking de upgrades, UI unificada). Si Fase 6 cambia el modelo, migrar es viable.
- [x] **Trial 30d para TODOS los vendors** (trainer, wellness, store). El modelo de negocio actual no cobra comisión a vendors. En Fase 6 se podrá condicionar por `vendor_type` si se decide que `store` paga desde día 1.
- [x] **Cron de expiración en este sprint, sin lógica de bloqueo.** El cron solo actualiza `status='trial_expired'` donde `trial_ends_at < now()` y `status='trialing'`. Sin emails individuales (ver §11). Fase 6 le suma la lógica de pasarela.
- [x] **`vendor_profile.is_active` derivado del subscription** (Opción A). Regla:
    - `is_active = true` si `subscription.status IN ('active','trialing')` Y (`status != 'trialing'` OR `trial_ends_at > now()`)
    - Trigger `sync_vendor_is_active` se ejecuta `AFTER INSERT OR UPDATE ON vendor_subscriptions` (ver §10b)
- [x] **Agregar columna `user_id` a `plan_upgrade_requests`** (no crear tabla separada). Helper en BFF: cuando super_admin marca `processed=true` con `user_id IS NOT NULL`, automáticamente:
    - Actualiza `vendor_subscriptions` (plan_code, tier, status='active', current_period_start/end)
    - Trigger de sync actualiza `vendor_profiles.is_active`
    - Sin pasos manuales adicionales

---

## 10. Puntos adicionales (incorporados al alcance)

### 10a. Backfill de vendors existentes

La migración que crea `vendor_subscriptions` debe insertar fila para cada `vendor_profiles` existente:

```sql
INSERT INTO public.vendor_subscriptions (
    user_id, vendor_profile_id, plan_code, tier, status, trial_ends_at, metadata
)
SELECT
    vp.user_id,
    vp.id,
    'starter',
    'free',
    CASE WHEN vp.is_active THEN 'active' ELSE 'trialing' END,
    CASE WHEN vp.is_active THEN NULL ELSE now() + interval '30 days' END,
    jsonb_build_object(
        'created_via',     'backfill_vendor_subscriptions',
        'backfill_reason', 'pre_existing_vendor_profile'
    )
FROM public.vendor_profiles vp
WHERE NOT EXISTS (
    SELECT 1 FROM public.vendor_subscriptions vs WHERE vs.user_id = vp.user_id
);
```

Sin esto los vendors que ya están activos en stg/prod quedan sin subscription y `v_vendor_entitlements` les retorna `'starter'/'free'` por COALESCE, lo cual contradice su estado real.

### 10b. Trigger `sync_vendor_is_active`

```sql
CREATE OR REPLACE FUNCTION public.sync_vendor_is_active_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    UPDATE public.vendor_profiles
       SET is_active = (
           NEW.status IN ('active','trialing')
           AND (NEW.status <> 'trialing' OR NEW.trial_ends_at > now())
       ),
       updated_at = now()
     WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER vendor_subscriptions_sync_is_active
    AFTER INSERT OR UPDATE OF status, trial_ends_at ON public.vendor_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_vendor_is_active_from_subscription();
```

Nota: el `UPDATE OF status, trial_ends_at` evita disparar el trigger en cambios de metadata u otros campos irrelevantes.

### 10c. Admin endpoint unificado

```
GET /api/v1/admin/upgrade-requests?status=pending&target_type=user|school|all
```

Respuesta unifica `school_id` y `user_id` con campo `target_type: 'school' | 'user'`. Reusa la query base agregando UNION o un CASE WHEN en SELECT. El admin app puede filtrar y ordenar sin saber con qué tabla termina.

### 10d. Landing detecta tipo de target

`buildLandingPlansUrl({ schoolId?, userId?, currentPlan, returnTo })` — uno de los dos debe llegar.

Landing logic:
1. Si llega `school_id` → modo escuela (comportamiento actual)
2. Si llega `user_id` → modo vendor (nuevo)
3. Si llegan ambos → modo escuela (escuela tiene prioridad porque puede tener vendors anidados)
4. Si no llega ninguno y usuario está logueado → detectar vía Supabase: si tiene `school` membership → escuela, si tiene `vendor_profile` → vendor, si ambas → toggle visible

### 10e. RLS de `v_vendor_entitlements`

La vista usa `security_invoker = true`, así que aplica RLS de `vendor_profiles` y `vendor_subscriptions` al caller. Agregar política explícita por defensa:

```sql
-- En vendor_subscriptions ya está cubierto: user_id = auth.uid() OR is_super_admin()
-- En vendor_profiles ya existe RLS de lectura para owner + admin
-- No hace falta política nueva sobre la vista.
```

---

## 11. Notificaciones al super_admin

**Decisión:** NO notificación individual por trial expirado.

**Razones:**
- Volumen esperado a escala = decenas/cientos por día → ruido
- Trial expirado no es emergencia (vendor sigue accesible, solo ve modal CTA)
- Acción la inicia el vendor desde la UI, no el admin

**En su lugar:**
- Card en `/admin/metrics`: "Vendors con trial expirado en últimos 7 días: X"
- Filtro en lista admin de vendors por `subscription_status='trial_expired'`
- Ordenamiento por `trial_ends_at` ascendente para ver los próximos a vencer

Fase 6 reevalúa: si el trial expirado implica desactivación auto, un resumen semanal puede tener sentido.

---

## 12. Fase 6 (referencia, no incluida)

Cuando Fase 6 active pasarelas reales:

1. Landing agrega checkout Wompi/MP en `/planes` (forma compactada de Netflix flow)
2. Webhook recibe pago → endpoint BFF `/api/v1/payments/webhook/{wompi,mp}` → actualiza `vendor_subscriptions` directamente sin pasar por super_admin
3. `plan_upgrade_requests.processed=true` se llena automático
4. Si webhook falla → fallback al flow manual actual

Este plan no incluye nada de Fase 6 — solo deja la infraestructura lista para que cuando llegue, no haya que reescribir nada de DB ni UI.

---

## 13. Estimación final

| Pieza | Esfuerzo |
|---|---|
| Migraciones (1-5: tabla, signup trigger, vista, plan_upgrade_requests col, sync trigger) | 1.5 día |
| Backfill (§10a) | incluido en migraciones |
| BFF endpoints + middleware + admin unificado (§10c) | 0.5 día |
| Hook frontend + página MiPlanVendor | 1 día |
| Sidebar + buildLandingPlansUrl extendido (con detección §10d) | 0.5 día |
| Landing acepta userId param | 0.5 día |
| Cron expiración trial (sin lógica bloqueo, feature flag) | 0.5 día |
| QA manual + ajustes | 0.5 día |
| **Total** | **~5 días** |
