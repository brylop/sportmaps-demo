# SPEC — Extracción de comprobantes v2 + Módulo de Glosas

> **Estado:** aprobado como fuente de verdad · **Fecha:** 2026-07-17
> **Objetivo:** reemplazar el flujo actual de "aprobación manual de todo comprobante" por:
> extracción estructurada (LLM solo extrae, reglas deciden) + auto-aprobación por reglas +
> ciclo de **glosa** para todo comprobante que no cruce limpio.
> **El LLM NUNCA aprueba ni rechaza. Solo lee.**

## Contexto de implementación (estado actual del repo, 2026-07-17)

- Extracción: `bff/src/services/ocr.service.ts` → `POST /api/v1/payments/extract-receipt`.
- Validación actual: client-side en `frontend/src/hooks/useReceiptValidator.ts` (bloqueos duros
  fecha/moneda/monto). **Se reemplaza** por el pipeline de reglas del BFF (§2).
- Persistencia actual: `payments.ocr_*` (mig 20260503000002), `payments.ocr_raw_response`
  (mig 20260624000001), índice único `uq_payments_school_ocr_reference` sobre
  `(school_id, ocr_reference)` (mig 20260511000004) — el check #7 (§2) lo sustituye por
  `reference_norm` normalizado.
- Config por escuela: `school_settings` (ya tiene `allow_installments`,
  `min_installment_amount`, etc. — mig 20260713000002). Aquí se agregan los toggles nuevos.
- `payments.status` es **TEXT** (no enum). Los estados nuevos se agregan como literales.
- Legacy: existe una Edge Function `analyze-receipt` (solo fecha+monto) usada por
  `InstallmentCheckoutModal.tsx`. Migrar ese caller al BFF como parte de esta feature.

---

## 1. Prompt de extracción (reemplaza el prompt actual)

Usar este prompt tal cual con el provider primario (Groq) y con el secundario (Gemini 2.5 Flash)
cuando aplique doble extracción (§3).

```
Eres un extractor de datos de comprobantes de pago colombianos (DaviPlata, Nequi,
Bancolombia, BBVA, Davivienda, Movii, Bre-B, PSE, etc.).
Devuelve UNICAMENTE un JSON valido con este schema, sin texto adicional:
{
  "amount": <numero sin separadores, ej 150000> | null,
  "currency": "COP" | "USD" | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "bank": "DaviPlata"|"Nequi"|"Bancolombia"|"BBVA"|"Davivienda"|"Movii"|"BreB"|"PSE"|"Otro" | null,
  "reference": "<numero de operacion/aprobacion/comprobante/CUS>" | null,
  "destination": "<numero de cuenta, celular o llave A LA QUE SE ENVIO el dinero>" | null,
  "destination_name": "<nombre del titular destino, etiqueta 'Para'>" | null,
  "origin_name": "<nombre de quien envia>" | null,
  "is_receipt": true | false,
  "is_transaction_list": true | false,
  "missing_fields": ["<campos que NO son visibles o legibles en la imagen>"]
}
Reglas:
- amount: SOLO el monto principal ("Valor", "Monto", "Total"). Ignora comisiones y saldos.
- amount: el formato colombiano usa punto de miles y coma decimal.
  "$ 1.000,00" -> 1000. "$ 150.000" -> 150000.
- date/time: convierte cualquier formato. "Abril 28 de 2026, 11:51 p.m." -> "2026-04-28", "23:51".
- destination: el numero DESTINO (a quien le llego la plata), NO el de quien envia.
  Busca etiquetas como "Llave", "Para", "Cuenta destino", "Banco destino", "Numero Nequi".
  En envios por llave (Bre-B/Nequi), destination es el numero de la llave.
- is_receipt: false si la imagen no es un comprobante de pago individual.
- is_transaction_list: true si es un pantallazo de lista de movimientos, no un comprobante individual.
- missing_fields: lista todo campo del schema que no aparece o no es legible.
  Reporta lo que VES; no juzgues validez.
- NUNCA inventes datos. Campo no legible = null + entrada en missing_fields.
```

