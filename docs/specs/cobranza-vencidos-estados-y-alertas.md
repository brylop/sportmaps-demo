# Spec — Cobranza más fuerte: estados de plan, alertas y asistencia

**Proyecto:** SportMaps · **Autor:** Brayan + Claude · **Fecha:** 2026-08-31 · **Versión:** 2.0 (reemplaza v1.0 del 2026-08-28)
**Por qué v2:** la v1.0 se diseñó sin auditar el código y la base vivos. Al hacerlo aparecieron un bloqueador crítico y una cobranza mucho más construida de lo que el spec original asumía. Esta versión corrige el modelo sobre lo que YA existe y agrega lo que de verdad falta.

> **⚠️ FUSIONADO — 2026-08-31.** Este documento quedó incorporado en [`vigencia-cobranza-y-sesiones-unificado.md`](vigencia-cobranza-y-sesiones-unificado.md) (v3.0), que además corrige el §1.7 de abajo (el trigger de vigencia que aquí se daba por sano resultó tener un punto ciego de 77 inscripciones, hallado horas después de escribir esta versión). Se conserva como detalle histórico — **la fuente de verdad es el documento unificado.**

---

## 0. Resumen ejecutivo

La pregunta no es "¿cómo construyo cobranza inteligente?" — ya hay un motor de mora, un motor de recordatorios, una vista de estado de pago por atleta, un badge de "vencido" en asistencia y un botón de WhatsApp para recordatorios. La pregunta real es **por qué esa cobranza es débil pese a existir**, y la respuesta, verificada contra la base viva, tiene tres partes:

1. **Un bug de raíz activo:** un cron sin versionar cancela inscripciones vencidas SIN periodo de gracia, contradiciendo al motor de mora que sí lo respeta. Corre desde antes de este spec y nadie lo revisó nunca.
2. **Adopción, no ausencia de motor:** solo 4 de 368 escuelas tienen `late_fee_enabled`. Dynasty — la de más deuda de la plataforma — no lo tiene prendido. El motor de mora funciona; casi nadie lo usa.
3. **Falta de escalón final:** hay recordatorio in-app antes del vencimiento y recargo después, pero no hay una escalera post-vencimiento multicanal, ni un lugar donde el admin decida qué hacer con un vencido (el caso "Milena Barrera").

---

## 1. Lo que YA existe (verificado en código y en la base viva, 2026-08-31)

### 1.1 Motor de mora — `apply_late_fees()`
`supabase/migrations/20260706120000_late_fee_engine.sql`. Cron `apply-late-fees-daily`, 07:00 UTC (02:00 COT), **activo**.
- Recorre `payments` en `pending`/`partial` cuyo `due_date + school_settings.payment_grace_days` ya venció.
- Marca `pending → overdue`.
- Si `late_fee_enabled`, suma recargo único (`late_fee_percentage` sobre el saldo) dentro de `amount`, idempotente vía `late_fee_applied_at`.
- **Verificado en vivo:** 368 escuelas, solo **4 con `late_fee_enabled = true`**.

### 1.2 Motor de recordatorios — `send_payment_reminders()`
`supabase/migrations/20260713000004_payment_reminders_engine.sql`. Cron `send-payment-reminders-daily`, 13:00 UTC (08:00 COT), **activo**.
- Para escuelas con `reminder_enabled`, crea notificación in-app (`type='payment_reminder'`) para pagos `pending` que vencen dentro de `reminder_days_before` días.
- Idempotente vía `payments.reminder_sent_at`.
- **Es, literalmente, el `pre_due_3d` de la v1.0 — ya construido.** Solo in-app, no email/push/WhatsApp.

### 1.3 Estado de pago por atleta — vista `school_athletes`
`supabase/migrations/20260804125913_school_athletes_payment_status_oldest_debt.sql`.
- `payment_status` = la deuda más antigua sin saldar (ignora cancelled/rejected/failed); si no hay deuda, el pago más reciente. `"paid"` = no debe nada.
- `payment_due_date` acompaña ese mismo cobro.
- Es la fuente que YA alimenta el badge de mora — no hay que inventar el cálculo, ya está.

