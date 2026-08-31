# Spec — "Al día" con próximo corte, y alertas de sesiones restantes/vencidas

**Estado:** propuesta, pendiente de aprobación. No hay SQL escrito todavía.
**Fecha:** 2026-08-31 · **Origen:** caso Luciana Herrera Cucaita (Dynasty) — ver [[project_enrollment_validity_periods]], Bug 1b.

> **⚠️ FUSIONADO — 2026-08-31.** Este documento quedó incorporado en [`vigencia-cobranza-y-sesiones-unificado.md`](vigencia-cobranza-y-sesiones-unificado.md) (v3.0), junto con `cobranza-vencidos-estados-y-alertas.md`. Se conserva como detalle histórico — **la fuente de verdad es el documento unificado.**

---

## 0. Lo que se pidió, en dos capacidades

1. **"Al día"**: si el atleta no debe nada, decirlo claramente y mostrar la próxima fecha de corte (la del mes siguiente), en vez de una fecha de "Vence" que hoy puede estar rota (ver conversación anterior).
2. **Sesiones**: saber cuántas clases ha tomado, cuántas le quedan, e ir **avisando** —no solo mostrando— cuando quedan pocas o cuando se vencieron sin usar.

Estas dos capacidades tienen **riesgo y dependencias distintas** y no deberían tratarse como un solo bloque:

| | Capacidad 1 — Al día + próximo corte | Capacidad 2 — Sesiones + alertas |
|---|---|---|
| Fuente de datos | `payments` (ya correcta, ver §2) | `enrollments.sessions_used` (roto, ver §3.1) |
| Depende de arreglar vigencia (`expires_at`) | **No** | Sí, o de un atajo táctico (§3.3) |
| Puede salir esta semana | Sí | No sin antes decidir el modelo |

Este spec no reemplaza a los tres documentos que ya existen sobre esta zona — los conecta:

- [`docs/plan-vigencia-por-periodo-pagado.md`](../plan-vigencia-por-periodo-pagado.md) (2026-08-05) — el modelo de `enrollment_periods`, ya diseñado, pendiente de aprobar.
- [`docs/specs/inscripcion-vs-periodo-de-plan.md`](inscripcion-vs-periodo-de-plan.md) (2026-08-17/18) — el rediseño más amplio (una inscripción, N períodos), con censo F0 ya hecho.
- [`docs/specs/cobranza-vencidos-estados-y-alertas.md`](cobranza-vencidos-estados-y-alertas.md) (v2.0, **hoy mismo** 2026-08-31) — la escalera de avisos de mora (`collection_notices` + outbox), construida sobre `payments`, no sobre vigencia.

---

## 1. Bloqueador previo — Bug 1b, encontrado hoy, no estaba en ninguno de los tres documentos

Auditando el caso de Luciana (pagó agosto y septiembre, "Vence" se quedó en el 9-sep) apareció algo que **ninguno de los tres specs existentes tenía todavía**: el trigger que extiende `enrollments.expires_at` al aprobarse un pago (`fn_extend_enrollment_on_payment_paid`) exige `NEW.offering_plan_id IS NOT NULL`, y **tres rutas de cobro distintas nunca setean esa columna**:

