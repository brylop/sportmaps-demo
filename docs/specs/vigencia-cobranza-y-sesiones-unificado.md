# Spec unificado — Vigencia, cobranza y sesiones

**Proyecto:** SportMaps · **Fecha:** 2026-08-31 · **Versión:** 3.0
**Fusiona:** `cobranza-vencidos-estados-y-alertas.md` v2.0 (misma fecha) + `al-dia-y-alertas-de-sesiones.md` (misma fecha) — ambos quedan marcados como **fusionados aquí**, se conservan como detalle histórico pero este documento es la fuente de verdad desde ahora.
**Se apoya en, sin duplicar:** `plan-vigencia-por-periodo-pagado.md` (05-ago) e `inscripcion-vs-periodo-de-plan.md` (17/18-ago) para el diseño de `enrollment_periods` — este spec decide cuál de los dos es el vigente (§6, D6) en vez de repetir su contenido.

**Por qué fusionar:** los dos documentos originales se escribieron el mismo día, sobre la misma tabla (`enrollments`) y la misma tabla nueva propuesta (`collection_notices`), y uno invalidaba una línea del otro pocas horas después de escrito (el trigger de vigencia que la cobranza citaba como "ya resuelto" resultó tener un punto ciego de 77 inscripciones). Mantenerlos separados garantizaba que las próximas migraciones se pisaran entre sí.

---

## 1. Modelo mental — tres preguntas que hoy se confunden

| Pregunta | Responde | Tabla/columna | Estado hoy |
|---|---|---|---|
| **¿Existe la inscripción?** | pertenencia del atleta a escuela/equipo | `enrollments.status` (`active/cancelled/pending/completed`, enum ya existente) | Sano — no tocar con `ALTER TYPE` |
| **¿Está al día con la plata?** | deuda | `payments.status`, `school_athletes.payment_status`/`payment_due_date` | **Sano** — ya calculado bien, ver §2.3 |
| **¿Tiene acceso vigente para entrenar?** | vigencia + bolsa de clases | `enrollments.expires_at`, `sessions_used` | **Roto en dos frentes distintos**, ver §4 |

El error de fondo que atraviesa ambos documentos originales es tratar la tercera pregunta como si fuera la segunda (mostrar "Vence: {expires_at}" cuando lo que la familia necesita saber es "¿debo algo?"), y no darse cuenta de que la tercera está rota por DOS bugs independientes que se agravan entre sí (§4.1 y §4.2).

---

## 2. Inventario — lo que YA existe y funciona (verificado en código y base viva, 2026-08-31)

| # | Qué | Dónde | Estado |
|---|---|---|---|
| 2.1 | Motor de mora `apply_late_fees()` | `supabase/migrations/20260706120000_late_fee_engine.sql`, cron diario 07:00 UTC | Activo. Solo **4/368 escuelas** con `late_fee_enabled` |
| 2.2 | Motor de recordatorios `send_payment_reminders()` | `20260713000004_payment_reminders_engine.sql`, cron diario 13:00 UTC | Activo, solo in-app |
| 2.3 | Estado de pago por atleta — vista `school_athletes` | `20260804125913_school_athletes_payment_status_oldest_debt.sql` | **Sano.** `payment_status='paid'` = no debe nada, `payment_due_date` = vencimiento de la deuda más antigua sin saldar. No pasa por `expires_at` |
| 2.4 | Badge de mora en asistencia | `CoachAttendancePage.tsx` (~L182, L235, L601, L746) | Construido. Falta de saldo NO bloquea asistencia (regla de producto ya aplicada) |
| 2.5 | Recordatorio manual por WhatsApp | `PaymentRemindersPage.tsx` + `payment-reminders.ts` | Construido, manual (admin hace clic) |
| 2.6 | Cartera vencida / aging | `OverdueAccountsCard`/`PaymentAgingCard`, `FinancesPage.tsx` | Construido |
| 2.7 | `sessions_remaining` calculado en vivo | `attendance.ts:486` (`max_sessions - sessions_used`) | Construido, pero **la resta está sobre un contador roto** (§4.2) |
| 2.8 | Extensión de vigencia al pagar — `trg_extend_enrollment_on_payment_paid` | `20260717171018_extend_enrollment_on_payment_paid.sql` | Activo, **pero ciego en 3 rutas de cobro** (§4.1) — esto es lo que el spec de cobranza v2.0 daba por sano en su §1.7 y no lo es |
| 2.9 | Despachador de notificaciones (push web+nativo) | [[project_notifications_unified]] | Construido y validado en dev, falta go-live prod |

