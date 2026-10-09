# Plan maestro de cobros — SportMaps (2026-10-07)

Documento único que junta todo lo de cobros: pasarelas, cuenta propia por escuela, débito automático, Bre-B/Factus Pay, cobro por WhatsApp con IA, ciclo de cobro, cobranza y conciliación. **No reemplaza los specs de detalle**; los ordena, dice qué está vivo de verdad y fija **un solo orden de ejecución**. Si este documento y un spec de detalle se contradicen en *estado*, manda la base viva; en *decisiones*, manda este documento hasta que se actualice el spec.

Estado medido el 2026-10-07 en la base viva (`luebjarufsiadojhvxgi`, compartida por dev/stg/prod) y en el repo, solo lectura.

---

## 1. La foto en una página

**Volumen (3 escuelas piloto):** Dynasty, Besser y Monster facturan **~$112 M/mes ≈ $1.340 M/año** (718 atletas activos). SportMaps registra como cobrado ~$48 M/mes.

| Escuela | Atletas activos | Facturación mensual | Cobrado registrado |
|---|---|---|---|
| Dynasty | 504 | $72,5 M | ~$45 M |
| Besser | 89 | $21,2 M | ~$2,5 M |
| Monster | 125 | ~$18,1 M *(estimado: 0 atletas con monto)* | $0 |

**Cómo pagan las familias hoy (Dynasty, pagos `paid` últimos 60 días, $84,6 M):**

| Vía | Pagos | Monto | % |
|---|---|---|---|
| Transferencia + comprobante | 339 | $52,5 M | 62 % |
| Efectivo | 130 | $20,2 M | 24 % |
| Transferencia registrada a mano | 58 | $9,3 M | 11 % |
| **Pasarela Wompi** | **17** | **$2,6 M** | **3 %** |

**Conclusión de negocio:** el problema no es la comisión de la pasarela, es **confirmar y conciliar transferencias**. El 97 % del dinero llega por fuera de la pasarela. Todo el plan se ordena alrededor de eso.

---

## 2. Principios (no se negocian)

1. **SportMaps nunca recibe ni custodia la plata de las mensualidades.** Cada escuela cobra en una cuenta **a su nombre**. Recaudar en una cuenta de SportMaps y dispersar = riesgo de captación ante la SFC; un "contrato de mandato" resuelve DIAN, no SFC. Aplica también a Mono/Factus: un *ledger* virtual dentro de la cuenta de otro (tenant) **no cuenta** como cuenta de la escuela.
2. **Fail-closed.** Si la escuela no tiene cuenta propia lista, el cobro en línea se bloquea; nunca cae a una cuenta ajena (`payment-provider.resolver.ts`).
3. **La IA conversa, no decide dinero.** Montos, estados y aprobaciones salen de la base y de reglas fijas (`receipt-verdict.ts`, trigger de guarda). Solo veredicto verde con doble lectura coincidente auto-aprueba.
4. **La tarjeta nunca se digita en el chat.** El bot manda link; la familia inscribe la tarjeta una vez (PCI).
5. **La escuela decide precios y recargos.** SportMaps muestra el costo y sugiere; no impone.
6. **Un pago confirmado por la fuente del dinero vale más que uno leído de una imagen.** Orden de confianza: webhook de pasarela/Bre-B > correo del banco con DKIM > extracto cargado > OCR de comprobante > registro manual.

---

## 3. Arquitectura en cinco capas

```
Canal         → App (checkout) · WhatsApp (bot) · Correo/QR impreso
Medio de pago → Bre-B QR (Factus Pay) · Wompi tarjeta/Nequi/PSE · Transferencia + comprobante · Efectivo
Quién recibe  → Cuenta propia de la escuela (direct)  ← única opción para cobros nuevos
Confirmación  → Webhook / consulta de estado · OCR de comprobante · Registro manual
Conciliación  → Extracto del banco · Correo del banco (DKIM) · Panel de la escuela
```

### 3.1 Medios de pago y su rol

