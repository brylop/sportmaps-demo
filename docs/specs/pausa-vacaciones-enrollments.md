# Pausa de inscripción (vacaciones / lesión)

**Estado:** **F1, F2 y F3 construidos y aplicados** el 2026-09-10 — migraciones `20260910080206`, `20260910080313`, los fixes `20260910082323` y `20260910082720`, y `20260910114047` (config para el acudiente). Radio cero (0 escuelas con `pause_enabled`). Queda pendiente solo la superficie del **atleta adulto** (ver §11).
**Fecha:** 2026-09-10
**Resuelve:** `docs/specs/cobranza-vencidos-estados-y-alertas.md` §4.1 y §4.4 (acción *Pausar*), y cierra su decisión pendiente **D4**.

---

## 0. Decisiones de producto (cerradas 2026-09-10)

| # | Decisión | Resuelto |
|---|---|---|
| **D4** | ¿Quién puede pedir la pausa? | **Ambos caminos.** El acudiente (y el atleta adulto) la **solicita** desde su módulo principal y el admin la **aprueba**. El admin además puede pausar **directo** con un botón que hace toda la acción, sin solicitud previa — mismo patrón de UX que el botón de becado. |
| **D5** | Granularidad | **Por mes completo.** Solo se salta el cobro de los meses que la pausa cubre enteros. El admin/padre elige *mes desde* / *mes hasta*. Consistente con `open_month`, que es explícitamente «sin prorrateo». |
| **D6** | Cobros ya emitidos de los meses pausados | **Se anulan** (`status='cancelled'`) los `pending` y `overdue`, casando por identidad de atleta + `period_year`/`period_month`. Mismo criterio que `set_school_athlete_status`. |
| **D7** | Rollout | **Opt-in por escuela, apagado por defecto** (`school_settings.pause_enabled`), con tope de meses/año configurable. Ninguna de las 368 escuelas cambia de comportamiento hasta prenderlo. |

---

## 1. Lo que ya existe (no reconstruir)

- **Columnas de pausa en `enrollments`** — `paused_reason` (`CHECK IN ('injury','vacation','other')`), `paused_at`, `paused_until`. Creadas por `20260902171932`, **aplicadas en la base**, hoy `NULL` en el 100% de las filas (0 de 1.322 activas).
- **`fn_expire_overdue_enrollments` ya excluye pausados** (`AND e.paused_reason IS NULL`). Es la única función de la base que mira esa columna — verificado contra `pg_proc`.
- **`open_month` es el único generador de cuotas vivo.** El cron `generate-monthly-charges-daily` (06:30) solo itera escuelas con `auto_generate_payments = true` y llama a `open_month`. Un solo fix cubre cron y botón.
- **Patrón de flag por escuela**: `school_settings.military_discount_enabled` / `late_fee_enabled` — el frontend ya gatea UI por ellos (`militaryDiscountEnabled` en `SchoolStudentsManagementPage`).
- **Patrón de solicitud→aprobación**: `plan_upgrade_requests` (`20260514000001`) — tabla con `requested_by` / `status` / `processed_by` / `processed_at`. Se calca la forma.
- **Notificaciones**: un `INSERT` en `public.notifications` encola el envío solo, por el trigger `trg_enqueue_notification_delivery` (`20260722000003`). Las RPCs no llaman a ningún servicio.
- **Anulación de cartera**: `set_school_athlete_status` (`20260730170000`) ya anula cobros pendientes al dar de baja. Se reusa el **criterio**, no la función — esa además cancela la inscripción, que acá **no** se toca.

## 2. Lo que NO respeta la pausa hoy

| Función / camino | Estado | Qué se hace |
|---|---|---|
| `open_month` (y su gemela `preview_open_month`) | ✅ **corregido en F1** | Es el fix central. Aplicado en `20260910080313`. |
| `generate_monthly_charges` (cron 06:30) | — | No hace falta tocarla: delega en `open_month`. |
| `apply_late_fees` (cron 07:00) | ❌ no excluye pausados | **No hace falta tocarla.** Con D6, el cobro del mes pausado no existe → no hay a qué aplicarle recargo. Esto desactiva de raíz la deuda técnica que la migración `20260902171932` dejó anotada. |
| `send_payment_reminders` (cron 13:00) | ❌ no excluye | Igual que arriba: sin cobro, no hay recordatorio. |
| **Autopay** (`recurring-charges.service.ts` → `claim_due_recurring_subscriptions`) | ⚠️ **no desplegado** | `recurring_subscriptions` **no existe en la base** (verificado). El servicio crea su propio `payments` por fuera de `open_month`, así que **hoy no es un hueco, pero es una trampa futura**: quien despliegue autopay tiene que meter el chequeo de pausa dentro de `claim_due_recurring_subscriptions`. Queda anotado en `docs/gotchas-tecnicos.md` en F1. |

