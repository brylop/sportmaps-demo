# Plan — `payments.payment_provider` deja de mentir

> Estado: **PROPUESTA, sin código.** Convención del repo: el plan se aprueba antes de
> escribir la migración. Nada de esto está aplicado.

## El problema

`payments.payment_provider` se creó con **`DEFAULT 'wompi'`**
([mig 20260504000001](../supabase/migrations/20260504000001_payment_provider_generic.sql#L41)),
así que toda fila insertada sin especificar provider queda sellada como Wompi.

Medido en la base compartida (2026-07-30):

| payment_provider | filas |
|---|---|
| `wompi` | 3.205 |
| `mercadopago` | 3 |

Pero por canal, de esas 3.208 filas: 3.018 `manual`, 163 `transfer`, 12 `cash`, **15 `online`**.
O sea: efectivo, transferencias registradas a mano y cobros emitidos dicen todos "wompi".
Solo 15 pagos pasaron realmente por una pasarela.

Consecuencias que ya se manifestaron:

1. Un comprobante de transferencia subido por un acudiente quedó con
   `payment_provider='wompi'`. La cola de "Cobros por Aprobar" excluye a propósito los
   pagos de pasarela (los confirma el webhook, la escuela no debe aprobarlos a mano),
   así que ese comprobante estaba a un `select` de distancia de volverse invisible.
2. Cualquier reporte que agrupe ingresos por proveedor da "100% Wompi", que es falso.

## Ya resuelto en la app (sin migración)

- `lib/paymentOrigin.ts` decide el origen **sin creerle a la columna**: usa
  `payment_channel='online'` o una referencia de pasarela real
  (`wompi_reference` / `wompi_transaction_id` / `provider_transaction_id`), y trata
  cualquier pago con comprobante adjunto como validación manual.
- `payment_provider` se lee solo para **nombrar** la pasarela, y solo se cree cuando
  no es el default: `'mercadopago'` alguien lo escribió a propósito.

Esta migración no desbloquea la UI — la UI ya distingue. Sirve para que la columna deje
de ser una trampa para el próximo que la lea de buena fe.

## Cambios propuestos

### 1. Quitar el default (bajo riesgo)

```sql
ALTER TABLE public.payments ALTER COLUMN payment_provider DROP DEFAULT;
```

Desde ese momento, un insert que no diga provider deja `NULL` = "no pasó por pasarela",
que es la verdad. Los call sites que sí deben sellarlo ya lo hacen explícitamente
(`PaymentCheckoutModal.tsx:235` wompi, `:419`/`:443` mercadopago, `transactions.ts:177`).

**Verificar antes:** que ningún `INSERT` dependa del default para una fila que sí es de
pasarela. Los 4 call sites de arriba son explícitos; falta revisar los RPCs que insertan
pagos (`submit_qr_signup`, `open_month`, los de recurrentes) — si alguno crea pagos de
pasarela sin setear provider, quitar el default los dejaría en NULL.

La misma migración toca las otras tablas con el mismo default heredado
(`school_payment_providers`, `vendor_payment_providers`, marketplace…): el archivo
20260504000001 repite `DEFAULT 'wompi'` en 9 lugares. Hay que decidir si se limpian
todas o solo `payments`. **Recomiendo solo `payments` en esta migración** y una segunda
pasada para el resto, para que un rollback sea acotado.

### 2. Backfill de las filas históricas (requiere decisión)

```sql
-- Regla: si no hay evidencia de pasarela, el provider es NULL.
UPDATE public.payments
   SET payment_provider = NULL
 WHERE payment_provider = 'wompi'
   AND payment_channel IS DISTINCT FROM 'online'
   AND wompi_reference IS NULL
   AND wompi_transaction_id IS NULL
   AND provider_transaction_id IS NULL;
```

Afecta ~3.190 filas. Las 15 `online` y las 3 `mercadopago` quedan intactas.

**Efectos colaterales verificados en los triggers de `payments`:**

| Trigger | ¿Dispara con un UPDATE solo de provider? |
|---|---|
| `trg_payment_fee_to_expense_upd` | No — es `AFTER UPDATE OF status` |
| `trg_bump_qr_paid_count` | No — es `AFTER UPDATE OF status` |
| `trg_extend_enrollment_on_payment_paid` | Dispara (no está acotado por columna) pero **sale temprano**: su guarda interna exige `NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid'` |
| `trg_audit_payments` | **Sí** — `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW`, sin acotar por columna |

O sea: el backfill es funcionalmente inocuo pero **escribe ~3.190 filas de auditoría**.
Opciones:

- **(A)** Aceptar el ruido. Es un evento único y trazable, y la auditoría refleja un
  cambio real de datos. *Recomendada.*
- **(B)** Batchear en tandas de 500 para no hacer una transacción larga sobre una tabla
  caliente de dinero.
- **(C)** No hacer backfill: solo quitar el default y dejar el histórico como está,
  documentando que `payment_provider` no es confiable antes de esta fecha. Más barato,
  pero la columna sigue mintiendo en el 99% de las filas.

### 3. Documentar la columna

```sql
COMMENT ON COLUMN public.payments.payment_provider IS
  'Pasarela que procesó el pago. NULL = no pasó por pasarela (efectivo, transferencia,
   registro manual). Tuvo DEFAULT ''wompi'' hasta <fecha>, así que las filas anteriores
   al backfill pueden decir wompi sin serlo. Para saber si hubo pasarela usar
   payment_channel=''online'' o una referencia de pasarela, no esta columna.';
```

## Fuera de alcance, relacionado

El RPC `school_payment_kpis` tiene la misma trampa de sede que ya se corrigió en la UI:
filtra con `(p_branch_id IS NULL OR p.branch_id = p_branch_id)`
([mig 20260730000005](../supabase/migrations/20260730000005_school_payment_kpis.sql#L91)),
así que con una sede seleccionada las tarjetas ignoran los pagos con `branch_id NULL`
(207 de 499 en Dynasty) y discrepan de las tablas. Es otra migración; la menciono para
que no se pierda.

## Cómo se aplicaría

Ledger obligatorio: `npm run migrations:new -- payment-provider-drop-default`, commitear
el `.sql` junto a `supabase/migrations_ledger.json`. Nada de editar migraciones viejas.

## Decisiones pendientes

1. ¿Backfill A, B o C?
2. ¿Solo `payments` o también las otras 8 columnas con el mismo default?
3. ¿Se revisan los RPCs que insertan pagos antes de quitar el default, o se quita y se
   corrige lo que aparezca?
