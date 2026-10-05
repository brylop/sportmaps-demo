# Factus Pay — recaudo por QR (DIN-23)

v0.1 · 2026-10-05 · Estado: **plan para aprobar** (el adaptador ya existe; nada de base ni rutas)

## 1. Qué es y qué no es

Factus Pay genera un **QR de cobro** por referencia y monto. El pagador lo escanea desde su app bancaria y Factus marca el recaudo como `paid`. Es un producto distinto de Factus facturación (DIAN).

**La plata entra a la cuenta de Factus Pay que creó el recaudo.** La cuenta que tenemos (`contacto@sportmaps.co`) es de SportMaps:

| Uso | ¿Con la cuenta de SportMaps? | Por qué |
|---|---|---|
| Factura SaaS (escuela → SportMaps) | **Sí** | La plata es nuestra. Es el primer uso (este spec). |
| Mensualidad (acudiente → escuela) | **No** | La plata sería de la escuela y caería en SportMaps: es el modelo de recaudar y dispersar que ya descartamos con Wompi (riesgo SFC). |
| Mensualidad con la cuenta **de la escuela** | Sí, en F3 | Cada escuela abre su cuenta de Factus Pay y nos da su token. Se guarda en `school_payment_providers`, igual que Wompi. Depende de que Factus confirme cuentas de terceros o subcuentas. |

## 2. Lo validado contra el sandbox (2026-10-05)

- `POST /v1/collections {reference_code, amount}` → `status: ready`, QR en base64 y `qr_expires_at` a ~24 h.
- Montos en **pesos enteros**, de 10.000 a 12.000.000.
- Misma referencia y mismo monto → devuelve el existente. Misma referencia y **otro monto → 422**.
- `GET /v1/collections/:ref` → estado. Sin webhook: hay que consultar.
- Token: se genera una sola vez; cada `/auth` revoca el anterior. El BFF nunca llama a `/auth`.

Adaptador: `bff/src/services/factus-pay.service.ts` (+ 21 tests). Probado en vivo contra el sandbox.

## 3. F1 — QR en la factura SaaS

### 3.1 Base (una migración)

Columnas nuevas en `school_subscription_invoices` (hoy 9 filas):

```
qr_provider        text  CHECK (qr_provider IN ('factus_pay'))   -- null = sin QR
qr_reference       text  UNIQUE                                    -- SAAS-<invoice_number>[-n]
qr_amount          integer                                         -- pesos enviados a Factus
qr_status          text  CHECK (qr_status IN ('pending','paid','failed'))
qr_expires_at      timestamptz
qr_last_checked_at timestamptz
qr_paid_at         timestamptz
```

- El QR (imagen) **no** se guarda: vence en 24 h y se vuelve a pedir a Factus con la misma referencia, que es idempotente.
- `qr_reference` cambia (sufijo `-2`, `-3`) solo si cambia el monto de la factura, porque Factus rechaza la misma referencia con otro monto.
- `amount_cents` ÷ 100 = pesos. Si no da entero o queda fuera de 10.000–12.000.000, la factura no ofrece QR.
- Sin RLS nueva: la tabla solo se escribe desde el BFF (`service_role`). Revisar que la lectura de la escuela siga con `user_admin_school_ids()`.

### 3.2 BFF

- `POST /api/v1/saas-invoices/:id/qr` (admin de la escuela de esa factura): crea o recupera el recaudo y devuelve `{ qr, expiresAt, status }`. Si la factura ya está `paid`, devuelve 409.
- `GET /api/v1/saas-invoices/:id/qr/status`: consulta Factus en el momento (para el "Ya pagué" de la pantalla).
- **Consultor de estado** en `maintenance.job.ts`, cada 5 min: facturas con `qr_status='pending'` y `status IN ('pending','overdue')`. Cuando Factus dice `paid`, marca `qr_status='paid'` y llama a `markInvoicePaid` con un actor de sistema. Hace falta un candado para que corra en un solo BFF a la vez, porque son 3 BFF contra una sola base.
- Sin config de Factus Pay (`FACTUS_PAY_*` vacías) → no se ofrece QR (fail-closed), y el resto de la factura sigue igual.

### 3.3 Frontend

- En la factura de la escuela, junto a las cuentas bancarias: botón **"Pagar con QR"** → muestra el QR, el monto, la hora a la que vence y "Ya pagué" (consulta el estado).
- El correo y el WhatsApp de la factura siguen igual en F1. En F2 llevan un enlace directo al QR.

### 3.4 Pruebas

- vitest de las rutas y del consultor (Factus simulado): crea, idempotencia, cambio de monto → nueva referencia, `paid` → factura pagada una sola vez, dos consultores a la vez → un solo `markInvoicePaid`.
- Sandbox: pagar el recaudo desde el panel de Factus y ver la factura pasar a pagada sola.

## 4. Fases

| Fase | Qué | Depende de |
|---|---|---|
| F0 | Token sandbox + prueba manual + adaptador | **Hecho 2026-10-05** |
| F1 | QR en la factura SaaS (§3) | Aprobar este plan; ver `paid` en sandbox |
| F2 | Enlace del QR en el correo y el WhatsApp de la factura | F1 |
| F3 | Mensualidades con la cuenta de Factus Pay **de cada escuela** | Respuestas de Factus (§5) y decisión D-FPAY |

## 5. Preguntas para Factus

1. ¿Hay webhook o notificación cuando un recaudo pasa a `paid`?
2. ¿Cuánto cuesta cada recaudo?
3. ¿Con qué apps o medios se puede pagar el QR (Bre-B, Nequi, Daviplata, bancos)?
4. ¿Se puede operar en nombre de terceros (cuentas o subcuentas por escuela), con la plata yendo directo a la escuela?
5. ¿Cómo se simula un pago en el sandbox?
6. ¿Se puede tener un token por ambiente (dev, staging y producción) con usuarios distintos de la misma cuenta?