> **La migración `20260902171932` decía que anular cobros era impracticable** porque `payments` no tiene `enrollment_id`. Es cierto que no lo tiene, pero **sí** tiene `period_year`, `period_month`, `child_id`, `user_id` y `unregistered_athlete_id`. Eso alcanza para casar cobro↔pausa por identidad + periodo, exactamente como ya lo hace el `NOT EXISTS` de dedup dentro de `open_month`. La restricción anotada en esa migración queda superada.

---

## 3. Modelo de datos

### 3.1 Estado vigente: las columnas de `enrollments` (ya existen)

`paused_reason IS NOT NULL` = pausada. **No se toca `status`** — la pausa es una propiedad de la vigencia, no del ciclo de vida (`enroll_status` sigue `active`). Se agregan dos columnas de auditoría:

```sql
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS paused_by         uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pause_request_id  uuid;   -- FK se agrega tras crear la tabla
```

### 3.2 Historia y solicitudes: `enrollment_pause_requests` (nueva)

Las columnas de `enrollments` solo guardan **la pausa vigente**. El tope de meses/año y el rastro de quién pidió y quién aprobó necesitan historia, así que va tabla:

```sql
CREATE TABLE public.enrollment_pause_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  enrollment_id            uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,

  -- Identidad del atleta: el mismo trio que usa `payments`, para poder casar
  -- los cobros a anular sin depender de un enrollment_id que payments no tiene.
  child_id                 uuid REFERENCES public.children(id) ON DELETE CASCADE,
  user_id                  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unregistered_athlete_id  uuid REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE,

  reason                   text NOT NULL CHECK (reason IN ('injury','vacation','other')),
  reason_note              text CHECK (reason_note IS NULL OR length(reason_note) <= 500),

  -- Dia 1 del primer y del ultimo mes pausado. D5: granularidad de mes.
  month_from               date NOT NULL,
  month_to                 date NOT NULL,

  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','rejected','cancelled')),
  source                   text NOT NULL CHECK (source IN ('parent','athlete','admin')),

  requested_by             uuid REFERENCES public.profiles(id),
  requested_at             timestamptz NOT NULL DEFAULT now(),
  reviewed_by              uuid REFERENCES public.profiles(id),
  reviewed_at              timestamptz,
  review_note              text,

  -- Auditoria de lo que la aprobacion movio realmente.
  payments_cancelled       int,           -- cobros anulados
  payments_ambiguos        int,           -- candidatos NO anulados por categoria dudosa (ver §7)
  expires_at_at_pause      date,          -- vigencia al pausar, para decidir la extension al reactivar

  resumed_at               timestamptz,   -- reactivacion anticipada
  resumed_by               uuid REFERENCES public.profiles(id),
  days_extended            int,           -- dias que se corrio expires_at al reactivar

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pause_meses_ordenados CHECK (month_to >= month_from),
  CONSTRAINT pause_dia_uno CHECK (
    extract(day from month_from) = 1 AND extract(day from month_to) = 1
  ),
  CONSTRAINT pause_una_identidad CHECK (
    (child_id IS NOT NULL)::int + (user_id IS NOT NULL)::int
      + (unregistered_athlete_id IS NOT NULL)::int = 1
  )
);

-- Una sola solicitud pendiente por inscripcion (btree simple, sin extension).
CREATE UNIQUE INDEX enrollment_pause_requests_una_pendiente
  ON public.enrollment_pause_requests(enrollment_id) WHERE status = 'pending';

CREATE INDEX enrollment_pause_requests_bandeja
  ON public.enrollment_pause_requests(school_id, requested_at DESC) WHERE status = 'pending';

CREATE INDEX enrollment_pause_requests_aprobadas
  ON public.enrollment_pause_requests(enrollment_id, month_from) WHERE status = 'approved';
```