| Medio | Rol | Recurrente | Costo aprox. | Estado |
|---|---|---|---|---|
| **Bre-B QR — Factus Pay** | **Medio por defecto** para mensualidades (es como ya pagan) | No (QR nuevo cada mes) | **$800 + IVA = $952/tx**, sin mensualidad | F0 adaptador listo en sandbox; producción "mediados de octubre"; **falta confirmar de quién es la plata** (§6) |
| **Wompi tarjeta** | Débito automático para quien quiere olvidarse | **Sí** (`payment_sources`) | ~3 % + IVA | Checkout de Dynasty **roto** (§4.1); autopay F0–F2 en base, apagado |
| **Wompi Nequi** | Débito automático sin tarjeta | **Sí** (autoriza una vez) | Comisión Wompi | Probado en sandbox; F4 del autopay |
| **Wompi PSE** | Pago puntual | No | Comisión Wompi | Vivo solo en Dynasty |
| **Mercado Pago** | Diferido | Solo tarjeta | ~3,49 % + IVA | Apagado (D1/SEG-23); OAuth y Marketplace sin empezar |
| **Transferencia + comprobante** | Transición; se mantiene mientras exista | No | $0 | Cola de comprobantes viva en Dynasty |
| **Efectivo** | Se registra a mano | No | $0 | Vivo |

**Descartados:** Mono directo como cuenta central (4,7 % del volumen, ~$63 M/año, no vigilado, bloqueo sin aviso, filtro de $600 M en ventas) y el modelo "cuenta única de SportMaps + dispersión + pago de servicios públicos" (exige licencia SEDPE).

---

## 4. Estado real por frente

### 4.1 Pasarela y cuenta propia por escuela (`docs/payments-connected-accounts-plan.md`)

- `payment_mode`: **369 `unset`** (sin cobro en línea), **1 `aggregator`** (Dynasty, llaves `WOMPI_*` de ENV que son de Dynasty), **1 `direct`** (Escuela Demo, sandbox).
- F0 fundaciones ~85–90 %: cifrado AES-GCM en BFF, `payment_provider_secrets` sellada, firma Wompi en el BFF, webhook por escuela. **Falta:** endpoint para cambiar `payment_mode` (hoy solo SQL), validar llaves contra la API, auditoría.
- F1 MP OAuth + `application_fee` 1 %: 0 %. **Aprobación de MP Marketplace: no hay evidencia de que se haya pedido.**
- F2 wizard Wompi: 0 % (conecta soporte desde `PaymentProvidersAdmin`, solo platform admin).
- **🔴 Checkout de Dynasty sigue roto.** El fix `34083112` (30-09) está en `main`, pero el 2026-10-05 un PSE volvió a caer al comercio **sandbox** `11981889` ("La firma es inválida"). **Desde el 20-09 Dynasty no tiene ningún pago en línea aprobado**; del 01 al 07-10, 10 links: 1 fallido contra sandbox y 9 abandonados. Hipótesis sin verificar: fallback `publicKey || VITE_WOMPI_PUBLIC_KEY` en `frontend/src/lib/api/wompi.ts:147`, firma por la Edge Function, build/SW viejo en el celular, o el BFF devolviendo `pub_test_`.

### 4.2 Débito automático (`docs/specs/debito-automatico.md`)

- **F0 y F1 aplicadas** (`20261005112635`, `20261005133733`): `recurring_subscriptions`, `autopay_cycles`, `recurring_charge_attempts`, `autopay_incidents` — todas en 0 filas.
- **F2 motor:** la parte de base **ya está viva sin registro** en `schema_migrations` (aplicada por SQL editor): `autopay_sweep_due`, `autopay_cron_tick`, crons `autopay-daily` y `autopay-sweep` activos. El BFF (`autopay.service.ts`, `internal-autopay.routes.ts`, cambios en `payments.routes.ts`, `wompi.ts`, `wompi.service.ts`, `cobro-enlace-publico.service.ts`) está **sin commitear**, en el árbol de otra sesión.
- **Hoy no puede cobrar:** `platform_config.autopay_runner.base_url` = null, faltan los secretos de vault, el BFF exige `AUTOPAY_RUNNER_ENABLED=true`, y las 371 escuelas tienen `autopay_enabled=false`.
- F3 (UI familia/tarjeta), F4 (Nequi), F5 (panel escuela), F6 (piloto): 0 %.
- Preguntas a Wompi sin respuesta: duración del token Nequi, cancelación desde la app, reversa Nequi, PCI del formulario propio, obligatoriedad de `acceptance_token` en producción.

