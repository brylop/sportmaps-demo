# Spec: Dreamers — Niveles por horas y progresión competitiva

**Escuela:** Dreamers Gymnastics (`57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe`)
**Archivo:** `docs/specs/dreamers-niveles-por-horas-y-progresion.md`
**Estado:** ✅ Decisiones D1–D19 cerradas — F1 (planes por horas + inscripción) tiene plan de implementación completo (§9), sin bloqueantes. F2/F6 requieren un dato de verificación en vivo antes de escribir código (ver §8).
**Última consolidación de producto:** 2026-08-25 (D1-D16) + 2026-08-27 (D17-D19, cobro de inscripción)
**Verificación de impacto contra el código real:** 2026-08-27 (§8)
**Patrón transversal del repo:** *sugerido, nunca automático* para toda acción financiera.

---

## §0 — Contexto y alcance

Dreamers vende planes por **paquete de horas totales por período**, armado como **bloque de sesión (2h / 3h / 4h por clase) × días de entrenamiento por semana** — no un número plano de "horas semanales". Ej.: un plan de bloque 3h con 8 clases/mes = 24h incluidas en el mes (ver el cálculo real en §3.1). Estos planes están ligados a **niveles competitivos** de gimnasia (programa USAG Masificación de FEDECOLGIM: Prenivel y Niveles 1–8). Este spec cubre **cuatro pedidos distintos**:

1. **Niveles por horas** — planes con bloque de sesión propio (2h/3h/4h por clase) y días/semana propios, simultáneos entre sí, que en conjunto arman el paquete total de horas del período.
2. **Progresión competitiva** — carga de puntajes de competencia, vista de elegibilidad de ascenso y aviso al owner cuando una atleta cumple el umbral.
3. **Alta a mitad de mes** — modos de primer pago (`full_month` / `remaining_classes`) y cobro de sesiones excedentes.
4. **Cobro de inscripción/matrícula (2026-08-27, hallazgo del día).** Dreamers cobra un pago único de inscripción, distinto y aparte de la mensualidad, al dar de alta a una atleta. **SportMaps hoy no tiene esto en ningún lado del producto** — el alta genera un solo cobro (la mensualidad); no existe columna de precio de inscripción, ni una segunda fila de `payments`, ni UI para configurarlo. El único workaround es 100% manual (un admin registra un pago en efectivo con concepto de texto libre "Inscripción", sin pasar por checkout online). Ver D17-D19 y el plan en §9.

**Corte del spec:** F1–F3 (niveles + puntaje + aviso) es un producto coherente con dependencias baratas y se implementa primero. F5–F7 (excedentes, entrenador+horario, enganche) dependen de la deuda `program_id → offering_id` (R5) y van al final o a spec aparte. **El cobro de inscripción (pedido 4) se suma al alcance de F1** — misma tabla (`offering_plans`), mismo nivel de riesgo (columna nullable, sin dependencias), cero relación con niveles/competencia/banco de horas.

---

## §1 — Modelo de datos

### 1.1 `offering_plans` (columnas nuevas, todas nullable)

| Columna | Tipo | NULL = | Decisión |
|---|---|---|---|
| `session_block_minutes` | `integer` | hereda `school_settings.hours_session_block_minutes` | D1 |
| `included_sessions_per_week` | `integer` | sin dato (display-only) | D2 |
| `allowed_days_of_week` | `integer[]` | sin restricción de días | D9 |
| `promotion_threshold_points` | `numeric` | sin umbral de ascenso | D15 |
| `promotion_min_competition_level` | `text` CHECK (`club/regional/nacional/federacion`) | sin nivel mínimo | D15 |
| `registration_fee` | `numeric` CHECK (`>= 0` o NULL) | sin cobro de inscripción (comportamiento actual de las 367 escuelas restantes) | D17 |

- **Fuente de verdad de horas:** `included_minutes_per_period`. `included_sessions_per_week` es informativa (UI/venta: "3 días × 2h"). Validación en el form de admin: *warning* si `sessions_per_week × block_minutes × ~4.33 ≠ minutes_per_period` (nunca CHECK duro — los meses no tienen semanas exactas).
- El umbral se lee en el plan **destino**: "para entrar a este plan necesitás X puntos en nivel Y o superior". Editable por el owner cada año (FEDECOLGIM actualiza los puntajes de ascenso anualmente por resolución).

### 1.2 `competition_results` (columnas nuevas)

| Columna | Tipo | Nota |
|---|---|---|
| `points` | `numeric` NULL | nullable — hay `result_type` que no son puntaje (D3) |
| `competition_level` | `text` CHECK (`club/regional/nacional/federacion`) | convención del repo text+CHECK (D3) |

Estas columnas **no** llevan flag: cualquier escuela puede llenarlas o ignorarlas. El flag controla solo la mecánica que reacciona a ellas (F2/F3).

### 1.3 `school_settings`

| Config | Valor Dreamers | Nota |
|---|---|---|
| `billing_cycle_type` | `fixed_calendar` (cambio desde `prorated`) | ver §4.1 y guardarraíl §4.5 |
| `payment_cutoff_day` | `5` | ventana de pago días 1–5 |
| `level_progression_enabled` | `true` (nueva columna, default `false`) | D6 — mismo patrón del banco de horas |
| Recargo/descuento 5% (D16) | pendiente los 2 números exactos | ver §4.2 |

### 1.4 `enrollments` / flujo de alta

| Campo | Tipo | Nota |
|---|---|---|
| `first_payment_mode` | `text` CHECK (`full_month` / `remaining_classes`) | **por alta, jamás en `school_settings`** (D12/D14b) |

---

## §2 — Decisiones (todas cerradas)

### Grupo A — Arquitectura

