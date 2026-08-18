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

## 7. Lo que hay que decidir antes de F1

1. **¿`billing_events` se revive o se deja morir?** Si se revive, el período de plan y el evento
   de cobro son la misma fila y hay una sola verdad. Si se deja morir, `enrollment_periods` nace
   limpia pero convive con `payments` como segunda fuente del período.
2. **¿Un período por mes calendario, o por 30 días desde el pago?** Hoy conviven las dos: los
   cobros van por mes calendario (`period_year/period_month`) y la vigencia por días
   (`expires_at`). Es el origen del desfase de vigencias.
3. **¿Qué pasa con las clases dictadas sin período vigente?** Hoy se registran y no se descuentan.
   La pestaña «Plan vs consumo» ya las hace visibles; falta decidir si generan un cobro.

## 8. Lo que NO resuelve

El multideporte. Un atleta con «Mensualidad Golf» y «Mensualidad Gimnasio» tiene **dos
pertenencias legítimas**, no una duplicada. El modelo las soporta —dos inscripciones, cada una con
sus períodos— pero saber a cuál imputar la clase sigue necesitando que la pantalla mande el
contexto. Ver `enrollmentId` explícito en `POST /session`.
