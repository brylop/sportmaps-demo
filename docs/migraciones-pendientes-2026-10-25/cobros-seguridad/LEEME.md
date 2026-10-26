# Seguridad de cobros — migraciones (2026-10-25)

Rama `cobros/seguridad-2026-10-25`. Reemplaza a `docs/migraciones-pendientes-2026-10-24/`.

## Lo primero: las partes 1 a 4 YA están vivas

El LEEME del 10-24 decía «ninguna aplicada». Hoy (10-25, solo lectura) **todos** sus objetos existen en la base y el cuerpo de las 9 funciones coincide, sin espacios, con `cobros_seguridad_pendientes_CONSOLIDADA.sql` (la 02 en su versión corregida «marca, no rechaza» y la 03 rebasada). Alguien pegó el consolidado entre el 10-24 y el 10-25. No dejó rastro en `schema_migrations`.

Tampoco se perdió nada al aplicarlo: `auto_approve_payment` viva = la de `20260722000004` + la guarda de `amount_source`, y `wa_identify_by_phone` viva = la de `20261013165308` + la revinculación (ninguna migración posterior la reemplaza; `20261024211855` crea otra función, `wa_identify_staff_by_phone`).

Quedaron versionadas en `supabase/migrations/` con fechas nuevas (re-ejecutables, **no hace falta volver a pegarlas**):

| Migración | Qué | Estado |
|---|---|---|
| `20261025205950_wa_limite_comprobantes_ocr` | Tope de comprobantes a OCR por número y escuela | viva |
| `20261025205952_payments_monto_del_servidor` | `amount_source` + marca + `auto_approve_payment` no aprueba 'cliente' | viva |
| `20261025205953_wa_revinculacion_con_codigo_por_correo` | Número que pasa a otro acudiente exige código por correo | viva |
| `20261025205955_conciliacion_correo_banco_dkim` | Avisos del banco por correo con DKIM | viva |
| `20261025205957_payments_monto_servidor_despues_de_s4` | Alinea la marca con S4 | **pendiente** |

## Qué pegar (en orden)

1. `01_payments_monto_servidor_despues_de_s4.sql` (= `20261025205957`). Es la **única** pendiente. Una sola sesión, sin nada más aplicando en paralelo. Si sale `55P03 lock_timeout`, volver a correrla.
2. `verificar.sql`. Termina **siempre** en «error»: es a propósito, así se deshace todo. Tiene que decir `RESULTADO OK (todo se deshizo): permisos, limite_ocr, revinculacion, monto_servidor[despues_de_s4]`. Se puede correr también antes del paso 1 (dirá `[antes_de_s4]`).
3. `npm run seguridad:invariantes` (una vez, al final).

**No se ejecutó nada de esto contra la base.** La sintaxis SQL y PL/pgSQL está validada con el parser de Postgres (libpg-query). `verificar.sql` no se corrió: inserta (y deshace) filas en la base compartida.

## Por qué hace falta la 05

S4 (`20261010145241` + `20261013192856`, viva desde el 10-10) ya pone el monto del servidor en los INSERT del navegador. La marca de la 02 se escribió el 10-07, antes de S4, y hoy:

- **Corre antes de S4** (`trg_zz_…` < `trg_zzy_…` en orden alfabético): mira el monto que mandó el navegador, no el que deja S4.
- **Usa otra regla:** solo inscripciones activas, y el orden plan > equipo (S4 usa equipo > plan y también pending). La primera mensualidad de una inscripción pending (justo la que `auto_approve_payment` activa) nunca se auto-aprueba, y la inscripción y el seguro tarifados por S4 quedan siempre 'cliente'.

La 05 la mueve después de S4 (`trg_zzyz_…`, antes de descuentos y pronto pago) y usa la misma tarifa de S4. Nadie queda bloqueado con ninguna de las dos: la marca solo decide si se puede auto-aprobar.

## Radio medido (2026-10-25, solo lectura)

**02 / 05: monto del servidor.** `audit_logs`, INSERT de `payments`, últimos 30 días: 1.054 en total.

| Origen | Inserts | Afectados |
|---|---|---|
| Sin usuario (cron, BFF, bot de WhatsApp con service_role, RPC) | 539 | 0: el trigger no los toca |
| Staff de la escuela | 494 | 0 |
| QR de inscripción (RPC) | 8 | 0 |
| Navegador, no staff (PaymentCheckoutModal, ParentCheckoutPage, acudiente V2 y deportista V2, que usan PaymentCheckoutModal) | 13 | ver abajo |

Los 13 son de Dynasty: 11 transferencias y 2 «otro medio». Ninguno fue por pasarela: 0 cobros en línea del navegador en 30 días. Dynasty no tiene auto-aprobación.

- Con la regla viva: 11 'servidor' y 2 'cliente'. Uno es un abono «otro» y el otro una mensualidad de 180.000 cuyo plan vigente hoy es de 90.000.
- Con la 05: 12 'servidor' (las 12 mensualidades, tarifadas por S4) y 1 'cliente' (el abono).
- **Rechazos: 0 con cualquiera de las dos.** Solo se rechaza un monto ≤ 0.
- Escuelas con auto-aprobación: 3 (Besser, GYM RM y Escuela Demo). Auto-aprobaciones en 30 días: 0. El efecto práctico hoy es nulo.
- Desde que la 02 está viva no se ha creado ningún pago 'cliente': hubo 5 inserts en 3 días, todos de servidor.

**03: revinculación de WhatsApp.** 180 conversaciones identificadas:

- 171 resuelven por teléfono al mismo acudiente.
- 5 resuelven al mismo atleta adulto.
- 4 no resuelven por teléfono (se identificaron por correo) y siguen igual.
- 0 pasarían a revinculación. En la tabla hay 0 revinculaciones creadas, 0 cupos de OCR y 0 buzones de banco.

**Pasarela.** Hay 0 escuelas en 'aggregator', 2 en 'direct' y 369 en 'unset'. Por eso, que `create-session` firme siempre en el BFF y que la Edge Function `wompi-sign` deje de servir de respaldo no cambia a ninguna escuela que cobre hoy.

## Riesgo que ya está abierto (no es de estas migraciones)

La base **ya** devuelve `revinculacion_pendiente`, pero el BFF desplegado (develop/main) no conoce ese estado. En `whatsapp-queue.job.ts`, si no es 'identificado', **cae al `conv.parent_id` leído antes de la RPC**: un comprobante de un número que pasó a otra familia se aplicaría a los cobros de la familia anterior. Hoy hay 0 casos. Lo cierra el código de esta rama (`revinculacionPendiente(...)`), así que **conviene desplegar el BFF de esta rama pronto**. Lo mismo con el límite de OCR: la RPC existe pero nadie la llama hasta desplegar.

## Reversa

- **05:** `reversa.sql` vuelve exactamente a lo vivo hoy (función de `20261025205952` + `trg_zz_payments_monto_servidor`).
- **02 (si hiciera falta):** `DROP TRIGGER trg_zz_payments_monto_servidor` / `trg_zzyz_…` y restaurar `auto_approve_payment` desde `20260722000004`. La columna `amount_source` se puede dejar: tiene default 'servidor' y nadie más la lee.
- **03:** restaurar `wa_identify_by_phone` desde `20261013165308`. Las columnas nuevas se pueden dejar.
- **01 y 04:** solo crean objetos nuevos; no hace falta reversa.