- **D1 — Bloque por plan: SÍ, con fallback.** `offering_plans.session_block_minutes` nullable; NULL hereda el valor de escuela. Sin esto no existen 2h/3h/4h simultáneos. El fallback protege R2.
- **D2 — `included_sessions_per_week`: SÍ, display-only documentada.** Fuente de verdad: minutos. Warning en form de admin contra desincronización.
- **D3 — `points numeric` + `competition_level text` con CHECK: SÍ.** Catálogo `club/regional/nacional/federacion`. `points` nullable.
- **D4 — Sugerida, nunca automática: SÍ.** Todo lo que mueva `monthly_fee` requiere confirmación del owner. Mismo patrón que todo el repo.
- **D6 — Flag por escuela, Dreamers primero: SÍ.** `level_progression_enabled` default `false`, copiando el patrón del banco de horas.
- **D7 — El período abierto no se recalcula en upgrade: SÍ como default.** Es lo que el código ya hace (copia `included_minutes` al abrir período). Efecto inmediato = F4+, no ahora.
- **D11 — Dos modos de reserva conviven: SÍ, con ajuste.** La visita del plan sigue siendo "hoy voy" *en cuanto a hora*, pero el torniquete (check-in ZKTeco) **sí valida `allowed_days_of_week`** si el plan lo define. Sin esto, D9 es decorativa para el 90% del uso (una atleta Nivel 2 pasaría un lunes sin que nadie la pare). No reabre la flexibilidad de hora de D-11 del spec de banco de horas — solo agrega el filtro de *día*. **Corrección de alcance en §8.2: el BFF puede registrar la violación, pero no puede bloquear físicamente el paso — ver decisión pendiente D11b.**
- **D13 — Combo de enganche como composición, no plan nuevo.** "2 de agosto + 8 de septiembre = 10" es una **cotización** de dos períodos existentes (parcial + completo), nunca un tipo de plan nuevo.
- **D15 — El umbral vive en `offering_plans` (plan destino).** `promotion_threshold_points` + `promotion_min_competition_level`. La vista de elegibilidad es un join directo. Umbral por categoría de edad se resuelve con planes distintos por categoría, sin tabla nueva.

### Grupo B — Confirmadas con Dreamers / FEDECOLGIM

- **D5 — Evaluación ANUAL, por temporada federativa.** No hace falta job programado: vista de elegibilidad a demanda + aviso F3 al cargar un resultado que cumple.
- **R4 — Umbral por nivel, publicado por FEDECOLGIM, actualizado por año.** FEDECOLGIM corre el programa USAG Masificación (Prenivel–Nivel 8) y publica por resolución los puntajes de ascenso de nivel, actualizados anualmente. El "+35" del pedido original ≈ mobility score estilo USAG (~34–35 AA) de un nivel específico, no un número universal. Consecuencia: `promotion_threshold_points` es **editable por el owner**, jamás hardcodeado — al salir la resolución del año siguiente, Dreamers lo actualiza en el panel.
- **F0 — Flujo de resultados confirmado: la federación envía, la escuela carga.** `competition_results` no queda huérfana de dueño del dato → F2/F3 viables. Detalle pendiente (dato, no decisión): *quién* en Dreamers carga (owner o coach), para saber a quién llega el aviso de F3.
- **D8 — Valor de sesión excedente: UNO por plan completo.** Fórmula §3.1: `price ÷ horas_incluidas`, sin tarifa especial de excedente. Nota documentada (no bloqueante): cada plan deriva su propio valor_hora, así que el excedente de una atleta de plan chico cuesta distinto que el de plan grande — **comportamiento aceptado**, se documenta para que nadie lo reporte como bug. El cargo de excedente sigue D4: el sistema calcula `valor_hora × horas_extra` y genera un cargo *pendiente de confirmación* del owner (extiende D-10 del banco de horas de "solo notifica" a "notifica con cargo pre-calculado", sin facturación automática).
- **D14 — Dos filas de `payments` SIEMPRE**, cada una con su `period_year/period_month` correcto. Pueden cobrarse juntas en una transacción de Wompi, pero son dos registros. Razón: la cicatriz de Dynasty (12 atletas / $1.730.000 aparcados por período ambiguo, documentada en el header de `prorationUtils.ts`) y los reportes R0–R5 que leen por período.
- **D14b — Vencimiento del parcial configurable en el alta.** Default = se paga hoy (alta). Opción B = ambas filas se crean en el alta pero la parcial queda pendiente con `due_date` = 1 del mes siguiente y ese día se cobran juntas. **Se implementa como override de `due_date` de la primera fila, JAMÁS como valor nuevo de `billing_cycle_type`.** Advertencia comercial explícita: en la B la atleta entrena fiada del alta al fin de mes — decisión de la escuela (elección del owner), no del sistema. Si la fila vence y no se paga → flujo `payment_overdue` existente, cero mecánica nueva. El pago registrado en septiembre con `period_month = agosto` es el caso ya validado por `project_late_payment_manual_registration`.

### Grupo C — Cerradas en cascada

- **D9 — `allowed_days_of_week integer[]`: SÍ.** Validado en torniquete Y en SlotPicker (por D11). Falta el dato de días exactos por nivel. **Ver corrección de alcance en §8.2 antes de escribir F6.**
- **D10 — Reusar `school_availability` migrando `program_id → offering_id`: SÍ.** Es la dependencia más cara (deuda MOD-14). Consecuencia: **F6 va al final o a spec aparte.** **Ver §8.4 — la premisa de esta decisión (que la tabla hoy cuelga de `program_id`) ya no es cierta en la base real; hay que reabrir el diagnóstico antes de escribir la migración.**
- **D12 — RESUELTA EXACTA con input manual.** Dreamers piensa en **clases, no días**: alta el 24 con plan 723k/8 clases → 2 clases = `723.000 ÷ 8 × 2 = 180.750` (vs. `prorated` por días: `723.000 × 7/31 = 163.258`). Solución: el **owner ingresa cuántas clases quedan** y el sistema calcula `clases_restantes × (price ÷ clases_del_periodo)`, con `clases_del_periodo = included_minutes_per_period ÷ session_block_minutes` (ambas columnas ya existen — la primera del banco de horas, la segunda la crea F1/D1). **Corregido 2026-08-27: la redacción original decía `included_sessions_per_month`, columna que no existe — F1 solo crea `included_sessions_per_week` (semanal, display-only). Usar minutos÷bloque da el conteo exacto del período (8 clases en el ejemplo de Dreamers, sin aproximar por semanas × 4.33 como haría derivarlo de D2).** Cero motor de calendario, cero dependencia de F6. El cálculo automático por horario real queda como mejora futura ligada a F6.
- **D16 — El 5% después del día 5: elegir (a) o (b) con los dos números exactos de Dreamers.**
  - **(a) Reusar `earlyPaymentDiscount` (cero código):** `monthly_fee` se configura como el precio *con recargo* y días 1–5 aplica descuento pronto pago. Comercialmente suena mejor ("descuento por pagar a tiempo").
  - **(b) Recargo real (código nuevo):** fee base + 5% al vencer el día 5, columna nullable en `school_settings` (NULL = sin recargo).
  - Matemática a cerrar: **5% de recargo ≠ 5% de descuento** (723.000 → 759.150 después del día 5 equivale a 4,76% de descuento, no 5%). Pregunta de una línea a Dreamers: *¿cuáles son los dos precios exactos (hasta el día 5 / después)?*
  - Regla de interacción con D14b-B: **el descuento pronto pago se evalúa contra `due_date` pactado, no contra `created_at`** — si el owner pactó vencimiento 1 de sept y el padre paga ese día, pagó a tiempo. (Confirmar con Dreamers en un mensaje de una línea.)
  - **Corrección de alcance en §8.3: la opción (a) es "cero código" solo si el descuento sigue viviendo únicamente en el frontend, como hoy. Si Dreamers necesita que el servidor valide el monto cobrado, (a) deja de ser gratis.**