**No-solape de pausas aprobadas:** `btree_gist` **no está instalado** en esta base (verificado), así que no hay `EXCLUDE USING gist`. Se valida dentro de la RPC bajo `pg_advisory_xact_lock(hashtextextended(enrollment_id::text, 0))` — mismo patrón de serialización que ya usa `open_month` para el periodo. Agregar la extensión se descarta: más superficie por una garantía que el lock ya da.

### 3.3 Config por escuela

```sql
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS pause_enabled             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_max_months_per_year int NOT NULL DEFAULT 2
      CHECK (pause_max_months_per_year BETWEEN 0 AND 12),
  ADD COLUMN IF NOT EXISTS pause_parent_can_request  boolean NOT NULL DEFAULT true;
```

`pause_enabled = false` por defecto (D7): cero cambio de comportamiento para las 368 escuelas. `pause_parent_can_request` permite a una escuela quedarse solo con el botón del admin.

---

## 4. Regla de cobro — la definición exacta de «mes pausado»

> **Corregido en `20260910082323`.** La primera versión ignoraba `resumed_at` por
> completo ("un mes que ya se saltó sigue saltado"), y eso se llevaba puesto un
> caso: una pausa **programada** para un mes futuro y **cancelada antes de que
> ese mes arranque** dejaba el mes sin cobro para siempre. Plata perdida en
> silencio. La condición correcta agrega: la pausa no debe haber terminado
> ANTES de que el mes empezara.
>
> | `resumed_at` | Efecto sobre el mes M |
> |---|---|
> | `NULL` | sigue pausado → **no se cobra** |
> | mes(`resumed_at`) ≥ M | volvió durante o después de M, ya estaba decidido → **no se cobra** |
> | mes(`resumed_at`) < M | se canceló antes de que M empezara → **sí se cobra** |
>
> La regla OPERATIVA no cambió: sigue recortando por día en `resumed_at`.


Un mes `(p_year, p_month)` **no se cobra** para una inscripción si existe una pausa aprobada que lo cubre entero:

```sql
EXISTS (
  SELECT 1 FROM public.enrollment_pause_requests r
  WHERE r.enrollment_id = e.id
    AND r.status = 'approved'
    AND make_date(p_year, p_month, 1) BETWEEN r.month_from AND r.month_to
)
```

Se lee de la **tabla**, no de `enrollments.paused_at/paused_until`, para que abrir un mes pasado o futuro dé el mismo resultado que dio en su momento — las columnas de `enrollments` solo reflejan la pausa vigente y se limpian al reactivar.

Encapsulado en un helper para no repetir la subquery en tres lugares:

```sql
CREATE OR REPLACE FUNCTION public.enrollment_pausada_en(p_enrollment_id uuid, p_year int, p_month int)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ ... $$;

REVOKE ALL ON FUNCTION public.enrollment_pausada_en(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_pausada_en(uuid, int, int) TO authenticated, service_role;
```

---

## 5. RPCs

Todas: `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp` (invariante **I4**), `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated` explícito.

| RPC | Quién | Qué hace |
|---|---|---|
| `request_enrollment_pause(p_enrollment_id, p_reason, p_reason_note, p_month_from, p_month_to)` | acudiente del menor / atleta adulto | Valida parentesco (o identidad), `pause_enabled` + `pause_parent_can_request`, tope de meses/año, no-solape, meses no pasados. Inserta `status='pending'`. Notifica a los admins de la escuela. **No toca `enrollments`.** |
| `cancel_enrollment_pause_request(p_request_id)` | quien la pidió | Retira la solicitud mientras siga `pending`. |
| `approve_enrollment_pause(p_request_id, p_review_note)` | admin de la escuela | Atómica: `status='approved'`, escribe `paused_reason/paused_at/paused_until/paused_by/pause_request_id` en el enrollment, **anula** los `pending`/`overdue` de los meses cubiertos (D6), guarda `payments_cancelled`, notifica al solicitante. |
| `reject_enrollment_pause(p_request_id, p_review_note)` | admin de la escuela | `status='rejected'` + notificación. Nada más. |
| `pause_enrollment_directly(p_enrollment_id, p_reason, p_month_from, p_month_to, p_note)` | admin de la escuela | **El botón «hace toda la acción»**: inserta la solicitud con `source='admin'`, `status='approved'`, `requested_by = reviewed_by = auth.uid()`, y corre el mismo cuerpo que `approve_…` en una sola transacción. Devuelve `{meses_pausados, payments_cancelled}` para el toast. |
| `preview_enrollment_pause(p_enrollment_id, p_month_from, p_month_to)` | admin / acudiente | Solo lectura: qué meses no se cobrarían y cuántos cobros se anularían. Alimenta el diálogo de confirmación **sin calcular plata en el navegador**. |
| `resume_enrollment(p_enrollment_id, p_note)` | admin de la escuela | Reactivación anticipada: limpia las columnas de `enrollments`, corre `expires_at = expires_at + (hoy − paused_at)` (§4.1 del spec de cobranza), recorta `month_to` al mes en curso para que los meses siguientes vuelvan a cobrarse, guarda `resumed_at`/`days_extended`. |