### 4.3 Bre-B QR — Factus Pay (`docs/specs/factus-pay-recaudo-qr.md`)

- Condiciones comerciales recibidas: $0 implementación, sin mensualidad, **$800 + IVA por transacción** (recibir o enviar), P2P y P2B, **no B2B**, tope $12,1 M, producción a mediados de octubre. Opera sobre **Mono**, con **Bancoomeva** detrás.
- F0 hecho: `bff/src/services/factus-pay.service.ts` (21 tests, sandbox). Sin webhook documentado; QR vence a 24 h; mínimo $10.000.
- **Cambio de orden respecto al spec:** F1 (QR en la factura SaaS que SportMaps cobra a la escuela) **queda en duda** porque escuela→SportMaps es **B2B**, no soportado. La prioridad pasa a **F3: mensualidades padre→escuela**, si Factus confirma cuenta a nombre de cada escuela.
- En la documentación de Mono, la plata real vive en la cuenta *tenant* y los clientes finales tienen saldos virtuales; Mono sí emite webhook `collection.paid` firmado con HMAC. Hay que saber si Factus da un tenant por escuela.

### 4.4 Cobro por WhatsApp con IA (`whatsapp-pagos-en-el-chat.md`, `ventas-por-whatsapp.md`, `whatsapp-cola-de-comprobantes-plan.md`)

- **Conectado:** solo Dynasty (desde 2026-10-02, +57 320 4298969, IA prendida, 2.522 mensajes en 30 días). Besser y Monster **sin conectar**.
- **Ya hace:** estado de cuenta con link "Pagar", cola de comprobantes (OCR + veredicto en servidor + anti-duplicado), cobro suelto con link de 1 h (carril B; F0 aplicado, F1+F2 en `98f3e17c`), recordatorios −3/−1/0/+3/+10/+20.
- **Uso real:** ventas apagadas en las 3 escuelas (0 cobros sueltos); `collection_notices` en 0 filas (no ha salido ningún recordatorio); en Dynasty, de 151 archivos en 30 días, 37 se aplicaron a pagos y **0 se auto-aprobaron**: los aprobó una persona con 8,2 h de demora promedio, porque la auto-aprobación está apagada.
- Seguridad: arreglo contra inyección de prompt (`64914f09`). Pendiente: límite de comprobantes por número, `amount` que pone el cliente, código al re-vincular número, y cruzar la auto-aprobación contra la fuente del dinero (DKIM/webhook).

### 4.5 Ciclo de cobro y cobranza (`vigencia-cobranza-y-sesiones-unificado.md`, `cobranza-vencidos-estados-y-alertas.md`)

- Vivo: `open_month` como única vía de generación (cron 06:30 UTC), índices anti-duplicado por periodo, descuento de hermanos, `apply_late_fees`, `send_payment_reminders`, `expire-overdue-enrollments`.
- Adopción: mora encendida en 5 escuelas; **apagada en las 3 piloto**. Recordatorios solo en Besser.
- Pendiente: escalera de avisos multicanal, bandeja de cobranza, `enrollment_periods`, pausa.
- **Riesgos de dinero abiertos:**
  - **DIN-24 ✅ (corregido 10-07):** el guard de pagos (`20261002125957`, trigger `trg_zz_guard_payments_client`) **sí está vivo** desde el 2026-10-04 y `735c8869` ya está en `main`. Desde el 10-04, 0 INSERT de padres/atletas en `payments`. Riesgo residual: `PaymentCheckoutModal.tsx` (~L680/L695) registra el éxito de tarjeta MP desde el cliente; el guard lo bloquearía después de cobrar → mover al webhook/BFF **antes** de activar MP.
  - DIN-13/16: 41 fichas duplicadas que facturan doble en Dynasty (~$1,77 M/mes).
  - B1/B2: `students.ts:829` fabrica inscripciones huérfanas.
  - DIN-25: `open_month` no filtra atletas inactivos.
- **Monster no factura nada:** 125 inscripciones activas sin plan ni monto.

### 4.6 Conciliación