### Grupo D — Cobro de inscripción/matrícula (nuevo, 2026-08-27)

Confirmado por verificación de código (no solo memoria/spec): **SportMaps no tiene hoy ningún concepto de cobro único de inscripción separado de la mensualidad.** El alta genera exactamente un `payments.insert` (la mensualidad, `payment_type: 'subscription'`); `offering_plans` tiene un solo campo de dinero (`price`). Es además una decisión de arquitectura activa, no un olvido: `docs/plan-asistencia-y-creditos-de-sesion.md:5-6` ("nunca dos montos ni dos cobros") y `docs/specs/sport-categories-and-multi-category.md:310-323` ("un solo cobro", protegido por el índice único `uniq_payment_active_period_per_child`). Dreamers sí maneja un cobro de inscripción aparte — hay que construirlo sin romper esa regla, apoyándose en que la regla protege cobros **con período** (mensualidades), y una inscripción no tiene período.

- **D17 — SÍ, columna nueva `offering_plans.registration_fee` (nullable).** NULL = sin inscripción (comportamiento actual de todas las escuelas, incluida Dreamers hasta que se llene el campo). Vive en el **plan**, mismo patrón que `price` — permite que el monto varíe por nivel si Dreamers lo pide, aunque hoy probablemente sea el mismo en los tres. Sin `CREATE TYPE`, sin flag: es un dato pasivo (igual que D1/D2/D9/D15), la mecánica que reacciona a él (el cobro en el alta) es simple e incondicional — no requiere `level_progression_enabled` ni ningún flag nuevo.
- **D18 — Se cobra en cada alta (cada fila nueva de `enrollments`), no una vez en la vida del atleta.** Es la lectura más simple y la única que el modelo actual puede sostener sin tabla nueva de "historial de inscripciones pagadas". Excepción explícita: un **upgrade de plan sobre una inscripción ya activa** (F4, cambio de `offering_plan_id` sin crear fila nueva) **no** dispara un segundo cobro de inscripción — solo un alta nueva la dispara. **Dato pendiente para Dreamers (no bloquea F1, sí importa antes de activar el cobro): si una atleta se da de baja y vuelve a inscribirse meses/años después, ¿paga inscripción otra vez?** Default propuesto: sí (misma regla, alta nueva = fila nueva = cobro nuevo), salvo que Dreamers diga lo contrario.
- **D19 — Tercera fila de `payments`, `payment_type: 'one_time'`, sin período.** Encaja exacto en el enum ya existente (`'one_time' | 'subscription'`) sin tocar el `CHECK`. Con `period_year`/`period_month = NULL` **no choca** con `uniq_payment_active_period_per_child` (el índice es parcial, solo aplica a filas con período no nulo) — es matemáticamente un cobro distinto, no un segundo cobro del mismo período, así que no reabre la regla de "un solo cobro" que protege ese índice. `concept: 'Inscripción — {nombre del plan}'`. Se crea en la MISMA operación de alta que ya crea la(s) fila(s) de mensualidad (`students-create-one.route.ts`) — si D14/F7 aplica (`remaining_classes`), un alta podría generar hasta 3 filas de `payments` (inscripción + parcial + mes siguiente); sin F7, 2 filas (inscripción + mensualidad). Cobro visible al padre en el checkout, igual que ya pasa con la mensualidad — no es "sugerido, nunca automático" en el sentido de D4 (eso aplica a cambios sobre inscripciones ya activas, no al armado inicial del alta).

---

## §3 — Facturación Dreamers (estado objetivo)

### 3.1 Ciclo

- `billing_cycle_type = 'fixed_calendar'` + `payment_cutoff_day = 5`. Mes calendario, ventana de pago días 1–5, 5% adicional después (D16).
- **Bonus:** `fixed_calendar` alinea perfecto con `hour_bank_periods` (ambos mes calendario) — la incompatibilidad latente de `rolling_30` desaparece para Dreamers.

### 3.2 Alta a mitad de mes — `first_payment_mode` (por alta, elegido por el owner)

| Modo | Cobra hoy (alta 24/08) | Cobra el 1/09 |
|---|---|---|
| `full_month` | Mes completo de agosto (nativo de `fixed_calendar`) | Septiembre normal |
| `remaining_classes` | `clases_restantes × (price ÷ (included_minutes_per_period ÷ session_block_minutes))` — clases ingresadas por el owner | Septiembre normal |

Siempre dos filas de `payments` (D14). `remaining_classes` es fórmula nueva y chica: **nace directo en el BFF como fuente única**, sin duplicar en frontend.

### 3.3 Los tres ciclos existentes (censo verificado en código)