### 1.4 Badge de mora en asistencia — YA CONSTRUIDO
`frontend/src/pages/CoachAttendancePage.tsx`:
- Badge rojo "Vencido" leyendo `plan.payment_status` (línea ~182).
- Texto "Plan vencido" visible al entrenador (línea ~235).
- Regla de producto ya aplicada: **la falta de saldo NO bloquea la asistencia** — "Falta de saldo y plan vencido ya NO fallan: la asistencia se registra" (línea ~601) y status `expired: "Asistencia registrada · el plan está vencido."` (línea ~746).
- Bulk-action "✅ Todos presentes" ya existe (línea ~771/1120) — el flujo rápido de §8.1 de la v1.0 ya está resuelto en gran parte.

**Esto significa que el objetivo #1 de la v1.0 ("cero deportistas asistiendo con plan vencido sin que el club se entere") ya tiene su instrumento de captura construido.** Lo que falta no es el badge — es que ese dato llegue también al admin fuera de la pantalla de asistencia (ver §3).

### 1.5 Recordatorio por WhatsApp — YA CONSTRUIDO (parcial)
`frontend/src/pages/PaymentRemindersPage.tsx` + `frontend/src/lib/api/payment-reminders.ts`:
- Botón `sendWhatsApp` por recordatorio, usa `paymentRemindersAPI.sendWhatsAppReminder`, plantillas por escuela con `channel='whatsapp'`.
- Es manual (el admin hace clic), no automático — pero el camino de "reusar el botón que ya abre WhatsApp con plantilla" que proponía la v1.0 §6 **ya existe**, no hay que construirlo.

### 1.6 Finanzas — `OverdueAccountsCard` / `PaymentAgingCard`
`frontend/src/components/finances/`. Ya hay tarjetas de cartera vencida y aging en `FinancesPage.tsx`. Base para el informe semanal de §5.4, no partiendo de cero.

### 1.7 Extensión de vigencia al pagar — `trg_extend_enrollment_on_payment_paid` (CORREGIDO 2026-08-31, ver nota)
Trigger vivo sobre `payments`. Cuando un pago con `offering_plan_id` pasa a `'paid'` vía UPDATE, extiende `enrollments.expires_at`. Es el mecanismo de reactivación que cumple el rol de "grace/expired → active" de la v1.0, solo que sin los nombres de estado explícitos — **pero no es universal**.

**Nota (2026-08-31, horas después de escrita esta sección):** auditando un caso real (Luciana Herrera Cucaita / Dynasty) apareció que el trigger exige `NEW.offering_plan_id IS NOT NULL`, y tres rutas de cobro nunca setean esa columna — pago por QR (`generate_qr_monthly_charge`), registro manual sin cobro pendiente previo (`RegisterCashPaymentModal.tsx`, INSERT directo ya `'paid'`, ni dispara el trigger) y autopay/recurring charges (`recurring-charges.service.ts`, mismo INSERT directo). Medido en vivo: **77 inscripciones activas con plan** afectadas, 10 con `expires_at` ya en el pasado hoy. Detalle completo y plan de fix en [[project_enrollment_validity_periods]] (Bug 1b) y en `docs/specs/al-dia-y-alertas-de-sesiones.md`.

Esto **no invalida** el modelo de este spec — vive en `payments`, no en `expires_at` — pero sí significa que no se puede seguir citando este trigger como "ya resuelve la reactivación de vigencia" sin la salvedad de arriba. Si `fn_expire_overdue_enrollments` (§2) se corrige para respetar grace, sigue mirando `expires_at`, así que hereda el mismo punto ciego hasta que se resuelva Bug 1b.

---

## 2. BLOQUEADOR CRÍTICO — `fn_expire_overdue_enrollments` (drift, sin versionar)

**No está en el repo.** Vive en la base, cron `expire-overdue-enrollments`, 08:00 UTC (03:00 COT), **activo**, corriendo desde antes de este spec:

```sql
UPDATE enrollments
SET status = 'cancelled', updated_at = now()
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < v_today_col
  AND NOT ( -- excepción: plan por sesiones con sesiones sin usar
    offering_plan_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM offering_plans op
                WHERE op.id = offering_plan_id AND op.max_sessions IS NOT NULL
                  AND COALESCE(sessions_used, 0) < op.max_sessions)
  );
```