### Patrones de referencia por banco (capa de reglas, NO en el prompt)

```typescript
const REFERENCE_PATTERNS: Record<string, RegExp> = {
  Nequi:       /^[A-Z]?\d{8,12}$/i,   // ej: "M09743655" — letra opcional + 8-12 digitos
  Bancolombia: /^\d{8,12}$/,
  DaviPlata:   /^\d{6,12}$/,
  BreB:        /^[A-Z0-9-]{8,30}$/i,
  PSE:         /^\d{6,15}$/,          // CUS
  Otro:        /^[A-Z0-9-]{4,30}$/i,
};
// PUNTO DE PARTIDA: calibrar con comprobantes reales antes de confiar
// en el check de formato. Un patron que falla = amarillo, nunca rojo.
```

---

## 2. Pipeline de decisión (reglas determinísticas)

Orden de evaluación tras la extracción. El resultado es un **veredicto**: `verde | amarillo | rojo`.

| # | Check | Falla → |
|---|-------|---------|
| 1 | `is_receipt = false` | ROJO — "la imagen no es un comprobante de pago" |
| 2 | `is_transaction_list = true` | ROJO — "sube el comprobante individual, no la lista de movimientos" |
| 3 | `missing_fields` contiene amount, date o reference | AMARILLO — pedir captura completa |
| 4 | `destination` no matchea ninguna cuenta registrada de la escuela | ROJO |
| 5 | `amount` ≠ valor esperado del cobro (tolerancia 0) | AMARILLO |
| 6 | `date` fuera de la ventana configurada (`receipt_date_window_days`, default 5) | AMARILLO; fecha futura → ROJO |
| 7 | `reference_norm` ya usada (índice único por escuela+banco) | ROJO — "comprobante ya utilizado" |
| 8 | `image_sha256` duplicado | ROJO |
| 9 | Formato de referencia no matchea patrón del banco | AMARILLO |

- ROJO solo para lo imposible/fraude. Todo lo discutible es AMARILLO.
- `destination_name` vs titular registrado: señal informativa en el panel, no bloquea.

## 3. Doble extracción para auto-aprobar

- Candidato a VERDE (checks 1–9 pasan) → segunda extracción con provider distinto (Gemini).
- `amount` y `reference_norm` iguales entre ambos → **VERDE confirmado → auto-aprobado**
  (si `auto_approve_enabled = true` y monto ≤ `auto_approve_max_amount`).
- Difieren → AMARILLO con motivo "lectura inconsistente", ambos valores visibles al admin.
- NO pedir "confianza" al LLM. La coincidencia entre dos modelos ES la confianza.
- Modo sombra: mientras `auto_approve_enabled = false`, guardar veredicto + razones en todo
  comprobante sin auto-aprobar nada. El badge se muestra informativo.

## 4. Estado post-aprobación (conciliación diferida)

Un pago auto-aprobado (o aprobado manual) queda en `aprobado_pendiente_conciliacion`.
Cuando el admin carga/cruza el extracto bancario (CSV/Excel de Nequi/Bancolombia):
- Match por monto + fecha (±1 día) + referencia → pasa a `confirmado`.
- Sin match tras la conciliación → **se abre GLOSA automática** (motivo `NO_APARECE_EN_BANCO`)
  y el pago vuelve a `glosado`.

---

## 5. MÓDULO DE GLOSAS (nuevo)

### 5.1 Concepto

Todo comprobante que no cruce limpio NO se rechaza en seco: entra a un ciclo de discusión
con motivo tipificado, respuesta del acudiente y conciliación del admin. El admin deja de
"rechazar pagos de papás" — el sistema objeta con motivo objetivo y el admin solo concilia.

### 5.2 Motivos tipificados