| `billing_cycle_type` | Nombre en app | Comportamiento |
|---|---|---|
| `prorated` (default en altas nuevas — `students-create-one.route.ts:352`) | Prorrateado automático | `(días_restantes / días_del_mes) × monthly_fee` |
| `fixed_calendar` (default cuando NULL en BD — `hour_bank_move_rpc.sql:80`) | Mensualidad fija por calendario | mes completo siempre, vence en `payment_cutoff_day` |
| `rolling_30` | Ciclo de 30 días desde inscripción | encadena 30 días desde `start_date`, sin ancla calendario |

No existe un cuarto valor (grep en migraciones, BFF y frontend). Asimetría anotable: default NULL→`fixed_calendar` en la RPC vs. default `prorated` en altas nuevas — dos defaults distintos según la capa; no es bug hoy (Dreamers tiene valor explícito), pero es material del census.

### 3.4 Composición completa del cobro en el alta (con inscripción, D17-D19)

| Escenario | Filas de `payments` que crea el alta |
|---|---|
| Escuela sin `registration_fee` (367 escuelas restantes, hoy) | 1 — mensualidad (`subscription`). Cero cambio. |
| Dreamers, plan con `registration_fee`, sin F7 (`full_month`) | 2 — inscripción (`one_time`, sin período) + mensualidad del mes de alta (`subscription`). |
| Dreamers, plan con `registration_fee`, con F7 (`remaining_classes`) | 3 — inscripción (`one_time`) + parcial del mes de alta + mes siguiente completo (D14, ambas `subscription`). |

Pueden cobrarse juntas en una sola transacción de checkout (Wompi/MP) — mismo principio que D14 ("un cobro combinado, varios registros"). El flujo de pago pendiente que ya usa el padre para pagar varias filas juntas (heredado de D14/F7) no necesita diseño nuevo para la inscripción: es una fila pendiente más, del mismo tipo de operación que ya existe.

---

## §4 — Aislamiento multi-escuela (reglas obligatorias)

1. **Toda columna nueva es nullable, y NULL significa "exactamente lo que el sistema hace hoy".** El deploy de las migraciones es un no-evento para las demás escuelas — cero filas existentes tocadas.
2. **Toda mecánica activa nueva va detrás de flag por escuela, default `false`.** Única mecánica activa de este spec: F2/F3 (avisos de progresión) → `level_progression_enabled`, activo solo en Dreamers.
3. **Prohibido hardcodear `school_id`.** Cero referencias al UUID de Dreamers en migraciones o lógica. Dreamers es la primera *config*, no un caso especial del código. Carmel (gimnasia, ~800 atletas, mismo deporte federado, en trial) es candidata obvia: activar esto para ella debe ser prender un flag y llenar columnas, no un desarrollo.

Tabla de aislamiento por regla:

| Regla nueva | Mecanismo | Efecto en otras escuelas |
|---|---|---|
| Ciclo 1–30 + corte día 5 | config por escuela ya existente | ninguno |
| 5% (D16) | `earlyPaymentDiscount` por escuela, o columna nullable | ninguno |
| Bloques 2h/3h/4h (D1) | columna nullable con herencia | planes existentes en NULL = idéntico a hoy |
| D2/D9/D15 | columnas nullable | NULL = sin restricción/umbral |
| `first_payment_mode` | por alta, default = comportamiento actual del ciclo | un alta en otra escuela ni ve la opción |
| Progresión F2/F3 | `level_progression_enabled = false` | sin flag no se dispara ningún aviso, aunque carguen `points` |
| Inscripción/matrícula (D17-D19) | `offering_plans.registration_fee` nullable, NULL = sin cobro | un plan sin el campo sigue generando exactamente 1 fila de `payments` en el alta, igual que hoy |

---

## §5 — Fases

- **F0 — Puerta dura (CERRADA):** proceso de carga de resultados confirmado (federación envía → escuela carga). Dato pendiente: quién carga.
- **F1 — Planes por horas + inscripción:** columnas D1/D2 en `offering_plans`, planes de Dreamers con bloque de sesión (2h/3h/4h) × días/semana propios, vista comparativa. **Se le sumó D17-D19** (cobro de inscripción/matrícula, hallazgo 2026-08-27): misma tabla, cero dependencias nuevas, entra en la misma migración y el mismo BFF que ya toca el alta. **Vale por sí sola** aunque F2/F3 se congelaran. **Plan de implementación completo en §9 — sin bloqueantes, lista para escribir la migración.**
- **F2 — Elegibilidad de ascenso:** D3 en `competition_results`, D15 en `offering_plans`, vista de elegibilidad (mejor resultado del año vs. umbral del plan destino), consultada a demanda (D5 anual → sin job). **Antes de escribir el `ALTER TABLE` de D3: verificar contra la base viva el `CHECK` real de `result_type` — §8.1.**
- **F3 — Aviso de ascenso:** notificación al owner cuando se carga un resultado que cumple umbral. Detrás de `level_progression_enabled`. La `monthly_fee` sugerida del nuevo plan sigue D4 (sugerida, nunca automática). Patrón de notificación ya verificado y listo para clonar — §8.5.
- **F4+ — Upgrade con efecto inmediato en período abierto:** fuera de alcance (D7).
- **F5 — Cobro de excedentes:** cargo sugerido pre-calculado (`valor_hora × horas_extra`, D8) pendiente de confirmación del owner. Extiende D-10 del banco de horas sin romperlo.
- **F6 — Reserva por entrenador + horario:** depende de migrar `program_id → offering_id` en `school_availability` (D10/R5/MOD-14). **Va al final o a spec aparte. §8.4: el diagnóstico de esta migración hay que rehacerlo — la tabla real ya no tiene `program_id`.**
- **F7 — Alta a mitad de mes:** `first_payment_mode` (D12/D14b), dos filas de payments (D14), ciclo `fixed_calendar` + corte 5 + D16.

**Orden de implementación sugerido:** F1 → F7 (es lo que Dreamers necesita operar ya) → F2 → F3 → F5 → F6.

---

## §6 — Riesgos y guardarraíles