**Por qué es un bloqueador y no un detalle:**
- **No respeta `payment_grace_days`.** El mismo día que `expires_at < hoy`, cancela — cero gracia, mientras `apply_late_fees()` sí espera el grace period configurado por escuela. Dos motores con dos políticas de gracia distintas sobre el mismo concepto.
- **Cancela, no marca "vencido".** Pasa `active → cancelled` directo. No hay estado intermedio, no hay bandeja, no hay decisión del admin — exactamente lo opuesto al caso Milena Barrera que motivó este spec ("¿seguir o no?" ya lo decidió el cron, sin preguntar).
- **Sin aviso a nadie.** No dispara notificación, no toca `notification_deliveries`. El admin no se entera de que perdió una inscripción activa hasta que un padre pregunta por qué dejó de facturar.
- **Impacto medido en vivo (últimos 14 días): 2 inscripciones auto-canceladas, 1 escuela, 0 asistencias posteriores detectadas.** Bajo volumen hoy — pero es la razón de fondo por la que "el plan vencido no se nota": el sistema no lo deja vencido, lo mata.

**Esto tiene que resolverse ANTES de construir la escalera de estados**, porque cualquier estado `grace`/`expired` que se diseñe quedará pisado por este cron a las 03:00 COT si no se ajusta primero.

---

## 3. Otros bloqueadores para el modelo de la v1.0

| # | Bloqueador | Detalle |
|---|---|---|
| B1 | **Colisión de nombre `memberships`** | Ya existe `public.memberships` (mig. `20260817142331`, caso CAR-4 Club Carmel) — deliberadamente FUERA de facturación, sin montos, "ningún cron la mira" por diseño. Columnas `valid_from/valid_until` (no `end_date`), `status text CHECK IN ('active','expired','suspended')` (no el enum de 5 estados de v1.0). Tiene frontend propio: `MembershipsPage.tsx`, `useMemberships.ts`, `MembershipBadge.tsx`. **0 filas en producción hoy**, pero la semántica choca igual. |
| B2 | **`CREATE TYPE ... AS ENUM`** | Viola la convención documentada (`CLAUDE.md`, `docs/gotchas-tecnicos.md`) de `text + CHECK` para estados nuevos — la propia migración de `memberships` cita el dolor de `payments.status` como razón. |
| B3 | **`fn_expire_overdue_payments()` huérfana** | Otra función sin versionar en la base, no referenciada por ningún trigger, función ni cron activo. Redundante con la lógica de `overdue` que ya vive dentro de `apply_late_fees()`. Limpiar o documentar, no construir sobre ella. |
| B4 | **Adopción, no motor** | `late_fee_enabled`: 4/368 escuelas. Hay que confirmar `reminder_enabled` también — si el patrón se repite, el problema de "cobranza débil" es un problema de UX de activación (checkbox enterrado en Automatización de Pagos), no de falta de funcionalidad. |
| B5 | **Canal WhatsApp automatizado fuera de alcance** | [[project_whatsapp_wa1_wa2_built]]: token de prueba expira cada 2h, falta System User de Meta. El botón manual (§1.5) sigue siendo el camino korrecto para v1; automatizar la escalera por WhatsApp espera a MOD-15. |
| B6 | **Resend, 100 emails/día** | [[feedback_batch_pushes_vercel_quota]] y memoria de infra de correo: si la escalera se mueve a email masivo, hay que priorizar overdue > due_today > pre_due y degradar a solo-push, tal como ya proponía la v1.0 §5. |
| B7 | **`enroll_status` es un enum ya existente** (`active/cancelled/completed/pending`) | No tocarlo con `ALTER TYPE ... ADD VALUE` para meter `grace`/`paused`/`expired` — es otra dimensión (¿la inscripción existe?) distinta de la de cobranza (¿está al día?). Mezclar las dos en un solo enum vuelve inservibles las policies y reportes que ya filtran por `enroll_status`. |

---

## 4. Modelo corregido

**Principio:** no crear una tabla `memberships` nueva. Extender donde el estado YA vive: `enrollments` (vigencia), `payments` (deuda), `school_settings` (config por escuela). Lo nuevo es narrow y aditivo.

### 4.1 `enrollments` — agregar pausa (lo único que genuinamente no existe)

```sql
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS paused_reason text
      CHECK (paused_reason IN ('injury', 'vacation', 'other')),
  ADD COLUMN IF NOT EXISTS paused_at     timestamptz,
  ADD COLUMN IF NOT EXISTS paused_until  timestamptz;
```

