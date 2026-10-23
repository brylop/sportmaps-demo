# #18 · Besser — cobros sin pagador (cierre 2026-10-23)

Escuela: Club Deportivo Besser (`759eee9d-05cb-4958-b84a-2560f77e3683`). Medido contra la base viva el 2026-10-23. Solo lectura, salvo el UPDATE del grupo A descrito abajo.

## Resultado

| | Cobros | Monto |
|---|---|---|
| Antes (`status` pending/overdue/partial, `parent_id` y `user_id` nulos) | 21 | $6.840.000 |
| Grupo A: pagador asignado hoy | 3 | $520.000 |
| **Después** | **18** | **$6.320.000** |

Los 21 estaban `overdue`.

## Por qué nacieron así

- **Ninguno es de un menor con `child_id`.** Los 21 son de `unregistered_athletes`: deportistas cargados por la escuela sin cuenta ni vínculo. Por eso no aplica el backfill de `children.parent_id` del 30-jul (ver `project_payments_null_payer_minors`).
- Los generó el cierre de mes (`subscription`, creados el 05-sep y el 01-oct) y los pagos únicos del 14-oct (`one_time`, categoría mensualidad).
- No es un defecto del generador: para un deportista sin cuenta, el único dato que existe es `unregistered_athlete_id`. El pagador solo aparece cuando el acudiente se registra.
- Consecuencia: quien no tiene cuenta **no puede pagar en línea** (el guard de `create-session` compara contra `[parent_id, user_id]` y queda vacío). Se cobra por teléfono o WhatsApp, y el bot no debe decirles «estás al día».

## Clasificación

- **A · pagador resuelto sin ambigüedad: 3 cobros (2 acudientes).** El correo de la ficha coincide con exactamente un perfil y el nombre coincide.
  - Yolanda Sarmiento Molina (miembro de la escuela): 1 cobro de $100.000 de Juan José Velosa Sarmiento.
  - Nina Andrea Isaza Rodríguez (tiene cuenta, no es miembro de Besser): 2 cobros de $210.000 de Mariajose Pérez Isaza.
- **B · el acudiente no tiene cuenta: 18 cobros, 12 deportistas.** Todos tienen nombre, correo y teléfono del acudiente cargados en la ficha.
- **C · ambiguos o sin dato: 0.**

### Lo que se aplicó

Un UPDATE de `payments.parent_id` con candado (`parent_id IS NULL AND user_id IS NULL`, los 3 ids, correo con un único perfil). Se ejecutó dentro de un bloque que se revierte si cambia monto, estado, fecha de vencimiento, `list_amount` o `early_payment_discount_applied`, porque `payments` tiene triggers BEFORE UPDATE (pronto pago, guard del cliente). No se revirtió: los 3 cobros quedaron idénticos salvo `parent_id`.

| Cobro | Monto | Estado | Vence | Pagador asignado |
|---|---|---|---|---|
| `c17b670f` | $100.000 | overdue | 2026-10-14 | Yolanda Sarmiento Molina |
| `ac4f7a64` | $210.000 | overdue | 2026-09-10 | Nina Andrea Isaza Rodríguez |
| `8db268e5` | $210.000 | overdue | 2026-10-10 | Nina Andrea Isaza Rodríguez |

Reversible con: `update payments set parent_id = null where id in ('c17b670f-ae14-493a-9a4b-1747e24bcd9e','ac4f7a64-6f28-4dfd-976a-6e72e9fc9270','8db268e5-c4f5-41fa-a16a-b14e954cccaa');`

Matiz: Nina no es miembro de Besser. Ve el cobro por ser `parent_id`, pero el deportista no aparece en «Mis hijos» porque no tiene `child_id`. Si va a pagar en línea, conviene que Besser la vincule.

## Los 18 que quedan (grupo B)

| Deportista | Acudiente en la ficha | Cobros | Monto |
|---|---|---|---|
| Andrés Felipe Maldonado Sotelo | Yasmín Sotelo Moreno | 2 (sep, oct) | $760.000 |
| Dilan Samuel Gómez Gordillo | Natalia Gordillo García | 1 (14-oct) | $140.000 |
| Emmanuel Pastás Salazar | Omar Pastás | 1 (oct) | $380.000 |
| Juan Felipe Cubillos Ocampo | Adriana Milena Ocampo Rodríguez | 1 (14-oct) | $340.000 |
| Juan José Valencia Quintero | «ANDRES» (sin apellido) | 2 (sep, oct) | $760.000 |
| Julian David Gomez Ardila | Miriam Andrea Ardila Niño | 2 (sep, oct) | $680.000 |
| Julieta Sánchez | Laura Fajardo | 1 (14-oct) | $340.000 |
| Leticia Franco | Neyla Londoño | 2 (sep, oct) | $680.000 |
| Matías Andrés López Pineda | William Enoch López | 1 (14-oct) | $340.000 |
| Nicolás Rivas | Dalia Garzón | 2 (sep, oct) | $760.000 |
| Samuel David Romero Gomez | Neydis Gomez | 1 (14-oct) | $380.000 |
| Sebastian Andrade Rivera | Mario Andrade Zarate | 2 (sep, oct) | $760.000 |
| **Total** | | **18** | **$6.320.000** |

## Decisión propuesta para el grupo B (pendiente del usuario)

1. **No hay nada que arreglar por código.** El pagador existe en la ficha del deportista; no hay cuenta a la que apuntar.
2. **Cobrar por el canal que sí funciona:** WhatsApp o llamada al teléfono de la ficha (los 12 lo tienen). Es lo que ya hace la cobranza para pagadores sin cuenta.
3. **Qué pedirle a Besser:**
   - Confirmar que los 12 siguen activos y que la mensualidad es la correcta. Hay mensualidades de $340.000 y $380.000 y un cobro de $140.000 de Dilan Samuel que conviene revisar.
   - Para Juan José Valencia Quintero, el nombre completo y el apellido del acudiente (en la ficha solo dice «ANDRES»).
   - Si quieren que paguen en línea, invitar a esos 12 acudientes a registrarse para que el pagador quede vinculado.
4. **Para el bot de WhatsApp (ítem 14):** verificar que identifica a estos acudientes por el teléfono de `unregistered_athletes.guardian_phone` y no los marca como «al día» mientras tengan cobros vencidos. No se probó en este frente.

## No se tocó

Monto, estado, fechas, inscripciones, ni ningún otro cobro. Sin migraciones, sin commit.