- **R2 — Banco de horas espera el bloque por escuela:** el fallback de D1 (NULL hereda `school_settings.hours_session_block_minutes`) lo protege.
- **R4 — CERRADO** (ver D15/R4): umbral por nivel, anual, editable.
- **R5 — Deuda `program_id → offering_id`:** bloquea F6; no bloquea F1–F3 ni F7. **Ver §8.4 — el alcance real de esta deuda es distinto al descrito aquí.**
- **R6 — `school_availability`:** reusar, no duplicar (D10).
- **Motor de prorrateo duplicado** (`bff/src/utils/prorationUtils.ts` y `frontend/src/lib/prorationUtils.ts`): cualquier cambio de F7 debe tocar ambas copias. Estrategia v1: **(b) test espejo** que corre los mismos casos contra las dos implementaciones y falla si divergen. Consolidar al BFF como fuente única = deuda anotada ligada a `project_math_audit_census`. La fórmula nueva `remaining_classes` NO se duplica: nace solo en el BFF. **§8.5 — los espejos ya divergieron hoy (`rolling_30`, `applyDiscount`), antes de F7 el test espejo debe empezar detectando la divergencia existente, no solo prevenir una nueva.**
- **`rolling_30` × banco de horas — incompatibilidad latente declarada:** `hour_bank_periods` copia `included_minutes` al abrir período mensual calendario; una escuela `rolling_30` tendría ciclos de cobro desalineados de los resets de horas. No explota hoy (banco en `false` en todas, Dreamers pasa a `fixed_calendar`). Guardia: validación en el toggle de `hours_plan_enabled` que rechace la combinación con `rolling_30` hasta decidir alineación. **Nota espejo en el spec de banco de horas.**
- **Guardarraíl del cambio de ciclo de Dreamers** (`prorated` → `fixed_calendar`): es un UPDATE de config, no migración. Antes: verificar por grep que ningún cobro pendiente del mes en curso se recalcule al cambiar el tipo (dónde se lee `billing_cycle_type` en cobros ya creados vs. creación de nuevos). Si solo afecta cobros futuros → cambiar el día 1 del mes siguiente, cero riesgo retroactivo.
- **Dato heredado:** Dreamers era la única escuela con `children.monthly_fee` vacío en su enrollment (fee en enrollment, no en children) — si `open_month` lee esa columna, no genera cuota. Verificar/normalizar al configurar los planes F1. **§8.4 — esta afirmación puntual no se pudo confirmar por código estático; verificar con una query antes de asumirla.**

---

## §7 — Datos pendientes (no son decisiones)

1. Mapeo niveles USAG ↔ planes de Dreamers (ej. Prenivel–N2 → 2h, N3–N5 → 3h).
2. Días permitidos por nivel (`allowed_days_of_week`, D9).
3. Quién carga resultados en Dreamers (owner o coach) → destinatario del aviso F3.
4. Puntajes de ascenso exactos de la resolución vigente de FEDECOLGIM (bajar el PDF de la Res. 012/2025 o la vigente 2026) → precargar como defaults en los planes de Dreamers.
5. Los dos precios exactos hasta día 5 / después (cierra D16 a favor de (a) o (b)).
6. Default de `first_payment_mode` para Dreamers (confirmado: hoy permiten "pago de hoy y el resto a fin de mes" → default `remaining_classes` con parcial pagado en el alta; `full_month` y D14b-B como opciones del owner).
7. Monto exacto de la inscripción/matrícula de Dreamers, y si varía por nivel/plan o es el mismo para los tres (D17).
8. Si un atleta se da de baja y vuelve a inscribirse después, ¿paga inscripción otra vez? (D18 — default propuesto: sí).

---

## §8 — Impacto verificado contra el código real (2026-08-27)

Antes de aprobar el plan de F1 (§9) se verificó cada afirmación de este spec contra las migraciones, el BFF y el frontend reales (no contra memoria ni contra el spec mismo). El spec describe correctamente el estado base en la mayoría de los puntos citados con archivo:línea — **las citas exactas de código se confirmaron letra por letra** (`students-create-one.route.ts:352`, `hour_bank_move_rpc.sql:80`, `SlotPicker.tsx:79-81`). Pero aparecieron **cuatro correcciones** que cambian el alcance real de partes que el documento da por resueltas, y dos hallazgos colaterales sobre deriva de esquema que conviene tener presentes antes de tocar migraciones en F2/F7.

### 8.1 — D3 / F2: el `CHECK` de `competition_results.result_type` en el repo no coincide con lo que el BFF escribe hoy

`competition_results` **sí existe** (confirmado, `supabase/migrations/20260731154626_regularize_performance_schema.sql:251-270`, tabla creada originalmente fuera del repo y regularizada después) con las 14 columnas que describe §1.2 — el alcance de D3 ("agregar `points`/`competition_level`, `ALTER TABLE` sobre tabla existente") es correcto, no hay que crear tabla nueva.

Pero el `CHECK` que trae esa migración de regularización es `result_type IN ('score','time','placement','rounds','rating_change')`, mientras que `bff/src/routes/school/competition-results.ts:8` valida y **efectivamente inserta** `result_type IN ('preparatorio','competencia_oficial')`. Los dos no coinciden. Esto indica que el `CHECK` real en producción probablemente ya cambió por fuera del repo (mismo patrón que ya obligó a "regularizar" la tabla la primera vez) y que la migración versionada no refleja el estado vivo.

**Antes de escribir el `ALTER TABLE` de D3:** volcar el `CHECK` real de `competition_results.result_type` contra la base viva (mismo procedimiento que ya usó `scripts/dump_unversioned_schema.sql` para la tabla en sí) en vez de asumir el catálogo de la migración de regularización. Es un paso de 5 minutos, no reabre D3 como decisión — solo evita escribir una migración que asuma un `CHECK` que ya no es el real.

Dato adicional sin acción requerida: **0 filas en `competition_results` hoy**, en toda la base — coincide con lo que ya dice R1/F0 del spec, confirmado independientemente.

### 8.2 — D9/D11/F6: el torniquete ZKTeco no puede bloquear físicamente por día de la semana con el código de hoy

D11 dice "el torniquete (check-in ZKTeco) sí valida `allowed_days_of_week`". Verificado: el único punto de decisión de negocio del BFF es `validateAccess()` (`bff/src/routes/access-adms.ts:243-354`), pero esa función **no controla la puerta**. El propio código lo documenta: *"el F22 decide el acceso físico con su propia base local de huellas/PIN, el BFF nunca abre ni cierra la puerta"* (`access-adms.ts:356-361`). El resultado de `validateAccess` solo se escribe en `access_events` (auditoría/UI) y, en el caso de mora, dispara una notificación — no hay ningún comando enviado al dispositivo para negar el paso en tiempo real.