- Esquema y RPC existen (`bank_statements`, `reconcile_statement`, parser CSV), pero hay **0 extractos cargados**. Pagos `paid`: 1.146 sin conciliar, 151 "confirmado" (por OCR/auto, no contra banco).
- Correos del banco con DKIM: parser listo (`banco-correo-parser.service.ts`, 17 tests). Falta el webhook `resend-inbound`, la verificación DKIM y el cruce.

---

## 5. Orden de ejecución (único)

Cada fase deja algo usable y no depende de las siguientes.

### Fase 0 — Tapar fugas de dinero (ya, sin depender de nadie)
1. ~~Aplicar el guard de pagos (DIN-24)~~ **ya estaba vivo** (verificado 10-07).
2. **Arreglar el checkout de Dynasty:** medir qué `publicKey` devuelve `create-session` en prod para cada camino (`ParentCheckoutPage`, `usePaymentCheckout`, `PaymentProviderGate`, `cobroPublico`), eliminar el fallback a `VITE_WOMPI_PUBLIC_KEY` y la firma por Edge Function; validar con un pago real.
3. **Commitear F2 del autopay** (la sesión dueña). `20261007134859` ya quedó registrada en `schema_migrations` el 10-07 (verificada por md5 contra lo vivo), junto con `20261002125955/125959/130001`.
4. **Cargarle montos a Monster.** Los 4 planes ya existen (Tarifa plena 145k, Mayores mixto 135k, Doble 165k, Mayores doble 155k) pero ninguna inscripción los tiene; los 13 equipos tienen precio 0. Falta de la escuela: precio por equipo, plan de los 12 de doble categoría, descuentos, mes de inicio (si es noviembre, apagar `auto_generate_payments` hasta el 1-nov) y **cuenta de recaudo** (no tiene banco/Bre-B/Nequi cargados; con `auto_cancel_overdue_enabled=true` cancelaría inscripciones a ~42 días).

### Fase 1 — Confirmar transferencias sin pantallazo (el 97 % del dinero)
1. Encender la **auto-aprobación** en Dynasty con su tope, una vez esté el cruce del punto 3; mientras tanto, bajar las 8,2 h de espera con la bandeja agrupada.
2. Cerrar los pendientes de seguridad del bot: límite de comprobantes, `amount` desde el servidor, código al re-vincular.
3. **Conciliación con correo del banco (DKIM)** como fuente principal: webhook `resend-inbound` + verificación + cruce contra `payments`. Extracto CSV/XLSX como respaldo.

### Fase 2 — Bre-B QR por escuela (Factus Pay) — depende de las respuestas de Factus
1. Mandar las preguntas de §6. **Si la plata no queda a nombre de la escuela, esta fase no se hace.**
2. Si sí: token cifrado por escuela (mismo patrón que `payment_provider_secrets`), QR en el cobro (app + WhatsApp), confirmación por webhook o consulta cada 5 min, retiro diario automático al banco de la escuela.
3. Piloto Dynasty un mes, conciliando contra su extracto; luego Besser y Monster.

### Fase 3 — Débito automático (Wompi tarjeta + Nequi)
Requiere Fase 0.2 cerrada. Encender el runner (vault, `base_url`, un solo BFF), F3 UI de familia con inscripción por link, F4 Nequi, F5 panel de escuela, F6 piloto Dynasty con el recargo que decida (D3).

### Fase 4 — WhatsApp como canal completo
Conectar Besser y Monster; activar ventas (carril B) y recordatorios; el bot ofrece QR Bre-B por defecto y el link de inscripción del débito automático a quien lo quiera.

### Fase 5 — Cuenta propia para todas las escuelas y monetización
Endpoint para `payment_mode`, Dynasty de `aggregator` a `direct` (orden estricto: clave → código → llaves → un cobro real → vaciar ENV), wizard Wompi, MP OAuth + Marketplace (pedir la aprobación ya, toma semanas), "Mis ganancias" y facturación del fee vía Factus.

---

## 6. Preguntas para Factus Pay (deciden la Fase 2)

