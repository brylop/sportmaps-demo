# Dynasty — planillas de septiembre, cuarta tanda (2026-10-05)

Contexto: respuestas de Milena del 2026-10-05. Para P7 dijo "analiza bien" y para P8, "cambio de plan".
SQL: `aplicar_pagos_y_planes_2026-10-05.sql`. Todavía **no está aplicado**. Hay que correrlo en el SQL Editor y es idempotente.
Base consultada solo con SELECT el 2026-10-05. Las fotos originales están en `C:\Users\Usuario\Downloads\Imágenes -20261004T002217Z-1-001\Imágenes\`. Las releí ampliando las celdas.

Planes de Dynasty (`offering_plans`): START $90.000 · SENIORS 8 clases $130.000 · PRO $150.000 · ELITE $180.000 · DYNASTY $210.000.
El monto a cobrar sale de `enrollments.monthly_fee` → `offering_plans.price` → `teams.price_monthly`. En Dynasty, `teams.price_monthly` es 0 y el plan es el que cobra.

## Hallazgo previo: la tercera tanda ya había aplicado más de lo que decía la memoria

Antes de esta tanda, septiembre ya estaba `paid`, con `amount_paid` igual al valor del papel, para estos atletas: **Agudelo, Aycardy Ospino, Elizalde, Luna, Martínez Jiménez, Mora Duarte Andrés, Bejarano, Ceballos y Vargas Benavides**. Eso cubre siete de los nueve casos de P7 y cinco de los siete de P8. Esta tanda **no vuelve a tocar septiembre** en esos cobros. Solo cambia el plan hacia adelante (octubre).

## P8: cambios de plan ("el valor del papel es el plan real")

| Atleta | Papel | App antes | Plan nuevo | Septiembre | Octubre (pendiente) | Evidencia |
|---|---:|---|---|---|---|---|
| Agudelo María Paula | $180.000 (21-sep, efectivo) | PRO $150.000 | **ELITE $180.000** | ya pagado: 150.000 cobrado, 180.000 pagado. Se deja | 150.000 → **180.000** | Foto 5, fila 2: se lee claro "180 000". Agosto pagó 150.000 en efectivo: el cambio es de septiembre |
| Aycardy Ospino Luis Felipe | $210.000 (1-sep, llave) | PRO $150.000 | **DYNASTY $210.000** | ya pagado (210.000). Se deja | 150.000 → **210.000** | Foto 6, fila 3: "210 000" claro. **Agosto ya lo pagó con el plan DYNASTY ($210.000, con comprobante)**: la inscripción en PRO era el error |
| Martínez Jiménez Ana María | $180.000 (16-sep, BC) | DYNASTY con cuota $250.000 | **ELITE $180.000** | ya pagado (180.000). Se deja | 250.000 → **180.000** | Foto 21, fila 52: "180 000" claro. Agosto pagó $250.000, que no corresponde a ningún plan. Su hermano **Oliver figura "Retirado" en Mini** (foto 27), así que los 250.000 eran muy probablemente de los dos. Sola, ella queda en ELITE |
| Luna Paula Jimena | $150.000 (4-sep, BC) | ELITE $180.000 | **PRO $150.000** | ya pagado (150.000). Se deja | 180.000 → **150.000** | Foto 21, fila 48: "150 000" claro. **En agosto el OCR del comprobante leyó $150.000, pero el cobro se aprobó como pago completo de $180.000**: desde agosto viene pagando 150.000 |
| Elizalde Layla Sofhia | $90.000 (21-sep, QR) | PRO $150.000 | **START $90.000** | ya pagado (90.000). Se deja | 150.000 → **90.000** | Foto 8, fila 16: "90 000". Es el precio exacto de PLAN START. Ojo: **agosto sigue vencido en $150.000** con el plan viejo. No lo toqué (ver pendientes) |

Cómo se aplica: `UPDATE enrollments` (`offering_plan_id`, `monthly_fee`, `fee_reason` con la cita de Milena, `fee_set_by` = Milena) y `UPDATE` del cobro de octubre (`amount` + `offering_plan_id`, para que el trigger que extiende la vigencia encuentre la inscripción al pagar). El `WHERE` exige el plan y el monto viejos, y que el cobro siga `pending`/`overdue`.
No usé cancelar + reemitir como hace el editor: el período de octubre ya es el correcto y reemitir dispararía avisos de cobro nuevo.

### Escallón y Joven: son abonos, no cambios de plan

| Atleta | Papel | Decisión | Por qué |
|---|---:|---|---|
| Escallón Cristie | $100.000 "Abona" (2-sep, efectivo) | **Abono parcial**: sep `partial`, amount_paid 100.000, saldo $50.000. Plan PRO sin cambio | En la foto 5, fila 25, está escrito "Abona" al lado del valor. $100.000 no es el precio de ningún plan. Agosto lo pagó completo ($150.000) |
| Joven María Alejandra | $60.000 (23-sep, BC) | **Abono parcial**: sep `partial`, amount_paid 60.000, saldo $90.000. Plan PRO sin cambio | No hay ningún plan de $60.000. Agosto lo pagó completo ($150.000, con comprobante). Si Milena quiere otro plan, el que más se acerca es START ($90.000), pero el papel no lo indica |

## P7: montos ilegibles, celda por celda

| Atleta | Lectura de la foto (ampliada) | App | Decisión | Acción |
|---|---|---|---|---|
| Balaguera Valbuena Joshua | Foto 6, fila 4: "1?0 000", segundo dígito cerrado (0, 6 u 8), "Ag-27 QR" | Agosto `paid` $150.000 el **27-ago**, con comprobante y **OCR = $150.000**. Plan PRO. Sep vencido | **$150.000.** Es la **misma transferencia** que la app ya asignó a agosto (misma fecha y mismo monto). No se marca septiembre: sería contar dos veces la misma plata. Hay un solo pago de agosto+septiembre, así que debe un mes, y eso es lo que muestra la app hoy | Ninguna (dudoso solo en qué mes cubrió) |
| Mora Duarte Andrés Esteban | Foto 6, fila 18: un **5 escrito sobre un 8**. El trazo final es el 5 | Sep ya `paid` con amount_paid 150.000 (sobre cobro de 180.000). Plan ELITE. **Agosto vencido**, nunca pagó con ELITE. Sus 2 hermanos (José Gabriel, Sara Manuela) están en PRO $150.000, mismo día y medio | **$150.000** (corrección del papel y coherente con los hermanos). Septiembre se deja como está | Cambio a PRO **solo como bloque comentado (D1)**: falta que Milena confirme que es su mensualidad y no un abono |
| Cuéllar Juan Sebastián | Foto 6, fila 10: "150 000" (se ve la bandera del 5), "Sep 1", sin medio | **No existe en la app**: no hay ningún Cuéllar menor en Dynasty | $150.000 | Ninguna: hay que **inscribirlo** (va con la lista P9) |
| Villamil Sara Martina | Foto 28, fila 85: "1?0 000" sobrescrito, "Sep 16 BC" | Sep `paid` $150.000 **en efectivo el 16-sep**, registrado por Milena ese mismo día. Agosto $150.000. PRO | $150.000: vale el registro del mismo día | Ninguna |
| Rangel Ruiz Valeria | Foto 11, fila 35: "1?0 000" con el segundo dígito tapado | Sep `paid` $150.000 el 5-sep **con comprobante, OCR $150.000**. PRO | $150.000 (lo confirma el comprobante) | Ninguna |
| Vargas Benavides Mariana | Foto 11, fila 50: "150 000" claro (igual a la fila 51), "Sep" sin día | Sep ya `paid` 150.000 (tercera tanda, fecha 30-sep puesta porque falta el día). PRO | $150.000 | Ninguna |
| Bejarano Sara Camila | Foto 27, fila 4: "1?0 000", el segundo dígito parece 8 sin bandera | Sep ya `paid` 180.000. Agosto pagado $180.000 con plan ELITE | $180.000 (coherente con agosto y con el plan) | Ninguna. `children.monthly_fee` = 90.000 es un dato viejo, pero manda la inscripción |
| Ceballos Velandia María José | Foto 27, fila 10: "1?0 000" | Sep ya `paid` 180.000. Agosto $180.000 con **comprobante OCR $180.000**. ELITE | $180.000 | Ninguna |
| Mateus León Isabella | Foto 27, fila 32: "1?0 000", **parece más 8 que 5**, "Sep 12 Efectivo" | Sep `paid` **$150.000 en efectivo el 12-sep**, registrado por Milena ese día. Agosto $150.000 con comprobante. PRO | $150.000: el registro de Milena del mismo día pesa más que el trazo | Ninguna. **Sigue algo dudoso**: si en efectivo recibió $180.000, Milena debe corregirlo (y sería un cambio a ELITE) |

## Los que habían quedado fuera de la tercera tanda

| Atleta | Papel | App | Decisión | Acción |
|---|---|---|---|---|
| Vásquez Velásquez Kathalina | $90.000 Ag-26 BC (foto 11, fila 52, claro) | Agosto pagado $90.000 con comprobante **aprobado el 04-ago**. Sep vencido $90.000 (START) | **Son dos pagos distintos** (4-ago y 26-ago, 22 días de diferencia). El del 26-ago es septiembre adelantado | **Sep `paid`** 90.000, fecha 2026-08-26 (B1) |
| Suárez Martínez Daniel | $65.000, "Sep £1" (= 21), BC (foto 20, fila 38) | SENIORS 8 clases $130.000. Ago y sep vencidos | $65.000 es exactamente la mitad: **abono parcial**. BASIC SENIORS cuesta $90.000, así que no corresponde a un plan | **Sep `partial`** 65.000, saldo 65.000 (C3) |
| Nieto Rojas Mia Gabriela | $150.000 Ag-30 BC (foto 21, fila 59) | Inscrita el **30-ago**. Cobro "agosto" ("Plan PRO — Mensualidad completa") pagado el 30-ago con comprobante. Sep vencido | **Misma transferencia.** Milena la anotó como septiembre. El cobro de agosto nació el día de la inscripción. Si empezó en septiembre, el cobro de sep está **duplicado** | Anulación de sep **comentada (D2)**, pendiente de que Milena confirme el mes de inicio |
| Nigrinis García Santiago | $150.000 Sep 5 BC (foto 6, fila 22, claro) | Agosto `paid` $150.000 **en efectivo**, registrado el 04-sep sin comprobante. Sep vencido | **Dudoso.** Puede ser una sola plata (el papel dice BC y la app dice efectivo, con un día de diferencia) o dos pagos (agosto en efectivo y septiembre por transferencia) | Ninguna. Preguntar a Milena |
| García Saltos María Paula | $90.000 Ag 31 BC (foto 27, fila 16) | Agosto `paid` **$110.000** el 31-ago con comprobante (OCR 110.000). Cuota 90.000 (plan PRO con cuota manual). Sep vencido $90.000 | **Dudoso.** Mismo día y medio, pero distinto monto. No se puede saber si fueron dos transferencias | Ninguna. Preguntar a Milena |
| Hernández Rondón Gabriela | "**P** 180 000", "Sep 0?" ilegible, sin medio (foto 21, fila 41) | ELITE $180.000. Agosto pagado. Sep vencido | Lo más probable es que la "P" signifique **pendiente**: no tiene medio ni día legible | Ninguna. Preguntar a Milena qué significa la "P" |
| Escallón, Joven | ver P8 | | abonos | C1 y C2 |

## Lo que hace el SQL

| Bloque | Qué | Filas esperadas |
|---|---|---:|
| A1–A5 | 5 cambios de plan (enrollment) + 5 cobros de octubre reajustados | 10 |
| B1 | Vásquez: sep `paid` $90.000 | 1 |
| C1–C3 | Escallón, Joven, Suárez: sep `partial` | 3 |
| D1, D2 | **Comentados**: Mora Duarte a PRO; anular sep duplicado de Nieto | 0 |

Efecto en dinero: entran $90.000 pagados (Vásquez) + $225.000 en abonos. Octubre neto: +30.000 (Agudelo) +60.000 (Aycardy) −70.000 (Martínez) −30.000 (Luna) −60.000 (Elizalde) = **−$70.000**.

## Pendientes para Milena

1. Mora Duarte Andrés: ¿su mensualidad es $150.000 como la de sus hermanos? Si es así, se aplica D1. ¿Y agosto ($180.000 vencido)?
2. Nieto Mia: ¿empezó en septiembre? Si es así, se aplica D2 (anular el sep duplicado).
3. Balaguera: el 27-ago pagó una sola vez. ¿Eso era agosto o septiembre? En cualquier caso debe un mes. Hoy la app muestra septiembre como el mes que debe.
4. Nigrinis: ¿el efectivo del 4-sep (agosto) y la transferencia del 5-sep (septiembre) fueron dos pagos?
5. García María Paula: ¿el 31-ago hubo dos transferencias ($110.000 y $90.000)?
6. Hernández Gabriela: ¿qué significa la "P" antes del valor?
7. Elizalde: agosto sigue vencido en $150.000 (plan PRO). ¿Se cobra a $90.000, a $150.000 o se perdona?
8. Mateus: confirmar que recibió $150.000 en efectivo el 12-sep (el papel parece decir 180).
9. Joven: ¿los $60.000 fueron un abono, o ella tiene otro valor acordado?
10. Cuéllar Juan Sebastián: inscribirlo (no está en la app). Pagó $150.000 el 1-sep.

---

## Delta (2026-10-05, segunda respuesta de Milena)

Este script (`aplicar_pagos_y_planes_2026-10-05.sql`, sin D1/D2) y `aplicar_matriculas_por_revisar_2026-10-05.sql` **ya están aplicados**. Lo que Milena confirmó después va en un archivo aparte: **`aplicar_delta_mora_nieto_nino_2026-10-05.sql`**. Es idempotente; lo verifiqué contra el estado actual con SELECT y EXPLAIN y todavía **no está aplicado**.

| Atleta | Qué hace el delta | ¿Qué debe después? |
|---|---|---|
| Mora Duarte Andrés | Plan ELITE → **PRO $150.000**. El cobro de octubre pasa de 180.000 a **150.000** | **Agosto $180.000 vencido** (nunca pagó, sin comprobante ni WhatsApp) y octubre $150.000, que vence el 10-oct. Septiembre está pagado. Pendiente con Milena: ¿agosto se cobra a 180.000 (plan viejo) o a 150.000? En la misma familia, José Gabriel debe agosto ($150.000) y Sara Manuela debe agosto y septiembre ($150.000 c/u) |
| Nieto Mia | **Anula** el cobro de sep (`57420b6d`) con `status='cancelled'`, el mismo mecanismo que usa la app (`set_school_athlete_status` / `cancelPendingPlanPayments`) | **No debe nada vencido.** El pago del 30-ago ($150.000, con comprobante) cubre septiembre. Le queda solo octubre $150.000, que vence el 10-oct. No hay comprobantes en revisión, ni mensajes de WhatsApp, ni glosas ni cuotas |
| Niño Daniel = **Julián David Niño Ramírez** | Los $300.000 (foto 23, fila 25: "**2 MESES**", 21-sep, BC) = $150.000 por mes. **Agosto y septiembre quedan `paid`** con amount_paid 150.000 cada uno (ref. `PLANILLA-SEP26-41fa045d` / `-91752550`). La ficha "Daniel Niño" de Matrículas por revisar se **descarta** (`rejected` + motivo, igual que el botón Descartar: `POST /enrollment-intake/:id/reject`) | No debe nada vencido. Octubre $180.000 (ELITE), vence el 10-oct. **Pendiente con Milena:** el papel implica una cuota de $150.000. ¿Lo pasamos a PRO? Además, debajo del nombre hay una palabra borrada que empieza por "Ret…": ¿se retira? |

Por qué los dos meses quedan `paid` y no "agosto pagado completo + septiembre abono de 120.000": la planilla dice explícitamente "2 MESES", así que la escuela dio por cubiertos los dos. Es el mismo criterio de las tandas anteriores (Luna, Elizalde, Mora): cuando el papel difiere del cobro, el mes queda `paid` con amount_paid igual al valor del papel.
Al pasar a `paid`, el trigger `fn_extend_enrollment_on_payment_paid` extiende la vigencia del plan de Julián David, igual que en las tandas anteriores.

García María Paula, Nigrinis y Hernández Gabriela siguen **pendientes**: no se tocaron.
