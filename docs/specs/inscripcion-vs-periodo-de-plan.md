# Una sola inscripción, y el plan como mensualidad con sus sesiones

**Estado:** propuesta · **Fecha:** 2026-08-17 · **Origen:** no salió de una auditoría — salió de
mirar la duplicidad de Dynasty y preguntar por qué existe.

---

## 1. El problema en una frase

`enrollments` mezcla tres cosas que cambian a ritmos distintos, y por eso hay que crear una fila
nueva cada vez que cambia la más rápida.

| Concepto | Cada cuánto cambia | Columnas de hoy |
|---|---|---|
| **Pertenencia** — este atleta entrena en esta escuela, en este equipo | casi nunca | `child_id/user_id/unregistered_athlete_id`, `school_id`, `team_id`, `start_date`, `status` |
| **Comercial** — qué plan contrató y a qué precio | cuando cambia de plan | `offering_plan_id`, `monthly_fee` |
| **Consumo** — cuántas clases le quedan y hasta cuándo | **todos los meses** | `sessions_used`, `secondary_sessions_used`, `expires_at` |

Como el consumo vive en la misma fila que la pertenencia, **renovar o cambiar de plan obliga a
crear otra inscripción**. Esa es la causa raíz, no un bug suelto.

## 2. La evidencia

```
Toda la plataforma   1.477 inscripciones  /  1.141 atletas
Dynasty                780 inscripciones  /    529 atletas   (promedio 1,47 · máximo 7)
```

Un atleta con siete inscripciones no está en siete equipos: es la misma persona renovada siete
veces. Y en Dynasty hay **15 atletas con dos inscripciones vivas a la vez** — una `pending` sin
equipo y otra `active` completa.

## 3. Los síntomas que ya pagamos por esto

Todos son la misma causa vista desde ángulos distintos:

| Síntoma | Dónde se documentó |
|---|---|
| El crédito se descuenta de la inscripción vieja y la nueva nunca consume | `findCreditEnrollment`, arreglado a medias el 2026-08-16 |
| `sessions_used` **nunca se resetea**: comparado con un tope mensual miente desde el segundo mes | `project_enrollment_validity_periods` |
| `expires_at` se regala al asignar el plan y el pago lo **suma** → 1 mes pagado = 2 de acceso | idem (145 atletas con 30 días de más, 53 con 60, 18 con 84) |
| El cambio de plan emitía el cobro con el mes de la inscripción vieja | `project_plan_change_billing_period` (12 atletas, $1.710.000 sin facturar) |
| Asignar plan creaba una 2ª inscripción activa | `project_dynasty_onboarding_audit` |
| 2ª inscripción por `team_id` = doble cobro | `project_sport_categories_multi` |
| Al conciliar no se sabe **de cuál plan** salió la clase | Dynasty, 2026-08-17 |

Cada uno se arregló por separado. Ninguno se va a quedar arreglado mientras el modelo obligue a
duplicar.

## 4. El modelo propuesto

```
inscripcion  (1 por atleta + escuela)          periodo_de_plan  (1 por mensualidad)
─────────────────────────────────────          ──────────────────────────────────────
atleta, escuela, equipo                        inscripcion_id
start_date, status                             offering_plan_id, precio
                                               vigente_desde, vigente_hasta
                                               sesiones_incluidas
                                               sesiones_usadas
                                               origen_pago_id
```

- **La inscripción no se toca nunca más.** El atleta entra una vez y sale una vez.
- **Cambiar de plan = cerrar el período y abrir otro**, no crear otra inscripción.
- **Las sesiones pertenecen al período**, así que se resetean solas: el mes que viene es otra fila.
- **`vigente_hasta` se calcula, no se acumula.** Un pago abre un período; dos pagos abren dos
  períodos consecutivos. Se acabó el regalo de vigencia.
- **El consumo se imputa al período vigente ese día**, que es lo que hace posible responder
  «esta clase, ¿de qué mensualidad salió?».

## 5. Qué de esto ya existe

**No es net-new.** Medido contra la base:

- `payments` **ya tiene el período**: `period_year`, `period_month` y `offering_plan_id`. En
  Dynasty, **682 de 682 pagos** traen período y 616 traen plan. El eje ya está poblado.
- `billing_events` tiene la forma casi exacta que haría falta —`enrollment_id`, `offering_plan_id`,
  `due_date`, `status`, montos— pero está **VACÍA: 0 filas en toda la plataforma**. Es
  infraestructura escrita y nunca encendida. Hay que decidir si se revive o se deja morir; lo que
  no se puede es construir encima asumiendo que tiene datos.

Lo único que no existe en ningún lado es el **lado del consumo**: `sesiones_incluidas` /
`sesiones_usadas` por período. Hoy viven en la inscripción y por eso no se resetean.

## 6. Fases

Con revisión entre cada una, y **sin escribir migraciones hasta aprobar el plan**.