- `paused_reason IS NOT NULL` = está pausado. No se toca `status` (`enroll_status` sigue siendo `active`) — la pausa es una propiedad de la vigencia, no un reemplazo del ciclo de vida de la inscripción.
- **`fn_expire_overdue_enrollments` y `apply_late_fees` deben excluir `paused_reason IS NOT NULL`** — es el fix que hoy no existe para "lesión/vacaciones" y por eso hoy se factura o se cancela mal a un pausado.
- Al reactivar: `expires_at = expires_at + (reactivated_at - paused_at)` (mismo mecanismo que ya usa `trg_extend_enrollment_on_payment_paid` para sumar vigencia, no reemplazarla).

### 4.2 Fix del bloqueador crítico — `fn_expire_overdue_enrollments`

Versionar en migración nueva (deja de ser drift) y corregir:
```sql
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND paused_reason IS NULL                              -- nuevo: no tocar pausados
  AND (expires_at + COALESCE(
        (SELECT payment_grace_days FROM school_settings ss WHERE ss.school_id = enrollments.school_id),
        0)) < v_today_col                                 -- nuevo: respeta el mismo grace que apply_late_fees
  AND NOT (...)                                            -- excepción de sesiones, igual que hoy
```
Y en vez de cancelar directo, emitir un evento (`collection.enrollment_expired`) al outbox para que la bandeja de cobranza (§4.4) lo capture ANTES de que se cancele — o, decisión de producto a confirmar: dejar de cancelar automáticamente y que la cancelación sea explícita desde la bandeja (Retirar). Ver §6, decisión pendiente D1.

### 4.3 Escalera de cobranza — extender lo que ya corre, no duplicarlo

`membership_events` de la v1.0 se descarta (no hay `memberships` sobre qué eventar). En su lugar:

```sql
CREATE TABLE public.collection_notices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id),
  payment_id    uuid NOT NULL REFERENCES public.payments(id),
  notice_type   text NOT NULL CHECK (notice_type IN
                  ('pre_due_3d','due_today','overdue_1d','overdue_3d','overdue_7d','admin_digest')),
  channel       text NOT NULL CHECK (channel IN ('in_app','email','push','whatsapp_link')),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, notice_type)   -- mismo dedup que proponía v1.0, anclado a payment_id no a membership_id
);
```

- `pre_due_3d`/`due_today` YA los emite `send_payment_reminders()` — extenderla para además escribir en `collection_notices` y encolar en `notification_deliveries` (outbox ya vivo, `dispatch_enabled=true` apuntando a `bffdev.sportmaps.co`) para que salga por email/push, no solo in-app.
- `overdue_1d/3d/7d` son el escalón que **no existe hoy** — se agregan a `apply_late_fees()` (mismo cron, mismo horario, evita un segundo cron paralelo) o a una función nueva `send_overdue_notices()` programada justo después.
- `admin_digest` alimenta la bandeja de cobranza y el informe semanal.

### 4.4 Bandeja de cobranza (nuevo, resuelve el caso Milena)

Vista/RPC que lista, por escuela, `payments.status = 'overdue'` cruzado con `school_athletes` para nombre/equipo, con tres acciones:
- **Renovar** → link de pago existente (mismo checkout, no un camino nuevo — [[project_payment_duplication_audit]] es explícito: no crear un segundo camino de generación de pagos).
- **Pausar** → setea `paused_reason/paused_at` en `enrollments` (§4.1).
- **Retirar** → llama a `set_school_athlete_status(p_active := false)`, que YA cancela plan y anula cartera pendiente (`supabase/migrations/20260730170000_deactivate_athlete_cancels_plan.sql`) — no reinventar esa lógica.

### 4.5 Informe semanal por grupo

Nuevo, pero con base: agrupar `school_athletes.payment_status` por `team_id`, cruzar con `payments` de la semana para "recaudado", reusar el patrón visual de `OverdueAccountsCard`/`PaymentAgingCard`. Snapshot en tabla nueva `weekly_collection_reports (jsonb)` si se quiere histórico — opcional para F1, no bloquea nada.

---

## 5. Qué es genuinamente nuevo (para no perder de vista el foco)

1. Estado `paused` (lesión/vacaciones) — **0% construido hoy**.
2. Escalón `overdue_1d/3d/7d` multicanal (hoy solo hay recargo, no aviso) — **0% construido**.
3. Bandeja de cobranza con Renovar/Pausar/Retirar — **0% construido** (aunque cada acción individual reusa algo que ya existe).
4. Informe semanal por grupo — **0% construido** como tal, pero con insumos ya listos.
5. Fix de `fn_expire_overdue_enrollments` (versionarla + grace + respetar pausa) — **es el ítem de mayor apalancamiento**: sin esto, cualquier estado nuevo se pisa solo.