```typescript
type GlosaReason =
  | 'MONTO_DIFIERE'          // amount ≠ esperado
  | 'FECHA_FUERA_VENTANA'
  | 'REFERENCIA_DUPLICADA'
  | 'DESTINO_NO_COINCIDE'
  | 'CAMPOS_ILEGIBLES'
  | 'LECTURA_INCONSISTENTE'  // doble extracción difiere
  | 'NO_APARECE_EN_BANCO'    // conciliación diferida falló
  | 'OTRO';                  // requiere nota manual
```

### 5.3 Estados y transiciones

```
comprobante AMARILLO sin resolver / conciliación fallida
        │
        ▼
    GLOSADA ──(notificación al acudiente con motivo + qué aportar)
        │
        ▼
  EN_RESPUESTA ──(acudiente sube soporte adicional o aclara: pagó 2 meses,
        │          pagó con descuento, comprobante completo, etc.)
        ▼
  EN_CONCILIACION ──(admin ve lado a lado: esperado vs extraído vs respuesta)
        │
        ├──► ACEPTADA   → pago aprobado con nota obligatoria
        └──► RATIFICADA → pago sigue pendiente; el cobro se reactiva
```

- Plazo de respuesta: `glosa_response_days` (default **5 días**). Vencido sin respuesta
  → auto-transición a RATIFICADA (job diario) con notificación.
- Una glosa RATIFICADA puede reabrirse manualmente por el admin (log obligatorio).
- ROJOS por fraude claro (hash duplicado, no-es-comprobante) NO generan glosa: rechazo
  directo con mensaje. La glosa es para lo discutible.

### 5.4 Esquema de datos

```sql
CREATE TABLE payment_glosas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES schools(id),
  payment_id      uuid NOT NULL,               -- FK al cobro/pago
  receipt_id      uuid,                        -- FK al comprobante (si existe)
  reason          text NOT NULL,               -- GlosaReason
  reason_detail   jsonb,                       -- {expected: 150000, extracted: 130000}
  status          text NOT NULL DEFAULT 'GLOSADA'
                  CHECK (status IN ('GLOSADA','EN_RESPUESTA','EN_CONCILIACION',
                                    'ACEPTADA','RATIFICADA')),
  response_text   text,                        -- aclaración del acudiente
  response_files  jsonb,                       -- soportes adicionales subidos
  resolution_note text,                        -- nota del admin al cerrar (obligatoria)
  responds_by     date NOT NULL,               -- fecha límite de respuesta
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid                         -- admin que cerró
);

CREATE INDEX ON payment_glosas (school_id, status);
CREATE INDEX ON payment_glosas (responds_by) WHERE status = 'GLOSADA';

-- settings por escuela (agregar a la tabla de config de pagos existente)
glosa_response_days  int NOT NULL DEFAULT 5;
```

- RLS: acudiente solo ve/responde glosas de sus propios pagos; admin de escuela ve todas.
- Job diario: `GLOSADA` con `responds_by < today` → `RATIFICADA` + notificación.

> **Nota de implementación (Fase 3): reactivación de pago sin guardar status previo.**
> Cuando una glosa pasa a `RATIFICADA` (por conciliación o por el job de vencimiento), el pago
> vuelve a `pending` — **no** se guarda ni restaura el estado que tenía antes de glosarse. Si el
> pago estaba `overdue` al momento de glosarse, tras la ratificación queda `pending` y será el
> motor de mora (`apply_late_fees`, cron diario) quien lo vuelva a marcar `overdue` en su próxima
> corrida. Consecuencia conocida y tolerada: el acudiente "gana" unas horas sin recargo entre la
> ratificación y la corrida de mora. Es una simplificación v1 deliberada, no un bug.
> Además, todas las fechas "hoy" del ciclo de glosa se calculan en `America/Bogota`
> (`(now() AT TIME ZONE 'America/Bogota')::date`), no en UTC: una glosa que vence HOY no se
> ratifica hasta el día siguiente — el acudiente tiene todo su último día.

### 5.5 Notificaciones