**Objetivo #1 de la cobranza ("cero deportistas asistiendo con plan vencido sin que el club se entere") ya tiene su instrumento de captura** (2.4) — lo que falta no es el badge, es que el dato llegue al admin fuera de esa pantalla (§5.4) y que el número de fondo sea confiable (§4).

---

## 3. Bloqueadores — los dos que importan, y cómo interactúan

### 3.1 Bloqueador A — `fn_expire_overdue_enrollments` cancela sin gracia ni aviso

**Drift, no está en el repo.** Cron `expire-overdue-enrollments`, 08:00 UTC (03:00 COT), activo:

```sql
UPDATE enrollments SET status = 'cancelled', updated_at = now()
WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < v_today_col
  AND NOT (offering_plan_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM offering_plans op WHERE op.id = offering_plan_id
      AND op.max_sessions IS NOT NULL AND COALESCE(sessions_used, 0) < op.max_sessions));
```

- No respeta `payment_grace_days` (mientras `apply_late_fees()` sí lo hace — dos políticas de gracia distintas para el mismo concepto).
- Cancela directo, sin estado intermedio, sin bandeja, sin aviso a nadie (no toca `notification_deliveries`).
- Impacto medido (14 días): 2 inscripciones auto-canceladas, 1 escuela, 0 asistencias posteriores. Bajo volumen — pero explica por qué "el plan vencido no se nota": el sistema no lo deja vencido, lo mata.

### 3.2 Bloqueador B — `trg_extend_enrollment_on_payment_paid` ciego en 3 rutas de cobro (hallado 2026-08-31, horas después de escrito el §1.7 que lo daba por sano)

El trigger exige `NEW.offering_plan_id IS NOT NULL`. Tres rutas nunca setean esa columna:

| Ruta | Dónde | Por qué falla |
|---|---|---|
| Pago por QR | `generate_qr_monthly_charge`, [`20260625000004_qr_pay_monthly.sql`](../../supabase/migrations/20260625000004_qr_pay_monthly.sql#L108) | INSERT nunca setea `offering_plan_id` |
| Registro manual sin cobro pendiente | [`RegisterCashPaymentModal.tsx:328`](../../frontend/src/components/payment/RegisterCashPaymentModal.tsx#L328) | INSERT directo ya `'paid'` — no es UPDATE, el trigger `AFTER UPDATE` ni se dispara |
| Autopay / recurring charges | [`recurring-charges.service.ts:137`](../../bff/src/services/recurring-charges.service.ts#L137) | Mismo problema: INSERT directo ya `'paid'` |

**Medido en vivo:** 77 inscripciones activas con plan tienen ≥1 pago `'paid'` que nunca las extendió (115 pagos, desde marzo). **10 ya tienen `expires_at` en el pasado hoy.**

### 3.3 Por qué A y B se agravan entre sí — y por qué B va primero

Un enrollment golpeado por B (el pago no extendió `expires_at`) queda con vigencia vieja. Si esa vigencia vieja cae en el pasado, **A lo cancela sin gracia al día siguiente** — una familia que pagó puntualmente por QR puede amanecer con la inscripción cancelada. Las 10 filas de §3.2 con `expires_at` ya vencido son candidatas directas a esto en el próximo corrido del cron de las 03:00 COT.

**Orden obligatorio: arreglar B antes que A**, o el fix de A (agregar `payment_grace_days`) solo pospone el problema unos días en vez de resolverlo — seguiría cancelando a alguien al día, más tarde.

### 3.4 Bloqueadores menores (sin cambios respecto al spec de cobranza v2.0 — se listan por referencia, detalle completo ahí)

`fn_expire_overdue_payments()` huérfana sin usar · colisión de nombre con `public.memberships` (0 filas, semántica distinta) · convención `text + CHECK` en vez de `CREATE TYPE` · adopción de `late_fee_enabled`/`reminder_enabled` (4/368) · canal WhatsApp automatizado fuera de alcance hasta MOD-15 · límite de Resend 100/día · `enroll_status` no se toca para meter estados de cobranza.

### 3.5 Bloqueador de diseño — `enrollment_periods` está propuesto DOS veces

`plan-vigencia-por-periodo-pagado.md` (05-ago) e `inscripcion-vs-periodo-de-plan.md` (17/18-ago) diseñan la misma tabla con columnas casi idénticas, sin que uno cite al otro como reemplazo. Bloquea la Fase 5 de este plan (§6) hasta resolver D6.

---

## 4. Por qué "acceso vigente" está roto — resumen de causa raíz

| Bug | Qué pasa | Consecuencia |
|---|---|---|
| **4.1 — Bloqueador B** (§3.2) | El pago no siempre extiende `expires_at` | "Vence" muestra una fecha vieja aunque la familia esté al día |
| **4.2 — `sessions_used` nunca resetea por periodo** | Contador acumulado de por vida, sin reset ni cron | "Restantes" (2.7) miente desde el segundo mes; al llegar al tope el atleta queda bloqueado **para siempre** aunque siga pagando. Hoy: 141 inscripciones con consumo > 0, 5 con la bolsa llena |
| **4.3 — la vigencia se regala y se suma** | BFF asigna `inicio + 30` hardcodeado al crear el plan, y el trigger (cuando sí dispara) **suma** en vez de cubrir | 1 mes pagado = 2 meses de acceso en ~145 casos medidos |
| **4.4 — Bloqueador A** (§3.1) | Cancela sin grace ni pausa | Corta acceso de gente al día, sin aviso |

Los cuatro son la razón por la que ni "al día + próximo corte" ni "sesiones restantes" se pueden construir hoy leyendo `expires_at`/`sessions_used` tal cual — hay que decidir, para cada capacidad, si depende del fix completo o puede rodearlo (§5).

---

## 5. Las dos capacidades nuevas — separadas por dependencia real

### 5.1 "Al día" + próximo corte — NO depende del rediseño, puede salir ya

Usa `school_athletes.payment_status`/`payment_due_date` (2.3, ya sano) — no toca `expires_at`. Cuando `payment_status = 'paid'`, el próximo corte se **calcula** (no se lee, porque el cobro del mes siguiente aún no existe) con la misma fórmula que ya usa `billingDue()` ([`enrollmentBilling.ts:72`](../../bff/src/services/enrollmentBilling.ts#L72)):

```
próximo_corte = MIN(school_settings.payment_cutoff_day del mes siguiente al último período pagado,
                     último día de ese mes)
```

Resultado visible propuesto: *"Al día · próximo corte: 10 oct 2026"* (al día) / *"Debe {concepto} · venció el {payment_due_date}"* (reusa el badge de mora ya construido, 2.4).

### 5.2 Sesiones restantes + alertas de vencimiento — SÍ depende de resolver 4.2

No se puede alertar "te quedan 2 clases" sobre un contador que ya sabemos que no resetea (4.2). Camino correcto: sobre `enrollment_periods` (D6 decide cuál diseño), con `sessions_used` por período — al acercarse al tope, encolar `sessions_low`; al cerrar un período con sobrante, `period_ending_unused` (el dato que la decisión de producto de vigencia ya pide mostrar: "que se venzan es el control").

**Atajo táctico** si hace falta algo antes del rediseño completo: "restantes este mes" = `max_sessions` − COUNT de asistencia real dentro de `[period_start, period_end]` derivado de `payments.period_year/month` (dato sano) — sin tocar `sessions_used`/`expires_at`. Solo sirve para avisar, no para bloquear; no cubre los 36 planes de duración no mensual. No construir si D6/Fase 5 arrancan pronto — es trabajo que se tira.

---

## 6. Decisiones de producto pendientes (unificadas — no escribir migraciones hasta resolver)

| # | Pregunta | Origen | Recomendación |
|---|---|---|---|
| **D1** | ¿`fn_expire_overdue_enrollments` deja de cancelar automático, o solo se le agrega grace+pausa? | cobranza v2.0 | Tercer camino: sigue cancelando automático, pero solo tras `overdue_7d`, dando 7 días de bandeja antes del cierre |
| **D2** | ¿La escalera post-vencimiento reemplaza o convive con el recargo de `apply_late_fees`? | cobranza v2.0 | Correr en el mismo cron/momento — el padre recibe el aviso el mismo día que se le aplica el recargo |
| **D3** | ¿Construir la escalera primero, o subir adopción de `late_fee_enabled`/`reminder_enabled` (4/368) primero? | cobranza v2.0 | Fase 0 = campaña/UX de adopción en paralelo a la Fase 1 de código |
| **D4** | ¿La pausa la pide el padre o solo el admin? | cobranza v2.0 | Abierta |
| **D5** | Fix del trigger ciego (Bloqueador B): ¿(a) las 3 rutas resuelven `offering_plan_id`, o (b) el trigger busca el enrollment activo como ya hace `auto_approve_payment`? | al-dia-y-alertas (mío) | Ver §7, Fase 1 — bloquea todo lo demás |
| **D6** | ¿Cuál `enrollment_periods` es la versión vigente — `plan-vigencia-por-periodo-pagado.md` o `inscripcion-vs-periodo-de-plan.md`? | al-dia-y-alertas (mío) | El segundo: más reciente, censo F0 ya hecho, `payment_id` nullable (representa período sin pagar) |
| **D7** | Umbral de "sesiones bajas": ¿fijo o configurable por escuela (como `payment_grace_days`)? | al-dia-y-alertas (mío) | Configurable, mismo patrón que ya existe |
| **D8** | ¿"Al día" notifica proactivamente (push/email) o solo se muestra en la ficha? | al-dia-y-alertas (mío) | Solo mostrar — avisar cada vez que alguien queda al día puede ser ruido no pedido |
| **D9** | Secuencia: ¿"al día+próximo corte" sale sola primero, o se espera a tener también sesiones? | al-dia-y-alertas (mío) | Sola primero — es independiente y rápida (§5.1) |
| **D10** *(nuevo, de esta fusión)* | Orden Bloqueador A vs B: confirmado en §3.3, B antes que A. ¿Se aprueba ese orden o hay una razón de negocio para invertirlo? | fusión | Mantener B → A |

---

## 7. Plan de fases unificado

| Fase | Qué | Depende de | Reemplaza |
|---|---|---|---|
| **0** | Confirmar D1-D10 con el dueño de producto. Documentar (versionar) `fn_expire_overdue_enrollments` y `fn_expire_overdue_payments` en migración nueva **sin cambiar comportamiento todavía** — sacarlas del drift. | — | Fase 0 cobranza |
| **1** | **Bloqueador B** (Bug del trigger, D5) en una sola migración: fix elegido + corrección puntual de las 10 filas con `expires_at` ya vencido + las 77 con pagos ciegos. Debe ir antes que la Fase 2 porque §3.3 lo exige. | Fase 0 (D5) | (nuevo, no estaba en ninguno de los dos originales) |
| **2** | **Bloqueador A**: `fn_expire_overdue_enrollments` respeta `payment_grace_days` y excluye pausados. Agregar columnas de pausa (`paused_reason/paused_at/paused_until`) a `enrollments`. | Fase 1 (si no, sigue cancelando gente que la Fase 1 recién dejó al día) | Fase 1 cobranza |
| **3** | "Al día + próximo corte" (§5.1): RPC/vista + BFF + reemplazar el texto de `expires_at` crudo en `SchoolStudentsManagementPage.tsx`/`CoachAttendancePage.tsx`/`AttendanceSupervisionPage.tsx`. | Fase 1 (para que el dato de abajo ya no contradiga) | Fase 2 al-dia (mío) |
| **4** | `collection_notices` con **todos** los `notice_type` definidos desde el día uno: `pre_due_3d, due_today, overdue_1d, overdue_3d, overdue_7d, admin_digest, sessions_low, sessions_exhausted, period_ending_unused` (unifica la tabla que proponían ambos documentos por separado — una sola migración, un solo `CHECK`). Extender `send_payment_reminders()`/`apply_late_fees()` para escribir ahí + outbox `notification_deliveries`. Los tipos de sesión quedan definidos pero sin emisor todavía. | Fase 0 (D2) | Fase 2 cobranza |
| **5** | Bandeja de cobranza (Renovar/Pausar/Retirar) en frontend, reusando checkout + `set_school_athlete_status`. | Fase 2 (pausa) + Fase 4 (identifica vencidos) | Fase 3 cobranza |
| **6** | `enrollment_periods` — versión que D6 decida, con las fases F1-F3 de ese documento de origen (tabla + RPC `grant_enrollment_period` + `move_session_credit` v2). | Fase 0 (D6) | F1-F3 plan-vigencia / inscripcion-vs-periodo |
| **7** | Emisores de `sessions_low`/`sessions_exhausted`/`period_ending_unused` sobre `collection_notices` (ya creada en Fase 4). | Fase 6 | Fase 4 al-dia (mío) |
| **8** | Informe semanal por grupo (agrupa `school_athletes.payment_status` por `team_id`). | Fase 4 | Fase 4 cobranza |
| **9** | Piloto: Dynasty (mora apagada, mayor deuda) + escuela de vóley grande en trial. Prender `late_fee_enabled`/`reminder_enabled` como parte del piloto. | Fases 2, 4, 5 | Fase 5 cobranza |
| **10** | QA: auditar que ninguna inscripción tenga vigencia > períodos pagados, que las 10+77 de §3.2 queden resueltas, y que 0 cancelaciones de Bloqueador A salten la bandeja. | Fase 9 | F6 plan-vigencia + cobranza §8 |

**No incluida:** asistencia offline-first / rediseño "3-5 taps" (ya resuelto en gran parte, ver 2.4) — investigación aparte si sigue siendo lento en la práctica.

---

## 8. Métricas de éxito (unificadas)

- Escuelas con `late_fee_enabled` + `reminder_enabled`: de 4/368 a objetivo post-campaña de adopción (D3).
- Enrollments con pago `'paid'` que no extendió `expires_at` (Bloqueador B): de **77 a 0**, medible con la misma query de auditoría usada hoy.
- Inscripciones auto-canceladas sin paso por la bandeja (Bloqueador A): de "no medido" a 0.
- % de `overdue` con `collection_notices` enviado en cada escalón: de 0% (no existe) a objetivo por definir.
- Deuda total vencida de la plataforma (~$57.2M verificado en vivo) — trackear tendencia post-piloto.
- Nueva: % de fichas de atleta mostrando "al día + próximo corte" en vez de un `expires_at` potencialmente incorrecto.

---

## 9. Riesgos (unificados)

- **F5-equivalente (Fase 6 de este plan) quita acceso a quien hoy lo tiene** — ~145 inscripciones con mes regalado y $0 pagado pasan a cortesía-hasta-`due_date`. Avisar a las escuelas antes.
- `school_athletes` es una vista con 12 LATERAL ya identificada como difícil de optimizar — agregar lecturas de `enrollment_periods` ahí puede pegarle a la latencia; resolver exponiendo el rango en la RPC de detalle, no en la vista del listado.
- Las 93 inscripciones con `start_date` reescrito por merges necesitan que el backfill reconstruya desde `payments`, no desde `start_date`.
- Fase 1 (fix del Bloqueador B) toca datos reales de Dynasty en la Supabase compartida — no ejecutar sin confirmación explícita sobre un reporte previo, mismo criterio que ya aplica el resto del proyecto para cambios de RLS/datos en vivo.