**Autorización — la función de alcance correcta.** Aprobar una pausa **exime de pagar**, o sea otorga un beneficio económico: va con `is_school_admin(p_school_id)` / `user_admin_school_ids()`, **nunca** `user_staff_school_ids()`. Un coach no aprueba pausas. Y todas las RPCs arrancan con guarda explícita contra NULL:

```sql
IF NOT COALESCE(public.is_super_admin(), false)
   AND NOT COALESCE(public.is_school_admin(v_school_id), false) THEN
  RAISE EXCEPTION 'No autorizado…';
END IF;
```

(`COALESCE` obligatorio: `NOT NULL` es `NULL`, no `true` — es exactamente el bypass que costó ~64 funciones y se cerró en `20260826110449`.)

---

## 6. RLS de `enrollment_pause_requests`

Policies **por comando, nunca `FOR ALL`** (invariante **I3**: `FOR ALL` sin `WITH CHECK` valida los INSERT con el `USING`, que es cómo cualquiera se insertaba como staff de cualquier escuela).

| Comando | Quién | Expresión |
|---|---|---|
| `SELECT` | staff de la escuela | `school_id IN (SELECT public.user_school_ids())` — es lectura, así que `user_school_ids()` es la correcta acá |
| `SELECT` | acudiente | `child_id IN (SELECT id FROM public.children WHERE parent_id = (SELECT auth.uid()))` |
| `SELECT` | atleta adulto | `user_id = (SELECT auth.uid())` |
| `INSERT` / `UPDATE` / `DELETE` | **nadie directo** | Sin policy. Todo entra por las RPCs `SECURITY DEFINER` |

Notas de implementación que ya costaron caro y aplican acá:

- Los helpers van **envueltos** — `(SELECT public.user_school_ids())`, no `public.user_school_ids()` — o el planner los evalúa por fila. Es la causa de la lentitud de agosto (0 de ~74 sitios los envolvía).
- Al cerrar la tabla, listar **todas** sus policies (`select cmd, policyname, permissive, roles, qual, with_check from pg_policies where tablename = 'enrollment_pause_requests'`): son PERMISIVAS y se suman con `OR`.
- Sin `GRANT` a `anon`, y `REVOKE`/`GRANT` explícitos: los default privileges del esquema dan `EXECUTE` a `authenticated` en toda función nueva.

---

## 7. Vista `school_athletes` — el badge

Exponer `paused_reason` y `paused_until` para que la lista de atletas y la bandeja los pinten. Los campos salen de los **mismos `LEFT JOIN LATERAL` `te`/`pe`** que ya traen `fee_is_manual`/`fee_reason` — se agregan dos columnas ahí, **sin subquery nueva**. Una subquery correlacionada dentro de una vista `security_invoker` re-activa RLS por fila y ya produjo un timeout `57014`; el patrón sano es `LEFT JOIN LATERAL`.

---

## 8. Wiring — las acciones NO pasan por el BFF (corregido al implementar)

El plan original ponía siete endpoints en el BFF. **Está mal, y hay que no hacerlo.**

`bff/src/config/supabase.ts` crea el cliente con `SUPABASE_SERVICE_ROLE_KEY`. Con el service role, `auth.uid()` dentro de la RPC es **NULL**, y todas las guardas de §5 tienen la forma:

```sql
IF v_caller IS NOT NULL AND NOT (… is_school_admin …) THEN RAISE EXCEPTION …
```

Ese `v_caller IS NOT NULL` existe para que el cron pueda correr, pero significa que **una RPC llamada desde el BFF se saltea su propia autorización**. Y `request_enrollment_pause` sería peor: resuelve `source` con `is_parent_of_child(auth.uid())`, así que por el BFF fallaría siempre con "No autorizado".