| Evento | A quién | Contenido |
|---|---|---|
| Glosa creada | Acudiente | Motivo en lenguaje simple + qué debe aportar + plazo |
| Respuesta recibida | Admin | Glosa lista para conciliar |
| Aceptada | Acudiente | Pago aprobado |
| Ratificada | Acudiente | Pago sigue pendiente + cómo regularizar |
| Vence mañana | Acudiente | Recordatorio |

Mensajes por el canal ya existente (email/WhatsApp template). Lenguaje simple: nunca
mostrar "GLOSADA" al papá — mostrar "tu comprobante necesita una aclaración".

### 5.6 UI

**Admin:**
- Pestaña "Glosas" en el módulo de pagos: lista con filtros por estado y motivo,
  contador de vencidas/por vencer.
- Vista de conciliación: 3 columnas — lo esperado (cobro) | lo extraído (OcrResult +
  imagen) | la respuesta del acudiente. Botones: Aceptar (nota obligatoria) / Ratificar.
- Dashboard: glosas abiertas, % aceptadas vs ratificadas, top motivos del mes
  (métrica causal: si el 60% es MONTO_DIFIERE, el problema es comunicación de tarifas).

**Acudiente:**
- El pago glosado aparece con estado "Necesita aclaración" + motivo + botón
  "Responder" (texto + subir soporte).

---

## 6. Fases de implementación

| Fase | Entregable |
|---|---|
| 1 | Prompt v2 + `OcrResult` actualizado + `REFERENCE_PATTERNS` + pipeline de checks §2 |
| 2 | Persistencia de veredicto (verdict, reasons, hash, reference_norm, índices únicos) + modo sombra |
| 3 | Migración `payment_glosas` + creación de glosa desde amarillos + estados/transiciones + job de vencimiento |
| 4 | UI acudiente (responder glosa) + notificaciones + UI admin (conciliación 3 columnas) |
| 5 | Doble extracción + auto-aprobación con toggle/tope + estado `aprobado_pendiente_conciliacion` |
| 6 | Cruce contra extracto bancario (CSV) + glosa automática `NO_APARECE_EN_BANCO` + dashboard de motivos |

## 7. Criterios de aceptación

1. Comprobante con todos los checks en verde + doble extracción coincidente + auto-approve ON
   + monto ≤ tope → aprobado sin intervención humana. ✓
2. Comprobante con monto $130.000 contra cobro de $150.000 → glosa `MONTO_DIFIERE` con
   `reason_detail {expected:150000, extracted:130000}`, notificación al acudiente. ✓
3. Acudiente responde "pagué con el descuento de hermanos" + soporte → glosa pasa a
   EN_RESPUESTA → admin la ve en conciliación con las 3 columnas. ✓
4. Admin acepta → pago aprobado, nota guardada, glosa ACEPTADA con resolved_by. ✓
5. Glosa sin respuesta a los 5 días → RATIFICADA automática por el job + notificación. ✓
6. Hash de imagen duplicado → rechazo directo, NO genera glosa. ✓
7. Extracto bancario cargado, pago auto-aprobado sin match → glosa `NO_APARECE_EN_BANCO`
   y el pago revierte de aprobado a glosado, con log. ✓
8. "$ 1.000,00" se extrae como 1000, nunca como 100000. ✓
9. Referencia Nequi "M09743655" pasa el check de formato. ✓
10. Dashboard muestra distribución de motivos de glosa del mes. ✓
11. RLS: un acudiente no puede ver ni responder glosas de otro. ✓
12. Modo sombra: con auto_approve OFF, todo comprobante guarda veredicto sin auto-aprobarse. ✓

## 8. Instrucciones de ejecución

- Ejecutar **fase por fase** en el orden de §6, con plan mode antes de cada migración.
- Fase 1–2 primero y correr modo sombra con comprobantes reales para calibrar
  `REFERENCE_PATTERNS` antes de activar nada.
- No construir reparto de "un comprobante cubre varios cobros" todavía — v1: el admin
  puede aceptar manualmente con nota una glosa de referencia duplicada.
- Cero hardcoding de cuentas, montos o escuelas: todo desde configuración/BD.