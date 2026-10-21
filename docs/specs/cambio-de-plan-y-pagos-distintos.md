# Cambio de plan y pagos por un valor distinto al cobro

Estado: parte 1 construida (2026-10-21). Partes 2 y 3 pendientes de aprobación.
Origen: Dynasty, atleta de prueba «Hijo Pruebas». Se cambió de PLAN ELITE ($180.000) a BASIC SENIORS ($90.000): el cobro vencido de octubre ($180.000) quedó intacto y no nació ninguno de $90.000.

Principio: **el valor del plan manda hacia adelante; la deuda ya causada no cambia sola.**

## Causa del caso de hoy
`cancelPendingPlanPayments` solo anulaba cobros `pending` ligados al plan viejo. El cobro de octubre estaba `overdue` y sin plan ligado (lo creó el cierre de mes), así que sobrevivía. `createPendingPayment` intentaba emitir el del plan nuevo, la base lo rechazaba por `uniq_payment_active_period_per_child` (23505) y el código lo absorbía en silencio.

## Reglas por estado del cobro del mes
| Cobro del mes | Qué pasa |
|---|---|
| Sin pago ni abono (pendiente o vencido, con o sin plan ligado) | Se anula y se emite el del plan nuevo. **Parte 1: hecha.** |
| Con pago o abono (`amount_paid` > 0) | No se anula; se avisa al admin. **Parte 1: aviso hecho.** El saldo/diferencia es parte 2. |
| Pagado completo con el plan viejo | Plan nuevo más caro: se cobra la diferencia. Más barato: saldo a favor para el mes siguiente. **Parte 2.** |
| Meses anteriores vencidos | No se tocan. Perdonarlos es una acción explícita aparte. **Parte 3.** |

Nunca en silencio: si el cobro nuevo no se emite, el BFF devuelve `warnings` y la ficha lo muestra.

## Pago por un valor distinto
| Paga | Resultado |
|---|---|
| Exacto | `paid` |
| Menos | `partial` con saldo pendiente. El webhook de Wompi ya lo hace; «Registrar pago» y transferencia manual **no** (bajar el monto cierra el cobro y borra la diferencia). **Parte 2.** |
| Más | Saldo a favor aplicable al siguiente cobro. **Parte 2.** |

## Decisiones abiertas (usuario / Milena)
1. Plan más barato después de pagar: ¿saldo a favor para el mes siguiente, o nada?
2. Perdonar deuda vieja: ¿botón del admin, o solo SportMaps?
3. Padre que paga menos: ¿el saldo queda como deuda normal, o requiere aprobación del admin?

## Parte 1 — qué cambió
- `enrollmentBilling.cancelUnpaidPeriodCharges`: anula mensualidades `pending`/`overdue` del período del cambio sin pagos; excluye inscripción/seguro/excedente.
- `createPendingPayment` devuelve `false` cuando no creó cobro (23505 o monto 0).
- Se usa en `PUT /students/:id` (editor de la ficha) y `POST /enrollments` (reemplazo de plan).
- La ficha muestra los `warnings` del BFF.