Es decir: agregar la condición `allowed_days_of_week` a `validateAccess()` es barato (el join `enrollments.offering_plan_id → offering_plans` ya existe), pero el efecto sería **cosmético** — quedaría en el log y dispararía un aviso, sin impedir que la atleta entre físicamente un día no permitido. El torniquete real (F22) sí soporta grupos de acceso con restricción de horario nativamente, pero SportMaps solo usa ese mecanismo hoy como un toggle binario manual para mora (`access-api.ts:601-625`), no automatizado por día de semana — y automatizarlo es un proyecto aparte (nuevo `command_type`, job de sincronización, y ya hay un bug documentado de "loop infinito de comando" en esa capa, `docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md`).

Hallazgo adicional: `SlotPicker.tsx`/`BookingConfirmation.tsx`, el componente que D11 cita como ya filtrando por día, **no está enrutado hoy en el frontend** (no aparece en `App.tsx` ni en ninguna ruta) — es código existente pero no en producción.

**Decisión pendiente nueva, D11b (no bloquea F1/F7):** ¿F6 se conforma con la versión barata (registrar la violación + avisar, sin bloquear físicamente) o requiere el proyecto aparte de automatizar grupos de acceso nativos del F22? El spec actual redactó D11 asumiendo la segunda sin decirlo. Esto no cambia nada de F1–F3/F5/F7, pero hay que resolverlo antes de dimensionar F6 — cambia su esfuerzo de "1 semana" a algo mayor si se quiere bloqueo real.

### 8.3 — D16: `earlyPaymentDiscount` es un módulo 100% frontend, sin contraparte en el BFF

Confirmado: `frontend/src/lib/earlyPaymentDiscount.ts` existe y es la única implementación en todo el repo — cero resultados de `earlyPaymentDiscount`/`early_payment_discount` en `bff/`. Toda la elegibilidad y el monto del descuento se calculan en el navegador; el servidor no valida ni recalcula nada de esto hoy.

La opción (a) de D16 ("reusar `earlyPaymentDiscount`, cero código") es cierta **solo si el mecanismo sigue viviendo exclusivamente en frontend**, como hoy. Si en algún momento se quiere que el BFF valide el monto cobrado con el 5% (server-side, para que el checkout no dependa de lo que el navegador calculó), eso es un puerto nuevo del módulo al BFF — el mismo patrón de "espejo duplicado" que ya generó divergencia real en `prorationUtils.ts` (ver 8.5). No bloquea D16 ni F7; solo corrige el costo real de la opción (a) si el alcance cambia.

### 8.4 — D10/R5/F6: la premisa de la migración `program_id → offering_id` ya no es cierta

D10 y R5 asumen que `school_availability` hoy cuelga de `program_id` (así la creó `supabase/migrations/20260311000001_athlete_module_v2.sql:38-52`) y que migrarla a `offering_id` es la tarea pendiente. Pero la tabla real, según dos fuentes independientes (`frontend/src/integrations/supabase/types.ts:14895-14943`, generado por introspección del proyecto Supabase real, y el propio comentario de `frontend/src/components/athlete/SlotPicker.tsx:91-96`), **ya no tiene `program_id` ni tiene `offering_id`** — tiene `branch_id`, `available_for_group_classes`, `available_for_personal_classes`. Es decir, `program_id` parece haber desaparecido de la tabla real en algún momento no versionado, sin que `offering_id` lo haya reemplazado — el eje real hoy es otro.

`programs` (la tabla legacy) confirmado que **no existe en la base real** desde febrero 2026 (ya causó dos incidentes de producción documentados por JOINs a una tabla inexistente — flujo de QR y Carnets). Esto es consistente con `MOD-14`, no lo contradice.

**Consecuencia para F6:** el trabajo real no es "renombrar una columna" — es "diagnosticar contra la base viva qué columnas tiene `school_availability` hoy y cómo se relaciona realmente con `offerings`/`teams`" antes de escribir cualquier migración. R5/D10 quedan correctos en la conclusión (F6 va al final, depende de resolver este eje) pero desactualizados en el diagnóstico técnico — hay que rehacerlo, no asumir el de marzo.

Sin relación con lo anterior pero en el mismo bloque de verificación: la afirmación de §6 ("Dreamers era la única escuela con `children.monthly_fee` vacío en su enrollment") no se pudo confirmar por código estático — es un dato de contenido de filas, no de esquema. `children.monthly_fee` sí existe y sí es el último eslabón del `COALESCE` de `open_month` (`enrollment.monthly_fee > offering_plan.price > team.price_monthly > children.monthly_fee`, `supabase/migrations/20260724000002_open_month_rpc.sql:95-103`) — pero cuántas filas de Dreamers caen en esa rama requiere una query contra la base viva antes de F1.

### 8.5 — Confirmaciones y plantillas listas para clonar (sin corrección, buenas noticias para F1/F3)