| Fase | Qué | Riesgo |
|---|---|---|
| **F0** | Censo: cuántas inscripciones son renovaciones de la misma pertenencia y cuántas son pertenencias distintas (dos equipos de verdad). Sin esto, la migración de datos fusiona lo que no debe | bajo — solo lectura |
| **F1** | Tabla `enrollment_periods` + backfill desde `enrollments` y `payments`. La inscripción **conserva** sus columnas: nada las lee todavía | medio — datos |
| **F2** | Los lectores de crédito pasan al período: `findCreditEnrollment`, `move_session_credit`, el roster y `walk-in`. Doble escritura para poder volver atrás | **alto — toca plata** |
| **F3** | Fusionar las inscripciones duplicadas en una sola pertenencia, con sus períodos colgando | alto — irreversible |
| **F4** | Quitar de `enrollments` las columnas de consumo y comercial | bajo — el trabajo ya está hecho |

## 7. Decisiones tomadas (2026-08-17)

### 7.1 `billing_events` NO se usa para esto — recomendación

**Qué es realmente.** No es un experimento a medias: es una API completa y montada
(`/api/v1/billing-events` con GET/POST/PATCH), con 4 policies, 1 trigger y 2 funciones. Con
**cero filas en toda la plataforma**. Está viva y nadie la llama.

**Por qué no sirve como período.** Sus tipos de evento son `charge`, `partial`, `refund`,
`late_fee`, `adjustment`: es un **libro mayor de cobros**, y su unidad es el movimiento de plata,
no el mes. Un solo mes puede tener un `charge`, dos `partial`, un `late_fee` y un `refund`: cinco
filas. Si el período de consumo fuera esa misma fila, **un atleta tendría cinco períodos en un
mes** y volveríamos a preguntarnos de cuál descontar la clase.

Sería repetir el error exacto que este documento intenta deshacer: meter en una fila dos cosas con
ritmos distintos. El cobro se mueve varias veces por mes; el derecho a entrenar, una.

**El daño de forzarlo:** cada abono parcial partiría las sesiones del atleta; un reembolso dejaría
un período fantasma con clases ya consumidas; y las policies y el trigger que hoy están pensados
para plata pasarían a gobernar también el consumo, con un radio de cambio mucho mayor.

**Recomendación:** `enrollment_periods` nace aparte, con una sola responsabilidad —vigencia y
sesiones—, y se enlaza al cobro por `payment_id`. `billing_events` queda como lo que es. Que se
revive o se deja morir es una decisión de facturación, **independiente de esta**, y hoy no
bloquea nada: `payments` ya cubre el cobro con 682 de 682 filas con período.

**Lo que sí mejoraría de la propuesta original:** enlazar el período al pago con `payment_id`
*nullable*. Un período puede existir **antes** de estar pagado —el atleta entrena y la familia
paga el 5— y esa es justamente la fuga que hoy no se ve. Si el enlace fuera obligatorio, no habría
forma de representar «período abierto, sin pagar».

### 7.2 El período es de 30 días desde la primera inscripción, y lo elige la escuela

**Lo que renueva es el PLAN, no la inscripción.** La inscripción se hace una vez.

El ancla es la **fecha de la primera inscripción del atleta**, no la del pago ni el 1º de cada
mes: quien entró el 12 de agosto tiene su período del 12 al 11, y el siguiente del 12 de
septiembre al 11 de octubre. Cada sesión se descuenta contra el plan **que ese atleta o padre está
pagando en ese período**.

Pero no es único para todos: **depende del método de cobro que la escuela elija**. Hay escuelas que
cobran por mes calendario —es lo que hace hoy `generate_monthly_charges` con
`period_year/period_month`— y otras por ciclo de 30 días desde el alta. Las dos tienen que
convivir, configuradas por escuela.

Implicación de diseño: el período **no** se deriva de `period_year/period_month`. Lleva
`vigente_desde` y `vigente_hasta` explícitas, y quien las calcula es el motor de renovación según
el modo de la escuela. Ese es además el fin del desfase de vigencias: hoy `expires_at` se **suma**,
y con períodos consecutivos se **encadena**.

### 7.3 Las clases sin período vigente no generan cobro — pero se muestran

Por ahora **no** se factura automáticamente. Lo que sí hay que hacer es **mostrarle a la escuela la
fuga**, con el respaldo de asistencia detrás: cuántas clases se dictaron sin plan vigente, a
quién, en qué fechas y cuánto vale eso.

La pestaña «Plan vs consumo» ya da el conteo (11 clases vencidas en Dynasty en agosto). Falta:

- **Valorizarlo**: clases fuera de plan × precio de la clase del plan que tenía.
- **El soporte**: poder abrir el detalle y ver las fechas exactas, que es lo que la escuela le
  muestra a la familia cuando reclama.
- **Un total por mes**, para que sea una cifra de negocio y no una curiosidad.

Facturarlo automáticamente queda para después, y como decisión aparte: cobrar sin aviso previo una
clase que la escuela ya dictó es una discusión con la familia, no un cálculo.

## 8. Lo que NO resuelve

El multideporte. Un atleta con «Mensualidad Golf» y «Mensualidad Gimnasio» tiene **dos
pertenencias legítimas**, no una duplicada. El modelo las soporta —dos inscripciones, cada una con
sus períodos— pero saber a cuál imputar la clase sigue necesitando que la pantalla mande el
contexto. Ver `enrollmentId` explícito en `POST /session`.