1. Cuando un acudiente le paga a una escuela, ¿la plata queda en una cuenta **a nombre de la escuela (su NIT)** o en una cuenta de Factus/SportMaps con saldo virtual?
2. ¿Podemos registrar a cada escuela como comercio propio bajo nuestra integración y operar sus cobros por API con un token por escuela? ¿El alta la hacemos nosotros por API?
3. ¿Qué entidad custodia los fondos (Bancoomeva, Coopcentral)? ¿Aplica Fogafín a nombre de la escuela?
4. ¿Hay webhook firmado de pago recibido? Si no, ¿límite de consultas por minuto?
5. ¿Retiro automático diario al banco de la escuela? ¿Cuánto tarda? ¿Cuesta $800 + IVA?
6. Si se bloquea la cuenta de una escuela, ¿quién responde, por qué canal y en cuánto tiempo se libera el dinero?
7. ¿El QR sigue venciendo a las 24 h? ¿QR fijo por escuela y dinámico por cobro? ¿Se paga desde cualquier banco o billetera?
8. ¿Cuándo habilitan B2B?
9. ¿Los $800 + IVA se facturan a cada escuela o a SportMaps? ¿Con factura electrónica a nombre de la escuela?
10. ¿Fecha exacta de producción? ¿Piloto con una escuela en la primera semana?

### 6.1 Respuestas de Factus (2026-10-08) y veredicto

| # | Respondieron | Lectura |
|---|---|---|
| 1 | La plata entra a **una cuenta de Factus Pay**. Al comienzo **Factus dispersa una vez por semana**; después «ustedes» podrán enviarla, a la llave Bre-B de cada empresa. | ⚠️ **No pasa todavía.** La plata no cae en la cuenta bancaria de la escuela, sino en Factus Pay, y llega hasta 7 días después; con transferencia llega al instante. Hay que aclarar si «ustedes» es la escuela o SportMaps (ver 6.2). |
| 2 | Una cuenta propia por NIT con acceso a la API. El alta la hace Factus y envía los accesos, como en sandbox. | ✅ Sirve: token por escuela, sin alta por API. |
| 3 | Custodia **Bancoomeva**. | ⚠️ No respondieron por Fogafín ni si el saldo está a nombre de la escuela. |
| 4 | **Webhook en desarrollo**, todavía no existe. | ⚠️ Mientras tanto toca consultar el estado; no dieron el límite de consultas. |
| 5 | Dispersión desde el panel, puede ser diaria, llega al instante a la llave, **$800 + IVA por dispersión** (agrupa varios recaudos). | ✅ con reparo: es manual desde el panel, no programada por API. Costo real = $952 por pago + $952 por dispersión. |
| 6 | «No tenemos forma de bloqueos.» | ❓ Entendieron otra cosa. Hay que repreguntar por retenciones (ver 6.2). |
| 7 | El QR vence por defecto. Con el parámetro `expiration` se ajusta; al vencer se pide otra vez con la misma referencia y monto. | ✅ Coincide con el adaptador F0. No dijeron si hay pago sin escanear desde el mismo celular. |
| 8 | **B2B no se puede**: es una limitación de Bre-B. Persona natural → empresa sí. | ❌ Factus Pay **no sirve para cobrar la suscripción SaaS** a las escuelas. D-M8 se resuelve con Wompi o transferencia. |
| 9 | La comisión de recaudo y de dispersión se le factura **a cada empresa**. | ✅ SportMaps no paga ni refactura comisiones. |
| 10 | **Sin fecha de producción**, están en validaciones. | ❌ La Fase 2 no tiene fecha. |

**Veredicto:** la Fase 2 **sigue bloqueada** (D-M1 no pasa todavía) y **la Fase 1 manda**: confirmar transferencias con el correo del banco (DKIM) mueve el 97 % del dinero, no depende de nadie y la plata ya llega al instante a la cuenta de la escuela. Factus queda como canal futuro: el adaptador F0 se conserva sin conectar a producción.

### 6.2 Repreguntas para Factus (texto listo para enviar)