- **D6 / flag por escuela:** el patrón real de `school_settings` es `boolean NOT NULL DEFAULT false` (no nullable) — exactamente lo que D6 propone para `level_progression_enabled`. Confirmado con `hours_plan_enabled` (`20260821125525_dreamers_hour_bank_schema.sql:28`) y el patrón de lectura cacheada en `bff/src/routes/access-adms.ts:379-398` (`getHourBankSettings`), clonable tal cual.
- **F3 / aviso al owner:** el despachador de notificaciones (`notifications` → trigger `enqueue_notification_delivery` → `notification_deliveries` → worker cada minuto) está construido y en uso. Plantilla exacta a clonar para "aviso de ascenso": `bff/src/services/saasInvoicing.service.ts:45-165` (`loadSchoolAdmins(schoolId)` + `INSERT` directo a `notifications`, sin pasar por la RPC `notify_user` porque esa exige `auth.uid()` y falla desde el service-role del BFF).
- **Motor de prorrateo (F7):** `bff/src/utils/prorationUtils.ts` y `frontend/src/lib/prorationUtils.ts` **ya divergieron hoy**, documentado en `docs/censo-calculos-monetarios.md` (hallazgo C-06): firma distinta (frontend tiene un parámetro extra), `rolling_30` calcula distinto entre las dos copias, y `applyDiscount` está reimplementada 5 veces (1 en frontend + 4 inline en `students-create-one.route.ts`). El "test espejo" que R6/§6 propone para F7 tiene que empezar por **detectar la divergencia que ya existe**, no solo prevenir una futura — si se escribe ingenuo puede pasar en verde comparando dos fórmulas que ya no son la misma.
- **`billing_cycle_type` y `early_payment_discount_*`:** ninguna de las dos vive en una migración versionada del repo (ni `CREATE`, ni `ALTER ADD COLUMN`, ni `CHECK`) — son parte de la deriva de esquema ya medida en `project_unversioned_schema_drift` (~336 objetos). No bloquea D16 ni F7, pero significa que cualquier migración que toque el `CHECK` de `billing_cycle_type` (si D16-b lo necesitara) debe primero volcar el estado real de la columna, no asumir 3 valores por convención de código.

### 8.6 — Cableado con el banco de horas ya construido (2026-08-27, tras F1)

Al escribir F1 se encontró que `reserve_hour_bank()` (F4 del banco de horas, `b882f5d`) leía únicamente `school_settings.hours_session_block_minutes` para calcular cuánto reservar — **ignoraba por completo `offering_plans.session_block_minutes`**, la columna que D1 crea exactamente para que 2h/3h/4h convivan en la misma escuela. Sin el fix, un nivel de 3h habría reservado el bloque de la escuela (u otro valor), no el suyo. Corregido en migración `20260827174556`: cascada plan → escuela → 120, mismo orden que documenta D1. No-evento hoy (ningún plan real tiene `session_block_minutes` todavía) — empieza a importar en cuanto Dreamers configure sus niveles.

De paso se cerraron los dos hallazgos de seguridad/correctitud de `b882f5d` que salieron de una revisión aparte del mismo commit (memoria `project_hour_bank_security_gaps`, migración `20260827174032`): los 5 RPCs del banco de horas quedaron restringidos a `service_role` (antes cualquier usuario autenticado de cualquier escuela podía llamarlos directo y mover saldo ajeno), y el auto-cierre dejó de mandar a revisión manual las visitas que ya habían salido normal — solo revisa las que de verdad nunca marcaron salida. Ninguno de los tres fixes se aplicó todavía contra la base compartida.

### 8.7 — Qué NO cambia

F1 (§9) no toca ninguna de las cuatro áreas anteriores: `offering_plans` está completamente versionada (dos migraciones, sin deriva), `session_block_minutes`/`included_sessions_per_week`/`registration_fee` no existen todavía en ningún lado (greenfield limpio), y ninguna corrección de §8.1–§8.4 le aplica. La adición de D17-D19 (inscripción) sí toca `students-create-one.route.ts` — pero como **inserción nueva e independiente** (una fila más de `payments`), no como cambio a la fórmula de mensualidad/prorrateo existente, así que tampoco hereda la divergencia de `prorationUtils.ts` (§8.5) ni ningún otro riesgo ya mapeado. **F1 queda sin bloqueantes verificados.**

---

## §9 — Plan de implementación F1 (Planes por horas/días + inscripción)

**Alcance:** D1 (`session_block_minutes`) + D2 (`included_sessions_per_week`) + D17-D19 (`registration_fee` y su cobro en el alta) en `offering_plans`/`payments`, vista comparativa de planes para vender. Sin tocar el banco de horas activo (`hours_plan_enabled` sigue en `false`), sin flag nuevo (todo es dato pasivo + una inserción incondicional de cobro — §4 solo exige flag para mecánica que decide/notifica algo, y acá no hay decisión: si el plan tiene `registration_fee`, se cobra, punto).

**Rama:** una rama de fase, según convención del repo (`feature/niv-f1-planes-por-horas` o similar), partiendo de `develop`.

### 9.1 — Migración (DB)

Una migración nueva vía `npm run migrations:new -- niv_f1_offering_plans_session_blocks` (próxima versión libre en el ledger, no reutilizar ninguna existente). Contenido:

```sql
ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS session_block_minutes integer,
  ADD COLUMN IF NOT EXISTS included_sessions_per_week integer,
  ADD COLUMN IF NOT EXISTS registration_fee numeric CHECK (registration_fee IS NULL OR registration_fee >= 0);

COMMENT ON COLUMN public.offering_plans.session_block_minutes IS
  'Minutos por sesión de ESTE plan. NULL hereda school_settings.hours_session_block_minutes (D1).';
COMMENT ON COLUMN public.offering_plans.included_sessions_per_week IS
  'Informativa, display-only — la fuente de verdad de horas sigue siendo included_minutes_per_period (D2).';
COMMENT ON COLUMN public.offering_plans.registration_fee IS
  'Cobro único de inscripción/matrícula, aparte de la mensualidad. NULL = sin cobro de inscripción (D17).';
```

Sin `CHECK` de consistencia contra `included_minutes_per_period` (la validación es un warning de UI, no una restricción de base — §1.1). Sin flag: no hace falta `level_progression_enabled` en esta fase (pertenece a F3). Migración puramente aditiva, nullable, cero filas tocadas — cumple §4.1 y §4.6 al pie de la letra.

No requiere `GRANT EXECUTE` (no hay función nueva) ni ajuste de RLS (mismas policies de `offering_plans` ya cubren columnas nuevas de la misma tabla; la fila nueva de `payments` usa las mismas policies que cualquier otra fila de `payments`, sin `payment_type` nuevo — `'one_time'` ya existe).

### 9.2 — BFF