Las acciones de pausa van **directo desde el frontend** con `(supabase.rpc as any)('…', {…})` y el JWT del usuario, exactamente como ya se llama `set_school_athlete_status` en [SchoolStudentsManagementPage.tsx:885](../../frontend/src/pages/SchoolStudentsManagementPage.tsx#L885). Así la autorización de la RPC **es** el gate real, no un adorno que el BFF puentea.

Lo único que sí va en el BFF es el roster de asistencia (§8.1), porque ese endpoint corre con service role por diseño y arma la lista él mismo.

### 8.1 Roster de asistencia — la regla OPERATIVA

Helper `pausedEnrollmentIds(schoolId, date)` en [attendance.ts](../../bff/src/routes/attendance.ts), aplicado en tres lugares:

| Lugar | Qué cambia |
|---|---|
| `GET /roster/:contextType/:contextId` | el pausado no sale en la lista del entrenador. Devuelve `atletas_pausados` para que la pantalla lo diga en vez de dejarlo buscando a alguien que "desapareció". Evalúa la ventana contra el `?date=` pedido, no contra hoy: abrir la lista del 20 de julio muestra quién estaba activo ese día. |
| `GET /school-roster` | no se puede marcar por carnet/QR a un pausado — si saliera en la búsqueda, el entrenador le descontaría un crédito de un plan en pausa. |
| `findCreditEnrollment()` | una inscripción en pausa no presta su crédito. Se juzga con la fecha del EVENTO, igual que el saldo. |

**Falla abierta a propósito:** si la consulta de pausas se cae, devuelve set vacío y el pausado aparece. Un pausado de más en el roster es una molestia; un roster vacío deja al entrenador sin poder pasar lista.

---

## 9. Frontend

### 9.1 Admin — `SchoolStudentsManagementPage.tsx` (calca becado)

- **Botón** `🏖️ Vacaciones / pausa` en la fila del atleta, gateado por `pause_enabled` (igual que `militaryDiscountEnabled` gatea el de Fuerza Militar). Abre diálogo con motivo (lesión / vacaciones / otro), *mes desde* / *mes hasta* y nota.
- **Antes de confirmar, el diálogo dice qué va a pasar**: «No se cobrarán julio y agosto de 2026. Se anularán 2 cobros pendientes.» Sale de `preview_enrollment_pause`, no del navegador — hay 11 divergencias censadas de cálculos monetarios hechos en el front.
- **Badge** `🏖️ En pausa hasta MM/YYYY` en la lista y en el detalle, al lado de `🎓 Becado`.
- **Botón Reactivar** cuando está pausado.
- **Bandeja**: tab/contador de solicitudes pendientes con Aprobar / Rechazar.

### 9.2 Acudiente — `MyChildrenPage.tsx`

- Acción **`Solicitar pausa`** en la tarjeta del hijo, junto a Asistencia / Progreso / Informes / Documentos. Visible solo si `pause_enabled AND pause_parent_can_request`.
- Diálogo: motivo, mes desde/hasta, nota. Al enviar, la tarjeta muestra **`Pausa solicitada — en revisión`** con opción de retirarla.
- Aprobada: **`En pausa hasta MM/YYYY`** y el aviso de que esos meses no se cobran.
- El atleta adulto tiene la misma acción en su módulo (misma RPC, `source='athlete'`).

---

## 10. Fases (una rama por fase, revisión entre cada una)

| Fase | Alcance | Entregable |
|---|---|---|
| **F1 — Backend** ✅ | Migración aplicada: 2 columnas en `enrollments`, tabla + 4 índices + RLS (3 policies solo-SELECT), 3 flags en `school_settings`, vista `v_enrollment_pauses_effective`, helpers `enrollment_pausada_en`/`enrollment_pausada_el`, 10 funciones (7 públicas + 3 privadas), exclusión de pausados en `open_month` y `preview_open_month`. Exclusión del roster de asistencia en el BFF (3 puntos). Nota en `docs/gotchas-tecnicos.md`. | **Hecho.** Pausa funcional por RPC, sin UI |
| **F2 — Admin** ✅ | `usePauses.ts` (queries + mutations, todas por `supabase.rpc` con el JWT del usuario — NO por el BFF, ver §8), `PauseAthleteDialog` (mes desde/hasta + preview de la RPC), `PauseRequestsInbox` (aprobar/rechazar, se auto-oculta si no hay nada), badge en las dos vistas de la lista de atletas, ítems de menú pausar/reactivar, toggle + tope + permiso al acudiente en Automatización de Pagos, aviso `atletas_pausados` en la pantalla de asistencia. | **Hecho.** El admin ya puede pausar |
| **F3 — Acudiente** ✅ | RPC `pause_config_for_enrollment` (migración `20260910114047`), hooks `usePauseConfig`/`useMyPauseRequests`/`useParentPauseActions`, `RequestPauseDialog`, `ChildPauseSection` con sus tres estados (sin solicitud / pendiente con «Retirar» / aprobada), montado en `MyChildrenPage`. Notificaciones a ambos lados. | **Hecho** para el acudiente. El atleta adulto queda pendiente por falta de pantalla — ver §11 |

### Tests de concurrencia de F1 (obligatorios)

1. Dos `approve_enrollment_pause` simultáneas sobre la misma solicitud → una aprueba, la otra falla; **un solo** juego de cobros anulados.
2. `approve_enrollment_pause` corriendo a la vez que `open_month` de un mes pausado → o no se genera el cobro, o se genera y queda anulado; **nunca** un cobro vivo de un mes pausado.
3. Dos pausas con meses solapados sobre la misma inscripción → la segunda falla bajo el advisory lock.
4. `resume_enrollment` mientras corre `open_month` → el mes en curso se resuelve de forma determinista.
5. Tope de meses/año: dos solicitudes concurrentes que juntas lo exceden → solo una pasa.

### Antes de aplicar (obligatorio, CLAUDE.md)

- **Revisar las policies de RLS línea por línea** antes de aplicarlas.
- `npm run migrations:new -- pausa-vacaciones-enrollments` para reservar la versión; commitear el `.sql` junto a `supabase/migrations_ledger.json`.
- Aplicar por CLI de Supabase o `apply_migration`, **nunca** pegando SQL en el SQL editor (no deja rastro en `schema_migrations`).
- `npm run seguridad:invariantes` después de aplicar.
- Medir el radio: con `pause_enabled = false` por defecto el radio es **cero escuelas**, pero confirmar que `open_month` sobre una escuela sin pausas genera **exactamente** lo mismo que antes del cambio (diff de conteo por escuela, mes en curso).

---

## 11. Fuera de alcance (a propósito)

- **Prorrateo por días** — D5 lo descartó.
- **Devolución / saldo a favor** de lo ya pagado de un mes pausado: requiere el módulo de saldos a favor, que no existe.
- **Control de acceso físico (torno/puerta)**: `access-auto-block.job.ts` dispara el bloqueo por `payments.status = 'overdue'`. Un pausado nunca llega a `overdue` (D6 le anula el cobro), así que **la puerta le sigue abriendo** aunque no salga en la lista de asistencia. Es un hueco conocido y deliberado; cerrarlo es agregar la pausa como señal de bloqueo en ese job, y es decisión de producto aparte (¿la pausa cierra la puerta?).
- **La acción para el atleta adulto** (`source='athlete'`, ya soportado por la RPC): **no tiene dónde ir hoy.** El candidato natural, `DashboardPlanCard.tsx`, es **código muerto** —no lo importa nadie— y el dashboard del atleta no renderiza su propio plan en ninguna parte. `MyEnrollmentsPage` es la pantalla de reservas de clases, no «mi plan». Wirearlo implica decidir qué pantalla le muestra al adulto su inscripción, que es una decisión de producto y no un cableado. El backend ya lo acepta: cuando exista la pantalla, es reusar `RequestPauseDialog` con el `enrollment_id` propio.
- **Regenerar `frontend/src/integrations/supabase/types.ts`**: los tipos autogenerados todavía no conocen la tabla ni las RPCs nuevas. F2 usa `(supabase.rpc as any)`, igual que el resto del repo (`set_school_athlete_status`, `create_invitation`).
- **Cobrar el mes en el que se reactiva**: `resume_enrollment` devuelve `mes_en_curso_sin_cobro` para que la UI lo diga, pero no re-emite el cobro. La ventana de cobro es mensual y ese mes ya se decidió; si la escuela lo quiere cobrar, lo registra a mano.
- **Autopay**: no está desplegado. Cuando se despliegue, el chequeo va en `claim_due_recurring_subscriptions`.
- **`apply_late_fees`**: no se toca, por D6.