1. Cuando dicen que el dinero entra a una cuenta de Factus Pay: ¿cada escuela tiene una **cuenta o depósito a su nombre (su NIT) en Bancoomeva**, o un saldo dentro de una cuenta global de Factus? ¿Qué figura regulada tiene Factus Pay ante la Superfinanciera?
2. «Posteriormente serían ustedes quienes tienen la potestad de enviarla»: ¿«ustedes» es la **escuela** o **SportMaps**? Necesitamos que **solo la escuela** pueda mover su plata. SportMaps solo crea cobros y consulta estados. ¿Se pueden dar tokens con permisos separados (crear cobro y consultar sí, dispersar no)?
3. ¿Desde qué fecha la dispersión deja de ser semanal? ¿Se puede **programar automática** (por ejemplo, todos los días a las 6 p. m.) o siempre es manual en el panel?
4. ¿El saldo de cada escuela está cubierto por **Fogafín** a su nombre?
5. Sobre bloqueos, de otra forma: si Bancoomeva o Factus **retienen fondos** de una escuela (revisión SARLAFT, embargo, un pago reportado como fraude), ¿quién le avisa a la escuela, por qué canal y en cuánto tiempo se resuelve? ¿Bre-B tiene **reversos** o contracargos?
6. **Webhook:** ¿fecha estimada? ¿Viene firmado (HMAC) para validar que es de ustedes? Mientras tanto, ¿cuántas consultas por minuto podemos hacer?
7. Si el acudiente abre el cobro en el **mismo celular** con el que paga, no puede escanear el QR. ¿Hay enlace o llave Bre-B para pagar sin escanear?
8. ¿Siguen el mínimo de $10.000 y el tope de $12,1 M por pago?
9. ¿La comisión se descuenta del saldo antes de dispersar o se factura aparte? ¿Cada escuela firma contrato y hace su propio proceso de conocimiento del cliente (SARLAFT) con ustedes? ¿Qué documentos piden?

---

## 7. Decisiones abiertas

| # | Decisión | Quién |
|---|---|---|
| D-M1 | ¿Factus Pay pasa los criterios 1–3 de §6? **No todavía (10-08):** la plata entra a Factus Pay y se dispersa semanal; faltan las repreguntas de §6.2 | Respuesta de Factus |
| D-M2 | ¿Quién paga los $952 por transacción Bre-B: la familia (recargo fijo) o la escuela? | Cada escuela (principio 5) |
| D-M3 | Recargo del débito automático en el piloto Dynasty (D3 del spec) | Dynasty |
| D-M4 | ¿Conciliación principal por correo DKIM o por extracto? Propuesta: DKIM principal, extracto respaldo | Usuario |
| D-M5 | ¿Encender mora y recordatorios en las 3 piloto? | Cada escuela |
| D-M6 | Qué hacer con los cobros de Porras/MMA que entraron a una cuenta MP ajena (D2 de cuentas conectadas) | Usuario |
| D-M7 | ¿Pedir ya la aprobación de MP Marketplace o posponer MP indefinidamente? | Usuario |
| D-M8 | Cobro de la suscripción SaaS a escuelas: ~~Factus Pay cuando haya B2B~~ (Factus confirmó 10-08 que Bre-B no permite B2B) → **Wompi o transferencia** | Usuario |

---

## 8. Specs de detalle (fuente de cada frente)

- Cuenta propia y ruteo: `docs/payments-connected-accounts-plan.md`, `docs/payments-connected-accounts-STATUS.md`, `docs/plan-cierre-ruteo-de-pagos.md`
- Débito automático: `docs/specs/debito-automatico.md` *(su encabezado aún dice "no hay código": desactualizado)*
- Bre-B / Factus Pay: `docs/specs/factus-pay-recaudo-qr.md`
- WhatsApp: `docs/specs/whatsapp-pagos-en-el-chat.md`, `docs/specs/ventas-por-whatsapp.md` *(dice F0 sin aplicar: ya está vivo)*, `docs/specs/whatsapp-cola-de-comprobantes-plan.md`
- Seguridad IA y pagos: `docs/cierre-seguridad-ia-pagos-2026-10-05.md`
- Ciclo, cobranza y duplicados: `docs/specs/vigencia-cobranza-y-sesiones-unificado.md`, `docs/specs/cobranza-vencidos-estados-y-alertas.md`, `docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md`, `docs/plan-f0-inscripciones-y-cobros-duplicados.md`
- Blindaje de dinero: `docs/specs/blindaje-dinero-pagos-tienda-nomina.md`