- Los endpoints que ya devuelven `offering_plans` (creación/edición de planes, `useOfferings.ts` del lado frontend) deben empezar a aceptar y devolver los tres campos nuevos — confirmar el shape en las rutas bajo `bff/src/routes/` que hacen `insert`/`update` sobre `offering_plans` (mismo lugar donde hoy se maneja `max_sessions`/`duration_days`/`price`).
- **`bff/src/routes/students-create-one.route.ts` (D17-D19):** después de armar la(s) fila(s) de mensualidad (líneas ~474-501, el único `payments.insert` que existe hoy), agregar: si `plan.registration_fee IS NOT NULL AND > 0`, insertar una fila adicional — `payment_type: 'one_time'`, `amount: plan.registration_fee`, `period_year: null`, `period_month: null`, `concept: 'Inscripción — ' + plan.name`. Va en la misma transacción/bloque que ya crea el resto de filas del alta — si D14/F7 (`remaining_classes`) también aplica, el alta puede terminar creando hasta 3 filas (inscripción + parcial + mes siguiente); sin F7, 2 filas (inscripción + mensualidad) — ver la tabla de composición en §3.4. Nada de esto toca la fórmula de prorrateo existente (`prorationUtils.ts`) — es una inserción independiente, no un cambio a `calcFirstPayment`.
- Ningún otro endpoint de facturación (`open_month_rpc`) necesita tocarse en F1 — `registration_fee` no participa del motor de mensualidades recurrentes, es exclusivo del momento del alta.
- No hay lectura nueva de `school_settings.hours_session_block_minutes` que agregar al BFF: el fallback de D1 solo importa donde el banco de horas ya lo resuelve (`getHourBankSettings`), que sigue con `hours_plan_enabled=false` y no se toca en F1.

### 9.3 — Frontend

- **Formulario admin de planes** — `frontend/src/components/universal/OfferingsManagement.tsx` (confirmado: es el CRUD real de `offering_plans`, hoy con `max_sessions`, `duration_days`, `price`, etc. en el estado `newPlan` y su submit, líneas ~460-514, único campo de dinero hoy es `price`). Agregar tres campos nuevos al formulario (`session_block_minutes`, `included_sessions_per_week`, `registration_fee`), todos opcionales. Nota: **este mismo formulario tampoco expone hoy `included_minutes_per_period`** (el campo del banco de horas, agregado en agosto) — F1 puede aprovechar el mismo cambio para exponerlo si se decide activar la venta de planes de horas desde acá, pero eso es decisión de UX del owner, no parte obligatoria de D1/D2.
- **Warning de desincronización (D2):** al guardar, si `included_sessions_per_week` y `session_block_minutes` están ambos definidos y `included_minutes_per_period` también, calcular `sessions_per_week × block_minutes × 4.33` y avisar (no bloquear) si difiere de `included_minutes_per_period` en más de un margen razonable (ej. >10%).
- **Vista comparativa de planes 2h/3h/4h × días/semana:** nueva sección o tabla en la misma página de gestión de planes (o en `SchoolPublicProfilePage.tsx`/`JoinPlanPage.tsx` si el objetivo es también venta pública) que muestre, por plan: bloque de sesión (heredado o propio), sesiones/semana, precio, e inscripción si el plan la tiene. Puramente de lectura, sin lógica de negocio nueva.
- **Flujo de alta — `frontend/src/components/students/CreateChildModal.tsx` y `CreateAdultAthleteModal.tsx` (D17-D19):** el `ProrationCard`/resumen de "así quedará el cobro" (que hoy solo muestra la mensualidad vía `calcFirstPayment`, líneas ~93-96, uno de los tres ramales por `billing_cycle_type` en 122/145/159) debe agregar una línea aparte cuando el plan elegido tiene `registration_fee`: "Inscripción: $X" + el total combinado. **No calcular el monto de inscripción con una fórmula nueva en frontend** — es un valor plano que ya viene del plan (`plan.registration_fee`), se muestra tal cual, sin necesidad de espejo ni de llamada a un endpoint de preview (a diferencia de `remaining_classes` de F7, que sí es una fórmula calculada).
- Los tres planes de Dreamers (2h/3h/4h) y su `registration_fee` se crean/editan desde el formulario admin ya actualizado — no hace falta seed ni dato hardcodeado en migración.

### 9.4 — QA

- Migración: verificar en la base viva que ningún plan existente (de ninguna escuela) cambió de comportamiento — `session_block_minutes`/`registration_fee IS NULL` para todas las filas preexistentes, confirmando herencia intacta.
- Frontend: crear los tres planes de Dreamers vía el formulario actualizado (con su `registration_fee`), confirmar que un plan con los campos NULL (cualquier otra escuela) se sigue mostrando y cobrando igual que hoy — **un alta en cualquier otra escuela sigue generando exactamente 1 fila de `payments`.**
- Dar de alta un atleta de prueba en un plan de Dreamers con `registration_fee` set: confirmar que se crean 2 filas de `payments` (`one_time` sin período + `subscription` con período), montos correctos, y que ninguna choca con `uniq_payment_active_period_per_child` (la fila `one_time` tiene período NULL, no debería ni evaluarse contra ese índice).
- Regresión: banco de horas (`hours_plan_enabled` sigue en `false` en todas las escuelas) no debe verse afectado por esta migración — smoke test de que `getHourBankSettings`/`get_or_open_hour_bank_period` siguen retornando lo mismo que antes del deploy.

### 9.5 — Qué F1 explícitamente NO incluye

- No crea `level_progression_enabled` (F3).
- No toca `competition_results` (F2, y depende de resolver §8.1 primero).
- No toca `school_availability`/`program_id` (F6, bloqueado — §8.4).
- No toca la fórmula de prorrateo/mensualidad existente (F5/F7) — la inscripción es una inserción nueva e independiente, no un cambio a `calcFirstPayment`.
- No resuelve D18 (¿se recobra inscripción en una re-inscripción tras baja?) — F1 implementa la regla default (sí, alta nueva = cobro nuevo); si Dreamers pide lo contrario, es un ajuste chico posterior, no un bloqueante de F1.

**Siguiente paso tras F1:** por el orden sugerido en §5 (F1 → F7 → F2 → F3 → F5 → F6), F7 es la continuación natural — pero antes de escribir su migración hace falta cerrar el dato pendiente de §7.5 (los dos precios exactos de D16) si D16 va a resolverse en la misma fase, y decidir si el "test espejo" de `prorationUtils.ts` (§8.5) se escribe como parte de F7 o como tarea previa independiente.