| Ruta | Dónde | Por qué falla |
|---|---|---|
| Pago por QR (autogestión del padre) | `generate_qr_monthly_charge`, [`20260625000004_qr_pay_monthly.sql`](../../supabase/migrations/20260625000004_qr_pay_monthly.sql#L108) | El INSERT del cobro nunca setea `offering_plan_id` |
| Registro manual sin cobro pendiente previo | [`RegisterCashPaymentModal.tsx:328`](../../frontend/src/components/payment/RegisterCashPaymentModal.tsx#L328) | INSERTa ya `status:'paid'` — es INSERT, no UPDATE, el trigger `AFTER UPDATE` ni se dispara |
| Autopay / cobro recurrente | [`recurring-charges.service.ts:137`](../../bff/src/services/recurring-charges.service.ts#L137) | Mismo problema: INSERT directo ya `'paid'` |

**Medido en vivo, 2026-08-31: 77 inscripciones activas con plan** tienen ≥1 pago `'paid'` que nunca pudo extenderlas (115 pagos, desde marzo). **10 de esas 77 ya tienen `expires_at` en el pasado hoy** pese a seguir `active` y tener pagos recientes — candidatas a que `fn_expire_overdue_enrollments` las cancele mal. Detalle completo en [[project_enrollment_validity_periods]] (sección "Bug 1b").

**Por qué esto bloquea ambas capacidades de este spec:**

- **Capacidad 1** no lee `expires_at` para "al día" (usa `payments`, ver §2), así que **no está bloqueada por esto** — pero si en algún lugar de la UI se sigue mostrando "Vence: {expires_at}" al lado del nuevo indicador "al día", van a **contradecirse** (uno dice al día, el otro dice vencido). Hay que decidir qué pasa con esos textos existentes (§5).
- **Capacidad 2** si se construye sobre `enrollment_periods` (§3.2), el backfill (F5 del plan de vigencia) tiene que **reconstruir también estas 77 filas** desde `payments`, no confiar en su `expires_at` actual — están más dañadas que el resto de la base auditada el 2026-08-05.

**Nota para quien siga [`cobranza-vencidos-estados-y-alertas.md`](cobranza-vencidos-estados-y-alertas.md):** su §1.7 da por sentado que "al aprobarse un pago, `enrollments.expires_at` se extiende" — eso se escribió hoy mismo, antes de este hallazgo, y ya no es cierto en general. No bloquea ese spec (su modelo de cobranza vive en `payments`, no en `expires_at`), pero conviene corregir esa línea para que nadie construya encima asumiendo que el trigger es confiable.

**Recomendación:** arreglar esto ANTES de construir cualquier UI nueva de vigencia, con uno de dos caminos (a decidir, no excluyentes):

- **(a) Arreglar en el origen** — las 3 rutas resuelven el `offering_plan_id` del enrollment activo del atleta antes de insertar/actualizar el pago. Más código tocado (3 sitios), pero el dato queda correcto también para reportes que lean `payments.offering_plan_id` directamente.
- **(b) Arreglar en el trigger** — que deje de exigir `offering_plan_id` en el pago y en su lugar busque el enrollment activo por atleta+escuela, igual que ya hacen `auto_approve_payment` y `resolve_glosa` para reactivar inscripciones canceladas. Un solo sitio, pero no corrige `payments.offering_plan_id` en sí (sigue quedando NULL en esas filas para quien lea esa columna en otro lado).

Esto es independiente de si al final se construye `enrollment_periods` o no — con período o sin período, algo tiene que disparar la extensión/creación cuando el pago no trae el plan.

---

## 2. Capacidad 1 — "Al día" + próximo corte (bajo riesgo, no espera al rediseño)

### 2.1 Lo que ya existe y ya es correcto

`school_athletes` (vista, [`20260804125913_school_athletes_payment_status_oldest_debt.sql`](../../supabase/migrations/20260804125913_school_athletes_payment_status_oldest_debt.sql)) ya calcula, por atleta:

- **`payment_status`** = el estado del cobro pendiente **más antiguo sin saldar** (ignora `cancelled`/`rejected`/`failed`); si no debe nada, es el del cobro `paid` más reciente. `'paid'` = **no debe nada**, ya calculado.
- **`payment_due_date`** = el `due_date` de ese mismo cobro.

Este dato **no pasa por `expires_at`** — viene de `payments` directamente, la misma tabla que [[project_enrollment_validity_periods]] confirma que la facturación mensual (`open_month`/`generate_monthly_charges`) sí calcula bien. Es decir: **"¿debe o no debe?" ya está resuelto en la base hoy**, incluso para los 77 casos del §1 — el bug de ahí es de *vigencia de acceso*, no de *cobranza*.

### 2.2 Lo que falta: "próximo corte" cuando SÍ está al día

`payment_due_date` de `school_athletes` es el vencimiento del cobro que hay **ahora mismo** en la tabla. Si el atleta pagó todo lo emitido hasta hoy, ese cobro es el último `paid`, y su `due_date` es una fecha **pasada** — no sirve para responder "¿cuándo es el próximo corte?", porque el cobro del mes siguiente todavía no existe (lo crea `open_month` cerca de la fecha de corte de la escuela, no antes).

**Diseño propuesto:** cuando `payment_status = 'paid'` (al día), la próxima fecha de corte se **calcula**, no se lee, usando lo mismo que ya usa `billingDue()` ([`enrollmentBilling.ts:72`](../../bff/src/services/enrollmentBilling.ts#L72)):

```
próximo_corte = MIN( school_settings.payment_cutoff_day del mes siguiente al último período pagado,
                      último día de ese mes )
```

Es la misma fuente que ya usa la generación real de cobros (`getBillingConfig` + `payment_cutoff_day`), así que el número que se le muestra a la familia **coincide** con el que `open_month` va a emitir cuando llegue el momento — no hay dos criterios de corte conviviendo (el mismo error que `billingDue()` ya documenta haber corregido una vez, ver su comentario en el código).

Para el mes de referencia: `period_year`/`period_month` del último pago `'paid'` de ese atleta (ya poblados hoy, confirmado 682/682 en Dynasty por [`inscripcion-vs-periodo-de-plan.md`](inscripcion-vs-periodo-de-plan.md) §5) + 1 mes.

### 2.3 Resultado visible propuesto

En vez de (o al lado de, mientras se decide qué hacer con el texto viejo, ver §5) el "Vence: {expires_at}" actual:

- **Al día:** *"Al día · próximo corte: 10 oct 2026"*
- **Debe:** *"Debe {concepto} · venció el {payment_due_date}"* (reusa exactamente lo que ya pinta el badge de mora de `CoachAttendancePage.tsx`, no es nuevo)

### 2.4 Por qué esto no debe esperar al rediseño de vigencia

Es una lectura nueva sobre una tabla (`payments`) que ya está sana. No requiere migración de datos, no requiere `enrollment_periods`, no depende de que se resuelva el §1. Puede ir en un RPC/vista chico y salir independiente de las Fases F1-F6 del plan de vigencia.

---

## 3. Capacidad 2 — Sesiones tomadas/restantes + alertas de vencimiento (depende del rediseño)

### 3.1 Por qué el dato de hoy no sirve para alertar

`enrollments.sessions_used` es un contador **acumulado de por vida**, nunca se resetea por período (Bug 2, documentado en [[project_enrollment_validity_periods]] y ya confirmado en código: `attendance.ts:486` calcula `sessions_remaining = max_sessions - sessions_used` con ese mismo contador roto). Consecuencia concreta para este spec: **si se manda una alerta "te quedan 2 clases" hoy, sería mentira para cualquier atleta que ya completó un segundo mes** — el contador nunca bajó a 0 al empezar el mes nuevo, así que "restantes" ya venía mal antes de tocar nada de notificaciones. Notificar sobre un número que ya sabemos que está mal solo le da más visibilidad al error.

**No se puede construir la alerta sin antes resolver esto.** Es la misma razón por la que §1 del spec de cobranza dice que el fix de `fn_expire_overdue_enrollments` tiene que ir "ANTES de construir la escalera de estados" — mismo patrón, distinto bug.

### 3.2 Camino correcto: sobre `enrollment_periods` (ya diseñado, no construido)

El plan de vigencia ([`plan-vigencia-por-periodo-pagado.md`](../plan-vigencia-por-periodo-pagado.md) §2) ya propone que el consumo viva en el período, no en la inscripción, con `sessions_granted`/`sessions_used` por fila de `enrollment_periods` — eso **es** el prerequisito de esta capacidad, no un trabajo aparte. Sobre esa tabla, lo nuevo que agrega este spec:

- Al mover un crédito de sesión (`move_session_credit` v2, ya contemplado en F2 de ese plan): si el nuevo `sessions_used` del período llega a un umbral (ej. `max_sessions - 2`, o configurable por escuela), encolar un aviso `sessions_low`.
- Al cerrar un período (el día que empieza el siguiente, o el cron que hoy corre para vigencia): si el período que cierra tiene `sessions_used < sessions_granted`, encolar `period_ending_unused` con el número de clases que se vencieron sin usar — es exactamente el dato que la decisión de producto #4 del plan de vigencia dice que tiene que ser visible ("que se venzan *es* el control").
- Si `sessions_used >= sessions_granted` dentro del período: `sessions_exhausted` (bolsa agotada este mes, no es que el plan haya vencido).

Este camino hereda las Fases F1-F3 del plan de vigencia tal cual — no se duplica aquí.

### 3.3 Mitigación táctica, SI hace falta algo antes de F1-F3

Si la urgencia no permite esperar el rediseño completo, hay un atajo que **no toca** `sessions_used` ni `expires_at` (evita agravar el bug mientras se decide el modelo):

> "Restantes este mes" = `max_sessions` del plan − COUNT de asistencias reales del atleta con fecha dentro de `[period_start, period_end]`, donde el período se deriva de `payments.period_year/period_month` del cobro `paid` más reciente (dato ya sano, §2.2) — **no** de `enrollment_periods` ni de `expires_at`.

**Límites explícitos de este atajo, para que quede escrito y nadie lo tome por la solución final:**
- Es una lectura, no un contador con lock — no sirve para *bloquear* el agendamiento, solo para *avisar*. Bloqueo sigue siendo cosa de `move_session_credit` tal como está hoy (con su bug).
- Asume período = mes calendario. Para los 36 planes de `duration_days` 90/180/365 ([[project_enrollment_validity_periods]] los cuenta) no aplica — quedan fuera de esta mitigación hasta que exista `enrollment_periods`.
- Es estimado, no autoritativo: si el conteo de asistencia difiere del `sessions_used` real por alguna carrera de concurrencia, la alerta puede desfasarse un aula. Aceptable para un aviso, no para facturar ni para negar acceso.

**Recomendación:** no construir este atajo si F1-F3 del plan de vigencia van a arrancar en las próximas semanas — es trabajo que se tira. Solo tiene sentido si la capacidad 2 tiene que salir antes que el rediseño por alguna razón de negocio puntual.

---

## 4. Mecanismo de alertas — reusar lo que ya se está construyendo hoy, no un canal nuevo

`cobranza-vencidos-estados-y-alertas.md` (v2.0, hoy) ya diseña `collection_notices` + reutiliza el outbox `notification_deliveries` (el [[project_notifications_unified]] ya validado en dev, push web+nativo funcionando) para la escalera de mora. Este spec **no propone una tabla ni un canal nuevo** — propone sumar `notice_type` a esa misma tabla:

```sql
-- Extiende el CHECK de collection_notices.notice_type que ya propone
-- cobranza-vencidos-estados-y-alertas.md §4.3, no crea tabla aparte
'sessions_low', 'sessions_exhausted', 'period_ending_unused'
```

Y para la Capacidad 1, si se decide que "al día" también dispara algo proactivo (ej. confirmación de "quedaste al día, tu próximo corte es X") — no es indispensable, es solo mostrar el dato en la ficha (§2.3) — pero si se quiere, reusa el mismo `channel IN ('in_app','email','push','whatsapp_link')` ya definido ahí.

Esto evita construir un segundo despachador cuando ya hay uno validado y otro spec en curso montándose sobre él.

---

## 5. Qué pasa con el "Vence: {expires_at}" que ya se muestra hoy

Mientras el §1 no se resuelva, cualquier pantalla que siga mostrando `expires_at` crudo (el modal de `SchoolStudentsManagementPage.tsx`, el badge de `CoachAttendancePage.tsx`/`AttendanceSupervisionPage.tsx`) puede seguir mostrando fechas atrasadas para atletas al día — es el síntoma original de esta conversación. Dos opciones, no excluyentes, a decidir con el dueño de producto:

- **Corto plazo:** en las pantallas que ya van a tocarse para la Capacidad 1, reemplazar la lectura de `expires_at` por el resultado de §2 ("Al día · próximo corte" / "Debe · venció el"), que es correcto hoy sin esperar nada. El "Vence" de vigencia (relacionado a sesiones/plan) queda aparte, alimentado por §3 cuando exista.
- **Mediano plazo:** una vez resuelto §1(a) o §1(b), `expires_at` vuelve a ser confiable y puede seguir mostrándose donde tenga sentido (vigencia de *acceso*, no de *cobranza* — son preguntas distintas, ver tabla de conceptos en [`inscripcion-vs-periodo-de-plan.md`](inscripcion-vs-periodo-de-plan.md) §1).

---

## 6. Cómo encajan los cuatro documentos

```
Bug 1b (este spec, §1)          ← hoy, urgente, chico: 1 migración
   corrige el trigger o las 3 rutas de cobro
        │
        ├── Capacidad 1 — "al día" + próximo corte (este spec, §2)
        │      NO depende de lo de abajo. Puede salir ya.
        │
        └── plan-vigencia-por-periodo-pagado.md F1-F3
               (enrollment_periods + grant_enrollment_period)
                    │
                    └── Capacidad 2 — sesiones + alertas (este spec, §3)
                           depende de que F1-F3 exista

inscripcion-vs-periodo-de-plan.md
   (rediseño más amplio, censo F0 ya hecho)
   → su F1 es compatible con enrollment_periods de arriba;
     si se aprueba, absorbe el trabajo de F1-F3 del plan de vigencia
     en vez de duplicarlo (ambos documentos proponen la misma tabla)

cobranza-vencidos-estados-y-alertas.md v2.0
   → ya construye collection_notices + outbox
   → este spec (§4) se apoya en esa tabla en vez de duplicarla
   → su §1.7 necesita una corrección de una línea (ver §1 de este spec)
```

**Nota de duplicación a resolver antes de escribir migraciones:** `plan-vigencia-por-periodo-pagado.md` e `inscripcion-vs-periodo-de-plan.md` proponen **la misma tabla** (`enrollment_periods`) con columnas casi idénticas, diseñada en fechas distintas (05-ago y 17-ago) sin que uno cite al otro como reemplazo explícito. Antes de escribir la migración de F1 hay que decidir cuál de los dos es la versión vigente — probablemente el segundo (más reciente, con censo F0 ya hecho y con el fix de "período con `payment_id` nullable" que el primero no tenía) — y dejarlo escrito para que quien llegue después no reconstruya la misma tabla dos veces.

---

## 7. Decisiones pendientes (bloquean el plan de migración)

- **E1 — Fix del trigger:** ¿camino (a) resolver `offering_plan_id` en las 3 rutas de cobro, o camino (b) el trigger busca el enrollment activo como ya hacen `auto_approve_payment`/`resolve_glosa`? (§1)
- **E2 — Cuál `enrollment_periods` es la versión vigente:** ¿el de `plan-vigencia-por-periodo-pagado.md` (05-ago) o el de `inscripcion-vs-periodo-de-plan.md` (17-ago)? (§6)
- **E3 — Umbral de "sesiones bajas":** ¿fijo (ej. quedan 2) o configurable por escuela como ya son `payment_grace_days`/`reminder_days_before`? (§3.2)
- **E4 — ¿Se avisa "al día" proactivamente o solo se muestra?** (§4) — mostrarlo es gratis; avisar por push/email cada vez que alguien queda al día puede ser ruido que nadie pidió.
- **E5 — Prioridad de secuencia:** ¿Capacidad 1 sale sola primero (es independiente y rápida), o se espera a tener también Capacidad 2 para lanzar juntas? Recomendación: Capacidad 1 sola primero — no tiene sentido hacerla esperar por algo que depende de un rediseño todavía no aprobado.

---

## 8. Fases propuestas

| Fase | Qué | Depende de |
|---|---|---|
| **F0** | Resolver E1-E2 con el dueño de producto. Sin código. | — |
| **F1** | Migración: fix del trigger/rutas de cobro (§1). Incluye corregir las 10 filas ya con `expires_at` en el pasado y las 77 con pagos ciegos (mismo criterio que usaría el backfill F5 del plan de vigencia, pero acotado a estas filas — no hace falta esperar el rediseño completo para este parche puntual). | F0 (E1) |
| **F2** | RPC/vista "al día + próximo corte" (§2) + BFF + reemplazo del texto en las pantallas que hoy muestran `expires_at` crudo (§5). | F1 (para que el dato de debajo ya no contradiga) |
| **F3** | `enrollment_periods` — la versión que E2 decida, con las fases F1-F6 ya detalladas en su documento de origen. | F0 (E2) |
| **F4** | Alertas de sesiones (`sessions_low`/`sessions_exhausted`/`period_ending_unused`) sobre `collection_notices` (§3.2, §4). | F3 + que `cobranza-vencidos-estados-y-alertas.md` tenga `collection_notices` ya creada |

**No incluida en este spec:** la escalera de mora (`overdue_1d/3d/7d`) — eso es 100% de `cobranza-vencidos-estados-y-alertas.md`, este documento solo le agrega tipos de aviso nuevos en §4, no rediseña esa parte.