Todo lo demás (motor de mora, recordatorio pre-vencimiento, badge de asistencia, botón WhatsApp manual, vista de estado de pago) **ya está construido y en producción** — el trabajo ahí es activación/adopción, no desarrollo.

---

## 6. Decisiones de producto pendientes (bloquean el plan de migración — no escribir código hasta resolver)

- **D1 — ¿`fn_expire_overdue_enrollments` deja de cancelar automáticamente, o solo se le agrega grace + pausa?** Cancelar automáticamente (con grace corregido) es más simple; mover la decisión 100% a la bandeja humana es más fiel al espíritu "Milena" pero dejaría inscripciones `active` indefinidamente vencidas si el admin nunca entra a la bandeja. Recomendación: agregar un tercer camino — sigue cancelando automáticamente, pero solo tras `overdue_7d` (mismo umbral que el último aviso), dando 7 días de bandeja antes del cierre automático.
- **D2 — ¿La escalera post-vencimiento reemplaza o convive con el recargo de `apply_late_fees`?** Hoy son independientes (mora cobra, nadie avisa). Deberían correr en el mismo cron/momento para que el padre reciba el aviso el mismo día que se le aplica el recargo, no una llamada separada.
- **D3 — Prioridad real: ¿construir la escalera, o primero subir adopción de `late_fee_enabled`/`reminder_enabled`?** Con 4/368 y probablemente similar en reminders, una escalera perfecta sin que las escuelas prendan el toggle no mueve el número. Sugerido: fase 0 = campaña/UX para subir adopción antes o en paralelo a la fase 1 de código.
- **D4 — ¿La pausa la puede pedir el padre o solo la aprueba el admin?** v1.0 dejaba esto abierto ("admin, o padre con aprobación del admin").

---

## 7. Plan de fases (reemplaza la tabla de la v1.0)

| Fase | Qué | Por qué en ese orden |
|---|---|---|
| 0 | **Versionar `fn_expire_overdue_enrollments` y `fn_expire_overdue_payments`** en migración nueva (sin cambiar comportamiento todavía) — saca ambas del drift. Confirmar D1-D4 con el usuario. | Sin esto, cualquier fase siguiente se construye sobre arena: el fix real vive en la base, no en el repo. |
| 1 | Fix de `fn_expire_overdue_enrollments`: respeta `payment_grace_days` y excluye pausados. Agregar columnas de pausa a `enrollments`. | Resuelve el bloqueador crítico antes de tocar notificaciones. |
| 2 | `collection_notices` + extender `send_payment_reminders`/`apply_late_fees` para escribir en el outbox (email/push) y agregar escalón `overdue_1d/3d/7d`. | La escalera es el componente que de verdad falta. |
| 3 | Bandeja de cobranza (Renovar/Pausar/Retirar) en frontend, reusando checkout + `set_school_athlete_status`. | Resuelve el caso Milena; depende de que §2 ya identifique a los vencidos. |
| 4 | Informe semanal por grupo. | Depende de tener el estado ya consolidado. |
| 5 | Piloto: Dynasty (mora apagada, mayor deuda de la plataforma) + la escuela de vóley grande en trial. Prender `late_fee_enabled`/`reminder_enabled` como parte del piloto, no asumir que ya están prendidos. | Ataca B4 (adopción) al mismo tiempo que se mide la fase de código. |

**No incluida:** asistencia offline-first y el rediseño de "3-5 taps" de la v1.0 §8.1/8.3 — el flujo actual de `CoachAttendancePage` ya tiene bulk-mark-presente y el badge de mora; si sigue siendo lento en la práctica, es una investigación aparte (medir con el club piloto), no una reescritura a ciegas.

---

## 8. Métricas de éxito (ajustadas)

- Escuelas con `late_fee_enabled` + `reminder_enabled` activos: de 4/368 a un objetivo concreto post-campaña de adopción.
- Inscripciones auto-canceladas por `fn_expire_overdue_enrollments` sin paso por la bandeja: de "no medido" a 0 (todas pasan por Renovar/Pausar/Retirar antes del cierre a los 7 días).
- % de `overdue` con `collection_notices` enviado en cada escalón (hoy: 0%, no existe el escalón).
- Deuda total vencida de la plataforma (~$57.2M verificado en vivo) — trackear tendencia post-piloto Dynasty.
